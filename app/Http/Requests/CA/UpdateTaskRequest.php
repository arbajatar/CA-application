<?php

namespace App\Http\Requests\CA;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_id' => ['sometimes', 'exists:clients,id'],
            'work_type_id' => ['sometimes', 'exists:work_types,id'],
            'form_name' => ['sometimes', 'string'],
            'date_inward' => ['sometimes', 'date'],
            'allocated_to' => ['sometimes', 'exists:users,id'],
            'date_allocated' => ['sometimes', 'date'],
            'date_completed' => ['nullable', 'date'],
            'status' => ['sometimes', 'string', \Illuminate\Validation\Rule::enum(\App\Enums\TaskStatus::class)],
            'remarks' => ['nullable', 'string'],
            'dynamic_fields' => ['nullable', 'array'],
            'task_particular' => ['nullable', 'string'],
            'sub_status' => ['nullable', 'string'],
            'feedback' => ['nullable', 'string'],
            'entry_date' => ['nullable', 'date'],
            'allow_attachments' => ['nullable', 'boolean'],
            'permissions' => ['nullable', 'array'],
            'permissions.*.role_id' => ['required', 'exists:roles,id'],
            'permissions.*.can_read' => ['required', 'boolean'],
            'permissions.*.can_write' => ['required', 'boolean'],
            'permissions.*.can_delete' => ['required', 'boolean'],
        ];
    }
}