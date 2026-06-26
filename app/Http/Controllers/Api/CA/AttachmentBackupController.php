<?php

namespace App\Http\Controllers\Api\CA;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentBackupController extends Controller
{
    public function logs(Request $request): JsonResponse
    {
        try {
            $logs = DB::table('attachment_backup_logs')
                ->leftJoin('users', 'attachment_backup_logs.created_by', '=', 'users.id')
                ->select('attachment_backup_logs.*', 'users.name as user_name')
                ->orderBy('attachment_backup_logs.created_at', 'desc')
                ->limit(50)
                ->get();

            $mappedLogs = $logs->map(function ($log, $index) {
                $exists = false;
                // Only verify file existence for the latest 15 logs to prevent timeouts
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
                        Log::warning('Attachment backup file existence check failed: ' . $e->getMessage());
                        $exists = false;
                    }
                }
                $log->file_exists = $exists;
                return $log;
            });

            return response()->json(['data' => $mappedLogs]);
        } catch (\Exception $e) {
            Log::error('Attachment Backup Logs Fetch Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load attachment backup logs.'], 500);
        }
    }

    public function export(Request $request)
    {
        $filename = 'CA_Attachment_Backup_' . date('Y-m-d_H-i-s') . '.zip';
        $tempPath = storage_path('app/' . $filename);

        @ini_set('memory_limit', '512M');
        @set_time_limit(0);

        try {
            $disk = env('FILESYSTEM_DISK', 'public');
            $zip = new \ZipArchive();

            if ($zip->open($tempPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
                throw new \Exception("Could not create zip archive: " . $tempPath);
            }

            $hasFiles = false;

            if ($disk === 's3') {
                // Fetch all files under ca_application/attachments
                $files = Storage::disk('s3')->allFiles('ca_application/attachments');
                
                foreach ($files as $file) {
                    try {
                        $fileContent = Storage::disk('s3')->get($file);
                        $relativeName = str_replace('ca_application/attachments/', '', $file);
                        $zip->addFromString($relativeName, $fileContent);
                        $hasFiles = true;
                    } catch (\Exception $fileEx) {
                        Log::warning("Failed to add S3 file {$file} to zip: " . $fileEx->getMessage());
                    }
                }
            } else {
                // Local files: zip all files in storage/app/public
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

            // Add a placeholder file if no attachments exist
            if (!$hasFiles) {
                $zip->addFromString('readme.txt', 'No attachments were found in the system at the time of this backup.');
            }

            $zip->close();

            if (!file_exists($tempPath)) {
                throw new \Exception("Zip file was not created successfully.");
            }

            $fileSize = filesize($tempPath);
            $filenameForLog = $filename;

            if ($disk === 's3') {
                $s3Path = "ca_application/attachments_backup/" . $filename;
                $stream = fopen($tempPath, 'r');
                Storage::disk('s3_backup')->writeStream($s3Path, $stream, [
                    'visibility'  => 'public',
                ]);
                if (is_resource($stream)) {
                    fclose($stream);
                }
                $filenameForLog = $s3Path;
            }

            // Log the backup event
            DB::table('attachment_backup_logs')->insert([
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
            if (file_exists($tempPath)) {
                @unlink($tempPath);
            }
            Log::error('Attachment Backup Export Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Attachment backup export failed: ' . $e->getMessage()], 500);
        }
    }

    public function downloadSaved(Request $request, $id)
    {
        try {
            $log = DB::table('attachment_backup_logs')->where('id', $id)->first();
            if (!$log) {
                return response()->json(['message' => 'Attachment backup log record not found.'], 404);
            }

            $disk = env('FILESYSTEM_DISK', 'public');
            if ($disk === 's3') {
                if (!Storage::disk('s3_backup')->exists($log->filename)) {
                    return response()->json(['message' => 'Attachment backup file does not exist on S3.'], 404);
                }
                return Storage::disk('s3_backup')->download($log->filename, basename($log->filename));
            } else {
                $filePath = storage_path('app/' . $log->filename);
                if (!file_exists($filePath)) {
                    return response()->json(['message' => 'Attachment backup file does not exist on the server.'], 404);
                }
                $downloadName = basename($log->filename);
                return response()->download($filePath, $downloadName);
            }
        } catch (\Exception $e) {
            Log::error('Download Saved Attachment Backup Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to download attachment backup file.'], 500);
        }
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $log = DB::table('attachment_backup_logs')->where('id', $id)->first();
            if (!$log) {
                return response()->json(['message' => 'Attachment backup log record not found.'], 404);
            }

            $disk = env('FILESYSTEM_DISK', 'public');
            if ($disk === 's3') {
                if (Storage::disk('s3_backup')->exists($log->filename)) {
                    Storage::disk('s3_backup')->delete($log->filename);
                }
            } else {
                $filePath = storage_path('app/' . $log->filename);
                if (file_exists($filePath)) {
                    @unlink($filePath);
                }
            }

            DB::table('attachment_backup_logs')->where('id', $id)->delete();

            return response()->json(['message' => 'Attachment backup deleted successfully!']);
        } catch (\Exception $e) {
            Log::error('Delete Saved Attachment Backup Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to delete attachment backup: ' . $e->getMessage()], 500);
        }
    }

    public function getSettings(Request $request): JsonResponse
    {
        try {
            $settings = DB::table('backup_settings')->first();
            $attSettings = [
                'att_auto_backup_enabled' => false,
                'att_frequency' => 'daily',
                'att_time' => '02:00',
                'att_keep_backups_days' => 7,
                'att_day_of_week' => 0,
                'att_day_of_month' => 1,
                'att_month_of_year' => 1,
                'att_s3_backup_enabled' => false,
                'att_s3_frequency' => 'daily',
                'att_s3_time' => '02:00',
                'att_s3_keep_backups_days' => 7,
                'att_s3_day_of_week' => 0,
                'att_s3_day_of_month' => 1,
                'att_s3_month_of_year' => 1,
            ];
            if ($settings) {
                foreach ($settings as $key => $value) {
                    if (str_starts_with($key, 'att_')) {
                        if (str_contains($key, '_enabled')) {
                            $attSettings[$key] = (bool) $value;
                        } else if (str_contains($key, '_days') || str_contains($key, 'day_of_') || str_contains($key, 'month_of_')) {
                            $attSettings[$key] = (int) $value;
                        } else {
                            $attSettings[$key] = $value;
                        }
                    }
                }
            }
            return response()->json(['data' => $attSettings]);
        } catch (\Exception $e) {
            Log::error('Fetch Attachment Backup Settings Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to load attachment backup settings.'], 500);
        }
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $request->validate([
            'att_auto_backup_enabled' => 'required|boolean',
            'att_frequency' => 'required|string|in:minutely,hourly,daily,weekly,monthly,quarterly,half_yearly,yearly',
            'att_time' => 'required|string|regex:/^\d{2}:\d{2}$/',
            'att_keep_backups_days' => 'required|integer|min:1',
            'att_day_of_week' => 'nullable|integer|between:0,6',
            'att_day_of_month' => 'nullable|integer|between:1,59',
            'att_month_of_year' => 'nullable|integer|between:1,12',

            'att_s3_backup_enabled' => 'required|boolean',
            'att_s3_frequency' => 'required|string|in:minutely,hourly,daily,weekly,monthly,quarterly,half_yearly,yearly',
            'att_s3_time' => 'required|string|regex:/^\d{2}:\d{2}$/',
            'att_s3_keep_backups_days' => 'required|integer|min:1',
            'att_s3_day_of_week' => 'nullable|integer|between:0,6',
            'att_s3_day_of_month' => 'nullable|integer|between:1,59',
            'att_s3_month_of_year' => 'nullable|integer|between:1,12',
        ]);

        try {
            DB::table('backup_settings')->updateOrInsert(
                ['id' => 1],
                [
                    'att_auto_backup_enabled' => $request->att_auto_backup_enabled,
                    'att_frequency' => $request->att_frequency,
                    'att_time' => $request->att_time,
                    'att_keep_backups_days' => $request->att_keep_backups_days,
                    'att_day_of_week' => $request->input('att_day_of_week', 0),
                    'att_day_of_month' => $request->input('att_day_of_month', 1),
                    'att_month_of_year' => $request->input('att_month_of_year', 1),

                    'att_s3_backup_enabled' => $request->att_s3_backup_enabled,
                    'att_s3_frequency' => $request->att_s3_frequency,
                    'att_s3_time' => $request->att_s3_time,
                    'att_s3_keep_backups_days' => $request->att_s3_keep_backups_days,
                    'att_s3_day_of_week' => $request->input('att_s3_day_of_week', 0),
                    'att_s3_day_of_month' => $request->input('att_s3_day_of_month', 1),
                    'att_s3_month_of_year' => $request->input('att_s3_month_of_year', 1),
                    'updated_at' => now(),
                ]
            );

            return response()->json(['message' => 'Attachment backup settings updated successfully!']);
        } catch (\Exception $e) {
            Log::error('Update Attachment Backup Settings Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to update attachment backup settings.'], 500);
        }
    }

    private function formatBytes($bytes, $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);
        return round($bytes, $precision) . ' ' . $units[$pow];
    }
}
