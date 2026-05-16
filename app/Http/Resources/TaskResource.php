<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'client' => $this->client ? [
                'id' => $this->client->id,
                'name' => $this->client->name,
                'contact' => $this->client->contact,
            ] : null,
            'work_type' => $this->workType ? [
                'id' => $this->workType->id,
                'name' => $this->workType->name,
            ] : null,
            'form_name' => $this->form_name,
            'allocated_to' => $this->assignedTo ? [
                'id' => $this->assignedTo->id,
                'name' => $this->assignedTo->name,
            ] : null,
            'created_by' => $this->createdBy?->name,
            'date_inward' => $this->date_inward?->toDateString(),
            'date_allocated' => $this->date_allocated?->toDateString(),
            'date_completed' => $this->date_completed?->toDateString(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'priority' => $this->priority?->value ?? 'medium',
            'priority_label' => $this->priority?->label() ?? 'Medium',
            'due_date' => $this->due_date?->toDateString(),
            'remarks' => $this->remarks,
            'dynamic_fields' => $this->dynamic_fields,
            'task_particular' => $this->task_particular,
            'sub_status' => $this->sub_status,
            'feedback' => $this->feedback,
            'entry_date' => $this->entry_date?->toDateString(),
            'sub_tasks' => SubTaskResource::collection($this->whenLoaded('subTasks')),
            'logs' => TaskLogResource::collection($this->whenLoaded('logs')),
            'created_at' => $this->created_at->toDateTimeString(),
        ];
    }
}