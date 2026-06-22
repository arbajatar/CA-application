<?php

namespace App\Http\Controllers\Api\CA;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class BackupController extends Controller
{
    public function logs(Request $request)
    {
        try {
            $logs = DB::table('backup_logs')
                ->leftJoin('users', 'backup_logs.created_by', '=', 'users.id')
                ->select('backup_logs.*', 'users.name as user_name')
                ->orderBy('backup_logs.created_at', 'desc')
                ->limit(50)
                ->get();

            $mappedLogs = $logs->map(function ($log, $index) {
                $exists = false;
                // Only verify S3/local file existence for the latest 15 logs to prevent memory exhaustion / timeout
                if ($log->filename && $index < 15) {
                    try {
                        $disk = env('FILESYSTEM_DISK', 'public');
                        if ($disk === 's3') {
                            $exists = Storage::disk('s3_backup')->exists($log->filename);
                        } else {
                            $filePath = storage_path('app/' . $log->filename);
                            $exists = file_exists($filePath);
                        }
                    } catch (\Exception $e) {
                        Log::warning('Backup file existence check failed: ' . $e->getMessage());
                        $exists = false;
                    }
                }
                $log->file_exists = $exists;
                return $log;
            });

            return response()->json(['data' => $mappedLogs]);
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

            $dbHost = config('database.connections.mysql.host');
            $dbPort = config('database.connections.mysql.port', '3306');
            $dbName = config('database.connections.mysql.database');
            $dbUser = config('database.connections.mysql.username');
            $dbPass = config('database.connections.mysql.password');

            $success = false;

            // Try mysqldump command first
            if (function_exists('exec') && !in_array('exec', explode(',', ini_get('disable_functions')))) {
                try {
                    $escapedHost = escapeshellarg($dbHost);
                    $escapedPort = escapeshellarg($dbPort);
                    $escapedUser = escapeshellarg($dbUser);
                    $escapedPass = $dbPass !== '' ? '-p' . escapeshellarg($dbPass) : '';
                    $escapedName = escapeshellarg($dbName);
                    $escapedPath = escapeshellarg($tempPath);

                    $command = "mysqldump --host={$escapedHost} --port={$escapedPort} --user={$escapedUser} {$escapedPass} {$escapedName} > {$escapedPath} 2>&1";
                    $output = [];
                    $returnVar = -1;
                    exec($command, $output, $returnVar);

                    if ($returnVar === 0 && file_exists($tempPath) && filesize($tempPath) > 0) {
                        $success = true;
                    } else {
                        Log::warning('mysqldump failed: ' . implode("\n", $output) . '. Falling back to PHP backup routine.');
                        if (file_exists($tempPath)) {
                            @unlink($tempPath);
                        }
                    }
                } catch (\Exception $e) {
                    Log::warning('mysqldump execution failed: ' . $e->getMessage() . '. Falling back to PHP backup routine.');
                    if (file_exists($tempPath)) {
                        @unlink($tempPath);
                    }
                }
            }

            // Fallback PHP backup routine
            if (!$success) {
                $out = fopen($tempPath, 'w');
                if (!$out) {
                    throw new \Exception("Could not open file for writing: " . $tempPath);
                }

                $pdo = DB::connection()->getPdo();
                // Disable query buffering to prevent memory exhaustion on large tables
                $pdo->setAttribute(\PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);

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
                    $createTableResult->closeCursor();

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
                    $rowsResult->closeCursor();
                    fwrite($out, "\n");
                }

                // Restore query buffering
                $pdo->setAttribute(\PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);

                fwrite($out, "SET FOREIGN_KEY_CHECKS=1;\n");
                fclose($out);
            }

            $fileSize = filesize($tempPath);

            $disk = env('FILESYSTEM_DISK', 'public');
            if ($disk === 's3') {
                $s3Path = "ca_application/db_backup/" . $filename;
                $stream = fopen($tempPath, 'r');
                Storage::disk('s3_backup')->putStream($s3Path, $stream, [
                    'visibility'  => 'public',
                ]);
                if (is_resource($stream)) {
                    fclose($stream);
                }
                $filenameForLog = $s3Path;
            } else {
                $filenameForLog = $filename;
            }

            // Insert backup log entry
            DB::table('backup_logs')->insert([
                'filename' => $filenameForLog,
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

    public function getSettings(Request $request)
    {
        try {
            $settings = DB::table('backup_settings')->first();
            return response()->json(['data' => $settings]);
        } catch (\Exception $e) {
            Log::error('Fetch Backup Settings Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load backup settings.'], 500);
        }
    }

    public function updateSettings(Request $request)
    {
        $request->validate([
            'auto_backup_enabled' => 'required|boolean',
            'frequency' => 'required|string|in:minutely,hourly,daily,weekly,monthly,quarterly,half_yearly,yearly',
            'time' => 'required|string|regex:/^\d{2}:\d{2}$/',
            'keep_backups_days' => 'required|integer|min:1',
            'day_of_week' => 'nullable|integer|between:0,6',
            'day_of_month' => 'nullable|integer|between:1,59',
            'month_of_year' => 'nullable|integer|between:1,12',

            's3_backup_enabled' => 'required|boolean',
            's3_frequency' => 'required|string|in:minutely,hourly,daily,weekly,monthly,quarterly,half_yearly,yearly',
            's3_time' => 'required|string|regex:/^\d{2}:\d{2}$/',
            's3_keep_backups_days' => 'required|integer|min:1',
            's3_day_of_week' => 'nullable|integer|between:0,6',
            's3_day_of_month' => 'nullable|integer|between:1,59',
            's3_month_of_year' => 'nullable|integer|between:1,12',
        ]);

        try {
            DB::table('backup_settings')->updateOrInsert(
                ['id' => 1],
                [
                    'auto_backup_enabled' => $request->auto_backup_enabled,
                    'frequency' => $request->frequency,
                    'time' => $request->time,
                    'keep_backups_days' => $request->keep_backups_days,
                    'day_of_week' => $request->input('day_of_week', 0),
                    'day_of_month' => $request->input('day_of_month', 1),
                    'month_of_year' => $request->input('month_of_year', 1),

                    's3_backup_enabled' => $request->s3_backup_enabled,
                    's3_frequency' => $request->s3_frequency,
                    's3_time' => $request->s3_time,
                    's3_keep_backups_days' => $request->s3_keep_backups_days,
                    's3_day_of_week' => $request->input('s3_day_of_week', 0),
                    's3_day_of_month' => $request->input('s3_day_of_month', 1),
                    's3_month_of_year' => $request->input('s3_month_of_year', 1),
                    'updated_at' => now(),
                ]
            );

            return response()->json(['message' => 'Backup settings updated successfully!']);
        } catch (\Exception $e) {
            Log::error('Update Backup Settings Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to update backup settings.'], 500);
        }
    }

    public function previewSaved(Request $request, $id)
    {
        $filePath = null;
        $isTemp = false;
        try {
            $log = DB::table('backup_logs')->where('id', $id)->first();
            if (!$log) {
                return response()->json(['message' => 'Backup log record not found.'], 404);
            }

            $disk = env('FILESYSTEM_DISK', 'public');
            if ($disk === 's3') {
                if (!Storage::disk('s3_backup')->exists($log->filename)) {
                    return response()->json(['message' => 'Backup file does not exist on S3.'], 404);
                }
                $tempPath = storage_path('app/temp_preview_' . time() . '.sql');
                $stream = Storage::disk('s3_backup')->readStream($log->filename);
                $localFile = fopen($tempPath, 'w');
                if ($stream && $localFile) {
                    stream_copy_to_stream($stream, $localFile);
                    fclose($localFile);
                    fclose($stream);
                } else {
                    throw new \Exception("Failed to stream backup file from S3.");
                }
                $filePath = $tempPath;
                $isTemp = true;
            } else {
                $filePath = storage_path('app/' . $log->filename);
                if (!file_exists($filePath)) {
                    return response()->json(['message' => 'Backup file does not exist on the server.'], 404);
                }
            }

            $fileHandle = fopen($filePath, 'r');
            if (!$fileHandle) {
                throw new \Exception("Could not open backup file for preview.");
            }

            $tableMap = [];

            while (($line = fgets($fileHandle)) !== false) {
                $trimmedLine = trim($line);
                if ($trimmedLine === '') {
                    continue;
                }

                if (preg_match('/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([^`]+)`/i', $trimmedLine, $matches)) {
                    $tableName = $matches[1];
                    if (!isset($tableMap[$tableName])) {
                        $tableMap[$tableName] = 0;
                    }
                }

                if (preg_match('/^INSERT\s+INTO\s+`([^`]+)`/i', $trimmedLine, $matches)) {
                    $tableName = $matches[1];
                    if (!isset($tableMap[$tableName])) {
                        $tableMap[$tableName] = 1;
                    } else {
                        $tableMap[$tableName]++;
                    }
                }
            }

            fclose($fileHandle);
            if ($isTemp && file_exists($filePath)) {
                @unlink($filePath);
            }

            $data = [];
            foreach ($tableMap as $table => $rows) {
                $data[] = [
                    'table' => $table,
                    'rows' => $rows
                ];
            }

            usort($data, function ($a, $b) {
                if ($b['rows'] === $a['rows']) {
                    return strcmp($a['table'], $b['table']);
                }
                return $b['rows'] - $a['rows'];
            });

            return response()->json(['data' => $data]);
        } catch (\Exception $e) {
            if ($isTemp && $filePath && file_exists($filePath)) {
                @unlink($filePath);
            }
            Log::error('Preview Saved Backup Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to preview backup: ' . $e->getMessage()], 500);
        }
    }

    public function downloadSaved(Request $request, $id)
    {
        try {
            $log = DB::table('backup_logs')->where('id', $id)->first();
            if (!$log) {
                return response()->json(['message' => 'Backup log record not found.'], 404);
            }

            $disk = env('FILESYSTEM_DISK', 'public');
            if ($disk === 's3') {
                if (!Storage::disk('s3_backup')->exists($log->filename)) {
                    return response()->json(['message' => 'Backup file does not exist on S3.'], 404);
                }
                return Storage::disk('s3_backup')->download($log->filename, basename($log->filename));
            } else {
                $filePath = storage_path('app/' . $log->filename);
                if (!file_exists($filePath)) {
                    return response()->json(['message' => 'Backup file does not exist on the server.'], 404);
                }
                $downloadName = basename($log->filename);
                return response()->download($filePath, $downloadName);
            }
        } catch (\Exception $e) {
            Log::error('Download Saved Backup Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to download backup file.'], 500);
        }
    }

    public function restoreSaved(Request $request, $id)
    {
        $request->validate([
            'restore_by' => 'required|string',
        ]);

        $filePath = null;
        $isTemp = false;
        try {
            $log = DB::table('backup_logs')->where('id', $id)->first();
            if (!$log) {
                return response()->json(['message' => 'Backup log record not found.'], 404);
            }

            $disk = env('FILESYSTEM_DISK', 'public');
            if ($disk === 's3') {
                if (!Storage::disk('s3_backup')->exists($log->filename)) {
                    return response()->json(['message' => 'Backup file does not exist on S3.'], 404);
                }
                $tempPath = storage_path('app/temp_restore_download_' . time() . '.sql');
                $stream = Storage::disk('s3_backup')->readStream($log->filename);
                $localFile = fopen($tempPath, 'w');
                if ($stream && $localFile) {
                    stream_copy_to_stream($stream, $localFile);
                    fclose($localFile);
                    fclose($stream);
                } else {
                    throw new \Exception("Failed to stream backup file from S3.");
                }
                $filePath = $tempPath;
                $isTemp = true;
            } else {
                $filePath = storage_path('app/' . $log->filename);
                if (!file_exists($filePath)) {
                    return response()->json(['message' => 'Backup file does not exist on the server.'], 404);
                }
            }

            $tempSqlPath = storage_path('app/temp_restore_' . time() . '.sql');

            $fileHandle = fopen($filePath, 'r');
            $tempSqlHandle = fopen($tempSqlPath, 'w');

            if (!$fileHandle || !$tempSqlHandle) {
                throw new \Exception("Could not open files for restoring.");
            }

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
            if ($isTemp && file_exists($filePath)) {
                @unlink($filePath);
            }

            $filteredSql = file_get_contents($tempSqlPath);
            @unlink($tempSqlPath);

            if (empty(trim($filteredSql))) {
                return response()->json(['message' => 'The backup file contains no restore data.'], 400);
            }

            // Execute SQL in unprepared format (ignores standard single query limits)
            DB::unprepared($filteredSql);

            // Log the restore event
            DB::table('backup_logs')->insert([
                'filename' => basename($log->filename),
                'backup_by' => $request->input('restore_by'),
                'action' => 'restore',
                'file_size' => $this->formatBytes(filesize($filePath)),
                'created_by' => $request->user()?->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json(['message' => 'Database successfully restored from saved backup!']);
        } catch (\Exception $e) {
            if ($isTemp && $filePath && file_exists($filePath)) {
                @unlink($filePath);
            }
            Log::error('Restore Saved Backup Failed: ' . $e->getMessage());
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
