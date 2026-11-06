<?php

namespace App\Http\Controllers;

use App\Exceptions\BusinessRuleException;
use App\Models\WorkOrder;
use App\Services\AuditService;
use App\Services\WorkOrderService;
use App\Support\AdminValidation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Hapus pekerjaan (khusus superadmin). Riwayat status tetap tersimpan; hanya kaitannya ke pekerjaan yang dilepas. */
class AdminDataController extends Controller
{
    public function __construct(private WorkOrderService $svc)
    {
    }

    public function workOrders(Request $r): JsonResponse
    {
        $d = $r->validate([
            'q'     => 'nullable|string|max:100',
            'limit' => 'nullable|integer|between:1,500',
        ], AdminValidation::MESSAGES, AdminValidation::ATTRIBUTES);

        $q = WorkOrder::with('employees')->orderByDesc('id');
        if (! empty($d['q'])) {
            $like = '%' . addcslashes($d['q'], '%_\\') . '%';
            $q->where(fn ($w) => $w->where('prod_order', 'like', $like)->orWhere('work', 'like', $like)
                ->orWhere('so_number', 'like', $like)->orWhere('material', 'like', $like));
        }

        return response()->json([
            'ok'   => true,
            'jobs' => $q->limit((int) ($d['limit'] ?? 100))->get()->map(fn ($w) => $this->svc->present($w))->values(),
        ]);
    }

    public function destroyWorkOrder(Request $r, string $prod): JsonResponse
    {
        $d = $r->validate(['reason' => 'required|string|max:300'], AdminValidation::MESSAGES, AdminValidation::ATTRIBUTES);

        DB::transaction(function () use ($prod, $d, $r) {
            $w = WorkOrder::where('prod_order', $prod)->lockForUpdate()->first()
                ?? throw new BusinessRuleException('Pekerjaan tidak ditemukan.', 404);

            $info = "{$w->prod_order} ({$w->work}), status {$w->status}, progress {$w->progress}%";
            $w->delete();   // tim ikut terhapus; riwayat status & baris picklist hanya dilepas dari pekerjaan ini

            AuditService::record('work_order_delete', "Menghapus pekerjaan {$info}. Alasan: {$d['reason']}", $r->user(), 'work_order', $prod);
        });

        return response()->json(['ok' => true]);
    }
}
