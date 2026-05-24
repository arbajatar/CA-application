<?php

namespace App\Http\Requests\CA;

use App\Enums\ClientStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Rule;

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
            'name_as_per_pan' => ['nullable', 'string', 'max:255'],
            'pan_no' => [
                'required',
                'string',
                'size:10',
                'regex:/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i',
                Rule::unique('clients', 'pan_no'),
                function ($attribute, $value, $fail) {
                    $type = request()->input('type');
                    if (!$type) return;

                    // Indian Income Tax department PAN 4th letter mapping
                    $map = [
                        'Individual' => 'P',
                        'Sole Proprietorship' => 'P',
                        'Partnership Firm' => 'F',
                        'LLP' => 'F',
                        'HUF' => 'H',
                        'Private Limited' => 'C',
                        'Limited Company' => 'C',
                        'Joint-Venture Company' => 'C',
                        'One Person Company' => 'C',
                        'Section 8 Company' => 'C',
                    ];

                    if (isset($map[$type])) {
                        $expectedChar = $map[$type];
                        $fourthChar = strtoupper(substr($value, 3, 1));
                        if ($fourthChar !== $expectedChar) {
                            $fail("The 4th letter of PAN number must be '{$expectedChar}' for Client Type '{$type}'.");
                        }
                    }
                }
            ],
            'type' => ['required', 'string', 'max:255'],
            'group' => ['required', 'string', 'max:255'],
            'contact' => ['nullable', 'string', 'regex:/^[0-9]{10}$/'],
            'alternative_contact' => ['nullable', 'string', 'regex:/^[0-9]{10}$/'],
            'email' => ['nullable', 'email', 'max:255'],
            'reference_no' => ['nullable', 'string', 'max:255'],
            'dob' => ['required', 'date'],
            'city' => ['nullable', 'string', 'max:255'],
            'pin_code' => ['nullable', 'string', 'max:10'],
            'state' => ['nullable', 'string', 'max:255'],
            'gst_number' => ['nullable', 'string', 'max:20'],
            'status' => ['nullable', new Enum(ClientStatus::class)],
            'credentials' => ['nullable', 'array'],
        ];
    }

    public function messages(): array
    {
        return [
            'contact.regex' => 'The contact number must be exactly 10 digits.',
            'alternative_contact.regex' => 'The alternative contact number must be exactly 10 digits.',
            'pan_no.regex' => 'The PAN number must be in a valid format (e.g. ABCDE1234F).',
            'pan_no.size' => 'The PAN number must be exactly 10 characters long.',
            'pan_no.unique' => 'This PAN number is already registered to another client.',
            'dob.required' => 'The Date of Birth field is required.',
        ];
    }
}