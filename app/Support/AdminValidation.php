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
    ];

    public const ATTRIBUTES = Viber::ATTRIBUTES + [
        'password' => 'Password', 'role' => 'Role', 'is_active' => 'Status',
        'from' => 'Dari tanggal', 'to' => 'Sampai tanggal', 'q' => 'Kata kunci', 'action' => 'Aksi',
    ];
}
