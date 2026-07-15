<?php

namespace App\Http\Controllers\Api\CA;

use App\Enums\ClientStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\CA\StoreClientRequest;
use App\Http\Requests\CA\UpdateClientRequest;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use App\Helpers\RealtimeHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        if ($request->boolean('simple')) {
            $clients = Client::where('status', \App\Enums\ClientStatus::Active)
                ->orderBy('name')
                ->get(['id', 'name', 'pan_no']);
            return response()->json(['data' => $clients]);
        }

        $clients = Client::query()
            ->when($request->filled('status'), fn($q) => $q->where('status', ClientStatus::from($request->status)))
            ->when($request->filled('group'), fn($q) => $q->where('group', $request->input('group')))
            ->when($request->filled('type'), fn($q) => $q->where('type', $request->input('type')))
            ->when($request->filled('search'), fn($q) => $q->where(function ($q) use ($request) {
                $q->where('name', 'like', '%' . $request->search . '%')
                    ->orWhere('contact', 'like', '%' . $request->search . '%')
                    ->orWhere('pan_no', 'like', '%' . $request->search . '%');
            }))
            ->latest();

        $perPage = $request->get('per_page', 15);
        $clients = $perPage == -1 ? $clients->get() : $clients->paginate($perPage);

        return ClientResource::collection($clients);
    }

    public function store(StoreClientRequest $request): JsonResponse
    {
        $client = Client::create($request->validated());

        RealtimeHelper::trigger('clients_changed');

        return response()->json(['message' => 'Client created successfully.', 'data' => new ClientResource($client)], 201);
    }

    public function show(Client $client): JsonResponse
    {
        return response()->json(['data' => new ClientResource($client)]);
    }

    public function update(UpdateClientRequest $request, Client $client): JsonResponse
    {
        $client->update($request->validated());

        RealtimeHelper::trigger('clients_changed');

        return response()->json(['message' => 'Client updated successfully.', 'data' => new ClientResource($client)]);
    }

    public function destroy(Client $client): JsonResponse
    {
        $client->update(['status' => ClientStatus::Inactive->value]);
        $client->delete();

        RealtimeHelper::trigger('clients_changed');

        return response()->json(['message' => 'Client archived successfully.']);
    }

    public function bulkDelete(Request $request): JsonResponse
    {
        $request->validate([
            'client_ids' => 'required|array',
            'client_ids.*' => 'integer|exists:clients,id'
        ]);

        $ids = $request->input('client_ids');
        
        Client::whereIn('id', $ids)->update(['status' => ClientStatus::Inactive->value]);
        Client::whereIn('id', $ids)->delete();

        RealtimeHelper::trigger('clients_changed');

        return response()->json(['message' => count($ids) . ' clients archived successfully.']);
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
        RealtimeHelper::trigger('clients_changed');
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
        RealtimeHelper::trigger('clients_changed');
        return response()->json(['message' => 'Client Group created successfully.', 'data' => $group], 201);
    }

    public function updateType(Request $request, $id): JsonResponse
    {
        $type = \App\Models\ClientType::findOrFail($id);
        $validated = $request->validate([
            'name' => 'required|string|unique:client_types,name,' . $type->id,
            'pan_char' => 'nullable|string|size:1',
        ]);

        $type->update($validated);
        RealtimeHelper::trigger('clients_changed');
        return response()->json(['message' => 'Client Type updated successfully.', 'data' => $type]);
    }

    public function destroyType($id): JsonResponse
    {
        $type = \App\Models\ClientType::findOrFail($id);
        $type->delete();
        RealtimeHelper::trigger('clients_changed');
        return response()->json(['message' => 'Client Type deleted successfully.']);
    }

    public function updateGroup(Request $request, $id): JsonResponse
    {
        $group = \App\Models\ClientGroup::findOrFail($id);
        $validated = $request->validate([
            'name' => 'required|string|unique:client_groups,name,' . $group->id,
        ]);

        $group->update($validated);
        RealtimeHelper::trigger('clients_changed');
        return response()->json(['message' => 'Client Group updated successfully.', 'data' => $group]);
    }

    public function destroyGroup($id): JsonResponse
    {
        $group = \App\Models\ClientGroup::findOrFail($id);
        $group->delete();
        RealtimeHelper::trigger('clients_changed');
        return response()->json(['message' => 'Client Group deleted successfully.']);
    }

    public function panNumbers(): JsonResponse
    {
        $clients = Client::withTrashed()->get(['id', 'name', 'pan_no'])->map(fn($c) => [
            'id' => $c->id,
            'name' => trim(strtolower($c->name)),
            'pan_no' => $c->pan_no ? strtoupper(trim($c->pan_no)) : null
        ]);
        return response()->json(['data' => $clients]);
    }

    public function bulkStore(Request $request): JsonResponse
    {
        $request->validate([
            'clients' => 'required|array',
            'clients.*.name' => 'required|string|max:255',
            'clients.*.pan_no' => 'nullable|string|max:10',
            'clients.*.type' => 'required|string|max:255',
            'clients.*.group' => 'required|string|max:255',
        ]);

        $imported = 0;
        foreach ($request->input('clients') as $c) {
            $pan = !empty($c['pan_no']) ? strtoupper($c['pan_no']) : null;
            
            // Extract the credentials, merging with defaults
            $credentials = $c['credentials'] ?? [
                'efiling_password' => '',
                'ais_tis_password' => ''
            ];

            $data = [
                'name' => $c['name'],
                'name_as_per_pan' => $c['name_as_per_pan'] ?? null,
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
                'credentials' => $credentials
            ];

            if ($pan) {
                // 1. Try matching by PAN (including soft-deleted)
                $client = Client::withTrashed()->where('pan_no', $pan)->first();
                
                // 2. Try matching by Name where PAN is null/empty
                if (!$client) {
                    $client = Client::withTrashed()
                        ->where('name', $c['name'])
                        ->where(fn($q) => $q->whereNull('pan_no')->orWhere('pan_no', ''))
                        ->first();
                }
                
                if ($client) {
                    $client->restore();
                    $client->update(array_merge($data, ['pan_no' => $pan]));
                } else {
                    Client::create(array_merge($data, ['pan_no' => $pan]));
                }
            } else {
                // Try matching by Name (including soft-deleted)
                $client = Client::withTrashed()
                    ->where('name', $c['name'])
                    ->first();
                
                if ($client) {
                    $client->restore();
                    $client->update($data);
                } else {
                    Client::create($data);
                }
            }
            $imported++;
        }

        RealtimeHelper::trigger('clients_changed');

        return response()->json([
            'message' => "Successfully imported {$imported} clients.",
            'count' => $imported
        ]);
    }
}