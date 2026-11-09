<?php

namespace App\Services;

use App\Exceptions\BusinessRuleException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/** Bertanya ke API SAP untuk SATU Prod. Order (dipanggil saat Leader menekan "Tampilkan detail"). */
class SapClient
{
    public function configured(): bool
    {
        return filled(config('sap.base_url'));
    }

    /**
     * @return array{prod:string,material:string,desc:string,so:string,work:string,qty:string}
     */
    public function prodOrder(string $prod): array
    {
        $prod = trim($prod);
        if ($prod === '' || ! preg_match('/^[A-Za-z0-9._\-]{1,50}$/', $prod)) {
            throw new BusinessRuleException('Format Prod. Order tidak valid.');
        }
        if (! $this->configured()) {
            throw new BusinessRuleException('Koneksi SAP belum diisi di server (.env).', 503);
        }

        $json = $this->request($prod);

        $rows = SapMapper::extractRows($json, config('sap.data_path'));
        $map = (array) config('sap.map');

        // kalau SAP mengirim banyak baris, pilih yang Prod. Order-nya sama
        $row = null;
        $keyField = trim((string) ($map['prod_order'] ?? ''));
        foreach ($rows as $r) {
            if ($keyField === '' || mb_strtolower($this->str(SapMapper::get($r, $keyField))) === mb_strtolower($prod)) {
                $row = $r;
                break;
            }
        }
        if ($row === null) {
            throw new BusinessRuleException("Prod. Order {$prod} tidak ditemukan di SAP.", 404);
        }

        $get = fn (string $k) => ($map[$k] ?? '') === '' ? '' : $this->str(SapMapper::get($row, (string) $map[$k]));

        return [
            'prod'     => $prod,
            'material' => Str::limit($get('material_no'), 50, ''),
            'desc'     => Str::limit($get('material_desc'), 255, ''),
            'so'       => Str::limit($get('so_number'), 50, ''),
            'work'     => Str::limit($get('work'), 150, ''),
            'qty'      => Str::limit($get('qty'), 30, ''),
        ];
    }

    private function request(string $prod): mixed
    {
        $quoted = str_replace("'", "''", $prod);   // aman untuk literal OData
        $endpoint = str_replace('{prod}', rawurlencode($prod), (string) config('sap.endpoint'));
        $url = rtrim((string) config('sap.base_url'), '/') . '/' . ltrim($endpoint, '/');
        $this->guardHost($url);

        $auth = (string) config('sap.auth_type');
        $secret = (string) config('sap.password');
        if ($auth !== 'none' && $secret === '') {
            throw new BusinessRuleException('Password / token SAP belum diisi di .env.', 503);
        }

        $http = Http::timeout(max(5, (int) config('sap.timeout')))->acceptJson()->withoutRedirecting();
        if (! config('sap.verify_ssl')) {
            $http = $http->withoutVerifying();
        }
        $http = match ($auth) {
            'basic'  => $http->withBasicAuth((string) config('sap.username'), $secret),
            'bearer' => $http->withToken($secret),
            'apikey' => $http->withHeaders([(string) (config('sap.api_key_header') ?: 'X-API-Key') => $secret]),
            default  => $http,
        };

        parse_str(str_replace('{prod}', $quoted, (string) config('sap.query')), $query);

        try {
            $resp = $http->get($url, $query);
        } catch (ConnectionException $e) {
            throw new BusinessRuleException('Tidak bisa terhubung ke SAP. Cek jaringan/alamat SAP.', 502);
        }

        if ($resp->redirect()) {
            throw new BusinessRuleException('SAP mengalihkan ke alamat lain. Perbarui SAP_BASE_URL / SAP_ENDPOINT.', 502);
        }
        if ($resp->status() === 404) {
            throw new BusinessRuleException("Prod. Order {$prod} tidak ditemukan di SAP.", 404);
        }
        if ($resp->failed()) {
            $hint = in_array($resp->status(), [401, 403], true) ? ' Username/password atau token ditolak.' : '';
            throw new BusinessRuleException("SAP menjawab HTTP {$resp->status()}.{$hint}", 502);
        }

        $json = $resp->json();
        if ($json === null) {
            throw new BusinessRuleException('Respons SAP bukan JSON. Untuk OData tambahkan $format=json di SAP_QUERY.', 502);
        }

        return $json;
    }

    private function str(mixed $v): string
    {
        return is_scalar($v) ? trim((string) $v) : '';
    }

    private function guardHost(string $url): void
    {
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        $host = (string) parse_url($url, PHP_URL_HOST);
        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new BusinessRuleException('SAP_BASE_URL harus diawali http:// atau https://', 503);
        }
        $ip = filter_var($host, FILTER_VALIDATE_IP) ? $host : gethostbyname($host);
        $blocked = str_starts_with($ip, '169.254.') || $ip === '0.0.0.0'
            || (! app()->isLocal() && (str_starts_with($ip, '127.') || $ip === '::1'));
        if ($blocked) {
            throw new BusinessRuleException('Alamat SAP itu tidak diizinkan (localhost / link-local).', 503);
        }
    }
}
