<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Alter enum column
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('ca', 'staff', 'super_admin') NOT NULL;");

        // Update the superadmin user's role (which was set to "" due to restriction)
        DB::table('users')->where('username', 'superadmin')->update(['role' => 'super_admin']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Delete superadmin to avoid enum violation
        DB::table('users')->where('username', 'superadmin')->delete();

        // Revert enum column
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('ca', 'staff') NOT NULL;");
    }
};
