<?php

namespace App\Http\Requests\CA;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStaffRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'username' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('users', 'username')->ignore($this->route('staff'))
            ],
            'role_ids' => ['nullable', 'array'],
            'role_ids.*' => ['exists:roles,id'],
            'employee_code' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'email' => ['nullable', 'email', 'max:255'],
            'mobile' => ['nullable', 'string', 'max:20'],
            'create_sheet' => ['nullable', 'boolean'],
            'edit_sheet' => ['nullable', 'boolean'],
            'delete_sheet' => ['nullable', 'boolean'],
            'import_export_sheet' => ['nullable', 'boolean'],
        ];
    }
}
