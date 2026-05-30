<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class WorkType extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['name', 'is_active'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    protected static function booted()
    {
        static::deleting(function ($workType) {
            if ($workType->isForceDeleting()) {
                foreach ($workType->tasks()->withTrashed()->get() as $task) {
                    $task->subTasks()->withTrashed()->forceDelete();
                    $task->forceDelete();
                }
            } else {
                foreach ($workType->tasks()->get() as $task) {
                    $task->subTasks()->delete();
                    $task->delete();
                }
            }
        });

        static::restoring(function ($workType) {
            foreach ($workType->tasks()->onlyTrashed()->get() as $task) {
                $task->restore();
                SubTask::onlyTrashed()->where('task_id', $task->id)->restore();
            }
        });
    }

    public function tasks()
    {
        return $this->hasMany(Task::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}