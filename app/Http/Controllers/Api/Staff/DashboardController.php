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
            'total_tasks'         => (clone $tasks)->count(),
            'pending'             => (clone $tasks)->where('status', TaskStatus::Pending->value)->count(),
            'work_in_progress'    => (clone $tasks)->where('status', TaskStatus::WorkInProgress->value)->count(),
            'complete'            => (clone $tasks)->where('status', TaskStatus::Complete->value)->count(),
            'not_to_be_done'      => (clone $tasks)->where('status', TaskStatus::NotToBeDone->value)->count(),
            'other'               => (clone $tasks)->where('status', TaskStatus::Other->value)->count(),
            'completed_this_month' => (clone $tasks)
                ->where('status', TaskStatus::Complete->value)
                ->whereMonth('date_completed', $now->month)
                ->whereYear('date_completed', $now->year)
                ->count(),
        ]);
    }
}