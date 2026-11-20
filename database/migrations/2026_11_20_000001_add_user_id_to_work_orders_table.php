<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            // pemilik pekerjaan = akun yang menambahkannya. NULL = tidak diketahui / akunnya sudah dihapus.
            $table->unsignedBigInteger('user_id')->nullable()->after('id');
            $table->index('user_id', 'work_orders_user_id_index');
            $table->foreign('user_id', 'work_orders_user_fk')
                ->references('id')->on('users')
                ->nullOnDelete()->cascadeOnUpdate();
        });

        // Isi pemilik untuk pekerjaan yang sudah ada, dari riwayat "Pekerjaan ditambahkan" (siapa yang menambahkan).
        // Hanya dicocokkan kalau namanya / NIK-nya cocok dengan tepat satu akun; sisanya dibiarkan NULL.
        if (DB::getDriverName() === 'mysql') {
            DB::statement("
                UPDATE work_orders w
                JOIN (
                    SELECT l.work_order_id, MIN(u.id) AS uid, COUNT(DISTINCT u.id) AS n
                    FROM work_order_logs l
                    JOIN users u ON (u.nik = l.by_name OR u.name = l.by_name)
                                AND u.role IN ('leader', 'public', 'superadmin')
                    WHERE l.from_status IS NULL
                      AND l.to_status = 'Planning'
                      AND l.work_order_id IS NOT NULL
                    GROUP BY l.work_order_id
                    HAVING n = 1
                ) x ON x.work_order_id = w.id
                SET w.user_id = x.uid
                WHERE w.user_id IS NULL
            ");
        }
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropForeign('work_orders_user_fk');
            $table->dropIndex('work_orders_user_id_index');
            $table->dropColumn('user_id');
        });
    }
};
