<?php

namespace App\Http\Controllers\Api\CA;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Enums\TaskStatus;
use App\Models\Client;
use App\Models\Task;
use App\Models\SubTask;
use App\Models\User;
use App\Http\Resources\TaskResource;
use App\Http\Resources\SubTaskResource;
use App\Http\Resources\UserResource;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DashboardController extends Controller
{
    private static function doesUserMatchRowAllocation($row, $user)
    {
        $type = $row['allocated_type'] ?? 'user';
        $val = $row['allocated_to'] ?? null;

        // If data is array but type is user, treat it as users
        if (is_array($val) && $type === 'user') {
            $type = 'users';
        }
        // If data is array but type is role, we might want to check intersection, but let's just do a basic check
        // Or if data is array but type is role, maybe they selected multiple roles
        
        if ($type === 'user') {
            if (is_array($val)) return false; // Fallback just in case
            return (string)$val === (string)$user->id;
        }
        if ($type === 'users') {
            return is_array($val) && in_array((string)$user->id, array_map('strval', $val));
        }
        if ($type === 'role') {
            $roleIds = $user->roles->pluck('id')->toArray();
            if (is_array($val)) {
                return count(array_intersect(array_map('strval', $roleIds), array_map('strval', $val))) > 0;
            }
            return in_array((string)$val, array_map('strval', $roleIds));
        }
        return false;
    }

    public function summary(Request $request): JsonResponse
    {
        $search = $request->query('search');
        $workTypeId = $request->query('work_type_id');
        $allocatedTo = $request->query('allocated_to') ?: $request->query('staff_id');
        
        $tasks = Task::latest()->get();

        $clients = \App\Models\Client::all()->keyBy('id');
        $workTypes = \App\Models\WorkType::all()->keyBy('id');
        $users = \App\Models\User::all()->keyBy('id');
        $roles = \App\Models\Role::all()->keyBy('id');

        $staffUser = ($allocatedTo && $allocatedTo !== 'unassigned') ? User::with('roles')->find($allocatedTo) : null;

        $total = 0;
        $pending = 0;
        $workInProgress = 0;
        $complete = 0;
        $notToBeDone = 0;
        $other = 0;

        foreach ($tasks as $task) {
            $multiRows = isset($task->dynamic_fields['multi_rows']) && is_array($task->dynamic_fields['multi_rows'])
                ? $task->dynamic_fields['multi_rows']
                : [null];

            foreach ($multiRows as $rowIndex => $row) {
                if ($row === null) {
                    $clientId = $task->client_id;
                    $workTypeIdVal = $task->work_type_id;
                    $statusVal = $task->status->value;
                    $allocatedToVal = $task->allocated_to;
                    $allocType = 'user';
                } else {
                    $clientId = $row['client_id'] ?? null;
                    $workTypeIdVal = $row['work_type_id'] ?? null;
                    $statusVal = $row['status'] ?? 'pending';
                    $allocatedToVal = $row['allocated_to'] ?? null;
                    $allocType = $row['allocated_type'] ?? 'user';
                }

                // Apply Work Type Filter
                if ($workTypeId && (string)$workTypeIdVal !== (string)$workTypeId) {
                    continue;
                }

                // Apply Allocated To Filter
                if ($allocatedTo === 'unassigned') {
                    $rowToCheck = $row ?? [
                        'allocated_to' => $allocatedToVal,
                        'allocated_type' => $allocType
                    ];
                    $val = $rowToCheck['allocated_to'] ?? null;
                    if (!empty($val) && (!is_array($val) || count($val) > 0)) {
                        continue;
                    }
                } elseif ($staffUser) {
                    $rowToCheck = $row ?? [
                        'allocated_to' => $allocatedToVal,
                        'allocated_type' => $allocType
                    ];
                    if (!self::doesUserMatchRowAllocation($rowToCheck, $staffUser)) {
                        continue;
                    }
                }

                // Resolve Client and Work Type
                $clientObj = ($clientId && is_scalar($clientId)) ? $clients->get($clientId) : null;
                $workTypeObj = ($workTypeIdVal && is_scalar($workTypeIdVal)) ? $workTypes->get($workTypeIdVal) : null;

                // Apply Search
                if ($search) {
                    $searchLower = strtolower($search);
                    $clientName = $clientObj ? strtolower($clientObj->name) : '';
                    $workTypeName = $workTypeObj ? strtolower($workTypeObj->name) : '';
                    $formName = strtolower($task->form_name ?? '');

                    if (
                        strpos($clientName, $searchLower) === false &&
                        strpos($workTypeName, $searchLower) === false &&
                        strpos($formName, $searchLower) === false
                    ) {
                        continue;
                    }
                }

                $total++;
                $statusVal = strtolower($statusVal ?? 'assigned');
                if ($statusVal === 'pending' || $statusVal === 'assigned' || empty($statusVal)) {
                    $pending++;
                } elseif ($statusVal === 'work_in_progress') {
                    $workInProgress++;
                } elseif ($statusVal === 'complete') {
                    $complete++;
                } elseif ($statusVal === 'not_to_be_done') {
                    $notToBeDone++;
                } else {
                    $other++;
                }
            }
        }

        return response()->json([
            'total_tasks' => $total,
            'pending_tasks' => $pending,
            'work_in_progress_tasks' => $workInProgress,
            'completed_tasks' => $complete,
            'not_to_be_done_tasks' => $notToBeDone,
            'other_tasks' => $other,
        ]);
    }

    public function staffSummary(): AnonymousResourceCollection
    {
        $staff = User::staff()->active()->with('roles')->get();
        $tasks = Task::select('id', 'allocated_to', 'status', 'dynamic_fields')->get();

        $stats = [];
        foreach ($staff as $s) {
            $stats[$s->id] = [
                'total' => 0,
                'pending' => 0,
                'work_in_progress' => 0,
                'complete' => 0,
                'not_to_be_done' => 0,
                'other' => 0,
            ];
        }

        foreach ($tasks as $task) {
            $taskRows = [];
            if (isset($task->dynamic_fields['multi_rows']) && is_array($task->dynamic_fields['multi_rows']) && !empty($task->dynamic_fields['multi_rows'])) {
                foreach ($task->dynamic_fields['multi_rows'] as $row) {
                    $taskRows[] = $row;
                }
            } else {
                $taskRows[] = [
                    'allocated_type' => 'user',
                    'allocated_to' => $task->allocated_to,
                    'status' => $task->status ? ($task->status instanceof TaskStatus ? $task->status->value : $task->status) : 'assigned',
                ];
            }

            foreach ($taskRows as $r) {
                foreach ($staff as $s) {
                    if (self::doesUserMatchRowAllocation($r, $s)) {
                        $stats[$s->id]['total']++;
                        $statusVal = strtolower($r['status'] ?? 'assigned');
                        if ($statusVal === 'pending' || $statusVal === 'assigned' || empty($statusVal)) {
                            $stats[$s->id]['pending']++;
                        } elseif ($statusVal === 'work_in_progress') {
                            $stats[$s->id]['work_in_progress']++;
                        } elseif ($s->id && $statusVal === 'complete') {
                            $stats[$s->id]['complete']++;
                        } elseif ($statusVal === 'not_to_be_done') {
                            $stats[$s->id]['not_to_be_done']++;
                        } else {
                            $stats[$s->id]['other']++;
                        }
                    }
                }
            }
        }

        foreach ($staff as $s) {
            $userStats = $stats[$s->id];
            $s->setAttribute('total', $userStats['total']);
            $s->setAttribute('pending', $userStats['pending']);
            $s->setAttribute('work_in_progress', $userStats['work_in_progress']);
            $s->setAttribute('complete', $userStats['complete']);
            $s->setAttribute('not_to_be_done', $userStats['not_to_be_done']);
            $s->setAttribute('other', $userStats['other']);
        }

        return UserResource::collection($staff);
    }

    public function tasks(Request $request): \Illuminate\Http\JsonResponse
    {
        $search = $request->get('search');
        $statusFilter = $request->get('status');
        $workTypeIdFilter = $request->get('work_type_id');
        $allocatedToFilter = $request->get('allocated_to');

        // Fetch all tasks (sheets)
        $tasks = Task::latest()->get();

        $clients = \App\Models\Client::all()->keyBy('id');
        $workTypes = \App\Models\WorkType::all()->keyBy('id');
        $users = \App\Models\User::all()->keyBy('id');
        $roles = \App\Models\Role::all()->keyBy('id');

        $filterUser = ($allocatedToFilter && $allocatedToFilter !== 'unassigned') ? \App\Models\User::find($allocatedToFilter) : null;

        $extracted = [];

        foreach ($tasks as $task) {
            $multiRows = isset($task->dynamic_fields['multi_rows']) && is_array($task->dynamic_fields['multi_rows'])
                ? $task->dynamic_fields['multi_rows']
                : [null]; // fallback for legacy single-row task sheet

            foreach ($multiRows as $rowIndex => $row) {
                // If it is legacy (no row data), we map from task level properties
                if ($row === null) {
                    $clientId = $task->client_id;
                    $workTypeId = $task->work_type_id;
                    $statusVal = $task->status->value;
                    $allocatedToVal = $task->allocated_to;
                    $allocType = 'user';
                    $dateAllocatedVal = $task->date_allocated?->toDateString();
                    $dateCompletedVal = $task->date_completed?->toDateString();
                    $dueDateVal = $task->due_date?->toDateString();
                } else {
                    $clientId = $row['client_id'] ?? null;
                    $workTypeId = $row['work_type_id'] ?? null;
                    $statusVal = $row['status'] ?? 'pending';
                    $allocatedToVal = $row['allocated_to'] ?? null;
                    $allocType = $row['allocated_type'] ?? 'user';
                    $dateAllocatedVal = $row['date_allocated'] ?? null;
                    $dateCompletedVal = $row['date_completed'] ?? null;
                    $dueDateVal = $row['due_date'] ?? $row['dynamic_data']['Due Date'] ?? $row['dynamic_data']['due_date'] ?? null;
                }

                // Apply Filters
                // 1. Status Filter
                if ($statusFilter && $statusVal !== $statusFilter) {
                    continue;
                }

                // 2. Work Type Filter
                if ($workTypeIdFilter && (string)$workTypeId !== (string)$workTypeIdFilter) {
                    continue;
                }

                // 3. Allocated To Filter
                if ($allocatedToFilter === 'unassigned') {
                    $rowToCheck = $row ?? [
                        'allocated_to' => $allocatedToVal,
                        'allocated_type' => $allocType
                    ];
                    $val = $rowToCheck['allocated_to'] ?? null;
                    if (!empty($val) && (!is_array($val) || count($val) > 0)) {
                        continue;
                    }
                } elseif ($filterUser) {
                    $rowToCheck = $row ?? [
                        'allocated_to' => $allocatedToVal,
                        'allocated_type' => $allocType
                    ];
                    if (!self::doesUserMatchRowAllocation($rowToCheck, $filterUser)) {
                        continue;
                    }
                }

                // Resolve Client and Work Type
                $clientObj = ($clientId && is_scalar($clientId)) ? $clients->get($clientId) : null;
                $workTypeObj = ($workTypeId && is_scalar($workTypeId)) ? $workTypes->get($workTypeId) : null;

                // If data is array but type is user, treat it as users
                if ($allocType === 'user' && is_array($allocatedToVal)) {
                    $allocType = 'users';
                }

                // Resolve Assigned Name
                $allocatedName = 'Unassigned';
                if ($allocType === 'user' && $allocatedToVal && is_scalar($allocatedToVal)) {
                    $uObj = $users->get($allocatedToVal);
                    $allocatedName = $uObj ? $uObj->name : 'Unassigned';
                } elseif ($allocType === 'users' && is_array($allocatedToVal)) {
                    $names = [];
                    foreach ($allocatedToVal as $uid) {
                        if (is_scalar($uid)) {
                            $uObj = $users->get($uid);
                            if ($uObj) $names[] = $uObj->name;
                        }
                    }
                    $allocatedName = !empty($names) ? implode(', ', $names) : 'Unassigned';
                } elseif ($allocType === 'role' && $allocatedToVal) {
                    if (is_array($allocatedToVal)) {
                        $names = [];
                        foreach ($allocatedToVal as $rid) {
                            if (is_scalar($rid)) {
                                $rObj = $roles->get($rid);
                                if ($rObj) $names[] = 'Dept: ' . $rObj->name;
                            }
                        }
                        $allocatedName = !empty($names) ? implode(', ', $names) : 'Unassigned';
                    } else if (is_scalar($allocatedToVal)) {
                        $rObj = $roles->get($allocatedToVal);
                        $allocatedName = $rObj ? 'Dept: ' . $rObj->name : 'Unassigned';
                    }
                }

                // Apply Search
                if ($search) {
                    $searchLower = strtolower($search);
                    $clientName = $clientObj ? strtolower($clientObj->name) : '';
                    $workTypeName = $workTypeObj ? strtolower($workTypeObj->name) : '';
                    $formName = strtolower($task->form_name ?? '');

                    if (
                        strpos($clientName, $searchLower) === false &&
                        strpos($workTypeName, $searchLower) === false &&
                        strpos($formName, $searchLower) === false
                    ) {
                        continue;
                    }
                }

                $extracted[] = [
                    'id' => $task->id,
                    'unique_id' => $task->id . '_' . ($row === null ? 'legacy' : $rowIndex),
                    'client' => $clientObj ? [
                        'id' => $clientObj->id,
                        'name' => $clientObj->name,
                        'contact' => $clientObj->contact,
                    ] : null,
                    'work_type' => $workTypeObj ? [
                        'id' => $workTypeObj->id,
                        'name' => $workTypeObj->name,
                    ] : null,
                    'allocated_to' => [
                        'id' => $allocatedToVal,
                        'name' => $allocatedName,
                    ],
                    'date_inward' => $task->date_inward?->toDateString(),
                    'date_allocated' => $dateAllocatedVal,
                    'date_completed' => $dateCompletedVal,
                    'due_date' => $dueDateVal,
                    'status' => $statusVal,
                    'status_label' => ucfirst(str_replace('_', ' ', $statusVal)),
                    'form_name' => $task->form_name,
                ];
            }
        }

        // Paginate in memory
        $perPage = $request->get('per_page', 10);
        $page = \Illuminate\Pagination\Paginator::resolveCurrentPage() ?: 1;
        $total = count($extracted);
        $paginatedItems = array_slice($extracted, ($page - 1) * $perPage, $perPage);

        return response()->json([
            'data' => $paginatedItems,
            'meta' => [
                'current_page' => (int)$page,
                'from' => $total > 0 ? (($page - 1) * $perPage + 1) : null,
                'last_page' => (int)ceil($total / $perPage),
                'path' => $request->url(),
                'per_page' => (int)$perPage,
                'to' => $total > 0 ? min($page * $perPage, $total) : null,
                'total' => $total,
            ]
        ]);
    }

    public function workTypeSubtasks(Request $request): AnonymousResourceCollection
    {
        $request->validate(['work_type_id' => 'required|exists:work_types,id']);
        $workTypeId = $request->work_type_id;

        $tasksQuery = Task::with(['client', 'workType', 'assignedTo', 'subTasks.assignedTo'])
            ->where('work_type_id', $workTypeId);

        // Calculate global subtask stats across all tasks of this work type
        $subtasksQuery = SubTask::whereHas('task', fn($q) => $q->where('work_type_id', $workTypeId));
        
        $total = (clone $subtasksQuery)->count();
        $pending = (clone $subtasksQuery)->where('status', TaskStatus::Pending->value)->count();
        $workInProgress = (clone $subtasksQuery)->where('status', TaskStatus::WorkInProgress->value)->count();
        $complete = (clone $subtasksQuery)->where('status', TaskStatus::Complete->value)->count();
        $notToBeDone = (clone $subtasksQuery)->where('status', TaskStatus::NotToBeDone->value)->count();
        $other = (clone $subtasksQuery)->where('status', TaskStatus::Other->value)->count();

        $tasks = $tasksQuery->latest()->paginate($request->get('per_page', 10));

        return TaskResource::collection($tasks)->additional([
            'summary' => [
                'total' => $total,
                'pending' => $pending,
                'work_in_progress' => $workInProgress,
                'complete' => $complete,
                'not_to_be_done' => $notToBeDone,
                'other' => $other,
            ]
        ]);
    }

    public function calendarTasks(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'month' => 'required|integer|min:1|max:12',
            'year' => 'required|integer|min:2000',
        ]);

        $tasks = Task::with(['client', 'workType', 'assignedTo', 'subTasks.assignedTo'])
            ->where(function($query) use ($request) {
                $query->where(function($q) use ($request) {
                    $q->whereNotNull('due_date')
                      ->whereMonth('due_date', $request->month)
                      ->whereYear('due_date', $request->year);
                })
                ->orWhereHas('subTasks', function($q) use ($request) {
                    $q->whereNotNull('due_date')
                      ->whereMonth('due_date', $request->month)
                      ->whereYear('due_date', $request->year);
                })
                ->orWhereNotNull('dynamic_fields');
            })
            ->get();

        // Filter tasks that actually contain at least one row in multi_rows with a due date matching requested month and year,
        // or have task level/subtask level matching due date.
        $filtered = $tasks->filter(function($task) use ($request) {
            $hasTaskDueDate = $task->due_date && $task->due_date->month == $request->month && $task->due_date->year == $request->year;
            $hasSubTaskDueDate = $task->subTasks->contains(fn($st) => $st->due_date && $st->due_date->month == $request->month && $st->due_date->year == $request->year);
            
            $hasDynamicRowDueDate = false;
            if (isset($task->dynamic_fields['multi_rows']) && is_array($task->dynamic_fields['multi_rows'])) {
                foreach ($task->dynamic_fields['multi_rows'] as $row) {
                    $dateVal = $row['due_date'] ?? $row['dynamic_data']['Due Date'] ?? $row['dynamic_data']['due_date'] ?? null;
                    if (!empty($dateVal)) {
                        try {
                            // check if format is d-m-Y (e.g. contains '-' and day is first)
                            if (strpos($dateVal, '-') !== false) {
                                $parts = explode('-', $dateVal);
                                if (count($parts) === 3 && strlen($parts[2]) === 4) {
                                    $parsed = \Carbon\Carbon::createFromFormat('d-m-Y', $dateVal);
                                } else {
                                    $parsed = \Carbon\Carbon::parse($dateVal);
                                }
                            } else {
                                $parsed = \Carbon\Carbon::parse($dateVal);
                            }
                            if ($parsed->month == $request->month && $parsed->year == $request->year) {
                                $hasDynamicRowDueDate = true;
                                break;
                            }
                        } catch (\Exception $e) {}
                    }
                }
            }

            return $hasTaskDueDate || $hasSubTaskDueDate || $hasDynamicRowDueDate;
        });

        return TaskResource::collection($filtered);
    }
}
