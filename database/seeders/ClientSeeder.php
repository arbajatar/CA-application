<?php

namespace Database\Seeders;

use App\Enums\ClientStatus;
use App\Models\Client;
use Illuminate\Database\Seeder;

class ClientSeeder extends Seeder
{
    public function run(): void
    {
        $clients = config('seeder.clients');

        foreach ($clients as $client) {
            Client::firstOrCreate(
                ['name' => $client['name']],
                [
                    'contact' => $client['contact'] ?? null,
                    'gst_number' => $client['gst_number'] ?? null,
                    'status' => ClientStatus::Active,
                ]
            );
        }
    }
}
