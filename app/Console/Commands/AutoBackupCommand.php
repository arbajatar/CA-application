<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class AutoBackupCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'backup:run-auto {--force : Force execution ignoring scheduler time and enabled settings}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Perform scheduled automated database and attachment backups and clean up older files based on settings';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        try {
            $settings = DB::table('backup_settings')->first();
            if (!$settings) {
                $this->error('No backup settings found.');
                return 1;
            }

            $isForce = $this->option('force');
            $runLocal = $isForce || $this->isScheduled($settings, 'local');
            $runS3 = $isForce || $this->isScheduled($settings, 's3');
            $runAttLocal = $isForce || $this->isScheduled($settings, 'att_local');
            $runAttS3 = $isForce || $this->isScheduled($settings, 'att_s3');

            if (!$runLocal && !$runS3 && !$runAttLocal && !$runAttS3) {
                $this->info('No automated backups are scheduled to run at this time.');
                return 0;
            }

            // Set memory limit and execution time to prevent timeouts for large databases
            @ini_set('memory_limit', '512M');
            @set_time_limit(0);

            // 1. Run Local Database Backup Routine
            if ($runLocal) {
                $this->info('Starting scheduled local server database backup...');
                $filename = 'CA_Application_Backup_Auto_' . now()->timezone('Asia/Kolkata')->format('Y-m-d_H-i-s') . '.sql';
                $tempPath = $this->generateBackup($filename);
                $fileSize = filesize($tempPath);
                $formattedSize = $this->formatBytes($fileSize);

                // Insert local backup log entry
                DB::table('backup_logs')->insert([
                    'filename' => 'backups/' . $filename,
                    'backup_by' => 'System (Auto)',
                    'action' => 'backup',
                    'file_size' => $formattedSize,
                    'created_by' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $this->info("Local database backup created successfully: {$filename} ({$formattedSize})");

                // Local Cleanup based on local retention policy
                $keepLimit = intval($settings->keep_backups_days);
                if ($keepLimit > 0) {
                    $isCountBased = in_array($settings->frequency, ['minutely', 'hourly', 'monthly', 'quarterly', 'half_yearly', 'yearly']);
                    if ($isCountBased) {
                        $oldBackups = DB::table('backup_logs')
                            ->where('action', 'backup')
                            ->where('filename', 'like', 'backups/%')
                            ->orderBy('created_at', 'desc')
                            ->get()
                            ->slice($keepLimit);

                        foreach ($oldBackups as $oldBackup) {
                            $oldFilePath = storage_path('app/' . $oldBackup->filename);
                            if (file_exists($oldFilePath)) {
                                @unlink($oldFilePath);
                            }
                            $this->info("Deleted old local backup file (count limit exceeded): {$oldBackup->filename}");
                        }
                    } else {
                        $cutoffDate = now()->subDays($keepLimit);
                        $oldBackups = DB::table('backup_logs')
                            ->where('action', 'backup')
                            ->where('filename', 'like', 'backups/%')
                            ->where('created_at', '<', $cutoffDate)
                            ->get();

                        foreach ($oldBackups as $oldBackup) {
                            $oldFilePath = storage_path('app/' . $oldBackup->filename);
                            if (file_exists($oldFilePath)) {
                                @unlink($oldFilePath);
                            }
                            $this->info("Deleted old local backup file (days limit exceeded): {$oldBackup->filename}");
                        }
                    }
                }
            }

            // 1b. Run Local Attachment Backup Routine
            if ($runAttLocal) {
                try {
                    $this->info('Starting scheduled local attachment backup...');
                    $attFilename = 'CA_Attachment_Backup_Auto_' . now()->timezone('Asia/Kolkata')->format('Y-m-d_H-i-s') . '.zip';
                    $attTempPath = $this->generateAttachmentBackup($attFilename);
                    $attFileSize = filesize($attTempPath);
                    $attFormattedSize = $this->formatBytes($attFileSize);

                    DB::table('attachment_backup_logs')->insert([
                        'filename' => 'backups/' . $attFilename,
                        'backup_by' => 'System (Auto)',
                        'action' => 'backup',
                        'file_size' => $attFormattedSize,
                        'created_by' => null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    $this->info("Local attachment backup created successfully: {$attFilename} ({$attFormattedSize})");

                    // Local Attachment Cleanup based on retention policy
                    $keepLimitAtt = intval($settings->att_keep_backups_days);
                    if ($keepLimitAtt > 0) {
                        $isCountBasedAtt = in_array($settings->att_frequency, ['minutely', 'hourly', 'monthly', 'quarterly', 'half_yearly', 'yearly']);
                        if ($isCountBasedAtt) {
                            $oldAttBackups = DB::table('attachment_backup_logs')
                                ->where('action', 'backup')
                                ->where('filename', 'like', 'backups/%')
                                ->orderBy('created_at', 'desc')
                                ->get()
                                ->slice($keepLimitAtt);

                            foreach ($oldAttBackups as $oldBackup) {
                                $oldFilePath = storage_path('app/' . $oldBackup->filename);
                                if (file_exists($oldFilePath)) {
                                    @unlink($oldFilePath);
                                }
                                $this->info("Deleted old local attachment backup file (count limit exceeded): {$oldBackup->filename}");
                            }
                        } else {
                            $cutoffDateAtt = now()->subDays($keepLimitAtt);
                            $oldAttBackups = DB::table('attachment_backup_logs')
                                ->where('action', 'backup')
                                ->where('filename', 'like', 'backups/%')
                                ->where('created_at', '<', $cutoffDateAtt)
                                ->get();

                            foreach ($oldAttBackups as $oldBackup) {
                                $oldFilePath = storage_path('app/' . $oldBackup->filename);
                                if (file_exists($oldFilePath)) {
                                    @unlink($oldFilePath);
                                }
                                $this->info("Deleted old local attachment backup file (days limit exceeded): {$oldBackup->filename}");
                            }
                        }
                    }
                } catch (\Exception $attEx) {
                    Log::error('Auto Attachment Local Backup Failed: ' . $attEx->getMessage());
                    $this->error('Auto attachment local backup failed: ' . $attEx->getMessage());
                }
            }

            // 2. Run S3 Database Backup Routine
            if ($runS3) {
                $this->info('Starting scheduled S3 Space database backup...');
                $filename = 'CA_Application_Backup_S3_' . now()->timezone('Asia/Kolkata')->format('Y-m-d_H-i-s') . '.sql';
                $tempPath = $this->generateBackup($filename);
                $fileSize = filesize($tempPath);
                $formattedSize = $this->formatBytes($fileSize);

                $s3Path = "ca_application/db_backup/" . $filename;
                Storage::disk('s3_backup')->put($s3Path, file_get_contents($tempPath), [
                    'visibility'  => 'public',
                ]);
                @unlink($tempPath);

                // Insert S3 backup log entry
                DB::table('backup_logs')->insert([
                    'filename' => $s3Path,
                    'backup_by' => 'System (S3 Auto)',
                    'action' => 'backup',
                    'file_size' => $formattedSize,
                    'created_by' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $this->info("S3 database backup created successfully: {$filename} ({$formattedSize})");

                // S3 Cleanup based on S3 retention policy
                $keepLimitS3 = intval($settings->s3_keep_backups_days);
                if ($keepLimitS3 > 0) {
                    $isCountBasedS3 = in_array($settings->s3_frequency, ['minutely', 'hourly', 'monthly', 'quarterly', 'half_yearly', 'yearly']);
                    if ($isCountBasedS3) {
                        $oldBackupsS3 = DB::table('backup_logs')
                            ->where('action', 'backup')
                            ->where('filename', 'like', 'ca_application/db_backup/%')
                            ->orderBy('created_at', 'desc')
                            ->get()
                            ->slice($keepLimitS3);

                        foreach ($oldBackupsS3 as $oldBackup) {
                            if (Storage::disk('s3_backup')->exists($oldBackup->filename)) {
                                Storage::disk('s3_backup')->delete($oldBackup->filename);
                            }
                            $this->info("Deleted old S3 database backup file (count limit exceeded): {$oldBackup->filename}");
                        }
                    } else {
                        $cutoffDateS3 = now()->subDays($keepLimitS3);
                        $oldBackupsS3 = DB::table('backup_logs')
                            ->where('action', 'backup')
                            ->where('filename', 'like', 'ca_application/db_backup/%')
                            ->where('created_at', '<', $cutoffDateS3)
                            ->get();

                        foreach ($oldBackupsS3 as $oldBackup) {
                            if (Storage::disk('s3_backup')->exists($oldBackup->filename)) {
                                Storage::disk('s3_backup')->delete($oldBackup->filename);
                            }
                            $this->info("Deleted old S3 database backup file (days limit exceeded): {$oldBackup->filename}");
                        }
                    }
                }
            }

            // 2b. Run S3 Attachment Backup Routine
            if ($runAttS3) {
                try {
                    $this->info('Starting scheduled S3 Space attachment backup...');
                    $attFilename = 'CA_Attachment_Backup_S3_' . now()->timezone('Asia/Kolkata')->format('Y-m-d_H-i-s') . '.zip';
                    $attTempPath = $this->generateAttachmentBackup($attFilename);
                    $attFileSize = filesize($attTempPath);
                    $attFormattedSize = $this->formatBytes($attFileSize);

                    $attS3Path = "ca_application/attachments_backup/" . $attFilename;
                    Storage::disk('s3_backup')->put($attS3Path, file_get_contents($attTempPath), [
                        'visibility'  => 'private', // Store securely with private visibility
                    ]);
                    @unlink($attTempPath);

                    DB::table('attachment_backup_logs')->insert([
                        'filename' => $attS3Path,
                        'backup_by' => 'System (S3 Auto)',
                        'action' => 'backup',
                        'file_size' => $attFormattedSize,
                        'created_by' => null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    $this->info("S3 attachment backup created successfully: {$attFilename} ({$attFormattedSize})");

                    // S3 Attachment Cleanup based on S3 retention policy
                    $keepLimitAttS3 = intval($settings->att_s3_keep_backups_days);
                    if ($keepLimitAttS3 > 0) {
                        $isCountBasedAttS3 = in_array($settings->att_s3_frequency, ['minutely', 'hourly', 'monthly', 'quarterly', 'half_yearly', 'yearly']);
                        if ($isCountBasedAttS3) {
                            $oldAttBackupsS3 = DB::table('attachment_backup_logs')
                                ->where('action', 'backup')
                                ->where('filename', 'like', 'ca_application/attachments_backup/%')
                                ->orderBy('created_at', 'desc')
                                ->get()
                                ->slice($keepLimitAttS3);

                            foreach ($oldAttBackupsS3 as $oldBackup) {
                                if (Storage::disk('s3_backup')->exists($oldBackup->filename)) {
                                    Storage::disk('s3_backup')->delete($oldBackup->filename);
                                }
                                $this->info("Deleted old S3 attachment backup file (count limit exceeded): {$oldBackup->filename}");
                            }
                        } else {
                            $cutoffDateAttS3 = now()->subDays($keepLimitAttS3);
                            $oldAttBackupsS3 = DB::table('attachment_backup_logs')
                                ->where('action', 'backup')
                                ->where('filename', 'like', 'ca_application/attachments_backup/%')
                                ->where('created_at', '<', $cutoffDateAttS3)
                                ->get();

                            foreach ($oldAttBackupsS3 as $oldBackup) {
                                if (Storage::disk('s3_backup')->exists($oldBackup->filename)) {
                                    Storage::disk('s3_backup')->delete($oldBackup->filename);
                                }
                                $this->info("Deleted old S3 attachment backup file (days limit exceeded): {$oldBackup->filename}");
                            }
                        }
                    }
                } catch (\Exception $attEx) {
                    Log::error('Auto Attachment S3 Backup Failed: ' . $attEx->getMessage());
                    $this->error('Auto attachment S3 backup failed: ' . $attEx->getMessage());
                }
            }

            return 0;
        } catch (\Exception $e) {
            Log::error('Auto Backup Command Failed: ' . $e->getMessage());
            $this->error('Auto backup failed: ' . $e->getMessage());
            return 1;
        }
    }

    /**
     * Determine if a backup routine (local or S3) is scheduled to run now.
     */
    private function isScheduled(object $settings, string $prefix): bool
    {
        $enabledField = 'auto_backup_enabled';
        $frequencyField = 'frequency';
        $timeField = 'time';
        $dayOfWeekField = 'day_of_week';
        $dayOfMonthField = 'day_of_month';
        $monthOfYearField = 'month_of_year';

        if ($prefix === 's3') {
            $enabledField = 's3_backup_enabled';
            $frequencyField = 's3_frequency';
            $timeField = 's3_time';
            $dayOfWeekField = 's3_day_of_week';
            $dayOfMonthField = 's3_day_of_month';
            $monthOfYearField = 's3_month_of_year';
        } elseif ($prefix === 'att_local') {
            $enabledField = 'att_auto_backup_enabled';
            $frequencyField = 'att_frequency';
            $timeField = 'att_time';
            $dayOfWeekField = 'att_day_of_week';
            $dayOfMonthField = 'att_day_of_month';
            $monthOfYearField = 'att_month_of_year';
        } elseif ($prefix === 'att_s3') {
            $enabledField = 'att_s3_backup_enabled';
            $frequencyField = 'att_s3_frequency';
            $timeField = 'att_s3_time';
            $dayOfWeekField = 'att_s3_day_of_week';
            $dayOfMonthField = 'att_s3_day_of_month';
            $monthOfYearField = 'att_s3_month_of_year';
        }

        if (!$settings->$enabledField) {
            return false;
        }

        $frequency = $settings->$frequencyField;
        $timeParts = explode(':', $settings->$timeField ?: '02:00');
        $targetHour = $timeParts[0] ?? '02';
        $targetMinute = $timeParts[1] ?? '00';

        $currentTime = now()->timezone('Asia/Kolkata');
        $currentHour = $currentTime->format('H');
        $currentMinute = $currentTime->format('i');

        if ($frequency === 'minutely') {
            $interval = isset($settings->$dayOfMonthField) ? intval($settings->$dayOfMonthField) : 1;
            if ($interval <= 0) {
                $interval = 1;
            }
            return (intval($currentMinute) % $interval === 0);
        }

        if ($frequency === 'hourly') {
            return ($currentMinute === $targetMinute);
        }

        // Hour & Minute must match for other frequencies
        if ($currentHour !== $targetHour || $currentMinute !== $targetMinute) {
            return false;
        }

        $dayOfWeek = $currentTime->dayOfWeek; // 0 (Sunday) to 6 (Saturday)
        $dayOfMonth = $currentTime->day;
        $month = $currentTime->month;

        $targetDayOfWeek = isset($settings->$dayOfWeekField) ? intval($settings->$dayOfWeekField) : 0;
        $targetDayOfMonth = isset($settings->$dayOfMonthField) ? intval($settings->$dayOfMonthField) : 1;
        $targetStartMonth = isset($settings->$monthOfYearField) ? intval($settings->$monthOfYearField) : 1;

        if ($frequency === 'weekly') {
            return ($dayOfWeek === $targetDayOfWeek);
        }

        if ($frequency === 'monthly') {
            return ($dayOfMonth === $targetDayOfMonth);
        }

        if ($frequency === 'quarterly') {
            $monthDiff = $month - $targetStartMonth;
            return ($dayOfMonth === $targetDayOfMonth && $monthDiff >= 0 && $monthDiff % 3 === 0);
        }

        if ($frequency === 'half_yearly') {
            $monthDiff = $month - $targetStartMonth;
            return ($dayOfMonth === $targetDayOfMonth && $monthDiff >= 0 && $monthDiff % 6 === 0);
        }

        if ($frequency === 'yearly') {
            return ($dayOfMonth === $targetDayOfMonth && $month === $targetStartMonth);
        }

        return false;
    }

    /**
     * Generate database SQL file and return its temporary path.
     */
    private function generateBackup(string $filename): string
    {
        $backupsDir = storage_path('app/backups');
        if (!file_exists($backupsDir)) {
            mkdir($backupsDir, 0755, true);
        }

        $tempPath = $backupsDir . '/' . $filename;
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

            fwrite($out, "-- Database Backup (Auto)\n");
            fwrite($out, "-- Generated at: " . date('Y-m-d H:i:s') . "\n");
            fwrite($out, "SET FOREIGN_KEY_CHECKS=0;\n\n");

            foreach ($tables as $table) {
                fwrite($out, "DROP TABLE IF EXISTS `" . $table . "`;\n");

                $createTableResult = $pdo->query("SHOW CREATE TABLE `" . $table . "`");
                $createTableRow = $createTableResult->fetch(\PDO::FETCH_ASSOC);
                fwrite($out, $createTableRow['Create Table'] . ";\n\n");
                $createTableResult->closeCursor();

                $rowsResult = $pdo->query("SELECT * FROM `" . $table . "`");
                $hasRows = false;
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

        return $tempPath;
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

    /**
     * Generate attachments ZIP archive and return its temporary path.
     */
    private function generateAttachmentBackup(string $filename): string
    {
        $backupsDir = storage_path('app/backups');
        if (!file_exists($backupsDir)) {
            mkdir($backupsDir, 0755, true);
        }

        $tempPath = $backupsDir . '/' . $filename;
        $disk = env('FILESYSTEM_DISK', 'public');
        $zip = new \ZipArchive();

        if ($zip->open($tempPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            throw new \Exception("Could not create zip archive: " . $tempPath);
        }

        $hasFiles = false;

        if ($disk === 's3') {
            $files = Storage::disk('s3')->allFiles('ca_application/attachments');
            foreach ($files as $file) {
                try {
                    $fileContent = Storage::disk('s3')->get($file);
                    $relativeName = str_replace('ca_application/attachments/', '', $file);
                    $zip->addFromString($relativeName, $fileContent);
                    $hasFiles = true;
                } catch (\Exception $fileEx) {
                    Log::warning("Auto Backup failed to add S3 file {$file} to zip: " . $fileEx->getMessage());
                }
            }
        } else {
            $publicPath = storage_path('app/public');
            if (is_dir($publicPath)) {
                $files = new \RecursiveIteratorIterator(
                    new \RecursiveDirectoryIterator($publicPath, \RecursiveDirectoryIterator::SKIP_DOTS),
                    \RecursiveIteratorIterator::LEAVES_ONLY
                );

                foreach ($files as $name => $file) {
                    if (!$file->isDir()) {
                        $filePath = $file->getRealPath();
                        $relativeName = substr($filePath, strlen($publicPath) + 1);
                        $zip->addFile($filePath, $relativeName);
                        $hasFiles = true;
                    }
                }
            }
        }

        if (!$hasFiles) {
            $zip->addFromString('readme.txt', 'No attachments were found in the system at the time of this automated backup.');
        }

        $zip->close();

        return $tempPath;
    }
}
