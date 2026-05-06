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
            'client_id' => ['required', 'exists:clients,id'],
            'work_type_id' => ['required', 'exists:work_types,id'],
            'date_inward' => ['required', 'date'],
            'allocated_to' => ['required', 'exists:users,id'],
            'date_allocated' => ['required', 'date'],
            'status' => ['nullable', 'string', \Illuminate\Validation\Rule::enum(\App\Enums\TaskStatus::class)],
            'remarks' => ['nullable', 'string', 'max:500'],
            'dynamic_fields' => ['nullable', 'array'],
        ];
    }
}