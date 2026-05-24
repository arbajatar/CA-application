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
        'name_as_per_pan',
        'pan_no',
        'type',
        'group',
        'contact',
        'alternative_contact',
        'email',
        'reference_no',
        'dob',
        'city',
        'pin_code',
        'state',
        'gst_number',
        'status',
        'credentials',
    ];

    protected function casts(): array
    {
        return [
            'status' => ClientStatus::class,
            'dob' => 'date',
            'credentials' => 'array',
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