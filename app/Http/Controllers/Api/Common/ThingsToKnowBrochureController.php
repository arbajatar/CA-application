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
            'file' => 'required|file|mimes:pdf|max:10240', // Max 10MB
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
}
