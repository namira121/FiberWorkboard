<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Satu baris pengaturan koneksi SAP (id selalu 1). Kredensial disimpan terenkripsi (APP_KEY). */
class SapSetting extends Model
{
    public $incrementing = false;

    protected $fillable = [
        'enabled', 'sync_interval_minutes', 'base_url', 'endpoint_path', 'auth_type', 'username',
        'secret', 'api_key_header', 'extra_query', 'data_path',
        'map_picklist_no', 'map_so_number', 'map_material_no', 'map_material_desc', 'map_prod_order', 'map_proses',
        'timeout_seconds', 'verify_ssl', 'last_attempt_at', 'last_sync_at', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'enabled'               => 'boolean',
            'verify_ssl'            => 'boolean',
            'secret'                => 'encrypted',
            'sync_interval_minutes' => 'integer',
            'timeout_seconds'       => 'integer',
            'last_attempt_at'       => 'datetime',
            'last_sync_at'          => 'datetime',
        ];
    }

    public static function current(): self
    {
        return static::find(1) ?? static::forceCreate(['id' => 1]);
    }

    /** Apakah kredensial tersimpan (tanpa mendekripsi). */
    public function hasSecret(): bool
    {
        return ! empty($this->getRawOriginal('secret'));
    }

    /** Isi kredensial; null kalau kosong atau tidak bisa didekripsi (mis. APP_KEY berubah). */
    public function secretValue(): ?string
    {
        try {
            return $this->secret;
        } catch (\Throwable) {
            return null;
        }
    }
}
