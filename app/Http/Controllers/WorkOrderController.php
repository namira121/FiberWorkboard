<?php

namespace App\Http\Controllers;

use App\Models\WorkOrder;
use App\Services\WorkOrderService;
use App\Support\Viber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WorkOrderController extends Controller
{
    public function __construct(private WorkOrderService $svc)
    {
    }

    private function job(WorkOrder $w, int $status = 200): JsonResponse
    {
        return response()->json(['ok' => true, 'job' => $this->svc->present($w)], $status);
    }

    private function check(Request $r, array $rules): array
    {
        return $r->validate($rules, Viber::MESSAGES, Viber::ATTRIBUTES);
    }

    /** GET /api/work-orders?date=YYYY-MM-DD  (tanpa date = semua). Aturan tampil = Store.visibleOn(). */
    public function index(Request $r): JsonResponse
    {
        $this->check($r, ['date' => 'nullable|date_format:Y-m-d']);
        $date = $r->query('date');

        $q = WorkOrder::with('employees')->orderByDesc('id');
        if ($date) {
            $q->where(function ($w) use ($date) {
                $w->where('job_date', $date)
                    ->orWhere(fn ($x) => $x->where('status', 'On progress')->where('job_date', '<', $date))
                    ->orWhere(fn ($x) => $x->where('status', 'Done')->where('done_date', $date));
            });
        }

        return response()->json([
            'ok'   => true,
            'jobs' => $q->get()->map(fn ($w) => $this->svc->present($w))->values(),
        ]);
    }

    public function store(Request $r): JsonResponse
    {
        $data = $this->check($r, [
            'prod'     => 'nullable|string|max:50',
            'work'     => 'required|string|max:150',
            'material' => 'nullable|string|max:50',
            'desc'     => 'nullable|string|max:255',
            'so'       => 'nullable|string|max:50',
            'qty'      => 'nullable|string|max:30',
            'target'   => 'nullable|integer|between:0,100',
            'team'     => 'nullable|array|max:50',
        ]);

        return $this->job($this->svc->create($data, $r->user()), 201);
    }

    public function progress(Request $r, string $prod): JsonResponse
    {
        $d = $this->check($r, [
            'value'  => 'required|integer|between:0,100',
            'reason' => 'nullable|string|max:500',
        ]);

        return $this->job($this->svc->setProgress($prod, (int) $d['value'], $d['reason'] ?? null, $r->user()));
    }

    public function hold(Request $r, string $prod): JsonResponse
    {
        $d = $this->check($r, [
            'status' => ['required', Rule::in(['Pending', 'Cancel'])],
            'issue'  => ['required', Rule::in(Viber::MASALAH)],
            'reason' => 'required|string|max:500',
        ]);

        return $this->job($this->svc->hold($prod, $d['status'], $d['issue'], $d['reason'], $r->user()));
    }

    /* ---- khusus Leader ---- */

    public function reactivate(Request $r, string $prod): JsonResponse
    {
        $d = $this->check($r, ['reason' => 'nullable|string|max:500']);

        return $this->job($this->svc->reactivate($prod, $d['reason'] ?? null, $r->user()));
    }

    public function target(Request $r, string $prod): JsonResponse
    {
        $d = $this->check($r, ['value' => 'present|nullable|integer|between:0,100']);

        return $this->job($this->svc->setTarget($prod, $d['value'] === null ? null : (int) $d['value']));
    }

    public function update(Request $r, string $prod): JsonResponse
    {
        $d = $this->check($r, [
            'work'     => 'required|string|max:150',
            'desc'     => 'nullable|string|max:255',
            'material' => 'nullable|string|max:50',
            'so'       => 'nullable|string|max:50',
            'qty'      => 'nullable|string|max:30',
        ]);

        return $this->job($this->svc->update($prod, $d, $r->user()));
    }

    public function addMember(Request $r, string $prod): JsonResponse
    {
        $d = $this->check($r, ['nik' => 'required|string|max:30']);

        return $this->job($this->svc->addMember($prod, $d['nik']));
    }

    public function removeMember(string $prod, string $nik): JsonResponse
    {
        return $this->job($this->svc->removeMember($prod, $nik));
    }
}
