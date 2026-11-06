/* ==========================================================
   DATA SIMULASI - Section Viber
   Dipakai oleh reset-simulasi.js (server) dan store.js (cadangan tanpa server), jadi isinya selalu sama.
   Dari daftar picklist dibuat:
     - 4 pekerjaan "kemarin" yang belum selesai (On progress) -> otomatis lanjut ke hari ini
     - sisanya masuk Riwayat dengan status Done / Pending / Cancel (acak tetap, alasan beda-beda, kategori 5M1E)
   ========================================================== */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.SimData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const pad = n => String(n).padStart(2, '0');
    const dayOffset = (today, n) => {
        const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + n);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const EMPLOYEES = [
        { nik: 'WN0002', name: 'Rangga Irawan', bagian: 'Cetak' },
        { nik: 'WN0003', name: 'Dian Satrio Ardi Wibowo', bagian: 'Rangka' },
        { nik: 'WN0007', name: 'Irfan Muhamad', bagian: 'Finishing' },
        { nik: 'WN0008', name: 'Bayu', bagian: 'Moulding' },
        { nik: 'EMP003', name: 'Budi Santoso', bagian: 'Cutting' },
        { nik: 'EMP011', name: 'Maryono', bagian: 'Pembenahan' }
    ];
    const NAME = {}; EMPLOYEES.forEach(e => { NAME[e.nik] = e.name; });

    /* 4 pekerjaan yang belum selesai kemarin: Prod. Order -> progress terakhir */
    const CARRY = { '400156523-0-0100-FLCETAK4': 70, '400156523-0-0200-FLCUTTING': 50, '400156522-1-0101-FLREINF2': 40, '400156523-0-0300-FLTAFIN2': 25 };

    /* karyawan menurut kode proses di ujung Prod. Order (FLSETTING belum punya karyawan bagian Setting -> Maryono) */
    function nikFor(prod) {
        const k = String(prod).split('-').pop().toUpperCase();
        if (k.startsWith('FLCETAK')) return 'WN0002';
        if (k.startsWith('FLCUTTING')) return 'EMP003';
        if (k.startsWith('FLTAFIN')) return 'WN0007';
        if (k.startsWith('FLREINF')) return 'WN0003';
        if (k.startsWith('FLSETTING')) return 'EMP011';
        return 'WN0008';
    }

    /* tiap kategori punya 2 varian alasan supaya tidak ada alasan yang kembar */
    const REASON = {
        Pending: {
            Man: ['Operator yang biasa mengerjakan sedang izin, pekerjaan menunggu pengganti.', 'Tenaga kerja dialihkan membantu line lain yang mengejar deadline, pekerjaan ditunda.'],
            Material: ['Menunggu material dari gudang. Stok belum datang sehingga pekerjaan belum bisa dilanjutkan.', 'Material yang dikirim kurang dari kebutuhan, menunggu kiriman susulan dari supplier.'],
            Method: ['Menunggu konfirmasi metode kerja dari engineering karena gambar kerja sedang direvisi.', 'Instruksi kerja belum jelas, menunggu arahan leader sebelum proses dilanjutkan.'],
            Machine: ['Mesin sedang diperbaiki, menunggu teknisi maintenance selesai.', 'Alat bantu (jig/cetakan) sedang dikalibrasi, belum bisa dipakai.'],
            Environment: ['Area kerja tergenang setelah hujan deras, pekerjaan ditunda sampai area kering.', 'Ventilasi area kerja bermasalah dan udara terlalu pengap, pekerjaan dihentikan sementara.']
        },
        Cancel: {
            Man: ['Terjadi kesalahan proses oleh operator, hasil tidak bisa dipakai sehingga pekerjaan dibatalkan.', 'Pekerjaan dibatalkan karena operator tidak sesuai kompetensi yang dibutuhkan dan tidak ada pengganti.'],
            Material: ['Material yang diterima tidak sesuai spesifikasi dan ditolak QC, pekerjaan dibatalkan.', 'Material rusak saat penyimpanan dan tidak layak pakai, pekerjaan dibatalkan.'],
            Method: ['Perubahan prioritas produksi dari leader, pekerjaan dibatalkan dan dialihkan ke pekerjaan lain.', 'Desain berubah dari customer sehingga proses lama tidak dipakai lagi, pekerjaan dibatalkan.'],
            Machine: ['Mesin rusak berat dan tidak bisa diperbaiki pada shift ini, pekerjaan dibatalkan.', 'Cetakan retak sehingga hasil cacat berulang, pekerjaan dibatalkan.'],
            Environment: ['Suhu dan kelembapan ruang kerja di luar batas sehingga hasil cacat, pekerjaan dibatalkan.', 'Area kerja tidak bisa dipakai karena listrik padam berkepanjangan, pekerjaan dibatalkan.']
        }
    };
    const CATS = ['Man', 'Material', 'Method', 'Machine', 'Environment'];

    /* acak yang hasilnya selalu sama (supaya simulasi bisa diulang persis) */
    function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function shuffle(arr, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

    /* rows: daftar picklist [{prod, material, so, desc, work, ...}]; today: 'YYYY-MM-DD'; opts.skip: Prod. Order yang tidak dimasukkan (tetap bisa discan) */
    function build(rows, today, opts) {
        const skip = new Set((opts && opts.skip) || []);
        const rand = rng(28);
        const list = rows.filter(r => r && r.prod && !skip.has(r.prod));
        const jobs = [], log = [];
        const mkJob = (r, date, team, progress, status) => ({
            prod: r.prod, desc: r.desc, date, material: r.material, work: r.work, so: r.so, qty: '1 pc', team, progress, status
        });
        const entry = (j, date, time, from, to, progress, by, role, extra) => Object.assign({
            ts: Date.parse(`${date}T${time}:00`), date, time, prod: j.prod, material: j.material, work: j.work, so: j.so,
            from, to, issue: '', reason: '', progress, by, role
        }, extra || {});
        const person = nik => ({ id: nik, name: NAME[nik] });

        const rest = list.filter(r => !(r.prod in CARRY));
        const nPend = Math.round(rest.length * 0.25), nCancel = Math.round(rest.length * 0.18);
        const statuses = shuffle([].concat(
            Array(nPend).fill('Pending'), Array(nCancel).fill('Cancel'), Array(Math.max(0, rest.length - nPend - nCancel)).fill('Done')), rand);
        const cats = shuffle(CATS, rand);
        let ci = 0, k = 0;
        const used = {};

        list.forEach((r, i) => {
            const team = [person(nikFor(r.prod))];
            const t1 = `07:${pad(10 + (i % 40))}`;

            if (r.prod in CARRY) {                                   /* belum selesai kemarin */
                const date = dayOffset(today, -1), p = CARRY[r.prod];
                const j = mkJob(r, date, team, p, 'On progress'); jobs.push(j);
                log.push(entry(j, date, t1, '—', 'Planning', 0, 'Leader Section Viber', 'Leader', { reason: 'Pekerjaan ditambahkan.' }));
                log.push(entry(j, date, `09:${pad(10 + (i % 40))}`, 'Planning', 'On progress', p, 'Karyawan', 'Public'));
                return;
            }

            const status = statuses[k++];
            const date = dayOffset(today, -(1 + Math.floor(rand() * 4)));   /* 1-4 hari lalu */
            const mid = 20 + 5 * Math.floor(rand() * 13);                  /* progress saat berhenti, 20-80 */
            const tOn = `08:${pad(10 + (i % 40))}`, tEnd = `${pad(11 + Math.floor(rand() * 5))}:${pad(Math.floor(rand() * 60))}`;
            let j;
            if (status === 'Done') {
                j = mkJob(r, date, team, 100, 'Done'); j.doneDate = date;
                log.push(entry(j, date, t1, '—', 'Planning', 0, 'Leader Section Viber', 'Leader', { reason: 'Pekerjaan ditambahkan.' }));
                log.push(entry(j, date, tOn, 'Planning', 'On progress', mid, 'Karyawan', 'Public'));
                log.push(entry(j, date, tEnd, 'On progress', 'Done', 100, 'Karyawan', 'Public'));
            } else {
                const issue = cats[ci++ % cats.length], pool = REASON[status][issue];
                const reason = pool[(used[status + issue] = (used[status + issue] || 0) + 1) - 1];
                j = mkJob(r, date, team, mid, status);
                Object.assign(j, { issue, reason, holdTime: tEnd, holdBy: 'Karyawan' });
                log.push(entry(j, date, t1, '—', 'Planning', 0, 'Leader Section Viber', 'Leader', { reason: 'Pekerjaan ditambahkan.' }));
                log.push(entry(j, date, tOn, 'Planning', 'On progress', mid, 'Karyawan', 'Public'));
                log.push(entry(j, date, tEnd, 'On progress', status, mid, 'Karyawan', 'Public', { issue, reason }));
            }
            jobs.push(j);
        });
        log.sort((a, b) => b.ts - a.ts);
        return { jobs, log, employees: EMPLOYEES.map(e => Object.assign({}, e)) };
    }

    return { build, EMPLOYEES, CARRY, dayOffset };
});
