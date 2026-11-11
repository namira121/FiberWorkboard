const $ = id => document.getElementById(id);
const app = $('app');

/* SIDEBAR */
$('toggleBtn').addEventListener('click', () => {
    if (window.innerWidth <= 650) app.classList.toggle('mobile-open');
    else app.classList.toggle('collapsed');
});
$('overlay').addEventListener('click', () => app.classList.remove('mobile-open'));
$('logoutBtn').addEventListener('click', () => {
    if (confirm('Apakah kamu yakin ingin logout?')) Auth.logout();
});

let toastTimer;
function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2600);
}
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ================= TIM PENGERJA ================= */
let currentPicklist = null;
let assignees = [];

/* Mode edit picklist: dibuka dari tombol edit pekerjaan -> /leader/scan?link=PROD_ORDER */
const linkProd = new URLSearchParams(location.search).get('link');
const linkJob = linkProd ? Store.findJob(linkProd) : null;
const LINK_MODE = !!linkJob;
let suggestions = [];
let hlIndex = -1;

const HELP_DEFAULT = 'Scan barcode karyawan, atau cukup ketik sebagian NIK/nama lalu pilih dari daftar / tekan Enter.';
function setHelp(text, kind) {
    $('employeeHelp').textContent = text;
    $('employeeHelp').className = 'help' + (kind ? ' ' + kind : '');
}

function employeeList() {
    try { return Store.employees().filter(e => e && e.nik && e.name); } catch (e) { return []; }
}
const isAssigned = emp => assignees.some(p => p.nik === emp.nik);

function renderAssignees() {
    $('assignees').innerHTML = assignees.length
        ? assignees.map(p => `
            <div class="assignee">
                <div><strong>${esc(p.name)}</strong><span>${esc(p.nik)}</span></div>
                <button type="button" data-rm="${esc(p.nik)}" aria-label="Hapus ${esc(p.name)}">×</button>
            </div>`).join('')
        : '<div class="help" style="margin:0">Belum ada karyawan. Scan barcode karyawan di bawah.</div>';
}

function findMatches(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const list = employeeList();
    const exact = list.filter(e => e.nik.toLowerCase() === q || e.name.toLowerCase() === q);
    if (exact.length) return exact;
    const words = q.split(/\s+/);
    return list.filter(e => words.every(w => `${e.nik} ${e.name}`.toLowerCase().includes(w)));
}

function hideSuggest() { $('suggestBox').classList.add('hidden'); suggestions = []; hlIndex = -1; }
function showSuggest() {
    const query = $('scanNik').value.trim();
    if (!query) { hideSuggest(); return; }
    suggestions = findMatches(query).filter(e => !isAssigned(e)).slice(0, 6);
    hlIndex = -1;
    $('suggestBox').innerHTML = suggestions.length
        ? suggestions.map((e, i) => `<button type="button" class="suggest-item" data-i="${i}" role="option"><span>${esc(e.name)}</span><small>${esc(e.nik)}</small></button>`).join('')
        : '<div class="suggest-empty">Tidak ada karyawan yang cocok.</div>';
    $('suggestBox').classList.remove('hidden');
}

function addAssignee(emp) {
    if (isAssigned(emp)) { setHelp(`${emp.name} sudah ditambahkan.`, 'bad'); return false; }
    assignees.push({ nik: emp.nik, name: emp.name });
    $('scanNik').value = '';
    hideSuggest();
    renderAssignees();
    setHelp(`✓ ${emp.name} ditambahkan. Scan atau ketik lagi untuk menambah orang lain.`, 'ok');
    return true;
}

function commitInput() {
    const query = $('scanNik').value.trim();
    if (!query) return true;
    const matches = findMatches(query);
    if (!matches.length) { setHelp(`"${query}" tidak ditemukan. Coba NIK atau nama lain, atau tambahkan dulu di halaman Karyawan.`, 'bad'); return false; }
    if (matches.length > 1) { showSuggest(); setHelp(`Ada ${matches.length} karyawan yang cocok. Pilih dari daftar atau ketik lebih lengkap.`, 'bad'); return false; }
    return addAssignee(matches[0]);
}

$('scanNik').addEventListener('input', () => { setHelp('Pilih dari daftar atau tekan Enter untuk menambahkan.', ''); showSuggest(); });
$('scanNik').addEventListener('focus', showSuggest);
$('scanNik').addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!suggestions.length) return;
        event.preventDefault();
        hlIndex = (hlIndex + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length;
        [...$('suggestBox').querySelectorAll('.suggest-item')].forEach((el, i) => el.classList.toggle('hl', i === hlIndex));
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (hlIndex >= 0 && suggestions[hlIndex]) addAssignee(suggestions[hlIndex]); else commitInput();
    } else if (event.key === 'Escape') hideSuggest();
});
$('suggestBox').addEventListener('mousedown', event => {
    const item = event.target.closest('.suggest-item');
    if (!item) return;
    event.preventDefault();
    addAssignee(suggestions[Number(item.dataset.i)]);
    $('scanNik').focus();
});
document.addEventListener('click', event => { if (!event.target.closest('.suggest-wrap')) hideSuggest(); });
$('addAssignee').addEventListener('click', () => { commitInput(); $('scanNik').focus(); });
$('assignees').addEventListener('click', event => {
    const btn = event.target.closest('[data-rm]');
    if (!btn) return;
    assignees = assignees.filter(p => p.nik !== btn.dataset.rm);
    renderAssignees();
    setHelp('Karyawan dihapus dari daftar.', '');
});

/* ================= HASIL SCAN PICKLIST ================= */
const qtyLabel = q => /^\d+$/.test(String(q)) ? `${Number(q)} pc${Number(q) > 1 ? 's' : ''}` : (q || '1 pc');
const dash = v => v || '—';

function showResult(p) {
    currentPicklist = { ...p };
    const pending = p.detailLoaded === false;   /* hasil scan: detail diambil nanti dari dashboard */
    $('rSO').textContent = pending ? 'Belum dimuat' : dash(p.so);
    $('rProd').textContent = p.prod;
    $('rCode').textContent = `Picklist ${p.code}`;
    $('rMaterial').textContent = pending ? 'Belum dimuat' : dash(p.material);
    $('rWork').textContent = pending ? 'Belum dimuat' : dash(p.work);
    $('rQty').textContent = pending ? 'Detail diambil dari SAP lewat tombol "Tampilkan detail" di dashboard.' : `Qty ${qtyLabel(p.qty)}`;

    assignees = [];
    $('scanNik').value = '';
    resetTarget();
    hideSuggest();
    renderAssignees();
    setHelp(HELP_DEFAULT, '');
    if (LINK_MODE) $('assignTask').textContent = 'Simpan picklist';

    $('scanState').textContent = 'Berhasil dibaca';
    $('scanState').className = 'badge done';
    $('noResult').classList.add('hidden');
    $('scanResult').classList.remove('hidden');
    $('assignTask').classList.remove('hidden');
    $('goDashboard').classList.add('hidden');
    $('scanResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearResult() {
    currentPicklist = null;
    assignees = [];
    hideSuggest();
    $('scanNik').value = '';
    $('scanResult').classList.add('hidden');
    $('noResult').classList.remove('hidden');
    $('scanState').textContent = 'Belum scan';
    $('scanState').className = 'badge planning';
}

let lookingUp = false;
async function handlePicklistCode(code) {
    if (lookingUp) return false;
    lookingUp = true;
    try {
        const res = await Store.lookupPicklist(code);
        if (res.status !== 'ok') {
            $('cameraError').textContent = `Nomor picklist "${code}" tidak ada di data picklist.`;
            return false;
        }
        $('cameraError').textContent = '';
        const existing = Store.findJob(res.data.prod);
        if (LINK_MODE) {
            if (existing && existing.prod === linkJob.prod) { $('cameraError').textContent = 'Picklist ini sama dengan Prod. Order pekerjaan ini.'; return false; }
            if (existing) { $('cameraError').textContent = `Prod. Order ${res.data.prod} sudah ada di dashboard (status ${existing.status}).`; return false; }
        } else if (existing) {
            LeaderTools.openExisting(existing, () => {
                $('goDashboard').classList.remove('hidden');
                $('scanState').textContent = 'Diaktifkan kembali';
                $('scanState').className = 'badge done';
            });
            return true;
        }
        showResult(res.data);
        return true;
    } finally { lookingUp = false; }
}

$('manualFind').addEventListener('click', () => {
    const code = $('manualProd').value.trim();
    if (!code) { $('cameraError').textContent = 'Ketik nomor picklist terlebih dahulu.'; return; }
    handlePicklistCode(code).then(ok => { if (ok) { $('manualProd').value = ''; stopCamera(true); } });
});
$('manualProd').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('manualFind').click(); } });

/* FOTO BARCODE PANJANG: kamera bawaan HP (fokus & resolusi penuh) jauh lebih tajam daripada stream video. */
async function decodePhotoFile(file, fast) {
    const bmp = await createImageBitmap(file);
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    const zx = new ZXing.MultiFormatReader(); zx.setHints(hints);
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
    const found = [];
    for (const maxW of (fast ? [1800] : [2400, 1600, 1000])) {                       /* beberapa skala: skala pas = barcode terbaca */
        const k = Math.min(1, maxW / bmp.width);
        for (const rot of (fast ? [0] : [0, 90, 180, 270])) {                     /* kertas bisa difoto miring/tegak */
            const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
            cv.width = rot % 180 ? h : w; cv.height = rot % 180 ? w : h;
            ctx.save(); ctx.translate(cv.width / 2, cv.height / 2); ctx.rotate(rot * Math.PI / 180);
            ctx.drawImage(bmp, -w / 2, -h / 2, w, h); ctx.restore();
            const px = ctx.getImageData(0, 0, cv.width, cv.height).data, lum = new Uint8ClampedArray(cv.width * cv.height);
            for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = (px[j] * 299 + px[j + 1] * 587 + px[j + 2] * 114) / 1000;
            const src = new ZXing.RGBLuminanceSource(lum, cv.width, cv.height);
            for (const B of [ZXing.HybridBinarizer, ZXing.GlobalHistogramBinarizer]) {
                try { const t = String(zx.decode(new ZXing.BinaryBitmap(new B(src))).getText()).trim(); if (t && !found.includes(t)) found.push(t); } catch (e) {}
            }
            if (found.length) return found;
        }
    }
    return found;
}
$('photoBtn').addEventListener('click', () => $('photoInput').click());
$('photoInput').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    $('cameraError').textContent = 'Membaca foto…';
    try {
        const codes = await decodePhotoFile(f);
        /* barcode picklist SAP = yang paling panjang (mis. 100030008-000002-0402); yang pendek (0000468559) diabaikan */
        const code = codes.sort((a, b) => b.length - a.length)[0];
        if (!code) { $('cameraError').textContent = 'Barcode tidak terbaca di foto. Coba dekatkan, pastikan barcode panjang utuh & tajam.'; return; }
        $('cameraError').textContent = '';
        handlePicklistCode(code).then(ok => { if (ok) stopCamera(true); });
    } catch (err) { $('cameraError').textContent = 'Foto gagal dibaca. Coba lagi.'; }
});

/* SIMPAN DI DASHBOARD */
/* TARGET PLAN: bar geser (sama seperti progress). Tidak dicentang = belum diatur. */
function paintTarget() {
    const v = Number($('tgtRange').value), on = $('tgtOn').checked;
    const pos = `calc(${v}% + ${(11 - v * 0.22).toFixed(2)}px)`;
    $('tgtRange').style.setProperty('--p', pos);
    $('tgtBubble').style.left = pos;
    $('tgtBubble').textContent = on ? `${v}%` : `${v}% (belum aktif)`;
    $('tgtWrap').classList.toggle('off', !on);
    $('tgtOnText').textContent = on ? 'Target diatur. Geser bar untuk mengubah.' : 'Belum diatur (geser bar untuk mengatur)';
}
function resetTarget() { $('tgtOn').checked = false; $('tgtRange').value = 100; paintTarget(); }
$('tgtOn').addEventListener('change', paintTarget);
$('tgtRange').addEventListener('input', () => { $('tgtOn').checked = true; paintTarget(); });
paintTarget();

$('assignTask').addEventListener('click', () => {
    if (!currentPicklist) { toast('Scan picklist terlebih dahulu.'); return; }

    /* mode cocokkan: ganti MAN_... dengan Prod. Order dari picklist */
    if (LINK_MODE) {
        const r = Store.linkPicklist(linkJob.prod, currentPicklist, 'Leader Section Viber', 'Leader');
        if (!r.ok) { toast(r.error); return; }
        stopCamera(true);
        currentPicklist = null;
        $('scanState').textContent = 'Picklist diperbarui';
        $('assignTask').classList.add('hidden');
        $('goDashboard').classList.remove('hidden');
        toast(`${r.old} sekarang menjadi Prod. Order ${r.job.prod}.`);
        return;
    }

    if (!commitInput()) return;
    if (!assignees.length) {
        setHelp('Tambahkan minimal 1 karyawan (scan barcode karyawan atau ketik NIK).', 'bad');
        return;
    }
    const target = $('tgtOn').checked ? Number($('tgtRange').value) : null;

    const team = assignees.map(p => ({ id: p.nik, name: p.name }));
    const res = Store.addJob({
        prod: currentPicklist.prod,
        material: currentPicklist.material,
        desc: currentPicklist.desc,
        work: currentPicklist.work,
        so: currentPicklist.so,
        qty: qtyLabel(currentPicklist.qty),
        detailLoaded: currentPicklist.detailLoaded,
        picklist: currentPicklist.code,
        team, target
    }, 'Leader Section Viber', 'Leader');
    if (!res.ok) { toast(res.error); return; }

    stopCamera(true);
    currentPicklist = null;
    $('scanState').textContent = 'Sudah disimpan';
    $('assignTask').classList.add('hidden');
    $('goDashboard').classList.remove('hidden');
    toast(team.length > 1 ? `Pekerjaan disimpan dan ditugaskan ke ${team.length} orang.` : `Pekerjaan disimpan dan ditugaskan ke ${team[0].name}.`);
});

$('rescan').addEventListener('click', () => { clearResult(); startCamera('picklist'); });

if (LINK_MODE) {
    $('linkBanner').classList.remove('hidden');
    $('linkProd').textContent = linkJob.prod;
    $('linkInfo').textContent = `${linkJob.work} · scan barcode picklist.`;
    document.querySelector('.assign-box').classList.add('hidden');
    $('targetBox').classList.add('hidden');
    $('assignees').closest('.read-item').classList.add('hidden');
} else if (linkProd) {
    $('linkBanner').classList.remove('hidden');
    $('linkProd').textContent = linkProd;
    $('linkInfo').textContent = 'Pekerjaan tidak ditemukan. Kembali ke dashboard lalu klik tombol edit lagi.';
}

/* ================= KAMERA + PEMBACA BARCODE ================= */
let mode = null;          /* 'picklist' | 'employee' */
let engine = null;
let runId = 0;
let lastCode = '', lastAt = 0;

const VIDEO = { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } };   /* resolusi tinggi: barcode padat butuh banyak piksel */
const SCAN_FORMATS = ['code_128', 'code_39'];   /* format lain dimatikan supaya tidak salah baca */

/* ---- pengaturan sensitivitas (ubah di sini) ---- */
const CROP_W = 0.7, CROP_H = 0.4;   /* hanya baca area tengah kamera (70% lebar x 40% tinggi) */
const NEED_READS = 2;               /* kode yang sama harus terbaca berturut-turut sekian kali */
const STREAK_GAP = 700;             /* ms, jeda maksimal antar pembacaan agar dianggap berturut-turut */
const COOLDOWN = 600;               /* ms, jeda minimal antar scan yang diterima */
let streakCode = '', streakN = 0, streakAt = 0, acceptedAt = 0;
function resetStreak() { streakCode = ''; streakN = 0; streakAt = 0; acceptedAt = 0; }
function confirmRead(code) {
    const now = Date.now();
    if (now - acceptedAt < COOLDOWN) return false;
    if (code === streakCode && now - streakAt <= STREAK_GAP) streakN++; else { streakCode = code; streakN = 1; }
    streakAt = now;
    if (streakN < (mode === 'picklist' ? 1 : NEED_READS)) return false;   /* Code 128 punya checksum: 1x baca sudah aman */
    streakCode = ''; streakN = 0; acceptedAt = now;
    return true;
}

/* ---- suara & getar ---- */
let audioCtx = null;
function primeAudio() {   /* dipanggil dari klik tombol, supaya browser mengizinkan suara */
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
}
function beep(ok) {
    try {
        primeAudio();
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const tones = ok ? [[1175, 0, 0.09], [1568, 0.1, 0.14]] : [[220, 0, 0.28]];
        tones.forEach(([f, d, l]) => {
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'square'; o.frequency.value = f;
            g.gain.setValueAtTime(0.0001, t + d);
            g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t + d + l);
            o.connect(g); g.connect(audioCtx.destination);
            o.start(t + d); o.stop(t + d + l + 0.02);
        });
        if (navigator.vibrate) navigator.vibrate(ok ? [60] : [120, 60, 120]);
    } catch (e) {}
}

/* Area yang dibaca (koordinat piksel video), dicoba berurutan sampai ada yang terbaca:
   1) isi kotak biru, 2) irisan horizontal tengah kotak biru (barcode kecil di antara teks/garis jadi lebih mudah dibaca),
   3) area tengah yang lebih luas. */
function scanRegions(video) {
    const vw = video.videoWidth, vh = video.videoHeight;
    const box = $('cameraBox').getBoundingClientRect(), fr = document.querySelector('.scan-frame').getBoundingClientRect();
    const k = Math.max(box.width / vw, box.height / vh);                 /* object-fit: cover */
    const ox = (vw * k - box.width) / 2, oy = (vh * k - box.height) / 2;
    let t = { x: (fr.left - box.left + ox) / k, y: (fr.top - box.top + oy) / k, w: fr.width / k, h: fr.height / k };
    t = { x: t.x - t.w * 0.05, y: t.y - t.h * 0.2, w: t.w * 1.1, h: t.h * 1.4 };
    /* Barcode SAP panjang (21 karakter), jadi irisan sempit di tengah bisa memotongnya.
       Urutan: seluruh kotak biru (+ pencari lokasi barcode: dipotong pas di barcode, garis tabel di sisi dibuang),
       irisan tengah selebar kotak, lalu irisan 70%, lalu area tengah kamera yang lebih luas. */
    const list = [];
    list.push(Object.assign({ loc: true }, t));
    list.push({ x: t.x, y: t.y + t.h * 0.25, w: t.w, h: t.h * 0.5 });
    const n = { x: t.x + t.w * 0.15, y: t.y, w: t.w * 0.7, h: t.h };
    list.push(n);
    list.push({ x: n.x, y: n.y + n.h * 0.25, w: n.w, h: n.h * 0.5 });
    list.push({ loc: true, x: vw * (1 - CROP_W) / 2, y: vh * (1 - CROP_H) / 2, w: vw * CROP_W, h: vh * CROP_H });
    return list.map(r => {
        const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y));
        return { loc: !!r.loc, x, y, w: Math.max(40, Math.min(vw - x, Math.round(r.w))), h: Math.max(20, Math.min(vh - y, Math.round(r.h))) };
    });
}

/* ---- pencari lokasi barcode ----
/* Cari kotak barcode (batang vertikal rapat) di dalam sebuah area. Mengembalikan {x,y,w,h} atau null. */
function locateBarcode(lum, w, h) {
    if (w < 80 || h < 20) return null;
    const STEP = h > 240 ? 2 : 1;
    const S = new Float32Array(w);
    for (let y = 1; y < h - 1; y += STEP) {
        const row = y * w;
        for (let x = 1; x < w - 1; x++) {
            const gx = Math.abs(lum[row + x + 1] - lum[row + x - 1]);
            const gy = Math.abs(lum[row + w + x] - lum[row - w + x]);
            if (gx > gy) S[x] += gx - gy;
        }
    }
    const r = Math.max(3, Math.round(w * 0.008));
    const sm = new Float32Array(w);
    let acc = 0;
    for (let x = 0; x < w; x++) {
        acc += S[x];
        if (x >= 2 * r + 1) acc -= S[x - 2 * r - 1];
        sm[x] = acc / Math.min(x + 1, 2 * r + 1);
    }
    let mx = 0;
    for (let x = 0; x < w; x++) if (sm[x] > mx) mx = sm[x];
    if (mx < 1) return null;
    const thr = mx * 0.3, gapTol = Math.max(8, Math.round(w * 0.025));
    let best = null, start = -1, last = -1, mass = 0;
    const close = () => {
        if (start >= 0 && (!best || mass > best.mass)) best = { x0: start, x1: last, mass };
    };
    for (let x = 0; x < w; x++) {
        if (sm[x] > thr) {
            if (start < 0) { start = x; mass = 0; }
            else if (x - last > gapTol) { close(); start = x; mass = 0; }
            last = x; mass += sm[x];
        }
    }
    close();
    if (!best || best.x1 - best.x0 < Math.max(60, w * 0.15)) return null;

    const bw = best.x1 - best.x0, mg = Math.max(14, Math.round(bw * 0.045));
    const x0 = Math.max(0, best.x0 - mg), x1 = Math.min(w, best.x1 + mg);

    const R = new Float32Array(h);
    for (let y = 0; y < h; y++) {
        const row = y * w; let s = 0;
        for (let x = Math.max(1, best.x0); x < Math.min(w - 1, best.x1); x += 2) s += Math.abs(lum[row + x + 1] - lum[row + x - 1]);
        R[y] = s;
    }
    let rmax = 0;
    for (let y = 0; y < h; y++) if (R[y] > rmax) rmax = R[y];
    let ya = 0, yb = h - 1;
    while (ya < h - 1 && R[ya] < rmax * 0.35) ya++;
    while (yb > ya && R[yb] < rmax * 0.35) yb--;
    const pad = Math.round((yb - ya) * 0.1) + 2;
    const y0 = Math.max(0, ya - pad), y1 = Math.min(h, yb + pad + 1);
    if (y1 - y0 < 12) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/* Chrome/Android: BarcodeDetector bawaan (kalau mendukung Code 128). Selain itu: ZXing. */
async function openEngine(onCode) {
    const video = $('cameraVideo');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no-camera');

    let native = null, zx = null;
    if ('BarcodeDetector' in window) {
        try { if ((await BarcodeDetector.getSupportedFormats()).includes('code_128')) native = new BarcodeDetector({ formats: SCAN_FORMATS }); } catch (e) {}
    }
    if (!native) {
        if (!window.ZXing) throw new Error('no-zxing');
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39]);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        zx = new ZXing.MultiFormatReader();
        zx.setHints(hints);
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO, audio: false });
    const track = stream.getVideoTracks()[0];
    try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}
    video.srcObject = stream;
    try { await video.play(); } catch (e) {}
    setupZoom(track);

    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    let alive = true, infoSet = false, lastPhotoAt = 0;
    const ic = ('ImageCapture' in window) ? new ImageCapture(track) : null;   /* foto resolusi penuh, jauh lebih tajam dari frame video */

    function zxDecode(lum, w, h) {
        const src = new ZXing.RGBLuminanceSource(lum, w, h);
        for (const B of [ZXing.HybridBinarizer, ZXing.GlobalHistogramBinarizer]) {
            try { return String(zx.decode(new ZXing.BinaryBitmap(new B(src))).getText()).trim(); } catch (e) {}
        }
        return '';
    }
    function lumOf(r) {
        const px = ctx.getImageData(0, 0, r.w, r.h).data, lum = new Uint8ClampedArray(r.w * r.h);
        for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = (px[j] * 299 + px[j + 1] * 587 + px[j + 2] * 114) / 1000;
        return lum;
    }
    async function decodeRegion(r) {
        cv.width = r.w; cv.height = r.h;
        ctx.drawImage(video, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        if (native) {
            const found = await native.detect(cv);
            if (found.length) return String(found[0].rawValue).trim();
            if (!r.loc) return '';
            /* gagal: cari lokasi barcode lalu baca potongan yang pas saja */
            const b = locateBarcode(lumOf(r), r.w, r.h);
            if (!b) return '';
            cv.width = b.w; cv.height = b.h;
            ctx.drawImage(video, r.x + b.x, r.y + b.y, b.w, b.h, 0, 0, b.w, b.h);
            const again = await native.detect(cv);
            return again.length ? String(again[0].rawValue).trim() : '';
        }
        const lum = lumOf(r);
        const code = zxDecode(lum, r.w, r.h);
        if (code || !r.loc) return code;
        const b = locateBarcode(lum, r.w, r.h);
        if (!b) return '';
        const part = new Uint8ClampedArray(b.w * b.h);
        for (let y = 0; y < b.h; y++) part.set(lum.subarray((b.y + y) * r.w + b.x, (b.y + y) * r.w + b.x + b.w), y * b.w);
        return zxDecode(part, b.w, b.h);
    }

    (async () => {
        while (alive) {
            try {
                if (video.readyState >= 2 && video.videoWidth) {
                    if (!infoSet) {
                        infoSet = true;
                        $('engineInfo').textContent = `Pembaca: ${native ? 'bawaan Chrome' : 'ZXing'} · kamera ${video.videoWidth}×${video.videoHeight}`;
                    }
                    for (const r of scanRegions(video)) {
                        if (!alive) break;
                        let code = '';
                        try { code = await decodeRegion(r); } catch (e) {}
                        if (code) { onCode(code); break; }
                    }
                    /* frame video gagal membaca: ambil foto resolusi penuh tiap ~1.5 dtk lalu decode dengan ZXing */
                    if (alive && ic && Date.now() - lastPhotoAt > 500 && mode === 'picklist') {
                        lastPhotoAt = Date.now();
                        try {
                            const codes = (await decodePhotoFile(await ic.takePhoto(), true)).filter(c => c.length >= MIN_PICKLIST_LEN);
                            if (alive && codes.length) onCode(codes.sort((a, b) => b.length - a.length)[0], true);
                        } catch (e) {}
                        lastPhotoAt = Date.now();
                    }
                }
            } catch (e) {}
            await new Promise(r => setTimeout(r, 20));
        }
    })();
    return { stop() { alive = false; stream.getTracks().forEach(t => t.stop()); video.srcObject = null; $('zoomBtn').classList.add('hidden'); $('engineInfo').textContent = ''; } };
}

/* tombol zoom (hanya muncul kalau kamera HP mendukung): 1x -> 2x -> 3x */
function setupZoom(track) {
    const btn = $('zoomBtn');
    let caps = {};
    try { caps = track.getCapabilities ? track.getCapabilities() : {}; } catch (e) {}
    if (!caps.zoom) { btn.classList.add('hidden'); return; }
    const levels = [1, 2, 3].filter(z => z >= caps.zoom.min && z <= caps.zoom.max);
    if (levels.length < 2) { btn.classList.add('hidden'); return; }
    let i = 0;
    btn.textContent = `Zoom ${levels[0]}×`;
    btn.classList.remove('hidden');
    btn.onclick = async () => {
        i = (i + 1) % levels.length;
        try { await track.applyConstraints({ advanced: [{ zoom: levels[i] }] }); } catch (e) {}
        btn.textContent = `Zoom ${levels[i]}×`;
    };
}

function setHint(text) { $('cameraHint').textContent = text; }
function flash() {
    $('cameraBox').classList.add('found');
    setTimeout(() => $('cameraBox').classList.remove('found'), 700);
}

const MIN_PICKLIST_LEN = 15;   /* barcode picklist SAP panjang (21 karakter); barcode pendek di kertas diabaikan */
function onCode(code, trusted) {
    if (!mode || !code) return;
    if (mode === 'picklist' && code.length < MIN_PICKLIST_LEN) { setHint('Itu barcode pendek. Arahkan ke barcode yang panjang.'); return; }
    if (!trusted && !confirmRead(code)) return;
    const now = Date.now();
    if (code === lastCode && now - lastAt < 2500) return;   /* abaikan pembacaan ganda */
    lastCode = code; lastAt = now;

    if (mode === 'picklist') {
        const id = runId;
        handlePicklistCode(code).then(ok => {
            if (id !== runId) return;
            if (!ok) { beep(false); return; }
            beep(true);
            flash();
            setHint('✓ Barcode terbaca');
            setTimeout(() => { if (id === runId) stopCamera(false); }, 500);
        });
        return;
    }

    /* mode karyawan: barcode = NIK */
    const emp = employeeList().find(e => e.nik.toLowerCase() === code.toLowerCase());
    if (!emp) { beep(false); toast(`NIK "${code}" belum terdaftar di halaman Karyawan.`); return; }
    if (isAssigned(emp)) { beep(false); toast(`${emp.name} sudah ada di tim.`); return; }
    addAssignee(emp);
    beep(true);
    flash();
    toast(`✓ ${emp.name} ditambahkan. Scan lagi untuk menambah orang lain.`);
}

function cameraErrorText(e) {
    const tail = ' Gunakan input manual di bawah.';
    if (e && e.message === 'no-zxing') return 'Pembaca barcode gagal dimuat. Muat ulang halaman.' + tail;
    if (!window.isSecureContext || (e && e.message === 'no-camera')) return 'Kamera hanya bisa dipakai lewat HTTPS atau localhost. Buka web dari alamat https://… yang tampil di terminal server.' + tail;
    switch (e && e.name) {
        case 'NotAllowedError': case 'SecurityError': return 'Izin kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, lalu coba lagi.' + tail;
        case 'NotFoundError': case 'OverconstrainedError': return 'Kamera tidak ditemukan di perangkat ini.' + tail;
        case 'NotReadableError': return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.' + tail;
        default: return 'Kamera tidak bisa dibuka (' + ((e && (e.name || e.message)) || 'error') + ').' + tail;
    }
}

async function startCamera(m) {
    primeAudio();
    resetStreak();
    if (engine) stopCamera(false);
    const id = ++runId;
    mode = m;
    lastCode = ''; lastAt = 0;

    $('cameraError').textContent = '';
    $('cameraBox').classList.remove('found');
    $('cameraBox').classList.add('scanning');
    $('cameraIndicator').textContent = m === 'picklist' ? '● Scan picklist…' : '● Scan karyawan…';
    $('cameraIndicator').classList.add('on');
    $('startCamera').classList.add('hidden');
    $('stopCamera').classList.remove('hidden');
    $('stopCamera').textContent = m === 'employee' ? 'Selesai scan karyawan' : 'Matikan kamera';
    $('placeholderText').textContent = 'Menyalakan kamera…';
    setHint(m === 'picklist' ? 'Barcode mendatar & memenuhi kotak, jarak 15–25 cm, hindari bayangan' : 'Arahkan ke barcode karyawan (bisa scan beberapa kali)');
    $('cameraBox').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
        const eng = await openEngine(onCode);
        if (id !== runId) { eng.stop(); return; }
        engine = eng;
        $('cameraVideo').classList.remove('hidden');
        $('cameraPlaceholder').classList.add('hidden');
    } catch (e) {
        if (id !== runId) return;
        stopCamera(false);
        $('cameraError').textContent = cameraErrorText(e);
    }
}

function stopCamera(manual) {
    runId++;
    mode = null;
    if (engine) { engine.stop(); engine = null; }
    $('cameraVideo').classList.add('hidden');
    $('cameraPlaceholder').classList.remove('hidden');
    $('placeholderText').textContent = 'Aktifkan kamera untuk scan barcode picklist';
    $('cameraBox').classList.remove('scanning');
    $('cameraIndicator').textContent = '● Kamera mati';
    $('cameraIndicator').classList.remove('on');
    $('startCamera').classList.remove('hidden');
    $('stopCamera').classList.add('hidden');
    setHint('Posisikan barcode di dalam kotak');
    if (manual) { $('cameraBox').classList.remove('found'); }
}

$('startCamera').addEventListener('click', () => { clearResult(); startCamera('picklist'); });
$('stopCamera').addEventListener('click', () => stopCamera(true));
$('scanEmp').addEventListener('click', () => startCamera('employee'));
window.addEventListener('pagehide', () => stopCamera(true));

renderAssignees();
