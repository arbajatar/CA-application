<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'old_status' => $this->old_status,
            'new_status' => $this->new_status,
            'remarks' => $this->remarks,
            'changed_by' => $this->changedBy?->name,
            'changed_at' => $this->created_at->toDateTimeString(),
        ];
    }
}