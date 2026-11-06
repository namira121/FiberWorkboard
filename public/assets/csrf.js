/* Menambah header X-XSRF-TOKEN otomatis ke fetch non-GET (syarat CSRF Laravel).
   Muat PALING AWAL di <head> semua halaman. */
(function () {
    var orig = window.fetch;

    function token() {
        var m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : '';
    }

    window.fetch = function (input, init) {
        init = init || {};
        var method = String(init.method || (input && input.method) || 'GET').toUpperCase();
        if (method !== 'GET' && method !== 'HEAD') {
            var h = new Headers(init.headers || (input && input.headers) || {});
            if (!h.has('X-XSRF-TOKEN')) h.set('X-XSRF-TOKEN', token());
            init.headers = h;
        }
        return orig.call(this, input, init);
    };
})();
