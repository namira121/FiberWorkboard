<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkOrderLog extends Model
{
    protected $fillable = [
        'work_order_id', 'prod_order', 'logged_at', 'material', 'work', 'so_number',
        'from_status', 'to_status', 'issue', 'reason', 'progress', 'by_name', 'role', 'kind',
    ];

    protected function casts(): array
    {
        return ['logged_at' => 'datetime', 'progress' => 'integer'];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }
}
