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
            'date_inward' => ['sometimes', 'date'],
            'allocated_to' => ['sometimes', 'exists:users,id'],
            'date_allocated' => ['sometimes', 'date'],
            'date_completed' => ['nullable', 'date'],
            'remarks' => ['nullable', 'string', 'max:500'],
        ];
    }
}