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
        Schema::table('backup_settings', function (Blueprint $table) {
            $table->integer('day_of_week')->default(0)->after('time'); // 0 = Sunday, 1 = Monday, etc.
            $table->integer('day_of_month')->default(1)->after('day_of_week'); // 1 to 31
            $table->integer('month_of_year')->default(1)->after('day_of_month'); // 1 = Jan, 2 = Feb, etc.
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('backup_settings', function (Blueprint $table) {
            $table->dropColumn(['day_of_week', 'day_of_month', 'month_of_year']);
        });
    }
};
