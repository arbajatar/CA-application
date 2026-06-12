<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SheetLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'task_id',
        'sheet_name',
        'user_id',
        'user_name',
        'action',
        'details',
    ];

    protected $casts = [
        'details' => 'array',
    ];

    public function task()
    {
        return $this->belongsTo(Task::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
