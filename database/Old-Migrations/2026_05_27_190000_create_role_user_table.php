<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::disableForeignKeyConstraints();

        // 1. Create pivot table
        Schema::dropIfExists('role_user');
        Schema::create('role_user', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('role_id')->constrained('roles')->onDelete('cascade');
            $table->primary(['user_id', 'role_id']);
        });

        // 2. Migrate existing role associations
        $users = DB::table('users')->whereNotNull('role_id')->get();
        foreach ($users as $user) {
            DB::table('role_user')->insert([
                'user_id' => $user->id,
                'role_id' => $user->role_id,
            ]);
        }

        // 3. Drop single role_id link from users
        if (Schema::hasColumn('users', 'role_id')) {
            try {
                Schema::table('users', function (Blueprint $table) {
                    $table->dropForeign(['role_id']);
                });
            } catch (\Exception $e) {
                // Ignore if foreign key constraint does not exist
            }

            try {
                Schema::table('users', function (Blueprint $table) {
                    $table->dropColumn('role_id');
                });
            } catch (\Exception $e) {
                // Ignore if column drop fails
            }
        }

        Schema::enableForeignKeyConstraints();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::disableForeignKeyConstraints();

        // 1. Add single role_id link back to users
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')->nullable()->constrained('roles')->nullOnDelete();
        });

        // 2. Populate single role_id from pivot data (first active association)
        $roleUsers = DB::table('role_user')->get();
        foreach ($roleUsers as $ru) {
            DB::table('users')
                ->where('id', $ru->user_id)
                ->whereNull('role_id')
                ->update(['role_id' => $ru->role_id]);
        }

        // 3. Drop pivot table
        Schema::dropIfExists('role_user');

        Schema::enableForeignKeyConstraints();
    }
};
