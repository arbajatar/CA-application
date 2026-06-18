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
            $pdo = DB::connection()->getPdo();
            $tables = [];
            $result = $pdo->query('SHOW TABLES');
            while ($row = $result->fetch(\PDO::FETCH_NUM)) {
                $tables[] = $row[0];
            }

            $sql = "-- Database Backup\n";
            $sql .= "-- Generated at: " . date('Y-m-d H:i:s') . "\n";
            $sql .= "SET FOREIGN_KEY_CHECKS=0;\n\n";

            foreach ($tables as $table) {
                // Drop table statement
                $sql .= "DROP TABLE IF EXISTS `" . $table . "`;\n";

                // Show Create Table statement
                $createTableResult = $pdo->query("SHOW CREATE TABLE `" . $table . "`");
                $createTableRow = $createTableResult->fetch(\PDO::FETCH_ASSOC);
                $sql .= $createTableRow['Create Table'] . ";\n\n";

                // Insert statements
                $rowsResult = $pdo->query("SELECT * FROM `" . $table . "`");
                $columnCount = $rowsResult->columnCount();

                // Get column names
                $columns = [];
                for ($i = 0; $i < $columnCount; $i++) {
                    $meta = $rowsResult->getColumnMeta($i);
                    $columns[] = "`" . $meta['name'] . "`";
                }

                $columnsStr = implode(', ', $columns);

                while ($row = $rowsResult->fetch(\PDO::FETCH_NUM)) {
                    $values = [];
                    foreach ($row as $val) {
                        if (is_null($val)) {
                            $values[] = "NULL";
                        } else {
                            $values[] = $pdo->quote($val);
                        }
                    }
                    $sql .= "INSERT INTO `" . $table . "` (" . $columnsStr . ") VALUES (" . implode(', ', $values) . ");\n";
                }
                $sql .= "\n";
            }

            $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";

            $filename = 'CA_Application_Backup_' . date('Y-m-d') . '.sql';

            // Insert backup log entry
            DB::table('backup_logs')->insert([
                'filename' => $filename,
                'backup_by' => $request->query('backup_by') ?: ($request->user()?->name ?: 'Super Admin'),
                'action' => 'backup',
                'file_size' => $this->formatBytes(strlen($sql)),
                'created_by' => $request->user()?->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response($sql, 200, [
                'Content-Type' => 'application/sql',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            ]);
        } catch (\Exception $e) {
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
            $sql = file_get_contents($file->getRealPath());

            if (empty($sql)) {
                return response()->json(['message' => 'The uploaded file is empty.'], 400);
            }

            // Execute SQL in unprepared format (ignores standard single query limits)
            DB::unprepared($sql);

            // Log the restore event into the newly restored backup_logs table
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
