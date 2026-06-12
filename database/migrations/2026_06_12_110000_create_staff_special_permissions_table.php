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
        Schema::create('staff_special_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->unique()->constrained('users')->onDelete('cascade');
            $table->boolean('create_sheet')->default(false);
            $table->boolean('edit_sheet')->default(false);
            $table->boolean('delete_sheet')->default(false);
            $table->boolean('import_export_sheet')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('staff_special_permissions');
    }
};
