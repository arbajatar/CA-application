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
    public function summary(Request $request): JsonResponse
    {
        $workTypeId = $request->query('work_type_id');
        $query = Task::query();
        if ($workTypeId) {
            $query->where('work_type_id', $workTypeId);
        }

        return response()->json([
            'total_tasks' => (clone $query)->count(),
            'pending_tasks' => (clone $query)->where('status', TaskStatus::Pending)->count(),
            'work_in_progress_tasks' => (clone $query)->where('status', TaskStatus::WorkInProgress)->count(),
            'completed_tasks' => (clone $query)->where('status', TaskStatus::Complete)->count(),
            'not_to_be_done_tasks' => (clone $query)->where('status', TaskStatus::NotToBeDone)->count(),
            'other_tasks' => (clone $query)->where('status', TaskStatus::Other)->count(),
        ]);
    }

    public function staffSummary(): AnonymousResourceCollection
    {
        $staff = User::staff()
            ->active()
            ->with('roles')
            ->withCount([
                'assignedTasks as total',
                'assignedTasks as pending'           => fn($q) => $q->where('status', TaskStatus::Pending),
                'assignedTasks as work_in_progress'  => fn($q) => $q->where('status', TaskStatus::WorkInProgress),
                'assignedTasks as complete'          => fn($q) => $q->where('status', TaskStatus::Complete),
                'assignedTasks as not_to_be_done'    => fn($q) => $q->where('status', TaskStatus::NotToBeDone),
                'assignedTasks as other'             => fn($q) => $q->where('status', TaskStatus::Other),
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
