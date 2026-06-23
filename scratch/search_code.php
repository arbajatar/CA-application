<?php
$filepath = "resources/react/pages/ca/TaskDetailPage.jsx";
$query = "static_sub_status";

$lines = file($filepath);
foreach ($lines as $i => $line) {
    if (strpos($line, $query) !== false) {
        echo ($i + 1) . ": " . trim($line) . "\n";
    }
}
