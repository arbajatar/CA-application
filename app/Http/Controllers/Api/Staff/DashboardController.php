<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $now = now();

        $tasks = $user->assignedTasks();
        $now = now();

        return response()->json([
            'total_tasks' => (clone $tasks)->count(),
            'assigned' => (clone $tasks)->where('status', TaskStatus::Assigned->value)->count(),
            'in_progress' => (clone $tasks)->where('status', TaskStatus::InProgress->value)->count(),
            'awaiting_information' => (clone $tasks)->where('status', TaskStatus::AwaitingInformation->value)->count(),
            'completed' => (clone $tasks)->where('status', TaskStatus::Completed->value)->count(),
            'completed_this_month' => (clone $tasks)
                ->where('status', TaskStatus::Completed->value)
                ->whereMonth('date_completed', $now->month)
                ->whereYear('date_completed', $now->year)
                ->count(),
        ]);
    }
}