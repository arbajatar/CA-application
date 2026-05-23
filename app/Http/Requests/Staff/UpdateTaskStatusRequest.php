<?php

namespace App\Http\Requests\Staff;

use App\Enums\TaskStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class UpdateTaskStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', new Enum(TaskStatus::class)],
            'remarks' => ['nullable', 'string'],
            'screenshot' => ['nullable', 'file', 'max:5120'], // 5MB all file types
        ];
    }
}
