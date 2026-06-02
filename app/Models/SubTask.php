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
        'sub_status',
        'is_verified',
    ];

    protected $appends = ['screenshot_url', 'attachments'];

    public function getScreenshotUrlAttribute()
    {
        $decoded = json_decode($this->screenshot, true);
        if (is_array($decoded)) {
            return !empty($decoded) ? asset('storage/' . $decoded[0]) : null;
        }
        return $this->screenshot ? asset('storage/' . $this->screenshot) : null;
    }

    public function getAttachmentsAttribute()
    {
        $decoded = json_decode($this->screenshot, true);
        $files = is_array($decoded) ? $decoded : ($this->screenshot ? [$this->screenshot] : []);
        
        $result = [];
        foreach ($files as $file) {
            $result[] = [
                'name' => basename($file),
                'url' => asset('storage/' . $file),
                'path' => $file
            ];
        }
        return $result;
    }

    protected $casts = [
        'priority' => TaskPriority::class,
        'status' => TaskStatus::class,
        'due_date' => 'date',
        'completed_at' => 'datetime',
        'is_verified' => 'boolean',
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
