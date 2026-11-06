<?php

namespace App\Http\Controllers;

use App\Exceptions\BusinessRuleException;
use App\Models\User;
use App\Services\AuditService;
use App\Support\AdminValidation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Kelola akun login (khusus superadmin). */
class UserController extends Controller
{
    private const ROLES = ['superadmin', 'leader', 'public'];

    private function check(Request $r, array $rules): array
    {
        return $r->validate($rules, AdminValidation::MESSAGES, AdminValidation::ATTRIBUTES);
    }

    private function find(int $id): User
    {
        return User::find($id) ?? throw new BusinessRuleException('Akun tidak ditemukan.', 404);
    }

    private function row(User $u, int $sessions = 0, ?int $selfId = null): array
    {
        return [
            'id'            => $u->id,
            'nik'           => $u->nik,
            'name'          => $u->name,
            'role'          => $u->role,
            'is_active'     => (bool) $u->is_active,
            'last_login_at' => $u->last_login_at?->format('Y-m-d H:i:s'),
            'last_login_ip' => $u->last_login_ip,
            'sessions'      => $sessions,
            'is_self'       => $u->id === $selfId,
        ];
    }

    /** Tidak boleh menghapus/menonaktifkan/menurunkan superadmin aktif terakhir. */
    private function guardLastSuperadmin(User $target, string $what): void
    {
        if ($target->role === 'superadmin' && $target->is_active
            && User::where('role', 'superadmin')->where('is_active', 1)->where('id', '!=', $target->id)->doesntExist()) {
            throw new BusinessRuleException("Tidak bisa {$what}: minimal harus ada satu superadmin aktif.");
        }
    }

    private function killSessions(User $u, ?string $exceptId = null): int
    {
        $q = DB::table('sessions')->where('user_id', $u->id);
        if ($exceptId) {
            $q->where('id', '!=', $exceptId);
        }

        return $q->delete();
    }

    public function index(Request $r): JsonResponse
    {
        $counts = DB::table('sessions')->whereNotNull('user_id')
            ->selectRaw('user_id, COUNT(*) AS c')->groupBy('user_id')->pluck('c', 'user_id');

        $users = User::orderByRaw("FIELD(role, 'superadmin', 'leader', 'public')")->orderBy('nik')->get()
            ->map(fn (User $u) => $this->row($u, (int) ($counts[$u->id] ?? 0), $r->user()->id))->values();

        return response()->json(['ok' => true, 'users' => $users]);
    }

    public function store(Request $r): JsonResponse
    {
        $d = $this->check($r, [
            'nik'      => ['required', 'string', 'max:30', 'regex:/^[A-Za-z0-9._-]{3,30}$/', 'unique:users,nik'],
            'name'     => 'required|string|max:100',
            'role'     => ['required', Rule::in(self::ROLES)],
            'password' => 'required|string|min:10|max:100|different:nik',
        ]);

        $u = User::create($d);
        AuditService::record('user_create', "Membuat akun {$u->nik} ({$u->role}).", $r->user(), 'user', (string) $u->id);

        return response()->json(['ok' => true, 'user' => $this->row($u, 0, $r->user()->id)], 201);
    }

    public function update(Request $r, int $id): JsonResponse
    {
        $u = $this->find($id);
        $d = $this->check($r, [
            'name'      => 'required|string|max:100',
            'role'      => ['required', Rule::in(self::ROLES)],
            'is_active' => 'required|boolean',
        ]);
        $active = (bool) $d['is_active'];
        $isSelf = $u->id === $r->user()->id;

        if ($isSelf && ($d['role'] !== $u->role || ! $active)) {
            throw new BusinessRuleException('Role dan status akun sendiri tidak bisa diubah di sini.');
        }
        if ($d['role'] !== 'superadmin' && $u->role === 'superadmin') {
            $this->guardLastSuperadmin($u, 'menurunkan role');
        }
        if (! $active && $u->is_active) {
            $this->guardLastSuperadmin($u, 'menonaktifkan akun');
        }

        $changes = [];
        if ($u->name !== $d['name']) {
            $changes[] = 'nama';
        }
        if ($u->role !== $d['role']) {
            $changes[] = "role {$u->role} → {$d['role']}";
        }
        if ((bool) $u->is_active !== $active) {
            $changes[] = $active ? 'diaktifkan' : 'dinonaktifkan';
        }

        $u->name = $d['name'];
        $u->role = $d['role'];
        $u->is_active = $active;
        $u->save();

        if (! $active) {
            $this->killSessions($u);
        }
        if ($changes) {
            AuditService::record('user_update', "Mengubah akun {$u->nik}: " . implode(', ', $changes) . '.', $r->user(), 'user', (string) $u->id);
        }

        return response()->json(['ok' => true, 'user' => $this->row($u, 0, $r->user()->id)]);
    }

    public function resetPassword(Request $r, int $id): JsonResponse
    {
        $u = $this->find($id);
        $d = $this->check($r, ['password' => 'required|string|min:10|max:100']);

        if (mb_strtolower($d['password']) === mb_strtolower($u->nik)) {
            throw new BusinessRuleException('Password tidak boleh sama dengan NIK.');
        }

        $u->password = $d['password'];   // di-hash otomatis oleh cast
        $u->save();

        // semua perangkat akun itu harus login ulang (kecuali sesi saya sendiri)
        $this->killSessions($u, $u->id === $r->user()->id ? $r->session()->getId() : null);
        AuditService::record('user_password_reset', "Reset password akun {$u->nik}.", $r->user(), 'user', (string) $u->id);

        return response()->json(['ok' => true]);
    }

    public function forceLogout(Request $r, int $id): JsonResponse
    {
        $u = $this->find($id);
        if ($u->id === $r->user()->id) {
            throw new BusinessRuleException('Untuk keluar dari akun sendiri pakai tombol Log out.');
        }

        $n = $this->killSessions($u);
        AuditService::record('user_force_logout', "Paksa logout akun {$u->nik} ({$n} sesi).", $r->user(), 'user', (string) $u->id);

        return response()->json(['ok' => true, 'sessions_closed' => $n]);
    }

    public function destroy(Request $r, int $id): JsonResponse
    {
        $u = $this->find($id);
        if ($u->id === $r->user()->id) {
            throw new BusinessRuleException('Akun sendiri tidak bisa dihapus.');
        }
        $this->guardLastSuperadmin($u, 'menghapus akun');

        $this->killSessions($u);
        $u->delete();
        AuditService::record('user_delete', "Menghapus akun {$u->nik} ({$u->role}).", $r->user(), 'user', (string) $id);

        return response()->json(['ok' => true]);
    }
}
