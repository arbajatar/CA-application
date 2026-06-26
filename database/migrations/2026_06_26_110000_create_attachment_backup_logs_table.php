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
        Schema::create('attachment_backup_logs', function (Blueprint $table) {
            $table->id();
            $table->string('filename');
            $table->string('backup_by')->nullable();
            $table->string('action')->default('backup');
            $table->string('file_size')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attachment_backup_logs');
    }
};
