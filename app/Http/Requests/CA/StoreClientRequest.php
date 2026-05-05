<?php

namespace App\Http\Requests\CA;

use App\Enums\ClientStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class StoreClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'contact' => ['nullable', 'string', 'max:20'],
            'gst_number' => ['nullable', 'string', 'max:20'],
            'status' => ['nullable', new Enum(ClientStatus::class)],
        ];
    }
}