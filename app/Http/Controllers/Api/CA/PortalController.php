<?php

namespace App\Http\Controllers\Api\CA;

use App\Http\Controllers\Controller;
use App\Models\Portal;
use Illuminate\Http\Request;

class PortalController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Portal::orderBy('name')->get()
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'url' => 'required|string|max:255',
        ]);

        $portal = Portal::create($validated);

        return response()->json([
            'message' => 'Portal created successfully',
            'data' => $portal
        ], 201);
    }

    public function update(Request $request, Portal $portal)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'url' => 'required|string|max:255',
        ]);

        $portal->update($validated);

        return response()->json([
            'message' => 'Portal updated successfully',
            'data' => $portal
        ]);
    }

    public function destroy(Portal $portal)
    {
        $portal->delete();

        return response()->json([
            'message' => 'Portal deleted successfully'
        ]);
    }
}
