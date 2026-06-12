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

    // Daily Work Progress Reports endpoints
    Route::get('/daily-reports', [\App\Http\Controllers\Api\CA\DailyWorkReportController::class, 'index']);
    Route::post('/daily-reports', [\App\Http\Controllers\Api\CA\DailyWorkReportController::class, 'store']);
    Route::patch('/daily-reports/{id}', [\App\Http\Controllers\Api\CA\DailyWorkReportController::class, 'update']);
    Route::delete('/daily-reports/{id}', [\App\Http\Controllers\Api\CA\DailyWorkReportController::class, 'destroy']);

    // Read-only dependency endpoints for daily reporting (accessible to staff & CA)
    Route::get('/daily-reports/clients', [ClientController::class, 'index']);
    Route::post('/daily-reports/clients', [ClientController::class, 'store']);
    Route::get('/daily-reports/client-types', [ClientController::class, 'types']);
    Route::get('/daily-reports/client-groups', [ClientController::class, 'groups']);
    Route::get('/daily-reports/work-types', [WorkTypeController::class, 'index']);

    // Team Checklist routes (accessible to staff & CA)
    Route::get('/team-checklists', [\App\Http\Controllers\Api\Common\TeamChecklistController::class, 'index']);
    Route::post('/team-checklists', [\App\Http\Controllers\Api\Common\TeamChecklistController::class, 'store']);
    Route::patch('/team-checklists/{teamChecklist}', [\App\Http\Controllers\Api\Common\TeamChecklistController::class, 'update']);
    Route::delete('/team-checklists/{teamChecklist}', [\App\Http\Controllers\Api\Common\TeamChecklistController::class, 'destroy']);
    Route::post('/team-checklists/upload-file', [\App\Http\Controllers\Api\Common\TeamChecklistController::class, 'uploadFile']);


    // Clients routes accessible by both CA and Staff (Read, Create, Update)
    Route::middleware('role:ca,staff')->prefix('ca')->group(function () {
        Route::get('/clients/pan-numbers', [ClientController::class, 'panNumbers']);
        Route::get('/clients', [ClientController::class, 'index']);
        Route::post('/clients', [ClientController::class, 'store']);
        Route::get('/clients/{client}', [ClientController::class, 'show']);
        Route::put('/clients/{client}', [ClientController::class, 'update']);
        Route::patch('/clients/{client}', [ClientController::class, 'update']);
        Route::get('/client-types', [ClientController::class, 'types']);
        Route::post('/client-types', [ClientController::class, 'storeType']);
        Route::put('/client-types/{type}', [ClientController::class, 'updateType']);
        Route::get('/client-groups', [ClientController::class, 'groups']);
        Route::post('/client-groups', [ClientController::class, 'storeGroup']);
        Route::put('/client-groups/{group}', [ClientController::class, 'updateGroup']);
        Route::post('/work-types', [WorkTypeController::class, 'store']);
    });

    // ── CA / Admin routes ────────────────────────────────────────
    Route::middleware('role:ca')->prefix('ca')->name('ca.')->group(function () {

        // Dashboard
        Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
        Route::get('/dashboard/staff-summary', [DashboardController::class, 'staffSummary']);
        Route::get('/dashboard/tasks', [DashboardController::class, 'tasks']);
        Route::get('/dashboard/work-type-subtasks', [DashboardController::class, 'workTypeSubtasks']);
        Route::get('/dashboard/calendar-tasks', [DashboardController::class, 'calendarTasks']);

        // Clients (Admin Only Operations)
        Route::post('/clients/bulk-store', [ClientController::class, 'bulkStore']);
        Route::post('/clients/bulk-delete', [ClientController::class, 'bulkDelete']);
        Route::delete('/clients/{client}', [ClientController::class, 'destroy']);
        Route::delete('/client-types/{type}', [ClientController::class, 'destroyType']);
        Route::delete('/client-groups/{group}', [ClientController::class, 'destroyGroup']);
        // Recycle Bin
        Route::post('/recycle-bin/{type}/bulk-restore', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'bulkRestore']);
        Route::post('/recycle-bin/{type}/bulk-force-delete', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'bulkForceDelete']);
        
        Route::get('/recycle-bin/clients', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'indexClients']);
        Route::post('/recycle-bin/clients/{id}/restore', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'restoreClient']);
        Route::delete('/recycle-bin/clients/{id}/force-delete', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'forceDeleteClient']);
        Route::get('/recycle-bin/tasks', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'indexTasks']);
        Route::post('/recycle-bin/tasks/{id}/restore', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'restoreTask']);
        Route::delete('/recycle-bin/tasks/{id}/force-delete', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'forceDeleteTask']);
        Route::get('/recycle-bin/work-types', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'indexWorkTypes']);
        Route::post('/recycle-bin/work-types/{id}/restore', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'restoreWorkType']);
        Route::delete('/recycle-bin/work-types/{id}/force-delete', [\App\Http\Controllers\Api\CA\RecycleBinController::class, 'forceDeleteWorkType']);

        // Reports
        Route::get('/reports/timesheet', [\App\Http\Controllers\Api\CA\ReportController::class, 'timesheet']);
        Route::get('/reports/tasks', [\App\Http\Controllers\Api\CA\ReportController::class, 'taskReport']);

        // Tasks
        Route::patch('/tasks/{task}/reassign', [TaskController::class, 'reassign']);
        Route::post('/tasks/import', [TaskController::class, 'import']);
        Route::post('/tasks/upload-file', [TaskController::class, 'uploadFile']);
        Route::apiResource('/tasks', TaskController::class);
        
        // Task Notes
        Route::post('/tasks/{task}/notes', [\App\Http\Controllers\Api\CA\TaskNoteController::class, 'store']);
        Route::patch('/task-notes/{taskNote}', [\App\Http\Controllers\Api\CA\TaskNoteController::class, 'update']);
        Route::delete('/task-notes/{taskNote}', [\App\Http\Controllers\Api\CA\TaskNoteController::class, 'destroy']);

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
        Route::apiResource('/work-types', WorkTypeController::class)->except(['show', 'store']);

        // Settings
        Route::patch('/settings/change-password', [SettingsController::class, 'changePassword']);

        // Portals
        Route::apiResource('/portals', PortalController::class)->except(['index']);

        // Things to Know Videos & Brochures
        Route::post('/things-to-know/videos', [\App\Http\Controllers\Api\Common\ThingsToKnowVideoController::class, 'store']);
        Route::put('/things-to-know/videos/{video}', [\App\Http\Controllers\Api\Common\ThingsToKnowVideoController::class, 'update']);
        Route::delete('/things-to-know/videos/{video}', [\App\Http\Controllers\Api\Common\ThingsToKnowVideoController::class, 'destroy']);
        Route::patch('/things-to-know/videos/group', [\App\Http\Controllers\Api\Common\ThingsToKnowVideoController::class, 'updateGroup']);
        Route::post('/things-to-know/brochures', [\App\Http\Controllers\Api\Common\ThingsToKnowBrochureController::class, 'store']);
        Route::post('/things-to-know/brochures/{brochure}', [\App\Http\Controllers\Api\Common\ThingsToKnowBrochureController::class, 'update']);
        Route::delete('/things-to-know/brochures/{brochure}', [\App\Http\Controllers\Api\Common\ThingsToKnowBrochureController::class, 'destroy']);
        Route::patch('/things-to-know/brochures/group', [\App\Http\Controllers\Api\Common\ThingsToKnowBrochureController::class, 'updateGroup']);
    });

    // ── Common routes (any role) ─────────────────────────────────────────────
    Route::get('/things-to-know/videos', [\App\Http\Controllers\Api\Common\ThingsToKnowVideoController::class, 'index']);
    Route::get('/things-to-know/brochures', [\App\Http\Controllers\Api\Common\ThingsToKnowBrochureController::class, 'index']);

    // ── Staff routes  ─────────────────────────────────────────────
    Route::middleware('role:staff')->prefix('staff')->name('staff.')->group(function () {

        Route::get('/dashboard/summary', [App\Http\Controllers\Api\Staff\DashboardController::class, 'summary']);
        Route::get('/dashboard/tasks', [App\Http\Controllers\Api\Staff\DashboardController::class, 'tasks']);
        Route::get('/dashboard/calendar-tasks', [App\Http\Controllers\Api\Staff\DashboardController::class, 'calendarTasks']);
        Route::get('/dashboard/staff-summary', [App\Http\Controllers\Api\Staff\DashboardController::class, 'staffSummary']);

        // Staff List (read-only for assignment)
        Route::get('/staff-members', [\App\Http\Controllers\Api\CA\StaffController::class, 'index']);

        // Roles (read-only for assignment)
        Route::get('/roles', [\App\Http\Controllers\Api\CA\RoleController::class, 'index']);
        // Tasks
        Route::get('/tasks', [App\Http\Controllers\Api\Staff\TaskController::class, 'index']);
        Route::post('/tasks', [App\Http\Controllers\Api\Staff\TaskController::class, 'store']);
        Route::post('/tasks/upload-file', [App\Http\Controllers\Api\Staff\TaskController::class, 'uploadFile']);
        Route::get('/tasks/{task}', [App\Http\Controllers\Api\Staff\TaskController::class, 'show']);
        Route::patch('/tasks/{task}', [App\Http\Controllers\Api\Staff\TaskController::class, 'update']);
        Route::patch('/tasks/{task}/status', [App\Http\Controllers\Api\Staff\TaskController::class, 'updateStatus']);
        Route::delete('/tasks/{task}', [App\Http\Controllers\Api\Staff\TaskController::class, 'destroy']);
        Route::get('/sub-tasks', [App\Http\Controllers\Api\Staff\SubTaskController::class, 'index']);
        Route::post('/tasks/{task}/sub-tasks', [App\Http\Controllers\Api\Staff\SubTaskController::class, 'store']);
        Route::patch('/tasks/{task}/sub-tasks/{sub_task}', [App\Http\Controllers\Api\Staff\SubTaskController::class, 'update']);
        Route::delete('/tasks/{task}/sub-tasks/{sub_task}', [App\Http\Controllers\Api\Staff\SubTaskController::class, 'destroy']);
        Route::patch('/sub-tasks/{sub_task}/status', [App\Http\Controllers\Api\Staff\SubTaskController::class, 'updateStatus']);

        // Profile
        Route::get('/profile', [App\Http\Controllers\Api\Staff\ProfileController::class, 'show']);
        Route::post('/profile', [App\Http\Controllers\Api\Staff\ProfileController::class, 'update']);
        Route::patch('/profile/change-password', [App\Http\Controllers\Api\Staff\ProfileController::class, 'changePassword']);

        // Things to Know Videos & Brochures
        Route::post('/things-to-know/videos', [\App\Http\Controllers\Api\Common\ThingsToKnowVideoController::class, 'store']);
        Route::put('/things-to-know/videos/{video}', [\App\Http\Controllers\Api\Common\ThingsToKnowVideoController::class, 'update']);
        Route::delete('/things-to-know/videos/{video}', [\App\Http\Controllers\Api\Common\ThingsToKnowVideoController::class, 'destroy']);
        Route::patch('/things-to-know/videos/group', [\App\Http\Controllers\Api\Common\ThingsToKnowVideoController::class, 'updateGroup']);
        Route::post('/things-to-know/brochures', [\App\Http\Controllers\Api\Common\ThingsToKnowBrochureController::class, 'store']);
        Route::post('/things-to-know/brochures/{brochure}', [\App\Http\Controllers\Api\Common\ThingsToKnowBrochureController::class, 'update']);
        Route::delete('/things-to-know/brochures/{brochure}', [\App\Http\Controllers\Api\Common\ThingsToKnowBrochureController::class, 'destroy']);
        Route::patch('/things-to-know/brochures/group', [\App\Http\Controllers\Api\Common\ThingsToKnowBrochureController::class, 'updateGroup']);
    });

});