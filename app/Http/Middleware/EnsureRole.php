<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string $role): Response
    {
        $actual = $request->user()?->role;

        abort_unless($actual === 'superadmin' || $actual === $role, 403, 'Akses ditolak.');

        return $next($request);
    }
}
