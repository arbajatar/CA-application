<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubTaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'task_id' => $this->task_id,
            'title' => $this->title,
            'assigned_to' => $this->assignedTo ? [
                'id' => $this->assignedTo->id,
                'name' => $this->assignedTo->name,
            ] : null,
            'priority' => $this->priority?->value ?? 'medium',
            'priority_label' => $this->priority?->label() ?? 'Medium',
            'due_date' => $this->due_date?->toDateString(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'completed_at' => $this->completed_at?->toDateTimeString(),
            'remarks' => $this->remarks,
            'screenshot_url' => $this->screenshot_url,
            'task' => [
                'id' => $this->task->id,
                'form_name' => $this->task->form_name,
                'client' => $this->task->client?->name,
                'work_type' => $this->task->workType?->name,
            ],
            'user_permissions' => $this->task ? (new TaskResource($this->task))->getUserPermissions($request->user()) : [
                'can_read' => true,
                'can_write' => true,
                'can_delete' => true,
            ],
        ];
    }
}
