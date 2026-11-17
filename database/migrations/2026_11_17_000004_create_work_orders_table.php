<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_orders', function (Blueprint $table) {
            $table->id();
            $table->string('prod_order', 50);
            $table->date('job_date');
            $table->string('material', 50)->default('');
            $table->string('description', 255)->default('');
            $table->string('work', 150);
            $table->string('so_number', 50)->default('');
            $table->string('qty', 30)->default('');
            $table->unsignedTinyInteger('progress')->default(0);
            $table->unsignedInteger('target')->nullable();
            $table->enum('status', ['Planning', 'On progress', 'Pending', 'Done', 'Cancel'])->default('Planning');
            $table->string('picklist_no', 50)->nullable();
            $table->boolean('detail_loaded')->default(true);
            $table->string('issue', 50)->nullable();
            $table->text('reason')->nullable();
            $table->string('hold_by', 50)->nullable();
            $table->time('hold_time')->nullable();
            $table->date('done_date')->nullable();
            $table->timestamps();

            $table->unique('prod_order', 'work_orders_prod_order_unique');
            $table->index('job_date', 'work_orders_job_date_index');
            $table->index('status', 'work_orders_status_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_orders');
    }
};
