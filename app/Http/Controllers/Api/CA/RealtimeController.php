<?php

namespace App\Http\Controllers\Api\CA;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RealtimeController extends Controller
{
    /**
     * Check for any new real-time event signals since the last checked ID.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function check(Request $request): JsonResponse
    {
        $lastId = $request->query('last_id');

        // If no last_id is provided, start from the current maximum ID (fresh connection)
        if ($lastId === null || $lastId === '') {
            $maxId = DB::table('realtime_updates')->max('id') ?? 0;
            return response()->json([
                'events' => [],
                'last_id' => (int) $maxId
            ]);
        }

        $lastId = (int) $lastId;

        // Fetch new events
        $events = DB::table('realtime_updates')
            ->where('id', '>', $lastId)
            ->orderBy('id', 'asc')
            ->get(['id', 'event']);

        $newLastId = count($events) > 0 ? (int) $events->last()->id : $lastId;

        return response()->json([
            'events' => $events,
            'last_id' => $newLastId
        ]);
    }
}
