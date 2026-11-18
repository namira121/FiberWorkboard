{{-- Kerangka halaman setelah login (Leader, Public, Admin): head bersama + sidebar + topbar.
     Tiap halaman mengisi: title, nav (menu aktif), page (opsional), modals, topbar, content, dan stack head/scripts. --}}
@php
    $page = trim($__env->yieldContent('page'));
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
@include('layouts.head')
<title>@yield('title') - Section Viber</title>
@stack('head')
<link rel="stylesheet" href="@v('assets/common.css')">
</head>
<body{!! $page !== '' ? ' data-page="' . e($page) . '"' : '' !!}>
<a class="skip-link" href="#mainContent">Lewati ke konten utama</a>
<div class="app" id="app">

    @include('partials.sidebar')

    <div class="mobile-overlay" id="overlay"></div>

    @yield('modals')

    <main class="main" id="mainContent" tabindex="-1">
        <header class="topbar">@yield('topbar')</header>

        @yield('content')
    </main>
</div>

@php
$workspaceUrlMap = [
    'dashboard' => \App\Support\Workspace::url('dashboard'),
    'riwayat' => \App\Support\Workspace::url('riwayat'),
    'karyawan' => \App\Support\Workspace::url('karyawan'),
    'scan' => \App\Support\Workspace::url('scan'),
];
@endphp
<script>
window.WORKSPACE_URLS = {!! json_encode($workspaceUrlMap, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) !!};
document.querySelectorAll('[data-workspace-href]').forEach(function (link) {
    const target = window.WORKSPACE_URLS[link.dataset.workspaceHref];
    if (target) link.href = target;
});
const workspaceBase = new URL(window.WORKSPACE_URLS.dashboard, window.location.origin).pathname.replace(/\/dashboard$/, '');
document.querySelectorAll('a[href^="/leader/"]').forEach(function (link) {
    link.pathname = workspaceBase + link.pathname.slice('/leader'.length);
});
</script>
@stack('scripts')
</body>
</html>
