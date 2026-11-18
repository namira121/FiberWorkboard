{{-- Kerangka halaman tanpa sidebar (Login). --}}
<!DOCTYPE html>
<html lang="id">
<head>
@include('layouts.head')
<title>@yield('title')</title>
@stack('head')
<link rel="stylesheet" href="@v('assets/common.css')">
</head>
<body class="@yield('body_class')">
@yield('content')

@stack('scripts')
</body>
</html>
