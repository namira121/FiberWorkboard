<?php

namespace App\Services;

use App\Exceptions\BusinessRuleException;
use App\Models\Picklist;
use App\Models\SapSetting;
use App\Models\SapSyncLog;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/** Web menarik (GET) data picklist dari API SAP sesuai pengaturan, lalu menyimpannya. */
class SapSyncService
{
    private const MAX_ROWS = 5000;

    private ?int $lastHttp = null;

    /**
     * @param 'manual'|'schedule'|'test' $trigger  test = hanya baca & petakan, tidak menyimpan
     * @return array{log: SapSyncLog, report: array<string,mixed>}
     */
    public function run(string $trigger, ?User $user = null): array
    {
        $s = SapSetting::current();
        $startedAt = now();
        $t0 = microtime(true);
        $this->lastHttp = null;

        $log = [
            'started_at'      => $startedAt,
            'trigger_type'    => $trigger,
            'user_name'       => $user?->name ?: ($trigger === 'schedule' ? 'Otomatis' : null),
            'status'          => 'failed',
            'rows_received'   => 0,
            'picklists_count' => 0,
            'items_new'       => 0,
            'items_updated'   => 0,
        ];
        $report = [];

        try {
            $json = $this->fetch($s);
            $rows = SapMapper::extractRows($json, $s->data_path);
            if (count($rows) > self::MAX_ROWS) {
                throw new BusinessRuleException('SAP mengirim lebih dari ' . self::MAX_ROWS . ' baris sekaligus. Persempit data di sisi SAP (filter/tanggal).');
            }
            $log['rows_received'] = count($rows);

            $mapped = SapMapper::mapRows($rows, $this->mapOf($s));
            $items = $mapped['items'];
            $log['picklists_count'] = collect($items)->pluck('picklist_no')->unique()->count();

            if ($log['rows_received'] > 0 && $items === []) {
                throw new BusinessRuleException('Semua ' . $log['rows_received'] . ' baris dilewati: Nomor picklist / Prod. Order tidak ditemukan. Cek "Pemetaan kolom".');
            }

            if ($trigger !== 'test') {
                [$log['items_new'], $log['items_updated']] = $this->save($items);
            }

            $log['status'] = 'success';
            $skip = $mapped['skipped'] > 0 ? " ({$mapped['skipped']} baris dilewati)" : '';
            if ($log['rows_received'] === 0) {
                $log['message'] = 'SAP menjawab, tetapi tidak ada baris data. Cek "Lokasi data" atau filter di Query tambahan.';
            } elseif ($trigger === 'test') {
                $log['message'] = "Tes berhasil: {$log['rows_received']} baris terbaca, {$log['picklists_count']} picklist (tidak disimpan){$skip}.";
            } else {
                $log['message'] = "{$log['rows_received']} baris, {$log['picklists_count']} picklist: {$log['items_new']} baru, {$log['items_updated']} diubah{$skip}.";
            }

            $first = $rows[0] ?? [];
            $report = [
                'fields' => array_slice(array_map('strval', array_keys($first)), 0, 60),
                'sample' => array_slice($items, 0, 3),
            ];
        } catch (BusinessRuleException $e) {
            $log['message'] = $e->getMessage();
        } catch (\Throwable $e) {
            report($e);
            $log['message'] = 'Terjadi kesalahan saat sinkronisasi. Lihat storage/logs/laravel.log.';
        }

        $log['http_status'] = $this->lastHttp;
        $log['duration_ms'] = (int) round((microtime(true) - $t0) * 1000);
        $log['message'] = isset($log['message']) ? mb_substr($log['message'], 0, 500) : null;

        $row = SapSyncLog::create($log);

        if ($trigger !== 'test') {
            $s->last_attempt_at = $startedAt;
            if ($log['status'] === 'success') {
                $s->last_sync_at = $startedAt;
            }
            $s->save();
        }

        return ['log' => $row, 'report' => $report];
    }

    /** @return array<string,?string> */
    private function mapOf(SapSetting $s): array
    {
        $map = [];
        foreach (SapMapper::FIELDS as $f) {
            $map[$f] = $s->{'map_' . $f};
        }

        return $map;
    }

    private function fetch(SapSetting $s): mixed
    {
        if (blank($s->base_url)) {
            throw new BusinessRuleException('Alamat SAP (Base URL) belum diisi.');
        }
        $url = rtrim((string) $s->base_url, '/') . '/' . ltrim((string) $s->endpoint_path, '/');
        $this->guardHost($url);

        $secret = $s->secretValue();
        if ($s->auth_type !== 'none' && blank($secret)) {
            throw new BusinessRuleException('Password / token SAP belum diisi (atau tidak bisa dibaca; isi ulang).');
        }

        $http = Http::timeout(max(5, (int) $s->timeout_seconds))->acceptJson()->withoutRedirecting();
        if (! $s->verify_ssl) {
            $http = $http->withoutVerifying();
        }
        switch ($s->auth_type) {
            case 'basic':
                $http = $http->withBasicAuth((string) $s->username, (string) $secret);
                break;
            case 'bearer':
                $http = $http->withToken((string) $secret);
                break;
            case 'apikey':
                $http = $http->withHeaders([($s->api_key_header ?: 'X-API-Key') => (string) $secret]);
                break;
        }

        parse_str((string) $s->extra_query, $query);

        try {
            $resp = $http->get($url, $query);
        } catch (ConnectionException $e) {
            throw new BusinessRuleException('Tidak bisa terhubung ke SAP: ' . $this->clean($e->getMessage()));
        }
        $this->lastHttp = $resp->status();

        if ($resp->redirect()) {
            throw new BusinessRuleException('SAP mengalihkan (redirect) ke alamat lain. Perbarui Base URL / Path endpoint.');
        }
        if ($resp->failed()) {
            $hint = match ($resp->status()) {
                401, 403 => 'Username/password atau token ditolak SAP.',
                404      => 'Path endpoint tidak ditemukan di SAP.',
                default  => $this->clean(strip_tags($resp->body())),
            };
            throw new BusinessRuleException("SAP menjawab HTTP {$resp->status()}. {$hint}");
        }

        $json = $resp->json();
        if ($json === null) {
            throw new BusinessRuleException('Respons SAP bukan JSON. Kalau memakai OData, tambahkan "$format=json" di Query tambahan.');
        }

        return $json;
    }

    private function guardHost(string $url): void
    {
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        $host = (string) parse_url($url, PHP_URL_HOST);
        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new BusinessRuleException('Base URL harus diawali http:// atau https://');
        }
        $ip = filter_var($host, FILTER_VALIDATE_IP) ? $host : gethostbyname($host);
        $blocked = str_starts_with($ip, '169.254.') || $ip === '0.0.0.0'
            || (! app()->isLocal() && (str_starts_with($ip, '127.') || $ip === '::1'));
        if ($blocked) {
            throw new BusinessRuleException('Alamat itu tidak diizinkan (localhost / link-local).');
        }
    }

    private function clean(string $text): string
    {
        return Str::limit(trim(preg_replace('/\s+/', ' ', $text)), 200);
    }

    /** @return array{0:int,1:int} [baru, diubah]. Item yang sudah diplan jadi pekerjaan tidak disentuh statusnya. */
    private function save(array $items): array
    {
        $new = 0;
        $updated = 0;

        DB::transaction(function () use ($items, &$new, &$updated) {
            foreach (collect($items)->groupBy('picklist_no') as $no => $rows) {
                $pl = Picklist::firstOrCreate(
                    ['picklist_no' => (string) $no],
                    ['status' => 'Baru', 'received_at' => now()]
                );
                $existing = $pl->items()->get()->keyBy('prod_order');

                foreach ($rows as $r) {
                    $data = [
                        'so_number'     => $r['so_number'],
                        'material_no'   => $r['material_no'],
                        'material_desc' => $r['material_desc'],
                        'proses'        => $r['proses'],
                    ];
                    $it = $existing->get($r['prod_order']);
                    if (! $it) {
                        $existing->put($r['prod_order'], $pl->items()->create($data + ['prod_order' => $r['prod_order']]));
                        $new++;
                    } elseif ($it->only(array_keys($data)) !== $data) {
                        $it->update($data);
                        $updated++;
                    }
                }
            }
        });

        return [$new, $updated];
    }
}
