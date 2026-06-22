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
            $table->boolean('s3_backup_enabled')->default(false)->after('keep_backups_days');
            $table->string('s3_frequency')->default('daily')->after('s3_backup_enabled');
            $table->string('s3_time')->default('02:00')->after('s3_frequency');
            $table->integer('s3_day_of_week')->default(0)->after('s3_time');
            $table->integer('s3_day_of_month')->default(1)->after('s3_day_of_week');
            $table->integer('s3_month_of_year')->default(1)->after('s3_day_of_month');
            $table->integer('s3_keep_backups_days')->default(7)->after('s3_month_of_year');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('backup_settings', function (Blueprint $table) {
            $table->dropColumn([
                's3_backup_enabled',
                's3_frequency',
                's3_time',
                's3_day_of_week',
                's3_day_of_month',
                's3_month_of_year',
                's3_keep_backups_days',
            ]);
        });
    }
};
