<?php

namespace App\Services;

/**
 * Mengubah respons JSON dari SAP menjadi baris picklist standar.
 * Murni (tanpa database/HTTP) supaya mudah diuji.
 */
final class SapMapper
{
    public const FIELDS = ['picklist_no', 'so_number', 'material_no', 'material_desc', 'prod_order', 'proses'];

    private const MAX = [
        'picklist_no' => 50, 'so_number' => 50, 'material_no' => 50,
        'material_desc' => 255, 'prod_order' => 50, 'proses' => 255,
    ];

    /** Ambil nilai bersarang dengan notasi titik, mis. "d.results". Path kosong = seluruh data. */
    public static function get(mixed $data, ?string $path): mixed
    {
        if ($path === null || trim($path) === '') {
            return $data;
        }
        foreach (explode('.', trim($path)) as $segment) {
            if (is_array($data) && array_key_exists($segment, $data)) {
                $data = $data[$segment];
            } else {
                return null;
            }
        }

        return $data;
    }

    /** @return array<int,array<string,mixed>> daftar baris */
    public static function extractRows(mixed $json, ?string $path): array
    {
        $node = self::get($json, $path);
        if (! is_array($node) || $node === []) {
            return [];
        }
        // satu objek tunggal (bukan daftar) -> bungkus jadi daftar
        if (array_keys($node) !== range(0, count($node) - 1)) {
            $node = [$node];
        }

        return array_values(array_filter($node, 'is_array'));
    }

    /**
     * @param array<int,array<string,mixed>> $rows
     * @param array<string,?string>          $map  kolom standar => nama field di SAP
     * @return array{items: array<int,array<string,string>>, skipped: int}
     */
    public static function mapRows(array $rows, array $map): array
    {
        $items = [];
        $skipped = 0;

        foreach ($rows as $row) {
            $out = [];
            foreach (self::FIELDS as $field) {
                $source = trim((string) ($map[$field] ?? ''));
                $value = $source === '' ? '' : self::scalar(self::get($row, $source));
                $out[$field] = mb_substr($value, 0, self::MAX[$field]);
            }
            if ($out['picklist_no'] === '' || $out['prod_order'] === '') {
                $skipped++;

                continue;
            }
            $items[] = $out;
        }

        return ['items' => $items, 'skipped' => $skipped];
    }

    private static function scalar(mixed $v): string
    {
        if (is_bool($v)) {
            return $v ? '1' : '0';
        }

        return is_scalar($v) ? trim((string) $v) : '';
    }
}
