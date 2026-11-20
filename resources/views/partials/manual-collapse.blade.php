<style>
    .manual-card .manual-title{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;user-select:none;margin-bottom:16px}
    .manual-card .manual-title:focus-visible{outline:2px solid #2f6fb3;outline-offset:4px;border-radius:6px}
    .manual-card .mc-chev{flex:none;width:20px;height:20px;transition:transform .2s ease;color:#6b7f90}
    .manual-card.collapsed{padding-top:14px;padding-bottom:14px;cursor:pointer}
    .manual-card.collapsed .manual-title{margin-bottom:0}
    .manual-card.collapsed .mc-chev{transform:rotate(-90deg)}
    .manual-card.collapsed form{display:none}
</style>
<script>
(function () {
    var card = document.querySelector('.manual-card');
    var title = document.getElementById('manualTitle');
    if (!card || !title) return;

    var KEY = 'viber.manualCard.collapsed';
    var DEFAULT_COLLAPSED = false; // ubah ke true kalau mau default tertutup

    function read() {
        try { var v = localStorage.getItem(KEY); return v === null ? DEFAULT_COLLAPSED : v === '1'; }
        catch (e) { return DEFAULT_COLLAPSED; }
    }
    function save(c) { try { localStorage.setItem(KEY, c ? '1' : '0'); } catch (e) {} }

    title.insertAdjacentHTML('beforeend',
        '<svg class="mc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>');
    title.setAttribute('role', 'button');
    title.setAttribute('tabindex', '0');
    title.setAttribute('aria-controls', 'manualForm');

    function set(c, persist) {
        card.classList.toggle('collapsed', c);
        title.setAttribute('aria-expanded', c ? 'false' : 'true');
        if (persist) save(c);
    }

    // Header selalu toggle. Saat tertutup, klik di mana saja pada card membuka.
    title.addEventListener('click', function () { set(!card.classList.contains('collapsed'), true); });
    title.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); title.click(); }
    });
    card.addEventListener('click', function (e) {
        if (card.classList.contains('collapsed') && !title.contains(e.target)) set(false, true);
    });

    // Error validasi muncul -> buka otomatis (tidak disimpan sebagai preferensi)
    var err = document.getElementById('manualError');
    if (err) {
        new MutationObserver(function () {
            if (err.textContent.trim() && card.classList.contains('collapsed')) set(false, false);
        }).observe(err, { childList: true, characterData: true, subtree: true });
    }

    set(read(), false);
})();
</script>