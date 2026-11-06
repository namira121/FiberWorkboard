/* ==========================================================
   ALAT LEADER (self-contained, membuat popup-nya sendiri):
   - LeaderTools.openReactivate(job, cb)  : aktifkan kembali job Done / Pending / Cancel (dengan alasan)
   - LeaderTools.openEdit(job, cb)        : edit job manual (MAN_...): cocokkan picklist atau edit tulisan
   - LeaderTools.exportPlan(rows, date)   : export nama + proses + target ke Excel
   Butuh Store (store.js). Dipakai di Dashboard Leader, Riwayat Leader, dan Scan picklist.
   ========================================================== */
(function () {
    const S = window.Store, esc = S.esc;
    const ACTOR = 'Leader Section Viber', ROLE = 'Leader';

    /* ---------- CSS ---------- */
    const css = document.createElement('style');
    css.textContent = `
    .lt-back{position:fixed;inset:0;background:rgba(20,34,50,.45);display:none;align-items:center;justify-content:center;padding:20px;z-index:80}
    .lt-back.show{display:flex}
    .lt-box{width:min(100%,500px);max-height:92vh;overflow:auto;background:#fff;border:1px solid #e6edf4;border-radius:16px;box-shadow:0 22px 70px #10233b30;padding:24px;font-family:inherit;color:#182433}
    .lt-box h3{margin:0 0 4px;font-size:17px}
    .lt-sub{color:#718096;font-size:12px;line-height:1.6;margin-bottom:16px}
    .lt-info{background:#f4f7fb;border-radius:10px;padding:11px 13px;font-size:12px;line-height:1.6;margin-bottom:14px;color:#455468}
    .lt-warn{background:#fff7e2;border:1px solid #ffedbf;color:#9b6713}
    .lt-label{display:block;font-size:12px;font-weight:700;color:#4a5b70;margin:12px 0 6px}
    .lt-label small{font-weight:500;color:#8290a3}
    .lt-in{width:100%;border:1px solid #d9e3ee;border-radius:9px;padding:10px 12px;font:inherit;font-size:13px;background:#fff;color:#182433}
    .lt-in:focus{outline:2px solid #1479e833;border-color:#1479e8}
    textarea.lt-in{min-height:88px;resize:vertical}
    .lt-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .lt-err{color:#c83e39;font-size:12px;min-height:16px;margin-top:10px}
    .lt-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:16px;flex-wrap:wrap}
    .lt-btn{border:1px solid #d9e3ee;background:#fff;color:#263747;border-radius:9px;padding:11px 16px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
    .lt-btn.main{background:#1479e8;border-color:#1479e8;color:#fff}
    .lt-btn.main:hover{background:#0f66c4}
    .lt-opt{display:flex;gap:13px;align-items:flex-start;width:100%;text-align:left;border:1px solid #d9e3ee;background:#fff;border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;font:inherit;color:inherit}
    .lt-opt:hover{border-color:#1479e8;background:#f5f9ff}
    .lt-opt b{display:block;font-size:13px;margin:0}
    .lt-opt span{font-size:12px;color:#718096;line-height:1.5}
    .lt-ico{font-size:20px;line-height:1.2}
    .lt-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#182433;color:#fff;padding:11px 16px;border-radius:10px;font-size:12px;z-index:90;opacity:0;pointer-events:none;transition:opacity .2s;max-width:90vw}
    .lt-toast.show{opacity:1}
    `;
    document.head.appendChild(css);

    /* ---------- helper ---------- */
    let toastEl, toastT;
    function toast(m) {
        if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'lt-toast'; document.body.appendChild(toastEl); }
        toastEl.textContent = m; toastEl.classList.add('show');
        clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600);
    }
    function modal(html) {
        const back = document.createElement('div');
        back.className = 'lt-back';
        back.innerHTML = `<div class="lt-box" role="dialog" aria-modal="true">${html}</div>`;
        document.body.appendChild(back);
        const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = e => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        back.addEventListener('mousedown', e => { if (e.target === back) close(); });
        requestAnimationFrame(() => back.classList.add('show'));
        return { back, box: back.firstElementChild, close };
    }
    const q = (root, sel) => root.querySelector(sel);

    /* ---------- AKTIFKAN KEMBALI ---------- */
    function openReactivate(job, cb) {
        const done = job.status === 'Done';
        const held = S.isHeld(job);
        if (!done && !held) { toast('Hanya pekerjaan Done, Pending, atau Cancel yang bisa diaktifkan kembali.'); return; }
        const m = modal(`
            <h3>Aktifkan kembali pekerjaan</h3>
            <div class="lt-sub">Prod. Order <strong>${esc(job.prod)}</strong> · ${esc(job.work)} · status ${esc(job.status)}${held && job.issue ? ' (' + esc(job.issue) + ')' : ''}</div>
            <div class="lt-info ${done ? 'lt-warn' : ''}">${done
                ? 'Pekerjaan ini sudah <strong>Done</strong>. Jika diaktifkan kembali (misalnya untuk repair), progress kembali ke <strong>0%</strong> dan statusnya menjadi Planning.'
                : `Pekerjaan kembali berjalan sesuai progress terakhir (<strong>${job.progress}%</strong>).${job.reason ? '<br>Alasan ' + esc(job.status) + ' sebelumnya: ' + esc(job.reason) : ''}`}</div>
            <label class="lt-label" for="ltWhy">Alasan diaktifkan kembali <small>${done ? '(wajib)' : '(opsional)'}</small></label>
            <textarea class="lt-in" id="ltWhy" placeholder="${done ? 'Contoh: Ada repair, hasil cek kualitas kurang sesuai.' : 'Contoh: Material sudah datang.'}"></textarea>
            <div class="lt-err" id="ltErr"></div>
            <div class="lt-actions"><button type="button" class="lt-btn" id="ltCancel">Batal</button><button type="button" class="lt-btn main" id="ltOk">Aktifkan kembali</button></div>`);
        const why = q(m.box, '#ltWhy'); why.focus();
        why.addEventListener('input', () => { q(m.box, '#ltErr').textContent = ''; });
        q(m.box, '#ltCancel').addEventListener('click', m.close);
        q(m.box, '#ltOk').addEventListener('click', () => {
            const res = S.reactivate(job.prod, ACTOR, ROLE, why.value);
            if (!res.ok) { q(m.box, '#ltErr').textContent = res.error; return; }
            m.close();
            toast(`Pekerjaan diaktifkan kembali (${res.job.status}, ${res.job.progress}%).`);
            if (cb) cb(res);
        });
    }

    /* ---------- EDIT JOB MANUAL ---------- */
    function openEdit(job, cb) {
        const m = modal('');
        const chooser = () => {
            m.box.innerHTML = `
                <h3>Edit pekerjaan</h3>
                <div class="lt-sub">Prod. Order <strong>${esc(job.prod)}</strong> · ${esc(job.work)}</div>
                <button type="button" class="lt-opt" id="ltLink"><span class="lt-ico">⌕</span><div><b>Edit picklist</b></div></button>
                <button type="button" class="lt-opt" id="ltText"><span class="lt-ico">✎</span><div><b>Edit tulisan</b></div></button>
                <div class="lt-actions"><button type="button" class="lt-btn" id="ltClose">Tutup</button></div>`;
            q(m.box, '#ltClose').addEventListener('click', m.close);
            q(m.box, '#ltLink').addEventListener('click', () => { location.href = 'scanpicklist.html?link=' + encodeURIComponent(job.prod); });
            q(m.box, '#ltText').addEventListener('click', form);
        };
        const form = () => {
            const qtyNum = (String(job.qty || '').match(/\d+/) || ['1'])[0];
            m.box.innerHTML = `
                <h3>Edit tulisan</h3>
                <div class="lt-sub">Prod. Order <strong>${esc(job.prod)}</strong></div>
                <label class="lt-label" for="eWork">Pekerjaan</label>
                <input class="lt-in" id="eWork" value="${esc(job.work)}">
                <label class="lt-label" for="eDesc">Deskripsi material <small>(opsional)</small></label>
                <input class="lt-in" id="eDesc" value="${esc(job.desc || '')}">
                <div class="lt-row">
                    <div><label class="lt-label" for="eMat">No. Material <small>(opsional)</small></label><input class="lt-in" id="eMat" value="${esc(job.material || '')}"></div>
                    <div><label class="lt-label" for="eSo">No. SO <small>(opsional)</small></label><input class="lt-in" id="eSo" value="${esc(job.so || '')}"></div>
                </div>
                <label class="lt-label" for="eQty">Qty</label>
                <input class="lt-in" id="eQty" type="number" min="1" value="${esc(qtyNum)}">
                <div class="lt-err" id="ltErr"></div>
                <div class="lt-actions"><button type="button" class="lt-btn" id="ltBack">← Kembali</button><button type="button" class="lt-btn main" id="ltSave">Simpan perubahan</button></div>`;
            q(m.box, '#eWork').focus();
            m.box.addEventListener('input', () => { q(m.box, '#ltErr').textContent = ''; });
            q(m.box, '#ltBack').addEventListener('click', chooser);
            q(m.box, '#ltSave').addEventListener('click', () => {
                const res = S.updateJob(job.prod, {
                    work: q(m.box, '#eWork').value, desc: q(m.box, '#eDesc').value,
                    material: q(m.box, '#eMat').value, so: q(m.box, '#eSo').value,
                    qty: String(Math.max(1, Math.floor(Number(q(m.box, '#eQty').value) || 1)))
                }, ACTOR, ROLE);
                if (!res.ok) { q(m.box, '#ltErr').textContent = res.error; return; }
                m.close();
                toast('Pekerjaan diperbarui.');
                if (cb) cb(res);
            });
        };
        chooser();
    }

    /* ---------- EXPORT EXCEL (nama + proses + target) ---------- */
    async function exportPlan(rows, date) {
        const jobs = (rows || []).map(j => ({ prod: j.prod, so: j.so, qty: j.qty, work: j.work, status: j.status, progress: j.progress, target: j.target, team: j.team || [] }));
        if (!jobs.length) { toast('Tidak ada pekerjaan untuk di-export.'); return; }
        try {
            const r = await fetch('/api/export/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: date || '', jobs }) });
            if (!r.ok) {
                const j = await r.json().catch(() => null);
                toast((j && j.error) || 'Export gagal.');
                return;
            }
            const blob = await r.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `plan-karyawan-${date || 'semua-tanggal'}.xlsx`;
            document.body.appendChild(a); a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
            toast('File Excel diunduh.');
        } catch (e) { toast('Export gagal. Pastikan server berjalan.'); }
    }

    /* ---------- PRODUK ORDER SUDAH ADA (dipakai saat scan picklist yang sama) ---------- */
    function openExisting(job, cb) {
        const held = S.isHeld(job), done = job.status === 'Done';
        const m = modal(`
            <h3>Prod. Order sudah ada</h3>
            <div class="lt-sub">Prod. Order <strong>${esc(job.prod)}</strong> · ${esc(job.work)}</div>
            <div class="lt-info ${held || done ? 'lt-warn' : ''}">Sudah ada di dashboard dengan status <strong>${esc(job.status)}</strong>${held && job.issue ? ' (' + esc(job.issue) + ')' : ''}, progress ${job.progress}%.${held && job.reason ? '<br>Alasan: ' + esc(job.reason) : ''}${done ? '<br>Kalau diaktifkan kembali (repair), progress mulai lagi dari 0%.' : ''}${!held && !done ? '<br>Tidak perlu ditambahkan lagi.' : ''}</div>
            <div class="lt-actions">
                <button type="button" class="lt-btn" id="ltClose">Tutup</button>
                ${held || done ? '<button type="button" class="lt-btn main" id="ltAct">Aktifkan kembali</button>' : '<a class="lt-btn main" style="text-decoration:none" href="dashboard-lead.html">Lihat di dashboard</a>'}
            </div>`);
        q(m.box, '#ltClose').addEventListener('click', m.close);
        const act = q(m.box, '#ltAct');
        if (act) act.addEventListener('click', () => { m.close(); openReactivate(job, cb); });
    }

    window.LeaderTools = { openReactivate, openEdit, openExisting, exportPlan, toast };
})();