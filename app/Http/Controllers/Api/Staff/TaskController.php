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

use App\Helpers\UploadHelper;

class TaskController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $tasks = $user->assignedTasks()
            ->with(['client', 'workType', 'assignedTo', 'permissions.role'])
            ->where(function ($query) use ($user) {
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
            })
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

        return TaskResource::collection($tasks);
    }

    public function show(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();
        $isAllocated = $task->allocated_to === $user->id;
        $hasAssignedSubtask = $task->subTasks()->where('assigned_to', $user->id)->exists();

        // Ensure staff can only view tasks allocated to them OR tasks where they have an assigned subtask
        if (!$isAllocated && !$hasAssignedSubtask) {
            return response()->json(['message' => 'You do not have access to this task.'], 403);
        }

        // Check read permission
        $user = $request->user();
        if ($task->permissions()->exists()) {
            $roleIds = $user->roles()->pluck('roles.id')->toArray();
            $hasReadAccess = $task->permissions()
                ->whereIn('role_id', $roleIds)
                ->where('can_read', true)
                ->exists();
            if (!$hasReadAccess) {
                return response()->json(['message' => 'You do not have read access to this sheet.'], 403);
            }
        }

        return response()->json([
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'logs.changedBy', 'permissions.role', 'subTasks.assignedTo'])),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_id' => ['nullable', 'exists:clients,id'],
            'work_type_id' => ['required', 'exists:work_types,id'],
            'form_name' => ['required', 'string'],
            'date_inward' => ['nullable', 'date'],
            'date_allocated' => ['nullable', 'date'],
            'remarks' => ['nullable', 'string'],
            'task_particular' => ['nullable', 'string'],
            'sub_status' => ['nullable', 'string'],
            'entry_date' => ['nullable', 'date'],
        ]);

        $user = $request->user();

        $task = Task::create([
            'client_id' => $validated['client_id'] ?? null,
            'work_type_id' => $validated['work_type_id'],
            'form_name' => $validated['form_name'],
            'date_inward' => $validated['date_inward'] ?? now()->toDateString(),
            'allocated_to' => $user->id, // Force allocation to themselves
            'created_by' => $user->id,
            'date_allocated' => $validated['date_allocated'] ?? now()->toDateString(),
            'status' => TaskStatus::Pending,
            'remarks' => $validated['remarks'] ?? null,
            'task_particular' => $validated['task_particular'] ?? null,
            'sub_status' => $validated['sub_status'] ?? null,
            'entry_date' => $validated['entry_date'] ?? now()->toDateString(),
            'allow_attachments' => true, // default to true for staff created tasks
        ]);

        return response()->json([
            'message' => 'Task created successfully.',
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo'])),
        ], 201);
    }


    public function updateStatus(UpdateTaskStatusRequest $request, Task $task): JsonResponse
    {
        // Ensure staff can only update their own task
        if ($task->allocated_to !== $request->user()->id) {
            return response()->json(['message' => 'You do not have access to this task.'], 403);
        }

        // Check write permission
        $user = $request->user();
        if ($task->permissions()->exists()) {
            $roleIds = $user->roles()->pluck('roles.id')->toArray();
            $hasWriteAccess = $task->permissions()
                ->whereIn('role_id', $roleIds)
                ->where('can_write', true)
                ->exists();
            if (!$hasWriteAccess) {
                return response()->json(['message' => 'You do not have write access to this sheet.'], 403);
            }
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

        // Auto-fill date_completed when marking as Complete
        if ($newStatus === TaskStatus::Complete) {
            $updateData['date_completed'] = now()->toDateString();
        }

        // Clear date_completed if moving back from Complete
        if ($currentStatus === TaskStatus::Complete && $newStatus !== TaskStatus::Complete) {
            $updateData['date_completed'] = null;
        }

        $task->update($updateData);

        $screenshotPath = null;
        if ($request->hasFile('screenshot')) {
            if (!$task->allow_attachments) {
                return response()->json(['message' => 'File upload / screenshots are not allowed for this sheet.'], 422);
            }
            $screenshotPath = UploadHelper::upload($request->file('screenshot'), 'task_screenshots');
        }

        // Log the status change
        TaskLog::create([
            'task_id' => $task->id,
            'changed_by' => $request->user()->id,
            'old_status' => $currentStatus->value,
            'new_status' => $newStatus->value,
            'remarks' => $request->remarks,
            'screenshot' => $screenshotPath,
        ]);

        return response()->json([
            'message' => 'Task status updated successfully.',
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'permissions.role'])),
        ]);
    }

    public function update(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();

        // Check parent task write permission
        $perms = (new TaskResource($task))->getUserPermissions($user);
        if (!$perms['can_write']) {
            return response()->json(['message' => 'You do not have write access to this sheet.'], 403);
        }

        $validated = $request->validate([
            'client_id' => ['sometimes', 'nullable', 'exists:clients,id'],
            'work_type_id' => ['sometimes', 'nullable', 'exists:work_types,id'],
            'form_name' => ['sometimes', 'string'],
            'date_inward' => ['sometimes', 'date'],
            'allocated_to' => ['sometimes', 'nullable', 'exists:users,id'],
            'date_allocated' => ['sometimes', 'date'],
            'date_completed' => ['nullable', 'date'],
            'status' => ['sometimes', 'string', \Illuminate\Validation\Rule::enum(TaskStatus::class)],
            'remarks' => ['nullable', 'string'],
            'dynamic_fields' => ['nullable', 'array'],
            'task_particular' => ['nullable', 'string'],
            'sub_status' => ['nullable', 'string'],
            'feedback' => ['nullable', 'string'],
            'entry_date' => ['nullable', 'date'],
            'allow_attachments' => ['nullable', 'boolean'],
        ]);

        $oldStatus = $task->status;

        // Auto-fill date_completed when status changes to Complete
        if (isset($validated['status'])) {
            $newStatus = TaskStatus::from($validated['status']);
            if ($newStatus === TaskStatus::Complete && $oldStatus !== TaskStatus::Complete) {
                $validated['date_completed'] = now()->toDateString();
            } elseif ($newStatus !== TaskStatus::Complete && $oldStatus === TaskStatus::Complete) {
                $validated['date_completed'] = null;
            }
        }

        $task->update($validated);

        if (isset($validated['status']) && $task->status !== $oldStatus) {
            TaskLog::create([
                'task_id' => $task->id,
                'changed_by' => $user->id,
                'old_status' => $oldStatus->value,
                'new_status' => $task->status->value,
                'remarks' => 'Status updated by staff member. ' . ($request->remarks ?? ''),
            ]);
        }

        return response()->json([
            'message' => 'Task updated successfully.',
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'permissions.role', 'subTasks.assignedTo'])),
        ]);
    }
}