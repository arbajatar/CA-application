<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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
    protected $description = 'Perform scheduled automated database backup and clean up older files based on settings';

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

            if (!$this->option('force')) {
                if (!$settings->auto_backup_enabled) {
                    $this->info('Auto backup is disabled.');
                    return 0;
                }

                // Parse configured time
                $timeParts = explode(':', $settings->time ?: '02:00');
                $targetHour = isset($timeParts[0]) ? $timeParts[0] : '02';
                $targetMinute = isset($timeParts[1]) ? $timeParts[1] : '00';

                $currentTime = now()->timezone('Asia/Kolkata');
                $currentHour = $currentTime->format('H');
                $currentMinute = $currentTime->format('i');

                // Check time based on frequency
                if ($settings->frequency === 'minutely') {
                    $interval = isset($settings->day_of_month) ? intval($settings->day_of_month) : 1;
                    if ($interval <= 0) {
                        $interval = 1;
                    }
                    if (intval($currentMinute) % $interval !== 0) {
                        $this->info("Not the configured backup minute interval (Current minute: {$currentMinute}, Interval: {$interval}).");
                        return 0;
                    }
                } elseif ($settings->frequency === 'hourly') {
                    if ($currentMinute !== $targetMinute) {
                        $this->info('Not the configured backup minute (Current minute: ' . $currentMinute . ', Target minute: ' . $targetMinute . ').');
                        return 0;
                    }
                } else {
                    if ($currentHour !== $targetHour || $currentMinute !== $targetMinute) {
                        $this->info('Not the configured backup time (Current: ' . $currentHour . ':' . $currentMinute . ', Target: ' . $targetHour . ':' . $targetMinute . ').');
                        return 0;
                    }
                }

                // Check frequency
                $dayOfWeek = $currentTime->dayOfWeek; // 0 (Sunday) to 6 (Saturday)
                $dayOfMonth = $currentTime->day;
                $month = $currentTime->month; // 1 to 12

                $targetDayOfWeek = isset($settings->day_of_week) ? intval($settings->day_of_week) : 0;
                $targetDayOfMonth = isset($settings->day_of_month) ? intval($settings->day_of_month) : 1;
                $targetStartMonth = isset($settings->month_of_year) ? intval($settings->month_of_year) : 1;

                if ($settings->frequency === 'weekly' && $dayOfWeek !== $targetDayOfWeek) {
                    $this->info("Weekly backup scheduled for day index {$targetDayOfWeek}. Today is day index " . $dayOfWeek);
                    return 0;
                }

                if ($settings->frequency === 'monthly' && $dayOfMonth !== $targetDayOfMonth) {
                    $this->info("Monthly backup scheduled for day {$targetDayOfMonth} of the month. Today is day " . $dayOfMonth);
                    return 0;
                }

                if ($settings->frequency === 'quarterly') {
                    $monthDiff = $month - $targetStartMonth;
                    if ($dayOfMonth !== $targetDayOfMonth || $monthDiff < 0 || $monthDiff % 3 !== 0) {
                        $this->info("Quarterly backup scheduled on day {$targetDayOfMonth} starting in month {$targetStartMonth}. Today is month {$month}, day {$dayOfMonth}");
                        return 0;
                    }
                }

                if ($settings->frequency === 'half_yearly') {
                    $monthDiff = $month - $targetStartMonth;
                    if ($dayOfMonth !== $targetDayOfMonth || $monthDiff < 0 || $monthDiff % 6 !== 0) {
                        $this->info("Half-yearly backup scheduled on day {$targetDayOfMonth} starting in month {$targetStartMonth}. Today is month {$month}, day {$dayOfMonth}");
                        return 0;
                    }
                }

                if ($settings->frequency === 'yearly' && ($dayOfMonth !== $targetDayOfMonth || $month !== $targetStartMonth)) {
                    $this->info("Yearly backup scheduled on day {$targetDayOfMonth} of month {$targetStartMonth}. Today is month {$month}, day {$dayOfMonth}");
                    return 0;
                }
            }

            $filename = 'CA_Application_Backup_Auto_' . now()->timezone('Asia/Kolkata')->format('Y-m-d_H-i-s') . '.sql';
            $backupsDir = storage_path('app/backups');

            // Programmatically ensure the backup folder exists
            if (!file_exists($backupsDir)) {
                mkdir($backupsDir, 0755, true);
            }

            $tempPath = $backupsDir . '/' . $filename;

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

            fwrite($out, "-- Database Backup (Auto)\n");
            fwrite($out, "-- Generated at: " . date('Y-m-d H:i:s') . "\n");
            fwrite($out, "SET FOREIGN_KEY_CHECKS=0;\n\n");

            foreach ($tables as $table) {
                // Drop table statement
                fwrite($out, "DROP TABLE IF EXISTS `" . $table . "`;\n");

                // Show Create Table statement
                $createTableResult = $pdo->query("SHOW CREATE TABLE `" . $table . "`");
                $createTableRow = $createTableResult->fetch(\PDO::FETCH_ASSOC);
                fwrite($out, $createTableRow['Create Table'] . ";\n\n");

                // Insert statements
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
                fwrite($out, "\n");
            }

            fwrite($out, "SET FOREIGN_KEY_CHECKS=1;\n");
            fclose($out);

            $fileSize = filesize($tempPath);
            $formattedSize = $this->formatBytes($fileSize);

            // Insert backup log entry
            DB::table('backup_logs')->insert([
                'filename' => 'backups/' . $filename, // Save path relative to storage/app for easy downloads
                'backup_by' => 'System (Auto)',
                'action' => 'backup',
                'file_size' => $formattedSize,
                'created_by' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->info("Backup created successfully: {$filename} ({$formattedSize})");

            // Cleanup based on retention policy
            $keepLimit = intval($settings->keep_backups_days);
            if ($keepLimit > 0) {
                $isCountBased = in_array($settings->frequency, ['minutely', 'hourly', 'monthly', 'quarterly', 'half_yearly', 'yearly']);

                if ($isCountBased) {
                    // Find all automated backups, ordered by created_at desc
                    $allAutoBackups = DB::table('backup_logs')
                        ->where('action', 'backup')
                        ->where('filename', 'like', 'backups/%')
                        ->orderBy('created_at', 'desc')
                        ->get();

                    if ($allAutoBackups->count() > $keepLimit) {
                        $oldBackups = $allAutoBackups->slice($keepLimit);
                        foreach ($oldBackups as $oldBackup) {
                            $oldFilePath = storage_path('app/' . $oldBackup->filename);
                            if (file_exists($oldFilePath)) {
                                @unlink($oldFilePath);
                            }
                            $this->info("Deleted old backup file (count limit exceeded): {$oldBackup->filename} (created at: {$oldBackup->created_at})");
                        }
                    }
                } else {
                    // Days-based cleanup for daily and weekly
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
                        $this->info("Deleted old backup file (days limit exceeded): {$oldBackup->filename} (created at: {$oldBackup->created_at})");
                    }
                }
            }

            return 0;
        } catch (\Exception $e) {
            if (isset($tempPath) && file_exists($tempPath)) {
                @unlink($tempPath);
            }
            Log::error('Auto Backup Command Failed: ' . $e->getMessage());
            $this->error('Auto backup failed: ' . $e->getMessage());
            return 1;
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
