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
            'allow_attachments' => (bool)$this->allow_attachments,
            'allow_checklist' => (bool)$this->allow_checklist,
            'allow_notes' => (bool)$this->allow_notes,
            'is_billable' => (bool)$this->is_billable,
            'is_after_sales' => (bool)$this->is_after_sales,
            'allow_duplicate_clients' => (bool)$this->allow_duplicate_clients,
            'sub_tasks' => SubTaskResource::collection($this->whenLoaded('subTasks')),
            'logs' => TaskLogResource::collection($this->whenLoaded('logs')),
            'notes' => $this->relationLoaded('notes') ? $this->notes->map(function ($note) {
                return [
                    'id' => $note->id,
                    'text' => $note->text,
                    'user_id' => $note->user_id,
                    'author_name' => $note->author?->name,
                    'timestamp' => $note->created_at->format('d/m/Y h:i A'),
                ];
            }) : [],
            'created_at' => $this->created_at->toDateTimeString(),
            'updated_at' => $this->updated_at->toDateTimeString(),
            'permissions' => $this->permissions ? $this->permissions->map(function ($perm) {
                return [
                    'role_id' => $perm->role_id,
                    'role_name' => $perm->role?->name,
                    'can_read' => (bool)$perm->can_read,
                    'can_write' => (bool)$perm->can_write,
                    'can_delete' => (bool)$perm->can_delete,
                ];
            }) : [],
            'user_permissions' => $this->getUserPermissions($request->user()),
        ];
    }

    public function getUserPermissions($user): array
    {
        if (!$user) {
            return [
                'can_read' => false,
                'can_write' => false,
                'can_delete' => false,
            ];
        }

        // Admin has full bypass access
        if ($user->role === \App\Enums\UserRole::CA) {
            return [
                'can_read' => true,
                'can_write' => true,
                'can_delete' => true,
            ];
        }

        // If no permissions are set on the task, default to full access (backward compatibility)
        $permissions = $this->permissions;
        if ($permissions->isEmpty()) {
            return [
                'can_read' => true,
                'can_write' => true,
                'can_delete' => true,
            ];
        }

        // Find permissions matching any of the user's roles
        $roleIds = $user->relationLoaded('roles') 
            ? $user->roles->pluck('id')->map('intval')->toArray() 
            : $user->roles()->pluck('roles.id')->map('intval')->toArray();

        $userRolePermissions = $permissions->whereIn('role_id', $roleIds);

        if ($userRolePermissions->isNotEmpty()) {
            return [
                'can_read' => $userRolePermissions->contains(fn($p) => (bool)$p->can_read),
                'can_write' => $userRolePermissions->contains(fn($p) => (bool)$p->can_write),
                'can_delete' => $userRolePermissions->contains(fn($p) => (bool)$p->can_delete),
            ];
        }

        // If sheet has permissions, but none configured for any of user's roles, access is denied
        return [
            'can_read' => false,
            'can_write' => false,
            'can_delete' => false,
        ];
    }
}