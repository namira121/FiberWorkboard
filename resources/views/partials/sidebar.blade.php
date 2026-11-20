{{-- Sidebar tunggal untuk semua halaman. Menu menyesuaikan role akun yang login; menu aktif dari @section('nav'). --}}
@php
    $role = auth()->user()->role ?? 'public';
    $active = trim($__env->yieldContent('nav'));

    /* Ikon SVG (gaya Lucide, 24x24, garis). Ganti ikon cukup dengan mengubah nama di $items. */
    $paths = [
        'brand'     => '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
        'dashboard' => '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
        'riwayat'   => '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
        'karyawan'  => '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        'akun'      => '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
        'data'      => '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
        'audit'     => '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
        'sap'       => '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
        'logout'    => '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    ];
    $svg = fn (string $name, int $size = 18) => '<svg class="i" width="'.$size.'" height="'.$size.'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'.($paths[$name] ?? '').'</svg>';

    $items = $role === 'public'
        ? [
            ['dashboard', '/public/dashboard', 'dashboard', 'Dashboard'],
            ['riwayat',   '/public/riwayat',   'riwayat',   'Riwayat'],
        ]
        : [
            ['dashboard', '/leader/dashboard', 'dashboard', 'Dashboard'],
            ['riwayat',   '/leader/riwayat',   'riwayat',   'Riwayat'],
            ['karyawan',  '/leader/karyawan',  'karyawan',  'Karyawan'],
        ];

    if ($role === 'superadmin') {
        $items = array_merge($items, [
            ['akun',  '/admin/akun',  'akun',  'Kelola Akun'],
            ['data',  '/admin/data',  'data',  'Kelola Data'],
            ['audit', '/admin/audit', 'audit', 'Log Aktivitas'],
        ]);
    }
@endphp
<aside class="sidebar">
    <div class="brand">
        <button class="brand-mark" id="toggleBtn" aria-label="Perkecil atau buka menu" title="Perkecil / buka menu">{!! $svg('brand', 20) !!}</button>
        <span class="brand-name">Fiber Workboard</span>
    </div>

    <nav class="nav" aria-label="Menu utama">
        @foreach ($items as [$key, $href, $iconName, $label])
            <a href="{{ $href }}"@if ($key === $active) class="active" aria-current="page"@endif><span class="ico">{!! $svg($iconName) !!}</span><span class="nav-label">{{ $label }}</span></a>
        @endforeach
    </nav>

    <div class="sidebar-bottom">
        <button class="logout" id="logoutBtn">{!! $svg('logout', 16) !!}<span class="logout-text">Log out</span></button>
    </div>
</aside>