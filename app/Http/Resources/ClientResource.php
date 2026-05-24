<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'name_as_per_pan' => $this->name_as_per_pan,
            'pan_no' => $this->pan_no,
            'type' => $this->type,
            'group' => $this->group,
            'contact' => $this->contact,
            'alternative_contact' => $this->alternative_contact,
            'email' => $this->email,
            'reference_no' => $this->reference_no,
            'dob' => $this->dob?->toDateString(),
            'city' => $this->city,
            'pin_code' => $this->pin_code,
            'state' => $this->state,
            'gst_number' => $this->gst_number,
            'status' => $this->status->value,
            'credentials' => $this->credentials,
            'created_at' => $this->created_at->toDateString(),
        ];
    }
}