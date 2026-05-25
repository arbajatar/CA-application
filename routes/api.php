<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CA\ClientController;
use App\Http\Controllers\Api\CA\DashboardController;
use App\Http\Controllers\Api\CA\SettingsController;
use App\Http\Controllers\Api\CA\PortalController;
use App\Http\Controllers\Api\CA\StaffController;
use App\Http\Controllers\Api\CA\RoleController;
use App\Http\Controllers\Api\CA\TaskController;
use App\Http\Controllers\Api\CA\SubTaskController as CASubTaskController;
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

    Route::get('/sub-task-sub-statuses', function () {
        $subStatuses = \App\Models\SubTask::whereNotNull('sub_status')
            ->where('sub_status', '!=', '')
            ->distinct()
            ->pluck('sub_status');
        return response()->json(['data' => $subStatuses]);
    });

    // Portals list accessible to all authenticated users
    Route::get('/ca/portals', [\App\Http\Controllers\Api\CA\PortalController::class, 'index']);

    // ── CA / Admin routes ────────────────────────────────────────
    Route::middleware('role:ca')->prefix('ca')->name('ca.')->group(function () {

        // Dashboard
        Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
        Route::get('/dashboard/staff-summary', [DashboardController::class, 'staffSummary']);
        Route::get('/dashboard/tasks', [DashboardController::class, 'tasks']);
        Route::get('/dashboard/work-type-subtasks', [DashboardController::class, 'workTypeSubtasks']);
        Route::get('/dashboard/calendar-tasks', [DashboardController::class, 'calendarTasks']);

        // Clients
        Route::get('/clients/pan-numbers', [ClientController::class, 'panNumbers']);
        Route::post('/clients/bulk-store', [ClientController::class, 'bulkStore']);
        Route::apiResource('/clients', ClientController::class);
        Route::get('/client-types', [ClientController::class, 'types']);
        Route::post('/client-types', [ClientController::class, 'storeType']);
        Route::get('/client-groups', [ClientController::class, 'groups']);
        Route::post('/client-groups', [ClientController::class, 'storeGroup']);
        // Recycle Bin
        Route::get('/recycle-bin/clients', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'indexClients']);
        Route::post('/recycle-bin/clients/{id}/restore', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'restoreClient']);
        Route::delete('/recycle-bin/clients/{id}/force-delete', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'forceDeleteClient']);
        Route::get('/recycle-bin/tasks', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'indexTasks']);
        Route::post('/recycle-bin/tasks/{id}/restore', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'restoreTask']);
        Route::delete('/recycle-bin/tasks/{id}/force-delete', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'forceDeleteTask']);

        // Reports
        Route::get('/reports/timesheet', [\App\Http\Controllers\Api\CA\ReportController::class, 'timesheet']);
        Route::get('/reports/tasks', [\App\Http\Controllers\Api\CA\ReportController::class, 'taskReport']);

        // Tasks
        Route::patch('/tasks/{task}/reassign', [TaskController::class, 'reassign']);
        Route::post('/tasks/import', [TaskController::class, 'import']);
        Route::apiResource('/tasks', TaskController::class);
        Route::post('/tasks/{task}/sub-tasks', [CASubTaskController::class, 'store']);
        Route::patch('/tasks/{task}/sub-tasks/{sub_task}', [CASubTaskController::class, 'update']);
        Route::delete('/tasks/{task}/sub-tasks/{sub_task}', [CASubTaskController::class, 'destroy']);

        // Staff
        Route::patch('/staff/{staff}/deactivate', [StaffController::class, 'deactivate']);
        Route::patch('/staff/{staff}/activate', [StaffController::class, 'activate']);
        Route::patch('/staff/{staff}/reset-password', [StaffController::class, 'resetPassword']);
        Route::apiResource('/staff', StaffController::class)->except(['destroy']);

        // Roles
        Route::apiResource('/roles', RoleController::class);

        // Work Types
        Route::patch('/work-types/{work_type}/toggle', [WorkTypeController::class, 'toggle']);
        Route::apiResource('/work-types', WorkTypeController::class)->except(['destroy', 'show']);

        // Settings
        Route::patch('/settings/change-password', [SettingsController::class, 'changePassword']);

        // Portals
        Route::apiResource('/portals', PortalController::class)->except(['index']);

        // Things to Know Videos & Brochures
        Route::post('/things-to-know/videos', [\App\Http\Controllers\Api\Common\ThingsToKnowVideoController::class, 'store']);
        Route::delete('/things-to-know/videos/{video}', [\App\Http\Controllers\Api\Common\ThingsToKnowVideoController::class, 'destroy']);
        Route::post('/things-to-know/brochures', [\App\Http\Controllers\Api\Common\ThingsToKnowBrochureController::class, 'store']);
        Route::delete('/things-to-know/brochures/{brochure}', [\App\Http\Controllers\Api\Common\ThingsToKnowBrochureController::class, 'destroy']);
    });

    // ── Common routes (any role) ─────────────────────────────────────────────
    Route::get('/things-to-know/videos', [\App\Http\Controllers\Api\Common\ThingsToKnowVideoController::class, 'index']);
    Route::get('/things-to-know/brochures', [\App\Http\Controllers\Api\Common\ThingsToKnowBrochureController::class, 'index']);

    // ── Staff routes  ─────────────────────────────────────────────
    Route::middleware('role:staff')->prefix('staff')->name('staff.')->group(function () {

        // Dashboard
        Route::get('/dashboard', [App\Http\Controllers\Api\Staff\DashboardController::class, 'summary']);

        // Tasks
        Route::get('/tasks', [App\Http\Controllers\Api\Staff\TaskController::class, 'index']);
        Route::get('/tasks/{task}', [App\Http\Controllers\Api\Staff\TaskController::class, 'show']);
        Route::patch('/tasks/{task}/status', [App\Http\Controllers\Api\Staff\TaskController::class, 'updateStatus']);

        // Sub Tasks
        Route::get('/sub-tasks', [App\Http\Controllers\Api\Staff\SubTaskController::class, 'index']);
        Route::patch('/sub-tasks/{sub_task}/status', [App\Http\Controllers\Api\Staff\SubTaskController::class, 'updateStatus']);

        // Profile
        Route::get('/profile', [App\Http\Controllers\Api\Staff\ProfileController::class, 'show']);
        Route::patch('/profile/change-password', [App\Http\Controllers\Api\Staff\ProfileController::class, 'changePassword']);
    });

});