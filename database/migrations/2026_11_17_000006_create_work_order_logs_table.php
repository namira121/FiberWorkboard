<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_order_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('work_order_id')->nullable();
            $table->string('prod_order', 50);
            $table->dateTime('logged_at');
            $table->string('material', 50)->default('');
            $table->string('work', 150)->default('');
            $table->string('so_number', 50)->default('');
            $table->string('from_status', 20)->nullable();
            $table->enum('to_status', ['Planning', 'On progress', 'Pending', 'Done', 'Cancel']);
            $table->string('issue', 50)->nullable();
            $table->text('reason')->nullable();
            $table->unsignedTinyInteger('progress')->default(0);
            $table->string('by_name', 100);
            $table->enum('role', ['Leader', 'Public']);
            $table->string('kind', 20)->nullable();
            $table->timestamps();

            $table->index('work_order_id', 'wol_work_order_index');
            $table->index('prod_order', 'wol_prod_order_index');
            $table->index('logged_at', 'wol_logged_at_index');

            $table->foreign('work_order_id', 'wol_work_order_fk')
                ->references('id')->on('work_orders')
                ->nullOnDelete()->cascadeOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_order_logs');
    }
};
