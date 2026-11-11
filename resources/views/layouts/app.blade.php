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
</head>
<body{!! $page !== '' ? ' data-page="' . e($page) . '"' : '' !!}>
<div class="app" id="app">

    @include('partials.sidebar')

    <div class="mobile-overlay" id="overlay"></div>

    @yield('modals')

    <main class="main">
        <header class="topbar">@yield('topbar')</header>

        @yield('content')
    </main>
</div>

@stack('scripts')
</body>
</html>
