<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

/**
 * Leader hanya melihat / mengubah pekerjaan yang dia tambahkan sendiri (work_orders.user_id).
 * Public dan Superadmin tidak dibatasi. Tanpa user yang login (artisan, tinker) juga tidak dibatasi.
 *
 * Lewati dengan WorkOrder::withoutGlobalScopes() kalau memang perlu melihat semua baris
 * (cek Prod. Order kembar, nomor MAN_ berikutnya, cek karyawan masih dipakai).
 */
class OwnJobsScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $user = Auth::user();

        if ($user !== null && $user->role === 'leader') {
            $builder->where($model->qualifyColumn('user_id'), $user->id);
        }
    }
}
