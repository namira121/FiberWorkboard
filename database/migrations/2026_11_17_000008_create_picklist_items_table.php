<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('picklist_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('picklist_id');
            $table->string('so_number', 50)->default('');
            $table->string('material_no', 50)->default('');
            $table->string('material_desc', 255)->default('');
            $table->string('prod_order', 50);
            $table->string('proses', 255)->default('');
            $table->unsignedBigInteger('work_order_id')->nullable();
            $table->timestamps();

            $table->unique(['picklist_id', 'prod_order'], 'pi_picklist_prod_unique');
            $table->index('prod_order', 'pi_prod_order_index');
            $table->index('work_order_id', 'pi_work_order_index');

            $table->foreign('picklist_id', 'pi_picklist_fk')
                ->references('id')->on('picklists')
                ->cascadeOnDelete()->cascadeOnUpdate();
            $table->foreign('work_order_id', 'pi_work_order_fk')
                ->references('id')->on('work_orders')
                ->nullOnDelete()->cascadeOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('picklist_items');
    }
};
