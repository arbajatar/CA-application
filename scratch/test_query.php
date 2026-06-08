<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    $tasks = App\Models\Task::all();
    foreach ($tasks as $t) {
        echo "Task ID: " . $t->id . "\n";
        echo "  due_date: " . ($t->due_date ? $t->due_date->toDateString() : 'NULL') . "\n";
        echo "  dynamic_fields: " . json_encode($t->dynamic_fields) . "\n";
    }
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
