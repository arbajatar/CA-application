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
        Schema::create('backup_settings', function (Blueprint $table) {
            $table->id();
            $table->boolean('auto_backup_enabled')->default(false);
            $table->string('frequency')->default('daily');
            $table->string('time')->default('02:00');
            $table->integer('keep_backups_days')->default(7);
            $table->timestamps();
        });

        // Insert default record
        \Illuminate\Support\Facades\DB::table('backup_settings')->insert([
            'auto_backup_enabled' => false,
            'frequency' => 'daily',
            'time' => '02:00',
            'keep_backups_days' => 7,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('backup_settings');
    }
};
