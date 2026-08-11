<?php

namespace App\Http\Controllers\Api\Common;

use App\Http\Controllers\Controller;
use App\Models\ThingsToKnowBrochure;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

use App\Helpers\UploadHelper;

class ThingsToKnowBrochureController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => ThingsToKnowBrochure::latest()->get()
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'file' => 'required|file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,zip,csv,txt,rtf,rar|max:10240', // Max 10MB
            'group_name' => 'nullable|string|max:255',
        ]);

        $path = UploadHelper::upload($request->file('file'), 'brochures');

        $brochure = ThingsToKnowBrochure::create([
            'title' => $request->title,
            'file_path' => $path,
            'group_name' => $request->group_name ?: 'General',
        ]);

        return response()->json([
            'message' => 'Brochure added successfully',
            'data' => $brochure
        ], 201);
    }

    public function destroy(ThingsToKnowBrochure $brochure): JsonResponse
    {
        if ($brochure->file_path) {
            Storage::disk('public')->delete($brochure->file_path);
        }
        $brochure->delete();

        return response()->json([
            'message' => 'Brochure removed successfully'
        ]);
    }

    public function updateGroup(Request $request): JsonResponse
    {
        $request->validate([
            'old_group_name' => 'required|string|max:255',
            'new_group_name' => 'required|string|max:255',
        ]);

        $oldName = $request->old_group_name;
        $newName = $request->new_group_name;

        ThingsToKnowBrochure::where('group_name', $oldName)->update([
            'group_name' => $newName
        ]);

        return response()->json([
            'message' => 'Document category renamed successfully'
        ]);
    }

    public function update(Request $request, ThingsToKnowBrochure $brochure): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'file' => 'nullable|file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,zip,csv,txt,rtf,rar|max:10240', // Max 10MB
            'group_name' => 'nullable|string|max:255',
        ]);

        $data = [
            'title' => $request->title,
            'group_name' => $request->group_name ?: 'General',
        ];

        if ($request->hasFile('file')) {
            if ($brochure->file_path) {
                Storage::disk('public')->delete($brochure->file_path);
            }
            $data['file_path'] = UploadHelper::upload($request->file('file'), 'brochures');
        }

        $brochure->update($data);

        return response()->json([
            'message' => 'Brochure updated successfully',
            'data' => $brochure
        ]);
    }

    public function download(ThingsToKnowBrochure $brochure)
    {
        if (!$brochure->file_path) {
            return response()->json(['message' => 'File path not found'], 404);
        }

        $path = $brochure->file_path;

        // Determine extension & filename
        $parsedPath = parse_url($path, PHP_URL_PATH) ?? $path;
        $extension = pathinfo($parsedPath, PATHINFO_EXTENSION);
        $filename = $brochure->title;
        if ($extension && !str_ends_with(strtolower($filename), '.' . strtolower($extension))) {
            $filename .= '.' . $extension;
        }

        // Clean path to S3 key candidate
        $cleanPath = ltrim($parsedPath, '/');
        $baseName = basename($cleanPath);

        $candidateKeys = array_unique(array_filter([
            $cleanPath,
            str_replace('ca_application/attachments/', '', $cleanPath),
            'ca_application/attachments/' . ltrim($cleanPath, '/'),
            'brochures/' . $baseName,
            'ca_application/attachments/brochures/' . $baseName,
        ]));

        // Try S3 storage disk first
        foreach ($candidateKeys as $key) {
            try {
                if (Storage::disk('s3')->exists($key)) {
                    $mimeType = Storage::disk('s3')->mimeType($key) ?: 'application/octet-stream';
                    $headers = [
                        'Content-Type' => $mimeType,
                        'Content-Disposition' => 'attachment; filename="' . addslashes($filename) . '"',
                    ];
                    return response()->stream(function () use ($key) {
                        $stream = Storage::disk('s3')->readStream($key);
                        if ($stream) {
                            fpassthru($stream);
                            if (is_resource($stream)) fclose($stream);
                        }
                    }, 200, $headers);
                }
            } catch (\Throwable $e) {
                // Ignore S3 driver exceptions during check
            }
        }

        // Try local storage disks fallback
        $localCandidates = array_unique(array_filter([
            storage_path('app/public/' . $cleanPath),
            storage_path('app/public/brochures/' . $baseName),
            public_path('storage/' . $cleanPath),
            public_path('storage/brochures/' . $baseName),
        ]));

        foreach ($localCandidates as $localPath) {
            if (file_exists($localPath)) {
                return response()->download($localPath, $filename);
            }
        }

        return response()->make("<h3 style='font-family:sans-serif;text-align:center;margin-top:50px;'>File not found on server. It may have been moved or removed.</h3>", 404);
    }
}
