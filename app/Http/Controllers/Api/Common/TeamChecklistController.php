<?php

namespace App\Http\Controllers\Api\Common;

use App\Http\Controllers\Controller;
use App\Models\TeamChecklist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class TeamChecklistController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $userId = $request->get('user_id');
        $user = $request->user();

        $query = TeamChecklist::query();

        if ($user && $user->role === \App\Enums\UserRole::Staff) {
            // Staff can see notes belonging to them OR assigned to them
            $query->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->orWhere('assigned_to', $user->id);
            });
        } else {
            // CA / Admin
            if ($userId && $userId !== 'all') {
                $query->where(function ($q) use ($userId) {
                    $q->where('user_id', $userId)
                      ->orWhere('assigned_to', $userId);
                });
            }
            // If $userId is 'all', we don't apply any user_id filter, so CA can see all checklists
        }

        $items = $query->orderBy('created_at', 'asc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $items->map(function ($item) {
                return [
                    'id' => $item->id,
                    'user_id' => $item->user_id,
                    'title' => $item->title ?? '',
                    'assigned_to' => $item->assigned_to ?? '',
                    'status' => $item->status ?? 'pending',
                    'sub_status' => $item->sub_status ?? '',
                    'due_date' => $item->due_date ? $item->due_date : '',
                    'remarks' => $item->remarks ?? '',
                    'attachments' => $item->attachments ?? [],
                    'screenshot' => $item->screenshot ?? null,
                ];
            }),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'nullable',
            'title' => 'nullable|string',
            'assigned_to' => 'nullable',
            'status' => 'nullable|string',
            'sub_status' => 'nullable|string',
            'due_date' => 'nullable|date',
            'remarks' => 'nullable|string',
            'screenshot' => 'nullable|string',
        ]);

        $userId = $request->get('user_id');
        if ($userId === 'all' || !$userId) {
            $userId = null;
        }

        $assignedTo = $request->get('assigned_to');
        if (!$assignedTo) {
            $assignedTo = null;
        }

        $item = TeamChecklist::create([
            'user_id' => $userId,
            'title' => $request->get('title') ?? '',
            'assigned_to' => $assignedTo,
            'status' => $request->get('status') ?? 'pending',
            'sub_status' => $request->get('sub_status'),
            'due_date' => $request->get('due_date'),
            'remarks' => $request->get('remarks'),
            'screenshot' => $request->get('screenshot'),
        ]);

        return response()->json([
            'status' => 'success',
            'data' => [
                'id' => $item->id,
                'user_id' => $item->user_id,
                'title' => $item->title ?? '',
                'assigned_to' => $item->assigned_to ?? '',
                'status' => $item->status ?? 'pending',
                'sub_status' => $item->sub_status ?? '',
                'due_date' => $item->due_date ? $item->due_date : '',
                'remarks' => $item->remarks ?? '',
                'attachments' => $item->attachments ?? [],
                'screenshot' => $item->screenshot ?? null,
            ],
        ]);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $item = TeamChecklist::findOrFail($id);

        $data = $request->only(['title', 'assigned_to', 'status', 'sub_status', 'due_date', 'remarks', 'screenshot']);

        if (array_key_exists('assigned_to', $data) && !$data['assigned_to']) {
            $data['assigned_to'] = null;
        }

        $item->update($data);

        return response()->json([
            'status' => 'success',
            'data' => [
                'id' => $item->id,
                'user_id' => $item->user_id,
                'title' => $item->title ?? '',
                'assigned_to' => $item->assigned_to ?? '',
                'status' => $item->status ?? 'pending',
                'sub_status' => $item->sub_status ?? '',
                'due_date' => $item->due_date ? $item->due_date : '',
                'remarks' => $item->remarks ?? '',
                'attachments' => $item->attachments ?? [],
                'screenshot' => $item->screenshot ?? null,
            ],
        ]);
    }

    public function destroy($id): JsonResponse
    {
        $item = TeamChecklist::findOrFail($id);
        $item->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Checklist item deleted successfully',
        ]);
    }

    public function uploadFile(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:5120'],
        ]);
        $path = \App\Helpers\UploadHelper::upload($request->file('file'), 'sub_tasks_screenshots');
        return response()->json([
            'url' => asset('storage/' . $path),
            'path' => $path,
            'name' => $request->file('file')->getClientOriginalName(),
        ]);
    }
}
