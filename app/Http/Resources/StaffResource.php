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
            'role_label' => $this->roles->isNotEmpty() ? $this->roles->pluck('name')->implode(', ') : $this->role->label(),
            'role_ids' => $this->roles->pluck('id')->toArray(),
            'custom_roles' => $this->roles->map(fn($r) => [
                'id' => $r->id,
                'name' => $r->name,
            ]),
            'is_active' => $this->is_active,
            'employee_code' => $this->employee_code,
            'address' => $this->address,
            'email' => $this->email,
            'mobile' => $this->mobile,
            'profile_photo' => $this->profile_photo,
            'profile_photo_url' => $this->profile_photo_url,
            'created_at' => $this->created_at->toDateString(),
        ];
    }
}