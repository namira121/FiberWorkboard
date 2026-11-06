<?php

namespace App\Support;

/** Pesan & nama field validasi untuk halaman superadmin (menambah yang ada di Viber). */
final class AdminValidation
{
    public const MESSAGES = Viber::MESSAGES + [
        'min'         => ['string' => ':attribute minimal :min karakter.', 'numeric' => ':attribute minimal :min.'],
        'regex'       => ':attribute tidak valid.',
        'different'   => ':attribute tidak boleh sama dengan :other.',
        'url'         => ':attribute harus berupa alamat http:// atau https://',
        'boolean'     => ':attribute tidak valid.',
        'required_if' => ':attribute wajib diisi kalau sinkronisasi diaktifkan.',
    ];

    public const ATTRIBUTES = Viber::ATTRIBUTES + [
        'password' => 'Password', 'role' => 'Role', 'is_active' => 'Status',
        'base_url' => 'Base URL', 'endpoint_path' => 'Path endpoint', 'auth_type' => 'Jenis otentikasi',
        'username' => 'Username', 'secret' => 'Password/token', 'api_key_header' => 'Nama header API key',
        'extra_query' => 'Query tambahan', 'data_path' => 'Lokasi data', 'timeout_seconds' => 'Timeout',
        'sync_interval_minutes' => 'Interval', 'enabled' => 'Aktif', 'verify_ssl' => 'Verifikasi SSL',
        'map_picklist_no' => 'Nomor picklist', 'map_so_number' => 'No. SO', 'map_material_no' => 'No. Material',
        'map_material_desc' => 'Deskripsi material', 'map_prod_order' => 'Prod. Order', 'map_proses' => 'Proses',
        'from' => 'Dari tanggal', 'to' => 'Sampai tanggal', 'q' => 'Kata kunci', 'action' => 'Aksi',
    ];
}
