<?php

namespace App\Http\Controllers\Api\CA;

use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\SubTaskResource;
use App\Models\SubTask;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SubTaskController extends Controller
{
    public function store(Request $request, Task $task): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'priority' => ['nullable', Rule::enum(TaskPriority::class)],
            'due_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::enum(TaskStatus::class)],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ]);

        $subTask = $task->subTasks()->create([
            'title' => $validated['title'],
            'assigned_to' => $validated['assigned_to'] ?? null,
            'priority' => $validated['priority'] ?? TaskPriority::Medium->value,
            'due_date' => $validated['due_date'] ?? null,
            'status' => $validated['status'] ?? TaskStatus::Assigned->value,
            'remarks' => $validated['remarks'] ?? null,
        ]);

        return response()->json([
            'message' => 'Subtask created successfully.',
            'data' => new SubTaskResource($subTask->load('assignedTo')),
        ], 201);
    }

    public function update(Request $request, Task $task, SubTask $subTask): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'priority' => ['nullable', Rule::enum(TaskPriority::class)],
            'due_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::enum(TaskStatus::class)],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ]);

        if (isset($validated['status']) && $validated['status'] === TaskStatus::Completed->value && $subTask->status !== TaskStatus::Completed) {
            $validated['completed_at'] = now();
        }

        $subTask->update($validated);

        return response()->json([
            'message' => 'Subtask updated successfully.',
            'data' => new SubTaskResource($subTask->load('assignedTo')),
        ]);
    }

    public function destroy(Task $task, SubTask $subTask): JsonResponse
    {
        $subTask->delete();
        return response()->json(['message' => 'Subtask deleted successfully.']);
    }
}
