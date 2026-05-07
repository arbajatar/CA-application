<?php

namespace App\Http\Controllers\Api\CA;

use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\CA\ReassignTaskRequest;
use App\Http\Requests\CA\StoreTaskRequest;
use App\Http\Requests\CA\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Models\TaskLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TaskController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $tasks = Task::with(['client', 'workType', 'assignedTo', 'createdBy'])
            ->when($request->filled('staff_id'), fn($q) => $q->where('allocated_to', $request->staff_id))
            ->when($request->filled('status'), fn($q) => $q->where('status', TaskStatus::from($request->status)))
            ->when($request->filled('work_type_id'), fn($q) => $q->where('work_type_id', $request->work_type_id))
            ->when($request->filled('client_id'), fn($q) => $q->where('client_id', $request->client_id))
            ->when($request->filled('date_from'), fn($q) => $q->whereDate('date_inward', '>=', $request->date_from))
            ->when($request->filled('date_to'), fn($q) => $q->whereDate('date_inward', '<=', $request->date_to))
            ->when($request->filled('search'), fn($q) => $q->whereHas(
                'client',
                fn($cq) =>
                $cq->where('name', 'like', '%' . $request->search . '%')
            ))
            ->latest()
            ->paginate($request->get('per_page', 15));

        return TaskResource::collection($tasks);
    }

    public function store(StoreTaskRequest $request): JsonResponse
    {
        $status = $request->status ? TaskStatus::from($request->status) : TaskStatus::Assigned;

        $task = Task::create([
            'client_id' => $request->client_id,
            'work_type_id' => $request->work_type_id,
            'form_name' => $request->form_name,
            'date_inward' => $request->date_inward,
            'allocated_to' => $request->allocated_to,
            'created_by' => $request->user()->id,
            'date_allocated' => $request->date_allocated,
            'status' => $status,
            'remarks' => $request->remarks,
            'dynamic_fields' => $request->dynamic_fields,
        ]);

        TaskLog::create([
            'task_id' => $task->id,
            'changed_by' => $request->user()->id,
            'old_status' => null,
            'new_status' => $status->value,
            'remarks' => 'Task created and assigned.',
        ]);

        return response()->json([
            'message' => 'Task created successfully.',
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'createdBy'])),
        ], 201);
    }

    public function show(Task $task): JsonResponse
    {
        return response()->json([
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'createdBy', 'logs.changedBy'])),
        ]);
    }

    public function update(UpdateTaskRequest $request, Task $task): JsonResponse
    {
        $task->update($request->validated());

        return response()->json([
            'message' => 'Task updated successfully.',
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'createdBy'])),
        ]);
    }

    public function reassign(ReassignTaskRequest $request, Task $task): JsonResponse
    {
        $previousStaffId = $task->allocated_to;

        $task->update([
            'allocated_to' => $request->allocated_to,
            'date_allocated' => now()->toDateString(),
        ]);

        TaskLog::create([
            'task_id' => $task->id,
            'changed_by' => $request->user()->id,
            'old_status' => $task->status->value,
            'new_status' => $task->status->value,
            'remarks' => 'Reassigned from staff ID ' . $previousStaffId . ' to staff ID ' . $request->allocated_to . '. ' . ($request->remarks ?? ''),
        ]);

        return response()->json([
            'message' => 'Task reassigned successfully.',
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'createdBy'])),
        ]);
    }

    public function destroy(Task $task): JsonResponse
    {
        $task->delete();

        return response()->json(['message' => 'Task deleted successfully.']);
    }
}
