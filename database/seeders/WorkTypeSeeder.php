<?php

namespace Database\Seeders;

use App\Models\WorkType;
use Illuminate\Database\Seeder;

class WorkTypeSeeder extends Seeder
{
    public function run(): void
    {
        $workTypes = config('seeder.work_types');

        foreach ($workTypes as $name) {
            WorkType::firstOrCreate(['name' => $name], ['is_active' => true]);
        }
    }
}
