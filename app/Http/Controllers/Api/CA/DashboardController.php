<?php

namespace App\Http\Controllers\Api\CA;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Enums\TaskStatus;
use App\Models\Client;
use App\Models\Task;
use App\Models\User;
use App\Http\Resources\TaskResource;
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
}
