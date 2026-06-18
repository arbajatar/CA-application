<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\TaskStatus;
use App\Enums\TaskPriority;
use App\Http\Controllers\Controller;
use App\Http\Resources\SubTaskResource;
use App\Models\SubTask;
use App\Models\Task;
use App\Http\Controllers\Api\Staff\TaskController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

use App\Helpers\UploadHelper;

class SubTaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $subTasks = SubTask::where('assigned_to', $user->id)
            ->whereHas('task', function ($tq) use ($user) {
                $tq->where(function ($query) use ($user) {
                    $query->whereDoesntHave('permissions')
                        ->orWhereHas('permissions', function ($pq) use ($user) {
                            $roleIds = $user->roles()->pluck('roles.id')->toArray();
                            if (!empty($roleIds)) {
                                $pq->whereIn('role_id', $roleIds)
                                   ->where('can_read', true);
                            } else {
                                $pq->whereRaw('1 = 0');
                            }
                        });
                });
            })
            ->with('task.client', 'task.workType')
            ->latest()
            ->get();

        return response()->json([
            'data' => SubTaskResource::collection($subTasks),
        ]);
    }

    public function store(Request $request, Task $task): JsonResponse
    {
        $user = $request->user();

        // Ensure staff has access to this task
        if (!TaskController::doesUserHaveAccessToTask($task, $user)) {
            return response()->json(['message' => 'Unauthorized access to this task.'], 403);
        }

        // Check parent task write permission
        if ($task->permissions()->exists()) {
            $roleIds = $user->roles()->pluck('roles.id')->toArray();
            $hasWriteAccess = $task->permissions()
                ->whereIn('role_id', $roleIds)
                ->where('can_write', true)
                ->exists();
            if (!$hasWriteAccess) {
                return response()->json(['message' => 'You do not have write access to this sheet.'], 403);
            }
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'priority' => ['nullable', Rule::enum(TaskPriority::class)],
            'due_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::enum(TaskStatus::class)],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'sub_status' => ['nullable', 'string', 'max:255'],
        ]);

        $subTask = $task->subTasks()->create([
            'title' => $validated['title'],
            'assigned_to' => $validated['assigned_to'] ?? null,
            'priority' => $validated['priority'] ?? TaskPriority::Medium->value,
            'due_date' => $validated['due_date'] ?? null,
            'status' => $validated['status'] ?? TaskStatus::Pending->value,
            'remarks' => $validated['remarks'] ?? null,
            'sub_status' => $validated['sub_status'] ?? null,
        ]);

        return response()->json([
            'message' => 'Subtask created successfully.',
            'data' => new SubTaskResource($subTask->load('assignedTo')),
        ], 201);
    }

    public function updateStatus(Request $request, SubTask $subTask): JsonResponse
    {
        // Ensure subtask is assigned to this staff member
        if ($subTask->assigned_to !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized access to this subtask.'], 403);
        }

        // Lock verified tasks for staff
        if ($subTask->is_verified) {
            return response()->json(['message' => 'Verified tasks are locked and cannot be edited by staff.'], 403);
        }

        // Check parent task write permission
        $user = $request->user();
        $task = $subTask->task;
        if ($task && $task->permissions()->exists()) {
            $roleIds = $user->roles()->pluck('roles.id')->toArray();
            $hasWriteAccess = $task->permissions()
                ->whereIn('role_id', $roleIds)
                ->where('can_write', true)
                ->exists();
            if (!$hasWriteAccess) {
                return response()->json(['message' => 'You do not have write access to this sheet.'], 403);
            }
        }

        $validated = $request->validate([
            'status' => ['nullable', Rule::enum(TaskStatus::class)],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'screenshot' => ['nullable'],
            'sub_status' => ['nullable', 'string', 'max:255'],
            'is_verified' => ['nullable', 'boolean'],
        ]);

        $newStatus = $request->has('status') ? TaskStatus::from($validated['status']) : $subTask->status;
        
        $screenshotPath = $subTask->screenshot;
        if ($request->hasFile('screenshot')) {
            $newFile = UploadHelper::upload($request->file('screenshot'), 'task_screenshots');
            $existing = json_decode($subTask->screenshot, true);
            if (!is_array($existing)) {
                $existing = $subTask->screenshot ? [$subTask->screenshot] : [];
            }
            $existing[] = $newFile;
            $screenshotPath = json_encode($existing);
        } elseif ($request->has('screenshot')) {
            $screenshotPath = $request->input('screenshot');
        }

        $updateData = [
            'status' => $newStatus,
            'remarks' => $request->has('remarks') ? $validated['remarks'] : $subTask->remarks,
            'screenshot' => $screenshotPath,
            'sub_status' => $request->has('sub_status') ? $validated['sub_status'] : $subTask->sub_status,
        ];

        if ($request->has('is_verified')) {
            $updateData['is_verified'] = $request->boolean('is_verified');
        }

        if ($newStatus === TaskStatus::Complete && $subTask->status !== TaskStatus::Complete) {
            $updateData['completed_at'] = now();
        }

        $subTask->update($updateData);

        return response()->json([
            'message' => 'Subtask status updated successfully.',
            'data' => new SubTaskResource($subTask->load('assignedTo')),
        ]);
    }

    public function update(Request $request, Task $task, SubTask $subTask): JsonResponse
    {
        $user = $request->user();

        // Check if subtask belongs to task
        if ($subTask->task_id !== $task->id) {
            return response()->json(['message' => 'Subtask does not belong to this task.'], 400);
        }

        // Lock verified tasks for staff
        if ($subTask->is_verified) {
            return response()->json(['message' => 'Verified tasks are locked and cannot be edited by staff.'], 403);
        }

        // Check parent task write permission
        $perms = (new \App\Http\Resources\TaskResource($task))->getUserPermissions($user);
        if (!$perms['can_write']) {
            return response()->json(['message' => 'You do not have write access to this sheet.'], 403);
        }

        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'priority' => ['nullable', Rule::enum(TaskPriority::class)],
            'due_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::enum(TaskStatus::class)],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'sub_status' => ['nullable', 'string', 'max:255'],
            'screenshot' => ['nullable'],
            'is_verified' => ['nullable', 'boolean'],
        ]);

        if (isset($validated['status']) && $validated['status'] === TaskStatus::Complete->value && $subTask->status !== TaskStatus::Complete) {
            $validated['completed_at'] = now();
        }

        if ($request->hasFile('screenshot')) {
            $newFile = UploadHelper::upload($request->file('screenshot'), 'task_screenshots');
            $existing = json_decode($subTask->screenshot, true);
            if (!is_array($existing)) {
                $existing = $subTask->screenshot ? [$subTask->screenshot] : [];
            }
            $existing[] = $newFile;
            $validated['screenshot'] = json_encode($existing);
        } elseif ($request->has('screenshot')) {
            $validated['screenshot'] = $request->input('screenshot');
        }

        $subTask->update($validated);

        return response()->json([
            'message' => 'Subtask updated successfully.',
            'data' => new SubTaskResource($subTask->load('assignedTo')),
        ]);
    }

    public function destroy(Task $task, SubTask $subTask): JsonResponse
    {
        return response()->json(['message' => 'Staff members are not allowed to delete subtasks.'], 403);
    }
}

