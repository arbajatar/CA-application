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
            'contact' => $this->contact,
            'email' => $this->email,
            'dob' => $this->dob?->toDateString(),
            'city' => $this->city,
            'gst_number' => $this->gst_number,
            'status' => $this->status->value,
            'created_at' => $this->created_at->toDateString(),
        ];
    }
}