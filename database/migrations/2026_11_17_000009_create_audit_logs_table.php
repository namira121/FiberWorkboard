<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // user_id sengaja tanpa foreign key: log tetap ada walau akunnya dihapus
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->dateTime('occurred_at');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('nik', 30)->nullable();
            $table->string('user_name', 100)->nullable();
            $table->string('role', 20)->nullable();
            $table->string('action', 50);
            $table->string('description', 500)->default('');
            $table->string('target_type', 30)->nullable();
            $table->string('target_id', 100)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamps();

            $table->index('occurred_at', 'audit_occurred_at_index');
            $table->index('user_id', 'audit_user_id_index');
            $table->index('action', 'audit_action_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
