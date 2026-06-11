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
            'work_type_id' => ['sometimes', 'nullable', 'exists:work_types,id'],
            'form_name' => ['sometimes', 'string'],
            'date_inward' => ['sometimes', 'nullable', 'date'],
            'allocated_to' => ['sometimes', 'nullable', 'exists:users,id'],
            'date_allocated' => ['sometimes', 'nullable', 'date'],
            'date_completed' => ['nullable', 'date'],
            'status' => ['sometimes', 'string', \Illuminate\Validation\Rule::enum(\App\Enums\TaskStatus::class)],
            'remarks' => ['nullable', 'string'],
            'dynamic_fields' => ['nullable', 'array'],
            'task_particular' => ['nullable', 'string'],
            'sub_status' => ['nullable', 'string'],
            'feedback' => ['nullable', 'string'],
            'entry_date' => ['nullable', 'date'],
            'allow_attachments' => ['nullable', 'boolean'],
            'allow_checklist' => ['nullable', 'boolean'],
            'allow_notes' => ['nullable', 'boolean'],
            'is_billable' => ['nullable', 'boolean'],
            'is_after_sales' => ['nullable', 'boolean'],
            'allow_duplicate_clients' => ['nullable', 'boolean'],
            'permissions' => ['nullable', 'array'],
            'permissions.*.role_id' => ['required', 'exists:roles,id'],
            'permissions.*.can_read' => ['required', 'boolean'],
            'permissions.*.can_write' => ['required', 'boolean'],
            'permissions.*.can_delete' => ['required', 'boolean'],
        ];
    }
}