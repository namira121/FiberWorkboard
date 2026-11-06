<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    protected $fillable = [
        'occurred_at', 'user_id', 'nik', 'user_name', 'role', 'action',
        'description', 'target_type', 'target_id', 'ip_address', 'user_agent',
    ];

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime'];
    }
}
