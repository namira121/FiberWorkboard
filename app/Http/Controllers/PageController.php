<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Auth;

/**
 * Menyajikan halaman HTML lama apa adanya dari resources/pages/.
 * Halaman Leader/Public ada di balik middleware auth + role (lihat routes/web.php),
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
        return $this->serve('Leader/' . $page);
    }

    public function pub(string $page)
    {
        return $this->serve('Public/' . $page);
    }

    private function serve(string $relative)
    {
        $file = resource_path('pages/' . $relative);
        abort_unless(is_file($file), 404);

        return response()->file($file, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-store',
        ]);
    }
}
