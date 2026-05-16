<?php

namespace App\Models;

use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SubTask extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'task_id',
        'title',
        'assigned_to',
        'priority',
        'due_date',
        'status',
        'completed_at',
        'remarks',
        'screenshot',
    ];

    protected $appends = ['screenshot_url'];

    public function getScreenshotUrlAttribute()
    {
        return $this->screenshot ? asset('storage/' . $this->screenshot) : null;
    }

    protected $casts = [
        'priority' => TaskPriority::class,
        'status' => TaskStatus::class,
        'due_date' => 'date',
        'completed_at' => 'datetime',
    ];

    public function task()
    {
        return $this->belongsTo(Task::class);
    }

    public function assignedTo()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }
}
