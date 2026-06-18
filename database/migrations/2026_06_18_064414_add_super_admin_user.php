<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('users')->insertOrIgnore([
            'name' => 'Super Admin',
            'username' => 'superadmin',
            'password' => Hash::make('superadmin@123'),
            'role' => 'super_admin',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('users')->where('username', 'superadmin')->delete();
    }
};
