<?php

namespace App\Http\Controllers\Api\CA;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BackupController extends Controller
{
    public function logs(Request $request)
    {
        try {
            $logs = DB::table('backup_logs')
                ->leftJoin('users', 'backup_logs.created_by', '=', 'users.id')
                ->select('backup_logs.*', 'users.name as user_name')
                ->orderBy('backup_logs.created_at', 'desc')
                ->get();

            return response()->json(['data' => $logs]);
        } catch (\Exception $e) {
            Log::error('Backup Logs Fetch Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load backup logs.'], 500);
        }
    }

    public function export(Request $request)
    {
        try {
            $filename = 'CA_Application_Backup_' . date('Y-m-d') . '.sql';
            $tempPath = storage_path('app/' . $filename);

            // Set memory limit and execution time to prevent timeouts for large databases
            @ini_set('memory_limit', '512M');
            @set_time_limit(0);

            $out = fopen($tempPath, 'w');
            if (!$out) {
                throw new \Exception("Could not open file for writing: " . $tempPath);
            }

            $pdo = DB::connection()->getPdo();
            $tables = [];
            $result = $pdo->query('SHOW TABLES');
            while ($row = $result->fetch(\PDO::FETCH_NUM)) {
                $tables[] = $row[0];
            }

            fwrite($out, "-- Database Backup\n");
            fwrite($out, "-- Generated at: " . date('Y-m-d H:i:s') . "\n");
            fwrite($out, "SET FOREIGN_KEY_CHECKS=0;\n\n");

            foreach ($tables as $table) {
                // Drop table statement
                fwrite($out, "DROP TABLE IF EXISTS `" . $table . "`;\n");

                // Show Create Table statement
                $createTableResult = $pdo->query("SHOW CREATE TABLE `" . $table . "`");
                $createTableRow = $createTableResult->fetch(\PDO::FETCH_ASSOC);
                fwrite($out, $createTableRow['Create Table'] . ";\n\n");

                // Insert statements using bulk insertion
                $rowsResult = $pdo->query("SELECT * FROM `" . $table . "`");
                $hasRows = false;
                $batchValues = [];
                $batchSize = 250; // Write up to 250 rows in a single INSERT statement
                $columnsStr = '';

                while ($row = $rowsResult->fetch(\PDO::FETCH_NUM)) {
                    if (!$hasRows) {
                        $hasRows = true;
                        $columnCount = $rowsResult->columnCount();
                        $columns = [];
                        for ($i = 0; $i < $columnCount; $i++) {
                            $meta = $rowsResult->getColumnMeta($i);
                            $columns[] = "`" . $meta['name'] . "`";
                        }
                        $columnsStr = implode(', ', $columns);
                    }

                    $values = [];
                    foreach ($row as $val) {
                        if (is_null($val)) {
                            $values[] = "NULL";
                        } else {
                            $values[] = $pdo->quote($val);
                        }
                    }
                    fwrite($out, "INSERT INTO `" . $table . "` (" . $columnsStr . ") VALUES (" . implode(', ', $values) . ");\n");
                }
                fwrite($out, "\n");
            }

            fwrite($out, "SET FOREIGN_KEY_CHECKS=1;\n");
            fclose($out);

            $fileSize = filesize($tempPath);

            // Insert backup log entry
            DB::table('backup_logs')->insert([
                'filename' => $filename,
                'backup_by' => $request->query('backup_by') ?: ($request->user()?->name ?: 'Super Admin'),
                'action' => 'backup',
                'file_size' => $this->formatBytes($fileSize),
                'created_by' => $request->user()?->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->download($tempPath, $filename)->deleteFileAfterSend(true);
        } catch (\Exception $e) {
            if (isset($tempPath) && file_exists($tempPath)) {
                @unlink($tempPath);
            }
            Log::error('Backup Export Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Backup export failed: ' . $e->getMessage()], 500);
        }
    }

    public function restore(Request $request)
    {
        $request->validate([
            'sql_file' => 'required|file',
            'restore_by' => 'nullable|string',
        ]);

        try {
            $file = $request->file('sql_file');
            $tempSqlPath = storage_path('app/temp_restore_' . time() . '.sql');

            $fileHandle = fopen($file->getRealPath(), 'r');
            $tempSqlHandle = fopen($tempSqlPath, 'w');

            if (!$fileHandle || !$tempSqlHandle) {
                throw new \Exception("Could not open files for restoring.");
            }

            // Strip out operations for tables we want to preserve (logs and active login sessions)
            $tablesToPreserve = ['backup_logs', 'personal_access_tokens', 'sessions'];
            $inPreservedCreate = false;

            while (($line = fgets($fileHandle)) !== false) {
                $trimmedLine = trim($line);
                if ($trimmedLine === '') {
                    if (!$inPreservedCreate) {
                        fwrite($tempSqlHandle, $line);
                    }
                    continue;
                }

                // Check for DROP TABLE
                $isDrop = false;
                foreach ($tablesToPreserve as $table) {
                    if (preg_match('/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?`?' . $table . '`?/i', $trimmedLine)) {
                        $isDrop = true;
                        break;
                    }
                }
                if ($isDrop) {
                    continue;
                }

                // Check for CREATE TABLE start
                $isCreateStart = false;
                foreach ($tablesToPreserve as $table) {
                    if (preg_match('/^CREATE\s+TABLE\s+`?' . $table . '`?/i', $trimmedLine)) {
                        $isCreateStart = true;
                        break;
                    }
                }
                if ($isCreateStart) {
                    $inPreservedCreate = true;
                    continue;
                }

                // Check for CREATE TABLE end (if we are inside a preserved CREATE block)
                if ($inPreservedCreate) {
                    if (preg_match('/;\s*$/', $trimmedLine)) {
                        $inPreservedCreate = false;
                    }
                    continue;
                }

                // Check for INSERT INTO
                $isInsert = false;
                foreach ($tablesToPreserve as $table) {
                    if (preg_match('/^INSERT\s+INTO\s+`?' . $table . '`?/i', $trimmedLine)) {
                        $isInsert = true;
                        break;
                    }
                }
                if ($isInsert) {
                    if (!preg_match('/;\s*$/', $trimmedLine)) {
                        while (($subLine = fgets($fileHandle)) !== false) {
                            if (preg_match('/;\s*$/', trim($subLine))) {
                                break;
                            }
                        }
                    }
                    continue;
                }

                fwrite($tempSqlHandle, $line);
            }

            fclose($fileHandle);
            fclose($tempSqlHandle);

            $filteredSql = file_get_contents($tempSqlPath);
            @unlink($tempSqlPath);

            if (empty(trim($filteredSql))) {
                return response()->json(['message' => 'The uploaded file contains no restore data.'], 400);
            }

            // Execute SQL in unprepared format (ignores standard single query limits)
            DB::unprepared($filteredSql);

            // Log the restore event into the preserved backup_logs table
            DB::table('backup_logs')->insert([
                'filename' => $file->getClientOriginalName(),
                'backup_by' => $request->input('restore_by') ?: ($request->user()?->name ?: 'Super Admin'),
                'action' => 'restore',
                'file_size' => $this->formatBytes($file->getSize()),
                'created_by' => $request->user()?->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json(['message' => 'Database successfully restored!']);
        } catch (\Exception $e) {
            Log::error('Backup Restore Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Restore failed: ' . $e->getMessage()], 500);
        }
    }

    private function formatBytes($bytes, $precision = 2)
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);
        return round($bytes, $precision) . ' ' . $units[$pow];
    }
}
