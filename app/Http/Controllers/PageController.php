<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Menyajikan halaman (view Blade di resources/views/pages).
 * Halaman Leader/Public/Admin ada di balik middleware auth + role (lihat routes/web.php).
 */
class PageController extends Controller
{
    public function home()
    {
        $user = Auth::user();

        return redirect($user ? AuthController::HOME[$user->role] : '/login');
    }

    public function login()
    {
        return $this->page('pages.login');
    }

    public function leader(string $page)
    {
        if (Auth::user()?->role === 'superadmin') {
            return redirect('/admin/' . $page);
        }

        return $this->page('pages.leader.' . $page);
    }

    public function pub(string $page)
    {
        return $this->page('pages.public.' . $page);
    }

    public function admin(string $page)
    {
        $workspacePages = ['dashboard', 'riwayat', 'karyawan', 'scan'];

        return $this->page(
            in_array($page, $workspacePages, true)
                ? 'pages.leader.' . $page
                : 'pages.admin.' . $page
        );
    }

    /** Alamat lama (.html) diarahkan ke alamat baru; query string (mis. ?link=...) ikut dibawa. */
    public function legacy(Request $request, string $to)
    {
        if (str_starts_with($to, '/leader/') && Auth::user()?->role === 'superadmin') {
            $to = '/admin/' . substr($to, strlen('/leader/'));
        }

        $query = $request->getQueryString();

        return redirect($to . ($query ? '?' . $query : ''));
    }

    private function page(string $view)
    {
        abort_unless(view()->exists($view), 404);

        // tidak disimpan di cache browser: status login & data selalu dari server
        return response()->view($view)->header('Cache-Control', 'no-store');
    }
}
