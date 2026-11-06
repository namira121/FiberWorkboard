<?php

namespace App\Support;

final class Viber
{
    public const BAGIAN = ['Rangka', 'Cetak', 'Cutting', 'Pembenahan', 'Setting & Croping', 'Finishing', 'Master', 'Moulding'];
    public const MASALAH = ['Man', 'Material', 'Method', 'Machine', 'Environment'];
    public const STATUSES = ['Planning', 'On progress', 'Done', 'Pending', 'Cancel'];

    public static function statusFromProgress(int $value): string
    {
        return $value >= 100 ? 'Done' : ($value <= 0 ? 'Planning' : 'On progress');
    }

    /** Pesan validasi berbahasa Indonesia (dipakai di $request->validate(..., MESSAGES, ATTRIBUTES)). */
    public const MESSAGES = [
        'required'    => ':attribute wajib diisi.',
        'present'     => ':attribute wajib dikirim.',
        'max'         => [
            'string'  => ':attribute terlalu panjang (maksimal :max karakter).',
            'array'   => ':attribute terlalu banyak (maksimal :max).',
            'numeric' => ':attribute maksimal :max.',
        ],
        'integer'     => ':attribute harus berupa angka bulat.',
        'between'     => ['numeric' => ':attribute harus antara :min sampai :max.'],
        'in'          => ':attribute tidak valid.',
        'unique'      => ':attribute sudah terdaftar.',
        'date_format' => 'Format :attribute tidak valid.',
        'array'       => ':attribute tidak valid.',
        'string'      => ':attribute tidak valid.',
    ];

    public const ATTRIBUTES = [
        'nik' => 'NIK', 'name' => 'Nama', 'bagian' => 'Bagian', 'work' => 'Pekerjaan',
        'desc' => 'Deskripsi', 'material' => 'No. Material', 'so' => 'No. SO', 'qty' => 'Qty',
        'prod' => 'Prod. Order', 'target' => 'Target', 'value' => 'Nilai', 'issue' => 'Jenis masalah',
        'reason' => 'Alasan', 'status' => 'Status', 'team' => 'Tim', 'date' => 'Tanggal',
    ];
}
