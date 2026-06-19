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

    public function setScreenshotAttribute($value)
    {
        if (empty($value)) {
            $this->attributes['screenshot'] = null;
            return;
        }

        // If it's already a relative path to the json file, keep it
        if (is_string($value) && (str_starts_with($value, 'ca_application/attachments/') || (str_ends_with($value, '.json') && str_starts_with($value, 'sub_tasks_screenshots/')))) {
            $this->attributes['screenshot'] = $value;
            return;
        }

        $decoded = is_string($value) ? json_decode($value, true) : $value;
        if (is_array($decoded)) {
            $existingPath = $this->attributes['screenshot'] ?? null;
            if ($existingPath && (str_starts_with($existingPath, 'ca_application/attachments/') || (str_ends_with($existingPath, '.json') && str_starts_with($existingPath, 'sub_tasks_screenshots/')))) {
                $filePath = $existingPath;
            } else {
                $filePath = 'sub_tasks_screenshots/attachments_' . uniqid() . '_' . time() . '.json';
            }

            $disk = env('FILESYSTEM_DISK', 'public');
            if ($disk === 's3') {
                $s3Path = str_starts_with($filePath, 'ca_application/attachments/') ? $filePath : "ca_application/attachments/{$filePath}";
                \Illuminate\Support\Facades\Storage::disk('s3')->put($s3Path, json_encode($decoded, JSON_PRETTY_PRINT), [
                    'visibility'  => 'public',
                    'ContentType' => 'application/json',
                ]);
                $this->attributes['screenshot'] = $s3Path;
            } else {
                $uploadPath = env('UPLOAD_PATH');
                if ($uploadPath) {
                    $fullPath = public_path(rtrim($uploadPath, '/') . '/storage/' . $filePath);
                } else {
                    $fullPath = storage_path('app/public/' . $filePath);
                }

                $fullDir = dirname($fullPath);
                if (!file_exists($fullDir)) {
                    mkdir($fullDir, 0755, true);
                }
                file_put_contents($fullPath, json_encode($decoded, JSON_PRETTY_PRINT));
                $this->attributes['screenshot'] = $filePath;
            }
        } else {
            $this->attributes['screenshot'] = $value;
        }
    }

    public function getScreenshotAttribute($value)
    {
        if (empty($value)) {
            return null;
        }

        if (str_starts_with($value, 'ca_application/attachments/') || (str_ends_with($value, '.json') && str_starts_with($value, 'sub_tasks_screenshots/'))) {
            $disk = env('FILESYSTEM_DISK', 'public');
            if ($disk === 's3' && str_starts_with($value, 'ca_application/attachments/')) {
                if (\Illuminate\Support\Facades\Storage::disk('s3')->exists($value)) {
                    return \Illuminate\Support\Facades\Storage::disk('s3')->get($value);
                }
                return '[]';
            } else {
                $uploadPath = env('UPLOAD_PATH');
                if ($uploadPath) {
                    $fullPath = public_path(rtrim($uploadPath, '/') . '/storage/' . $value);
                } else {
                    $fullPath = storage_path('app/public/' . $value);
                }
                if (file_exists($fullPath)) {
                    return file_get_contents($fullPath);
                }
                return '[]';
            }
        }

        return $value;
    }

    public function getScreenshotUrlAttribute()
    {
        $decoded = json_decode($this->screenshot, true);
        if (is_array($decoded)) {
            return !empty($decoded) ? \App\Helpers\UploadHelper::resolveUrl($decoded[0]) : null;
        }
        return $this->screenshot ? \App\Helpers\UploadHelper::resolveUrl($this->screenshot) : null;
    }

    public function getAttachmentsAttribute()
    {
        $decoded = json_decode($this->screenshot, true);
        $files = is_array($decoded) ? $decoded : ($this->screenshot ? [$this->screenshot] : []);
        
        $result = [];
        foreach ($files as $file) {
            $result[] = [
                'name' => basename($file),
                'url' => \App\Helpers\UploadHelper::resolveUrl($file),
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
