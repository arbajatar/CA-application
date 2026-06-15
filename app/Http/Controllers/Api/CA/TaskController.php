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
            ->when($request->filled('client_id'), function ($q) use ($request) {
                $clientId = $request->client_id;
                $q->where(function ($sub) use ($clientId) {
                    $sub->whereJsonContains('dynamic_fields->multi_rows', ['client_id' => $clientId])
                        ->orWhereJsonContains('dynamic_fields->multi_rows', ['client_id' => (string)$clientId])
                        ->orWhereJsonContains('dynamic_fields->multi_rows', ['client_id' => (int)$clientId]);
                });
            })
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

        $dynamicFields = $request->dynamic_fields;
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
            'work_type_id' => $request->work_type_id,
            'form_name' => $request->form_name,
            'date_inward' => $request->date_inward ?? now()->toDateString(),
            'allocated_to' => $request->allocated_to,
            'created_by' => $request->user()->id,
            'date_allocated' => $request->date_allocated ?? now()->toDateString(),
            'status' => $status,
            'remarks' => $request->remarks,
            'dynamic_fields' => $dynamicFields,
            'task_particular' => $request->task_particular,
            'sub_status' => $request->sub_status,
            'feedback' => $request->feedback,
            'entry_date' => $request->entry_date ?? now()->toDateString(),
            'allow_attachments' => $request->boolean('allow_attachments', false),
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

    public function show(Request $request, Task $task): JsonResponse
    {
        $task->load(['client', 'workType', 'assignedTo', 'createdBy', 'logs.changedBy', 'subTasks.assignedTo', 'permissions.role', 'notes.author']);

        $dynamicFields = $task->dynamic_fields;
        $multiRows = $dynamicFields['multi_rows'] ?? [];

        // Calculate status counts on the full dataset before filtering
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

        // 1. Filtering
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

                foreach ($colFilters as $colKey => $colVal) {
                    $colVal = trim($colVal);
                    if ($colVal === '') {
                        continue;
                    }
                    $colValLower = strtolower($colVal);
                    $multiRows = array_filter($multiRows, function($row) use ($colKey, $colValLower, $clientsFilterMap, $clientsPanFilterMap, $workTypesFilterMap, $staffFilterMap) {
                        if ($colKey === 'client_id') {
                            $cid = $row['client_id'] ?? null;
                            $name = $cid ? ($clientsFilterMap[$cid] ?? '') : '';
                            return strpos(strtolower($name), $colValLower) !== false;
                        }
                        if ($colKey === 'client_pan') {
                            $cid = $row['client_id'] ?? null;
                            $pan = $cid ? ($clientsPanFilterMap[$cid] ?? '') : '';
                            return strpos(strtolower($pan), $colValLower) !== false;
                        }
                        if ($colKey === 'work_type_id') {
                            $wtid = $row['work_type_id'] ?? null;
                            $name = $wtid ? ($workTypesFilterMap[$wtid] ?? '') : '';
                            return strpos(strtolower($name), $colValLower) !== false;
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
                            return strpos(strtolower($namesStr), $colValLower) !== false;
                        }
                        if ($colKey === 'date_allocated') {
                            $val = $row['date_allocated'] ?? '';
                            return strpos(strtolower($val), $colValLower) !== false;
                        }
                        if ($colKey === 'status') {
                            $val = $row['status'] ?? '';
                            return strpos(strtolower($val), $colValLower) !== false;
                        }
                        if ($colKey === 'sub_status') {
                            $val = $row['sub_status'] ?? $row['dynamic_data']['Sub Status'] ?? $row['dynamic_data']['static_sub_status'] ?? '';
                            return strpos(strtolower($val), $colValLower) !== false;
                        }
                        if ($colKey === 'remarks') {
                            $val = $row['remarks'] ?? '';
                            return strpos(strtolower($val), $colValLower) !== false;
                        }

                        $dynVal = $row['dynamic_data'][$colKey] ?? '';
                        if (is_array($dynVal)) {
                            foreach ($dynVal as $subVal) {
                                if (strpos(strtolower((string)$subVal), $colValLower) !== false) {
                                    return true;
                                }
                            }
                            return false;
                        }
                        return strpos(strtolower((string)$dynVal), $colValLower) !== false;
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

    public function update(UpdateTaskRequest $request, Task $task): JsonResponse
    {
        $oldStatus = $task->status;
        $validated = $request->validated();

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

                $masterRowsByRowId = [];
                foreach ($masterRows as $mr) {
                    $rowId = $mr['row_id'] ?? $mr['id'] ?? null;
                    if ($rowId) {
                        $masterRowsByRowId[$rowId] = $mr;
                    }
                }

                foreach ($incomingRows as $ir) {
                    $rowId = $ir['row_id'] ?? $ir['id'] ?? null;
                    if ($rowId) {
                        $masterRowsByRowId[$rowId] = $ir;
                    } else {
                        $newId = 'row_' . time() . '_' . rand(1000, 9999);
                        $ir['row_id'] = $newId;
                        $masterRowsByRowId[$newId] = $ir;
                    }
                }

                if ($request->has('deleted_row_ids')) {
                    $deletedIds = $request->input('deleted_row_ids');
                    if (is_array($deletedIds)) {
                        foreach ($deletedIds as $dId) {
                            unset($masterRowsByRowId[$dId]);
                        }
                    }
                }

                $currentDynamicFields['multi_rows'] = array_values($masterRowsByRowId);
                $dynamicFields = $currentDynamicFields;
            }

            $validated['dynamic_fields'] = $dynamicFields;
            \App\Helpers\SheetLogger::log($task, $request->user(), $dynamicFields);
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

    public function sheetLogs(Request $request): JsonResponse
    {
        $logs = \App\Models\SheetLog::with('user')
            ->when($request->filled('task_id'), fn($q) => $q->where('task_id', $request->task_id))
            ->latest()
            ->paginate(50);
            
        return response()->json($logs);
    }
}
