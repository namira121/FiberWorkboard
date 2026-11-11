<?php

namespace App\Providers;

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // @v('assets/store.js') -> /assets/store.js?v=<waktu file diubah>, supaya browser memuat ulang skrip yang baru diganti
        Blade::directive('v', function (string $expression) {
            return "<?php echo e('/' . ltrim({$expression}, '/') . '?v=' . (@filemtime(public_path({$expression})) ?: 1)); ?>";
        });
    }
}
