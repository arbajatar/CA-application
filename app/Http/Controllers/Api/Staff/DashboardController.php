<?php

namespace App\Http\Controllers\Api\Staff;

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

    private static function doesUserHaveAccessToTask($task, $user)
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

    public function summary(Request $request): JsonResponse
    {
        $search = $request->query('search');
        $workTypeId = $request->query('work_type_id');
        $allocatedTo = $request->query('allocated_to') ?: $request->query('staff_id');

        if (!$allocatedTo && $request->user() && $request->user()->role->value === 'staff') {
            $allocatedTo = $request->user()->id;
        }
        
        $tasks = Task::latest()->get();

        $clients = Client::all()->keyBy('id');
        $workTypes = \App\Models\WorkType::all()->keyBy('id');
        $users = User::all()->keyBy('id');
        $roles = \App\Models\Role::all()->keyBy('id');

        $staffUser = $allocatedTo ? User::with('roles')->find($allocatedTo) : null;

        $totalTasks = 0;
        $pendingTasks = 0;
        $workInProgressTasks = 0;
        $completeTasks = 0;
        $notToBeDoneTasks = 0;
        $otherTasks = 0;

        $totalSheets = 0;
        $pendingSheets = 0;
        $workInProgressSheets = 0;
        $completeSheets = 0;
        $notToBeDoneSheets = 0;
        $otherSheets = 0;

        foreach ($tasks as $task) {
            // Apply access filter first if staff user is present
            if ($staffUser && !self::doesUserHaveAccessToTask($task, $staffUser)) {
                continue;
            }

            // Apply Work Type Filter
            if ($workTypeId && (string)$task->work_type_id !== (string)$workTypeId) {
                continue;
            }

            // Apply Search
            if ($search) {
                $searchLower = strtolower($search);
                $clientName = $task->client ? strtolower($task->client->name) : '';
                $workTypeName = $task->workType ? strtolower($task->workType->name) : '';
                $formName = strtolower($task->form_name ?? '');

                if (
                    strpos($clientName, $searchLower) === false &&
                    strpos($workTypeName, $searchLower) === false &&
                    strpos($formName, $searchLower) === false
                ) {
                    continue;
                }
            }

            // Sheet-wise count
            $totalSheets++;
            $statusVal = strtolower($task->status->value ?? 'pending');
            if ($statusVal === 'pending' || $statusVal === 'assigned' || empty($statusVal)) {
                $pendingSheets++;
            } elseif ($statusVal === 'work_in_progress') {
                $workInProgressSheets++;
            } elseif ($statusVal === 'complete') {
                $completeSheets++;
            } elseif ($statusVal === 'not_to_be_done') {
                $notToBeDoneSheets++;
            } else {
                $otherSheets++;
            }

            // Task-wise count (based on row allocations)
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
                if ($staffUser && !self::doesUserMatchRowAllocation($r, $staffUser)) {
                    continue;
                }

                $totalTasks++;
                $statusVal = strtolower($r['status'] ?? 'assigned');
                if ($statusVal === 'pending' || $statusVal === 'assigned' || empty($statusVal)) {
                    $pendingTasks++;
                } elseif ($statusVal === 'work_in_progress') {
                    $workInProgressTasks++;
                } elseif ($statusVal === 'complete') {
                    $completeTasks++;
                } elseif ($statusVal === 'not_to_be_done') {
                    $notToBeDoneTasks++;
                } else {
                    $otherTasks++;
                }
            }
        }

        return response()->json([
            'total_tasks' => $totalTasks,
            'pending_tasks' => $pendingTasks,
            'work_in_progress_tasks' => $workInProgressTasks,
            'completed_tasks' => $completeTasks,
            'not_to_be_done_tasks' => $notToBeDoneTasks,
            'other_tasks' => $otherTasks,
            
            // Also return in *_sheets format expected by My Sheets page
            'total_sheets' => $totalSheets,
            'pending_sheets' => $pendingSheets,
            'work_in_progress_sheets' => $workInProgressSheets,
            'complete_sheets' => $completeSheets,
            'not_to_be_done_sheets' => $notToBeDoneSheets,
            'other_sheets' => $otherSheets,
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

        $tasks = Task::latest()->get();

        $clients = Client::all()->keyBy('id');
        $workTypes = \App\Models\WorkType::all()->keyBy('id');
        $users = User::all()->keyBy('id');
        $roles = \App\Models\Role::all()->keyBy('id');

        $filterUser = $allocatedToFilter ? User::find($allocatedToFilter) : null;

        $extracted = [];

        foreach ($tasks as $task) {
            $multiRows = isset($task->dynamic_fields['multi_rows']) && is_array($task->dynamic_fields['multi_rows'])
                ? $task->dynamic_fields['multi_rows']
                : [null];

            foreach ($multiRows as $rowIndex => $row) {
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
                if ($statusFilter && $statusVal !== $statusFilter) {
                    continue;
                }

                if ($workTypeIdFilter && (string)$workTypeId !== (string)$workTypeIdFilter) {
                    continue;
                }

                if ($filterUser) {
                    $rowToCheck = $row ?? [
                        'allocated_to' => $allocatedToVal,
                        'allocated_type' => $allocType
                    ];
                    if (!self::doesUserMatchRowAllocation($rowToCheck, $filterUser)) {
                        continue;
                    }
                }

                $clientObj = ($clientId && is_scalar($clientId)) ? $clients->get($clientId) : null;
                $workTypeObj = ($workTypeId && is_scalar($workTypeId)) ? $workTypes->get($workTypeId) : null;

                if ($allocType === 'user' && is_array($allocatedToVal)) {
                    $allocType = 'users';
                }

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

        $filtered = $tasks->filter(function($task) use ($request) {
            $hasTaskDueDate = $task->due_date && $task->due_date->month == $request->month && $task->due_date->year == $request->year;
            $hasSubTaskDueDate = $task->subTasks->contains(fn($st) => $st->due_date && $st->due_date->month == $request->month && $st->due_date->year == $request->year);
            
            $hasDynamicRowDueDate = false;
            if (isset($task->dynamic_fields['multi_rows']) && is_array($task->dynamic_fields['multi_rows'])) {
                foreach ($task->dynamic_fields['multi_rows'] as $row) {
                    $dateVal = $row['due_date'] ?? $row['dynamic_data']['Due Date'] ?? $row['dynamic_data']['due_date'] ?? null;
                    if (!empty($dateVal)) {
                        try {
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