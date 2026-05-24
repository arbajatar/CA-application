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

    public function panNumbers(): JsonResponse
    {
        $pans = Client::pluck('pan_no')->filter()->values()->map(fn($p) => strtoupper($p));
        return response()->json(['data' => $pans]);
    }

    public function bulkStore(Request $request): JsonResponse
    {
        $request->validate([
            'clients' => 'required|array',
            'clients.*.name' => 'required|string|max:255',
            'clients.*.pan_no' => 'required|string|max:10',
            'clients.*.type' => 'required|string|max:255',
            'clients.*.group' => 'required|string|max:255',
        ]);

        $imported = 0;
        foreach ($request->input('clients') as $c) {
            // Make sure the PAN number is unique before creating
            $pan = strtoupper($c['pan_no']);
            if (Client::where('pan_no', $pan)->exists()) {
                continue; // Skip duplicates defensively
            }

            // Create client record
            Client::create([
                'name' => $c['name'],
                'name_as_per_pan' => $c['name_as_per_pan'] ?? null,
                'pan_no' => $pan,
                'type' => $c['type'],
                'group' => $c['group'],
                'contact' => $c['contact'] ?? null,
                'alternative_contact' => $c['alternative_contact'] ?? null,
                'email' => $c['email'] ?? null,
                'reference_no' => $c['reference_no'] ?? null,
                'dob' => !empty($c['dob']) ? $c['dob'] : null,
                'city' => $c['city'] ?? null,
                'pin_code' => $c['pin_code'] ?? null,
                'state' => $c['state'] ?? null,
                'gst_number' => $c['gst_number'] ?? null,
                'status' => 'active',
                'credentials' => $c['credentials'] ?? [
                    'efiling_password' => '',
                    'ais_tis_password' => ''
                ]
            ]);
            $imported++;
        }

        return response()->json([
            'message' => "Successfully imported {$imported} clients.",
            'count' => $imported
        ]);
    }
}