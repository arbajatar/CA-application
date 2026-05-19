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
    public function summary(): JsonResponse
    {
        $now = now();
        return response()->json([
            'total_clients' => Client::active()->count(),
            'total_tasks' => Task::count(),
            'active_tasks' => Task::whereIn('status', [
                TaskStatus::Assigned,
                TaskStatus::InProgress,
                TaskStatus::AwaitingInformation
            ])->count(),
            'completed_this_month' => Task::where('status', TaskStatus::Completed)
                ->whereMonth('date_completed', $now->month)
                ->whereYear('date_completed', $now->year)
                ->count(),
            'total_staff' => User::staff()->active()->count(),
        ]);
    }

    public function staffSummary(): AnonymousResourceCollection
    {
        $staff = User::staff()
            ->active()
            ->withCount([
                'assignedTasks as total',
                'assignedTasks as assigned' => fn($q) => $q->where('status', TaskStatus::Assigned),
                'assignedTasks as in_progress' => fn($q) => $q->where('status', TaskStatus::InProgress),
                'assignedTasks as awaiting_information' => fn($q) => $q->where('status', TaskStatus::AwaitingInformation),
                'assignedTasks as completed' => fn($q) => $q->where('status', TaskStatus::Completed),
            ])
            ->get();

        return UserResource::collection($staff);
    }

    public function tasks(Request $request): AnonymousResourceCollection
    {
        $tasks = Task::with(['client', 'workType', 'assignedTo'])
            ->when($request->search, function ($q) use ($request) {
                $q->whereHas('client', fn($cq) => $cq->where('name', 'like', "%{$request->search}%"))
                    ->orWhereHas('workType', fn($wq) => $wq->where('name', 'like', "%{$request->search}%"));
            })
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->latest()
            ->paginate($request->get('per_page', 10));

        return TaskResource::collection($tasks);
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
        $completed = (clone $subtasksQuery)->where('status', TaskStatus::Completed)->count();
        $inProgress = (clone $subtasksQuery)->where('status', TaskStatus::InProgress)->count();
        $remaining = (clone $subtasksQuery)->where('status', '!=', TaskStatus::Completed)->count();

        $tasks = $tasksQuery->latest()->paginate($request->get('per_page', 10));

        return TaskResource::collection($tasks)->additional([
            'summary' => [
                'total' => $total,
                'completed' => $completed,
                'in_progress' => $inProgress,
                'remaining' => $remaining,
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
