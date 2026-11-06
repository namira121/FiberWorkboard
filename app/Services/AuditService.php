<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;

class AuditService
{
    public const ACTIONS = [
        'login'                => 'Login',
        'login_failed'         => 'Login gagal',
        'login_blocked'        => 'Login diblokir',
        'logout'               => 'Logout',
        'user_create'          => 'Buat akun',
        'user_update'          => 'Ubah akun',
        'user_password_reset'  => 'Reset password',
        'user_force_logout'    => 'Paksa logout',
        'user_delete'          => 'Hapus akun',
        'work_order_delete'    => 'Hapus pekerjaan',
        'picklist_delete'      => 'Hapus picklist',
        'sap_settings_update'  => 'Ubah pengaturan SAP',
        'sap_test'             => 'Tes koneksi SAP',
        'sap_sync'             => 'Sinkron SAP',
    ];

    /** Catat satu aktivitas. Kegagalan mencatat tidak boleh mengganggu proses utama. */
    public static function record(
        string $action,
        string $description = '',
        ?User $actor = null,
        ?string $targetType = null,
        ?string $targetId = null,
        ?string $nik = null,
    ): void {
        try {
            $req = request();

            AuditLog::create([
                'occurred_at' => now(),
                'user_id'     => $actor?->id,
                'nik'         => $actor?->nik ?? $nik,
                'user_name'   => $actor?->name,
                'role'        => $actor?->role,
                'action'      => $action,
                'description' => mb_substr($description, 0, 500),
                'target_type' => $targetType,
                'target_id'   => $targetId !== null ? mb_substr($targetId, 0, 100) : null,
                'ip_address'  => $req?->ip(),
                'user_agent'  => $req ? mb_substr((string) $req->userAgent(), 0, 255) : null,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
