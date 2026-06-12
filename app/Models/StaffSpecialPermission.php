<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StaffSpecialPermission extends Model
{
    use HasFactory;

    protected $table = 'staff_special_permissions';

    protected $fillable = [
        'staff_id',
        'create_sheet',
        'edit_sheet',
        'delete_sheet',
        'import_export_sheet',
    ];

    protected $casts = [
        'create_sheet' => 'boolean',
        'edit_sheet' => 'boolean',
        'delete_sheet' => 'boolean',
        'import_export_sheet' => 'boolean',
    ];

    public function staff()
    {
        return $this->belongsTo(User::class, 'staff_id');
    }
}
