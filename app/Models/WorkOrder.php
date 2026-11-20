<?php

namespace App\Models;

use App\Models\Scopes\OwnJobsScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkOrder extends Model
{
    protected $fillable = [
        'prod_order', 'job_date', 'material', 'description', 'work', 'so_number',
        'qty', 'progress', 'target', 'status', 'picklist_no', 'issue', 'reason',
        'hold_by', 'hold_time', 'done_date', 'detail_loaded', 'user_id',
    ];

    protected static function booted(): void
    {
        // Leader hanya melihat pekerjaan miliknya sendiri
        static::addGlobalScope(new OwnJobsScope());
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    protected function casts(): array
    {
        return [
            'job_date'  => 'date:Y-m-d',
            'done_date' => 'date:Y-m-d',
            'progress'  => 'integer',
            'target'    => 'integer',
            'detail_loaded' => 'boolean',
        ];
    }

    public function isHeld(): bool
    {
        return in_array($this->status, ['Pending', 'Cancel'], true);
    }

    public function employees(): BelongsToMany
    {
        return $this->belongsToMany(Employee::class, 'work_order_employees', 'work_order_id', 'employee_nik', 'id', 'nik');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(WorkOrderLog::class);
    }
}
