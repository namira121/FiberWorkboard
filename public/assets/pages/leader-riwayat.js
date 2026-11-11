const S = Store, esc = S.esc, $ = id => document.getElementById(id), app = $('app');
const cls = s => ({'On progress':'s-progress','Done':'s-done','Planning':'s-planning','Pending':'s-pending','Cancel':'s-cancel'}[s] || 's-planning');

let toastTimer;
function toast(m){ const t=$('teamToast'); t.textContent=m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2400); }

/* semua jenis masalah yang pernah tercatat di riwayat Prod. Order ini (terbaru dulu) */
function issuesOf(j) {
    const out = [];
    S.logFor(j.prod).forEach(e => { if (e.issue && !out.includes(e.issue)) out.push(e.issue); });
    if (j.issue && !out.includes(j.issue)) out.unshift(j.issue);
    return out;
}

let shownRows = [];
function render() {
    const all = S.jobs();
    const date = $('dateFilter').value, status = $('statusFilter').value, issue = $('issueFilter').value;
    const q = $('searchInput').value.trim().toLowerCase();

    /* 1 baris = 1 Prod. Order (primary key), status = status terakhir */
    const rows = shownRows = all.filter(j => {
        if (date && j.date !== date && !S.logFor(j.prod).some(e => e.date === date)) return false;
        if (status !== 'all' && j.status !== status) return false;
        if (issue !== 'all' && !issuesOf(j).includes(issue)) return false;
        const text = `${j.so} ${j.prod} ${j.material} ${j.desc || ''} ${j.work}`.toLowerCase();
        return !q || text.includes(q);
    });

    const count = s => rows.filter(j => j.status === s).length;
    $('sumRow').innerHTML = [['Pekerjaan', rows.length], ['Done', count('Done')], ['Pending', count('Pending')], ['Cancel', count('Cancel')]]
        .map(([l, v]) => `<div class="sum-card"><span>${l}</span><strong>${v}</strong></div>`).join('');

    const dash = '<span class="team-empty">—</span>';
    $('tableBody').innerHTML = rows.length ? rows.map(j => `
        <tr>
            <td class="so">${j.so ? esc(j.so) : dash}</td>
            <td><span class="material">${esc(j.prod)}</span></td>
            <td class="so">${j.material ? esc(j.material) : dash}</td>
            <td>${j.desc ? esc(j.desc) : dash}</td>
            <td><span class="work">${esc(j.work)}</span></td>
            <td><span class="status ${cls(j.status)}">${esc(j.status)}</span></td>
            <td>${issuesOf(j).map(i => `<span class="issue-tag i-${esc(i)}">${esc(i)}</span>`).join(' ') || dash}</td>
            <td class="qty">${j.progress}%</td>
            <td><button type="button" class="reset-btn" style="height:34px;font-size:11px;white-space:nowrap" data-hist="${esc(j.prod)}" title="Lihat riwayat perubahan status">🕒 Riwayat${S.isHeld(j) ? ' · ' + esc(j.status) : ''}</button></td>
            <td>${j.status === 'Done' || S.isHeld(j) ? `<button type="button" class="reset-btn" style="height:34px;font-size:11px;white-space:nowrap;color:#1479e8;border-color:#bcd7f7" data-react="${esc(j.prod)}" title="Aktifkan kembali pekerjaan ini">↻ Aktifkan kembali</button>` : `<button type="button" class="reset-btn" style="height:34px;font-size:11px;white-space:nowrap;color:#1479e8;border-color:#bcd7f7;opacity:.45;cursor:not-allowed" disabled title="Hanya pekerjaan Done, Pending, atau Cancel yang bisa diaktifkan kembali">↻ Aktifkan kembali</button>`}</td>
        </tr>`).join('')
        : '<tr><td colspan="10" class="empty">Belum ada pekerjaan yang sesuai dengan filter.</td></tr>';

    $('resultCount').textContent = `Menampilkan ${rows.length} dari ${all.length} pekerjaan`;
}

$('tableBody').addEventListener('click', e => {
    const r = e.target.closest('[data-react]');
    if (r) { const j = S.findJob(r.dataset.react); if (j) LeaderTools.openReactivate(j, render); return; }
    const b = e.target.closest('[data-hist]'); if (!b) return;
    const job = S.findJob(b.dataset.hist); if (job) openJobHistory(job);
});

['input','change'].forEach(ev => ['dateFilter','searchInput','statusFilter','issueFilter'].forEach(id => $(id).addEventListener(ev, render)));
$('exportBtn').addEventListener('click', () => LeaderTools.exportPlan(shownRows, $('dateFilter').value));
$('resetFilter').addEventListener('click', () => {
    $('dateFilter').value = ''; $('searchInput').value = ''; $('statusFilter').value = 'all'; $('issueFilter').value = 'all'; render();
});

$('toggleBtn').addEventListener('click', () => { if (window.innerWidth <= 650) app.classList.toggle('mobile-open'); else app.classList.toggle('collapsed'); });
$('overlay').addEventListener('click', () => app.classList.remove('mobile-open'));
$('logoutBtn').addEventListener('click', () => { if (confirm('Apakah kamu yakin ingin logout?')) Auth.logout(); });
window.addEventListener('storage', e => { if (e.key === S.KEYS.log || e.key === S.KEYS.jobs) render(); });
window.addEventListener('pageshow', render);
render();
