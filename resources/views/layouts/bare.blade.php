{{-- Kerangka halaman tanpa sidebar (Login). --}}
<!DOCTYPE html>
<html lang="id">
<head>
@include('layouts.head')
<title>@yield('title')</title>
@stack('head')
</head>
<body class="@yield('body_class')">
@yield('content')

@stack('scripts')
</body>
</html>
