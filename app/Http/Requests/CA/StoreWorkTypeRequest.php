<?php

namespace App\Http\Requests\CA;

use Illuminate\Foundation\Http\FormRequest;

class StoreWorkTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', 'unique:work_types,name'],
        ];
    }
}