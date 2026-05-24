<?php

namespace App\Http\Controllers\Api\CA;

use App\Enums\ClientStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\CA\StoreClientRequest;
use App\Http\Requests\CA\UpdateClientRequest;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ClientController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $clients = Client::query()
            ->when($request->filled('status'), fn($q) => $q->where('status', ClientStatus::from($request->status)))
            ->when($request->filled('search'), fn($q) => $q->where(function ($q) use ($request) {
                $q->where('name', 'like', '%' . $request->search . '%')
                    ->orWhere('contact', 'like', '%' . $request->search . '%');
            }))
            ->latest();

        $perPage = $request->get('per_page', 15);
        $clients = $perPage == -1 ? $clients->get() : $clients->paginate($perPage);

        return ClientResource::collection($clients);
    }

    public function store(StoreClientRequest $request): JsonResponse
    {
        $client = Client::create($request->validated());

        return response()->json(['message' => 'Client created successfully.', 'data' => new ClientResource($client)], 201);
    }

    public function show(Client $client): JsonResponse
    {
        return response()->json(['data' => new ClientResource($client)]);
    }

    public function update(UpdateClientRequest $request, Client $client): JsonResponse
    {
        $client->update($request->validated());

        return response()->json(['message' => 'Client updated successfully.', 'data' => new ClientResource($client)]);
    }

    public function destroy(Client $client): JsonResponse
    {
        $client->update(['status' => ClientStatus::Inactive->value]);
        $client->delete();

        return response()->json(['message' => 'Client archived successfully.']);
    }

    public function types(): JsonResponse
    {
        return response()->json(['data' => \App\Models\ClientType::all()]);
    }

    public function storeType(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:client_types,name',
            'pan_char' => 'nullable|string|size:1',
        ]);

        $type = \App\Models\ClientType::create($validated);
        return response()->json(['message' => 'Client Type created successfully.', 'data' => $type], 201);
    }

    public function groups(): JsonResponse
    {
        return response()->json(['data' => \App\Models\ClientGroup::all()]);
    }

    public function storeGroup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:client_groups,name',
        ]);

        $group = \App\Models\ClientGroup::create($validated);
        return response()->json(['message' => 'Client Group created successfully.', 'data' => $group], 201);
    }
}