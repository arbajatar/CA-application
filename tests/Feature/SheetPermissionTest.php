<?php

namespace Tests\Feature;

use App\Enums\TaskStatus;
use App\Enums\TaskPriority;
use App\Enums\UserRole;
use App\Models\Client;
use App\Models\Role;
use App\Models\SheetPermission;
use App\Models\SubTask;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SheetPermissionTest extends TestCase
{
    use RefreshDatabase;

    private Role $roleAccountant;
    private Role $roleAuditor;
    private User $admin;
    private User $staffAccountant;
    private User $staffAuditor;
    private Client $client;
    private WorkType $workType;

    protected function setUp(): void
    {
        parent::setUp();

        // Create roles
        $this->roleAccountant = Role::create(['name' => 'Accountant']);
        $this->roleAuditor = Role::create(['name' => 'Auditor']);

        // Create admin user
        $this->admin = User::factory()->create([
            'role' => UserRole::CA,
        ]);

        // Create staff users with different roles
        $this->staffAccountant = User::factory()->create([
            'role' => UserRole::Staff,
            'role_id' => $this->roleAccountant->id,
            'is_active' => true,
        ]);

        $this->staffAuditor = User::factory()->create([
            'role' => UserRole::Staff,
            'role_id' => $this->roleAuditor->id,
            'is_active' => true,
        ]);

        $this->client = Client::create([
            'name' => 'Test Client',
            'contact' => '1234567890',
        ]);

        $this->workType = WorkType::create([
            'name' => 'Tax Audit',
        ]);
    }

    public function test_ca_admin_has_full_bypass_access()
    {
        // Create task with restricted permissions (neither role can read or write)
        $task = Task::create([
            'client_id' => $this->client->id,
            'work_type_id' => $this->workType->id,
            'form_name' => 'Form 10E',
            'allocated_to' => $this->staffAccountant->id,
            'created_by' => $this->admin->id,
            'status' => TaskStatus::Pending,
            'date_allocated' => now()->toDateString(),
        ]);

        SheetPermission::create([
            'task_id' => $task->id,
            'role_id' => $this->roleAccountant->id,
            'can_read' => false,
            'can_write' => false,
        ]);

        // CA/Admin should view task details
        $response = $this->actingAs($this->admin)
            ->getJson("/api/ca/tasks/{$task->id}");

        $response->assertStatus(200)
            ->assertJsonPath('data.user_permissions.can_read', true)
            ->assertJsonPath('data.user_permissions.can_write', true);
    }

    public function test_staff_can_read_sheet_if_permission_allows()
    {
        $task = Task::create([
            'client_id' => $this->client->id,
            'work_type_id' => $this->workType->id,
            'form_name' => 'Form 10E',
            'allocated_to' => $this->staffAccountant->id,
            'created_by' => $this->admin->id,
            'status' => TaskStatus::Pending,
            'date_allocated' => now()->toDateString(),
        ]);

        // Grant Accountant read access
        SheetPermission::create([
            'task_id' => $task->id,
            'role_id' => $this->roleAccountant->id,
            'can_read' => true,
            'can_write' => false,
        ]);

        // Accountant gets the task in list
        $responseList = $this->actingAs($this->staffAccountant)
            ->getJson('/api/staff/tasks');

        $responseList->assertStatus(200);
        $this->assertCount(1, $responseList->json('data'));

        // Accountant can show task detail
        $responseShow = $this->actingAs($this->staffAccountant)
            ->getJson("/api/staff/tasks/{$task->id}");

        $responseShow->assertStatus(200)
            ->assertJsonPath('data.user_permissions.can_read', true)
            ->assertJsonPath('data.user_permissions.can_write', false);
    }

    public function test_staff_cannot_read_sheet_if_permission_denies()
    {
        $task = Task::create([
            'client_id' => $this->client->id,
            'work_type_id' => $this->workType->id,
            'form_name' => 'Form 10E',
            'allocated_to' => $this->staffAccountant->id,
            'created_by' => $this->admin->id,
            'status' => TaskStatus::Pending,
            'date_allocated' => now()->toDateString(),
        ]);

        // Deny Accountant read access
        SheetPermission::create([
            'task_id' => $task->id,
            'role_id' => $this->roleAccountant->id,
            'can_read' => false,
            'can_write' => false,
        ]);

        // Accountant does NOT see task in list
        $responseList = $this->actingAs($this->staffAccountant)
            ->getJson('/api/staff/tasks');

        $responseList->assertStatus(200);
        $this->assertCount(0, $responseList->json('data'));

        // Accountant gets 403 on show task
        $responseShow = $this->actingAs($this->staffAccountant)
            ->getJson("/api/staff/tasks/{$task->id}");

        $responseShow->assertStatus(403);
    }

    public function test_staff_with_different_role_cannot_read_restricted_sheet()
    {
        // Accountant is assignee, but sheet has permissions configured for Auditor only
        $task = Task::create([
            'client_id' => $this->client->id,
            'work_type_id' => $this->workType->id,
            'form_name' => 'Form 10E',
            'allocated_to' => $this->staffAccountant->id,
            'created_by' => $this->admin->id,
            'status' => TaskStatus::Pending,
            'date_allocated' => now()->toDateString(),
        ]);

        SheetPermission::create([
            'task_id' => $task->id,
            'role_id' => $this->roleAuditor->id,
            'can_read' => true,
            'can_write' => true,
        ]);

        // Accountant does NOT see task in list
        $responseList = $this->actingAs($this->staffAccountant)
            ->getJson('/api/staff/tasks');

        $this->assertCount(0, $responseList->json('data'));

        // Accountant gets 403 on show task
        $responseShow = $this->actingAs($this->staffAccountant)
            ->getJson("/api/staff/tasks/{$task->id}");

        $responseShow->assertStatus(403);
    }

    public function test_staff_can_write_sheet_if_permission_allows()
    {
        $task = Task::create([
            'client_id' => $this->client->id,
            'work_type_id' => $this->workType->id,
            'form_name' => 'Form 10E',
            'allocated_to' => $this->staffAccountant->id,
            'created_by' => $this->admin->id,
            'status' => TaskStatus::Pending,
            'date_allocated' => now()->toDateString(),
        ]);

        SheetPermission::create([
            'task_id' => $task->id,
            'role_id' => $this->roleAccountant->id,
            'can_read' => true,
            'can_write' => true,
        ]);

        $response = $this->actingAs($this->staffAccountant)
            ->patchJson("/api/staff/tasks/{$task->id}/status", [
                'status' => TaskStatus::InProgress->value,
                'remarks' => 'Starting work',
            ]);

        $response->assertStatus(200);
        $this->assertEquals(TaskStatus::InProgress, $task->fresh()->status);
    }

    public function test_staff_cannot_write_sheet_if_permission_denies()
    {
        $task = Task::create([
            'client_id' => $this->client->id,
            'work_type_id' => $this->workType->id,
            'form_name' => 'Form 10E',
            'allocated_to' => $this->staffAccountant->id,
            'created_by' => $this->admin->id,
            'status' => TaskStatus::Pending,
            'date_allocated' => now()->toDateString(),
        ]);

        SheetPermission::create([
            'task_id' => $task->id,
            'role_id' => $this->roleAccountant->id,
            'can_read' => true,
            'can_write' => false,
        ]);

        $response = $this->actingAs($this->staffAccountant)
            ->patchJson("/api/staff/tasks/{$task->id}/status", [
                'status' => TaskStatus::InProgress->value,
                'remarks' => 'Trying to start work',
            ]);

        $response->assertStatus(403);
        $this->assertEquals(TaskStatus::Pending, $task->fresh()->status);
    }

    public function test_backward_compatibility_allows_read_write_if_no_permissions_configured()
    {
        $task = Task::create([
            'client_id' => $this->client->id,
            'work_type_id' => $this->workType->id,
            'form_name' => 'Form 10E',
            'allocated_to' => $this->staffAccountant->id,
            'created_by' => $this->admin->id,
            'status' => TaskStatus::Pending,
            'date_allocated' => now()->toDateString(),
        ]);

        // Verify task appears in staff task list
        $responseList = $this->actingAs($this->staffAccountant)
            ->getJson('/api/staff/tasks');

        $this->assertCount(1, $responseList->json('data'));

        // Verify staff can update status
        $responseUpdate = $this->actingAs($this->staffAccountant)
            ->patchJson("/api/staff/tasks/{$task->id}/status", [
                'status' => TaskStatus::InProgress->value,
                'remarks' => 'No permissions set, bypass works',
            ]);

        $responseUpdate->assertStatus(200);
        $this->assertEquals(TaskStatus::InProgress, $task->fresh()->status);
    }

    public function test_subtask_update_is_blocked_if_parent_sheet_write_is_denied()
    {
        $task = Task::create([
            'client_id' => $this->client->id,
            'work_type_id' => $this->workType->id,
            'form_name' => 'Form 10E',
            'allocated_to' => $this->staffAccountant->id,
            'created_by' => $this->admin->id,
            'status' => TaskStatus::Pending,
            'date_allocated' => now()->toDateString(),
        ]);

        $subtask = SubTask::create([
            'task_id' => $task->id,
            'title' => 'Collect documents',
            'assigned_to' => $this->staffAccountant->id,
            'status' => TaskStatus::Pending,
            'priority' => TaskPriority::Medium,
        ]);

        // Grant read but deny write permission to Accountant
        SheetPermission::create([
            'task_id' => $task->id,
            'role_id' => $this->roleAccountant->id,
            'can_read' => true,
            'can_write' => false,
        ]);

        // Attempting to update subtask status returns 403
        $response = $this->actingAs($this->staffAccountant)
            ->patchJson("/api/staff/sub-tasks/{$subtask->id}/status", [
                'status' => TaskStatus::InProgress->value,
            ]);

        $response->assertStatus(403);
        $this->assertEquals(TaskStatus::Pending, $subtask->fresh()->status);
    }

    public function test_subtask_update_is_allowed_if_parent_sheet_write_is_granted()
    {
        $task = Task::create([
            'client_id' => $this->client->id,
            'work_type_id' => $this->workType->id,
            'form_name' => 'Form 10E',
            'allocated_to' => $this->staffAccountant->id,
            'created_by' => $this->admin->id,
            'status' => TaskStatus::Pending,
            'date_allocated' => now()->toDateString(),
        ]);

        $subtask = SubTask::create([
            'task_id' => $task->id,
            'title' => 'Collect documents',
            'assigned_to' => $this->staffAccountant->id,
            'status' => TaskStatus::Pending,
            'priority' => TaskPriority::Medium,
        ]);

        // Grant read and write permission to Accountant
        SheetPermission::create([
            'task_id' => $task->id,
            'role_id' => $this->roleAccountant->id,
            'can_read' => true,
            'can_write' => true,
        ]);

        $response = $this->actingAs($this->staffAccountant)
            ->patchJson("/api/staff/sub-tasks/{$subtask->id}/status", [
                'status' => TaskStatus::InProgress->value,
            ]);

        $response->assertStatus(200);
        $this->assertEquals(TaskStatus::InProgress, $subtask->fresh()->status);
    }

    public function test_admin_can_create_task_with_permissions()
    {
        $payload = [
            'client_id' => $this->client->id,
            'work_type_id' => $this->workType->id,
            'form_name' => 'Form 10E',
            'allocated_to' => $this->staffAccountant->id,
            'date_inward' => now()->toDateString(),
            'date_allocated' => now()->toDateString(),
            'priority' => 'medium',
            'permissions' => [
                [
                    'role_id' => $this->roleAccountant->id,
                    'can_read' => true,
                    'can_write' => false,
                    'can_delete' => false,
                ],
                [
                    'role_id' => $this->roleAuditor->id,
                    'can_read' => true,
                    'can_write' => true,
                    'can_delete' => true,
                ],
            ]
        ];

        $response = $this->actingAs($this->admin)
            ->postJson('/api/ca/tasks', $payload);

        $response->assertStatus(201);

        $task = Task::latest()->first();
        $this->assertCount(2, $task->permissions);
        $this->assertDatabaseHas('sheet_permissions', [
            'task_id' => $task->id,
            'role_id' => $this->roleAccountant->id,
            'can_read' => true,
            'can_write' => false,
        ]);
    }

    public function test_user_resource_returns_custom_role_details()
    {
        $response = $this->actingAs($this->staffAccountant)
            ->getJson('/api/me');

        $response->assertStatus(200)
            ->assertJsonPath('user.role_id', $this->roleAccountant->id)
            ->assertJsonPath('user.role_label', 'Accountant');

        $responseProfile = $this->actingAs($this->staffAccountant)
            ->getJson('/api/staff/profile');

        $responseProfile->assertStatus(200)
            ->assertJsonPath('data.role_id', $this->roleAccountant->id)
            ->assertJsonPath('data.role_label', 'Accountant');
    }
}
