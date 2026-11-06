<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public const HOME = [
        'leader'     => '/Leader/dashboard-lead.html',
        'public'     => '/Public/dashboard-public.html',
        'superadmin' => '/Leader/dashboard-lead.html',
    ];

    public function login(Request $request): JsonResponse
    {
        $nik = trim((string) $request->input('nik'));
        $password = (string) $request->input('password');

        // 8 gagal / 10 menit per NIK+IP, dan 40 per IP (satu orang iseng tidak mengunci semua karyawan sekantor)
        $key = 'login:' . Str::lower($nik) . '|' . $request->ip();
        $ipKey = 'login-ip:' . $request->ip();

        $user = $nik !== '' ? User::where('nik', $nik)->first() : null;

        if (RateLimiter::tooManyAttempts($key, 8) || RateLimiter::tooManyAttempts($ipKey, 40)) {
            // catat sekali per jendela waktu agar log tidak dibanjiri
            if (Cache::add('audit-blocked:' . $key, 1, 600)) {
                AuditService::record('login_blocked', 'Login diblokir sementara (terlalu banyak percobaan).', null, null, null, $user?->nik);
            }

            return response()->json(['ok' => false, 'error' => 'Terlalu banyak percobaan. Coba lagi 10 menit lagi.'], 429);
        }

        if (! Auth::attempt(['nik' => $nik, 'password' => $password, 'is_active' => 1])) {
            RateLimiter::hit($key, 600);
            RateLimiter::hit($ipKey, 600);

            // NIK yang diketik tidak dicatat kalau tidak dikenal (orang sering salah mengetik password di kolom NIK)
            $why = $user ? ($user->is_active ? 'password salah' : 'akun dinonaktifkan') : 'NIK tidak dikenal';
            AuditService::record('login_failed', "Login gagal ({$why}).", null, null, null, $user?->nik);

            return response()->json(['ok' => false, 'error' => 'NIK atau password salah. Silakan coba lagi.'], 401);
        }

        RateLimiter::clear($key);
        $request->session()->regenerate();

        $u = Auth::user();
        User::whereKey($u->id)->update(['last_login_at' => now(), 'last_login_ip' => $request->ip()]);
        AuditService::record('login', 'Login berhasil.', $u);

        return response()->json(['ok' => true, 'role' => $u->role, 'redirect' => self::HOME[$u->role]]);
    }

    public function logout(Request $request): JsonResponse
    {
        if ($u = Auth::user()) {
            AuditService::record('logout', 'Logout.', $u);
        }
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    public function me(): JsonResponse
    {
        $user = Auth::user();

        return response()->json([
            'ok'       => true,
            'nik'      => $user->nik,
            'role'     => $user->role,
            'redirect' => self::HOME[$user->role],
        ]);
    }
}
d