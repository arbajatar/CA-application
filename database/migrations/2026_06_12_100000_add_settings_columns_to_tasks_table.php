<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->boolean('is_billable')->default(false);
            $table->boolean('is_after_sales')->default(false);
            $table->boolean('allow_duplicate_clients')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn(['is_billable', 'is_after_sales', 'allow_duplicate_clients']);
        });
    }
};
