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

        if ($type === 'user') {
            return (string)$val === (string)$user->id;
        }
        if ($type === 'users') {
            return is_array($val) && in_array((string)$user->id, array_map('strval', $val));
        }
        if ($type === 'role') {
            $roleIds = $user->roles->pluck('id')->toArray();
            return in_array((string)$val, array_map('strval', $roleIds));
        }
        return false;
    }

    public function summary(Request $request): JsonResponse
    {
        $workTypeId = $request->query('work_type_id');
        $allocatedTo = $request->query('allocated_to') ?: $request->query('staff_id');
        $query = Task::query();
        if ($workTypeId) {
            $query->where('work_type_id', $workTypeId);
        }
        
        $staffUser = $allocatedTo ? User::with('roles')->find($allocatedTo) : null;
        if ($allocatedTo) {
            $query->where(function ($q) use ($allocatedTo) {
                $q->where('allocated_to', $allocatedTo)
                  ->orWhereNotNull('dynamic_fields');
            });
        }

        $tasks = $query->get();
        $total = 0;
        $pending = 0;
        $workInProgress = 0;
        $complete = 0;
        $notToBeDone = 0;
        $other = 0;

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
                if ($staffUser && !self::doesUserMatchRowAllocation($r, $staffUser)) {
                    continue;
                }

                $total++;
                $statusVal = strtolower($r['status'] ?? 'assigned');
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

        $filterUser = $allocatedToFilter ? \App\Models\User::find($allocatedToFilter) : null;

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
                } else {
                    $clientId = $row['client_id'] ?? null;
                    $workTypeId = $row['work_type_id'] ?? null;
                    $statusVal = $row['status'] ?? 'pending';
                    $allocatedToVal = $row['allocated_to'] ?? null;
                    $allocType = $row['allocated_type'] ?? 'user';
                    $dateAllocatedVal = $row['date_allocated'] ?? null;
                    $dateCompletedVal = $row['date_completed'] ?? null;
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
                $clientObj = $clientId ? $clients->get($clientId) : null;
                $workTypeObj = $workTypeId ? $workTypes->get($workTypeId) : null;

                // Resolve Assigned Name
                $allocatedName = 'Unassigned';
                if ($allocType === 'user' && $allocatedToVal) {
                    $uObj = $users->get($allocatedToVal);
                    $allocatedName = $uObj ? $uObj->name : 'Unassigned';
                } elseif ($allocType === 'users' && is_array($allocatedToVal)) {
                    $names = [];
                    foreach ($allocatedToVal as $uid) {
                        $uObj = $users->get($uid);
                        if ($uObj) $names[] = $uObj->name;
                    }
                    $allocatedName = !empty($names) ? implode(', ', $names) : 'Unassigned';
                } elseif ($allocType === 'role' && $allocatedToVal) {
                    $rObj = $roles->get($allocatedToVal);
                    $allocatedName = $rObj ? 'Dept: ' . $rObj->name : 'Unassigned';
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
                });
            })
            ->get();

        return TaskResource::collection($tasks);
    }
}
