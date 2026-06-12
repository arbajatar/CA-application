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

        if (empty($val) || (is_array($val) && count($val) === 0)) {
            return true;
        }

        // If data is array but type is user, treat it as users
        if (is_array($val) && $type === 'user') {
            $type = 'users';
        }

        if ($type === 'user') {
            if (is_array($val)) return false; // Fallback just in case
            return (string)$val === (string)$user->id;
        }
        if ($type === 'users') {
            return is_array($val) && in_array((string)$user->id, array_map('strval', $val));
        }
        if ($type === 'role') {
            $roleIds = $user->roles()->pluck('roles.id')->toArray();
            if (is_array($val)) {
                return count(array_intersect(array_map('strval', $roleIds), array_map('strval', $val))) > 0;
            }
            return in_array((string)$val, array_map('strval', $roleIds));
        }
        return false;
    }

    public static function doesUserHaveAccessToTask($task, $user)
    {
        // 1. Direct assignment of the sheet
        if ($task->allocated_to == $user->id) {
            return true;
        }

        // 2. Subtask assignment
        $hasSubtask = $task->subTasks()->where('assigned_to', $user->id)->exists();
        if ($hasSubtask) {
            return true;
        }

        // 3. Row assignment (in dynamic_fields->multi_rows)
        $multiRows = $task->dynamic_fields['multi_rows'] ?? [];
        if (is_array($multiRows)) {
            foreach ($multiRows as $row) {
                if (self::doesUserMatchRowAllocation($row, $user)) {
                    return true;
                }
            }
        }

        // 4. Sheet level permissions
        $hasPermissions = $task->permissions()->exists();
        if (!$hasPermissions) {
            return true;
        }

        $roleIds = $user->roles()->pluck('roles.id')->toArray();
        $canRead = $task->permissions()
            ->whereIn('role_id', $roleIds)
            ->where('can_read', true)
            ->exists();
        if ($canRead) {
            return true;
        }

        return false;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $tasksQuery = Task::with(['client', 'workType', 'assignedTo', 'permissions.role'])
            ->where(function ($query) use ($user) {
                $roleIds = $user->roles()->pluck('roles.id')->toArray();
                $query->where('allocated_to', $user->id)
                      ->orWhereNotNull('dynamic_fields')
                      ->orWhereHas('subTasks', fn($q) => $q->where('assigned_to', $user->id))
                      ->orWhereHas('permissions', function ($pq) use ($roleIds) {
                          if (!empty($roleIds)) {
                              $pq->whereIn('role_id', $roleIds)
                                 ->where('can_read', true);
                          } else {
                              $pq->whereRaw('1 = 0');
                          }
                      });
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
                function ($q) use ($request) {
                    $search = $request->search;
                    $q->where(function ($q) use ($search) {
                        $q->where('form_name', 'like', '%' . $search . '%')
                          ->orWhereHas('workType', function ($wq) use ($search) {
                              $wq->where('name', 'like', '%' . $search . '%');
                          });

                        // Resolve matching client IDs
                        $matchingClientIds = \App\Models\Client::where('name', 'like', '%' . $search . '%')
                            ->orWhere('contact', 'like', '%' . $search . '%')
                            ->pluck('id')
                            ->toArray();

                        foreach ($matchingClientIds as $cid) {
                            $q->orWhereJsonContains('dynamic_fields->multi_rows', ['client_id' => $cid])
                              ->orWhereJsonContains('dynamic_fields->multi_rows', ['client_id' => (string)$cid])
                              ->orWhereJsonContains('dynamic_fields->multi_rows', ['client_id' => (int)$cid]);
                        }
                    });
                }
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
        return response()->json([
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'logs.changedBy', 'permissions.role', 'subTasks.assignedTo'])),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->loadMissing('specialPermissions');

        if (!$user->specialPermissions || !$user->specialPermissions->create_sheet) {
            return response()->json(['message' => 'You do not have permission to create a sheet.'], 403);
        }

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
            'dynamic_fields' => ['nullable', 'array'],
            'allow_attachments' => ['nullable', 'boolean'],
            'allow_checklist' => ['nullable', 'boolean'],
            'allow_notes' => ['nullable', 'boolean'],
            'is_billable' => ['nullable', 'boolean'],
            'is_after_sales' => ['nullable', 'boolean'],
            'allow_duplicate_clients' => ['nullable', 'boolean'],
        ]);

        $dynamicFields = $request->input('dynamic_fields');
        $isBillable = $request->has('is_billable')
            ? $request->boolean('is_billable')
            : filter_var($dynamicFields['is_billable'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $isAfterSales = $request->has('is_after_sales')
            ? $request->boolean('is_after_sales')
            : filter_var($dynamicFields['is_after_sales'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $allowDuplicateClients = $request->has('allow_duplicate_clients')
            ? $request->boolean('allow_duplicate_clients')
            : filter_var($dynamicFields['allow_duplicate_clients'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if (is_array($dynamicFields)) {
            unset($dynamicFields['is_billable']);
            unset($dynamicFields['is_after_sales']);
            unset($dynamicFields['allow_duplicate_clients']);
        }

        $task = Task::create([
            'client_id' => $validated['client_id'] ?? null,
            'work_type_id' => $validated['work_type_id'],
            'form_name' => $validated['form_name'],
            'date_inward' => $validated['date_inward'] ?? now()->toDateString(),
            'allocated_to' => $request->has('allocated_to') ? $request->allocated_to : $user->id,
            'created_by' => $user->id,
            'date_allocated' => $validated['date_allocated'] ?? now()->toDateString(),
            'status' => TaskStatus::Pending,
            'remarks' => $validated['remarks'] ?? null,
            'dynamic_fields' => $dynamicFields,
            'task_particular' => $validated['task_particular'] ?? null,
            'sub_status' => $validated['sub_status'] ?? null,
            'entry_date' => $validated['entry_date'] ?? now()->toDateString(),
            'allow_attachments' => $request->boolean('allow_attachments', true),
            'allow_checklist' => $request->boolean('allow_checklist', true),
            'allow_notes' => $request->boolean('allow_notes', true),
            'is_billable' => $isBillable,
            'is_after_sales' => $isAfterSales,
            'allow_duplicate_clients' => $allowDuplicateClients,
        ]);

        // Handle detailed subtasks assignment
        if ($request->has('subtasks') && is_array($request->subtasks)) {
            foreach ($request->subtasks as $stData) {
                $task->subTasks()->create([
                    'title' => $stData['title'],
                    'assigned_to' => $stData['assigned_to'] ?? null,
                    'status' => $stData['status'] ?? TaskStatus::Pending,
                    'priority' => $stData['priority'] ?? 'medium',
                    'due_date' => $stData['due_date'] ?? null,
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
            'changed_by' => $user->id,
            'old_status' => null,
            'new_status' => TaskStatus::Pending->value,
            'remarks' => 'Task created with ' . count($request->subtasks ?? []) . ' assigned subtasks.',
        ]);

        return response()->json([
            'message' => 'Task created successfully.',
            'data' => new TaskResource($task->load(['client', 'workType', 'assignedTo', 'permissions.role'])),
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
        $user->loadMissing('specialPermissions');

        // Check if attempting to update template/global settings
        $isUpdatingTemplate = false;
        if ($request->has('form_name') && $request->input('form_name') !== $task->form_name) {
            $isUpdatingTemplate = true;
        }
        if ($request->has('work_type_id') && $request->input('work_type_id') !== $task->work_type_id) {
            $isUpdatingTemplate = true;
        }
        if ($request->has('allow_attachments') && $request->input('allow_attachments') !== $task->allow_attachments) {
            $isUpdatingTemplate = true;
        }
        if ($request->has('allow_checklist') && $request->input('allow_checklist') !== $task->allow_checklist) {
            $isUpdatingTemplate = true;
        }
        if ($request->has('allow_notes') && $request->input('allow_notes') !== $task->allow_notes) {
            $isUpdatingTemplate = true;
        }
        if ($request->has('is_billable') && $request->input('is_billable') !== $task->is_billable) {
            $isUpdatingTemplate = true;
        }
        if ($request->has('is_after_sales') && $request->input('is_after_sales') !== $task->is_after_sales) {
            $isUpdatingTemplate = true;
        }
        if ($request->has('allow_duplicate_clients') && $request->input('allow_duplicate_clients') !== $task->allow_duplicate_clients) {
            $isUpdatingTemplate = true;
        }
        if ($request->has('dynamic_fields.schema')) {
            $newSchema = $request->input('dynamic_fields.schema');
            $oldSchema = is_array($task->dynamic_fields) && isset($task->dynamic_fields['schema']) ? $task->dynamic_fields['schema'] : null;
            if (json_encode($newSchema) !== json_encode($oldSchema)) {
                $isUpdatingTemplate = true;
            }
        }

        if ($isUpdatingTemplate) {
            if (!$user->specialPermissions || !$user->specialPermissions->edit_sheet) {
                return response()->json(['message' => 'You do not have permission to update the template or global settings of this sheet.'], 403);
            }
        }

        $perms = (new TaskResource($task))->getUserPermissions($user);

        $isStaff = $user->role->value === 'staff';
        $hasWriteAccess = $perms['can_write'];

        if (!$hasWriteAccess) {
            if ($isStaff) {
                $restrictedFields = ['work_type_id', 'form_name', 'date_inward', 'allocated_to', 'date_allocated', 'remarks', 'task_particular'];
                foreach ($restrictedFields as $field) {
                    if ($request->has($field) && $request->input($field) != $task->$field) {
                        return response()->json(['message' => 'You do not have write access to change ' . str_replace('_', ' ', $field) . '.'], 403);
                    }
                }
            } else {
                return response()->json(['message' => 'You do not have write access to this sheet.'], 403);
            }
        }

        $hasPermissionsSet = $task->permissions()->exists();
        $isAuthorizedForSheet = !$hasPermissionsSet || $hasWriteAccess;
        if ($isStaff && !$isAuthorizedForSheet) {
            if ($request->has('dynamic_fields')) {
                $oldRows = $task->dynamic_fields['multi_rows'] ?? [];
                $newRows = $request->input('dynamic_fields.multi_rows') ?? [];

                $length = max(count($oldRows), count($newRows));
                for ($i = 0; $i < $length; $i++) {
                    $oldRow = $oldRows[$i] ?? null;
                    $newRow = $newRows[$i] ?? null;

                    if ($oldRow != $newRow) {
                        // If it's an existing row, it must have been allocated to the user
                        if ($oldRow) {
                            $oldRowNoAlloc = $oldRow;
                            $newRowNoAlloc = $newRow;
                            unset($oldRowNoAlloc['allocated_to'], $oldRowNoAlloc['allocated_type'], $oldRowNoAlloc['date_allocated']);
                            unset($newRowNoAlloc['allocated_to'], $newRowNoAlloc['allocated_type'], $newRowNoAlloc['date_allocated']);

                            if ($oldRowNoAlloc != $newRowNoAlloc) {
                                if (!self::doesUserMatchRowAllocation($oldRow, $user)) {
                                    return response()->json(['message' => 'You do not have permission to modify rows assigned to other staff.'], 403);
                                }
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
            'is_billable' => ['nullable', 'boolean'],
            'is_after_sales' => ['nullable', 'boolean'],
            'allow_duplicate_clients' => ['nullable', 'boolean'],
        ]);

        $dynamicFields = $request->input('dynamic_fields');
        if ($request->has('is_billable')) {
            $validated['is_billable'] = $request->boolean('is_billable');
        } elseif (is_array($dynamicFields) && array_key_exists('is_billable', $dynamicFields)) {
            $validated['is_billable'] = filter_var($dynamicFields['is_billable'], FILTER_VALIDATE_BOOLEAN);
        }

        if ($request->has('is_after_sales')) {
            $validated['is_after_sales'] = $request->boolean('is_after_sales');
        } elseif (is_array($dynamicFields) && array_key_exists('is_after_sales', $dynamicFields)) {
            $validated['is_after_sales'] = filter_var($dynamicFields['is_after_sales'], FILTER_VALIDATE_BOOLEAN);
        }

        if ($request->has('allow_duplicate_clients')) {
            $validated['allow_duplicate_clients'] = $request->boolean('allow_duplicate_clients');
        } elseif (is_array($dynamicFields) && array_key_exists('allow_duplicate_clients', $dynamicFields)) {
            $validated['allow_duplicate_clients'] = filter_var($dynamicFields['allow_duplicate_clients'], FILTER_VALIDATE_BOOLEAN);
        }

        if (is_array($dynamicFields)) {
            unset($dynamicFields['is_billable']);
            unset($dynamicFields['is_after_sales']);
            unset($dynamicFields['allow_duplicate_clients']);
            $validated['dynamic_fields'] = $dynamicFields;
        }

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

    public function destroy(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();
        $user->loadMissing('specialPermissions');

        if (!$user->specialPermissions || !$user->specialPermissions->delete_sheet) {
            return response()->json(['message' => 'You do not have permission to delete this sheet.'], 403);
        }

        if (!self::doesUserHaveAccessToTask($task, $user)) {
            return response()->json(['message' => 'You do not have access to this task.'], 403);
        }

        $task->subTasks()->delete();
        $task->delete();

        return response()->json(['message' => 'Task deleted successfully.']);
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