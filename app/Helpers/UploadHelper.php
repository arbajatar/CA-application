<?php

namespace App\Helpers;

use Illuminate\Http\UploadedFile;

class UploadHelper
{
    /**
     * Upload a file with Hostinger env UPLOAD_PATH support.
     *
     * @param UploadedFile $file
     * @param string $folder
     * @return string
     */
    public static function upload(UploadedFile $file, string $folder): string
    {
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
}
