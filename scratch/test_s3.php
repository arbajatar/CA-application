<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

try {
    echo "Testing S3 upload...\n";
    $path = 'ca_application/test_upload_' . time() . '.txt';
    $content = 'Hello World ' . time();
    
    \Illuminate\Support\Facades\Storage::disk('s3')->put($path, $content, [
        'visibility' => 'public',
        'ContentType' => 'text/plain',
    ]);
    
    $url = \App\Helpers\UploadHelper::resolveUrl($path);
    echo "Uploaded URL: $url\n";
    
    echo "Fetching URL via file_get_contents...\n";
    // Create http context with SSL verify disabled for local test
    $context = stream_context_create([
        "ssl" => [
            "verify_peer" => false,
            "verify_peer_name" => false,
        ]
    ]);
    $response = file_get_contents($url, false, $context);
    echo "Response: $response\n";
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getPrevious() ? "PREVIOUS ERROR: " . $e->getPrevious()->getMessage() . "\n" : "";
}
