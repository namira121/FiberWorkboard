<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('picklists', function (Blueprint $table) {
            $table->id();
            $table->string('picklist_no', 50);
            $table->enum('status', ['Baru', 'Diproses', 'Selesai'])->default('Baru');
            $table->dateTime('received_at');
            $table->timestamps();

            $table->unique('picklist_no', 'picklists_picklist_no_unique');
            $table->index('status', 'picklists_status_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('picklists');
    }
};
