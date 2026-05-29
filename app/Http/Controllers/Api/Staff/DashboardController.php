<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Models\SubTask;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DashboardController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $now = now();

        $tasks = $user->assignedTasks()
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

        $workTypes = \App\Models\WorkType::whereHas('tasks', function ($tq) use ($user) {
            $tq->where('allocated_to', $user->id)
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
        })->get();

        return response()->json([
            'total_tasks'             => (clone $tasks)->count(),
            'pending_tasks'           => (clone $tasks)->where('status', TaskStatus::Pending->value)->count(),
            'work_in_progress_tasks'  => (clone $tasks)->where('status', TaskStatus::WorkInProgress->value)->count(),
            'completed_tasks'         => (clone $tasks)->where('status', TaskStatus::Complete->value)->count(),
            'not_to_be_done_tasks'    => (clone $tasks)->where('status', TaskStatus::NotToBeDone->value)->count(),
            'other_tasks'             => (clone $tasks)->where('status', TaskStatus::Other->value)->count(),
            
            // Backward compatibility
            'pending'                 => (clone $tasks)->where('status', TaskStatus::Pending->value)->count(),
            'work_in_progress'        => (clone $tasks)->where('status', TaskStatus::WorkInProgress->value)->count(),
            'complete'                => (clone $tasks)->where('status', TaskStatus::Complete->value)->count(),
            'not_to_be_done'          => (clone $tasks)->where('status', TaskStatus::NotToBeDone->value)->count(),
            'other'                   => (clone $tasks)->where('status', TaskStatus::Other->value)->count(),
            'completed_this_month'    => (clone $tasks)
                ->where('status', TaskStatus::Complete->value)
                ->whereMonth('date_completed', $now->month)
                ->whereYear('date_completed', $now->year)
                ->count(),
            'work_types'              => $workTypes,
        ]);
    }

    public function tasks(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $tasks = $user->assignedTasks()
            ->with(['client', 'workType', 'assignedTo'])
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
            ->when($request->search, function ($q) use ($request) {
                $q->where(function($query) use ($request) {
                    $query->whereHas('client', fn($cq) => $cq->where('name', 'like', "%{$request->search}%"))
                          ->orWhereHas('workType', fn($wq) => $wq->where('name', 'like', "%{$request->search}%"));
                });
            })
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->when($request->work_type_id, fn($q) => $q->where('work_type_id', $request->work_type_id))
            ->when($request->allocated_to, fn($q) => $q->where('allocated_to', $request->allocated_to))
            ->latest()
            ->paginate($request->get('per_page', 10));

        return TaskResource::collection($tasks);
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
            ->where(function($query) use ($user) {
                $query->where('allocated_to', $user->id)
                      ->orWhereHas('subTasks', fn($q) => $q->where('assigned_to', $user->id));
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
                });
            })
            ->get();

        return TaskResource::collection($tasks);
    }
}