<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\SubTaskResource;
use App\Models\SubTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

use App\Helpers\UploadHelper;

class SubTaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $subTasks = SubTask::where('assigned_to', $user->id)
            ->whereHas('task', function ($tq) use ($user) {
                $tq->where(function ($query) use ($user) {
                    $query->whereDoesntHave('permissions')
                        ->orWhereHas('permissions', function ($pq) use ($user) {
                            $roleIds = $user->roles()->pluck('roles.id')->toArray();
                            if (!empty($roleIds)) {
                                $pq->whereIn('role_id', $roleIds)
                                   ->where('can_read', true);
                            } else {
                                $pq->whereRaw('1 = 0');
                            }
                        });
                });
            })
            ->with('task.client', 'task.workType')
            ->latest()
            ->get();

        return response()->json([
            'data' => SubTaskResource::collection($subTasks),
        ]);
    }

    public function updateStatus(Request $request, SubTask $subTask): JsonResponse
    {
        // Ensure subtask is assigned to this staff member
        if ($subTask->assigned_to !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized access to this subtask.'], 403);
        }

        // Check parent task write permission
        $user = $request->user();
        $task = $subTask->task;
        if ($task && $task->permissions()->exists()) {
            $roleIds = $user->roles()->pluck('roles.id')->toArray();
            $hasWriteAccess = $task->permissions()
                ->whereIn('role_id', $roleIds)
                ->where('can_write', true)
                ->exists();
            if (!$hasWriteAccess) {
                return response()->json(['message' => 'You do not have write access to this sheet.'], 403);
            }
        }

        $validated = $request->validate([
            'status' => ['required', Rule::enum(TaskStatus::class)],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'screenshot' => ['nullable', 'file', 'max:5120'],
            'sub_status' => ['nullable', 'string', 'max:255'],
        ]);

        $newStatus = TaskStatus::from($validated['status']);
        
        $screenshotPath = $subTask->screenshot;
        if ($request->hasFile('screenshot')) {
            if (!$task || !$task->allow_attachments) {
                return response()->json(['message' => 'File upload / screenshots are not allowed for this sheet.'], 422);
            }
            $screenshotPath = UploadHelper::upload($request->file('screenshot'), 'task_screenshots');
        }

        // Simple status update for now, maybe add transition logic later like in TaskController
        $updateData = [
            'status' => $newStatus,
            'remarks' => $validated['remarks'] ?? $subTask->remarks,
            'screenshot' => $screenshotPath,
            'sub_status' => $validated['sub_status'] ?? $subTask->sub_status,
        ];

        if ($newStatus === TaskStatus::Complete) {
            $updateData['completed_at'] = now();
        }

        $subTask->update($updateData);

        return response()->json([
            'message' => 'Subtask status updated successfully.',
            'data' => new SubTaskResource($subTask),
        ]);
    }
}
