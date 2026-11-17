<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('nik', 30);
            $table->string('name', 100)->nullable();
            $table->string('password');
            $table->enum('role', ['superadmin', 'leader', 'public']);
            $table->boolean('is_active')->default(true);
            $table->dateTime('last_login_at')->nullable();
            $table->string('last_login_ip', 45)->nullable();
            $table->string('remember_token', 100)->nullable();
            $table->timestamps();

            $table->unique('nik', 'users_nik_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
