/* Hanya dikirim server ke SUPERADMIN: menambahkan menu Admin ke sidebar halaman Leader. */
(function () {
    fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (me) {
            if (!me || me.role !== 'superadmin') return;
            var nav = document.querySelector('.nav');
            if (!nav || nav.querySelector('[data-admin]')) return;
            [
                ['/Admin/sap.html', '⇄', 'Integrasi SAP'],
                ['/Admin/akun.html', '♚', 'Kelola Akun'],
                ['/Admin/data.html', '▤', 'Kelola Data'],
                ['/Admin/audit.html', '☷', 'Log Aktivitas']
            ].forEach(function (l) {
                var a = document.createElement('a');
                a.href = l[0];
                a.setAttribute('data-admin', '1');
                var i = document.createElement('span'); i.className = 'ico'; i.textContent = l[1];
                var t = document.createElement('span'); t.className = 'nav-label'; t.textContent = l[2];
                a.appendChild(i); a.appendChild(t); nav.appendChild(a);
            });
        })
        .catch(function () {});
})();
