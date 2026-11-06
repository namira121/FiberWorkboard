/* SYNC DATA KE SERVER - dimuat SEBELUM store.js */
(function () {
    var KEYS = ['sectionViberJobsV2', 'sectionViberStatusLogV2', 'sectionViberEmployeeList', 'sectionViberEmployees'];
    var JOBS = KEYS[0], EMPS = KEYS[2];
    var FLAG = 'sectionViberSyncV1';
    var SIM = 'sectionViberSimId';   /* ganti oleh reset-simulasi.js: data lokal lama di browser dibuang, ikut data server */
    var POLL_MS = 4000;

    var ls = window.localStorage;
    var origSet = Storage.prototype.setItem;
    var serverOn = false, pending = 0, lastWrite = 0;

    function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

    function xhrState() {
        try {
            var x = new XMLHttpRequest();
            x.open('GET', '/api/state', false);
            x.send();
            if (x.status === 200) { var j = parse(x.responseText); if (j && j.ok) return j.state || {}; }
        } catch (e) { /* tidak ada server */ }
        return null;
    }

    function push(key, value) {
        pending++;
        fetch('/api/state/' + encodeURIComponent(key), {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: value }), keepalive: true
        }).catch(function () {}).then(function () { pending--; lastWrite = Date.now(); });
    }

    /* gabungkan data lokal lama ke data server (sekali per perangkat) */
    function merge(key, serverStr, localStr) {
        var s = parse(serverStr), l = parse(localStr);
        if (l == null) return serverStr;
        if (s == null) return localStr;
        if (Array.isArray(s) && Array.isArray(l)) {
            var idf = key === JOBS ? function (o) { return o && o.prod; }
                : key === EMPS ? function (o) { return o && o.nik; }
                : function (o) { return JSON.stringify(o); };
            var seen = {}, out = s.slice();
            s.forEach(function (o) { seen[idf(o)] = 1; });
            l.forEach(function (o) { if (!seen[idf(o)]) { seen[idf(o)] = 1; out.push(o); } });
            return JSON.stringify(out);
        }
        if (typeof s === 'object' && typeof l === 'object') return JSON.stringify(Object.assign({}, l, s));
        return serverStr;
    }

    var state = xhrState();
    if (state) {
        serverOn = true;
        var simChanged = !!state[SIM] && ls.getItem(SIM) !== state[SIM];
        var migrated = simChanged || ls.getItem(FLAG) === '1';
        KEYS.forEach(function (k) {
            var sv = state[k], lv = ls.getItem(k), fin;
            if (sv == null) fin = lv;
            else if (!migrated && lv != null && lv !== sv) fin = merge(k, sv, lv);
            else fin = sv;
            if (fin != null) {
                if (fin !== lv) origSet.call(ls, k, fin);
                if (fin !== sv) push(k, fin);
            }
        });
        origSet.call(ls, FLAG, '1');
        if (state[SIM]) origSet.call(ls, SIM, state[SIM]);
    }

    Storage.prototype.setItem = function (k, v) {
        origSet.apply(this, arguments);
        if (serverOn && this === ls && KEYS.indexOf(k) > -1) push(k, String(v));
    };

    if (serverOn) {
        setInterval(function () {
            if (document.hidden || pending > 0 || Date.now() - lastWrite < 2000) return;
            fetch('/api/state', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
                if (!j || !j.ok || pending > 0 || Date.now() - lastWrite < 2000) return;
                KEYS.forEach(function (k) {
                    var sv = j.state && j.state[k];
                    if (sv != null && sv !== ls.getItem(k)) {
                        origSet.call(ls, k, sv);
                        try { window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: sv, storageArea: ls })); } catch (e) {}
                    }
                });
            }).catch(function () {});
        }, POLL_MS);
    }
})();