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
        $query = Task::with(['client', 'workType', 'assignedTo', 'createdBy'])
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
            ->latest();

        if ($request->boolean('with_subtasks')) {
            $query->with(['subTasks.assignedTo']);
        }

        $perPage = $request->get('per_page', 15);
        if ($perPage === 'all') {
            $tasks = $query->get();
            return TaskResource::collection($tasks);
        }

        $tasks = $query->paginate(min($perPage, 1000));

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

        // Handle detailed subtasks assignment
        if ($request->has('subtasks') && is_array($request->subtasks)) {
            foreach ($request->subtasks as $stData) {
                $task->subTasks()->create([
                    'title' => $stData['title'],
                    'assigned_to' => $stData['assigned_to'],
                    'status' => $stData['status'] ?? TaskStatus::Assigned,
                    'priority' => $stData['priority'],
                    'due_date' => $stData['due_date'],
                    'remarks' => $stData['remarks'] ?? null,
                ]);
            }
        }

        TaskLog::create([
            'task_id' => $task->id,
            'changed_by' => $request->user()->id,
            'old_status' => null,
            'new_status' => $status->value,
            'remarks' => 'Task created with ' . count($request->subtasks) . ' assigned subtasks.',
        ]);

        return response()->json([
            'message' => 'Task created successfully.',
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'createdBy'])),
        ], 201);
    }

    public function show(Task $task): JsonResponse
    {
        return response()->json([
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'createdBy', 'logs.changedBy', 'subTasks.assignedTo'])),
        ]);
    }

    public function update(UpdateTaskRequest $request, Task $task): JsonResponse
    {
        $oldStatus = $task->status;
        $task->update($request->validated());

        if ($request->has('status') && $task->status !== $oldStatus) {
            TaskLog::create([
                'task_id' => $task->id,
                'changed_by' => $request->user()->id,
                'old_status' => $oldStatus->value,
                'new_status' => $task->status->value,
                'remarks' => 'Status updated by Admin. ' . ($request->remarks ?? ''),
            ]);
        }

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

    public function import(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'tasks' => 'required|array',
                'tasks.*.client_id' => 'required|exists:clients,id',
                'tasks.*.work_type_id' => 'required|exists:work_types,id',
                'tasks.*.allocated_to' => 'required|exists:users,id',
            ]);

            foreach ($request->tasks as $taskData) {
                $task = Task::create([
                    'client_id' => $taskData['client_id'],
                    'work_type_id' => $taskData['work_type_id'],
                    'allocated_to' => $taskData['allocated_to'],
                    'created_by' => $request->user()->id,
                    'date_allocated' => $taskData['date_allocated'] ?? now()->toDateString(),
                    'date_inward' => $taskData['date_inward'] ?? now()->toDateString(),
                    'status' => TaskStatus::Assigned,
                    'remarks' => $taskData['remarks'] ?? null,
                    'form_name' => $taskData['form_name'] ?? null,
                ]);

                // Handle nested subtasks from import
                if (isset($taskData['subtasks']) && is_array($taskData['subtasks'])) {
                    foreach ($taskData['subtasks'] as $st) {
                        // Resolve status and priority from strings safely
                        $status = TaskStatus::Assigned;
                        if (isset($st['status'])) {
                            foreach (TaskStatus::cases() as $case) {
                                if (strtolower($case->value) === strtolower($st['status']) || strtolower($case->label()) === strtolower($st['status'])) {
                                    $status = $case;
                                    break;
                                }
                            }
                        }

                        $task->subTasks()->create([
                            'title' => $st['title'] ?? 'Subtask',
                            'assigned_to' => $st['assigned_to'] ?? $task->allocated_to,
                            'status' => $status,
                            'priority' => 'medium', // Default for now
                            'due_date' => $st['due_date'] ?? null,
                            'remarks' => $st['remarks'] ?? null,
                        ]);
                    }
                }

                TaskLog::create([
                    'task_id' => $task->id,
                    'changed_by' => $request->user()->id,
                    'old_status' => null,
                    'new_status' => TaskStatus::Assigned->value,
                    'remarks' => 'Task created via Excel import.',
                ]);
            }

            return response()->json(['message' => count($request->tasks) . ' tasks imported successfully.']);
        } catch (\Exception $e) {
            \Log::error('Import Error: ' . $e->getMessage());
            return response()->json(['message' => 'Import failed: ' . $e->getMessage()], 500);
        }
    }

    public function destroy(Task $task): JsonResponse
    {
        $task->delete();

        return response()->json(['message' => 'Task deleted successfully.']);
    }
}
