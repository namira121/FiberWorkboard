@extends('layouts.app')

@section('title', 'Hapus Pekerjaan')
@section('nav', 'data')
@section('page', 'data')

@push('head')
<link rel="stylesheet" href="@v('assets/admin.css')">
@endpush

@section('topbar')
@verbatim
<span class="crumb">Superadmin / <strong>Hapus Pekerjaan</strong></span>
@endverbatim
@endsection

@section('content')
@verbatim
        <section class="content">
            <div class="heading">
                <div>
                    <h1>Hapus pekerjaan</h1>
                    <p>Penghapusan wajib disertai alasan dan dicatat di Log Aktivitas.</p>
                </div>
            </div>
            <div class="toolbar">
                <div class="fld grow"><input id="q" type="search" placeholder="Cari Prod. Order, pekerjaan, No. SO, material..." aria-label="Cari pekerjaan"></div>
                <span class="sub" id="count" style="margin:0;color:#8290a3"></span>
            </div>
            <section class="table-card"><div id="tbl"></div></section>
        </section>
@endverbatim
@include('partials.footer')
@endsection

@push('scripts')
<script src="@v('assets/auth.js')"></script>
<script src="@v('assets/mobile-menu.js')"></script>
<script src="@v('assets/admin.js')"></script>
@endpush
