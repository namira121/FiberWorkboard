<?php

use App\Models\AuditLog;
use App\Models\SapSyncLog;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Dijalankan tiap menit; perintahnya sendiri yang memeriksa aktif/tidak dan interval (Integrasi SAP).
Schedule::command('sap:sync')->everyMinute()->withoutOverlapping();

// Retensi log: log sinkron SAP 90 hari, log aktivitas/audit 365 hari.
Schedule::call(function () {
    SapSyncLog::where('started_at', '<', now()->subDays(90))->delete();
    AuditLog::where('occurred_at', '<', now()->subDays(365))->delete();
})->daily()->name('prune-logs');
