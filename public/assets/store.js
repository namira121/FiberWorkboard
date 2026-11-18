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
    const C = {
        jobs: [],
        log: [],
        emps: [],
        online: null,
        loading: false,
        loaded: false,
        error: '',
        logTruncated: false
    };

    function emit(type) {
        try {
            w.dispatchEvent(new CustomEvent('fiber:store', { detail: { type } }));
        } catch (e) { /* abaikan */ }
    }

    function notify(key, value) {
        try { w.dispatchEvent(new StorageEvent('storage', { key, newValue: value, storageArea: w.localStorage })); } catch (e) { /* abaikan */ }
        emit('change');
    }

    function statusBox() {
        let box = document.getElementById('fiberStoreStatus');
        const content = document.querySelector('.content');
        if (!box && content) {
            box = document.createElement('div');
            box.id = 'fiberStoreStatus';
            box.setAttribute('role', 'status');
            box.setAttribute('aria-live', 'polite');
            content.prepend(box);
        }
        return box;
    }

    function paintStatus() {
        const box = statusBox();
        if (!box) return;

        box.classList.remove('show', 'loading');
        box.replaceChildren();

        if (C.loading && !C.loaded) {
            box.classList.add('show', 'loading');
            box.textContent = 'Memuat data pekerjaan...';
            return;
        }

        if (C.error) {
            const text = document.createElement('span');
            text.textContent = C.error;
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.textContent = 'Coba lagi';
            retry.addEventListener('click', () => loadAll());
            box.append(text, retry);
            box.classList.add('show');
        }
    }

    async function loadAll() {
        if (C.loading) return;
        C.loading = true;
        C.error = '';
        paintStatus();
        emit('loading');

        try {
            const [a, b, c] = await Promise.all([
                httpAsync('GET', '/api/work-orders'),
                httpAsync('GET', '/api/logs?limit=2000'),
                httpAsync('GET', '/api/employees')
            ]);

            if (isOk(a)) C.jobs = a.json.jobs || [];
            if (isOk(b)) {
                C.log = b.json.log || [];
                C.logTruncated = !!b.json.has_more;
            }
            if (isOk(c)) C.emps = c.json.employees || [];

            C.online = isOk(a) && isOk(b) && isOk(c);
            C.loaded = C.online;
            if (!C.online) {
                const failed = [a, b, c].find(r => !isOk(r));
                C.error = failed ? errText(failed) : 'Sebagian data gagal dimuat.';
            }
        } catch (e) {
            C.online = false;
            C.error = 'Data gagal dimuat. Periksa koneksi lalu coba lagi.';
        } finally {
            C.loading = false;
            paintStatus();
            emit('ready');
        }
    }

    const ready = loadAll();

    /* pembaruan berkala dari server */
    let polling = false;
    let pollTicks = 0;
    async function poll() {
        if (polling || document.hidden || C.loading) return;
        polling = true;
        try {
            const requests = [
                httpAsync('GET', '/api/work-orders'),
                httpAsync('GET', '/api/logs?limit=2000')
            ];
            const withEmployees = pollTicks++ % 4 === 0;
            if (withEmployees) requests.push(httpAsync('GET', '/api/employees'));

            const [a, b, c] = await Promise.all(requests);
            C.online = isOk(a) && isOk(b) && (!withEmployees || isOk(c));
            C.error = C.online ? '' : 'Pembaruan data gagal. Data terakhir tetap ditampilkan.';
            paintStatus();

            if (isOk(a) && JSON.stringify(a.json.jobs) !== JSON.stringify(C.jobs)) { C.jobs = a.json.jobs || []; notify(KEYS.jobs, 'x'); }
            if (isOk(b)) {
                C.logTruncated = !!b.json.has_more;
                if (JSON.stringify(b.json.log) !== JSON.stringify(C.log)) { C.log = b.json.log || []; notify(KEYS.log, 'x'); }
            }
            if (withEmployees && isOk(c) && JSON.stringify(c.json.employees) !== JSON.stringify(C.emps)) { C.emps = c.json.employees || []; notify(KEYS.emps, 'x'); }
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
    async function refreshLog(prod) {
        const r = await httpAsync('GET', '/api/logs?limit=500&prod=' + enc(prod));
        if (isOk(r)) applyLog(prod, r.json.log);
    }

    /* kirim aksi ke server; hasilnya (pekerjaan terbaru) dimasukkan ke cache */
    async function act(method, url, body, oldProd) {
        const r = await httpAsync(method, url, body);
        if (isOk(r) && r.json.job) {
            const job = r.json.job;
            if (oldProd && lc(oldProd) !== lc(job.prod)) {
                C.jobs = C.jobs.filter(j => lc(j.prod) !== lc(oldProd));   /* Prod. Order berganti (edit picklist) */
            }
            applyJob(job);
            await refreshLog(job.prod);
            return { ok: true, job };
        }
        return { ok: false, error: errText(r) };
    }

    /* ---------- karyawan ---------- */
    function employees() { return C.emps.filter(e => e && e.nik && e.name).map(e => ({ nik: e.nik, name: e.name, bagian: e.bagian || '' })); }

    /* Menyamakan daftar karyawan di server dengan `list` (tambah / ubah / hapus). */
    async function saveEmployees(list) {
        const want = (list || []).filter(e => e && e.nik && e.name);
        const have = C.emps;
        const haveBy = new Map(have.map(e => [e.nik, e]));
        const wantBy = new Map(want.map(e => [e.nik, e]));
        const done = async r => {
            if (isOk(r)) return null;
            const m = errText(r);
            const rr = await httpAsync('GET', '/api/employees');
            if (isOk(rr)) C.emps = rr.json.employees || [];
            return { ok: false, error: m };
        };

        for (const e of have) {
            if (wantBy.has(e.nik)) continue;
            const bad = await done(await httpAsync('DELETE', '/api/employees/' + enc(e.nik)));
            if (bad) return bad;
        }
        for (const e of want) {
            const old = haveBy.get(e.nik);
            const body = { nik: e.nik, name: e.name, bagian: e.bagian || null };
            let r = null;
            if (!old) r = await httpAsync('POST', '/api/employees', body);
            else if (old.name !== e.name || (old.bagian || '') !== (e.bagian || '')) r = await httpAsync('PUT', '/api/employees/' + enc(e.nik), body);
            if (r) { const bad = await done(r); if (bad) return bad; }
        }
        const rr = await httpAsync('GET', '/api/employees');
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

    async function addJob(data) {
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
    async function setTarget(prod, value, by, role) {
        if (role !== 'Leader') return { ok: false, error: 'Hanya Leader yang dapat mengatur target plan.' };
        if (value !== null && (isNaN(value) || value < 0 || value > 100)) return { ok: false, error: 'Target harus 0 sampai 100%.' };
        return act('PUT', '/api/work-orders/' + enc(prod) + '/target', { value });
    }
    const belowTarget = (job, value) => job.target != null && value < job.target;

    async function setProgress(prod, value, by, role, reason) {
        return act('PATCH', '/api/work-orders/' + enc(prod) + '/progress', { value, reason: reason || null });
    }

    async function hold(prod, status, issue, reason) {
        return act('POST', '/api/work-orders/' + enc(prod) + '/hold', { status, issue, reason: String(reason || '').trim() });
    }

    /* Hanya Leader. Bisa untuk Pending/Cancel dan untuk Done (repair; progress kembali 0%). */
    async function reactivate(prod, by, role, reason) {
        if (role !== 'Leader') return { ok: false, error: 'Hanya Leader yang dapat mengaktifkan kembali.' };
        return act('POST', '/api/work-orders/' + enc(prod) + '/reactivate', { reason: reason || null });
    }

    /* ---------- edit pekerjaan - hanya Leader ---------- */
    const isManual = job => /^MAN_\d+$/i.test(String(job && job.prod));
    const qtyLabel = q => /^\d+$/.test(String(q)) ? `${Number(q)} pc${Number(q) > 1 ? 's' : ''}` : (q || '1 pc');

    /* Opsi 1: edit tulisannya */
    async function updateJob(prod, fields, by, role) {
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
    async function linkPicklist(prod, pk, by, role) {
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
        ready, refresh: loadAll, isOnline: () => C.online, isLoading: () => C.loading,
        hasLoaded: () => C.loaded, error: () => C.error, isLogTruncated: () => C.logTruncated
    };
})(window);
