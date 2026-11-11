@extends('layouts.app')

@section('title', 'Karyawan')
@section('nav', 'karyawan')

@push('head')
<link rel="stylesheet" href="@v('assets/pages/leader-karyawan.css')">
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js"></script>
<script src="@v('assets/picklist-data.js')"></script>
<script src="@v('assets/sim-data.js')"></script>
<script src="@v('assets/store.js')"></script>
@endpush

@section('modals')
@verbatim
<!-- POPUP HAPUS -->
    <div class="modal-backdrop" id="deleteModal" role="dialog" aria-modal="true" aria-labelledby="deleteTitle">
        <section class="modal">
            <div class="modal-title-row">
                <div class="modal-icon">🗑</div>
                <h2 id="deleteTitle">Hapus karyawan?</h2>
            </div>

            <p id="deleteText">Data karyawan akan dihapus.</p>

            <div class="modal-actions">
                <button class="btn" id="cancelDelete">Batal</button>
                <button class="btn btn-danger" id="confirmDelete">Ya, hapus</button>
            </div>
        </section>
    </div>

    <!-- POPUP UPLOAD EXCEL -->
    <div class="modal-backdrop" id="uploadModal" role="dialog" aria-modal="true" aria-labelledby="uploadTitle">
        <section class="modal wide">

            <div class="modal-title-row">
                <div class="modal-icon upload">⇪</div>
                <div>
                    <h2 id="uploadTitle">Upload karyawan</h2>
                    <span class="modal-sub">Tambahkan banyak karyawan sekaligus dari file Excel.</span>
                </div>
            </div>

            <div class="up-step">
                <span class="step-no">1</span>
                <div>
                    <strong>Download template</strong>
                    <p>Gunakan template ini agar kolom dan formatnya sesuai.</p>
                    <button class="link-btn" id="downloadTemplate" type="button">⇩ Download template Excel (.xlsx)</button>
                </div>
            </div>

            <div class="up-step">
                <span class="step-no">2</span>
                <div>
                    <strong>Isi data karyawan</strong>
                    <p>Mulai dari baris 2. NIK harus unik. Bagian harus sesuai pilihan pada petunjuk di template.</p>
                </div>
            </div>

            <div class="up-step">
                <span class="step-no">3</span>
                <div class="step-wide">
                    <strong>Upload file</strong>

                    <label class="dropzone" id="dropzone" for="uploadInput">
                        <span class="drop-icon">▤</span>
                        <span id="dropText">Klik untuk pilih file atau tarik ke sini</span>
                        <small>Format .xlsx, .xls, atau .csv</small>
                    </label>

                    <input id="uploadInput" type="file" accept=".xlsx,.xls,.csv" hidden>

                    <div class="up-result" id="upResult" hidden></div>
                </div>
            </div>

            <div class="modal-actions">
                <button class="btn" id="cancelUpload" type="button">Batal</button>
                <button class="btn btn-primary" id="importBtn" type="button" disabled>Import karyawan</button>
            </div>

        </section>
    </div>

    <div class="toast" id="toast" role="status"></div>
@endverbatim
@endsection

@section('topbar')
@verbatim
<span class="crumb">Leader / <strong>Karyawan</strong></span>
@endverbatim
@endsection

@section('content')
@verbatim
        <section class="content">

            <div class="heading">
                <h1>Karyawan</h1>
                <p>Kelola data NIK, nama, dan bagian karyawan Section Viber.</p>
            </div>

            <div class="layout">

                <!-- DAFTAR KARYAWAN -->
                <div class="card">

                    <div class="card-head">
                        <h2>Daftar karyawan</h2>
                        <p>Informasi seluruh karyawan yang terdaftar.</p>
                    </div>

                    <div class="toolbar">
                        <label class="field">
                            <span>⌕</span>
                            <input id="searchInput" type="search" placeholder="Cari nama atau NIK karyawan..." aria-label="Cari karyawan">
                        </label>

                        <button class="btn" id="uploadBtn" type="button" title="Upload data karyawan dari Excel">⇪ &nbsp;Upload</button>
                        <button class="btn" id="exportBtn" type="button" title="Export nama, NIK, dan barcode ke Excel (siap print)">⇩ &nbsp;Export barcode</button>
                    </div>

                    <div class="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nama karyawan</th>
                                    <th>Bagian</th>
                                    <th class="center">Barcode</th>
                                    <th class="center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="tableBody"></tbody>
                        </table>
                    </div>

                    <div class="table-footer" id="resultCount">Menampilkan 0 karyawan</div>

                </div>

                <!-- FORM TAMBAH / UBAH -->
                <aside class="card form-card">

                    <div class="form-title-row">
                        <div class="form-icon" id="formIcon">+</div>
                        <div>
                            <h2 id="formTitle">Tambah karyawan</h2>
                            <p id="formSubtitle">Masukkan data karyawan baru.</p>
                        </div>
                    </div>

                    <form id="empForm" novalidate>

                        <div class="form-error" id="formError"></div>

                        <div class="form-field" id="fNik">
                            <label for="nikInput">NIK</label>
                            <input id="nikInput" placeholder="Contoh: WN0010" autocomplete="off">
                        </div>

                        <div class="form-field" id="fName">
                            <label for="nameInput">Nama lengkap</label>
                            <input id="nameInput" placeholder="Masukkan nama lengkap" autocomplete="off">
                        </div>

                        <div class="form-field" id="fBagian">
                            <label for="bagianInput">Bagian</label>
                            <select id="bagianInput">
                                <option value="">Pilih bagian</option>
                                <option>Rangka</option>
                                <option>Cetak</option>
                                <option>Cutting</option>
                                <option>Pembenahan</option>
                                <option>Setting &amp; Croping</option>
                                <option>Finishing</option>
                                <option>Master</option>
                                <option>Moulding</option>
                            </select>
                        </div>

                        <div class="form-hint">Pastikan NIK belum digunakan oleh karyawan lain.</div>

                        <div class="form-buttons">
                            <button class="btn" type="button" id="resetBtn">Bersihkan</button>
                            <button class="btn btn-primary" type="submit" id="submitBtn" disabled>Simpan karyawan</button>
                        </div>

                    </form>

                </aside>

            </div>

        </section>

        <!-- FOOTER -->
        <footer class="footer">
            <span><strong>© 2026 Section Viber</strong> · Portal Internal Section Viber</span>
            <span>Hak cipta dilindungi undang-undang.</span>
        </footer>

    
@endverbatim
@endsection

@push('scripts')
<script src="@v('assets/pages/leader-karyawan.js')"></script>
<script src="@v('assets/auth.js')"></script>
<script src="@v('assets/mobile-menu.js')"></script>
@endpush
