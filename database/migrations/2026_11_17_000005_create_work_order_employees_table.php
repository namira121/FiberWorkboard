<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_order_employees', function (Blueprint $table) {
            $table->unsignedBigInteger('work_order_id');
            $table->string('employee_nik', 30);

            $table->primary(['work_order_id', 'employee_nik']);
            $table->index('employee_nik', 'woe_employee_index');

            $table->foreign('work_order_id', 'woe_work_order_fk')
                ->references('id')->on('work_orders')
                ->cascadeOnDelete()->cascadeOnUpdate();
            $table->foreign('employee_nik', 'woe_employee_fk')
                ->references('nik')->on('employees')
                ->restrictOnDelete()->cascadeOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_order_employees');
    }
};
