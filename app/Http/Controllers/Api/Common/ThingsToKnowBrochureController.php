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
}
