/* Tombol menu (hamburger) untuk layar HP. Sidebar di HP tersembunyi di kiri, tombol ini yang membukanya. */
(function () {
    function init() {
        var app = document.getElementById('app');
        var bar = document.querySelector('.topbar');
        if (!app || !bar || document.getElementById('menuBtn')) return;

        var css = document.createElement('style');
        css.textContent =
            '.menu-btn{display:none;width:38px;height:38px;border:1px solid #e6edf4;border-radius:10px;background:#fff;color:#10638b;font-size:20px;line-height:1;margin-right:12px;flex-shrink:0;cursor:pointer;padding:0}' +
            '@media (max-width:650px){' +
            '.menu-btn{display:inline-grid;place-items:center}' +
            '.topbar{position:sticky;top:0;z-index:8}' +
            '.sidebar{box-shadow:none}' +
            '.mobile-open .sidebar{box-shadow:10px 0 30px #001e3320}' +
            '}';
        document.head.appendChild(css);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'menuBtn';
        btn.className = 'menu-btn';
        btn.setAttribute('aria-label', 'Buka menu');
        btn.textContent = '☰';
        bar.insertBefore(btn, bar.firstChild);

        function close() { app.classList.remove('mobile-open'); }
        btn.addEventListener('click', function () { app.classList.toggle('mobile-open'); });
        var ov = document.getElementById('overlay');
        if (ov) ov.addEventListener('click', close);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
        window.addEventListener('resize', function () { if (window.innerWidth > 650) close(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
