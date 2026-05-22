<?php

namespace App\Http\Controllers\Api\Common;

use App\Http\Controllers\Controller;
use App\Models\ThingsToKnowVideo;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ThingsToKnowVideoController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => ThingsToKnowVideo::latest()->get()
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'url' => 'required|url',
            'group_name' => 'nullable|string|max:255',
        ]);

        $video = ThingsToKnowVideo::create([
            'title' => $request->title,
            'url' => $request->url,
            'group_name' => $request->group_name ?: 'General',
        ]);

        return response()->json([
            'message' => 'Video added successfully',
            'data' => $video
        ], 201);
    }

    public function destroy(ThingsToKnowVideo $video): JsonResponse
    {
        $video->delete();

        return response()->json([
            'message' => 'Video removed successfully'
        ]);
    }
}
