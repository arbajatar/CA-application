<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CA\ClientController;
use App\Http\Controllers\Api\CA\DashboardController;
use App\Http\Controllers\Api\CA\SettingsController;
use App\Http\Controllers\Api\CA\StaffController;
use App\Http\Controllers\Api\CA\TaskController;
use App\Http\Controllers\Api\CA\WorkTypeController;
use Illuminate\Support\Facades\Route;

// ── Public routes ──────────────────────────────────────────────────────────
Route::post('/login', [AuthController::class, 'login']);

// ── Authenticated routes ───────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // ── Utility (any role) ───────────────────────────────────────────────────
    Route::get('/task-status-transitions', function () {
        $transitions = [];
        foreach (\App\Enums\TaskStatus::cases() as $status) {
            $transitions[$status->value] = array_map(
                fn($s) => ['value' => $s->value, 'label' => $s->label()],
                $status->allowedTransitions()
            );
        }
        return response()->json(['data' => $transitions]);
    });

    Route::get('/task-statuses', function () {
        return response()->json([
            'data' => array_map(
                fn($s) => ['value' => $s->value, 'label' => $s->label()],
                \App\Enums\TaskStatus::cases()
            )
        ]);
    });

    // ── CA / Admin routes ────────────────────────────────────────
    Route::middleware('role:ca')->prefix('ca')->name('ca.')->group(function () {

        // Dashboard
        Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
        Route::get('/dashboard/staff-summary', [DashboardController::class, 'staffSummary']);
        Route::get('/dashboard/tasks', [DashboardController::class, 'tasks']);

        // Clients
        Route::apiResource('/clients', ClientController::class);

        // Tasks
        Route::patch('/tasks/{task}/reassign', [TaskController::class, 'reassign']);
        Route::apiResource('/tasks', TaskController::class);

        // Staff
        Route::patch('/staff/{staff}/deactivate', [StaffController::class, 'deactivate']);
        Route::patch('/staff/{staff}/reset-password', [StaffController::class, 'resetPassword']);
        Route::apiResource('/staff', StaffController::class)->except(['destroy']);

        // Work Types
        Route::patch('/work-types/{work_type}/toggle', [WorkTypeController::class, 'toggle']);
        Route::apiResource('/work-types', WorkTypeController::class)->except(['destroy', 'show']);

        // Settings
        Route::patch('/settings/change-password', [SettingsController::class, 'changePassword']);
    });

    // ── Staff routes  ─────────────────────────────────────────────
    Route::middleware('role:staff')->prefix('staff')->name('staff.')->group(function () {

        // Dashboard
        Route::get('/dashboard', [App\Http\Controllers\Api\Staff\DashboardController::class, 'summary']);

        // Tasks
        Route::get('/tasks', [App\Http\Controllers\Api\Staff\TaskController::class, 'index']);
        Route::get('/tasks/{task}', [App\Http\Controllers\Api\Staff\TaskController::class, 'show']);
        Route::patch('/tasks/{task}/status', [App\Http\Controllers\Api\Staff\TaskController::class, 'updateStatus']);

        // Profile
        Route::get('/profile', [App\Http\Controllers\Api\Staff\ProfileController::class, 'show']);
        Route::patch('/profile/change-password', [App\Http\Controllers\Api\Staff\ProfileController::class, 'changePassword']);
    });

});