<?php

namespace App\Http\Controllers;

use App\Exceptions\BusinessRuleException;
use App\Models\Picklist;
use App\Models\PicklistItem;
use App\Models\SapSetting;
use App\Models\SapSyncLog;
use App\Services\AuditService;
use App\Services\SapSyncService;
use App\Support\AdminValidation;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Integrasi SAP: pengaturan koneksi, tes, sinkron, log, dan picklist yang diterima (khusus superadmin). */
class SapAdminController extends Controller
{
    private const SETTING_FIELDS = [
        'enabled', 'sync_interval_minutes', 'base_url', 'endpoint_path', 'auth_type', 'username',
        'api_key_header', 'extra_query', 'data_path',
        'map_picklist_no', 'map_so_number', 'map_material_no', 'map_material_desc', 'map_prod_order', 'map_proses',
        'timeout_seconds', 'verify_ssl',
    ];

    public function __construct(private SapSyncService $svc)
    {
    }

    private function fmt(?CarbonInterface $t): ?string
    {
        return $t?->format('Y-m-d H:i:s');
    }

    private function settingsPayload(SapSetting $s): array
    {
        return ['settings' => $s->only(self::SETTING_FIELDS) + ['has_secret' => $s->hasSecret()]];
    }

    public function settings(): JsonResponse
    {
        return response()->json(['ok' => true] + $this->settingsPayload(SapSetting::current()));
    }

    public function updateSettings(Request $r): JsonResponse
    {
        $d = $r->validate([
            'enabled'               => 'required|boolean',
            'sync_interval_minutes' => 'required|integer|between:5,1440',
            'base_url'              => ['nullable', 'url:http,https', 'max:255', 'required_if:enabled,true'],
            'endpoint_path'         => 'nullable|string|max:255|required_if:enabled,true',
            'auth_type'             => ['required', Rule::in(['none', 'basic', 'bearer', 'apikey'])],
            'username'              => 'nullable|string|max:100',
            'secret'                => 'nullable|string|max:500',
            'clear_secret'          => 'nullable|boolean',
            'api_key_header'        => ['nullable', 'string', 'max:60', 'regex:/^[A-Za-z0-9-]+$/'],
            'extra_query'           => 'nullable|string|max:500',
            'data_path'             => 'nullable|string|max:100',
            'map_picklist_no'       => 'nullable|string|max:60|required_if:enabled,true',
            'map_prod_order'        => 'nullable|string|max:60|required_if:enabled,true',
            'map_so_number'         => 'nullable|string|max:60',
            'map_material_no'       => 'nullable|string|max:60',
            'map_material_desc'     => 'nullable|string|max:60',
            'map_proses'            => 'nullable|string|max:60',
            'timeout_seconds'       => 'required|integer|between:5,120',
            'verify_ssl'            => 'required|boolean',
        ], AdminValidation::MESSAGES, AdminValidation::ATTRIBUTES);

        $s = SapSetting::current();
        $secret = $d['secret'] ?? null;
        $clear = ! empty($d['clear_secret']);
        unset($d['secret'], $d['clear_secret']);

        $s->fill($d);
        if (filled($secret)) {
            $s->secret = $secret;           // dienkripsi otomatis
        } elseif ($clear) {
            $s->secret = null;
        }
        if ($s->enabled && $s->auth_type !== 'none' && blank($s->secretValue())) {
            throw new BusinessRuleException('Password / token SAP belum diisi.');
        }
        $s->updated_by = $r->user()->name ?: $r->user()->nik;
        $s->save();

        $changed = array_values(array_diff(array_keys($s->getChanges()), ['updated_at', 'updated_by', 'secret']));
        if (array_key_exists('secret', $s->getChanges())) {
            $changed[] = $s->hasSecret() ? 'kredensial (diganti)' : 'kredensial (dihapus)';
        }
        AuditService::record('sap_settings_update', 'Mengubah pengaturan SAP: ' . ($changed ? implode(', ', $changed) : 'tanpa perubahan') . '.', $r->user(), 'sap');

        return response()->json(['ok' => true] + $this->settingsPayload($s));
    }

    public function test(Request $r): JsonResponse
    {
        $res = $this->svc->run('test', $r->user());
        $log = $res['log'];
        AuditService::record('sap_test', 'Tes koneksi SAP: ' . $log->message, $r->user(), 'sap');

        return response()->json([
            'ok'          => true,
            'success'     => $log->status === 'success',
            'message'     => $log->message,
            'http_status' => $log->http_status,
            'rows'        => $log->rows_received,
            'picklists'   => $log->picklists_count,
            'fields'      => $res['report']['fields'] ?? [],
            'sample'      => $res['report']['sample'] ?? [],
        ]);
    }

    public function sync(Request $r): JsonResponse
    {
        $log = $this->svc->run('manual', $r->user())['log'];
        AuditService::record('sap_sync', 'Sinkron SAP manual: ' . $log->message, $r->user(), 'sap');

        return response()->json([
            'ok'            => true,
            'success'       => $log->status === 'success',
            'message'       => $log->message,
            'items_new'     => $log->items_new,
            'items_updated' => $log->items_updated,
        ]);
    }

    public function summary(): JsonResponse
    {
        $s = SapSetting::current();
        $last = SapSyncLog::where('trigger_type', '!=', 'test')->orderByDesc('id')->first();

        return response()->json([
            'ok'              => true,
            'configured'      => filled($s->base_url) && filled($s->endpoint_path),
            'enabled'         => $s->enabled,
            'interval'        => $s->sync_interval_minutes,
            'last_attempt_at' => $this->fmt($s->last_attempt_at),
            'last_sync_at'    => $this->fmt($s->last_sync_at),
            'last_status'     => $last?->status,
            'last_message'    => $last?->message,
            'next_sync_at'    => ($s->enabled && $s->last_attempt_at) ? $this->fmt($s->last_attempt_at->copy()->addMinutes($s->sync_interval_minutes)) : null,
            'picklists_total' => Picklist::count(),
            'picklists_new'   => Picklist::where('status', 'Baru')->count(),
            'items_total'     => PicklistItem::count(),
            'items_unplanned' => PicklistItem::whereNull('work_order_id')->count(),
            'failed_24h'      => SapSyncLog::where('status', 'failed')->where('trigger_type', '!=', 'test')->where('started_at', '>=', now()->subDay())->count(),
        ]);
    }

    public function syncs(Request $r): JsonResponse
    {
        $limit = min(max((int) $r->query('limit', 30), 1), 200);

        return response()->json([
            'ok'    => true,
            'syncs' => SapSyncLog::orderByDesc('id')->limit($limit)->get()->map(fn (SapSyncLog $l) => [
                'id'        => $l->id,
                'at'        => $this->fmt($l->started_at),
                'trigger'   => $l->trigger_type,
                'by'        => $l->user_name,
                'status'    => $l->status,
                'http'      => $l->http_status,
                'rows'      => $l->rows_received,
                'picklists' => $l->picklists_count,
                'new'       => $l->items_new,
                'updated'   => $l->items_updated,
                'ms'        => $l->duration_ms,
                'message'   => $l->message,
            ])->values(),
        ]);
    }

    public function picklists(): JsonResponse
    {
        $rows = Picklist::withCount([
            'items',
            'items as planned_count' => fn ($q) => $q->whereNotNull('work_order_id'),
        ])->orderByDesc('id')->limit(100)->get();

        return response()->json([
            'ok'        => true,
            'picklists' => $rows->map(fn (Picklist $p) => [
                'id'          => $p->id,
                'picklist_no' => $p->picklist_no,
                'status'      => $p->status,
                'received_at' => $this->fmt($p->received_at),
                'items'       => $p->items_count,
                'planned'     => $p->planned_count,
            ])->values(),
        ]);
    }

    public function picklistShow(int $id): JsonResponse
    {
        $p = Picklist::with('items.workOrder:id,prod_order,status')->find($id)
            ?? throw new BusinessRuleException('Picklist tidak ditemukan.', 404);

        return response()->json([
            'ok'    => true,
            'items' => $p->items->map(fn (PicklistItem $i) => [
                'so'       => $i->so_number,
                'material' => $i->material_no,
                'desc'     => $i->material_desc,
                'prod'     => $i->prod_order,
                'proses'   => $i->proses,
                'job'      => $i->workOrder ? ['prod' => $i->workOrder->prod_order, 'status' => $i->workOrder->status] : null,
            ])->values(),
        ]);
    }

    public function picklistDestroy(Request $r, int $id): JsonResponse
    {
        $d = $r->validate(['reason' => 'required|string|max:300'], AdminValidation::MESSAGES, AdminValidation::ATTRIBUTES);

        DB::transaction(function () use ($id, $d, $r) {
            $p = Picklist::withCount([
                'items',
                'items as planned_count' => fn ($q) => $q->whereNotNull('work_order_id'),
            ])->lockForUpdate()->find($id) ?? throw new BusinessRuleException('Picklist tidak ditemukan.', 404);

            $info = "{$p->picklist_no} ({$p->items_count} baris, {$p->planned_count} sudah jadi pekerjaan)";
            $p->delete();   // baris ikut terhapus; pekerjaan yang sudah dibuat dari picklist ini tidak dihapus

            AuditService::record('picklist_delete', "Menghapus picklist {$info}. Alasan: {$d['reason']}", $r->user(), 'picklist', (string) $id);
        });

        return response()->json(['ok' => true]);
    }
}
