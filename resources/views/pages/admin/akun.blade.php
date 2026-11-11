@extends('layouts.app')

@section('title', 'Kelola Akun')
@section('nav', 'akun')
@section('page', 'akun')

@push('head')
<link rel="stylesheet" href="@v('assets/admin.css')">
@endpush

@section('topbar')
@verbatim
<span class="crumb">Superadmin / <strong>Kelola Akun</strong></span>
@endverbatim
@endsection

@section('content')
@verbatim
        <section class="content">
            <div class="heading">
                <div>
                    <h1>Kelola Akun</h1>
                    <p>Buat akun login, ubah role, nonaktifkan, reset password, atau paksa logout semua perangkat suatu akun.</p>
                </div>
                <div><button class="btn primary" id="addBtn" type="button">+ Tambah akun</button></div>
            </div>
            <section class="table-card"><div id="tbl"></div></section>
        </section>
    
@endverbatim
@endsection

@push('scripts')
<script src="@v('assets/auth.js')"></script>
<script src="@v('assets/mobile-menu.js')"></script>
<script src="@v('assets/admin.js')"></script>
@endpush
