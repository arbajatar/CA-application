<?php

namespace App\Http\Controllers\Api\CA;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\CA\ResetPasswordRequest;
use App\Http\Requests\CA\StoreStaffRequest;
use App\Http\Requests\CA\UpdateStaffRequest;
use App\Http\Resources\StaffResource;
use App\Models\User;
use App\Models\Task;
use App\Helpers\RealtimeHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class StaffController extends Controller
{
    public function index(Request $request)
    {
        if ($request->boolean('simple')) {
            $staff = User::where('is_active', true)
                ->whereIn('role', [\App\Enums\UserRole::Staff, \App\Enums\UserRole::CA])
                ->orderBy('name')
                ->get(['id', 'name']);
            return response()->json(['data' => $staff]);
        }

        $staff = User::staff()
            ->with(['roles', 'specialPermissions'])
            ->when($request->filled('search'), fn($q) => $q->where(function ($q) use ($request) {
                $q->where('name', 'like', '%' . $request->search . '%')
                    ->orWhere('username', 'like', '%' . $request->search . '%');
            }))
            ->when($request->filled('is_active'), fn($q) => $q->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN)))
            ->when($request->filled('role_id'), fn($q) => $q->whereHas('roles', fn($rq) => $rq->where('roles.id', $request->role_id)))
            ->latest();

        $perPage = $request->get('per_page', 15);
        $staff = $perPage == -1 ? $staff->get() : $staff->paginate($perPage);

        return StaffResource::collection($staff);
    }

    public function store(StoreStaffRequest $request): JsonResponse
    {
        $staff = User::create([
            'name' => $request->name,
            'username' => $request->username,
            'password' => Hash::make($request->password),
            'role' => UserRole::Staff,
            'is_active' => true,
            'employee_code' => $request->employee_code,
            'address' => $request->address,
            'email' => $request->email,
            'mobile' => $request->mobile,
        ]);
        $staff->roles()->sync($request->input('role_ids', []));
        $staff->specialPermissions()->create($request->only([
            'create_sheet',
            'edit_sheet',
            'delete_sheet',
            'import_export_sheet',
        ]));

        RealtimeHelper::trigger('staff_changed');

        return response()->json(['message' => 'Staff member created successfully.', 'data' => new StaffResource($staff->load(['roles', 'specialPermissions']))], 201);
    }

    public function update(UpdateStaffRequest $request, User $staff): JsonResponse
    {
        $staff->update($request->only(['name', 'username', 'employee_code', 'address', 'email', 'mobile']));
        $staff->roles()->sync($request->input('role_ids', []));
        $staff->specialPermissions()->updateOrCreate(
            ['staff_id' => $staff->id],
            $request->only([
                'create_sheet',
                'edit_sheet',
                'delete_sheet',
                'import_export_sheet',
            ])
        );

        RealtimeHelper::trigger('staff_changed');

        return response()->json(['message' => 'Staff member updated successfully.', 'data' => new StaffResource($staff->load(['roles', 'specialPermissions']))]);
    }

    public function deactivate(User $staff): JsonResponse
    {
        $staff->update(['is_active' => false]);
        $staff->tokens()->delete();

        RealtimeHelper::trigger('staff_changed');

        return response()->json(['message' => 'Staff member deactivated successfully.']);
    }

    public function activate(User $staff): JsonResponse
    {
        $staff->update(['is_active' => true]);

        RealtimeHelper::trigger('staff_changed');

        return response()->json(['message' => 'Staff member activated successfully.']);
    }

    public function resetPassword(ResetPasswordRequest $request, User $staff): JsonResponse
    {
        $staff->update(['password' => Hash::make($request->password)]);
        $staff->tokens()->delete();

        RealtimeHelper::trigger('staff_changed');

        return response()->json(['message' => 'Password reset successfully.']);
    }

    public function destroy(User $staff): JsonResponse
    {
        $staffId = $staff->id;
        $staffIdStr = (string)$staffId;

        // 1. Check direct task allocation
        $hasAllocatedTask = Task::where('allocated_to', $staffId)->exists();
        if ($hasAllocatedTask) {
            return response()->json([
                'message' => "Cannot delete staff member \"{$staff->name}\" because they are assigned to one or more tasks. Please reassign their tasks first or deactivate them."
            ], 422);
        }

        // 2. Check row-level allocation in dynamic_fields->multi_rows
        $allTasks = Task::select(['id', 'form_name', 'dynamic_fields'])->get();
        foreach ($allTasks as $task) {
            $multiRows = $task->dynamic_fields['multi_rows'] ?? [];
            if (is_array($multiRows)) {
                foreach ($multiRows as $row) {
                    $allocTo = $row['allocated_to'] ?? null;
                    if ($allocTo !== null && (string)$allocTo === $staffIdStr) {
                        $sheetName = $task->form_name ? "\"{$task->form_name}\"" : "Sheet #{$task->id}";
                        return response()->json([
                            'message' => "Cannot delete staff member \"{$staff->name}\" because they are assigned to rows in {$sheetName}. Please reassign their assigned rows first or deactivate them."
                        ], 422);
                    }
                }
            }
        }

        // 3. Delete staff dependencies and user record
        $staff->roles()->detach();
        $staff->specialPermissions()->delete();
        $staff->tokens()->delete();
        $staff->delete();

        RealtimeHelper::trigger('staff_changed');

        return response()->json([
            'message' => "Staff member \"{$staff->name}\" deleted successfully."
        ]);
    }
}