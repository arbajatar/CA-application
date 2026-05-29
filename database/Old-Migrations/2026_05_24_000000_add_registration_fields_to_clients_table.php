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
        Schema::table('clients', function (Blueprint $table) {
            $table->string('name_as_per_pan')->nullable()->after('name');
            $table->string('pan_no')->nullable()->unique()->after('name_as_per_pan');
            $table->string('type')->nullable()->after('pan_no');
            $table->string('group')->nullable()->after('type');
            $table->string('alternative_contact')->nullable()->after('contact');
            $table->string('reference_no')->nullable()->after('email');
            $table->string('pin_code')->nullable()->after('city');
            $table->string('state')->nullable()->after('pin_code');
            $table->json('credentials')->nullable()->after('gst_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn([
                'name_as_per_pan',
                'pan_no',
                'type',
                'group',
                'alternative_contact',
                'reference_no',
                'pin_code',
                'state',
                'credentials'
            ]);
        });
    }
};
