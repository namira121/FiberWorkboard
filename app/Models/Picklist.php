<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Picklist extends Model
{
    protected $fillable = ['picklist_no', 'status', 'received_at'];

    protected function casts(): array
    {
        return ['received_at' => 'datetime'];
    }

    public function items(): HasMany
    {
        return $this->hasMany(PicklistItem::class);
    }
}
