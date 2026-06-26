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
            $table->boolean('att_auto_backup_enabled')->default(false);
            $table->string('att_frequency')->default('daily');
            $table->string('att_time')->default('02:00');
            $table->integer('att_day_of_week')->default(0);
            $table->integer('att_day_of_month')->default(1);
            $table->integer('att_month_of_year')->default(1);
            $table->integer('att_keep_backups_days')->default(7);

            $table->boolean('att_s3_backup_enabled')->default(false);
            $table->string('att_s3_frequency')->default('daily');
            $table->string('att_s3_time')->default('02:00');
            $table->integer('att_s3_day_of_week')->default(0);
            $table->integer('att_s3_day_of_month')->default(1);
            $table->integer('att_s3_month_of_year')->default(1);
            $table->integer('att_s3_keep_backups_days')->default(7);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('backup_settings', function (Blueprint $table) {
            $table->dropColumn([
                'att_auto_backup_enabled',
                'att_frequency',
                'att_time',
                'att_day_of_week',
                'att_day_of_month',
                'att_month_of_year',
                'att_keep_backups_days',
                'att_s3_backup_enabled',
                'att_s3_frequency',
                'att_s3_time',
                'att_s3_day_of_week',
                'att_s3_day_of_month',
                'att_s3_month_of_year',
                'att_s3_keep_backups_days'
            ]);
        });
    }
};
