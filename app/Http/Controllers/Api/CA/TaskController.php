<?php

namespace App\Http\Controllers\Api\CA;

use App\Enums\TaskStatus;
use App\Enums\TaskPriority;
use App\Http\Controllers\Controller;
use App\Http\Requests\CA\ReassignTaskRequest;
use App\Http\Requests\CA\StoreTaskRequest;
use App\Http\Requests\CA\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Models\TaskLog;
use App\Models\Client;
use App\Models\WorkType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TaskController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Task::with(['client', 'workType', 'assignedTo', 'createdBy', 'permissions.role'])
            ->when($request->filled('staff_id'), function ($q) use ($request) {
                $staffId = $request->staff_id;
                $q->where(function ($sub) use ($staffId) {
                    $sub->where('allocated_to', $staffId)
                        ->orWhereJsonContains('dynamic_fields->multi_rows', ['allocated_to' => $staffId])
                        ->orWhereJsonContains('dynamic_fields->multi_rows', ['allocated_to' => (string)$staffId])
                        ->orWhereJsonContains('dynamic_fields->multi_rows', ['allocated_to' => (int)$staffId]);
                });
            })
            ->when($request->filled('status'), fn($q) => $q->where('status', TaskStatus::from($request->status)))
            ->when($request->filled('work_type_id'), fn($q) => $q->where('work_type_id', $request->work_type_id))
            ->when($request->filled('client_id'), fn($q) => $q->where('client_id', $request->client_id))
            ->when($request->filled('date_from'), fn($q) => $q->whereDate('date_inward', '>=', $request->date_from))
            ->when($request->filled('date_to'), fn($q) => $q->whereDate('date_inward', '<=', $request->date_to))
            ->when($request->filled('search'), function($q) use ($request) {
                $search = $request->search;
                $q->where(function($sub) use ($search) {
                    $sub->where('form_name', 'like', '%' . $search . '%')
                        ->orWhere('remarks', 'like', '%' . $search . '%')
                        ->orWhere('task_particular', 'like', '%' . $search . '%')
                        ->orWhere('sub_status', 'like', '%' . $search . '%')
                        ->orWhere('feedback', 'like', '%' . $search . '%')
                        ->orWhere('dynamic_fields', 'like', '%' . $search . '%');

                    // Resolve matching client IDs
                    $matchingClientIds = \App\Models\Client::where('name', 'like', '%' . $search . '%')
                        ->orWhere('contact', 'like', '%' . $search . '%')
                        ->pluck('id')
                        ->toArray();

                    foreach ($matchingClientIds as $cid) {
                        $sub->orWhereJsonContains('dynamic_fields->multi_rows', ['client_id' => $cid])
                            ->orWhereJsonContains('dynamic_fields->multi_rows', ['client_id' => (string)$cid])
                            ->orWhereJsonContains('dynamic_fields->multi_rows', ['client_id' => (int)$cid]);
                    }
                });
            })
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
        $status = $request->status ? TaskStatus::from($request->status) : TaskStatus::Pending;

        $task = Task::create([
            'work_type_id' => $request->work_type_id,
            'form_name' => $request->form_name,
            'date_inward' => $request->date_inward ?? now()->toDateString(),
            'allocated_to' => $request->allocated_to,
            'created_by' => $request->user()->id,
            'date_allocated' => $request->date_allocated ?? now()->toDateString(),
            'status' => $status,
            'remarks' => $request->remarks,
            'dynamic_fields' => $request->dynamic_fields,
            'task_particular' => $request->task_particular,
            'sub_status' => $request->sub_status,
            'feedback' => $request->feedback,
            'entry_date' => $request->entry_date ?? now()->toDateString(),
            'allow_attachments' => $request->boolean('allow_attachments', false),
            'allow_checklist' => $request->boolean('allow_checklist', true),
            'allow_notes' => $request->boolean('allow_notes', true),
        ]);

        // Handle detailed subtasks assignment
        if ($request->has('subtasks') && is_array($request->subtasks)) {
            foreach ($request->subtasks as $stData) {
                $task->subTasks()->create([
                    'title' => $stData['title'],
                    'assigned_to' => $stData['assigned_to'],
                    'status' => $stData['status'] ?? TaskStatus::Pending,
                    'priority' => $stData['priority'],
                    'due_date' => $stData['due_date'],
                    'remarks' => $stData['remarks'] ?? null,
                ]);
            }
        }

        // Handle permissions assignment
        if ($request->has('permissions') && is_array($request->permissions)) {
            foreach ($request->permissions as $perm) {
                $task->permissions()->create([
                    'role_id' => $perm['role_id'],
                    'can_read' => $perm['can_read'] ?? false,
                    'can_write' => $perm['can_write'] ?? false,
                    'can_delete' => $perm['can_delete'] ?? false,
                ]);
            }
        }

        TaskLog::create([
            'task_id' => $task->id,
            'changed_by' => $request->user()->id,
            'old_status' => null,
            'new_status' => $status->value,
            'remarks' => 'Task created with ' . count($request->subtasks ?? []) . ' assigned subtasks.',
        ]);

        return response()->json([
            'message' => 'Task created successfully.',
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'createdBy', 'permissions.role'])),
        ], 201);
    }

    public function show(Task $task): JsonResponse
    {
        return response()->json([
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'createdBy', 'logs.changedBy', 'subTasks.assignedTo', 'permissions.role', 'notes.author'])),
        ]);
    }

    public function update(UpdateTaskRequest $request, Task $task): JsonResponse
    {
        $oldStatus = $task->status;
        $task->update($request->validated());

        if ($request->has('permissions')) {
            $task->permissions()->delete();
            if (is_array($request->permissions)) {
                foreach ($request->permissions as $perm) {
                    $task->permissions()->create([
                        'role_id' => $perm['role_id'],
                        'can_read' => $perm['can_read'] ?? false,
                        'can_write' => $perm['can_write'] ?? false,
                        'can_delete' => $perm['can_delete'] ?? false,
                    ]);
                }
            }
        }

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
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'createdBy', 'subTasks.assignedTo', 'permissions.role'])),
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
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'createdBy', 'subTasks.assignedTo', 'permissions.role'])),
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'tasks' => 'required|array'
            ]);

            $importedCount = 0;
            $updatedCount = 0;

            foreach ($request->tasks as $taskData) {
                // 1. Resolve or Create Client
                $clientId = $taskData['client_id'] ?? null;
                if (!$clientId && (!empty($taskData['client_name']) || !empty($taskData['client_mobile']))) {
                    $clientName = !empty($taskData['client_name']) ? $taskData['client_name'] : 'Unknown Client';
                    $clientMobile = !empty($taskData['client_mobile']) ? $taskData['client_mobile'] : null;
                    
                    // Search by mobile if available, else by name
                    $client = null;
                    if ($clientMobile) {
                        $client = Client::where('contact', $clientMobile)->first();
                    }
                    if (!$client) {
                        $client = Client::firstOrCreate(
                            ['name' => $clientName],
                            ['contact' => $clientMobile]
                        );
                    }
                    $clientId = $client->id;
                }

                // 2. Resolve or Create Work Type
                $workTypeId = $taskData['work_type_id'] ?? null;
                if (!$workTypeId && !empty($taskData['work_type_name'])) {
                    $workType = WorkType::firstOrCreate(['name' => $taskData['work_type_name']]);
                    $workTypeId = $workType->id;
                }
                
                // 3. Resolve Assignee
                $allocatedTo = $taskData['allocated_to'] ?? $request->user()->id;

                if (!$workTypeId) {
                    continue; // Skip if still cannot resolve mandatory work type
                }

                // 4. Create or Update Task
                $isUpdate = false;
                if (!empty($taskData['id'])) {
                    $task = Task::find($taskData['id']);
                    if ($task) {
                        $isUpdate = true;
                        $task->update([
                            'client_id' => $clientId,
                            'work_type_id' => $workTypeId,
                            'allocated_to' => $allocatedTo,
                            'date_allocated' => $taskData['date_allocated'] ?? $task->date_allocated,
                            'remarks' => $taskData['remarks'] ?? $task->remarks,
                            'form_name' => $taskData['form_name'] ?? $task->form_name,
                            'dynamic_fields' => $taskData['dynamic_fields'] ?? $task->dynamic_fields,
                        ]);
                        $updatedCount++;
                    }
                }

                if (!$isUpdate) {
                    $task = Task::create([
                        'client_id' => $clientId,
                        'work_type_id' => $workTypeId,
                        'allocated_to' => $allocatedTo,
                        'created_by' => $request->user()->id,
                        'date_allocated' => $taskData['date_allocated'] ?? now()->toDateString(),
                        'date_inward' => now()->toDateString(),
                        'status' => TaskStatus::Pending,
                        'remarks' => $taskData['remarks'] ?? null,
                        'form_name' => $taskData['form_name'] ?? null,
                        'dynamic_fields' => $taskData['dynamic_fields'] ?? null,
                    ]);
                    $importedCount++;

                    TaskLog::create([
                        'task_id' => $task->id,
                        'changed_by' => $request->user()->id,
                        'old_status' => null,
                        'new_status' => TaskStatus::Pending->value,
                        'remarks' => 'Sheet created via Excel import.',
                    ]);
                }

                // 5. Handle nested subtasks
                if (isset($taskData['subtasks']) && is_array($taskData['subtasks'])) {
                    foreach ($taskData['subtasks'] as $st) {
                        if (empty($st['title'])) continue; // Skip empty subtasks

                        // Resolve status safely
                        $status = TaskStatus::Pending;
                        if (isset($st['status'])) {
                            foreach (TaskStatus::cases() as $case) {
                                if (strtolower($case->value) === strtolower($st['status']) || strtolower($case->label()) === strtolower($st['status'])) {
                                    $status = $case;
                                    break;
                                }
                            }
                        }

                        // Resolve priority safely
                        $priority = TaskPriority::Medium;
                        if (isset($st['priority'])) {
                            foreach (TaskPriority::cases() as $case) {
                                if (strtolower($case->value) === strtolower($st['priority']) || strtolower($case->label()) === strtolower($st['priority'])) {
                                    $priority = $case;
                                    break;
                                }
                            }
                        }

                        $subtaskData = [
                            'title' => $st['title'] ?? 'Subtask',
                            'assigned_to' => $st['assigned_to'] ?? $task->allocated_to,
                            'status' => $status,
                            'priority' => $priority,
                            'due_date' => !empty($st['due_date']) ? clone \Carbon\Carbon::parse($st['due_date']) : null,
                            'remarks' => $st['remarks'] ?? null,
                        ];

                        if (!empty($st['id'])) {
                            $existingSt = $task->subTasks()->find($st['id']);
                            if ($existingSt) {
                                $existingSt->update($subtaskData);
                                continue;
                            }
                        }

                        $task->subTasks()->create($subtaskData);
                    }
                }
            }

            return response()->json(['message' => "$importedCount sheets created, $updatedCount updated successfully."]);
        } catch (\Exception $e) {
            \Log::error('Import Error: ' . $e->getMessage());
            return response()->json(['message' => 'Import failed: ' . $e->getMessage()], 500);
        }
    }

    public function destroy(Task $task): JsonResponse
    {
        $task->subTasks()->delete();
        $task->delete();

        return response()->json(['message' => 'Task deleted successfully.']);
    }

    public function uploadFile(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:5120'],
        ]);
        $path = \App\Helpers\UploadHelper::upload($request->file('file'), 'sheet_attachments');
        return response()->json([
            'url' => asset('storage/' . $path),
            'path' => $path,
            'name' => $request->file('file')->getClientOriginalName(),
        ]);
    }
}
