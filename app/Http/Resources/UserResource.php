<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'username' => $this->username,
            'role' => $this->role->value,
            'role_label' => $this->role->label(),
            'is_active' => $this->is_active,
            'total' => $this->total ?? 0,
            'assigned' => $this->assigned ?? 0,
            'in_progress' => $this->in_progress ?? 0,
            'awaiting_information' => $this->awaiting_information ?? 0,
            'completed' => $this->completed ?? 0,
        ];
    }
}
