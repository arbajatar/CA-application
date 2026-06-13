<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        try {
            Schema::table('tasks', function (Blueprint $table) {
                $table->dropForeign('tasks_client_id_foreign');
            });
        } catch (\Exception $e) {}

        try {
            Schema::table('tasks', function (Blueprint $table) {
                $table->dropForeign(['client_id']);
            });
        } catch (\Exception $e) {}

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn('client_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('client_id')->nullable()->constrained()->restrictOnDelete();
        });
    }
};
