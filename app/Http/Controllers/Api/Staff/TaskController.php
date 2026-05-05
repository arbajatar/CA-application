<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\UpdateTaskStatusRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Models\TaskLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tasks = Task::with(['client', 'workType', 'assignedTo'])
            ->forStaff($request->user()->id)
            ->when(
                $request->filled('status'),
                fn($q) =>
                $q->where('status', TaskStatus::from($request->status))
            )
            ->when(
                $request->filled('search'),
                fn($q) =>
                $q->where(function ($q) use ($request) {
                    $q->whereHas(
                        'client',
                        fn($cq) =>
                        $cq->where('name', 'like', '%' . $request->search . '%')
                    )->orWhereHas(
                            'workType',
                            fn($wq) =>
                            $wq->where('name', 'like', '%' . $request->search . '%')
                        );
                })
            )
            ->latest()
            ->paginate($request->get('per_page', 15));

        return response()->json(TaskResource::collection($tasks));
    }

    public function show(Request $request, Task $task): JsonResponse
    {
        // Ensure staff can only view their own task
        if ($task->allocated_to !== $request->user()->id) {
            return response()->json(['message' => 'You do not have access to this task.'], 403);
        }

        return response()->json([
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'logs.changedBy'])),
        ]);
    }

    public function updateStatus(UpdateTaskStatusRequest $request, Task $task): JsonResponse
    {
        // Ensure staff can only update their own task
        if ($task->allocated_to !== $request->user()->id) {
            return response()->json(['message' => 'You do not have access to this task.'], 403);
        }

        $currentStatus = $task->status;
        $newStatus = TaskStatus::from($request->status);

        // Validate transition using the Enum's single source of truth
        if (!$currentStatus->canTransitionTo($newStatus)) {
            return response()->json([
                'message' => 'Invalid status transition.',
                'current_status' => $currentStatus->value,
                'allowed_transitions' => array_map(
                    fn($s) => $s->value,
                    $currentStatus->allowedTransitions()
                ),
            ], 422);
        }

        $updateData = ['status' => $newStatus];

        // Auto-fill date_completed when marking as Completed
        if ($newStatus === TaskStatus::Completed) {
            $updateData['date_completed'] = now()->toDateString();
        }

        // Clear date_completed if moving back from Completed
        if ($currentStatus === TaskStatus::Completed && $newStatus !== TaskStatus::Completed) {
            $updateData['date_completed'] = null;
        }

        $task->update($updateData);

        // Log the status change
        TaskLog::create([
            'task_id' => $task->id,
            'changed_by' => $request->user()->id,
            'old_status' => $currentStatus->value,
            'new_status' => $newStatus->value,
            'remarks' => $request->remarks,
        ]);

        return response()->json([
            'message' => 'Task status updated successfully.',
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo'])),
        ]);
    }
}