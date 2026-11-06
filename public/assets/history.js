/* Popup "Riwayat perubahan status" per Prod. Order (dipakai halaman Riwayat). Butuh Store + elemen #historyModal. */
(function () {
    const S = window.Store, esc = S.esc, $ = id => document.getElementById(id);
    const cls = s => ({ 'On progress': 's-progress', 'Done': 's-done', 'Planning': 's-planning', 'Pending': 's-pending', 'Cancel': 's-cancel' }[s] || 's-planning');
    window.openJobHistory = function (job) {
        $('historyJobInfo').textContent = `Prod. Order ${job.prod} · ${job.work} · ${job.so || 'tanpa SO'}`;
        const entries = S.logFor(job.prod);
        $('historyList').innerHTML = entries.length ? entries.map(e => `
            <article class="history-item">
                <div class="history-item-top">
                    <div>
                        <div class="history-action">${e.from === e.to ? 'Update progress · ' + esc(e.to) : esc(e.from) + ' → ' + esc(e.to)}</div>
                        <div class="history-time">${S.fmtDate(e.date)} · ${esc(e.time)}</div>
                    </div>
                    <span class="status ${cls(e.to)}">${esc(e.to)}</span>
                </div>
                <div class="history-grid">
                    <div class="history-field"><label>Diubah oleh</label><strong>${esc(e.by)}</strong></div>
                    <div class="history-field"><label>Progress</label><strong>${e.progress}%</strong></div>
                    ${e.issue ? `<div class="history-field"><label>Masalah</label><strong><span class="issue-tag i-${esc(e.issue)}">${esc(e.issue)}</span></strong></div>` : ''}
                </div>
                ${e.reason ? `<div class="history-reason"><strong>Alasan:</strong> ${esc(e.reason)}</div>` : ''}
            </article>`).join('') : '<div class="history-empty">Belum ada riwayat status untuk pekerjaan ini.</div>';
        $('historyModal').classList.add('show');
        $('closeHistoryModal').focus();
    };
    const close = () => $('historyModal').classList.remove('show');
    $('closeHistoryModal').addEventListener('click', close);
    $('historyModal').addEventListener('click', e => { if (e.target === $('historyModal')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();
