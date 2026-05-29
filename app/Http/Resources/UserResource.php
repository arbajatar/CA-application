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
            'role_label' => $this->roles->isNotEmpty() ? $this->roles->pluck('name')->implode(', ') : $this->role->label(),
            'roles' => $this->roles->map(fn($r) => ['id' => $r->id, 'name' => $r->name]),
            'role_ids' => $this->roles->pluck('id')->toArray(),
            'is_active' => $this->is_active,
            'employee_code' => $this->employee_code,
            'address' => $this->address,
            'email' => $this->email,
            'mobile' => $this->mobile,
            'profile_photo' => $this->profile_photo,
            'profile_photo_url' => $this->profile_photo_url,
            'total' => $this->total ?? 0,
            'pending' => $this->pending ?? 0,
            'work_in_progress' => $this->work_in_progress ?? 0,
            'complete' => $this->complete ?? 0,
            'not_to_be_done' => $this->not_to_be_done ?? 0,
            'other' => $this->other ?? 0,
        ];
    }
}
