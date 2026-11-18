/* Tombol menu (hamburger) untuk layar HP. Sidebar di HP tersembunyi di kiri, tombol ini yang membukanya. */
(function () {
    function init() {
        var app = document.getElementById('app');
        var bar = document.querySelector('.topbar');
        var sidebar = document.getElementById('appSidebar');
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
        btn.setAttribute('aria-controls', 'appSidebar');
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = '☰';
        bar.insertBefore(btn, bar.firstChild);

        function mobile() { return window.innerWidth <= 650; }
        function sync(open, restoreFocus) {
            app.classList.toggle('mobile-open', open);
            btn.setAttribute('aria-expanded', String(open));

            if (mobile() && sidebar) {
                sidebar.toggleAttribute('inert', !open);
                sidebar.setAttribute('aria-hidden', String(!open));
            } else if (sidebar) {
                sidebar.removeAttribute('inert');
                sidebar.removeAttribute('aria-hidden');
            }

            if (restoreFocus && !open) btn.focus();
        }

        btn.addEventListener('click', function () {
            var open = !app.classList.contains('mobile-open');
            sync(open, false);
            if (open && sidebar) {
                var first = sidebar.querySelector('.nav a');
                if (first) first.focus();
            }
        });
        var ov = document.getElementById('overlay');
        if (ov) ov.addEventListener('click', function () { sync(false, true); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && app.classList.contains('mobile-open')) sync(false, true);
        });
        window.addEventListener('resize', function () {
            sync(app.classList.contains('mobile-open') && mobile(), false);
        });
        var brandToggle = document.getElementById('toggleBtn');
        if (brandToggle) brandToggle.addEventListener('click', function () {
            requestAnimationFrame(function () {
                if (mobile()) sync(app.classList.contains('mobile-open'), false);
            });
        });
        sync(false, false);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
