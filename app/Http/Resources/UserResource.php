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
            'pending' => $this->pending ?? 0,
            'work_in_progress' => $this->work_in_progress ?? 0,
            'complete' => $this->complete ?? 0,
            'not_to_be_done' => $this->not_to_be_done ?? 0,
            'other' => $this->other ?? 0,
        ];
    }
}
