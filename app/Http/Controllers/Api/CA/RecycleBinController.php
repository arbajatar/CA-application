<?php

namespace App\Http\Controllers\Api\CA;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Task;
use App\Models\SubTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecycleBinController extends Controller
{
    public function indexClients(): JsonResponse
    {
        $clients = Client::onlyTrashed()->latest('deleted_at')->get();
        
        $data = $clients->map(function ($client) {
            return [
                'id' => $client->id,
                'name' => $client->name,
                'name_as_per_pan' => $client->name_as_per_pan,
                'pan_no' => $client->pan_no,
                'type' => $client->type,
                'group' => $client->group,
                'contact' => $client->contact,
                'email' => $client->email,
                'deleted_at' => $client->deleted_at->toDateTimeString(),
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function indexTasks(): JsonResponse
    {
        $tasks = Task::onlyTrashed()
            ->with([
                'client' => fn($q) => $q->withTrashed(),
                'workType',
                'assignedTo'
            ])
            ->latest('deleted_at')
            ->get();

        $data = $tasks->map(function ($task) {
            return [
                'id' => $task->id,
                'client_name' => $task->client?->name ?? 'N/A',
                'work_type_name' => $task->workType?->name ?? 'N/A',
                'form_name' => $task->form_name,
                'task_particular' => $task->task_particular,
                'allocated_to_name' => $task->assignedTo?->name ?? 'Unassigned',
                'deleted_at' => $task->deleted_at->toDateTimeString(),
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function restoreClient($id): JsonResponse
    {
        $client = Client::onlyTrashed()->findOrFail($id);
        $client->restore();
        
        // Mark status as Active
        $client->update(['status' => \App\Enums\ClientStatus::Active]);

        // Automatically restore client's soft-deleted tasks
        $tasks = Task::onlyTrashed()->where('client_id', $client->id)->get();
        foreach ($tasks as $task) {
            $task->restore();
            SubTask::onlyTrashed()->where('task_id', $task->id)->restore();
        }

        return response()->json([
            'message' => 'Client and related sheets/tasks successfully restored.',
        ]);
    }

    public function forceDeleteClient($id): JsonResponse
    {
        $client = Client::onlyTrashed()->findOrFail($id);
        
        // Permanently delete related tasks and subtasks first
        $tasks = Task::onlyTrashed()->where('client_id', $client->id)->get();
        foreach ($tasks as $task) {
            SubTask::onlyTrashed()->where('task_id', $task->id)->forceDelete();
            $task->forceDelete();
        }
        
        $client->forceDelete();

        return response()->json([
            'message' => 'Client and all related data permanently deleted.',
        ]);
    }

    public function restoreTask($id): JsonResponse
    {
        $task = Task::onlyTrashed()->findOrFail($id);
        
        // If the task's client is also soft-deleted, restore it too
        $clientRestored = false;
        if ($task->client()->withTrashed()->onlyTrashed()->exists()) {
            $client = $task->client()->withTrashed()->first();
            $client->restore();
            $client->update(['status' => \App\Enums\ClientStatus::Active]);
            $clientRestored = true;
        }

        $task->restore();
        
        // Restore related subtasks
        SubTask::onlyTrashed()->where('task_id', $task->id)->restore();

        return response()->json([
            'message' => 'Sheet/Task and all related subtasks successfully restored.' . ($clientRestored ? ' Associated client was also restored.' : ''),
        ]);
    }

    public function forceDeleteTask($id): JsonResponse
    {
        $task = Task::onlyTrashed()->findOrFail($id);
        
        // Force delete related subtasks
        SubTask::onlyTrashed()->where('task_id', $task->id)->forceDelete();
        $task->forceDelete();

        return response()->json([
            'message' => 'Sheet/Task permanently deleted.',
        ]);
    }
}
