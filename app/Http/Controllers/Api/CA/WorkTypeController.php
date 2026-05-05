<?php

namespace App\Http\Controllers\Api\CA;

use App\Http\Controllers\Controller;
use App\Http\Requests\CA\StoreWorkTypeRequest;
use App\Http\Requests\CA\UpdateWorkTypeRequest;
use App\Http\Resources\WorkTypeResource;
use App\Models\WorkType;
use Illuminate\Http\JsonResponse;

use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class WorkTypeController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $workTypes = WorkType::orderBy('name')->get();

        return WorkTypeResource::collection($workTypes);
    }

    public function store(StoreWorkTypeRequest $request): JsonResponse
    {
        $workType = WorkType::create(['name' => $request->name, 'is_active' => true]);

        return response()->json(['message' => 'Work type added successfully.', 'data' => new WorkTypeResource($workType)], 201);
    }

    public function update(UpdateWorkTypeRequest $request, WorkType $workType): JsonResponse
    {
        $workType->update(['name' => $request->name]);

        return response()->json(['message' => 'Work type updated successfully.', 'data' => new WorkTypeResource($workType)]);
    }

    public function toggle(WorkType $workType): JsonResponse
    {
        $workType->update(['is_active' => !$workType->is_active]);
        $status = $workType->is_active ? 'activated' : 'deactivated';

        return response()->json(['message' => "Work type {$status} successfully.", 'data' => new WorkTypeResource($workType)]);
    }
}