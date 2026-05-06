<?php

namespace App\Models;

use App\Enums\TaskStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Task extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'client_id',
        'work_type_id',
        'date_inward',
        'allocated_to',
        'created_by',
        'date_allocated',
        'date_completed',
        'status',
        'remarks',
        'dynamic_fields',
    ];

    protected function casts(): array
    {
        return [
            'status' => TaskStatus::class,
            'date_inward' => 'date',
            'date_allocated' => 'date',
            'date_completed' => 'date',
            'dynamic_fields' => 'array',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────
    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function workType()
    {
        return $this->belongsTo(WorkType::class);
    }

    public function assignedTo()
    {
        return $this->belongsTo(User::class, 'allocated_to');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function logs()
    {
        return $this->hasMany(TaskLog::class)->latest();
    }

    // ── Scopes ─────────────────────────────────────────────────────
    public function scopeForStaff($query, int $userId)
    {
        return $query->where('allocated_to', $userId);
    }

    public function scopeByStatus($query, TaskStatus $status)
    {
        return $query->where('status', $status);
    }
}