<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Employee extends Model
{
    protected $primaryKey = 'nik';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['nik', 'name', 'bagian'];

    public function workOrders(): BelongsToMany
    {
        return $this->belongsToMany(WorkOrder::class, 'work_order_employees', 'employee_nik', 'work_order_id');
    }
}
