<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\ChangePasswordRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class ProfileController extends Controller
{
    public function show(\Illuminate\Http\Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load('roles');
        return response()->json([
            'data' => new UserResource($user),
        ]);
    }

    public function update(\Illuminate\Http\Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'email' => ['nullable', 'email', 'max:255'],
            'mobile' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string'],
            'profile_photo' => ['nullable', 'image', 'max:2048'], // Max 2MB
        ]);

        $data = $request->only(['email', 'mobile', 'address']);

        if ($request->hasFile('profile_photo')) {
            if ($user->profile_photo) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($user->profile_photo);
            }
            $data['profile_photo'] = \App\Helpers\UploadHelper::upload($request->file('profile_photo'), 'profile_photos');
        }

        $user->update($data);

        return response()->json([
            'message' => 'Profile updated successfully.',
            'data' => new UserResource($user),
        ]);
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $user->update(['password' => Hash::make($request->password)]);

        // Revoke all other tokens except current session
        $currentTokenId = $user->currentAccessToken()->id;
        $user->tokens()->where('id', '!=', $currentTokenId)->delete();

        return response()->json(['message' => 'Password changed successfully.']);
    }
}