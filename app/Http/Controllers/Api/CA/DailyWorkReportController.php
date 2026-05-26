<?php

namespace App\Http\Controllers\Api\CA;

use App\Http\Controllers\Controller;
use App\Models\DailyWorkReport;
use App\Models\Client;
use App\Models\WorkType;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\Carbon;

class DailyWorkReportController extends Controller
{
    /**
     * Display a listing of the reports (with filters, sorting).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isCA = $user->role === \app\Enums\UserRole::CA || $user->role === 'ca';

        $query = DailyWorkReport::with(['user', 'client']);

        // Staff can only view their own logs
        if (!$isCA) {
            $query->where('user_id', $user->id);
        } else {
            // Admin filters
            if ($request->has('user_id') && $request->user_id) {
                $query->where('user_id', $request->user_id);
            }
        }

        // Common Filters
        if ($request->has('client_id') && $request->client_id) {
            $query->where('client_id', $request->client_id);
        }

        if ($request->has('status') && $request->status) {
            $query->where('status', $request->status);
        }

        if ($request->has('date') && $request->date) {
            $query->whereDate('date', $request->date);
        }

        if ($request->has('start_date') && $request->start_date) {
            $query->whereDate('date', '>=', $request->start_date);
        }

        if ($request->has('end_date') && $request->end_date) {
            $query->whereDate('date', '<=', $request->end_date);
        }

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('main_task', 'like', "%{$search}%")
                  ->orWhere('sub_task', 'like', "%{$search}%")
                  ->orWhere('client_name_custom', 'like', "%{$search}%")
                  ->orWhere('sub_task_description', 'like', "%{$search}%")
                  ->orWhere('final_remark', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('client', function ($cq) use ($search) {
                      $cq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        // Sorting
        $sortField = $request->get('sort_by', 'date');
        $sortOrder = $request->get('sort_order', 'desc');
        
        if (in_array($sortField, ['date', 'hours_taken', 'pct_completion', 'created_at'])) {
            $query->orderBy($sortField, $sortOrder);
        } else {
            $query->orderBy('date', 'desc');
        }

        $reports = $query->get()->map(function ($report) {
            return [
                'id' => $report->id,
                'user_id' => $report->user_id,
                'user_name' => $report->user?->name ?? 'Unknown',
                'date' => $report->date instanceof Carbon ? $report->date->format('Y-m-d') : (is_string($report->date) ? substr($report->date, 0, 10) : $report->date),
                'main_task' => $report->main_task,
                'sub_task' => $report->sub_task,
                'duration' => $report->duration,
                'start_time' => $report->start_time,
                'end_time' => $report->end_time,
                'hours_taken' => $report->hours_taken,
                'client_id' => $report->client_id,
                'client_name' => $report->client?->name ?? $report->client_name_custom ?? 'N/A',
                'client_name_custom' => $report->client_name_custom,
                'sub_task_description' => $report->sub_task_description,
                'status' => $report->status,
                'pct_completion' => $report->pct_completion,
                'final_remark' => $report->final_remark,
                'ca_review' => $report->ca_review,
                'ca_remark' => $report->ca_remark,
                'created_at' => $report->created_at->toDateTimeString(),
            ];
        });

        return response()->json([
            'data' => $reports
        ]);
    }

    /**
     * Store a newly created report log.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $isCA = $user->role === \app\Enums\UserRole::CA || $user->role === 'ca';

        $rules = [
            'date' => 'required|date',
            'main_task' => 'required|string|max:255',
            'sub_task' => 'nullable|string|max:255',
            'duration' => 'nullable|string|max:255',
            'start_time' => 'nullable|string|max:255',
            'end_time' => 'nullable|string|max:255',
            'client_id' => 'nullable|integer',
            'client_name_custom' => 'nullable|string|max:255',
            'sub_task_description' => 'nullable|string',
            'status' => 'required|string',
            'pct_completion' => 'nullable|integer|min:0|max:100',
            'final_remark' => 'nullable|string',
        ];

        if ($isCA) {
            $rules['user_id'] = 'required|integer';
        }

        $validated = $request->validate($rules);

        // Auto calculate hours if start_time & end_time provided
        $hours = null;
        if (!empty($validated['start_time']) && !empty($validated['end_time'])) {
            try {
                $start = Carbon::parse($validated['start_time']);
                $end = Carbon::parse($validated['end_time']);
                if ($end->greaterThan($start)) {
                    $hours = abs(round($start->diffInMinutes($end) / 60, 2));
                }
            } catch (\Exception $e) {
                // Ignore parsing errors
            }
        }
        $validated['hours_taken'] = $hours;

        if (!$isCA) {
            $validated['user_id'] = $user->id;
        }

        $report = DailyWorkReport::create($validated);

        return response()->json([
            'message' => 'Daily progress report logged successfully',
            'data' => $report
        ], 201);
    }

    /**
     * Update an existing report log (or review it).
     */
    public function update(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $isCA = $user->role === \app\Enums\UserRole::CA || $user->role === 'ca';

        $report = DailyWorkReport::findOrFail($id);

        // Access control
        if (!$isCA && $report->user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $rules = [
            'date' => 'sometimes|required|date',
            'main_task' => 'sometimes|required|string|max:255',
            'sub_task' => 'nullable|string|max:255',
            'duration' => 'nullable|string|max:255',
            'start_time' => 'nullable|string|max:255',
            'end_time' => 'nullable|string|max:255',
            'client_id' => 'nullable|integer',
            'client_name_custom' => 'nullable|string|max:255',
            'sub_task_description' => 'nullable|string',
            'status' => 'sometimes|required|string',
            'pct_completion' => 'nullable|integer|min:0|max:100',
            'final_remark' => 'nullable|string',
        ];

        if ($isCA) {
            $rules['ca_review'] = 'nullable|string|max:255';
            $rules['ca_remark'] = 'nullable|string';
        }

        $validated = $request->validate($rules);

        // Auto calculate hours if start_time & end_time provided
        $startVal = $request->has('start_time') ? $validated['start_time'] : $report->start_time;
        $endVal = $request->has('end_time') ? $validated['end_time'] : $report->end_time;
        if (!empty($startVal) && !empty($endVal)) {
            try {
                $start = Carbon::parse($startVal);
                $end = Carbon::parse($endVal);
                if ($end->greaterThan($start)) {
                    $validated['hours_taken'] = abs(round($start->diffInMinutes($end) / 60, 2));
                }
            } catch (\Exception $e) {
                // Ignore
            }
        }

        $report->update($validated);

        return response()->json([
            'message' => 'Report updated successfully',
            'data' => $report
        ]);
    }

    /**
     * Delete a report log.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $isCA = $user->role === \app\Enums\UserRole::CA || $user->role === 'ca';

        $report = DailyWorkReport::findOrFail($id);

        if (!$isCA && $report->user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $report->delete();

        return response()->json([
            'message' => 'Report log deleted successfully'
        ]);
    }
}
