<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TaskLog extends Model
{
    use HasFactory;

    public $timestamps = true;
    const UPDATED_AT = null; // logs are insert-only

    protected $fillable = [
        'task_id',
        'changed_by',
        'old_status',
        'new_status',
        'remarks',
        'screenshot',
    ];

    protected $appends = ['screenshot_url'];

    public function getScreenshotUrlAttribute()
    {
        return $this->screenshot ? asset('storage/' . $this->screenshot) : null;
    }

    public function task()
    {
        return $this->belongsTo(Task::class);
    }

    public function changedBy()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}