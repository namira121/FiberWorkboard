@extends('layouts.app')

@section('title', 'Riwayat')
@section('nav', 'riwayat')

@push('head')
<link rel="stylesheet" href="@v('assets/pages/leader-riwayat.css')">
@endpush

@section('modals')
@verbatim
<div class="team-toast" id="teamToast" role="status" aria-live="polite"></div>
    <div class="modal-backdrop" id="historyModal" role="dialog" aria-modal="true" aria-labelledby="historyModalTitle">
        <section class="history-modal">
            <div class="team-modal-header"><h2 class="team-modal-title" id="historyModalTitle">Riwayat Status</h2></div>
            <div class="team-modal-subtitle" id="historyJobInfo"></div>
            <div class="history-list" id="historyList"></div>
            <div class="team-modal-actions"><button type="button" class="team-cancel-btn" id="closeHistoryModal">Tutup</button></div>
        </section>
    </div>
@endverbatim
@endsection

@section('topbar')
@verbatim
<span class="crumb">Leader / <strong>Riwayat</strong></span>
@endverbatim
@endsection

@section('content')
@verbatim
        <section class="content">
            <div class="heading">
                <div>
                    <h1>Riwayat</h1>
                    <p>Satu baris per Prod. Order dengan status terakhirnya. Klik tombol riwayat untuk melihat perubahan status dan alasannya.</p>
                </div>
                <div class="heading-side">
                    <button type="button" class="hbtn primary" id="exportBtn" title="Export nama karyawan, proses, dan target sesuai filter yang tampil">⇩ Export Excel</button>
                </div>
            </div>

            <div class="hist-sum" id="sumRow"></div>

            <div class="hist-filters">
                <label class="field"><span>▦</span><input id="dateFilter" type="date" aria-label="Filter tanggal"></label>
                <label class="field"><span>⌕</span><input id="searchInput" type="search" placeholder="Cari SO, prod. order, material, proses..." aria-label="Cari"></label>
                <label class="field"><span>☷</span>
                    <select id="statusFilter" aria-label="Filter status">
                        <option value="all">Semua Status</option>
                        <option>On progress</option><option>Done</option><option>Pending</option><option>Cancel</option>
                    </select>
                </label>
                <label class="field"><span>⚑</span>
                    <select id="issueFilter" aria-label="Filter masalah">
                        <option value="all">Semua Masalah</option>
                        <option>Man</option><option>Material</option><option>Method</option><option>Machine</option><option>Environment</option>
                    </select>
                </label>
                <button type="button" class="reset-btn" id="resetFilter">Reset</button>
            </div>

            <div class="table-card">
                <div class="table-scroll">
                    <table style="min-width:1400px">
                        <thead><tr>
                            <th>No. SO</th><th>Prod. Order</th><th>No. Material</th><th>Deskripsi Material</th><th>Proses</th><th>Status</th><th>Masalah</th><th>Progress</th><th>Riwayat perubahan status</th><th>Aksi</th>
                        </tr></thead>
                        <tbody id="tableBody"></tbody>
                    </table>
                </div>
                <div class="table-footer"><span id="resultCount"></span></div>
            </div>
        </section>
        <footer class="footer">
            <span><strong>© 2026 Section Viber</strong> · Portal Internal Section Viber</span>
            <span>Hak cipta dilindungi undang-undang.</span>
        </footer>
    
@endverbatim
@endsection

@push('scripts')
<script src="@v('assets/picklist-data.js')"></script>
<script src="@v('assets/sim-data.js')"></script>
<script src="@v('assets/store.js')"></script>
<script src="@v('assets/leader-tools.js')"></script>
<script src="@v('assets/history.js')"></script>
<script src="@v('assets/pages/leader-riwayat.js')"></script>
<script src="@v('assets/auth.js')"></script>
<script src="@v('assets/mobile-menu.js')"></script>
@endpush
