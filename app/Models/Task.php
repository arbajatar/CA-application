<?php

namespace App\Models;

use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Task extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'work_type_id',
        'form_name',
        'date_inward',
        'allocated_to',
        'created_by',
        'date_allocated',
        'date_completed',
        'status',
        'remarks',
        'dynamic_fields',
        'priority',
        'due_date',
        'task_particular',
        'sub_status',
        'feedback',
        'entry_date',
        'allow_attachments',
        'allow_checklist',
        'allow_notes',
        'is_billable',
        'is_after_sales',
        'allow_duplicate_clients',
    ];

    protected function casts(): array
    {
        return [
            'status' => TaskStatus::class,
            'date_inward' => 'date',
            'date_allocated' => 'date',
            'date_completed' => 'date',
            'dynamic_fields' => 'array',
            'priority' => TaskPriority::class,
            'due_date' => 'date',
            'entry_date' => 'date',
            'allow_attachments' => 'boolean',
            'allow_checklist' => 'boolean',
            'allow_notes' => 'boolean',
            'is_billable' => 'boolean',
            'is_after_sales' => 'boolean',
            'allow_duplicate_clients' => 'boolean',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────
    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function workType()
    {
        return $this->belongsTo(WorkType::class);
    }

    public function assignedTo()
    {
        return $this->belongsTo(User::class, 'allocated_to');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function logs()
    {
        return $this->hasMany(TaskLog::class)->latest();
    }

    public function subTasks()
    {
        return $this->hasMany(SubTask::class);
    }

    public function permissions()
    {
        return $this->hasMany(SheetPermission::class);
    }

    public function notes()
    {
        return $this->hasMany(TaskNote::class)->latest();
    }

    // ── Scopes ─────────────────────────────────────────────────────
    public function scopeForStaff($query, int $userId)
    {
        return $query->where('allocated_to', $userId);
    }

    public function scopeByStatus($query, TaskStatus $status)
    {
        return $query->where('status', $status);
    }

    protected static function booted()
    {
        static::updating(function ($task) {
            if ($task->isDirty('dynamic_fields')) {
                $oldFields = $task->getOriginal('dynamic_fields');
                $newFields = $task->dynamic_fields;

                if (is_string($oldFields)) {
                    try { $oldFields = json_decode($oldFields, true); } catch (\Exception $e) { $oldFields = []; }
                }
                if (is_string($newFields)) {
                    try { $newFields = json_decode($newFields, true); } catch (\Exception $e) { $newFields = []; }
                }

                $oldRows = is_array($oldFields) ? ($oldFields['multi_rows'] ?? []) : [];
                $newRows = is_array($newFields) ? ($newFields['multi_rows'] ?? []) : [];

                $oldRowIds = array_filter(array_column($oldRows, 'row_id'));
                $newRowIds = array_filter(array_column($newRows, 'row_id'));

                $deletedRowIds = array_diff($oldRowIds, $newRowIds);
                $addedRows = [];
                foreach ($newRows as $row) {
                    if (!isset($row['row_id']) || !in_array($row['row_id'], $oldRowIds)) {
                        $addedRows[] = $row;
                    }
                }

                $deletedRows = [];
                foreach ($oldRows as $row) {
                    if (isset($row['row_id']) && in_array($row['row_id'], $deletedRowIds)) {
                        $deletedRows[] = $row;
                    }
                }

                $formatRowDetails = function ($row) {
                    $clientName = 'N/A';
                    if (!empty($row['client_id'])) {
                        $client = \App\Models\Client::find($row['client_id']);
                        if ($client) {
                            $clientName = $client->name . ($client->pan_no ? " ({$client->pan_no})" : "");
                        }
                    }
                    
                    $workTypeName = 'N/A';
                    if (!empty($row['work_type_id'])) {
                        $wt = \App\Models\WorkType::find($row['work_type_id']);
                        if ($wt) {
                            $workTypeName = $wt->name;
                        }
                    }

                    $assignedName = 'Unassigned';
                    $allocType = $row['allocated_type'] ?? 'user';
                    $allocTo = $row['allocated_to'] ?? null;
                    if ($allocType === 'user' && !empty($allocTo)) {
                        $user = \App\Models\User::find($allocTo);
                        if ($user) {
                            $assignedName = $user->name;
                        }
                    } elseif ($allocType === 'users' && is_array($allocTo)) {
                        $names = \App\Models\User::whereIn('id', $allocTo)->pluck('name')->toArray();
                        $assignedName = count($names) > 0 ? implode(', ', $names) : 'Unassigned';
                    } elseif ($allocType === 'role' && !empty($allocTo)) {
                        $role = \App\Models\Role::find($allocTo);
                        if ($role) {
                            $assignedName = "Dept: " . $role->name;
                        }
                    }

                    $status = $row['status'] ?? 'assigned';
                    $subStatus = $row['sub_status'] ?? '';

                    $details = "Client: {$clientName} | Work Type: {$workTypeName} | Assigned To: {$assignedName} | Status: {$status}";
                    if ($subStatus) {
                        $details .= " | Sub Status: {$subStatus}";
                    }
                    return $details;
                };

                $userId = auth()->id() ?: ($task->allocated_to ?: $task->created_by ?: 1);

                // Log each deleted row
                foreach ($deletedRows as $row) {
                    \App\Models\TaskLog::create([
                        'task_id' => $task->id,
                        'changed_by' => $userId,
                        'old_status' => $task->status->value ?? $task->status,
                        'new_status' => $task->status->value ?? $task->status,
                        'remarks' => 'Row Deleted: ' . $formatRowDetails($row),
                    ]);
                }

                // Log each added row
                foreach ($addedRows as $row) {
                    \App\Models\TaskLog::create([
                        'task_id' => $task->id,
                        'changed_by' => $userId,
                        'old_status' => $task->status->value ?? $task->status,
                        'new_status' => $task->status->value ?? $task->status,
                        'remarks' => 'Row Added: ' . $formatRowDetails($row),
                    ]);
                }
            }
        });
    }
}