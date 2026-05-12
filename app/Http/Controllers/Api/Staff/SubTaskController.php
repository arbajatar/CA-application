<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\SubTaskResource;
use App\Models\SubTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SubTaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $subTasks = SubTask::where('assigned_to', $request->user()->id)
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

        $validated = $request->validate([
            'status' => ['required', Rule::enum(TaskStatus::class)],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ]);

        $newStatus = TaskStatus::from($validated['status']);
        
        // Simple status update for now, maybe add transition logic later like in TaskController
        $updateData = [
            'status' => $newStatus,
            'remarks' => $validated['remarks'] ?? $subTask->remarks,
        ];

        if ($newStatus === TaskStatus::Completed) {
            $updateData['completed_at'] = now();
        }

        $subTask->update($updateData);

        return response()->json([
            'message' => 'Subtask status updated successfully.',
            'data' => new SubTaskResource($subTask),
        ]);
    }
}
