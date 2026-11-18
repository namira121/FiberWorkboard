<?php

namespace App\Support;

use App\Models\User;

final class Workspace
{
    public static function base(?User $user = null): string
    {
        return match (($user ?? auth()->user())?->role) {
            'superadmin' => '/admin',
            'public' => '/public',
            default => '/leader',
        };
    }

    public static function url(string $page, ?User $user = null): string
    {
        return self::base($user) . '/' . ltrim($page, '/');
    }
}
