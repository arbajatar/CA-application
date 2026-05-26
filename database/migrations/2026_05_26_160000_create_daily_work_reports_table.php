<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_work_reports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->date('date');
            $table->string('main_task');
            $table->string('sub_task')->nullable();
            $table->string('duration')->nullable(); // e.g. "1st Half", "1 HRS"
            $table->string('start_time')->nullable();
            $table->string('end_time')->nullable();
            $table->decimal('hours_taken', 5, 2)->nullable();
            $table->unsignedBigInteger('client_id')->nullable();
            $table->string('client_name_custom')->nullable();
            $table->text('sub_task_description')->nullable();
            $table->string('status')->default('pending');
            $table->integer('pct_completion')->default(0);
            $table->text('final_remark')->nullable();
            $table->string('ca_review')->nullable();
            $table->text('ca_remark')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_work_reports');
    }
};
