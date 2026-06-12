<?php

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'username',
        'password',
        'role',
        'is_active',
        'employee_code',
        'address',
        'email',
        'mobile',
        'profile_photo',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $appends = ['profile_photo_url'];

    public function getProfilePhotoUrlAttribute()
    {
        return $this->profile_photo ? asset('storage/' . $this->profile_photo) : null;
    }

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'role' => UserRole::class,
            'is_active' => 'boolean',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────
    public function roles()
    {
        return $this->belongsToMany(Role::class);
    }

    public function specialPermissions()
    {
        return $this->hasOne(StaffSpecialPermission::class, 'staff_id');
    }

    public function assignedTasks()
    {
        return $this->hasMany(Task::class, 'allocated_to');
    }

    public function createdTasks()
    {
        return $this->hasMany(Task::class, 'created_by');
    }

    public function taskLogs()
    {
        return $this->hasMany(TaskLog::class, 'changed_by');
    }

    // ── Scopes ─────────────────────────────────────────────────────
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeStaff($query)
    {
        return $query->where('role', UserRole::Staff);
    }
}