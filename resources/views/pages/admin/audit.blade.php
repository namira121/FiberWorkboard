@extends('layouts.app')

@section('title', 'Log Aktivitas')
@section('nav', 'audit')
@section('page', 'audit')

@push('head')
<link rel="stylesheet" href="@v('assets/admin.css')">
@endpush

@section('topbar')
@verbatim
<span class="crumb">Superadmin / <strong>Log Aktivitas</strong></span>
@endverbatim
@endsection

@section('content')
@verbatim
        <section class="content">
            <div class="heading">
                <div>
                    <h1>Log Aktivitas</h1>
                    <p>Siapa login dan kapan, login yang gagal, serta aksi admin (akun dan hapus data). Log disimpan 365 hari.</p>
                </div>
            </div>
            <div class="stats" id="stats"></div>
            <div class="toolbar">
                <div class="fld"><label for="f_from">Dari tanggal</label><input id="f_from" type="date"></div>
                <div class="fld"><label for="f_to">Sampai tanggal</label><input id="f_to" type="date"></div>
                <div class="fld"><label for="f_nik">NIK</label><input id="f_nik" type="text" maxlength="30" placeholder="persis"></div>
                <div class="fld"><label for="f_action">Aksi</label><select id="f_action"><option value="">Semua aksi</option></select></div>
                <div class="fld grow"><label for="f_q">Kata kunci</label><input id="f_q" type="search" placeholder="cari di keterangan / nama"></div>
                <div><button class="btn primary" id="applyBtn" type="button" style="margin-top:20px">Terapkan</button></div>
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
