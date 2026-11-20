<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeaderJobsTest extends TestCase
{
    use RefreshDatabase;

    private function akun(string $role, string $nik): User
    {
        return User::create([
            'nik' => $nik, 'name' => $nik,
            'password' => 'rahasia123', 'role' => $role,
        ]);
    }

    public function test_tamu_tidak_bisa_akses_api(): void
    {
        $this->getJson('/api/work-orders')->assertStatus(401);
    }

    public function test_public_tidak_bisa_export_plan(): void
    {
        $this->actingAs($this->akun('public', 'P001'))
             ->postJson('/api/export/plan', [])
             ->assertForbidden();
    }

    public function test_leader_bisa_ambil_nomor_manual(): void
    {
        $this->actingAs($this->akun('leader', 'L001'))
             ->getJson('/api/work-orders/next-manual')
             ->assertOk();
    }
}