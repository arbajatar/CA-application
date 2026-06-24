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
            return false;
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
            return false;
        }

        $roleIds = $user->roles()->pluck('roles.id')->toArray();
        $canRead = $task->permissions()
            ->whereIn('role_id', $roleIds)
            ->where('can_read', true)
            ->exists();
        if ($canRead) {
            return true;
        }

        // 5. Creator of the sheet
        if ($task->created_by == $user->id) {
            return true;
        }

        return false;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $roleIds = $user->roles()->pluck('roles.id')->toArray();
        $roleIdsStr = array_map('strval', $roleIds);
        $userIdStr = (string)$user->id;

        // 1. Get task IDs where user is assigned to subtasks
        $taskIdsWithSubtasks = \App\Models\SubTask::where('assigned_to', $user->id)
            ->pluck('task_id')
            ->unique()
            ->toArray();

        // 2. Get task IDs with read permission for user's roles
        $taskIdsWithRolePermission = \App\Models\SheetPermission::whereIn('role_id', $roleIds)
            ->where('can_read', true)
            ->pluck('task_id')
            ->unique()
            ->toArray();

        // 3. Get task IDs without permissions
        $taskIdsWithoutPermissions = Task::whereDoesntHave('permissions')
            ->pluck('id')
            ->toArray();

        // 4. Fetch lightweight JSON allocation arrays for all tasks
        $rawAccessData = Task::select(['id', 'allocated_to', 'created_by'])
            ->selectRaw("JSON_EXTRACT(dynamic_fields, '$.multi_rows[*].allocated_to') as row_allocated_tos")
            ->selectRaw("JSON_EXTRACT(dynamic_fields, '$.multi_rows[*].allocated_type') as row_allocated_types")
            ->get();

        $allowedTaskIds = [];
        foreach ($rawAccessData as $item) {
            $taskId = $item->id;

            // Direct assignment of sheet
            if ((string)$item->allocated_to === $userIdStr) {
                $allowedTaskIds[] = $taskId;
                continue;
            }

            // Creator of the sheet
            if ((string)$item->created_by === $userIdStr) {
                $allowedTaskIds[] = $taskId;
                continue;
            }

            // Subtask assignment
            if (in_array($taskId, $taskIdsWithSubtasks)) {
                $allowedTaskIds[] = $taskId;
                continue;
            }

            // Sheet permissions check (must have permission if any permissions exist)
            $hasPermissions = !in_array($taskId, $taskIdsWithoutPermissions);
            if ($hasPermissions && !in_array($taskId, $taskIdsWithRolePermission)) {
                // Denied at sheet permission level
                continue;
            }

            // Row-level assignment check
            $tos = json_decode($item->row_allocated_tos, true) ?: [];
            $types = json_decode($item->row_allocated_types, true) ?: [];

            $hasRowAccess = false;
            for ($i = 0; $i < count($tos); $i++) {
                $rowVal = $tos[$i] ?? null;
                $rowType = $types[$i] ?? 'user';

                if (empty($rowVal) || (is_array($rowVal) && count($rowVal) === 0)) {
                    continue;
                }

                if (is_array($rowVal) && $rowType === 'user') {
                    $rowType = 'users';
                }

                if ($rowType === 'user') {
                    if (!is_array($rowVal) && (string)$rowVal === $userIdStr) {
                        $hasRowAccess = true;
                        break;
                    }
                } elseif ($rowType === 'users') {
                    if (is_array($rowVal)) {
                        $rowValStr = array_map('strval', $rowVal);
                        if (in_array($userIdStr, $rowValStr)) {
                            $hasRowAccess = true;
                            break;
                        }
                    }
                } elseif ($rowType === 'role') {
                    if (is_array($rowVal)) {
                        $rowValStr = array_map('strval', $rowVal);
                        if (count(array_intersect($roleIdsStr, $rowValStr)) > 0) {
                            $hasRowAccess = true;
                            break;
                        }
                    } else {
                        if (in_array((string)$rowVal, $roleIdsStr)) {
                            $hasRowAccess = true;
                            break;
                        }
                    }
                }
            }

            if ($hasRowAccess) {
                $allowedTaskIds[] = $taskId;
            }
        }

        $columns = [
            'id', 'work_type_id', 'form_name', 'date_inward', 'allocated_to',
            'created_by', 'date_allocated', 'date_completed', 'status', 'priority',
            'due_date', 'remarks', 'created_at', 'updated_at', 'deleted_at',
            'task_particular', 'sub_status', 'feedback', 'entry_date',
            'allow_attachments', 'allow_checklist', 'allow_notes',
            'is_billable', 'is_after_sales', 'allow_duplicate_clients'
        ];

        $tasksQuery = Task::select($columns)
            ->selectRaw("JSON_REMOVE(dynamic_fields, '$.multi_rows') as dynamic_fields")
            ->with(['client', 'workType', 'assignedTo', 'permissions.role'])
            ->whereIn('id', $allowedTaskIds)
            ->when(
                $request->filled('status'),
                fn($q) =>
                $q->where('status', TaskStatus::from($request->status))
            )
            ->when(
                $request->filled('work_type_id'),
                fn($q) =>
                $q->where('work_type_id', $request->work_type_id)
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

        $perPage = $request->get('per_page', 15);
        if ($perPage === 'all') {
            $tasks = $tasksQuery->get();
            return TaskResource::collection($tasks);
        }

        $perPage = min((int)$perPage, 1000);
        $tasks = $tasksQuery->paginate($perPage);

        return TaskResource::collection($tasks);
    }

    public function show(Request $request, Task $task): JsonResponse
    {
        $task->load(['client', 'workType', 'assignedTo', 'permissions.role', 'subTasks.assignedTo']);

        $dynamicFields = $task->dynamic_fields;
        $multiRows = $dynamicFields['multi_rows'] ?? [];

        foreach ($multiRows as $idx => &$row) {
            $row['db_original_index'] = $idx;
        }
        unset($row);

        // 1. Filtering by allocated_staff_ids before calculating status/sub-status counts
        if ($request->filled('allocated_staff_ids')) {
            $staffIds = is_array($request->allocated_staff_ids) 
                ? array_map('intval', $request->allocated_staff_ids) 
                : array_map('intval', explode(',', $request->allocated_staff_ids));

            if (count($staffIds) > 0) {
                $multiRows = array_filter($multiRows, function($row) use ($staffIds) {
                    $allocType = $row['allocated_type'] ?? 'user';
                    $allocTo = $row['allocated_to'] ?? null;

                    if (empty($allocTo)) {
                        return false;
                    }

                    if ($allocType === 'user' || $allocType === 'users') {
                        if (is_array($allocTo)) {
                            return count(array_intersect(array_map('intval', $allocTo), $staffIds)) > 0;
                        }
                        return in_array((int)$allocTo, $staffIds);
                    }
                    if ($allocType === 'role') {
                        if (is_array($allocTo)) {
                            $allocToRoles = array_map('intval', $allocTo);
                        } else {
                            $allocToRoles = [(int)$allocTo];
                        }
                        return \App\Models\User::whereIn('id', $staffIds)
                            ->whereHas('roles', function($q) use ($allocToRoles) {
                                $q->whereIn('roles.id', $allocToRoles);
                            })
                            ->exists();
                    }
                    return false;
                });
            }
        }

        $statusCounts = [
            'pending' => 0,
            'work_in_progress' => 0,
            'complete' => 0,
            'not_to_be_done' => 0,
            'other' => 0,
            'total' => count($multiRows)
        ];
        $subStatusCounts = [
            'Unassigned' => 0
        ];
        foreach ($multiRows as $row) {
            $rowStatus = strtolower($row['status'] ?? '');
            if ($rowStatus === 'pending' || $rowStatus === 'assigned' || !$rowStatus) {
                $statusCounts['pending']++;
            } else if (isset($statusCounts[$rowStatus])) {
                $statusCounts[$rowStatus]++;
            } else {
                $statusCounts['other']++;
            }

            $rowSubStatus = $row['sub_status'] ?? $row['dynamic_data']['Sub Status'] ?? $row['dynamic_data']['static_sub_status'] ?? '';
            if (empty($rowSubStatus)) {
                $subStatusCounts['Unassigned']++;
            } else {
                if (!isset($subStatusCounts[$rowSubStatus])) {
                    $subStatusCounts[$rowSubStatus] = 0;
                }
                $subStatusCounts[$rowSubStatus]++;
            }
        }


        $statusFilter = $request->get('status') ?: $request->get('selectedStatusFilter');
        if ($statusFilter) {
            $statusFilter = strtolower($statusFilter);
            $multiRows = array_filter($multiRows, function($row) use ($statusFilter) {
                $rowStatus = strtolower($row['status'] ?? '');
                if ($statusFilter === 'pending') {
                    return $rowStatus === 'pending' || $rowStatus === 'assigned' || !$rowStatus;
                }
                return $rowStatus === $statusFilter;
            });
        }

        $subStatusFilter = $request->get('sub_status') ?: $request->get('selectedSubStatusFilter');
        if ($subStatusFilter) {
            $multiRows = array_filter($multiRows, function($row) use ($subStatusFilter) {
                $rowSubStatus = $row['sub_status'] ?? $row['dynamic_data']['Sub Status'] ?? $row['dynamic_data']['static_sub_status'] ?? '';
                if ($subStatusFilter === 'Unassigned') {
                    return empty($rowSubStatus);
                }
                return $rowSubStatus === $subStatusFilter;
            });
        }

        if ($request->filled('work_type_id')) {
            $wtId = $request->work_type_id;
            $multiRows = array_filter($multiRows, function($row) use ($wtId) {
                return (string)($row['work_type_id'] ?? '') === (string)$wtId;
            });
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $searchLower = strtolower($search);

            $matchingClientIds = \App\Models\Client::where('name', 'like', '%' . $search . '%')
                ->orWhere('contact', 'like', '%' . $search . '%')
                ->pluck('id')
                ->toArray();

            $matchingWorkTypeIds = \App\Models\WorkType::where('name', 'like', '%' . $search . '%')
                ->pluck('id')
                ->toArray();

            $matchingStaffIds = \App\Models\User::where('name', 'like', '%' . $search . '%')
                ->pluck('id')
                ->toArray();

            $multiRows = array_filter($multiRows, function($row) use ($searchLower, $matchingClientIds, $matchingWorkTypeIds, $matchingStaffIds) {
                $clientId = $row['client_id'] ?? null;
                $workTypeId = $row['work_type_id'] ?? null;
                $allocatedTo = $row['allocated_to'] ?? null;

                if ($clientId && in_array($clientId, $matchingClientIds)) return true;
                if ($workTypeId && in_array($workTypeId, $matchingWorkTypeIds)) return true;
                if ($allocatedTo && in_array($allocatedTo, $matchingStaffIds)) return true;

                $formName = strtolower($row['form_name'] ?? '');
                $rowStatus = strtolower($row['status'] ?? '');
                $rowSubStatus = strtolower($row['sub_status'] ?? $row['dynamic_data']['Sub Status'] ?? $row['dynamic_data']['static_sub_status'] ?? '');

                if (strpos($formName, $searchLower) !== false ||
                    strpos($rowStatus, $searchLower) !== false ||
                    strpos($rowSubStatus, $searchLower) !== false) {
                    return true;
                }

                if (isset($row['dynamic_data']) && is_array($row['dynamic_data'])) {
                    foreach ($row['dynamic_data'] as $val) {
                        if (is_array($val)) {
                            foreach ($val as $subVal) {
                                if (strpos(strtolower((string)$subVal), $searchLower) !== false) return true;
                            }
                        } else {
                            if (strpos(strtolower((string)$val), $searchLower) !== false) return true;
                        }
                    }
                }
                return false;
            });
        }

        // 1.5. Dynamic Column Filtering
        $columnFiltersJson = $request->get('column_filters');
        if ($columnFiltersJson) {
            $colFilters = json_decode($columnFiltersJson, true);
            if (is_array($colFilters)) {
                $clientIdsForFilter = array_values(array_unique(array_filter(array_column($multiRows, 'client_id'))));
                $clientsFilterMap = count($clientIdsForFilter) ? \App\Models\Client::whereIn('id', $clientIdsForFilter)->pluck('name', 'id')->toArray() : [];
                $clientsPanFilterMap = count($clientIdsForFilter) ? \App\Models\Client::whereIn('id', $clientIdsForFilter)->pluck('pan_no', 'id')->toArray() : [];

                $workTypeIdsForFilter = array_values(array_unique(array_filter(array_column($multiRows, 'work_type_id'))));
                $workTypesFilterMap = count($workTypeIdsForFilter) ? \App\Models\WorkType::whereIn('id', $workTypeIdsForFilter)->pluck('name', 'id')->toArray() : [];

                $staffIdsForFilter = array_values(array_unique(array_filter(array_column($multiRows, 'allocated_to'))));
                $staffFilterMap = count($staffIdsForFilter) ? \App\Models\User::whereIn('id', $staffIdsForFilter)->pluck('name', 'id')->toArray() : [];
                $matchesFilter = function($value, $query) {
                    $query = strtolower(trim($query));
                    if ($query === '') return true;
                    
                    $queryNormalized = str_replace('-', '/', $query);
                    $valueStr = strtolower(trim((string)$value));
                    
                    if (preg_match('/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/', $valueStr, $matches)) {
                        $formattedDate = "{$matches[3]}/{$matches[2]}/{$matches[1]}";
                        if (strpos($formattedDate, $queryNormalized) !== false) {
                            return true;
                        }
                    }
                    
                    if (preg_match('/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/', $valueStr, $matches)) {
                        $formattedDate = "{$matches[1]}/{$matches[2]}/{$matches[3]}";
                        if (strpos($formattedDate, $queryNormalized) !== false) {
                            return true;
                        }
                    }

                    $valueNormalized = str_replace('-', '/', $valueStr);
                    if (strpos($valueNormalized, $queryNormalized) !== false) {
                        return true;
                    }
                    
                    return strpos($valueStr, $query) !== false;
                };


                foreach ($colFilters as $colKey => $colVal) {
                    $colVal = trim($colVal);
                    if ($colVal === '') {
                        continue;
                    }
                    $multiRows = array_filter($multiRows, function($row) use ($colKey, $colVal, $clientsFilterMap, $clientsPanFilterMap, $workTypesFilterMap, $staffFilterMap, $matchesFilter) {
                        if ($colKey === 'client_id') {
                            $cid = $row['client_id'] ?? null;
                            $name = $cid ? ($clientsFilterMap[$cid] ?? '') : '';
                            return $matchesFilter($name, $colVal);
                        }
                        if ($colKey === 'client_pan') {
                            $cid = $row['client_id'] ?? null;
                            $pan = $cid ? ($clientsPanFilterMap[$cid] ?? '') : '';
                            return $matchesFilter($pan, $colVal);
                        }
                        if ($colKey === 'work_type_id') {
                            $wtid = $row['work_type_id'] ?? null;
                            $name = $wtid ? ($workTypesFilterMap[$wtid] ?? '') : '';
                            return $matchesFilter($name, $colVal);
                        }
                        if ($colKey === 'allocated_to') {
                            $allocType = $row['allocated_type'] ?? 'user';
                            $allocTo = $row['allocated_to'] ?? null;
                            $namesStr = '';
                            if ($allocType === 'user' && $allocTo) {
                                $namesStr = $staffFilterMap[$allocTo] ?? '';
                            } else if ($allocType === 'users' && is_array($allocTo)) {
                                $names = [];
                                foreach ($allocTo as $uid) {
                                    if (isset($staffFilterMap[$uid])) {
                                        $names[] = $staffFilterMap[$uid];
                                    }
                                }
                                $namesStr = implode(', ', $names);
                            }
                            return $matchesFilter($namesStr, $colVal);
                        }
                        if ($colKey === 'date_allocated') {
                            $val = $row['date_allocated'] ?? '';
                            return $matchesFilter($val, $colVal);
                        }
                        if ($colKey === 'status') {
                            $val = $row['status'] ?? '';
                            return $matchesFilter($val, $colVal);
                        }
                        if ($colKey === 'sub_status') {
                            $val = $row['sub_status'] ?? $row['dynamic_data']['Sub Status'] ?? $row['dynamic_data']['static_sub_status'] ?? '';
                            return $matchesFilter($val, $colVal);
                        }
                        if ($colKey === 'remarks') {
                            $val = $row['remarks'] ?? '';
                            return $matchesFilter($val, $colVal);
                        }

                        $dynVal = $row['dynamic_data'][$colKey] ?? '';
                        if (is_array($dynVal)) {
                            foreach ($dynVal as $subVal) {
                                if ($matchesFilter($subVal, $colVal)) {
                                    return true;
                                }
                            }
                            return false;
                        }
                        return $matchesFilter($dynVal, $colVal);
                    });
                }
            }
        }

        // 2. Sorting
        $sortField = $request->get('sort_field');
        $sortDirection = $request->get('sort_direction', 'asc');
        if ($sortField && $sortDirection !== 'default') {
            $clientsMap = [];
            $workTypesMap = [];
            $staffMap = [];

            if ($sortField === 'client') {
                $clientIds = array_values(array_unique(array_filter(array_column($multiRows, 'client_id'))));
                $clientsMap = count($clientIds) ? \App\Models\Client::whereIn('id', $clientIds)->pluck('name', 'id')->toArray() : [];
            } else if ($sortField === 'work_type') {
                $workTypeIds = array_values(array_unique(array_filter(array_column($multiRows, 'work_type_id'))));
                $workTypesMap = count($workTypeIds) ? \App\Models\WorkType::whereIn('id', $workTypeIds)->pluck('name', 'id')->toArray() : [];
            } else if ($sortField === 'assigned_to') {
                $staffIds = array_values(array_unique(array_filter(array_column($multiRows, 'allocated_to'))));
                $staffMap = count($staffIds) ? \App\Models\User::whereIn('id', $staffIds)->pluck('name', 'id')->toArray() : [];
            }

            usort($multiRows, function($a, $b) use ($sortField, $sortDirection, $clientsMap, $workTypesMap, $staffMap) {
                $valA = '';
                $valB = '';

                if ($sortField === 'client') {
                    $valA = isset($a['client_id']) ? ($clientsMap[$a['client_id']] ?? '') : '';
                    $valB = isset($b['client_id']) ? ($clientsMap[$b['client_id']] ?? '') : '';
                } else if ($sortField === 'work_type') {
                    $valA = isset($a['work_type_id']) ? ($workTypesMap[$a['work_type_id']] ?? '') : '';
                    $valB = isset($b['work_type_id']) ? ($workTypesMap[$b['work_type_id']] ?? '') : '';
                } else if ($sortField === 'assigned_to') {
                    $valA = isset($a['allocated_to']) ? ($staffMap[$a['allocated_to']] ?? '') : '';
                    $valB = isset($b['allocated_to']) ? ($staffMap[$b['allocated_to']] ?? '') : '';
                } else if ($sortField === 'date_allocated') {
                    $valA = $a['date_allocated'] ?? '';
                    $valB = $b['date_allocated'] ?? '';
                } else if ($sortField === 'status') {
                    $valA = $a['status'] ?? '';
                    $valB = $b['status'] ?? '';
                } else if ($sortField === 'sub_status') {
                    $valA = $a['sub_status'] ?? '';
                    $valB = $b['sub_status'] ?? '';
                } else if (strpos($sortField, 'dynamic_') === 0) {
                    $fieldLabel = substr($sortField, 8);
                    $valA = $a['dynamic_data'][$fieldLabel] ?? '';
                    $valB = $b['dynamic_data'][$fieldLabel] ?? '';
                }

                $strA = strtolower((string)$valA);
                $strB = strtolower((string)$valB);

                if ($strA === $strB) return 0;
                if ($sortDirection === 'asc') {
                    return ($strA < $strB) ? -1 : 1;
                } else {
                    return ($strA > $strB) ? -1 : 1;
                }
            });
        }

        // 3. Paginate
        $totalRows = count($multiRows);
        $page = (int)$request->get('page', 1);
        $perPage = $request->get('per_page', 10);

        if ($perPage !== 'all' && $perPage !== 'All') {
            $perPage = (int)$perPage;
            $offset = ($page - 1) * $perPage;
            $paginatedRows = array_slice(array_values($multiRows), $offset, $perPage);
        } else {
            $paginatedRows = array_values($multiRows);
        }

        $dynamicFields['multi_rows'] = $paginatedRows;
        $task->dynamic_fields = $dynamicFields;

        return response()->json([
            'data' => new TaskResource($task),
            'meta' => [
                'total' => $totalRows,
                'page' => $page,
                'per_page' => $perPage,
                'status_counts' => $statusCounts,
                'sub_status_counts' => $subStatusCounts,
            ]
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

                // Index old rows by their row_id/id
                $oldMap = [];
                foreach ($oldRows as $idx => $r) {
                    $rowId = $r['row_id'] ?? $r['id'] ?? "idx_$idx";
                    $oldMap[$rowId] = $r;
                }

                // Index new rows by their row_id/id
                $newMap = [];
                foreach ($newRows as $idx => $r) {
                    $rowId = $r['row_id'] ?? $r['id'] ?? "idx_$idx";
                    $newMap[$rowId] = $r;
                }

                // 1. Check for modified rows
                foreach ($newMap as $rowId => $newRow) {
                    if (isset($oldMap[$rowId])) {
                        $oldRow = $oldMap[$rowId];
                        
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

                // 2. Check for deleted rows
                if ($request->has('deleted_row_ids')) {
                    $deletedIds = $request->input('deleted_row_ids');
                    if (is_array($deletedIds)) {
                        foreach ($deletedIds as $dId) {
                            if (isset($oldMap[$dId])) {
                                $oldRow = $oldMap[$dId];
                                if (!self::doesUserMatchRowAllocation($oldRow, $user)) {
                                    return response()->json(['message' => 'You do not have permission to delete rows assigned to other staff.'], 403);
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
            'last_updated_at' => ['sometimes', 'nullable', 'string'],
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
            $incomingRows = $dynamicFields['multi_rows'] ?? null;
            if (is_array($incomingRows)) {
                $currentDynamicFields = $task->dynamic_fields;
                $masterRows = $currentDynamicFields['multi_rows'] ?? [];

                $deletedIds = [];
                if ($request->has('deleted_row_ids')) {
                    $deletedIds = $request->input('deleted_row_ids');
                    if (!is_array($deletedIds)) {
                        $deletedIds = [];
                    }
                }

                $masterRowsByRowId = [];
                foreach ($masterRows as $mr) {
                    $rowId = $mr['row_id'] ?? $mr['id'] ?? null;
                    if ($rowId) {
                        $masterRowsByRowId[$rowId] = $mr;
                    }
                }

                // First, ensure all incoming rows have row_id and handle attachments merge
                foreach ($incomingRows as &$ir) {
                    $rowId = $ir['row_id'] ?? $ir['id'] ?? null;
                    if (!$rowId) {
                        $rowId = 'row_' . time() . '_' . rand(1000, 9999);
                        $ir['row_id'] = $rowId;
                    } else {
                        $existing = $masterRowsByRowId[$rowId] ?? [];
                        if ((!array_key_exists('attachments', $ir) || is_null($ir['attachments'])) && isset($existing['attachments'])) {
                            $ir['attachments'] = $existing['attachments'];
                        }
                    }
                    $masterRowsByRowId[$rowId] = $ir;
                }
                unset($ir);

                // Build filtered master rows preserving order
                $newMasterRows = [];
                foreach ($masterRows as $mr) {
                    $rowId = $mr['row_id'] ?? $mr['id'] ?? null;
                    if ($rowId && !in_array($rowId, $deletedIds)) {
                        $newMasterRows[] = $masterRowsByRowId[$rowId] ?? $mr;
                    }
                }

                // Insert new/duplicated rows at their relative positions
                foreach ($incomingRows as $idx => $ir) {
                    $rowId = $ir['row_id'] ?? $ir['id'] ?? null;
                    if (!$rowId) continue;

                    $isNew = true;
                    foreach ($masterRows as $mr) {
                        $mrId = $mr['row_id'] ?? $mr['id'] ?? null;
                        if ($mrId === $rowId) {
                            $isNew = false;
                            break;
                        }
                    }

                    if ($isNew) {
                        $inserted = false;
                        // 1. Find predecessor in $incomingRows already in $newMasterRows
                        for ($i = $idx - 1; $i >= 0; $i--) {
                            $predId = $incomingRows[$i]['row_id'] ?? $incomingRows[$i]['id'] ?? null;
                            if ($predId) {
                                foreach ($newMasterRows as $key => $nmr) {
                                    $nmrId = $nmr['row_id'] ?? $nmr['id'] ?? null;
                                    if ($nmrId === $predId) {
                                        array_splice($newMasterRows, $key + 1, 0, [$ir]);
                                        $inserted = true;
                                        break 2;
                                    }
                                }
                            }
                        }

                        // 2. Find successor in $incomingRows already in $newMasterRows
                        if (!$inserted) {
                            for ($i = $idx + 1; $i < count($incomingRows); $i++) {
                                $succId = $incomingRows[$i]['row_id'] ?? $incomingRows[$i]['id'] ?? null;
                                if ($succId) {
                                    foreach ($newMasterRows as $key => $nmr) {
                                        $nmrId = $nmr['row_id'] ?? $nmr['id'] ?? null;
                                        if ($nmrId === $succId) {
                                            array_splice($newMasterRows, $key, 0, [$ir]);
                                            $inserted = true;
                                            break 2;
                                        }
                                    }
                                }
                            }
                        }

                        if (!$inserted) {
                            $newMasterRows[] = $ir;
                        }
                    }
                }

                $currentDynamicFields['multi_rows'] = $newMasterRows;
                $dynamicFields = $currentDynamicFields;
            }

            $validated['dynamic_fields'] = $dynamicFields;
            $currentUser = $request->user();
            $oldDynamicFields = $task->dynamic_fields;
            dispatch(function () use ($task, $currentUser, $dynamicFields, $oldDynamicFields) {
                \App\Helpers\SheetLogger::log($task, $currentUser, $dynamicFields, $oldDynamicFields);
            })->afterResponse();
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

        // Paginate dynamic_fields['multi_rows'] to avoid returning a huge response payload (e.g. 10,500 rows)
        $dynamicFields = $task->dynamic_fields;
        if (is_array($dynamicFields) && isset($dynamicFields['multi_rows'])) {
            $multiRows = $dynamicFields['multi_rows'];
            $page = (int)$request->get('page', 1);
            $perPage = $request->get('per_page', 10);
            if ($perPage !== 'all' && $perPage !== 'All') {
                $perPage = (int)$perPage;
                $offset = ($page - 1) * $perPage;
                $paginatedRows = array_slice(array_values($multiRows), $offset, $perPage);
            } else {
                $paginatedRows = array_values($multiRows);
            }
            $dynamicFields['multi_rows'] = $paginatedRows;
            $task->dynamic_fields = $dynamicFields;
        }

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
            'url' => \App\Helpers\UploadHelper::resolveUrl($path),
            'path' => $path,
            'name' => $request->file('file')->getClientOriginalName(),
        ]);
    }
}