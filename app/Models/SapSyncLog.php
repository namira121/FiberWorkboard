<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SapSyncLog extends Model
{
    protected $fillable = [
        'started_at', 'duration_ms', 'trigger_type', 'user_name', 'status', 'http_status',
        'rows_received', 'picklists_count', 'items_new', 'items_updated', 'message',
    ];

    protected function casts(): array
    {
        return ['started_at' => 'datetime'];
    }
}
