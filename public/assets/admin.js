/* Halaman superadmin: Integrasi SAP, Kelola Akun, Kelola Data, Log Aktivitas.
   Semua teks dari server dimasukkan lewat textContent (bukan innerHTML), jadi aman dari XSS. */
(function () {
    'use strict';

    /* ================= util ================= */
    function $(s, r) { return (r || document).querySelector(s); }

    function h(tag, attrs, kids) {
        var e = document.createElement(tag);
        Object.keys(attrs || {}).forEach(function (k) {
            var v = attrs[k];
            if (v === false || v == null) return;
            if (k === 'class') e.className = v;
            else if (k === 'text') e.textContent = v;
            else if (k === 'value') e.value = v;
            else if (k === 'checked') e.checked = !!v;
            else if (k === 'disabled') e.disabled = !!v;
            else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
            else e.setAttribute(k, v === true ? '' : v);
        });
        [].concat(kids == null ? [] : kids).forEach(function (c) {
            if (c == null || c === false) return;
            e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
        });
        return e;
    }

    function api(url, method, body) {
        var opt = { method: method || 'GET', credentials: 'same-origin', headers: { 'Accept': 'application/json' } };
        if (body !== undefined) {
            opt.headers['Content-Type'] = 'application/json';
            opt.body = JSON.stringify(body);
        }
        return fetch(url, opt).then(function (r) {
            if (r.status === 401) {
                location.replace('/Login.html');
                throw new Error('Sesi habis. Silakan login lagi.');
            }
            return r.json().catch(function () { return null; }).then(function (j) {
                if (!r.ok || (j && j.ok === false)) {
                    var msg = (j && (j.error || j.message)) || ('Terjadi kesalahan (' + r.status + ').');
                    if (r.status === 403) msg = 'Akses ditolak.';
                    throw new Error(msg);
                }
                return j || {};
            });
        });
    }

    var toastTimer;
    function toast(msg, bad) {
        var t = $('#toast');
        if (!t) { t = h('div', { id: 'toast', class: 'toast', role: 'status' }); document.body.appendChild(t); }
        t.textContent = msg;
        t.className = 'toast show' + (bad ? ' bad' : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.className = 'toast'; }, 4500);
    }
    function fail(e) { toast(e && e.message ? e.message : 'Terjadi kesalahan.', true); }

    function short(s) { return s ? s.slice(0, 16) : '-'; }
    function parseDt(s) { return s ? new Date(s.replace(' ', 'T')) : null; }
    function ago(s) {
        var d = parseDt(s);
        if (!d) return 'belum pernah';
        var m = Math.round((Date.now() - d.getTime()) / 60000);
        if (m < 1) return 'baru saja';
        if (m < 60) return m + ' menit lalu';
        var j = Math.round(m / 60);
        return j < 48 ? j + ' jam lalu' : Math.round(j / 24) + ' hari lalu';
    }
    function inFuture(s) {
        var d = parseDt(s);
        if (!d) return '-';
        var m = Math.round((d.getTime() - Date.now()) / 60000);
        return m <= 0 ? 'sebentar lagi' : 'dalam ' + m + ' menit';
    }

    function badge(text, kind) { return h('span', { class: 'badge b-' + kind, text: text }); }
    var JOB_KIND = { 'Planning': 'gray', 'On progress': 'blue', 'Done': 'ok', 'Pending': 'warn', 'Cancel': 'bad' };
    var ROLE_KIND = { superadmin: 'warn', leader: 'blue', 'public': 'gray' };
    var ROLE_LABEL = { superadmin: 'Superadmin', leader: 'Leader', 'public': 'Public' };

    /* tabel: cols = [{h, cell(row) -> node|string, cls}] */
    function table(cols, rows, emptyText) {
        var tb = h('tbody');
        if (!rows.length) {
            tb.appendChild(h('tr', null, h('td', { class: 'empty', colspan: cols.length, text: emptyText || 'Belum ada data.' })));
        }
        rows.forEach(function (r) {
            tb.appendChild(h('tr', null, cols.map(function (c) {
                var v = c.cell(r);
                return h('td', { class: c.cls || '' }, v == null ? '-' : v);
            })));
        });
        return h('div', { class: 'table-scroll' }, h('table', null, [
            h('thead', null, h('tr', null, cols.map(function (c) { return h('th', { text: c.h }); }))),
            tb
        ]));
    }

    function stat(label, value, sub, kind) {
        return h('div', { class: 'stat' }, [
            h('div', { class: 'lbl', text: label }),
            h('div', { class: 'val ' + (kind || ''), text: String(value) }),
            sub ? h('div', { class: 'sub2', text: sub }) : null
        ]);
    }

    function randomPassword() {
        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        var a = new Uint32Array(14);
        crypto.getRandomValues(a);
        return Array.prototype.map.call(a, function (n) { return chars.charAt(n % chars.length); }).join('');
    }

    /* tombol sibuk: nonaktifkan selama proses berjalan */
    function busy(btn, fn) {
        btn.disabled = true;
        var done = function () { btn.disabled = false; };
        var p;
        try { p = fn(); } catch (e) { done(); throw e; }
        return Promise.resolve(p).then(done, function (e) { done(); throw e; });
    }

    /* dialog isian. opt: {title, intro, fields:[{name,label,type,value,options,hint,required,maxlength,generate}], ok, danger}
       resolve(nilai) kalau OK, resolve(null) kalau dibatalkan */
    function modal(opt) {
        return new Promise(function (resolve) {
            var dlg = h('dialog', { class: 'dlg' });
            var form = h('form', { class: 'dlg-form' });
            var inputs = {};
            var settled = false;

            function finish(v) {
                if (settled) return;
                settled = true;
                if (dlg.open) dlg.close();
                if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
                resolve(v);
            }

            form.appendChild(h('h2', { text: opt.title }));
            if (opt.intro) form.appendChild(h('p', { class: 'dlg-intro', text: opt.intro }));

            (opt.fields || []).forEach(function (f) {
                var inp;
                if (f.type === 'select') {
                    inp = h('select', { name: f.name }, f.options.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
                    inp.value = f.value;
                } else if (f.type === 'textarea') {
                    inp = h('textarea', { name: f.name, rows: 3, maxlength: f.maxlength || 300 });
                    inp.value = f.value || '';
                } else {
                    inp = h('input', {
                        type: f.type || 'text', name: f.name, maxlength: f.maxlength || 200,
                        autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false'
                    });
                    inp.value = f.value || '';
                }
                inputs[f.name] = inp;

                var control = inp;
                if (f.generate) {
                    control = h('div', { class: 'row-inline' }, [inp, h('button', {
                        type: 'button', class: 'btn ghost sm', text: 'Acak',
                        onclick: function () { inp.value = randomPassword(); inp.focus(); }
                    })]);
                }
                form.appendChild(h('div', { class: 'fld' }, [
                    h('label', { text: f.label }), control,
                    f.hint ? h('div', { class: 'hint', text: f.hint }) : null
                ]));
            });

            form.appendChild(h('div', { class: 'dlg-actions' }, [
                h('button', { type: 'button', class: 'btn ghost', text: 'Batal', onclick: function () { finish(null); } }),
                h('button', { type: 'submit', class: 'btn ' + (opt.danger ? 'danger solid' : 'primary'), text: opt.ok || 'OK' })
            ]));

            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var vals = {};
                for (var i = 0; i < (opt.fields || []).length; i++) {
                    var f = opt.fields[i];
                    var v = inputs[f.name].value.trim();
                    if (f.required && !v) { toast(f.label + ' wajib diisi.', true); inputs[f.name].focus(); return; }
                    vals[f.name] = f.type === 'password' || f.generate ? inputs[f.name].value : v;
                }
                finish(vals);
            });

            dlg.addEventListener('close', function () { finish(null); });
            dlg.addEventListener('cancel', function () { finish(null); });
            dlg.appendChild(form);
            document.body.appendChild(dlg);
            dlg.showModal();
            var first = form.querySelector('input,select,textarea');
            if (first) first.focus();
        });
    }

    function initShell() {
        var lo = $('#logoutBtn');
        if (lo) lo.addEventListener('click', function () { if (window.Auth) window.Auth.logout(); });
        var tg = $('#toggleBtn');
        if (tg) tg.addEventListener('click', function () { $('#app').classList.toggle('collapsed'); });
    }

    /* ================= Integrasi SAP ================= */
    var MAP = ['picklist_no', 'so_number', 'material_no', 'material_desc', 'prod_order', 'proses'];
    var MAP_LABEL = {
        picklist_no: 'Nomor picklist *', so_number: 'No. SO', material_no: 'No. Material',
        material_desc: 'Deskripsi material', prod_order: 'Prod. Order *', proses: 'Proses'
    };

    function pageSap() {
        var cfgBox = $('#cfg');
        var hasSecret = false;

        function fld(label, input, hint, id) {
            return h('div', { class: 'fld', id: id ? 'w_' + id : null }, [
                h('label', { text: label }), input, hint ? h('div', { class: 'hint', text: hint }) : null
            ]);
        }
        function inp(id, type, ph) {
            return h('input', { id: id, type: type || 'text', placeholder: ph || '', autocomplete: 'off', spellcheck: 'false' });
        }
        function sel(id, opts) {
            return h('select', { id: id }, opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
        }
        function chk(id, label) {
            return h('div', { class: 'fld check' }, h('label', null, [h('input', { id: id, type: 'checkbox' }), label]));
        }

        /* ---- form pengaturan ---- */
        var secretInput = h('input', { id: 'f_secret', type: 'password', autocomplete: 'new-password', placeholder: '' });
        var secretHint = h('div', { class: 'hint' });
        var clearWrap = h('div', { class: 'hint', id: 'clearWrap' });

        cfgBox.appendChild(h('div', { class: 'form-grid' }, [
            chk('f_enabled', 'Sinkronisasi otomatis aktif'),
            fld('Interval sinkron', sel('f_interval', [['5', 'Tiap 5 menit'], ['10', 'Tiap 10 menit'], ['15', 'Tiap 15 menit'], ['30', 'Tiap 30 menit'], ['60', 'Tiap 1 jam'], ['180', 'Tiap 3 jam'], ['720', 'Tiap 12 jam'], ['1440', 'Sehari sekali']]), 'Butuh cron di server (lihat catatan di bawah).')
        ]));

        cfgBox.appendChild(h('div', { class: 'sec-title', text: 'Alamat & otentikasi' }));
        cfgBox.appendChild(h('div', { class: 'form-grid' }, [
            fld('Base URL', inp('f_base_url', 'text', 'https://sap.perusahaan.com:44300'), 'Alamat server API SAP (tanpa path).'),
            fld('Path endpoint', inp('f_endpoint_path', 'text', '/sap/opu/odata/sap/NAMA_SERVICE/PicklistSet'), 'Bagian setelah Base URL.'),
            fld('Jenis otentikasi', sel('f_auth_type', [['basic', 'Username + password (Basic)'], ['bearer', 'Token (Bearer)'], ['apikey', 'API key di header'], ['none', 'Tanpa otentikasi']])),
            fld('Username', inp('f_username'), null, 'username'),
            fld('Nama header API key', inp('f_api_key_header', 'text', 'X-API-Key'), null, 'api_key_header'),
            h('div', { class: 'fld', id: 'w_secret' }, [h('label', { id: 'secretLabel', text: 'Password' }), secretInput, secretHint, clearWrap]),
            fld('Query tambahan', inp('f_extra_query', 'text', 'sap-client=100&$format=json'), 'Opsional. Jangan taruh password/token di sini.'),
            fld('Timeout (detik)', inp('f_timeout', 'number'), 'Batas waktu menunggu SAP (5-120).')
        ]));
        cfgBox.appendChild(h('div', { class: 'form-grid' }, [chk('f_verify', 'Verifikasi sertifikat SSL (disarankan)')]));
        cfgBox.appendChild(h('div', { class: 'hint', text: 'Matikan verifikasi SSL hanya untuk uji coba dengan sertifikat internal. Lebih baik minta IT memasang sertifikat yang valid.' }));

        cfgBox.appendChild(h('div', { class: 'sec-title', text: 'Membaca respons SAP' }));
        cfgBox.appendChild(h('div', { class: 'form-grid' }, [
            fld('Lokasi data', inp('f_data_path', 'text', 'd.results'), 'Letak daftar baris di JSON. OData V2: d.results, OData V4: value, kalau responsnya langsung berupa daftar: kosongkan.')
        ]));
        cfgBox.appendChild(h('div', { class: 'sec-title', text: 'Pemetaan kolom (nama field di SAP)' }));
        cfgBox.appendChild(h('div', { class: 'form-grid' }, MAP.map(function (m) {
            return fld(MAP_LABEL[m], inp('f_map_' + m, 'text', 'nama field SAP'));
        })));
        cfgBox.appendChild(h('div', { class: 'hint', text: 'Tanda * wajib. Tidak tahu nama field-nya? Isi alamat di atas lalu klik "Simpan & tes koneksi": daftar field dari SAP akan ditampilkan.' }));

        var btnSave = h('button', { class: 'btn primary', type: 'button', text: 'Simpan pengaturan' });
        var btnTest = h('button', { class: 'btn ghost', type: 'button', text: 'Simpan & tes koneksi' });
        var btnSync = h('button', { class: 'btn ghost', type: 'button', text: 'Simpan & sinkronkan sekarang' });
        cfgBox.appendChild(h('div', { class: 'actions' }, [btnSave, btnTest, btnSync]));

        function applyAuthUi() {
            var t = $('#f_auth_type').value;
            $('#w_username').style.display = t === 'basic' ? '' : 'none';
            $('#w_api_key_header').style.display = t === 'apikey' ? '' : 'none';
            $('#w_secret').style.display = t === 'none' ? 'none' : '';
            $('#secretLabel').textContent = t === 'basic' ? 'Password' : (t === 'bearer' ? 'Token' : 'API key');
        }
        $('#f_auth_type').addEventListener('change', applyAuthUi);

        function fill(s) {
            hasSecret = !!s.has_secret;
            $('#f_enabled').checked = !!s.enabled;
            $('#f_interval').value = String(s.sync_interval_minutes);
            $('#f_base_url').value = s.base_url || '';
            $('#f_endpoint_path').value = s.endpoint_path || '';
            $('#f_auth_type').value = s.auth_type;
            $('#f_username').value = s.username || '';
            $('#f_api_key_header').value = s.api_key_header || '';
            $('#f_extra_query').value = s.extra_query || '';
            $('#f_timeout').value = s.timeout_seconds;
            $('#f_verify').checked = !!s.verify_ssl;
            $('#f_data_path').value = s.data_path || '';
            MAP.forEach(function (m) { $('#f_map_' + m).value = s['map_' + m] || ''; });
            secretInput.value = '';
            secretInput.placeholder = hasSecret ? '•••••••• (tersimpan)' : '';
            secretHint.textContent = hasSecret
                ? 'Tersimpan terenkripsi. Ketik di sini hanya kalau ingin MENGGANTI.'
                : 'Belum ada yang tersimpan. Disimpan terenkripsi dan tidak pernah ditampilkan lagi.';
            clearWrap.textContent = '';
            if (hasSecret) {
                clearWrap.appendChild(h('label', null, [h('input', { id: 'f_clear_secret', type: 'checkbox' }), ' Hapus kredensial yang tersimpan']));
            }
            applyAuthUi();
        }

        function collect() {
            var g = function (id) { return $('#' + id).value.trim(); };
            var p = {
                enabled: $('#f_enabled').checked,
                sync_interval_minutes: parseInt(g('f_interval'), 10),
                base_url: g('f_base_url'), endpoint_path: g('f_endpoint_path'),
                auth_type: g('f_auth_type'), username: g('f_username'), api_key_header: g('f_api_key_header'),
                extra_query: g('f_extra_query'), data_path: g('f_data_path'),
                timeout_seconds: parseInt(g('f_timeout'), 10) || 30,
                verify_ssl: $('#f_verify').checked
            };
            MAP.forEach(function (m) { p['map_' + m] = g('f_map_' + m); });
            if (secretInput.value) p.secret = secretInput.value;
            var cs = $('#f_clear_secret');
            if (cs && cs.checked) p.clear_secret = true;
            return p;
        }

        function save() {
            return api('/api/admin/sap/settings', 'PUT', collect()).then(function (r) {
                fill(r.settings);
                return r;
            });
        }

        /* ---- ringkasan ---- */
        function loadSummary() {
            return api('/api/admin/sap/summary').then(function (s) {
                var box = $('#stats');
                box.textContent = '';
                var st = !s.configured ? ['Belum diatur', 'gray', 'Isi alamat SAP di bawah'] :
                    (s.enabled ? ['Aktif', 'ok', 'Sinkron tiap ' + s.interval + ' menit'] : ['Nonaktif', 'warn', 'Sinkron otomatis mati']);
                box.appendChild(stat('Status koneksi', st[0], st[2], st[1] === 'gray' ? '' : st[1]));
                box.appendChild(stat('Sinkron terakhir', ago(s.last_sync_at),
                    s.last_status === 'failed' ? 'Percobaan terakhir gagal: ' + (s.last_message || '') : (s.enabled ? 'Berikutnya: ' + inFuture(s.next_sync_at) : ''),
                    s.last_status === 'failed' ? 'bad' : ''));
                box.appendChild(stat('Picklist diterima', s.picklists_total, s.picklists_new + ' berstatus Baru'));
                box.appendChild(stat('Baris belum diplan', s.items_unplanned, 'dari ' + s.items_total + ' baris'));
                box.appendChild(stat('Gagal 24 jam terakhir', s.failed_24h, '', s.failed_24h > 0 ? 'bad' : ''));
            });
        }

        /* ---- hasil tes ---- */
        function showResult(res) {
            var box = $('#testOut');
            box.textContent = '';
            box.className = 'card result ' + (res.success ? 'ok' : 'bad');
            box.appendChild(h('div', { class: 'res-head' }, [badge(res.success ? 'Berhasil' : 'Gagal', res.success ? 'ok' : 'bad'), h('span', { text: res.message || '' })]));
            var meta = [];
            if (res.http_status) meta.push('HTTP ' + res.http_status);
            if (res.rows != null) meta.push(res.rows + ' baris');
            if (res.picklists != null) meta.push(res.picklists + ' picklist');
            if (meta.length) box.appendChild(h('div', { class: 'res-meta', text: meta.join(' · ') }));
            if (res.fields && res.fields.length) {
                box.appendChild(h('div', { class: 'res-meta', text: 'Field yang ditemukan di baris pertama dari SAP (pakai nama ini di Pemetaan kolom):' }));
                box.appendChild(h('div', { class: 'chips' }, res.fields.map(function (f) { return h('span', { class: 'chip mono', text: f }); })));
            }
            if (res.sample && res.sample.length) {
                box.appendChild(h('div', { class: 'res-meta', text: 'Contoh hasil pemetaan:' }));
                box.appendChild(table(MAP.map(function (m) { return { h: MAP_LABEL[m].replace(' *', ''), cell: function (r) { return r[m]; } }; }), res.sample));
            }
            box.style.display = '';
            box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        /* ---- tabel riwayat sinkron ---- */
        var TRIGGER = { manual: 'Manual', schedule: 'Otomatis', test: 'Tes' };
        function loadSyncs() {
            return api('/api/admin/sap/syncs?limit=30').then(function (r) {
                var host = $('#syncs');
                host.textContent = '';
                host.appendChild(table([
                    { h: 'Waktu', cls: 'nowrap', cell: function (x) { return short(x.at); } },
                    { h: 'Pemicu', cell: function (x) { return TRIGGER[x.trigger] || x.trigger; } },
                    { h: 'Oleh', cell: function (x) { return x.by || '-'; } },
                    { h: 'Status', cell: function (x) { return badge(x.status === 'success' ? 'Berhasil' : 'Gagal', x.status === 'success' ? 'ok' : 'bad'); } },
                    { h: 'HTTP', cell: function (x) { return x.http || '-'; } },
                    { h: 'Baris', cell: function (x) { return x.rows; } },
                    { h: 'Picklist', cell: function (x) { return x.picklists; } },
                    { h: 'Baru / diubah', cls: 'nowrap', cell: function (x) { return x.trigger === 'test' ? '-' : x.new + ' / ' + x.updated; } },
                    { h: 'Durasi', cls: 'nowrap', cell: function (x) { return x.ms != null ? (x.ms / 1000).toFixed(1) + ' dtk' : '-'; } },
                    { h: 'Pesan', cls: 'msg', cell: function (x) { return x.message || '-'; } }
                ], r.syncs, 'Belum ada sinkronisasi. Klik "Simpan & tes koneksi" di atas untuk mencoba.'));
            });
        }

        /* ---- tabel picklist diterima ---- */
        function loadPicklists() {
            return api('/api/admin/sap/picklists').then(function (r) {
                var host = $('#picklists');
                host.textContent = '';
                var wrap = h('div');
                host.appendChild(wrap);

                var rows = r.picklists;
                var tbody;
                var t = table([
                    { h: 'No. picklist', cls: 'nowrap', cell: function (p) { return h('span', { class: 'mono', text: p.picklist_no }); } },
                    { h: 'Diterima', cls: 'nowrap', cell: function (p) { return short(p.received_at); } },
                    { h: 'Baris', cell: function (p) { return p.items; } },
                    { h: 'Sudah diplan', cell: function (p) { return p.planned + ' / ' + p.items; } },
                    { h: 'Status', cell: function (p) { return badge(p.status, p.status === 'Baru' ? 'blue' : (p.status === 'Selesai' ? 'ok' : 'warn')); } },
                    {
                        h: 'Aksi', cls: 'nowrap', cell: function (p) {
                            return h('div', { class: 'actions', style: 'margin:0' }, [
                                h('button', { class: 'btn ghost sm', type: 'button', text: 'Lihat baris', onclick: function (e) { toggleDetail(e.target, p); } }),
                                h('button', { class: 'btn danger sm', type: 'button', text: 'Hapus', onclick: function () { delPicklist(p); } })
                            ]);
                        }
                    }
                ], rows, 'Belum ada picklist yang diterima dari SAP.');
                wrap.appendChild(t);
                tbody = t.querySelector('tbody');

                function toggleDetail(btn, p) {
                    var tr = btn.closest('tr');
                    var next = tr.nextSibling;
                    if (next && next.className === 'detail') { next.parentNode.removeChild(next); btn.textContent = 'Lihat baris'; return; }
                    btn.textContent = 'Tutup';
                    var td = h('td', { colspan: 6, text: 'Memuat...' });
                    var dtr = h('tr', { class: 'detail' }, td);
                    tr.parentNode.insertBefore(dtr, tr.nextSibling);
                    api('/api/admin/sap/picklists/' + p.id).then(function (d) {
                        td.textContent = '';
                        td.appendChild(table([
                            { h: 'Prod. Order', cls: 'nowrap', cell: function (i) { return h('span', { class: 'mono', text: i.prod }); } },
                            { h: 'No. SO', cell: function (i) { return i.so; } },
                            { h: 'Material', cell: function (i) { return i.material; } },
                            { h: 'Deskripsi', cell: function (i) { return i.desc; } },
                            { h: 'Proses', cell: function (i) { return i.proses; } },
                            { h: 'Pekerjaan', cell: function (i) { return i.job ? badge(i.job.prod + ' · ' + i.job.status, 'blue') : badge('Belum diplan', 'gray'); } }
                        ], d.items));
                    }).catch(function (e) { td.textContent = e.message; });
                }

                function delPicklist(p) {
                    var extra = p.planned > 0 ? ' ' + p.planned + ' baris sudah dibuat jadi pekerjaan; pekerjaan itu TIDAK ikut terhapus.' : '';
                    modal({
                        title: 'Hapus picklist ' + p.picklist_no,
                        intro: p.items + ' baris akan dihapus.' + extra + ' Kalau SAP masih mengirim picklist ini, ia akan masuk lagi pada sinkron berikutnya.',
                        fields: [{ name: 'reason', label: 'Alasan (wajib, tercatat di Log Aktivitas)', type: 'textarea', required: true }],
                        ok: 'Hapus picklist', danger: true
                    }).then(function (v) {
                        if (!v) return;
                        api('/api/admin/sap/picklists/' + p.id, 'DELETE', { reason: v.reason })
                            .then(function () { toast('Picklist dihapus.'); loadPicklists(); loadSummary(); })
                            .catch(fail);
                    });
                }
            });
        }

        function refreshAll() { return Promise.all([loadSummary(), loadSyncs(), loadPicklists()]); }

        btnSave.addEventListener('click', function () {
            busy(btnSave, function () { return save().then(function () { toast('Pengaturan disimpan.'); return loadSummary(); }); }).catch(fail);
        });
        btnTest.addEventListener('click', function () {
            busy(btnTest, function () {
                return save().then(function () { return api('/api/admin/sap/test', 'POST', {}); })
                    .then(function (res) { showResult(res); return refreshAll(); });
            }).catch(fail);
        });
        btnSync.addEventListener('click', function () {
            busy(btnSync, function () {
                return save().then(function () { return api('/api/admin/sap/sync', 'POST', {}); })
                    .then(function (res) { toast(res.message, !res.success); return refreshAll(); });
            }).catch(fail);
        });

        api('/api/admin/sap/settings').then(function (r) { fill(r.settings); }).catch(fail);
        refreshAll().catch(fail);
    }

    /* ================= Kelola Akun ================= */
    function pageAkun() {
        var host = $('#tbl');

        function load() {
            return api('/api/admin/users').then(function (r) { render(r.users); }).catch(fail);
        }

        function userAction(u, kind) {
            if (kind === 'edit') {
                modal({
                    title: 'Ubah akun ' + u.nik,
                    fields: [
                        { name: 'name', label: 'Nama', value: u.name || '', required: true },
                        { name: 'role', label: 'Role', type: 'select', value: u.role, options: [['leader', 'Leader'], ['public', 'Public (TV / stasiun kerja)'], ['superadmin', 'Superadmin']] },
                        { name: 'is_active', label: 'Status', type: 'select', value: u.is_active ? '1' : '0', options: [['1', 'Aktif'], ['0', 'Nonaktif (tidak bisa login)']] }
                    ],
                    ok: 'Simpan'
                }).then(function (v) {
                    if (!v) return;
                    api('/api/admin/users/' + u.id, 'PUT', { name: v.name, role: v.role, is_active: v.is_active === '1' })
                        .then(function () { toast('Akun diperbarui.'); load(); }).catch(fail);
                });
            } else if (kind === 'password') {
                modal({
                    title: 'Reset password ' + u.nik,
                    intro: 'Semua perangkat akun ini akan keluar dan harus login ulang. Berikan password baru ke pemiliknya lewat jalur yang aman.',
                    fields: [{ name: 'password', label: 'Password baru (min. 10 karakter)', value: '', required: true, generate: true, maxlength: 100 }],
                    ok: 'Reset password'
                }).then(function (v) {
                    if (!v) return;
                    api('/api/admin/users/' + u.id + '/password', 'POST', { password: v.password })
                        .then(function () { toast('Password ' + u.nik + ' diganti. Semua sesinya ditutup.'); load(); }).catch(fail);
                });
            } else if (kind === 'logout') {
                modal({ title: 'Paksa logout ' + u.nik, intro: u.sessions + ' sesi aktif akan ditutup. Pemilik akun harus login lagi.', fields: [], ok: 'Paksa logout', danger: true })
                    .then(function (v) {
                        if (!v) return;
                        api('/api/admin/users/' + u.id + '/logout', 'POST', {})
                            .then(function (r) { toast(r.sessions_closed + ' sesi ditutup.'); load(); }).catch(fail);
                    });
            } else if (kind === 'delete') {
                modal({ title: 'Hapus akun ' + u.nik, intro: 'Akun dihapus permanen dan semua sesinya ditutup. Riwayat kerja yang dibuatnya tetap ada. Untuk menutup akses sementara, lebih baik NONAKTIFKAN.', fields: [], ok: 'Hapus akun', danger: true })
                    .then(function (v) {
                        if (!v) return;
                        api('/api/admin/users/' + u.id, 'DELETE').then(function () { toast('Akun dihapus.'); load(); }).catch(fail);
                    });
            }
        }

        function render(users) {
            host.textContent = '';
            host.appendChild(table([
                { h: 'NIK', cls: 'nowrap', cell: function (u) { return h('span', { class: 'mono', text: u.nik + (u.is_self ? '  (Anda)' : '') }); } },
                { h: 'Nama', cell: function (u) { return u.name || '-'; } },
                { h: 'Role', cell: function (u) { return badge(ROLE_LABEL[u.role] || u.role, ROLE_KIND[u.role] || 'gray'); } },
                { h: 'Status', cell: function (u) { return badge(u.is_active ? 'Aktif' : 'Nonaktif', u.is_active ? 'ok' : 'bad'); } },
                { h: 'Login terakhir', cls: 'nowrap', cell: function (u) { return u.last_login_at ? short(u.last_login_at) + (u.last_login_ip ? '  ·  ' + u.last_login_ip : '') : 'belum pernah'; } },
                { h: 'Sesi aktif', cell: function (u) { return u.sessions; } },
                {
                    h: 'Aksi', cls: 'nowrap', cell: function (u) {
                        return h('div', { class: 'actions', style: 'margin:0' }, [
                            h('button', { class: 'btn ghost sm', type: 'button', text: 'Ubah', onclick: function () { userAction(u, 'edit'); } }),
                            h('button', { class: 'btn ghost sm', type: 'button', text: 'Reset password', onclick: function () { userAction(u, 'password'); } }),
                            h('button', { class: 'btn ghost sm', type: 'button', text: 'Paksa logout', disabled: u.is_self || u.sessions === 0, onclick: function () { userAction(u, 'logout'); } }),
                            h('button', { class: 'btn danger sm', type: 'button', text: 'Hapus', disabled: u.is_self, onclick: function () { userAction(u, 'delete'); } })
                        ]);
                    }
                }
            ], users, 'Belum ada akun.'));
        }

        $('#addBtn').addEventListener('click', function () {
            modal({
                title: 'Tambah akun',
                intro: 'NIK dipakai untuk login (huruf, angka, titik, strip, 3-30 karakter).',
                fields: [
                    { name: 'nik', label: 'NIK', required: true, maxlength: 30 },
                    { name: 'name', label: 'Nama', required: true, maxlength: 100 },
                    { name: 'role', label: 'Role', type: 'select', value: 'leader', options: [['leader', 'Leader'], ['public', 'Public (TV / stasiun kerja)'], ['superadmin', 'Superadmin']] },
                    { name: 'password', label: 'Password (min. 10 karakter)', required: true, generate: true, maxlength: 100 }
                ],
                ok: 'Buat akun'
            }).then(function (v) {
                if (!v) return;
                api('/api/admin/users', 'POST', v).then(function () { toast('Akun dibuat. Berikan password ke pemiliknya lewat jalur yang aman.'); load(); }).catch(fail);
            });
        });

        load();
    }

    /* ================= Kelola Data (hapus pekerjaan) ================= */
    function pageData() {
        var host = $('#tbl');
        var timer;

        function load() {
            var q = $('#q').value.trim();
            return api('/api/admin/work-orders?limit=200' + (q ? '&q=' + encodeURIComponent(q) : '')).then(function (r) {
                host.textContent = '';
                host.appendChild(table([
                    { h: 'Prod. Order', cls: 'nowrap', cell: function (j) { return h('span', { class: 'mono', text: j.prod }); } },
                    { h: 'Pekerjaan', cell: function (j) { return j.work; } },
                    { h: 'No. SO', cell: function (j) { return j.so || '-'; } },
                    { h: 'Tanggal', cls: 'nowrap', cell: function (j) { return j.date; } },
                    { h: 'Status', cell: function (j) { return badge(j.status, JOB_KIND[j.status] || 'gray'); } },
                    { h: 'Progress', cell: function (j) { return j.progress + '%'; } },
                    { h: 'Tim', cell: function (j) { return j.team.map(function (t) { return t.name; }).join(', ') || '-'; } },
                    { h: 'Aksi', cell: function (j) { return h('button', { class: 'btn danger sm', type: 'button', text: 'Hapus', onclick: function () { del(j); } }); } }
                ], r.jobs, q ? 'Tidak ada pekerjaan yang cocok.' : 'Belum ada pekerjaan.'));
                $('#count').textContent = r.jobs.length + ' pekerjaan ditampilkan (maks. 200, terbaru dulu)';
            }).catch(fail);
        }

        function del(j) {
            modal({
                title: 'Hapus pekerjaan ' + j.prod,
                intro: '"' + j.work + '" (' + j.status + ', ' + j.progress + '%) dihapus permanen beserta daftar timnya. Riwayat status-nya tetap tersimpan. Kalau berasal dari picklist, barisnya jadi "belum diplan" lagi.',
                fields: [{ name: 'reason', label: 'Alasan (wajib, tercatat di Log Aktivitas)', type: 'textarea', required: true }],
                ok: 'Hapus pekerjaan', danger: true
            }).then(function (v) {
                if (!v) return;
                api('/api/admin/work-orders/' + encodeURIComponent(j.prod), 'DELETE', { reason: v.reason })
                    .then(function () { toast('Pekerjaan dihapus.'); load(); }).catch(fail);
            });
        }

        $('#q').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(load, 300); });
        load();
    }

    /* ================= Log Aktivitas ================= */
    var ACT_KIND = { login: 'ok', login_failed: 'bad', login_blocked: 'bad', logout: 'gray', user_delete: 'bad', work_order_delete: 'bad', picklist_delete: 'bad' };

    function pageAudit() {
        var host = $('#tbl');
        var rowsAll = [];
        var labels = {};
        var lastId = null;

        function query(before) {
            var p = [];
            [['from', '#f_from'], ['to', '#f_to'], ['nik', '#f_nik'], ['action', '#f_action'], ['q', '#f_q']].forEach(function (x) {
                var v = $(x[1]).value.trim();
                if (v) p.push(x[0] + '=' + encodeURIComponent(v));
            });
            if (before) p.push('before_id=' + before);
            p.push('limit=50');
            return '/api/admin/audit?' + p.join('&');
        }

        function draw(more) {
            host.textContent = '';
            host.appendChild(table([
                { h: 'Waktu', cls: 'nowrap', cell: function (l) { return l.at; } },
                { h: 'Pengguna', cell: function (l) { return l.nik ? (l.name ? l.name + '  ·  ' : '') + l.nik + (l.role ? ' (' + l.role + ')' : '') : '-'; } },
                { h: 'Aksi', cell: function (l) { return badge(labels[l.action] || l.action, ACT_KIND[l.action] || 'blue'); } },
                { h: 'Keterangan', cls: 'msg', cell: function (l) { return l.description || '-'; } },
                { h: 'IP', cls: 'nowrap', cell: function (l) { return l.ip || '-'; } }
            ], rowsAll, 'Tidak ada aktivitas yang cocok dengan filter.'));
            if (more) {
                host.appendChild(h('div', { class: 'actions', style: 'padding:0 20px 16px' }, h('button', {
                    class: 'btn ghost', type: 'button', text: 'Muat lebih banyak',
                    onclick: function (e) { busy(e.target, function () { return load(true); }); }
                })));
            }
        }

        function load(append) {
            return api(query(append ? lastId : null)).then(function (r) {
                if (!append) {
                    rowsAll = [];
                    labels = r.actions || labels;
                    if (r.actions && $('#f_action').options.length <= 1) {
                        Object.keys(r.actions).forEach(function (k) { $('#f_action').appendChild(h('option', { value: k, text: r.actions[k] })); });
                    }
                    var s = r.summary;
                    var sb = $('#stats');
                    sb.textContent = '';
                    sb.appendChild(stat('Login hari ini', s.logins_today, s.users_today + ' pengguna berbeda'));
                    sb.appendChild(stat('Login gagal hari ini', s.failed_today, '', s.failed_today > 0 ? 'warn' : ''));
                    sb.appendChild(stat('Aksi admin hari ini', s.admin_today, 'akun, hapus data, pengaturan SAP'));
                }
                rowsAll = rowsAll.concat(r.logs);
                lastId = rowsAll.length ? rowsAll[rowsAll.length - 1].id : null;
                draw(r.has_more);
            }).catch(fail);
        }

        $('#applyBtn').addEventListener('click', function () { load(false); });
        $('#f_q').addEventListener('keydown', function (e) { if (e.key === 'Enter') load(false); });
        load(false);
    }

    /* ================= mulai ================= */
    function start() {
        initShell();
        var page = document.body.getAttribute('data-page');
        var fn = { sap: pageSap, akun: pageAkun, data: pageData, audit: pageAudit }[page];
        if (fn) fn();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
