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
        Schema::table('backup_logs', function (Blueprint $table) {
            $table->string('action')->default('backup')->after('filename');
            $table->string('file_size')->nullable()->after('action');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('backup_logs', function (Blueprint $table) {
            $table->dropColumn(['action', 'file_size']);
        });
    }
};
