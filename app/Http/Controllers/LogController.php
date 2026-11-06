<?php

namespace App\Http\Controllers;

use App\Models\WorkOrderLog;
use App\Services\WorkOrderService;
use App\Support\Viber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LogController extends Controller
{
    public function __construct(private WorkOrderService $svc)
    {
    }

    /** GET /api/logs?date=YYYY-MM-DD&prod=...&limit=...  (terbaru dulu, seperti Store.log()) */
    public function index(Request $r): JsonResponse
    {
        $d = $r->validate([
            'date'  => 'nullable|date_format:Y-m-d',
            'prod'  => 'nullable|string|max:50',
            'limit' => 'nullable|integer|between:1,2000',
        ], Viber::MESSAGES, Viber::ATTRIBUTES);

        $q = WorkOrderLog::orderByDesc('logged_at')->orderByDesc('id');
        if (! empty($d['date'])) {
            $q->whereBetween('logged_at', [$d['date'] . ' 00:00:00', $d['date'] . ' 23:59:59']);
        }
        if (! empty($d['prod'])) {
            $q->where('prod_order', $d['prod']);
        }

        return response()->json([
            'ok'  => true,
            'log' => $q->limit((int) ($d['limit'] ?? 1000))->get()->map(fn ($l) => $this->svc->presentLog($l))->values(),
        ]);
    }
}
