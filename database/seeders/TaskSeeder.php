<?php

namespace Database\Seeders;

use App\Enums\TaskStatus;
use App\Models\Client;
use App\Models\Task;
use App\Models\TaskLog;
use App\Models\User;
use App\Models\WorkType;
use Illuminate\Database\Seeder;

class TaskSeeder extends Seeder
{
    public function run(): void
    {
        $ca = User::where('role', 'ca')->first();
        $staff = User::where('role', 'staff')->get()->keyBy('username');
        $clients = Client::all()->keyBy('name');
        $workTypes = WorkType::all()->keyBy('name');

        $tasks = config('seeder.tasks');

        foreach ($tasks as $t) {
            $staffMember = $staff[$t['allocated_to']] ?? $staff->first();
            $client = $clients[$t['client']] ?? $clients->first();
            $workType = $workTypes[$t['work_type']] ?? $workTypes->first();
            $status = TaskStatus::from($t['status']);

            $task = Task::firstOrCreate(
                [
                    'client_id' => $client->id,
                    'work_type_id' => $workType->id,
                    'allocated_to' => $staffMember->id,
                    'date_inward' => $t['date_inward'],
                ],
                [
                    'created_by' => $ca->id,
                    'date_allocated' => $t['date_allocated'],
                    'date_completed' => $t['date_completed'] ?? null,
                    'status' => $status,
                    'remarks' => $t['remarks'] ?? null,
                ]
            );

            // Log initial status
            TaskLog::firstOrCreate(
                ['task_id' => $task->id, 'new_status' => $status->value],
                [
                    'changed_by' => $ca->id,
                    'old_status' => null,
                    'remarks' => 'Task created',
                ]
            );
        }
    }
}