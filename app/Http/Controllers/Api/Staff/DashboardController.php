<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

use App\Http\Resources\TaskResource;
use App\Http\Resources\UserResource;
use App\Models\Task;
use App\Models\SubTask;
use App\Models\User;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DashboardController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $now = now();

        $search = $request->get('search');
        $workTypeIdFilter = $request->get('work_type_id');
        $allocatedToFilter = $request->get('allocated_to');

        $tasksQuery = Task::where(function ($query) use ($user) {
                $roleIds = $user->roles()->pluck('roles.id')->toArray();
                $query->where('allocated_to', $user->id)
                      ->orWhereNotNull('dynamic_fields')
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
            });

        $tasks = $tasksQuery->get();

        // 1. Filter sheets the logged-in staff can read/access
        $filteredSheets = $tasks->filter(function ($task) use ($user) {
            return \App\Http\Controllers\Api\Staff\TaskController::doesUserHaveAccessToTask($task, $user);
        });

        $clients = \App\Models\Client::all()->keyBy('id');
        $workTypes = \App\Models\WorkType::all()->keyBy('id');
        $users = \App\Models\User::all()->keyBy('id');
        $roles = \App\Models\Role::all()->keyBy('id');

        $filterUser = $allocatedToFilter ? \App\Models\User::find($allocatedToFilter) : null;

        $total = 0;
        $pending = 0;
        $workInProgress = 0;
        $complete = 0;
        $notToBeDone = 0;
        $other = 0;
        $completedThisMonth = 0;

        $sheetsTotal = 0;
        $sheetsPending = 0;
        $sheetsWorkInProgress = 0;
        $sheetsComplete = 0;
        $sheetsNotToBeDone = 0;
        $sheetsOther = 0;

        foreach ($filteredSheets as $task) {
            $multiRows = isset($task->dynamic_fields['multi_rows']) && is_array($task->dynamic_fields['multi_rows'])
                ? $task->dynamic_fields['multi_rows']
                : [null];

            $hasMatchingRows = false;
            $rowMatchesList = [];

            foreach ($multiRows as $rowIndex => $row) {
                if ($row === null) {
                    $clientId = $task->client_id;
                    $workTypeId = $task->work_type_id;
                    $statusVal = $task->status->value;
                    $allocatedToVal = $task->allocated_to;
                    $allocType = 'user';
                } else {
                    $clientId = $row['client_id'] ?? null;
                    $workTypeId = $row['work_type_id'] ?? null;
                    $statusVal = $row['status'] ?? 'pending';
                    $allocatedToVal = $row['allocated_to'] ?? null;
                    $allocType = $row['allocated_type'] ?? 'user';
                }

                // Apply Work Type Filter
                if ($workTypeIdFilter && (string)$workTypeId !== (string)$workTypeIdFilter) {
                    continue;
                }

                // Apply Allocated To Filter
                if ($filterUser) {
                    $rowToCheck = $row ?? [
                        'allocated_to' => $allocatedToVal,
                        'allocated_type' => $allocType
                    ];
                    if (!\App\Http\Controllers\Api\Staff\TaskController::doesUserMatchRowAllocation($rowToCheck, $filterUser)) {
                        continue;
                    }
                }

                // Resolve Client and Work Type
                $clientObj = ($clientId && is_scalar($clientId)) ? $clients->get($clientId) : null;
                $workTypeObj = ($workTypeId && is_scalar($workTypeId)) ? $workTypes->get($workTypeId) : null;

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

                // If we got here, this row matches the filters!
                $hasMatchingRows = true;
                $rowMatchesList[] = $statusVal;
            }

            if ($hasMatchingRows) {
                // Calculate Sheet Counts (parent tasks)
                $sheetsTotal++;
                $sheetStatusVal = strtolower($task->status ? ($task->status instanceof TaskStatus ? $task->status->value : $task->status) : 'assigned');
                if ($sheetStatusVal === 'pending' || $sheetStatusVal === 'assigned' || empty($sheetStatusVal)) {
                    $sheetsPending++;
                } elseif ($sheetStatusVal === 'work_in_progress') {
                    $sheetsWorkInProgress++;
                } elseif ($sheetStatusVal === 'complete') {
                    $sheetsComplete++;
                } elseif ($sheetStatusVal === 'not_to_be_done') {
                    $sheetsNotToBeDone++;
                } else {
                    $sheetsOther++;
                }

                // Calculate Row Counts (dynamic rows inside sheets)
                foreach ($rowMatchesList as $rStatus) {
                    $total++;
                    $statusVal = strtolower($rStatus ?? 'assigned');
                    if ($statusVal === 'pending' || $statusVal === 'assigned' || empty($statusVal)) {
                        $pending++;
                    } elseif ($statusVal === 'work_in_progress') {
                        $workInProgress++;
                    } elseif ($statusVal === 'complete') {
                        $complete++;
                        if ($task->date_completed) {
                            $tcDate = \Carbon\Carbon::parse($task->date_completed);
                            if ($tcDate->month === $now->month && $tcDate->year === $now->year) {
                                $completedThisMonth++;
                            }
                        }
                    } elseif ($statusVal === 'not_to_be_done') {
                        $notToBeDone++;
                    } else {
                        $other++;
                    }
                }
            }
        }

        $workTypes = \App\Models\WorkType::whereHas('tasks', function ($tq) use ($user) {
            $tq->where(function ($query) use ($user) {
                $query->where('allocated_to', $user->id)
                      ->orWhereNotNull('dynamic_fields');
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
            });
        })->get()->filter(function($wt) use ($user) {
            $hasTaskWithRow = Task::where('work_type_id', $wt->id)
                ->where(function ($query) use ($user) {
                    $query->where('allocated_to', $user->id)
                          ->orWhereNotNull('dynamic_fields');
                })->get()->contains(function($task) use ($user) {
                    return \App\Http\Controllers\Api\Staff\TaskController::doesUserHaveAccessToTask($task, $user);
                });
            return $hasTaskWithRow;
        })->values();

        return response()->json([
            'total_tasks'             => $total,
            'pending_tasks'           => $pending,
            'work_in_progress_tasks'  => $workInProgress,
            'completed_tasks'         => $complete,
            'not_to_be_done_tasks'    => $notToBeDone,
            'other_tasks'             => $other,
            
            // Sheet counts
            'total_sheets'             => $sheetsTotal,
            'pending_sheets'           => $sheetsPending,
            'work_in_progress_sheets'  => $sheetsWorkInProgress,
            'complete_sheets'          => $sheetsComplete,
            'not_to_be_done_sheets'    => $sheetsNotToBeDone,
            'other_sheets'             => $sheetsOther,

            // Backward compatibility
            'pending'                 => $pending,
            'work_in_progress'        => $workInProgress,
            'complete'                => $complete,
            'not_to_be_done'          => $notToBeDone,
            'other'                   => $other,
            'completed_this_month'    => $completedThisMonth,
            'work_types'              => $workTypes,
        ]);
    }

    public function tasks(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        $search = $request->get('search');
        $statusFilter = $request->get('status');
        $workTypeIdFilter = $request->get('work_type_id');
        $allocatedToFilter = $request->get('allocated_to');

        // Fetch tasks with query filters, then filter by staff access in memory
        $tasksQuery = Task::where(function ($query) use ($user) {
                $roleIds = $user->roles()->pluck('roles.id')->toArray();
                $query->where('allocated_to', $user->id)
                      ->orWhereNotNull('dynamic_fields')
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
            ->latest();

        $allTasks = $tasksQuery->get();

        // 1. Filter sheets the logged-in staff can read/access
        $filteredSheets = $allTasks->filter(function ($task) use ($user) {
            return \App\Http\Controllers\Api\Staff\TaskController::doesUserHaveAccessToTask($task, $user);
        });

        $clients = \App\Models\Client::all()->keyBy('id');
        $workTypes = \App\Models\WorkType::all()->keyBy('id');
        $users = \App\Models\User::all()->keyBy('id');
        $roles = \App\Models\Role::all()->keyBy('id');

        $filterUser = $allocatedToFilter ? \App\Models\User::find($allocatedToFilter) : null;

        $extracted = [];

        foreach ($filteredSheets as $task) {
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
                if ($filterUser) {
                    $rowToCheck = $row ?? [
                        'allocated_to' => $allocatedToVal,
                        'allocated_type' => $allocType
                    ];
                    if (!\App\Http\Controllers\Api\Staff\TaskController::doesUserMatchRowAllocation($rowToCheck, $filterUser)) {
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

    public function calendarTasks(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'month' => 'required|integer|min:1|max:12',
            'year' => 'required|integer|min:2000',
        ]);

        $user = $request->user();

        $tasks = Task::with(['client', 'workType', 'assignedTo', 'subTasks.assignedTo'])
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

        $filteredTasks = $tasks->filter(function ($task) use ($user, $request) {
            if (!\App\Http\Controllers\Api\Staff\TaskController::doesUserHaveAccessToTask($task, $user)) {
                return false;
            }

            $perms = (new TaskResource($task))->getUserPermissions($user);
            $hasGlobalRead = $perms['can_read'];

            $hasTaskDueDate = $task->due_date && $task->due_date->month == $request->month && $task->due_date->year == $request->year;
            if (!$hasGlobalRead && $task->allocated_to != $user->id) {
                $hasTaskDueDate = false;
            }

            $hasSubTaskDueDate = $task->subTasks->contains(function($st) use ($user, $request, $hasGlobalRead) {
                if (!$hasGlobalRead && $st->assigned_to != $user->id) {
                    return false;
                }
                return $st->due_date && $st->due_date->month == $request->month && $st->due_date->year == $request->year;
            });
            
            $hasDynamicRowDueDate = false;
            if (isset($task->dynamic_fields['multi_rows']) && is_array($task->dynamic_fields['multi_rows'])) {
                foreach ($task->dynamic_fields['multi_rows'] as $row) {
                    if ($hasGlobalRead || self::doesUserMatchRowAllocation($row, $user)) {
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
            }

            return $hasTaskDueDate || $hasSubTaskDueDate || $hasDynamicRowDueDate;
        });

        return TaskResource::collection($filteredTasks);
    }

    private static function doesUserMatchRowAllocation($row, $user)
    {
        $type = $row['allocated_type'] ?? 'user';
        $val = $row['allocated_to'] ?? null;

        if (is_array($val) && $type === 'user') {
            $type = 'users';
        }
        
        if ($type === 'user') {
            if (is_array($val)) return false;
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

    public function staffSummary(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $staff = User::staff()->active()->where('id', $user->id)->with('roles')->get();
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
}