<?php

namespace App\Console\Commands;

use App\Models\SapSetting;
use App\Services\SapSyncService;
use Illuminate\Console\Command;

class SapSync extends Command
{
    protected $signature = 'sap:sync {--force : abaikan pengaturan aktif/interval}';

    protected $description = 'Tarik picklist dari SAP sesuai pengaturan di halaman Integrasi SAP';

    public function handle(SapSyncService $svc): int
    {
        $s = SapSetting::current();

        if (! $this->option('force')) {
            if (! $s->enabled) {
                return self::SUCCESS;
            }
            if ($s->last_attempt_at && abs($s->last_attempt_at->diffInMinutes(now())) < $s->sync_interval_minutes) {
                return self::SUCCESS;
            }
        }

        $res = $svc->run('schedule');
        $this->line((string) $res['log']->message);

        return $res['log']->status === 'success' ? self::SUCCESS : self::FAILURE;
    }
}
