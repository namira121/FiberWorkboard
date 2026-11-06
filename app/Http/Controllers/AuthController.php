<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;

class AuthController extends Controller
{
    public const HOME = [
        'leader' => '/Leader/dashboard-lead.html',
        'public' => '/Public/dashboard-public.html',
        'superadmin' => '/Leader/dashboard-lead.html',
    ];

    public function login(Request $request): JsonResponse
    {
        $key = 'login:' . $request->ip();

        // sama seperti app lama: 8 gagal / 10 menit per IP
        if (RateLimiter::tooManyAttempts($key, 8)) {
            return response()->json(['ok' => false, 'error' => 'Terlalu banyak percobaan. Coba lagi 10 menit lagi.'], 429);
        }

        $nik = trim((string) $request->input('nik'));
        $password = (string) $request->input('password');

        if (! Auth::attempt(['nik' => $nik, 'password' => $password])) {
            RateLimiter::hit($key, 600);

            return response()->json(['ok' => false, 'error' => 'NIK atau password salah. Silakan coba lagi.'], 401);
        }

        RateLimiter::clear($key);
        $request->session()->regenerate();

        $role = Auth::user()->role;

        return response()->json(['ok' => true, 'role' => $role, 'redirect' => self::HOME[$role]]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    public function me(): JsonResponse
    {
        $user = Auth::user();

        return response()->json([
            'ok' => true,
            'nik' => $user->nik,
            'role' => $user->role,
            'redirect' => self::HOME[$user->role],
        ]);
    }
}
