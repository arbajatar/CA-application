<?php
$filepath = "app/Http/Controllers/Api/Staff/TaskController.php";
$query = "date_allocated";

$lines = file($filepath);
foreach ($lines as $i => $line) {
    if (strpos($line, $query) !== false) {
        echo ($i + 1) . ": " . trim($line) . "\n";
    }
}
