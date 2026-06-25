<?php

namespace App\Helpers;

use Illuminate\Support\Facades\DB;

class RealtimeHelper
{
    /**
     * Trigger a real-time event signal by logging it in the database.
     * Also automatically prunes older events to keep the table tiny.
     *
     * @param string $event
     * @return void
     */
    public static function trigger(string $event): void
    {
        try {
            // 1. Insert the new event signal
            DB::table('realtime_updates')->insert([
                'event' => $event,
                'created_at' => now(),
            ]);

            // 2. Prune events older than 1 hour (runs quickly in background of mutation)
            DB::table('realtime_updates')
                ->where('created_at', '<', now()->subHours(1))
                ->delete();
        } catch (\Exception $e) {
            // Prevent real-time failures from breaking core business operations
            report($e);
        }
    }
}
