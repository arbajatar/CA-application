<?php

namespace App\Http\Requests\CA;

use Illuminate\Foundation\Http\FormRequest;

class StoreTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_id' => ['nullable', 'exists:clients,id'],
            'work_type_id' => ['required', 'exists:work_types,id'],
            'form_name' => ['required', 'string'],
            'date_inward' => ['nullable', 'date'],
            'allocated_to' => ['nullable', 'exists:users,id'],
            'subtasks' => ['nullable', 'array'],
            'subtasks.*.assigned_to' => ['nullable', 'exists:users,id'],
            'subtasks.*.title' => ['required', 'string'],
            'subtasks.*.priority' => ['required', 'string'],
            'subtasks.*.status' => ['required', 'string'],
            'subtasks.*.due_date' => ['required', 'date'],
            'subtasks.*.remarks' => ['nullable', 'string'],
            'date_allocated' => ['required', 'date'],
            'status' => ['nullable', 'string', \Illuminate\Validation\Rule::enum(\App\Enums\TaskStatus::class)],
            'remarks' => ['nullable', 'string'],
            'dynamic_fields' => ['nullable', 'array'],
            'task_particular' => ['nullable', 'string'],
            'sub_status' => ['nullable', 'string'],
            'feedback' => ['nullable', 'string'],
            'entry_date' => ['nullable', 'date'],
            'permissions' => ['nullable', 'array'],
            'permissions.*.role_id' => ['required', 'exists:roles,id'],
            'permissions.*.can_read' => ['required', 'boolean'],
            'permissions.*.can_write' => ['required', 'boolean'],
            'permissions.*.can_delete' => ['required', 'boolean'],
        ];
    }
}