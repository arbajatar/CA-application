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
    public static function doesUserMatchRowAllocation($row, $user)
    {
        $type = $row['allocated_type'] ?? 'user';
        $val = $row['allocated_to'] ?? null;

        if ($type === 'user') {
            return (string)$val === (string)$user->id;
        }
        if ($type === 'users') {
            return is_array($val) && in_array((string)$user->id, array_map('strval', $val));
        }
        if ($type === 'role') {
            $roleIds = $user->roles()->pluck('roles.id')->toArray();
            return in_array((string)$val, array_map('strval', $roleIds));
        }
        return false;
    }

    public static function doesUserHaveAccessToTask($task, $user)
    {
        if ($task->allocated_to === $user->id) {
            return true;
        }

        if ($task->dynamic_fields && isset($task->dynamic_fields['multi_rows']) && is_array($task->dynamic_fields['multi_rows'])) {
            foreach ($task->dynamic_fields['multi_rows'] as $row) {
                if (self::doesUserMatchRowAllocation($row, $user)) {
                    return true;
                }
            }
        }

        if ($task->subTasks()->where('assigned_to', $user->id)->exists()) {
            return true;
        }

        return false;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $tasksQuery = Task::with(['client', 'workType', 'assignedTo', 'permissions.role'])
            ->where(function ($query) use ($user) {
                $query->where('allocated_to', $user->id)
                      ->orWhereNotNull('dynamic_fields')
                      ->orWhereHas('subTasks', fn($q) => $q->where('assigned_to', $user->id));
            })
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
            ->latest();

        $allTasks = $tasksQuery->get();

        $filteredTasks = $allTasks->filter(function ($task) use ($user) {
            return self::doesUserHaveAccessToTask($task, $user);
        });

        $perPage = $request->get('per_page', 15);
        if ($perPage === 'all') {
            return TaskResource::collection($filteredTasks);
        }

        $perPage = min((int)$perPage, 1000);
        $page = \Illuminate\Pagination\Paginator::resolveCurrentPage() ?: 1;
        $paginatedItems = $filteredTasks->forPage($page, $perPage)->values();
        
        $paginated = new \Illuminate\Pagination\LengthAwarePaginator(
            $paginatedItems,
            $filteredTasks->count(),
            $perPage,
            $page,
            ['path' => \Illuminate\Pagination\Paginator::resolveCurrentPath()]
        );

        return TaskResource::collection($paginated);
    }

    public function show(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();

        if (!self::doesUserHaveAccessToTask($task, $user)) {
            return response()->json(['message' => 'You do not have access to this task.'], 403);
        }

        // Check read permission
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

        // Check parent task write permission or staff role
        if ($user->role->value === 'staff' || !$perms['can_write']) {
            if ($request->has('dynamic_fields')) {
                $oldRows = $task->dynamic_fields['multi_rows'] ?? [];
                $newRows = $request->input('dynamic_fields.multi_rows') ?? [];

                $length = max(count($oldRows), count($newRows));
                for ($i = 0; $i < $length; $i++) {
                    $oldRow = $oldRows[$i] ?? null;
                    $newRow = $newRows[$i] ?? null;

                    if ($oldRow != $newRow) {
                        // If it's a new row, it must be allocated to the user
                        if (!$oldRow) {
                            if (!self::doesUserMatchRowAllocation($newRow, $user)) {
                                return response()->json(['message' => 'You can only add rows allocated to yourself.'], 403);
                            }
                        }
                        // If it's an existing row, it must have been allocated to the user
                        else {
                            if (!self::doesUserMatchRowAllocation($oldRow, $user)) {
                                return response()->json(['message' => 'You do not have permission to modify rows assigned to other staff.'], 403);
                            }

                            if ($newRow && !self::doesUserMatchRowAllocation($newRow, $user)) {
                                return response()->json(['message' => 'You cannot assign your row to another staff member.'], 403);
                            }
                        }
                    }
                }
            } else {
                return response()->json(['message' => 'You do not have write access to this sheet.'], 403);
            }
        }

        $validated = $request->validate([
            'work_type_id' => ['sometimes', 'nullable', 'exists:work_types,id'],
            'form_name' => ['sometimes', 'string'],
            'date_inward' => ['sometimes', 'nullable', 'date'],
            'allocated_to' => ['sometimes', 'nullable', 'exists:users,id'],
            'date_allocated' => ['sometimes', 'nullable', 'date'],
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

    public function uploadFile(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:5120'],
        ]);
        $path = UploadHelper::upload($request->file('file'), 'sheet_attachments');
        return response()->json([
            'url' => asset('storage/' . $path),
            'path' => $path,
            'name' => $request->file('file')->getClientOriginalName(),
        ]);
    }
}