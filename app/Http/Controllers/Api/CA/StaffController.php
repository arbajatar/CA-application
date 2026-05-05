<?php

namespace App\Http\Controllers\Api\CA;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\CA\ResetPasswordRequest;
use App\Http\Requests\CA\StoreStaffRequest;
use App\Http\Requests\CA\UpdateStaffRequest;
use App\Http\Resources\StaffResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class StaffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $staff = User::staff()
            ->when($request->filled('search'), fn($q) => $q->where(function ($q) use ($request) {
                $q->where('name', 'like', '%' . $request->search . '%')
                    ->orWhere('username', 'like', '%' . $request->search . '%');
            }))
            ->when($request->filled('is_active'), fn($q) => $q->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN)))
            ->latest()
            ->paginate($request->get('per_page', 15));

        return response()->json(StaffResource::collection($staff));
    }

    public function store(StoreStaffRequest $request): JsonResponse
    {
        $staff = User::create([
            'name' => $request->name,
            'username' => $request->username,
            'password' => Hash::make($request->password),
            'role' => UserRole::Staff,
            'is_active' => true,
        ]);

        return response()->json(['message' => 'Staff member created successfully.', 'data' => new StaffResource($staff)], 201);
    }

    public function update(UpdateStaffRequest $request, User $staff): JsonResponse
    {
        $staff->update($request->validated());

        return response()->json(['message' => 'Staff member updated successfully.', 'data' => new StaffResource($staff)]);
    }

    public function deactivate(User $staff): JsonResponse
    {
        $staff->update(['is_active' => false]);
        $staff->tokens()->delete();

        return response()->json(['message' => 'Staff member deactivated successfully.']);
    }

    public function resetPassword(ResetPasswordRequest $request, User $staff): JsonResponse
    {
        $staff->update(['password' => Hash::make($request->password)]);
        $staff->tokens()->delete();

        return response()->json(['message' => 'Password reset successfully.']);
    }
}