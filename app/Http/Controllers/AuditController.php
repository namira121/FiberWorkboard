<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Services\AuditService;
use App\Support\AdminValidation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Log aktivitas / audit (khusus superadmin). */
class AuditController extends Controller
{
    public function index(Request $r): JsonResponse
    {
        $d = $r->validate([
            'from'      => 'nullable|date_format:Y-m-d',
            'to'        => 'nullable|date_format:Y-m-d',
            'nik'       => 'nullable|string|max:30',
            'action'    => 'nullable|string|max:50',
            'q'         => 'nullable|string|max:100',
            'before_id' => 'nullable|integer',
            'limit'     => 'nullable|integer|between:1,200',
        ], AdminValidation::MESSAGES, AdminValidation::ATTRIBUTES);

        $limit = (int) ($d['limit'] ?? 50);
        $q = AuditLog::orderByDesc('id');

        if (! empty($d['from'])) {
            $q->where('occurred_at', '>=', $d['from'] . ' 00:00:00');
        }
        if (! empty($d['to'])) {
            $q->where('occurred_at', '<=', $d['to'] . ' 23:59:59');
        }
        if (! empty($d['nik'])) {
            $q->where('nik', $d['nik']);
        }
        if (! empty($d['action'])) {
            $q->where('action', $d['action']);
        }
        if (! empty($d['q'])) {
            $like = '%' . addcslashes($d['q'], '%_\\') . '%';
            $q->where(fn ($w) => $w->where('description', 'like', $like)->orWhere('user_name', 'like', $like));
        }
        if (! empty($d['before_id'])) {
            $q->where('id', '<', (int) $d['before_id']);
        }

        $rows = $q->limit($limit + 1)->get();
        $more = $rows->count() > $limit;

        $out = [
            'ok'       => true,
            'has_more' => $more,
            'logs'     => $rows->take($limit)->map(fn (AuditLog $l) => [
                'id'          => $l->id,
                'at'          => $l->occurred_at->format('Y-m-d H:i:s'),
                'nik'         => $l->nik,
                'name'        => $l->user_name,
                'role'        => $l->role,
                'action'      => $l->action,
                'description' => $l->description,
                'ip'          => $l->ip_address,
            ])->values(),
        ];

        if (empty($d['before_id'])) {
            $today = now()->startOfDay();
            $out['actions'] = AuditService::ACTIONS;
            $out['summary'] = [
                'logins_today' => AuditLog::where('action', 'login')->where('occurred_at', '>=', $today)->count(),
                'failed_today' => AuditLog::where('action', 'login_failed')->where('occurred_at', '>=', $today)->count(),
                'users_today'  => AuditLog::where('action', 'login')->where('occurred_at', '>=', $today)->distinct()->count('user_id'),
                'admin_today'  => AuditLog::whereNotIn('action', ['login', 'login_failed', 'login_blocked', 'logout'])->where('occurred_at', '>=', $today)->count(),
            ];
        }

        return response()->json($out);
    }
}
