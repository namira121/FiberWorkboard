<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Auth;

/**
 * Menyajikan halaman HTML dari resources/pages/.
 * Halaman Leader/Public/Admin ada di balik middleware auth + role (lihat routes/web.php),
 * makanya TIDAK ditaruh di public/.
 */
class PageController extends Controller
{
    public function home()
    {
        $user = Auth::user();

        return redirect($user ? AuthController::HOME[$user->role] : '/Login.html');
    }

    public function login()
    {
        return $this->serve('Login.html');
    }

    public function leader(string $page)
    {
        return $this->serve('Leader/' . $page, true);
    }

    public function pub(string $page)
    {
        return $this->serve('Public/' . $page);
    }

    public function admin(string $page)
    {
        return $this->serve('Admin/' . $page);
    }

    /** $adminNav: khusus superadmin, sisipkan menu Admin ke sidebar halaman Leader (pengguna lain tidak menerima skripnya). */
    private function serve(string $relative, bool $adminNav = false)
    {
        $file = resource_path('pages/' . $relative);
        abort_unless(is_file($file), 404);

        $headers = [
            'Content-Type'  => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-store',
        ];

        if ($adminNav && Auth::user()?->role === 'superadmin') {
            $html = (string) file_get_contents($file);
            $tag = '<script src="/assets/admin-nav.js" defer></script>';
            $html = stripos($html, '</body>') !== false
                ? preg_replace('~</body>~i', $tag . '</body>', $html, 1)
                : $html . $tag;

            return response($html, 200, $headers);
        }

        return response()->file($file, $headers);
    }
}
