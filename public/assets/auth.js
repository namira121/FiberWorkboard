/* Sisi browser untuk login sekali: logout, cek sesi saat aplikasi dibuka lagi, daftar service worker (PWA). */
(function () {
    var LOGIN = '/login';

    window.Auth = {
        logout: function () {
            return fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
                .catch(function () {})
                .then(function () { window.location.replace(LOGIN); });
        }
    };

    /* Aplikasi dibuka lagi dari background: kalau sesi sudah dicabut / habis, kembali ke login */
    function check() {
        fetch('/api/me', { cache: 'no-store', credentials: 'same-origin' })
            .then(function (r) { if (r.status === 401) window.location.replace(LOGIN); })
            .catch(function () {});
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });

    /* Halaman Public dipakai di TV berjam-jam: minta layar tetap menyala (Screen Wake Lock), diminta ulang kalau tab kembali aktif */
    if (/^\/public\//.test(location.pathname) && 'wakeLock' in navigator) {
        var lock = null;
        var acquire = function () {
            navigator.wakeLock.request('screen').then(function (l) {
                lock = l;
                l.addEventListener('release', function () { lock = null; });
            }).catch(function () {});
        };
        acquire();
        document.addEventListener('visibilitychange', function () { if (!document.hidden && !lock) acquire(); });
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
    }
})();