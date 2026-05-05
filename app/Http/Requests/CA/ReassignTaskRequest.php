<?php

namespace App\Http\Requests\CA;

use Illuminate\Foundation\Http\FormRequest;

class ReassignTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'allocated_to' => ['required', 'exists:users,id'],
            'remarks' => ['nullable', 'string', 'max:500'],
        ];
    }
}
