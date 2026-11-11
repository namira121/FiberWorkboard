{{-- Sidebar tunggal untuk semua halaman. Menu menyesuaikan role akun yang login; menu aktif dari @section('nav'). --}}
@php
    $role = auth()->user()->role ?? 'public';
    $active = trim($__env->yieldContent('nav'));

    $items = $role === 'public'
        ? [
            ['dashboard', '/public/dashboard', '▦', 'Dashboard'],
            ['riwayat',   '/public/riwayat',   '⟲', 'Riwayat'],
        ]
        : [
            ['dashboard', '/leader/dashboard', '▦', 'Dashboard'],
            ['riwayat',   '/leader/riwayat',   '⟲', 'Riwayat'],
            ['karyawan',  '/leader/karyawan',  '♙', 'Karyawan'],
        ];

    if ($role === 'superadmin') {
        $items = array_merge($items, [
            ['akun',  '/admin/akun',  '♚', 'Kelola Akun'],
            ['data',  '/admin/data',  '▤', 'Kelola Data'],
            ['audit', '/admin/audit', '☷', 'Log Aktivitas'],
        ]);
    }
@endphp
<aside class="sidebar">
    <div class="brand">
        <button class="brand-mark" id="toggleBtn" aria-label="Perkecil atau buka menu" title="Perkecil / buka menu">▦</button>
        <span class="brand-name">Section Viber</span>
    </div>

    <nav class="nav" aria-label="Menu utama">
        @foreach ($items as [$key, $href, $icon, $label])
            <a href="{{ $href }}"@if ($key === $active) class="active" aria-current="page"@endif><span class="ico">{{ $icon }}</span><span class="nav-label">{{ $label }}</span></a>
        @endforeach
    </nav>

    <div class="sidebar-bottom">
        <button class="logout" id="logoutBtn">Log out&nbsp; ↪</button>
    </div>
</aside>
