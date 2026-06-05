<?php

namespace App\Http\Controllers\Api\CA;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskNote;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TaskNoteController extends Controller
{
    public function store(Request $request, Task $task)
    {
        $request->validate([
            'text' => 'required|string',
        ]);

        $note = $task->notes()->create([
            'text' => $request->text,
            'user_id' => Auth::id(),
        ]);

        return response()->json($note->load('author'));
    }

    public function update(Request $request, TaskNote $taskNote)
    {
        // Add authorization here if needed
        $request->validate([
            'text' => 'required|string',
        ]);

        $taskNote->update([
            'text' => $request->text,
        ]);

        return response()->json($taskNote->load('author'));
    }

    public function destroy(TaskNote $taskNote)
    {
        $taskNote->delete();
        return response()->json(['message' => 'Note deleted successfully']);
    }
}
