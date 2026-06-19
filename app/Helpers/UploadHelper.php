<?php

namespace App\Helpers;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UploadHelper
{
    /**
     * Upload a file with Hostinger env UPLOAD_PATH support or S3 fallback.
     *
     * @param UploadedFile $file
     * @param string $folder
     * @return string
     */
    public static function upload(UploadedFile $file, string $folder): string
    {
        $disk = env('FILESYSTEM_DISK', 'public');

        if ($disk === 's3') {
            $extension = strtolower($file->getClientOriginalExtension());
            $cleanFolder = trim(preg_replace('#/+#', '/', $folder), '/');
            $fileName = time() . '-' . Str::random(12) . '.' . $extension;
            
            // Prefix all CA application attachments under ca_application/attachments
            $s3Path = "ca_application/attachments/{$cleanFolder}/{$fileName}";

            Storage::disk('s3')->put($s3Path, file_get_contents($file->getRealPath()), [
                'visibility'  => 'public',
                'ContentType' => $file->getMimeType(),
            ]);

            // Return the full public S3/Spaces URL
            return self::buildSpacesUrl($s3Path);
        }

        $uploadPath = env('UPLOAD_PATH');
        if ($uploadPath) {
            $filename = time() . '-' . uniqid() . '.' . $file->getClientOriginalExtension();
            // Resolve custom target path relative to public_path
            $destinationPath = public_path(rtrim($uploadPath, '/') . '/storage/' . $folder);
            $file->move($destinationPath, $filename);
            return $folder . '/' . $filename;
        }

        // Fallback to standard Laravel public disk storage locally
        return $file->store($folder, 'public');
    }

    /**
     * Build the correct public URL for DigitalOcean Spaces.
     * Format: https://{bucket}.{region}.digitaloceanspaces.com/{path}
     */
    public static function buildSpacesUrl(string $s3Path): string
    {
        $bucket = env('AWS_BUCKET');
        $region = env('AWS_DEFAULT_REGION');
        return "https://{$bucket}.{$region}.digitaloceanspaces.com/{$s3Path}";
    }

    /**
     * Resolve path to public URL.
     */
    public static function resolveUrl(?string $path): ?string
    {
        if (!$path) return null;

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        if (env('FILESYSTEM_DISK') === 's3') {
            return self::buildSpacesUrl($path);
        }

        return asset('storage/' . $path);
    }
}
