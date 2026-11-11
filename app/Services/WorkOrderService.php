<?php

namespace App\Services;

use App\Exceptions\BusinessRuleException;
use App\Models\Employee;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderLog;
use App\Support\Viber;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Aturan bisnis pekerjaan = terjemahan 1:1 dari assets/store.js (versi tanpa backend).
 * Setiap perubahan status ditulis ke work_order_logs dalam transaksi yang sama.
 */
class WorkOrderService
{
    /* ---------------- bentuk data untuk frontend (sama dengan store.js lama) ---------------- */

    public function present(WorkOrder $w): array
    {
        $w->loadMissing('employees');

        $job = [
            'prod'     => $w->prod_order,
            'date'     => $w->job_date?->format('Y-m-d'),
            'material' => $w->material,
            'desc'     => $w->description,
            'work'     => $w->work,
            'so'       => $w->so_number,
            'qty'      => $w->qty,
            'team'     => $w->employees->map(fn ($e) => ['id' => $e->nik, 'name' => $e->name])->values()->all(),
            'progress' => $w->progress,
            'status'   => $w->status,
            'target'   => $w->target,
        ];

        if ($w->done_date) {
            $job['doneDate'] = $w->done_date->format('Y-m-d');
        }
        if ($w->detail_loaded === false) {
            $job['detailLoaded'] = false;   // hasil scan: detail belum diambil dari SAP
        }
        if ($w->hold_time) {
            $job['holdTime'] = substr($w->hold_time, 0, 5);
        }
        foreach (['issue' => $w->issue, 'reason' => $w->reason, 'holdBy' => $w->hold_by, 'picklist' => $w->picklist_no] as $k => $v) {
            if ($v !== null && $v !== '') {
                $job[$k] = $v;
            }
        }

        return $job;
    }

    public function presentLog(WorkOrderLog $l): array
    {
        $row = [
            'ts'       => $l->logged_at->getTimestamp() * 1000,
            'date'     => $l->logged_at->format('Y-m-d'),
            'time'     => $l->logged_at->format('H:i'),
            'prod'     => $l->prod_order,
            'material' => $l->material,
            'work'     => $l->work,
            'so'       => $l->so_number,
            'from'     => $l->from_status ?? '—',
            'to'       => $l->to_status,
            'issue'    => $l->issue ?? '',
            'reason'   => $l->reason ?? '',
            'progress' => $l->progress,
            'by'       => $l->by_name,
            'role'     => $l->role,
        ];
        if ($l->kind) {
            $row['kind'] = $l->kind;
        }

        return $row;
    }

    /* ---------------- helper ---------------- */

    private function today(): string
    {
        return now()->toDateString();
    }

    private function actor(User $u): string
    {
        return $u->name ?: $u->nik;
    }

    private function find(string $prod, bool $lock = true): WorkOrder
    {
        $q = WorkOrder::where('prod_order', $prod);
        if ($lock) {
            $q->lockForUpdate();
        }

        return $q->first() ?? throw new BusinessRuleException('Pekerjaan tidak ditemukan.', 404);
    }

    private function log(WorkOrder $w, ?string $from, string $to, User $u, array $extra = []): void
    {
        WorkOrderLog::create(array_merge([
            'work_order_id' => $w->id,
            'prod_order'    => $w->prod_order,
            'logged_at'     => now(),
            'material'      => $w->material,
            'work'          => $w->work,
            'so_number'     => $w->so_number,
            'from_status'   => $from,
            'to_status'     => $to,
            'issue'         => null,
            'reason'        => null,
            'progress'      => $w->progress,
            'by_name'       => $this->actor($u),
            'role'          => $u->role === 'public' ? 'Public' : 'Leader',
        ], $extra));
    }

    private function qtyLabel(string $q): string
    {
        if (preg_match('/^\d+$/', $q)) {
            $n = (int) $q;

            return $n . ' pc' . ($n > 1 ? 's' : '');
        }

        return $q !== '' ? $q : '1 pc';
    }

    private function dash(?string $v): string
    {
        return ($v === null || $v === '') ? '-' : $v;
    }

    /* ---------------- aksi ---------------- */

    /** Tambah pekerjaan. Public selalu dapat nomor MAN_xxxx dari server; Leader boleh isi Prod. Order (hasil picklist). */
    public function create(array $data, User $u): WorkOrder
    {
        for ($try = 0; ; $try++) {
            try {
                return DB::transaction(fn () => $this->createOnce($data, $u));
            } catch (QueryException $e) {
                // 1062 = duplicate key (dua orang membuat MAN_ bersamaan) -> coba ulang
                if ($try >= 2 || ($e->errorInfo[1] ?? null) !== 1062) {
                    throw $e;
                }
            }
        }
    }

    private function createOnce(array $data, User $u): WorkOrder
    {
        $prod = $this->resolveProd($data['prod'] ?? null, $u);

        if (WorkOrder::where('prod_order', $prod)->exists()) {
            throw new BusinessRuleException("Prod. Order {$prod} sudah ada di daftar pekerjaan.");
        }

        $niks = $this->resolveTeam($data['team'] ?? []);

        $w = WorkOrder::create([
            'prod_order'  => $prod,
            'job_date'    => $this->today(),
            'material'    => trim((string) ($data['material'] ?? '')),
            'description' => trim((string) ($data['desc'] ?? '')),
            'work'        => trim((string) $data['work']),
            'so_number'   => trim((string) ($data['so'] ?? '')),
            'qty'         => trim((string) ($data['qty'] ?? '')) ?: '1 pc',
            'progress'    => 0,
            'status'      => 'Planning',
            'target'      => $data['target'] ?? null,
            'picklist_no' => trim((string) ($data['picklist'] ?? '')) ?: null,
            'detail_loaded' => ! (array_key_exists('detailLoaded', $data) && $data['detailLoaded'] === false),
        ]);
        $w->employees()->attach($niks);

        $this->log($w, null, 'Planning', $u, ['reason' => 'Pekerjaan ditambahkan.']);

        return $w->load('employees');
    }

    private function resolveProd(?string $raw, User $u): string
    {
        $raw = trim((string) $raw);

        if ($u->role === 'public' || $raw === '') {
            return $this->nextManualProd();
        }
        if (preg_match('/^man/i', $raw)) {
            if (! preg_match('/^MAN_(\d{1,4})$/i', $raw, $m)) {
                throw new BusinessRuleException('Pekerjaan tanpa picklist memakai format MAN_0001.');
            }

            return 'MAN_' . str_pad($m[1], 4, '0', STR_PAD_LEFT);
        }

        return $raw;
    }

    private function nextManualProd(): string
    {
        // pola tetap (tanpa input pengguna), aman dari injeksi
        $max = (int) WorkOrder::whereRaw("prod_order REGEXP '^MAN_[0-9]+$'")
            ->selectRaw('MAX(CAST(SUBSTRING(prod_order, 5) AS UNSIGNED)) AS m')
            ->value('m');

        return 'MAN_' . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }

    /** @return array<int,string> nik yang valid (sesuai tulisan di tabel employees) */
    private function resolveTeam(array $team): array
    {
        $want = collect($team)
            ->map(fn ($t) => is_array($t) ? ($t['id'] ?? $t['nik'] ?? null) : $t)
            ->filter(fn ($v) => is_string($v) && $v !== '')
            ->unique()->values();

        if ($want->isEmpty()) {
            return [];
        }

        $found = Employee::whereIn('nik', $want)->pluck('nik');
        $foundLower = $found->map(fn ($n) => mb_strtolower($n));
        $missing = $want->filter(fn ($n) => ! $foundLower->contains(mb_strtolower($n)));

        if ($missing->isNotEmpty()) {
            throw new BusinessRuleException('Karyawan tidak ditemukan: ' . $missing->implode(', '));
        }

        return $found->all();
    }

    public function setProgress(string $prod, int $value, ?string $reason, User $u): WorkOrder
    {
        return DB::transaction(function () use ($prod, $value, $reason, $u) {
            $w = $this->find($prod);

            if ($w->isHeld()) {
                throw new BusinessRuleException("Pekerjaan sedang {$w->status}. Hanya Leader yang bisa mengaktifkan kembali.");
            }

            $short = $w->target !== null && $value < $w->target;
            $why = trim((string) $reason);
            if ($short && $why === '') {
                throw new BusinessRuleException("Progress di bawah target {$w->target}%. Alasan wajib diisi.");
            }

            $from = $w->status;
            $w->progress = $value;
            $w->status = Viber::statusFromProgress($value);
            $w->done_date = $w->status === 'Done' ? $this->today() : null;
            $w->save();

            if ($w->status !== $from || $short) {
                $this->log($w, $from, $w->status, $u, $short ? ['reason' => "Di bawah target {$w->target}%: {$why}"] : []);
            }

            return $w->load('employees');
        });
    }

    public function hold(string $prod, string $status, string $issue, ?string $reason, User $u): WorkOrder
    {
        return DB::transaction(function () use ($prod, $status, $issue, $reason, $u) {
            if (! in_array($status, ['Pending', 'Cancel'], true)) {
                throw new BusinessRuleException('Status tidak valid.');
            }
            if (! in_array($issue, Viber::MASALAH, true)) {
                throw new BusinessRuleException('Pilih jenis masalah terlebih dahulu.');
            }
            $why = trim((string) $reason);
            if ($why === '') {
                throw new BusinessRuleException('Alasan wajib diisi.');
            }

            $w = $this->find($prod);
            if ($w->isHeld()) {
                throw new BusinessRuleException("Pekerjaan sudah {$w->status}.");
            }

            $from = $w->status;
            $w->status = $status;
            $w->issue = $issue;
            $w->reason = $why;
            $w->hold_time = now()->format('H:i:s');
            $w->hold_by = $this->actor($u);
            $w->done_date = null;
            $w->save();

            $this->log($w, $from, $status, $u, ['issue' => $issue, 'reason' => $why]);

            return $w->load('employees');
        });
    }

    /** Leader: aktifkan kembali Pending/Cancel, atau Done (repair, progress kembali 0%). */
    public function reactivate(string $prod, ?string $reason, User $u): WorkOrder
    {
        return DB::transaction(function () use ($prod, $reason, $u) {
            $w = $this->find($prod);
            $wasDone = $w->status === 'Done';
            $why = trim((string) $reason);

            if (! $w->isHeld() && ! $wasDone) {
                throw new BusinessRuleException('Hanya pekerjaan Pending, Cancel, atau Done yang bisa diaktifkan kembali.');
            }
            if ($wasDone && $why === '') {
                throw new BusinessRuleException('Alasan diaktifkan kembali wajib diisi.');
            }

            $from = $w->status;
            $prevIssue = $w->issue ?? '';
            $prevReason = $w->reason ?? '';

            if ($wasDone) {
                $w->progress = 0;
            }
            $w->status = Viber::statusFromProgress($w->progress);
            if ($w->status !== 'On progress') {
                $w->job_date = $this->today();   // supaya muncul lagi di dashboard hari ini
            }
            $w->done_date = $w->status === 'Done' ? $this->today() : null;
            $w->issue = null;
            $w->reason = null;
            $w->hold_time = null;
            $w->hold_by = null;
            $w->save();

            $text = $wasDone
                ? 'Diaktifkan kembali untuk repair. Alasan: ' . $why
                : 'Diaktifkan kembali oleh Leader.' . ($why !== '' ? ' Alasan: ' . $why . '.' : '') . ' Alasan sebelumnya: ' . ($prevReason !== '' ? $prevReason : '-');

            $this->log($w, $from, $w->status, $u, ['issue' => $prevIssue !== '' ? $prevIssue : null, 'reason' => $text]);

            return $w->load('employees');
        });
    }

    /** Leader: target plan (%) atau null = tanpa target. Tidak dicatat di riwayat (sama seperti app lama). */
    public function setTarget(string $prod, ?int $value): WorkOrder
    {
        return DB::transaction(function () use ($prod, $value) {
            $w = $this->find($prod);
            $w->target = $value;
            $w->save();

            return $w->load('employees');
        });
    }

    /** Leader: edit tulisan pekerjaan. */
    public function update(string $prod, array $fields, User $u): WorkOrder
    {
        return DB::transaction(function () use ($prod, $fields, $u) {
            $w = $this->find($prod);

            $f = [
                'work'        => preg_replace('/\s+/', ' ', trim((string) ($fields['work'] ?? ''))),
                'description' => trim((string) ($fields['desc'] ?? '')),
                'material'    => trim((string) ($fields['material'] ?? '')),
                'so_number'   => trim((string) ($fields['so'] ?? '')),
                'qty'         => $this->qtyLabel(trim((string) ($fields['qty'] ?? ''))),
            ];
            if ($f['work'] === '') {
                throw new BusinessRuleException('Pekerjaan wajib diisi.');
            }

            $names = ['work' => 'Pekerjaan', 'description' => 'Deskripsi', 'material' => 'No. Material', 'so_number' => 'No. SO', 'qty' => 'Qty'];
            $changes = [];
            foreach ($f as $k => $v) {
                $old = (string) ($w->{$k} ?? '');
                if ($old !== $v) {
                    $changes[] = "{$names[$k]}: \"{$this->dash($old)}\" → \"{$this->dash($v)}\"";
                }
            }
            if (! $changes) {
                throw new BusinessRuleException('Tidak ada perubahan.');
            }

            $w->fill($f)->save();
            $this->log($w, $w->status, $w->status, $u, ['kind' => 'edit', 'reason' => 'Data pekerjaan diedit. ' . implode('; ', $changes)]);

            return $w->load('employees');
        });
    }

    /**
     * Leader: tombol "Tampilkan detail". Tanya SAP untuk SATU Prod. Order, lalu simpan hasilnya di pekerjaan.
     * Panggilan ke SAP dilakukan di luar transaksi database supaya tidak mengunci baris saat menunggu SAP.
     */
    public function loadDetail(string $prod, User $u, SapClient $sap): WorkOrder
    {
        $w = $this->find($prod, false);
        $d = $sap->prodOrder($w->prod_order);

        return DB::transaction(function () use ($prod, $u, $d) {
            $w = $this->find($prod);

            if ($d['material'] !== '') {
                $w->material = $d['material'];
            }
            if ($d['desc'] !== '') {
                $w->description = $d['desc'];
            }
            if ($d['so'] !== '') {
                $w->so_number = $d['so'];
            }
            if ($d['qty'] !== '') {
                $w->qty = $this->qtyLabel($d['qty']);
            }
            // tulisan pekerjaan yang sudah diedit Leader tidak ditimpa
            if ($d['work'] !== '' && ($w->work === '' || $w->work === $w->prod_order)) {
                $w->work = $d['work'];
            }
            $w->detail_loaded = true;
            $w->save();

            $this->log($w, $w->status, $w->status, $u, ['kind' => 'detail', 'reason' => 'Detail diambil dari SAP.']);

            return $w->load('employees');
        });
    }

    /** Leader: "edit picklist" - Prod. Order pekerjaan diganti nomor dari picklist yang baru discan. */
    public function link(string $prod, array $pk, User $u): WorkOrder
    {
        return DB::transaction(function () use ($prod, $pk, $u) {
            $w = $this->find($prod);
            $np = trim((string) ($pk['prod'] ?? ''));

            if ($np === '') {
                throw new BusinessRuleException('Data picklist tidak valid.');
            }
            if (mb_strtolower($np) === mb_strtolower($w->prod_order)) {
                throw new BusinessRuleException('Picklist ini sama dengan Prod. Order pekerjaan ini.');
            }
            if (preg_match('/^man/i', $np)) {
                throw new BusinessRuleException('Prod. Order dari picklist tidak boleh berawalan MAN.');
            }
            if ($dup = WorkOrder::where('prod_order', $np)->first()) {
                throw new BusinessRuleException("Prod. Order {$np} sudah ada di dashboard (status {$dup->status}).");
            }

            $old = $w->prod_order;
            $wasManual = (bool) preg_match('/^MAN_\d+$/i', $old);
            $str = fn (string $k) => trim((string) ($pk[$k] ?? ''));

            $w->prod_order = $np;
            $w->picklist_no = $str('picklist') ?: null;
            if (array_key_exists('detailLoaded', $pk) && $pk['detailLoaded'] === false) {
                $w->detail_loaded = false;
            }
            $w->material = $str('material') ?: $w->material;
            $w->so_number = $str('so') ?: $w->so_number;
            $w->description = $str('desc') ?: $w->description;
            if ($str('qty') !== '') {
                $w->qty = $this->qtyLabel($str('qty'));
            }
            if (! $wasManual && $str('work') !== '') {
                $w->work = $str('work');
            } elseif ($w->work === '') {
                $w->work = $str('work') !== '' ? $str('work') : $np;
            }
            $w->save();

            // riwayat lama ikut pindah ke Prod. Order yang baru
            WorkOrderLog::where('work_order_id', $w->id)->update(['prod_order' => $np, 'material' => $w->material, 'so_number' => $w->so_number]);

            $this->log($w, $w->status, $w->status, $u, [
                'kind'   => 'link',
                'reason' => "Prod. Order diganti dari {$old} menjadi {$np} (edit picklist " . ($w->picklist_no ?: '-') . ').',
            ]);

            return $w->load('employees');
        });
    }

    public function addMember(string $prod, string $nik): WorkOrder
    {
        return DB::transaction(function () use ($prod, $nik) {
            $w = $this->find($prod);
            $emp = Employee::where('nik', $nik)->first() ?? throw new BusinessRuleException('Karyawan tidak ditemukan.', 404);

            if ($w->employees()->where('employees.nik', $emp->nik)->exists()) {
                throw new BusinessRuleException('Karyawan sudah ada di tim.');
            }
            $w->employees()->attach($emp->nik);

            return $w->load('employees');
        });
    }

    public function removeMember(string $prod, string $nik): WorkOrder
    {
        return DB::transaction(function () use ($prod, $nik) {
            $w = $this->find($prod);
            $w->employees()->detach($nik);

            return $w->load('employees');
        });
    }
}
