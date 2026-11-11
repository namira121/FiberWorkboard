/* ==========================================================
   STORE BERSAMA - Section Viber (data di DATABASE lewat API server)
   Semua halaman (Public & Leader) membaca/menulis data lewat file ini.
   Primary key pekerjaan = Prod. Order.

   Cara kerja:
   - Saat halaman dibuka, data (pekerjaan, riwayat, karyawan) diambil dari server dan disimpan di memori (cache).
   - Fungsi baca (jobs, log, employees, findJob, ...) membaca cache, jadi tetap cepat dan sinkron.
   - Fungsi tulis (addJob, setProgress, hold, ...) memanggil API server, lalu mengembalikan hasilnya
     ({ ok, job } atau { ok:false, error }). Aturan bisnis & validasi dijalankan di server.
   - Tiap beberapa detik cache diperbarui dari server, supaya perubahan dari perangkat lain (mis. TV Public)
     ikut tampil. Halaman diberi tahu lewat event 'storage' (sama seperti sebelumnya).
   ========================================================== */
(function (w) {
    const KEYS = {
        jobs: 'sectionViberJobsV2',
        log: 'sectionViberStatusLogV2',
        emps: 'sectionViberEmployeeList',
        map: 'sectionViberEmployees',
        picks: 'sectionViberPicklists'
    };

    const BAGIAN = ['Rangka', 'Cetak', 'Cutting', 'Pembenahan', 'Setting & Croping', 'Finishing', 'Master', 'Moulding'];
    const MASALAH = ['Man', 'Material', 'Method', 'Machine', 'Environment'];
    const STATUSES = ['Planning', 'On progress', 'Done', 'Pending', 'Cancel'];

    const DEFAULT_EMPLOYEES = [];   /* data karyawan diisi lewat halaman Mastering Karyawan (tersimpan di database) */

    /* ---------- util ---------- */
    const pad = n => String(n).padStart(2, '0');
    const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const fmtDate = iso => (iso || '').split('-').reverse().join('/');
    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const lc = v => String(v == null ? '' : v).toLowerCase();
    const enc = encodeURIComponent;

    /* penyimpanan lokal biasa (preferensi tampilan, dll.). BUKAN untuk data pekerjaan. */
    function read(key, fallback) {
        try {
            const v = JSON.parse(localStorage.getItem(key) || 'null');
            return v == null ? fallback : v;
        } catch (e) { return fallback; }
    }
    function write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    }

    /* ---------- komunikasi dengan server ---------- */
    function xsrf() {
        const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : '';
    }

    /* Sinkron (menunggu jawaban): dipakai untuk aksi singkat yang hasilnya langsung dibutuhkan halaman. */
    function http(method, url, body) {
        try {
            const x = new XMLHttpRequest();
            x.open(method, url, false);
            x.setRequestHeader('Accept', 'application/json');
            if (body !== undefined) x.setRequestHeader('Content-Type', 'application/json');
            const t = xsrf();
            if (t) x.setRequestHeader('X-XSRF-TOKEN', t);
            x.send(body === undefined ? null : JSON.stringify(body));
            let json = null;
            try { json = JSON.parse(x.responseText); } catch (e) { /* bukan JSON */ }
            if (x.status === 401) { w.location.replace('/login'); }
            return { status: x.status, json };
        } catch (e) {
            return { status: 0, json: null };
        }
    }

    /* Asinkron: dipakai untuk aksi yang bisa lama (tanya SAP) dan untuk pembaruan berkala. */
    async function httpAsync(method, url, body) {
        try {
            const r = await fetch(url, {
                method, cache: 'no-store', credentials: 'same-origin',
                headers: Object.assign({ Accept: 'application/json' }, body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                body: body === undefined ? undefined : JSON.stringify(body)
            });
            let json = null;
            try { json = await r.json(); } catch (e) { /* bukan JSON */ }
            if (r.status === 401) { w.location.replace('/login'); }
            return { status: r.status, json };
        } catch (e) {
            return { status: 0, json: null };
        }
    }

    function errText(r) {
        const j = r.json;
        if (j && j.error) return j.error;
        if (j && j.errors) { const f = Object.values(j.errors)[0]; if (f && f[0]) return f[0]; }
        if (r.status === 0) return 'Server tidak terjangkau. Periksa jaringan lalu coba lagi.';
        if (r.status === 419) return 'Sesi kedaluwarsa. Muat ulang halaman lalu coba lagi.';
        if (r.status === 403) return 'Akses ditolak untuk akun ini.';
        if (j && j.message && r.status < 500) return j.message;
        return `Gagal (HTTP ${r.status}). Coba lagi.`;
    }
    const isOk = r => !!(r.json && r.json.ok);

    /* ---------- cache data ---------- */
    const C = { jobs: [], log: [], emps: [], online: false };

    function loadAll() {
        const a = http('GET', '/api/work-orders');
        const b = http('GET', '/api/logs?limit=2000');
        const c = http('GET', '/api/employees');
        C.online = isOk(a) && isOk(b) && isOk(c);
        if (isOk(a)) C.jobs = a.json.jobs || [];
        if (isOk(b)) C.log = b.json.log || [];
        if (isOk(c)) C.emps = c.json.employees || [];
    }
    loadAll();

    function notify(key, value) {
        try { w.dispatchEvent(new StorageEvent('storage', { key, newValue: value, storageArea: w.localStorage })); } catch (e) { /* abaikan */ }
    }

    /* pembaruan berkala dari server */
    let polling = false;
    async function poll() {
        if (polling || document.hidden) return;
        polling = true;
        try {
            const [a, b, c] = await Promise.all([
                httpAsync('GET', '/api/work-orders'),
                httpAsync('GET', '/api/logs?limit=2000'),
                httpAsync('GET', '/api/employees')
            ]);
            C.online = isOk(a) && isOk(b) && isOk(c);
            if (isOk(a) && JSON.stringify(a.json.jobs) !== JSON.stringify(C.jobs)) { C.jobs = a.json.jobs || []; notify(KEYS.jobs, 'x'); }
            if (isOk(b) && JSON.stringify(b.json.log) !== JSON.stringify(C.log)) { C.log = b.json.log || []; notify(KEYS.log, 'x'); }
            if (isOk(c) && JSON.stringify(c.json.employees) !== JSON.stringify(C.emps)) { C.emps = c.json.employees || []; notify(KEYS.emps, 'x'); }
        } finally { polling = false; }
    }
    setInterval(poll, 5000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

    function applyJob(job) {
        const i = C.jobs.findIndex(j => lc(j.prod) === lc(job.prod));
        if (i >= 0) C.jobs[i] = job; else C.jobs.unshift(job);
    }
    function applyLog(prod, rows) {
        C.log = C.log.filter(e => lc(e.prod) !== lc(prod)).concat(rows || []).sort((a, b) => b.ts - a.ts);
    }
    function refreshLog(prod) {
        const r = http('GET', '/api/logs?limit=500&prod=' + enc(prod));
        if (isOk(r)) applyLog(prod, r.json.log);
    }

    /* kirim aksi ke server; hasilnya (pekerjaan terbaru) dimasukkan ke cache */
    function act(method, url, body, oldProd) {
        const r = http(method, url, body);
        if (isOk(r) && r.json.job) {
            const job = r.json.job;
            if (oldProd && lc(oldProd) !== lc(job.prod)) {
                C.jobs = C.jobs.filter(j => lc(j.prod) !== lc(oldProd));   /* Prod. Order berganti (edit picklist) */
            }
            applyJob(job);
            refreshLog(job.prod);
            return { ok: true, job };
        }
        return { ok: false, error: errText(r) };
    }

    /* ---------- karyawan ---------- */
    function employees() { return C.emps.filter(e => e && e.nik && e.name).map(e => ({ nik: e.nik, name: e.name, bagian: e.bagian || '' })); }

    /* Menyamakan daftar karyawan di server dengan `list` (tambah / ubah / hapus). */
    function saveEmployees(list) {
        const want = (list || []).filter(e => e && e.nik && e.name);
        const have = C.emps;
        const haveBy = new Map(have.map(e => [e.nik, e]));
        const wantBy = new Map(want.map(e => [e.nik, e]));
        const done = r => { if (isOk(r)) return null; const m = errText(r); const rr = http('GET', '/api/employees'); if (isOk(rr)) C.emps = rr.json.employees || []; return { ok: false, error: m }; };

        for (const e of have) {
            if (wantBy.has(e.nik)) continue;
            const bad = done(http('DELETE', '/api/employees/' + enc(e.nik)));
            if (bad) return bad;
        }
        for (const e of want) {
            const old = haveBy.get(e.nik);
            const body = { nik: e.nik, name: e.name, bagian: e.bagian || null };
            let r = null;
            if (!old) r = http('POST', '/api/employees', body);
            else if (old.name !== e.name || (old.bagian || '') !== (e.bagian || '')) r = http('PUT', '/api/employees/' + enc(e.nik), body);
            if (r) { const bad = done(r); if (bad) return bad; }
        }
        const rr = http('GET', '/api/employees');
        if (isOk(rr)) C.emps = rr.json.employees || [];
        return { ok: true };
    }

    /* ---------- picklist ----------
       Scan picklist TIDAK memanggil SAP: yang diambil hanya nomor Prod. Order dari barcode.
       Barcode kertas SAP berpola PRODORDER-000002-0402 (mis. 100030007-000002-0402):
       Prod. Order = angka di depan tanda hubung pertama, kode lengkapnya disimpan sebagai No. Picklist.
       Detail (material, SO, deskripsi, proses, qty) diambil nanti lewat tombol "Tampilkan detail" di dashboard,
       supaya scan tetap cepat dan SAP hanya ditanya untuk pekerjaan yang benar-benar dibuka. */
    async function lookupPicklist(code) {
        const c = String(code || '').trim();
        if (!c) return { status: 'notfound' };
        const sap = /^(\d+)-\d{6}-\d{4}$/.exec(c);
        const prod = sap ? sap[1] : c;
        return { status: 'ok', data: { code: c, prod, material: '', so: '', desc: '', qty: '1 pc', work: '', detailLoaded: false } };
    }

    /* Tombol "Tampilkan detail": server bertanya ke SAP untuk SATU Prod. Order lalu menyimpan hasilnya di database. */
    async function loadDetail(prod) {
        const r = await httpAsync('POST', '/api/work-orders/' + enc(prod) + '/detail');
        if (isOk(r) && r.json.job) {
            applyJob(r.json.job);
            const lg = await httpAsync('GET', '/api/logs?limit=500&prod=' + enc(r.json.job.prod));
            if (isOk(lg)) applyLog(r.json.job.prod, lg.json.log);
            return { ok: true, job: r.json.job };
        }
        return { ok: false, error: errText(r) };
    }

    /* ---------- pekerjaan (baca dari cache) ---------- */
    function jobs() { return C.jobs; }
    function log() { return C.log; }
    const findIn = (list, prod) => list.find(j => lc(j.prod) === lc(prod));
    function findJob(prod) { return findIn(C.jobs, prod); }

    function statusFromProgress(v) { return v >= 100 ? 'Done' : v <= 0 ? 'Planning' : 'On progress'; }
    const isHeld = job => job.status === 'Pending' || job.status === 'Cancel';

    /* Tampil di tanggal D bila: dibuat di tanggal itu, ATAU masih On progress dari hari sebelumnya
       (otomatis lanjut ke hari berikutnya), ATAU selesai di tanggal itu. */
    function visibleOn(job, date) {
        if (!date) return true;
        if (job.date === date) return true;
        if (job.status === 'On progress' && job.date < date) return true;
        if (job.status === 'Done' && job.doneDate === date) return true;
        return false;
    }

    /* Tanggal asal kalau pekerjaan ini lanjutan dari hari sebelumnya (dibanding tanggal yang dilihat), kalau bukan: '' */
    function carriedFrom(job, ref) {
        const r = ref || today();
        if (job.date < r && (job.status === 'On progress' || (job.status === 'Done' && job.doneDate === r))) return job.date;
        return '';
    }

    function logFor(prod) { return log().filter(e => String(e.prod) === String(prod)); }
    /* judul satu entri riwayat (dipakai popup riwayat di dashboard & halaman Riwayat) */
    function histTitle(e) {
        if (e.kind === 'edit') return 'Data pekerjaan diedit';
        if (e.kind === 'detail') return 'Detail diambil dari SAP';
        if (e.kind === 'link') return 'Dicocokkan dengan picklist';
        return e.from === e.to ? 'Update progress · ' + e.to : e.from + ' → ' + e.to;
    }

    /* Pekerjaan tanpa picklist: MAN_0001, MAN_0002, ... (server memeriksa lagi kalau ada yang kembar) */
    function nextManualProd() {
        let max = 0;
        jobs().forEach(j => { const m = /^MAN_(\d+)$/i.exec(String(j.prod)); if (m) max = Math.max(max, Number(m[1])); });
        return 'MAN_' + String(max + 1).padStart(4, '0');
    }

    function addJob(data) {
        const prod = String(data.prod || '').trim();
        if (!prod) return { ok: false, error: 'Prod. Order wajib diisi.' };
        const pending = data.detailLoaded === false;
        const body = {
            prod,
            work: String(data.work || '').trim() || (pending ? prod : ''),
            material: data.material || '',
            desc: data.desc || '',
            so: data.so || '',
            qty: data.qty || '1 pc',
            team: (data.team || []).map(p => p.id),
            target: (data.target == null || isNaN(data.target) || data.target < 0 || data.target > 100) ? null : Number(data.target)
        };
        if (pending) body.detailLoaded = false;
        if (data.picklist) body.picklist = data.picklist;
        return act('POST', '/api/work-orders', body);
    }

    /* Target plan (%) hanya boleh diatur Leader. null = belum ada target. */
    function setTarget(prod, value, by, role) {
        if (role !== 'Leader') return { ok: false, error: 'Hanya Leader yang dapat mengatur target plan.' };
        if (value !== null && (isNaN(value) || value < 0 || value > 100)) return { ok: false, error: 'Target harus 0 sampai 100%.' };
        return act('PUT', '/api/work-orders/' + enc(prod) + '/target', { value });
    }
    const belowTarget = (job, value) => job.target != null && value < job.target;

    function setProgress(prod, value, by, role, reason) {
        return act('PATCH', '/api/work-orders/' + enc(prod) + '/progress', { value, reason: reason || null });
    }

    function hold(prod, status, issue, reason) {
        return act('POST', '/api/work-orders/' + enc(prod) + '/hold', { status, issue, reason: String(reason || '').trim() });
    }

    /* Hanya Leader. Bisa untuk Pending/Cancel dan untuk Done (repair; progress kembali 0%). */
    function reactivate(prod, by, role, reason) {
        if (role !== 'Leader') return { ok: false, error: 'Hanya Leader yang dapat mengaktifkan kembali.' };
        return act('POST', '/api/work-orders/' + enc(prod) + '/reactivate', { reason: reason || null });
    }

    /* ---------- edit pekerjaan - hanya Leader ---------- */
    const isManual = job => /^MAN_\d+$/i.test(String(job && job.prod));
    const qtyLabel = q => /^\d+$/.test(String(q)) ? `${Number(q)} pc${Number(q) > 1 ? 's' : ''}` : (q || '1 pc');

    /* Opsi 1: edit tulisannya */
    function updateJob(prod, fields, by, role) {
        if (role !== 'Leader') return { ok: false, error: 'Hanya Leader yang dapat mengedit pekerjaan.' };
        return act('PUT', '/api/work-orders/' + enc(prod), {
            work: String(fields.work || '').trim().replace(/\s+/g, ' '),
            desc: String(fields.desc || '').trim(),
            material: String(fields.material || '').trim(),
            so: String(fields.so || '').trim(),
            qty: qtyLabel(String(fields.qty || '').trim())
        });
    }

    /* Opsi 2: edit picklist (hasil scan). Prod. Order pekerjaan diganti nomor dari picklist yang discan. */
    function linkPicklist(prod, pk, by, role) {
        if (role !== 'Leader') return { ok: false, error: 'Hanya Leader yang dapat mencocokkan picklist.' };
        const np = String(pk && pk.prod || '').trim();
        if (!np) return { ok: false, error: 'Data picklist tidak valid.' };
        const body = { prod: np, picklist: pk.code || null, material: pk.material || '', so: pk.so || '', desc: pk.desc || '', qty: pk.qty ? qtyLabel(pk.qty) : '', work: pk.work || '' };
        if (pk.detailLoaded === false) body.detailLoaded = false;
        const res = act('POST', '/api/work-orders/' + enc(prod) + '/link', body, prod);
        return res.ok ? Object.assign(res, { old: prod }) : res;
    }

    function addMember(prod, person) {
        return act('POST', '/api/work-orders/' + enc(prod) + '/members', { nik: person.id });
    }
    function removeMember(prod, id) {
        return act('DELETE', '/api/work-orders/' + enc(prod) + '/members/' + enc(id));
    }

    w.Store = {
        KEYS, BAGIAN, MASALAH, STATUSES, DEFAULT_EMPLOYEES,
        today, nowTime, fmtDate, esc, read, write,
        employees, saveEmployees,
        jobs, findJob, log, logFor, histTitle, visibleOn, carriedFrom, isHeld, statusFromProgress,
        lookupPicklist, loadDetail, nextManualProd, setTarget, belowTarget,
        addJob, setProgress, hold, reactivate, addMember, removeMember, isManual, updateJob, linkPicklist, qtyLabel,
        refresh: poll, isOnline: () => C.online
    };
})(window);
