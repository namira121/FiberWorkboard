const $ = id => document.getElementById(id);
const app = $('app');

/* SIDEBAR */
$('toggleBtn').addEventListener('click', () => {
    if (window.innerWidth <= 650) app.classList.toggle('mobile-open');
    else app.classList.toggle('collapsed');
});
$('overlay').addEventListener('click', () => app.classList.remove('mobile-open'));

$('logoutBtn').addEventListener('click', () => {
    if (confirm('Apakah kamu yakin ingin logout?')) {
        Auth.logout();
    }
});

/* UTIL */
function esc(v) {
    return String(v).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2)).toUpperCase();
}

let toastTimer;
function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2400);
}

/* DATA
   Daftar lengkap disimpan di 'sectionViberEmployeeList'.
   Peta NIK -> nama di 'sectionViberEmployees' ikut disinkronkan.
   Dashboard dan Scan picklist membaca data ini. */

/* Data dibaca/ditulis lewat Store (assets/store.js) */
function loadList() {
    return Store.employees().map(e => ({ nik: e.nik, name: e.name, bagian: e.bagian || '' }));
}

/* Disimpan ke database lewat server. Kalau ditolak (mis. NIK sudah ada, atau karyawan masih tercatat di pekerjaan),
   daftar dikembalikan ke data server dan pesan errornya ditampilkan. */
function saveList(okMessage) {
    const r = Store.saveEmployees(employees);
    if (!r.ok) {
        employees = loadList();
        toast(r.error || 'Gagal menyimpan data karyawan.');
        return false;
    }
    if (okMessage) toast(okMessage);
    return true;
}

let employees = loadList();
let editingNik = null;
let deleteNik = null;

/* RENDER TABEL */
function render() {
    const query = $('searchInput').value.trim().toLowerCase();

    const rows = employees.filter(emp =>
        !query || `${emp.nik} ${emp.name}`.toLowerCase().includes(query)
    );

    if (rows.length === 0) {
        $('tableBody').innerHTML = `
            <tr>
                <td colspan="4" class="empty">
                    ${employees.length
                        ? 'Tidak ada karyawan yang sesuai dengan pencarian.'
                        : 'Belum ada karyawan. Tambahkan lewat form di samping.'}
                </td>
            </tr>`;
    } else {
        $('tableBody').innerHTML = rows.map(emp => `
            <tr class="${emp.nik === editingNik ? 'editing' : ''}">
                <td>
                    <div class="person">
                        <div class="avatar">${esc(initials(emp.name))}</div>
                        <div>
                            <span class="person-name">${esc(emp.name)}</span>
                            <span class="sub">NIK: ${esc(emp.nik)}</span>
                        </div>
                    </div>
                </td>
                <td>${emp.bagian ? `<span class="pill">${esc(emp.bagian)}</span>` : '<span class="sub">Belum diisi</span>'}</td>
                <td class="center"><svg class="bc" data-nik="${esc(emp.nik)}" style="max-width:170px;height:46px" role="img" aria-label="Barcode ${esc(emp.nik)}"></svg></td>
                <td>
                    <div class="actions">
                        <button class="btn btn-sm btn-edit" data-edit="${esc(emp.nik)}">✎ Ubah</button>
                        <button class="btn btn-sm btn-del" data-del="${esc(emp.nik)}">Hapus</button>
                    </div>
                </td>
            </tr>`).join('');
    }

    $('resultCount').textContent = `Menampilkan ${rows.length} dari ${employees.length} karyawan`;
    drawBarcodes();
}

/* BARCODE (CODE128 dari NIK) */
function drawBarcodes() {
    if (typeof JsBarcode === 'undefined') return;
    document.querySelectorAll('svg.bc').forEach(el => {
        try { JsBarcode(el, el.dataset.nik, { format: 'CODE128', width: 1.6, height: 40, displayValue: false, margin: 2 }); } catch (e) {}
    });
}

/* EXPORT EXCEL: kartu 3 kolom (nama, barcode, NIK), A4 fit-to-width, siap print */
async function exportBarcodes() {
    if (typeof ExcelJS === 'undefined' || typeof JsBarcode === 'undefined') { toast('Library barcode/Excel belum termuat. Cek koneksi internet lalu muat ulang halaman.'); return; }
    const list = employees.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) { toast('Belum ada karyawan untuk diexport.'); return; }

    const PER_ROW = 3, CARD_W = 30, GAP_W = 2;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Barcode Karyawan', {
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
            margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } }
    });
    const colOf = i => i * 2; /* 0-based: kartu di kolom 0,2,4 ; jarak di 1,3 */
    for (let i = 0; i < PER_ROW; i++) {
        ws.getColumn(colOf(i) + 1).width = CARD_W;
        if (i < PER_ROW - 1) ws.getColumn(colOf(i) + 2).width = GAP_W;
    }
    const border = { style: 'thin', color: { argb: 'FF9AA5B3' } };
    const canvas = document.createElement('canvas');

    list.forEach((emp, idx) => {
        const block = Math.floor(idx / PER_ROW), pos = idx % PER_ROW;
        const r = block * 4 + 1;            /* baris nama; +1 barcode; +2 NIK; +3 jarak */
        const c = colOf(pos) + 1;           /* 1-based */

        ws.getRow(r).height = 20; ws.getRow(r + 1).height = 48; ws.getRow(r + 2).height = 16; ws.getRow(r + 3).height = 8;

        const name = ws.getCell(r, c); name.value = emp.name;
        name.font = { bold: true, size: 11 }; name.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        name.border = { top: border, left: border, right: border };

        const bar = ws.getCell(r + 1, c); bar.border = { left: border, right: border };

        const nik = ws.getCell(r + 2, c); nik.value = emp.nik;
        nik.font = { size: 10, name: 'Consolas' }; nik.alignment = { horizontal: 'center', vertical: 'middle' };
        nik.border = { bottom: border, left: border, right: border };

        JsBarcode(canvas, emp.nik, { format: 'CODE128', width: 3, height: 90, displayValue: false, margin: 8 });
        const img = wb.addImage({ base64: canvas.toDataURL('image/png'), extension: 'png' });
        ws.addImage(img, { tl: { col: c - 1 + 0.06, row: r + 0.06 }, ext: { width: 190, height: 58 }, editAs: 'oneCell' });
    });

    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'barcode-karyawan.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`${list.length} barcode karyawan diexport.`);
}
$('exportBtn').addEventListener('click', () => { exportBarcodes().catch(() => toast('Export gagal. Coba lagi.')); });

$('searchInput').addEventListener('input', render);

/* FORM: MODE TAMBAH / UBAH */
function showError(message, fieldIds = []) {
    $('formError').textContent = message;
    $('formError').classList.toggle('show', Boolean(message));

    ['fNik', 'fName', 'fBagian'].forEach(id => {
        $(id).classList.toggle('invalid', fieldIds.includes(id));
    });
}

/* Tombol simpan aktif hanya jika semua kolom terisi
   dan (saat mode ubah) ada data yang benar-benar berubah */
function updateSubmit() {
    const nik = $('nikInput').value.trim().toUpperCase();
    const name = $('nameInput').value.trim().replace(/\s+/g, ' ');
    const bagian = $('bagianInput').value;

    let ready = Boolean(nik && name && bagian);

    if (ready && editingNik) {
        const emp = employees.find(item => item.nik === editingNik);
        ready = !emp || emp.nik !== nik || emp.name !== name || emp.bagian !== bagian;
    }

    $('submitBtn').disabled = !ready;
}

['nikInput', 'nameInput'].forEach(id => $(id).addEventListener('input', updateSubmit));
$('bagianInput').addEventListener('change', updateSubmit);

function resetForm() {
    editingNik = null;

    $('empForm').reset();
    showError('');
    updateSubmit();

    $('formIcon').textContent = '+';
    $('formTitle').textContent = 'Tambah karyawan';
    $('formSubtitle').textContent = 'Masukkan data karyawan baru.';
    $('submitBtn').textContent = 'Simpan karyawan';
    $('resetBtn').textContent = 'Bersihkan';

    render();
}

function startEdit(nik) {
    const emp = employees.find(item => item.nik === nik);
    if (!emp) return;

    editingNik = nik;
    showError('');

    $('nikInput').value = emp.nik;
    $('nameInput').value = emp.name;
    $('bagianInput').value = emp.bagian || '';

    $('formIcon').textContent = '✎';
    $('formTitle').textContent = 'Ubah karyawan';
    $('formSubtitle').textContent = 'Perbarui informasi karyawan terpilih.';
    $('submitBtn').textContent = 'Simpan perubahan';
    $('resetBtn').textContent = 'Batal';

    updateSubmit();
    render();
    $('nameInput').focus();
}

$('resetBtn').addEventListener('click', resetForm);

/* SIMPAN (CREATE / UPDATE) */
$('empForm').addEventListener('submit', event => {
    event.preventDefault();

    const nik = $('nikInput').value.trim().toUpperCase();
    const name = $('nameInput').value.trim().replace(/\s+/g, ' ');
    const bagian = $('bagianInput').value;

    const missing = [];
    if (!nik) missing.push('fNik');
    if (!name) missing.push('fName');
    if (!bagian) missing.push('fBagian');

    if (missing.length) {
        showError('Lengkapi semua data karyawan terlebih dahulu.', missing);
        return;
    }

    if (!/^[A-Z0-9-]+$/.test(nik)) {
        showError('NIK hanya boleh berisi huruf, angka, dan tanda strip.', ['fNik']);
        return;
    }

    const duplicate = employees.some(emp => emp.nik === nik && emp.nik !== editingNik);

    if (duplicate) {
        showError(`NIK ${nik} sudah digunakan oleh karyawan lain.`, ['fNik']);
        return;
    }

    if (editingNik) {
        const emp = employees.find(item => item.nik === editingNik);

        emp.nik = nik;
        emp.name = name;
        emp.bagian = bagian;

        saveList('Data karyawan diperbarui.');
        resetForm();
    } else {
        employees.push({ nik, name, bagian });

        saveList('Karyawan baru ditambahkan.');
        resetForm();
    }
});

/* AKSI UBAH / HAPUS DI TABEL */
$('tableBody').addEventListener('click', event => {
    const editBtn = event.target.closest('[data-edit]');
    const delBtn = event.target.closest('[data-del]');

    if (editBtn) startEdit(editBtn.dataset.edit);

    if (delBtn) {
        const emp = employees.find(item => item.nik === delBtn.dataset.del);
        if (!emp) return;

        deleteNik = emp.nik;

        $('deleteText').textContent =
            `${emp.name} (NIK ${emp.nik}) akan dihapus dari daftar karyawan. Tindakan ini tidak dapat dibatalkan.`;

        $('deleteModal').classList.add('show');
        $('cancelDelete').focus();
    }
});

/* HAPUS (DELETE) */
function closeDelete() {
    deleteNik = null;
    $('deleteModal').classList.remove('show');
}

$('cancelDelete').addEventListener('click', closeDelete);
$('deleteModal').addEventListener('click', event => {
    if (event.target === $('deleteModal')) closeDelete();
});

$('confirmDelete').addEventListener('click', () => {
    if (!deleteNik) return;

    const wasEditing = editingNik === deleteNik;

    employees = employees.filter(emp => emp.nik !== deleteNik);
    saveList('Karyawan dihapus.');
    closeDelete();

    if (wasEditing) resetForm();
    else render();
});

/* UPLOAD EXCEL
   Kolom: NIK | Nama Lengkap | Bagian */
const BAGIAN = [...$('bagianInput').options].map(o => o.value).filter(Boolean);

let pendingRows = [];

function resetUpload() {
    pendingRows = [];

    $('uploadInput').value = '';
    $('dropText').textContent = 'Klik untuk pilih file atau tarik ke sini';
    $('upResult').hidden = true;
    $('upResult').innerHTML = '';
    $('importBtn').disabled = true;
}

function openUpload() {
    resetUpload();
    $('uploadModal').classList.add('show');
}

function closeUpload() {
    $('uploadModal').classList.remove('show');
}

$('uploadBtn').addEventListener('click', openUpload);
$('cancelUpload').addEventListener('click', closeUpload);
$('uploadModal').addEventListener('click', event => {
    if (event.target === $('uploadModal')) closeUpload();
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closeDelete();
        closeUpload();
    }
});

/* DOWNLOAD TEMPLATE */
$('downloadTemplate').addEventListener('click', () => {
    if (typeof XLSX === 'undefined') {
        toast('Library Excel gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.');
        return;
    }

    const wb = XLSX.utils.book_new();

    const sheet = XLSX.utils.aoa_to_sheet([['NIK', 'Nama Lengkap', 'Bagian']]);
    sheet['!cols'] = [{ wch: 14 }, { wch: 32 }, { wch: 22 }];

    const guide = XLSX.utils.aoa_to_sheet([
        ['Petunjuk pengisian'],
        ['1. Isi data karyawan mulai baris 2 pada sheet "Karyawan".'],
        ['2. Jangan mengubah nama kolom di baris 1.'],
        ['3. NIK harus unik, hanya huruf, angka, atau tanda strip. Contoh: WN0010'],
        [`4. Bagian yang valid: ${BAGIAN.join(', ')}`],
        ['5. Contoh baris: WN0010 | Budi Santoso | Cetak']
    ]);
    guide['!cols'] = [{ wch: 80 }];

    XLSX.utils.book_append_sheet(wb, sheet, 'Karyawan');
    XLSX.utils.book_append_sheet(wb, guide, 'Petunjuk');

    XLSX.writeFile(wb, 'template_karyawan.xlsx');
});

/* BACA FILE */
function showUploadResult(html) {
    $('upResult').innerHTML = html;
    $('upResult').hidden = false;
}

function analyse(rows) {
    const existing = new Set(employees.map(emp => emp.nik));
    const seen = new Set();
    const valid = [];
    const problems = [];

    rows.forEach((row, index) => {
        const cells = [0, 1, 2].map(i => String(row[i] ?? '').trim());

        if (cells.every(cell => !cell)) return;
        if (index === 0 && /^nik$/i.test(cells[0])) return;

        const nik = cells[0].toUpperCase();
        const name = cells[1].replace(/\s+/g, ' ');
        const norm = v => v.toLowerCase().replace(/\s*&\s*/g, ' & ').replace(/\s+/g, ' ').trim();
        const bagian = BAGIAN.find(b => norm(b) === norm(cells[2]));

        let error = '';

        if (!nik) error = 'NIK kosong';
        else if (!/^[A-Z0-9-]+$/.test(nik)) error = `format NIK "${nik}" tidak valid`;
        else if (!name) error = 'nama kosong';
        else if (!bagian) error = `bagian "${cells[2] || '-'}" tidak dikenal`;
        else if (existing.has(nik)) error = `NIK ${nik} sudah terdaftar`;
        else if (seen.has(nik)) error = `NIK ${nik} ganda di dalam file`;

        if (error) {
            problems.push({ rowNo: index + 1, error });
            return;
        }

        seen.add(nik);
        valid.push({ nik, name, bagian });
    });

    pendingRows = valid;
    $('importBtn').disabled = valid.length === 0;

    if (!valid.length && !problems.length) {
        showUploadResult('<span class="chip bad">Tidak ada data karyawan pada file ini.</span>');
        return;
    }

    const shown = problems.slice(0, 8);

    showUploadResult(`
        <div class="up-summary">
            <span class="chip ok">${valid.length} siap diimport</span>
            ${problems.length ? `<span class="chip bad">${problems.length} baris dilewati</span>` : ''}
        </div>

        ${problems.length ? `
            <ul class="up-problems">
                ${shown.map(p => `<li>Baris ${p.rowNo}: ${esc(p.error)}</li>`).join('')}
            </ul>
            ${problems.length > shown.length
                ? `<div class="up-note">dan ${problems.length - shown.length} baris lainnya.</div>`
                : ''}
            <div class="up-note">Baris bermasalah tidak akan diimport.</div>
        ` : ''}
    `);
}

function handleFile(file) {
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        toast('Library Excel gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.');
        return;
    }

    pendingRows = [];
    $('importBtn').disabled = true;
    $('dropText').textContent = file.name;

    const reader = new FileReader();

    reader.onload = event => {
        try {
            const wb = XLSX.read(event.target.result, { type: 'array' });
            const ws = wb.Sheets['Karyawan'] || wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

            analyse(rows);
        } catch (error) {
            showUploadResult('<span class="chip bad">File tidak dapat dibaca. Pastikan formatnya Excel atau CSV.</span>');
        }
    };

    reader.onerror = () => {
        showUploadResult('<span class="chip bad">Gagal membuka file.</span>');
    };

    reader.readAsArrayBuffer(file);
}

$('uploadInput').addEventListener('change', event => handleFile(event.target.files[0]));

/* TARIK DAN LEPAS FILE */
['dragenter', 'dragover'].forEach(name => {
    $('dropzone').addEventListener(name, event => {
        event.preventDefault();
        $('dropzone').classList.add('drag');
    });
});

['dragleave', 'drop'].forEach(name => {
    $('dropzone').addEventListener(name, event => {
        event.preventDefault();
        $('dropzone').classList.remove('drag');
    });
});

$('dropzone').addEventListener('drop', event => handleFile(event.dataTransfer.files[0]));

/* IMPORT */
$('importBtn').addEventListener('click', () => {
    if (!pendingRows.length) return;

    const count = pendingRows.length;

    employees.push(...pendingRows);
    saveList(`${count} karyawan berhasil diimport.`);
    render();
    closeUpload();
});

/* TAMPILKAN DATA PERTAMA KALI */
render();
