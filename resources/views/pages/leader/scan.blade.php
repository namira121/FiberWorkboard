@extends('layouts.app')

@section('title', 'Scan Picklist')
@section('nav', 'dashboard')

@push('head')
<link rel="stylesheet" href="@v('assets/pages/leader-scan.css')">
<script src="@v('assets/vendor/zxing.min.js')"></script>
<script src="@v('assets/picklist-data.js')"></script>
<script src="@v('assets/sim-data.js')"></script>
<script src="@v('assets/store.js')"></script>
<script src="@v('assets/leader-tools.js')"></script>
@endpush

@section('modals')
@verbatim
<div class="toast" id="toast" role="status"></div>
@endverbatim
@endsection

@section('topbar')
@verbatim
<span class="crumb">Leader / <a href="/leader/dashboard">Dashboard</a> / <strong>Scan picklist</strong></span>
@endverbatim
@endsection

@section('content')
@verbatim
        <section class="content">

            <div class="heading">
                <div>
                    <h1>Scan picklist</h1>
                    <p>Scan barcode picklist untuk membaca data pekerjaan, lalu scan barcode karyawan untuk menentukan tim pengerja.</p>
                </div>
                <a class="btn" href="/leader/dashboard">← Kembali ke dashboard</a>
            </div>

            <div class="card hidden" id="linkBanner" style="margin-bottom:14px;border-color:#bcd7f7;background:#f5f9ff">
                <strong>Edit picklist <span id="linkProd"></span></strong>
                <div class="help" id="linkInfo" style="margin-top:5px"></div>
            </div>

            <div class="scan-layout">

                <div>
                    <!-- KAMERA -->
                    <div class="card">
                        <div class="camera-header">
                            <h2>Kamera</h2>
                            <span class="camera-indicator" id="cameraIndicator">● Kamera mati</span>
                        </div>

                        <div class="camera-box" id="cameraBox">
                            <video id="cameraVideo" autoplay muted playsinline class="hidden"></video>
                            <div class="camera-placeholder" id="cameraPlaceholder">
                                <div class="camera-symbol">▣</div>
                                <div id="placeholderText">Aktifkan kamera untuk scan barcode picklist</div>
                            </div>
                            <div class="scan-frame"></div>
                            <div class="camera-hint" id="cameraHint">Posisikan barcode di dalam kotak</div>
                        </div>

                        <div class="camera-actions">
                            <button class="btn btn-primary btn-sm" id="startCamera" type="button">◉ Scan picklist</button>
                            <button class="btn btn-sm hidden" id="stopCamera" type="button">Matikan kamera</button>
                            <button class="btn btn-sm hidden" id="zoomBtn" type="button">Zoom 1×</button>
                            <button class="btn btn-sm" id="photoBtn" type="button">📷 Foto barcode panjang</button>
                            <input type="file" id="photoInput" accept="image/*" capture="environment" hidden>
                        </div>
                        <div id="engineInfo" style="font-size:11px;color:#8a97a6;text-align:center;margin-top:6px"></div>

                        <div class="scan-message" id="cameraError" role="alert"></div>

                        <div class="manual-block">
                            <label class="field-label" for="manualProd">Kamera bermasalah? Ketik isi barcode picklist</label>
                            <div class="input-row">
                                <input id="manualProd" placeholder="Contoh: 100030008-000002-0402" autocomplete="off">
                                <button class="btn" id="manualFind" type="button">Cari</button>
                            </div>
                        </div>
                    </div>

                    <!-- HASIL SCAN -->
                    <div class="card">
                        <div class="result-head">
                            <h2>Hasil scan terakhir</h2>
                            <span class="badge planning" id="scanState">Belum scan</span>
                        </div>

                        <div class="empty-result" id="noResult">Belum ada picklist yang dipindai. Klik "Scan picklist" lalu arahkan kamera ke barcode.</div>

                        <div class="result-box hidden" id="scanResult">
                            <div class="result-meta">
                                <span class="badge done">✓ Berhasil dibaca</span>
                                <span><span id="rCode"></span></span>
                            </div>

                            <div class="read-grid">
                                <div class="read-item">
                                    <span>1. No. Sales Order</span>
                                    <strong id="rSO"></strong>
                                </div>
                                <div class="read-item">
                                    <span>2. Prod. Order</span>
                                    <strong id="rProd"></strong>
                                </div>
                                <div class="read-item">
                                    <span>3. No. Material</span>
                                    <strong id="rMaterial"></strong>
                                </div>
                                <div class="read-item wide">
                                    <span>4. Proses kerja</span>
                                    <strong id="rWork"></strong>
                                    <div class="sub" id="rQty"></div>
                                </div>
                                <div class="read-item wide">
                                    <span>5. Karyawan (tim pengerja)</span>
                                    <div class="assignees" id="assignees" aria-live="polite"></div>
                                </div>
                            </div>

                            <div class="assign-box">
                                <label class="field-label">Tambah karyawan dengan scan barcode</label>
                                <div class="emp-scan">
                                    <button class="btn btn-primary btn-sm" id="scanEmp" type="button">◉ Scan barcode karyawan</button>
                                    <span class="help" style="margin:0">Scan lagi untuk menambah karyawan lain.</span>
                                </div>

                                <div class="emp-or">Atau ketik NIK / nama karyawan</div>
                                <div class="suggest-wrap">
                                    <div class="input-row">
                                        <input id="scanNik" placeholder="Contoh: WN0003 atau Dian" autocomplete="off">
                                        <button class="btn" id="addAssignee" type="button">＋ Tambah</button>
                                    </div>
                                    <div class="suggest hidden" id="suggestBox" role="listbox"></div>
                                </div>

                                <div class="help" id="employeeHelp"></div>
                                <div class="help">Karyawan belum terdaftar? <a href="/leader/karyawan">Tambahkan di halaman Karyawan</a>.</div>
                            </div>

                            <div class="assign-box" id="targetBox" style="margin-top:12px">
                                <label class="field-label" for="tgtRange">Target plan (%) <span style="font-weight:500;color:#8290a3">· opsional, bisa diatur nanti di dashboard</span></label>
                                <label class="tgt-toggle"><input type="checkbox" id="tgtOn"> <span id="tgtOnText">Belum diatur (geser bar untuk mengatur)</span></label>
                                <div class="slider-wrap" id="tgtWrap">
                                    <div class="slider-bubble" id="tgtBubble">100%</div>
                                    <input type="range" class="progress-range" id="tgtRange" min="0" max="100" step="5" value="100" aria-label="Target plan">
                                </div>
                                <div class="slider-scale"><span>0%</span><span>50%</span><span>100%</span></div>
                                <div class="help">Kalau progress karyawan di bawah target, mereka wajib menulis alasan.</div>
                            </div>

                            <div class="result-actions">
                                <button class="btn btn-sm" id="rescan" type="button">Scan picklist lain</button>
                                <a class="btn btn-primary btn-sm hidden" id="goDashboard" href="/leader/dashboard">Lihat di dashboard →</a>
                                <button class="btn btn-primary btn-sm" id="assignTask" type="button">Simpan di dashboard</button>
                            </div>
                        </div>
                    </div>

                    <div class="back-row">
                        <a class="btn" href="/leader/dashboard">← Kembali ke dashboard</a>
                    </div>
                </div>

                <div>
                    <!-- CARA SCAN -->
                    <aside class="card steps-card">
                        <h2>Cara pakai</h2>
                        <div class="step"><span class="step-number">1</span><div><strong>Scan picklist</strong><p>Klik "Scan picklist", izinkan kamera, arahkan ke barcode di kiri atas (dekat logo).</p></div></div>
                        <div class="step"><span class="step-number">2</span><div><strong>Cek Prod. Order</strong><p>Yang dibaca saat scan hanya nomor Prod. Order, jadi scan cepat. Detail lainnya diambil dari SAP nanti di dashboard.</p></div></div>
                        <div class="step"><span class="step-number">3</span><div><strong>Scan karyawan</strong><p>Klik "Scan barcode karyawan". Scan lagi untuk menambah karyawan lain.</p></div></div>
                        <div class="step"><span class="step-number">4</span><div><strong>Atur target & simpan</strong><p>Isi target plan (opsional), lalu simpan. Di dashboard, tekan "Tampilkan detail" untuk melihat material, SO, dan proses kerja.</p></div></div>
                        <div class="step-note">
                            <strong style="color:#455468">Catatan</strong><br>
                            Kamera hanya jalan di localhost atau HTTPS. Barcode dibaca langsung oleh kamera; web belum menghubungi SAP saat scan.
                        </div>
                    </aside>
                </div>

            </div>

        </section>

        <footer class="footer">
            <span><strong>© 2026 Section Viber</strong> · Portal Internal Section Viber</span>
            <span>Hak cipta dilindungi undang-undang.</span>
        </footer>

    
@endverbatim
@endsection

@push('scripts')
<script src="@v('assets/pages/leader-scan.js')"></script>
<script src="@v('assets/auth.js')"></script>
<script src="@v('assets/mobile-menu.js')"></script>
@endpush
