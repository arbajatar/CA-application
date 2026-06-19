<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class ThingsToKnowBrochure extends Model
{
    use HasFactory;

    protected $fillable = ['title', 'file_path', 'group_name'];

    protected $appends = ['file_url'];

    public function getFileUrlAttribute()
    {
        return $this->file_path ? \App\Helpers\UploadHelper::resolveUrl($this->file_path) : null;
    }
}
