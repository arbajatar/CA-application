<?php

namespace App\Helpers;

use App\Models\SheetLog;
use App\Models\Client;
use App\Models\WorkType;
use App\Models\User;

class SheetLogger
{
    public static function log($task, $user, $newDynamicFields)
    {
        if (!$task) return;

        $oldDynamicFields = $task->dynamic_fields;
        $oldRows = $oldDynamicFields['multi_rows'] ?? [];
        $newRows = $newDynamicFields['multi_rows'] ?? [];

        if (!is_array($oldRows) || !is_array($newRows)) {
            return;
        }

        // Map old rows by row_id (or index if row_id is missing)
        $oldMap = [];
        foreach ($oldRows as $idx => $r) {
            $id = $r['row_id'] ?? $r['id'] ?? "index_$idx";
            $oldMap[$id] = $r;
        }

        // Map new rows by row_id
        $newMap = [];
        foreach ($newRows as $idx => $r) {
            $id = $r['row_id'] ?? $r['id'] ?? "index_$idx";
            $newMap[$id] = $r;
        }

        $changes = [];

        // 1. Added Rows
        foreach ($newMap as $id => $row) {
            if (!isset($oldMap[$id])) {
                $clientName = 'No Client';
                if (!empty($row['client_id'])) {
                    $clientName = Client::find($row['client_id'])?->name ?? "Client #{$row['client_id']}";
                }
                $changes[] = [
                    'type' => 'row_added',
                    'message' => "Added row for Client: \"$clientName\""
                ];
            }
        }

        // 2. Deleted Rows
        foreach ($oldMap as $id => $row) {
            if (!isset($newMap[$id])) {
                $clientName = 'No Client';
                if (!empty($row['client_id'])) {
                    $clientName = Client::find($row['client_id'])?->name ?? "Client #{$row['client_id']}";
                }
                $changes[] = [
                    'type' => 'row_deleted',
                    'message' => "Deleted row for Client: \"$clientName\""
                ];
            }
        }

        // 3. Updated Rows
        foreach ($newMap as $id => $newRow) {
            if (isset($oldMap[$id])) {
                $oldRow = $oldMap[$id];
                $diffs = [];

                // Compare client_id
                $oldClientVal = $oldRow['client_id'] ?? null;
                $newClientVal = $newRow['client_id'] ?? null;
                if ($oldClientVal != $newClientVal) {
                    $oldName = $oldClientVal ? (Client::find($oldClientVal)?->name ?? "Client #$oldClientVal") : 'None';
                    $newName = $newClientVal ? (Client::find($newClientVal)?->name ?? "Client #$newClientVal") : 'None';
                    $diffs[] = "Client changed from \"$oldName\" to \"$newName\"";
                }

                // Compare work_type_id
                $oldWtVal = $oldRow['work_type_id'] ?? null;
                $newWtVal = $newRow['work_type_id'] ?? null;
                if ($oldWtVal != $newWtVal) {
                    $oldName = $oldWtVal ? (WorkType::find($oldWtVal)?->name ?? "WorkType #$oldWtVal") : 'None';
                    $newName = $newWtVal ? (WorkType::find($newWtVal)?->name ?? "WorkType #$newWtVal") : 'None';
                    $diffs[] = "Work Type changed from \"$oldName\" to \"$newName\"";
                }

                // Compare allocated_to
                $oldAllocVal = $oldRow['allocated_to'] ?? null;
                $newAllocVal = $newRow['allocated_to'] ?? null;
                $oldAllocType = $oldRow['allocated_type'] ?? 'user';
                $newAllocType = $newRow['allocated_type'] ?? 'user';

                if ($oldAllocVal != $newAllocVal || $oldAllocType != $newAllocType) {
                    $oldStaff = self::formatAllocated($oldAllocVal, $oldAllocType);
                    $newStaff = self::formatAllocated($newAllocVal, $newAllocType);
                    $diffs[] = "Assignee changed from \"$oldStaff\" to \"$newStaff\"";
                }

                // Compare status
                $oldStatus = $oldRow['status'] ?? 'assigned';
                $newStatus = $newRow['status'] ?? 'assigned';
                if ($oldStatus !== $newStatus) {
                    $diffs[] = "Status changed from \"$oldStatus\" to \"$newStatus\"";
                }

                // Compare sub_status
                $oldSub = $oldRow['sub_status'] ?? $oldRow['dynamic_data']['Sub Status'] ?? $oldRow['dynamic_data']['static_sub_status'] ?? 'None';
                $newSub = $newRow['sub_status'] ?? $newRow['dynamic_data']['Sub Status'] ?? $newRow['dynamic_data']['static_sub_status'] ?? 'None';
                if ($oldSub !== $newSub) {
                    $diffs[] = "Sub Status changed from \"$oldSub\" to \"$newSub\"";
                }

                // Compare dynamic fields
                $oldData = $oldRow['dynamic_data'] ?? [];
                $newData = $newRow['dynamic_data'] ?? [];

                if (is_array($oldData) && is_array($newData)) {
                    foreach ($newData as $key => $newVal) {
                        if (in_array($key, ['Sub Status', 'static_sub_status'])) continue;
                        $oldVal = $oldData[$key] ?? null;
                        if ($newVal != $oldVal) {
                            $oldStr = is_array($oldVal) ? json_encode($oldVal) : (string)$oldVal;
                            $newStr = is_array($newVal) ? json_encode($newVal) : (string)$newVal;
                            if (empty($oldStr)) $oldStr = 'empty';
                            if (empty($newStr)) $newStr = 'empty';
                            $diffs[] = "Field \"$key\" changed from \"$oldStr\" to \"$newStr\"";
                        }
                    }
                }

                if (!empty($diffs)) {
                    $clientName = 'No Client';
                    if (!empty($newRow['client_id'])) {
                        $clientName = Client::find($newRow['client_id'])?->name ?? "Client #{$newRow['client_id']}";
                    }
                    $changes[] = [
                        'type' => 'row_updated',
                        'message' => "Updated Row (Client: \"$clientName\"): " . implode('; ', $diffs)
                    ];
                }
            }
        }

        // If changes were detected, insert into database
        if (!empty($changes)) {
            SheetLog::create([
                'task_id' => $task->id,
                'sheet_name' => $task->form_name,
                'user_id' => $user?->id,
                'user_name' => $user?->name ?? 'System',
                'action' => count($changes) > 1 ? 'bulk_update' : $changes[0]['type'],
                'details' => $changes,
            ]);
        }
    }

    private static function formatAllocated($val, $type)
    {
        if (empty($val)) return 'None';
        if ($type === 'user') {
            return User::find($val)?->name ?? "Staff #$val";
        }
        if ($type === 'users') {
            if (is_array($val)) {
                $names = [];
                foreach ($val as $id) {
                    $names[] = User::find($id)?->name ?? "Staff #$id";
                }
                return implode(', ', $names);
            }
            return User::find($val)?->name ?? "Staff #$val";
        }
        if ($type === 'role') {
            $roleObj = \Illuminate\Support\Facades\DB::table('roles')->where('id', $val)->first();
            return $roleObj ? "Dept: {$roleObj->name}" : "Dept #$val";
        }
        return 'None';
    }
}
