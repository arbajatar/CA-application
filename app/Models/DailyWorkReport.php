<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyWorkReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'date',
        'main_task',
        'sub_task',
        'duration',
        'start_time',
        'end_time',
        'hours_taken',
        'client_id',
        'client_name_custom',
        'sub_task_description',
        'status',
        'pct_completion',
        'final_remark',
        'ca_review',
        'ca_remark'
    ];

    protected $casts = [
        'hours_taken' => 'float',
        'pct_completion' => 'integer'
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }
}
