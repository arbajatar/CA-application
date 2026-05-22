<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Alter tasks.status column to string (VARCHAR(255)) to avoid ENUM constraints and allow new values.
        DB::statement("ALTER TABLE tasks MODIFY COLUMN status VARCHAR(255) NOT NULL DEFAULT 'pending'");

        // 2. Change sub_tasks.status default to 'pending'
        DB::statement("ALTER TABLE sub_tasks MODIFY COLUMN status VARCHAR(255) NOT NULL DEFAULT 'pending'");

        // 3. Update existing data
        DB::table('tasks')->where('status', 'assigned')->update(['status' => 'pending']);
        DB::table('tasks')->where('status', 'in_progress')->update(['status' => 'work_in_progress']);
        DB::table('tasks')->where('status', 'awaiting_information')->update(['status' => 'pending']);
        DB::table('tasks')->where('status', 'completed')->update(['status' => 'complete']);

        DB::table('sub_tasks')->where('status', 'assigned')->update(['status' => 'pending']);
        DB::table('sub_tasks')->where('status', 'in_progress')->update(['status' => 'work_in_progress']);
        DB::table('sub_tasks')->where('status', 'awaiting_information')->update(['status' => 'pending']);
        DB::table('sub_tasks')->where('status', 'completed')->update(['status' => 'complete']);
    }

    public function down(): void
    {
        // 1. Revert values
        DB::table('tasks')->where('status', 'pending')->update(['status' => 'assigned']);
        DB::table('tasks')->where('status', 'work_in_progress')->update(['status' => 'in_progress']);
        DB::table('tasks')->where('status', 'complete')->update(['status' => 'completed']);
        DB::table('tasks')->where('status', 'not_to_be_done')->update(['status' => 'assigned']);
        DB::table('tasks')->where('status', 'other')->update(['status' => 'assigned']);

        DB::table('sub_tasks')->where('status', 'pending')->update(['status' => 'assigned']);
        DB::table('sub_tasks')->where('status', 'work_in_progress')->update(['status' => 'in_progress']);
        DB::table('sub_tasks')->where('status', 'complete')->update(['status' => 'completed']);
        DB::table('sub_tasks')->where('status', 'not_to_be_done')->update(['status' => 'assigned']);
        DB::table('sub_tasks')->where('status', 'other')->update(['status' => 'assigned']);

        // 2. Change back to enum (only the old values)
        DB::statement("ALTER TABLE tasks MODIFY COLUMN status ENUM('assigned', 'in_progress', 'awaiting_information', 'completed') NOT NULL DEFAULT 'assigned'");
        DB::statement("ALTER TABLE sub_tasks MODIFY COLUMN status VARCHAR(255) NOT NULL DEFAULT 'assigned'");
    }
};
