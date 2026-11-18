<?php

namespace Tests\Feature;

use App\Models\User;
use Tests\TestCase;

class WorkspaceRoutingTest extends TestCase
{
    private function user(string $role): User
    {
        return new User([
            'nik' => $role . '-test',
            'name' => ucfirst($role) . ' Test',
            'role' => $role,
        ]);
    }

    public function test_superadmin_is_redirected_to_admin_workspace(): void
    {
        $this->actingAs($this->user('superadmin'))
            ->get('/')
            ->assertRedirect('/admin/dashboard');
    }

    public function test_superadmin_leader_pages_redirect_to_admin_pages(): void
    {
        $this->actingAs($this->user('superadmin'))
            ->get('/leader/dashboard')
            ->assertRedirect('/admin/dashboard');

        $this->actingAs($this->user('superadmin'))
            ->get('/leader/karyawan')
            ->assertRedirect('/admin/karyawan');
    }

    public function test_superadmin_can_open_admin_workspace_pages(): void
    {
        $this->actingAs($this->user('superadmin'))
            ->get('/admin/dashboard')
            ->assertOk()
            ->assertSee('Superadmin /')
            ->assertSee('href="/admin/karyawan"', false);
    }

    public function test_leader_cannot_open_admin_workspace(): void
    {
        $this->actingAs($this->user('leader'))
            ->get('/admin/dashboard')
            ->assertForbidden();
    }

    public function test_legacy_leader_links_follow_superadmin_workspace(): void
    {
        $this->actingAs($this->user('superadmin'))
            ->get('/Leader/dashboard-lead.html')
            ->assertRedirect('/admin/dashboard');
    }
}
