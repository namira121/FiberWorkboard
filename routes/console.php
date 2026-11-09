<?php

use App\Models\AuditLog;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Retensi log: log aktivitas/audit 365 hari.
Schedule::call(function () {
    AuditLog::where('occurred_at', '<', now()->subDays(365))->delete();
})->daily()->name('prune-logs');
