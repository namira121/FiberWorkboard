<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PicklistItem extends Model
{
    protected $fillable = [
        'picklist_id', 'so_number', 'material_no', 'material_desc',
        'prod_order', 'proses', 'work_order_id',
    ];

    public function picklist(): BelongsTo
    {
        return $this->belongsTo(Picklist::class);
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }
}
