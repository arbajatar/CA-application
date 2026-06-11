<?php

namespace App\Models;

use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Task extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'work_type_id',
        'form_name',
        'date_inward',
        'allocated_to',
        'created_by',
        'date_allocated',
        'date_completed',
        'status',
        'remarks',
        'dynamic_fields',
        'priority',
        'due_date',
        'task_particular',
        'sub_status',
        'feedback',
        'entry_date',
        'allow_attachments',
        'allow_checklist',
        'allow_notes',
        'is_billable',
        'is_after_sales',
        'allow_duplicate_clients',
    ];

    protected function casts(): array
    {
        return [
            'status' => TaskStatus::class,
            'date_inward' => 'date',
            'date_allocated' => 'date',
            'date_completed' => 'date',
            'dynamic_fields' => 'array',
            'priority' => TaskPriority::class,
            'due_date' => 'date',
            'entry_date' => 'date',
            'allow_attachments' => 'boolean',
            'allow_checklist' => 'boolean',
            'allow_notes' => 'boolean',
            'is_billable' => 'boolean',
            'is_after_sales' => 'boolean',
            'allow_duplicate_clients' => 'boolean',
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

    public function subTasks()
    {
        return $this->hasMany(SubTask::class);
    }

    public function permissions()
    {
        return $this->hasMany(SheetPermission::class);
    }

    public function notes()
    {
        return $this->hasMany(TaskNote::class)->latest();
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