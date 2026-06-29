<?php

namespace App\Helpers;

use Illuminate\Support\Facades\DB;

class RealtimeHelper
{
    /**
     * Trigger a real-time event signal by logging it in the database.
     * Appends the X-Client-Token to the event name to prevent self-reloading loops.
     * Also automatically prunes older events to keep the table tiny.
     *
     * @param string $event
     * @return void
     */
    public static function trigger(string $event): void
    {
        try {
            // Append client token if present in headers to ignore self-triggered sync loops
            $clientToken = request()->header('X-Client-Token');
            if ($clientToken) {
                $event = $event . ':' . $clientToken;
            }

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
