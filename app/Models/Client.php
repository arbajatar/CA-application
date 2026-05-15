<?php

namespace App\Models;

use App\Enums\ClientStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'contact',
        'email',
        'dob',
        'city',
        'gst_number',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => ClientStatus::class,
            'dob' => 'date',
        ];
    }

    public function tasks()
    {
        return $this->hasMany(Task::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', ClientStatus::Active);
    }
}