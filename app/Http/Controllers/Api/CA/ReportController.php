<?php

namespace App\Http\Controllers\Api\CA;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\SubTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\Carbon;

class ReportController extends Controller
{
    public function timesheet(Request $request): JsonResponse
    {
        $clientId = $request->get('client_id');
        $staffId = $request->get('staff_id');
        $status = $request->get('status');
        $startDate = $request->get('start_date');
        $endDate = $request->get('end_date');

        // 1. Fetch Tasks (Sheets)
        $tasksQuery = Task::with(['client', 'workType', 'assignedTo'])
            ->when($clientId, fn($q) => $q->where('client_id', $clientId))
            ->when($staffId, fn($q) => $q->where('allocated_to', $staffId))
            ->when($status, fn($q) => $q->where('status', $status))
            ->when($startDate, fn($q) => $q->whereDate('created_at', '>=', $startDate))
            ->when($endDate, fn($q) => $q->whereDate('created_at', '<=', $endDate));

        $tasks = $tasksQuery->latest()->get()->map(function($task) {
            $start = $task->created_at;
            $end = $task->date_completed ? Carbon::parse($task->date_completed) : null;
            
            $hours = null;
            if ($end) {
                $hours = abs(round($start->diffInMinutes($end) / 60, 2));
            } else {
                $hours = abs(round($start->diffInMinutes(now()) / 60, 2));
            }

            return [
                'id' => $task->id,
                'type' => 'sheet',
                'name' => $task->form_name,
                'client_name' => $task->client?->name ?? 'N/A',
                'work_type' => $task->workType?->name ?? 'N/A',
                'assigned_to' => $task->assignedTo?->name ?? 'Unassigned',
                'start_time' => $start->toDateTimeString(),
                'end_time' => $end ? $end->toDateTimeString() : null,
                'status' => $task->status->value,
                'status_label' => $task->status->label(),
                'hours_taken' => $hours,
                'is_completed' => !empty($end),
            ];
        });

        // 2. Fetch SubTasks
        $subTasksQuery = SubTask::with(['task.client', 'task.workType', 'assignedTo'])
            ->when($staffId, fn($q) => $q->where('assigned_to', $staffId))
            ->when($status, fn($q) => $q->where('status', $status))
            ->when($startDate, fn($q) => $q->whereDate('created_at', '>=', $startDate))
            ->when($endDate, fn($q) => $q->whereDate('created_at', '<=', $endDate))
            ->when($clientId, function($q) use ($clientId) {
                $q->whereHas('task', fn($tq) => $tq->where('client_id', $clientId));
            });

        $subTasks = $subTasksQuery->latest()->get()->map(function($subTask) {
            $start = $subTask->created_at;
            $end = $subTask->completed_at;

            $hours = null;
            if ($end) {
                $hours = abs(round($start->diffInMinutes($end) / 60, 2));
            } else {
                $hours = abs(round($start->diffInMinutes(now()) / 60, 2));
            }

            return [
                'id' => $subTask->id,
                'type' => 'subtask',
                'name' => $subTask->title,
                'parent_sheet' => $subTask->task?->form_name ?? 'N/A',
                'client_name' => $subTask->task?->client?->name ?? 'N/A',
                'work_type' => $subTask->task?->workType?->name ?? 'N/A',
                'assigned_to' => $subTask->assignedTo?->name ?? 'Unassigned',
                'start_time' => $start->toDateTimeString(),
                'end_time' => $end ? $end->toDateTimeString() : null,
                'status' => $subTask->status->value,
                'status_label' => $subTask->status->label(),
                'hours_taken' => $hours,
                'is_completed' => !empty($end),
            ];
        });

        return response()->json([
            'data' => [
                'sheets' => $tasks,
                'subtasks' => $subTasks,
            ]
        ]);
    }
}
