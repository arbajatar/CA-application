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

        return response()->json([
            'total_assigned' => (clone $tasks)->count(),
            'in_progress' => (clone $tasks)->where('status', TaskStatus::InProgress)->count(),
            'awaiting_information' => (clone $tasks)->where('status', TaskStatus::AwaitingInformation)->count(),
            'completed_this_month' => (clone $tasks)
                ->where('status', TaskStatus::Completed)
                ->whereMonth('date_completed', $now->month)
                ->whereYear('date_completed', $now->year)
                ->count(),
        ]);
    }
}