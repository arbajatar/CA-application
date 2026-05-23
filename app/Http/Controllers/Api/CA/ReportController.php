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

    public function taskReport(Request $request): JsonResponse
    {
        $clientId = $request->get('client_id');
        $staffId = $request->get('staff_id');
        $status = $request->get('status');
        $workTypeId = $request->get('work_type_id');
        $startDate = $request->get('start_date');
        $endDate = $request->get('end_date');

        $tasksQuery = Task::with(['client', 'workType', 'assignedTo', 'subTasks.assignedTo'])
            ->when($clientId, fn($q) => $q->where('client_id', $clientId))
            ->when($staffId, fn($q) => $q->where('allocated_to', $staffId))
            ->when($status, fn($q) => $q->where('status', $status))
            ->when($workTypeId, fn($q) => $q->where('work_type_id', $workTypeId))
            ->when($startDate, fn($q) => $q->whereDate('created_at', '>=', $startDate))
            ->when($endDate, fn($q) => $q->whereDate('created_at', '<=', $endDate));

        $tasks = $tasksQuery->latest()->get()->map(function($task) {
            return [
                'id' => $task->id,
                'name' => $task->form_name,
                'client_name' => $task->client?->name ?? 'N/A',
                'work_type' => $task->workType?->name ?? 'N/A',
                'assigned_to' => $task->assignedTo?->name ?? 'Unassigned',
                'status' => $task->status->value,
                'status_label' => $task->status->label(),
                'created_at' => $task->created_at->toDateTimeString(),
                'date_completed' => $task->date_completed ? Carbon::parse($task->date_completed)->toDateTimeString() : null,
                'subtasks' => $task->subTasks->map(function($st) {
                    return [
                        'id' => $st->id,
                        'name' => $st->title,
                        'assigned_to' => $st->assignedTo?->name ?? 'Unassigned',
                        'status' => $st->status->value,
                        'status_label' => $st->status->label(),
                        'sub_status' => $st->sub_status ?? 'N/A',
                        'created_at' => $st->created_at->toDateTimeString(),
                        'completed_at' => $st->completed_at ? $st->completed_at->toDateTimeString() : null,
                    ];
                })
            ];
        });

        return response()->json([
            'data' => $tasks
        ]);
    }
}
