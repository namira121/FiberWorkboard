@extends('layouts.app')

@section('title', 'Dashboard Leader')
@section('nav', 'dashboard')

@push('head')
<link rel="stylesheet" href="@v('assets/pages/leader-dashboard.css')">
@endpush

@section('modals')
@verbatim
<!-- MODAL RIWAYAT STATUS PER JOB -->
    <div class="modal-backdrop" id="historyModal" role="dialog" aria-modal="true" aria-labelledby="historyModalTitle">
        <section class="history-modal">
            <div class="team-modal-header"><h2 class="team-modal-title" id="historyModalTitle">Riwayat Status</h2></div>
            <div class="team-modal-subtitle" id="historyJobInfo"></div>
            <div class="history-list" id="historyList"></div>
            <div class="team-modal-actions"><button type="button" class="team-cancel-btn" id="closeHistoryModal">Tutup</button></div>
        </section>
    </div>
    
    <!-- MODAL KELOLA TIM (tanpa alasan) -->
    <div class="modal-backdrop" id="teamModal" role="dialog" aria-modal="true" aria-labelledby="teamModalTitle">
        <section class="team-modal">
            <div class="team-modal-header"><h2 class="team-modal-title" id="teamModalTitle">Kelola Tim Pengerja</h2></div>
            <div class="team-modal-subtitle" id="teamJobInfo"></div>
            <div class="team-section-title">Karyawan dalam tim</div>
            <div id="assignedEmployees"></div>
            <div class="team-section-title">Tambah karyawan</div>
            <div class="team-add-row">
                <select id="employeeSelect" aria-label="Pilih karyawan untuk ditambahkan"><option value="">Pilih karyawan...</option></select>
                <button type="button" class="team-add-btn" id="addEmployeeBtn">＋ Tambahkan</button>
            </div>
            <div class="team-note">Tim memakai satu progress bar yang sama untuk seluruh anggota. Menambah atau melepas anggota langsung diterapkan tanpa alasan.</div>
            <div class="team-modal-actions"><button type="button" class="team-cancel-btn" id="closeTeamModal">Tutup</button></div>
        </section>
    </div>
    <!-- MODAL TARGET PLAN (khusus Leader) -->
    <div class="modal-backdrop" id="targetModal" role="dialog" aria-modal="true" aria-labelledby="targetTitle">
        <section class="status-modal">
            <h2 class="team-modal-title" id="targetTitle">Target plan</h2>
            <p class="pc-sub" id="targetJobInfo"></p>
            <div class="slider-wrap">
                <div class="slider-bubble" id="targetBubble">100%</div>
                <input type="range" class="progress-range" id="targetRange" min="0" max="100" step="5" value="100" aria-label="Target progress">
            </div>
            <div class="slider-scale"><span>0%</span><span>50%</span><span>100%</span></div>
            <div class="status-error" id="targetError" role="alert"></div>
            <div class="pc-foot">
                <div class="pc-left"><button type="button" class="team-cancel-btn" id="clearTarget" style="padding:13px 18px;font-size:13px">Hapus target</button></div>
                <div class="pc-right">
                    <button type="button" class="team-cancel-btn" id="closeTargetModal" style="padding:13px 18px;font-size:13px">Batal</button>
                    <button type="button" class="pc-save" id="saveTargetBtn">Simpan target</button>
                </div>
            </div>
        </section>
    </div>
    <!-- MODAL PROGRESS (1 bar untuk 1 job / 1 tim) -->
    <div class="modal-backdrop" id="progressModal" role="dialog" aria-modal="true" aria-labelledby="progressModalTitle">
        <section class="status-modal">
            <div class="pc-head">
                <h2 class="team-modal-title" id="progressModalTitle">Nama pekerjaan</h2>
                <span class="status s-planning" id="progressBadge">Planning</span>
            </div>
            <p class="pc-sub" id="progressJobInfo"></p>

            <div class="slider-wrap">
                <div class="slider-bubble" id="sliderBubble">0%</div>
                <input type="range" class="progress-range" id="progressRange" min="0" max="100" step="5" value="0" aria-label="Persentase progress">
            </div>
            <div class="slider-scale"><span>0%</span><span>50%</span><span>100%</span></div>
            <p class="pc-sub" id="targetNote" style="margin-top:12px"></p>
            <div class="pc-reason" id="shortBox" hidden>
                <div class="team-section-title">Alasan belum mencapai target</div>
                <textarea class="status-textarea" id="shortReason" placeholder="Tulis kenapa progress belum mencapai target plan..."></textarea>
            </div>

            <div class="pc-reason" id="progressReasonBox" hidden>
                <div class="team-section-title">Jenis masalah</div>
                <div class="m5" role="group" aria-label="Jenis masalah">
                    <button type="button" class="m5-opt" data-val="Man">Man</button>
                    <button type="button" class="m5-opt" data-val="Material">Material</button>
                    <button type="button" class="m5-opt" data-val="Method">Method</button>
                    <button type="button" class="m5-opt" data-val="Machine">Machine</button>
                    <button type="button" class="m5-opt" data-val="Environment">Environment</button>
                </div>
                <div class="team-section-title" id="progressReasonLabel">Alasan</div>
                <textarea class="status-textarea" id="progressReason" aria-labelledby="progressReasonLabel"></textarea>
            </div>
            <div class="status-error" id="progressError" role="alert"></div>

            <div class="pc-foot">
                <div class="pc-left">
                    <button type="button" class="pc-btn" data-mode="Pending" aria-pressed="false">Pending</button>
                    <button type="button" class="pc-btn" data-mode="Cancel" aria-pressed="false">Cancel</button>
                </div>
                <div class="pc-right">
                    <button type="button" class="team-cancel-btn" id="closeProgressModal" style="padding:13px 18px;font-size:13px">Batal</button>
                    <button type="button" class="pc-save" id="saveProgressBtn" disabled>Simpan progress</button>
                </div>
            </div>
        </section>
    </div>

    <div class="team-toast" id="teamToast" role="status" aria-live="polite"></div>

    <!-- POPUP ALASAN PENDING / CANCEL -->
    <div class="modal-backdrop" id="reasonModal" role="dialog" aria-modal="true" aria-labelledby="reasonTitle">
        <section class="reason-modal">
            <div class="modal-title-row">
                <div class="modal-icon" id="reasonIcon">⚠️</div>
                <h2 class="modal-title" id="reasonTitle">Alasan Pending</h2>
            </div>
            <div class="reason-job">
                <div class="reason-gear">⚙</div>
                <div>
                    <div class="reason-job-name" id="reasonWork">Nama pekerjaan</div>
                    <div class="reason-meta"><span id="reasonEmployee"></span><br><span id="reasonTime"></span></div>
                </div>
            </div>
            <div class="reason-issue"><div class="reason-label">Jenis masalah</div><div id="reasonIssue"></div></div>
            <div class="reason-label">Alasan</div>
            <div class="reason-copy" id="reasonCopy"></div>
            <div class="lock-note" id="reasonLockNote" hidden><span>🔒</span><span>Pekerjaan yang di-pending atau di-cancel hanya dapat diaktifkan kembali oleh Leader.</span></div>
            <div class="modal-actions">
                <button class="modal-close" id="closeReason">Kembali</button>
                <button class="reason-action reactivate" id="reactivateBtn" type="button" >↻ Aktifkan kembali</button>
            </div>
        </section>
    </div>
@endverbatim
@endsection

@section('topbar')
@verbatim
<span class="crumb">Leader / <strong>Dashboard</strong></span>
@endverbatim
@endsection

@section('content')
@verbatim
        <section class="content">
            <div class="heading">
                <div>
                    <h1>Dashboard</h1>
                    <p>Pantau pekerjaan, progress tim, dan karyawan yang bertanggung jawab.</p>
                </div>
                <div class="heading-side">
                    <button type="button" class="hbtn ghost" id="exportBtn" title="Export nama, proses, dan target ke Excel">⇩ Export Excel</button>
                    <a class="hbtn primary" href="/leader/scan">⌕ Scan picklist</a>
                    <div class="date-note">◷ &nbsp; Data pekerjaan harian</div>
                </div>
            </div>

            <!-- FORM TAMBAH JOB MANUAL -->
            <section class="manual-card" aria-labelledby="manualTitle">
                <h2 class="manual-title" id="manualTitle">Tambah job manual</h2>
                <form id="manualForm" novalidate autocomplete="off">
                    <div class="manual-grid six">
                        <div class="m-field c3"><label for="mProd">Prod. Order <span style="color:#c83e39">*</span></label><div class="nik-row"><input id="mProd" placeholder="400155497 / MAN_0001"><button type="button" class="nik-add" id="manProdBtn" style="width:auto;padding:0 11px;font-size:11px" title="Pekerjaan tanpa picklist: isi otomatis MAN_0001, MAN_0002, ...">MAN</button></div></div>
                        <div class="m-field c3"><label for="mMaterial">No. Material (opsional)</label><input id="mMaterial" placeholder="181020601"></div>
                        <div class="m-field c3"><label for="mSo">No. SO (opsional)</label><input id="mSo" placeholder="BB30064-26"></div>
                        <div class="m-field c3"><label for="mQty">Qty</label><input id="mQty" type="number" min="1" value="1" inputmode="numeric"></div>
                        <div class="m-field c6"><label for="mWork">Pekerjaan</label><input id="mWork" placeholder="Contoh: Setting cowl depan R25"></div>
                        <div class="m-field c6">
                            <label for="mNik">NIK</label>
                            <div class="nik-row">
                                <input id="mNik" list="nikList" placeholder="WN0007">
                                <button type="button" class="nik-add" id="addNikBtn" title="Tambah karyawan lain" aria-label="Tambahkan NIK ke daftar">＋</button>
                            </div>
                        </div>
                    </div>
                    <div class="nik-chips" id="nikChips" aria-label="Karyawan yang akan ditugaskan"></div>
                    <div class="manual-foot">
                        <div class="manual-msg">
                            <div class="m-hint">Prod. Order wajib diisi dan menjadi kunci unik. Pekerjaan tanpa picklist memakai MAN_0001 (tekan tombol MAN). No. Material, No. SO, dan NIK boleh dikosongkan. Untuk lebih dari 1 karyawan, tekan Enter atau tombol ＋ setelah mengisi tiap NIK.</div>
                            <div class="status-error" id="manualError" role="alert"></div>
                        </div>
                        <button type="submit" class="manual-submit">Tambah ke daftar</button>
                    </div>
                </form>
                <datalist id="nikList"></datalist>
            </section>

            <!-- FILTER -->
            <div class="filters">
                <label class="field">
                    <span>▦</span>
                    <input id="dateFilter" type="date" aria-label="Filter tanggal">
                    <button type="button" class="clear-btn" id="clearDate" title="Hapus filter tanggal" aria-label="Hapus filter tanggal">✕</button>
                </label>
                <label class="field"><span>⌕</span>
                    <input id="searchInput" type="search" placeholder="Cari prod. order, pekerjaan, atau karyawan..." aria-label="Cari">
                </label>
                <label class="field"><span>☷</span>
                    <select id="statusFilter" aria-label="Filter status">
                        <option value="all">Semua Status</option>
                        <option>On progress</option><option>Done</option><option>Planning</option><option>Pending</option><option>Cancel</option>
                    </select>
                </label>
            </div>

            <div class="table-card">
                <div class="table-scroll">
                    <table>
                        <thead><tr>
                            <th>Prod. Order</th><th>No. Material</th><th>Deskripsi Material</th><th>Pekerjaan</th><th>No. SO</th><th>Jumlah</th>
                            <th>Tim Pengerja</th><th>Progress</th><th>Target Plan</th><th>Status</th><th>Aksi</th>
                        </tr></thead>
                        <tbody id="tableBody"></tbody>
                    </table>
                </div>
                <div class="table-footer"><span id="resultCount">Menampilkan 0 pekerjaan</span></div>
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
@verbatim
<script>window.DASH_ROLE = 'Leader';</script>
@endverbatim
<script src="@v('assets/dashboard.js')"></script>
<script src="@v('assets/auth.js')"></script>
<script src="@v('assets/mobile-menu.js')"></script>
@endpush
