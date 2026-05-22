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
        Schema::table('things_to_know_videos', function (Blueprint $table) {
            $table->string('group_name')->nullable()->default('General')->after('title');
        });

        Schema::table('things_to_know_brochures', function (Blueprint $table) {
            $table->string('group_name')->nullable()->default('General')->after('title');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('things_to_know_videos', function (Blueprint $table) {
            $table->dropColumn('group_name');
        });

        Schema::table('things_to_know_brochures', function (Blueprint $table) {
            $table->dropColumn('group_name');
        });
    }
};
