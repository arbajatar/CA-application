<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeamChecklist extends Model
{
    use HasFactory;

    protected $table = 'team_checklists';

    protected $fillable = [
        'user_id',
        'title',
        'assigned_to',
        'status',
        'sub_status',
        'due_date',
        'remarks',
        'screenshot',
    ];

    protected $appends = ['screenshot_url', 'attachments'];

    public function setScreenshotAttribute($value)
    {
        if (empty($value)) {
            $this->attributes['screenshot'] = null;
            return;
        }

        // If it's already a relative path to the json file, keep it
        if (is_string($value) && str_ends_with($value, '.json') && str_starts_with($value, 'sub_tasks_screenshots/')) {
            $this->attributes['screenshot'] = $value;
            return;
        }

        $decoded = is_string($value) ? json_decode($value, true) : $value;
        if (is_array($decoded)) {
            $existingPath = $this->attributes['screenshot'] ?? null;
            if ($existingPath && str_ends_with($existingPath, '.json') && str_starts_with($existingPath, 'sub_tasks_screenshots/')) {
                $filePath = $existingPath;
            } else {
                $filePath = 'sub_tasks_screenshots/attachments_' . uniqid() . '_' . time() . '.json';
            }

            $fullDir = storage_path('app/public/sub_tasks_screenshots');
            if (!file_exists($fullDir)) {
                mkdir($fullDir, 0755, true);
            }
            file_put_contents(storage_path('app/public/' . $filePath), json_encode($decoded, JSON_PRETTY_PRINT));

            $this->attributes['screenshot'] = $filePath;
        } else {
            $this->attributes['screenshot'] = $value;
        }
    }

    public function getScreenshotAttribute($value)
    {
        if (empty($value)) {
            return null;
        }

        if (str_ends_with($value, '.json') && str_starts_with($value, 'sub_tasks_screenshots/')) {
            $fullPath = storage_path('app/public/' . $value);
            if (file_exists($fullPath)) {
                return file_get_contents($fullPath);
            }
            return '[]';
        }

        return $value;
    }

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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }
}
