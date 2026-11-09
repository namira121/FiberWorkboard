/* ==========================================================
   STORE BERSAMA - Section Viber (tanpa backend)
   Semua halaman (Public & Leader) membaca/menulis data lewat file ini,
   disimpan di localStorage browser. Primary key pekerjaan = Prod. Order.
   Saat pakai backend nanti, cukup ganti isi fungsi di file ini dengan API call.
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

    const DEFAULT_EMPLOYEES = [
        { nik: 'WN0002', name: 'Rangga Irawan', bagian: 'Cetak' },
        { nik: 'WN0003', name: 'Dian Satrio Ardi Wibowo', bagian: 'Rangka' },
        { nik: 'WN0007', name: 'Irfan Muhamad', bagian: 'Finishing' },
        { nik: 'WN0008', name: 'Bayu', bagian: 'Moulding' },
        { nik: 'EMP003', name: 'Budi Santoso', bagian: 'Cutting' },
        { nik: 'EMP011', name: 'Maryono', bagian: 'Pembenahan' }
    ];

    /* ---------- util ---------- */
    const pad = n => String(n).padStart(2, '0');
    const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const fmtDate = iso => (iso || '').split('-').reverse().join('/');
    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function read(key, fallback) {
        try {
            const v = JSON.parse(localStorage.getItem(key) || 'null');
            return v == null ? fallback : v;
        } catch (e) { return fallback; }
    }
    function write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    }

    /* ---------- data awal SIMULASI (cadangan kalau tidak pakai server) ----------
       Isinya dibuat oleh assets/sim-data.js dari picklist-data.js, sama persis dengan reset-simulasi.js. */
    function seed() {
        if (w.SimData && Array.isArray(w.PICKLIST_DB)) {
            const r = w.SimData.build(w.PICKLIST_DB, today());
            return { jobs: r.jobs, log: r.log };
        }
        return { jobs: [], log: [] };
    }

    function ensureSeed() {
        if (read(KEYS.jobs, null) === null) {
            const s = seed();
            write(KEYS.jobs, s.jobs);
            write(KEYS.log, s.log);
        }
    }

    /* ---------- karyawan ---------- */
    function employees() {
        const saved = read(KEYS.emps, null);
        if (Array.isArray(saved)) return saved.filter(e => e && e.nik && e.name);
        return DEFAULT_EMPLOYEES.map(e => ({ ...e }));
    }
    function saveEmployees(list) {
        write(KEYS.emps, list);
        const map = {};
        list.forEach(e => { map[e.nik] = e.name; });
        write(KEYS.map, map);
    }

    /* ---------- data picklist ----------
       Utama: API server (GET /api/picklist/:kode, baca Excel / nanti SAP).
       Cadangan: assets/picklist-data.js, dipakai kalau API tidak ada (mis. dibuka tanpa server). */
    const codeKey = v => String(v == null ? '' : v).trim().replace(/^0+/, '').toLowerCase();
    function picklists() { return Array.isArray(w.PICKLIST_DB) ? w.PICKLIST_DB : []; }
    function findPicklist(code) {
        const q = codeKey(code);
        if (!q) return undefined;
        const list = picklists();
        const hit = list.find(p => codeKey(p.code) === q) || list.find(p => codeKey(p.prod) === q);
        if (hit) return hit;
        /* barcode kertas SAP: PRODORDER-000002-0402 -> cocokkan lewat Prod. Order di depannya */
        const head = codeKey(String(code).split('-')[0]);
        return list.find(p => codeKey(p.prod) === head) || list.find(p => q.startsWith(codeKey(p.prod) + '-'));
    }
    /* Scan picklist TIDAK memanggil SAP: yang diambil hanya nomor Prod. Order dari barcode.
       Detail (material, SO, deskripsi, proses, qty) diambil nanti lewat tombol "Tampilkan detail" di dashboard
       supaya scan tetap cepat dan SAP hanya ditanya untuk pekerjaan yang benar-benar dibuka. */
    async function lookupPicklist(code) {
        const c = String(code || '').trim();
        if (!c) return { status: 'notfound' };
        const known = findPicklist(c);          /* hanya untuk merapikan penulisan kode (angka 0 di depan, dll.) */
        const prod = known ? known.prod : c;
        return { status: 'ok', data: { code: c, prod, material: '', so: '', desc: '', qty: '1 pc', work: '', detailLoaded: false } };
    }

    /* Detail SATU Prod. Order dari SAP (lewat server). Kalau koneksi SAP belum diisi di server (.env),
       dipakai data contoh di picklist-data.js supaya alur tetap bisa dicoba. */
    async function fetchDetail(prod) {
        try {
            const r = await fetch('/api/sap/prod-order/' + encodeURIComponent(prod), { cache: 'no-store', credentials: 'same-origin' });
            const j = await r.json().catch(() => null);
            if (j && j.ok && j.data) return { ok: true, data: j.data };
            if (j && j.code === 'not_configured') {
                const p = findPicklist(prod);
                return p ? { ok: true, data: p, sample: true } : { ok: false, error: 'Prod. Order tidak ada di data contoh. Koneksi SAP belum diisi di server.' };
            }
            return { ok: false, error: (j && j.error) || `SAP tidak menjawab (HTTP ${r.status}).` };
        } catch (e) {
            return { ok: false, error: 'Server tidak terjangkau. Coba lagi.' };
        }
    }

    /* ---------- pekerjaan ---------- */
    function jobs() { ensureSeed(); return read(KEYS.jobs, []); }
    function saveJobs(list) { return write(KEYS.jobs, list); }
    function log() { ensureSeed(); return read(KEYS.log, []); }
    const findIn = (list, prod) => list.find(j => String(j.prod).toLowerCase() === String(prod).toLowerCase());
    function findJob(prod) { return findIn(jobs(), prod); }

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

    function pushLog(job, from, to, by, role, extra) {
        const list = log();
        list.unshift(Object.assign({
            ts: Date.now(), date: today(), time: nowTime(), prod: job.prod, material: job.material, work: job.work, so: job.so,
            from, to, issue: '', reason: '', progress: job.progress, by, role
        }, extra || {}));
        write(KEYS.log, list);
    }

    function logFor(prod) { return log().filter(e => String(e.prod) === String(prod)); }
    /* judul satu entri riwayat (dipakai popup riwayat di dashboard & halaman Riwayat) */
    function histTitle(e) {
        if (e.kind === 'edit') return 'Data pekerjaan diedit';
        if (e.kind === 'detail') return 'Detail diambil dari SAP';
        if (e.kind === 'link') return 'Dicocokkan dengan picklist';
        return e.from === e.to ? 'Update progress · ' + e.to : e.from + ' → ' + e.to;
    }

    /* Pekerjaan tanpa picklist: MAN_0001, MAN_0002, ... */
    function nextManualProd() {
        let max = 0;
        jobs().forEach(j => { const m = /^MAN_(\d+)$/i.exec(String(j.prod)); if (m) max = Math.max(max, Number(m[1])); });
        return 'MAN_' + String(max + 1).padStart(4, '0');
    }
    function normalizeProd(raw) {
        const prod = String(raw || '').trim();
        if (!prod) return { error: 'Prod. Order wajib diisi.' };
        if (/^man/i.test(prod)) {
            const m = /^MAN_(\d{1,4})$/i.exec(prod);
            if (!m) return { error: 'Pekerjaan tanpa picklist memakai format MAN_0001.' };
            return { prod: 'MAN_' + m[1].padStart(4, '0') };
        }
        return { prod };
    }

    function addJob(data, by, role) {
        const list = jobs();
        const n = normalizeProd(data.prod);
        if (n.error) return { ok: false, error: n.error };
        const prod = n.prod;
        if (findIn(list, prod)) return { ok: false, error: `Prod. Order ${prod} sudah ada di daftar pekerjaan.` };

        const job = {
            prod, date: today(), material: data.material || '', desc: data.desc || '', work: data.work, so: data.so || '', qty: data.qty || '1 pc',
            team: (data.team || []).map(p => ({ id: p.id, name: p.name })), progress: 0, status: 'Planning',
            target: (data.target == null || isNaN(data.target) || data.target < 0 || data.target > 100) ? null : Number(data.target)
        };
        /* hasil scan picklist: detail belum diambil dari SAP (tombol "Tampilkan detail" di dashboard) */
        if (data.detailLoaded === false) { job.detailLoaded = false; job.work = job.work || prod; }
        list.unshift(job);   /* pekerjaan baru tampil paling atas di dashboard */
        if (!saveJobs(list)) return { ok: false, error: 'Gagal menyimpan. Penyimpanan browser tidak tersedia.' };
        pushLog(job, '—', 'Planning', by, role, { reason: 'Pekerjaan ditambahkan.' });
        return { ok: true, job };
    }

    function mutate(prod, fn) {
        const list = jobs();
        const job = findIn(list, prod);
        if (!job) return { ok: false, error: 'Pekerjaan tidak ditemukan.' };
        const res = fn(job);
        if (res && res.ok === false) return res;
        saveJobs(list);
        return { ok: true, job };
    }

    /* Target plan (%) hanya boleh diatur Leader. null = belum ada target. */
    function setTarget(prod, value, by, role) {
        if (role !== 'Leader') return { ok: false, error: 'Hanya Leader yang dapat mengatur target plan.' };
        return mutate(prod, job => {
            if (value !== null && (isNaN(value) || value < 0 || value > 100)) return { ok: false, error: 'Target harus 0 sampai 100%.' };
            job.target = value;
        });
    }
    const belowTarget = (job, value) => job.target != null && value < job.target;

    function setProgress(prod, value, by, role, reason) {
        return mutate(prod, job => {
            if (isHeld(job)) return { ok: false, error: 'Pekerjaan sedang ' + job.status + '. Hanya Leader yang bisa mengaktifkan kembali.' };
            const short = belowTarget(job, value);
            const why = String(reason || '').trim();
            if (short && !why) return { ok: false, error: `Progress di bawah target ${job.target}%. Alasan wajib diisi.` };
            const from = job.status;
            job.progress = value;
            job.status = statusFromProgress(value);
            if (job.status === 'Done') job.doneDate = today(); else delete job.doneDate;
            const extra = short ? { reason: `Di bawah target ${job.target}%: ${why}` } : {};
            if (job.status !== from) pushLog(job, from, job.status, by, role, extra);
            else if (short) pushLog(job, from, from, by, role, extra);
        });
    }

    function hold(prod, status, issue, reason, by, role) {
        return mutate(prod, job => {
            if (!['Pending', 'Cancel'].includes(status)) return { ok: false, error: 'Status tidak valid.' };
            if (!MASALAH.includes(issue)) return { ok: false, error: 'Pilih jenis masalah terlebih dahulu.' };
            if (!String(reason || '').trim()) return { ok: false, error: 'Alasan wajib diisi.' };
            if (isHeld(job)) return { ok: false, error: 'Pekerjaan sudah ' + job.status + '.' };
            const from = job.status;
            job.status = status; job.issue = issue; job.reason = reason.trim(); job.holdTime = nowTime(); job.holdBy = by;
            delete job.doneDate;
            pushLog(job, from, status, by, role, { issue, reason: job.reason });
        });
    }

    /* Hanya Leader. Bisa untuk Pending/Cancel dan untuk Done (repair; progress kembali 0%). */
    function reactivate(prod, by, role, reason) {
        if (role !== 'Leader') return { ok: false, error: 'Hanya Leader yang dapat mengaktifkan kembali.' };
        return mutate(prod, job => {
            const wasDone = job.status === 'Done';
            const why = String(reason || '').trim();
            if (!isHeld(job) && !wasDone) return { ok: false, error: 'Hanya pekerjaan Pending, Cancel, atau Done yang bisa diaktifkan kembali.' };
            if (wasDone && !why) return { ok: false, error: 'Alasan diaktifkan kembali wajib diisi.' };
            const from = job.status, prevIssue = job.issue || '', prevReason = job.reason || '';
            if (wasDone) job.progress = 0;
            job.status = statusFromProgress(job.progress);
            if (job.status !== 'On progress') job.date = today();     /* supaya muncul lagi di dashboard hari ini */
            if (job.status === 'Done') job.doneDate = today(); else delete job.doneDate;
            delete job.issue; delete job.reason; delete job.holdTime; delete job.holdBy;
            pushLog(job, from, job.status, by, role, {
                issue: prevIssue,
                reason: wasDone
                    ? 'Diaktifkan kembali untuk repair. Alasan: ' + why
                    : 'Diaktifkan kembali oleh Leader.' + (why ? ' Alasan: ' + why + '.' : '') + ' Alasan sebelumnya: ' + (prevReason || '-')
            });
        });
    }

    /* ---------- edit pekerjaan (semua pekerjaan, manual maupun picklist) - hanya Leader ---------- */
    const isManual = job => /^MAN_\d+$/i.test(String(job && job.prod));
    const qtyLabel = q => /^\d+$/.test(String(q)) ? `${Number(q)} pc${Number(q) > 1 ? 's' : ''}` : (q || '1 pc');

    /* Opsi 1: edit tulisannya */
    function updateJob(prod, fields, by, role) {
        if (role !== 'Leader') return { ok: false, error: 'Hanya Leader yang dapat mengedit pekerjaan.' };
        return mutate(prod, job => {
            const f = {
                work: String(fields.work || '').trim().replace(/\s+/g, ' '),
                desc: String(fields.desc || '').trim(),
                material: String(fields.material || '').trim(),
                so: String(fields.so || '').trim(),
                qty: qtyLabel(String(fields.qty || '').trim())
            };
            if (!f.work) return { ok: false, error: 'Pekerjaan wajib diisi.' };
            const names = { work: 'Pekerjaan', desc: 'Deskripsi', material: 'No. Material', so: 'No. SO', qty: 'Qty' };
            const changes = Object.keys(f).filter(k => String(job[k] || '') !== f[k])
                .map(k => `${names[k]}: "${job[k] || '-'}" → "${f[k] || '-'}"`);
            if (!changes.length) return { ok: false, error: 'Tidak ada perubahan.' };
            Object.assign(job, f);
            pushLog(job, job.status, job.status, by, role, { kind: 'edit', reason: 'Data pekerjaan diedit. ' + changes.join('; ') });
        });
    }

    /* Isi detail pekerjaan hasil scan dengan data dari SAP (tombol "Tampilkan detail"). */
    function fillDetail(prod, d, by, role, sample) {
        return mutate(prod, job => {
            job.material = d.material || job.material || '';
            job.so = d.so || job.so || '';
            job.desc = d.desc || job.desc || '';
            if (d.qty) job.qty = qtyLabel(String(d.qty));
            if (d.work && (!job.work || job.work === job.prod)) job.work = d.work;   /* tulisan pekerjaan yang sudah diedit tidak ditimpa */
            job.detailLoaded = true;
            pushLog(job, job.status, job.status, by, role, { kind: 'detail', reason: sample ? 'Detail diisi dari data contoh (koneksi SAP belum diisi).' : 'Detail diambil dari SAP.' });
        });
    }

    /* Opsi 2: edit picklist (hasil scan). Prod. Order pekerjaan diganti nomor dari picklist yang discan. */
    function linkPicklist(prod, pk, by, role) {
        if (role !== 'Leader') return { ok: false, error: 'Hanya Leader yang dapat mencocokkan picklist.' };
        const list = jobs();
        const job = findIn(list, prod);
        if (!job) return { ok: false, error: 'Pekerjaan tidak ditemukan.' };
        const np = String(pk && pk.prod || '').trim();
        if (!np) return { ok: false, error: 'Data picklist tidak valid.' };
        if (String(np).toLowerCase() === String(job.prod).toLowerCase()) return { ok: false, error: 'Picklist ini sama dengan Prod. Order pekerjaan ini.' };
        const dup = findIn(list, np);
        if (dup) return { ok: false, error: `Prod. Order ${np} sudah ada di dashboard (status ${dup.status}).` };

        const old = job.prod;
        job.prod = np;
        if (pk.detailLoaded === false) job.detailLoaded = false;
        job.material = pk.material || job.material;
        job.so = pk.so || job.so;
        job.desc = pk.desc || job.desc;
        if (pk.qty) job.qty = qtyLabel(pk.qty);
        if (!isManual(job) && pk.work) job.work = pk.work;   /* pekerjaan dari picklist ikut nama proses picklist baru */
        else if (!job.work) job.work = pk.work || '';
        job.picklist = pk.code || '';
        if (!saveJobs(list)) return { ok: false, error: 'Gagal menyimpan.' };

        const lg = log().map(e => String(e.prod) === String(old) ? Object.assign({}, e, { prod: np, material: job.material, so: job.so }) : e);
        write(KEYS.log, lg);
        pushLog(job, job.status, job.status, by, role, { kind: 'link', reason: `Prod. Order diganti dari ${old} menjadi ${np} (edit picklist ${pk.code || '-'}).` });
        return { ok: true, job, old };
    }

    function addMember(prod, person) {
        return mutate(prod, job => {
            if (job.team.some(p => p.id === person.id)) return { ok: false, error: 'Karyawan sudah ada di tim.' };
            job.team.push({ id: person.id, name: person.name });
        });
    }
    function removeMember(prod, id) {
        return mutate(prod, job => { job.team = job.team.filter(p => p.id !== id); });
    }

    w.Store = {
        KEYS, BAGIAN, MASALAH, STATUSES, DEFAULT_EMPLOYEES,
        today, nowTime, fmtDate, esc, read, write,
        employees, saveEmployees,
        jobs, saveJobs, findJob, log, logFor, histTitle, visibleOn, carriedFrom, isHeld, statusFromProgress,
        picklists, findPicklist, lookupPicklist, fetchDetail, fillDetail, nextManualProd, setTarget, belowTarget,
        addJob, setProgress, hold, reactivate, addMember, removeMember, isManual, updateJob, linkPicklist, qtyLabel
    };
})(window);