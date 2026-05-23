<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StaffResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'username' => $this->username,
            'role' => $this->role->value,
            'role_label' => $this->role_id && $this->customRole ? $this->customRole->name : $this->role->label(),
            'role_id' => $this->role_id,
            'custom_role' => $this->customRole ? [
                'id' => $this->customRole->id,
                'name' => $this->customRole->name,
            ] : null,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at->toDateString(),
        ];
    }
}