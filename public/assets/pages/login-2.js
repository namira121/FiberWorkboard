        /* Verifikasi NIK & password dilakukan di server (POST /api/login). */

        const errorBox = document.getElementById('loginError');
        const form = document.getElementById('loginForm');
        const nikInput = document.getElementById('nik');
        const passwordInput = document.getElementById('password');
        const submitBtn = document.getElementById('submitBtn');

        function showError(message) {
            errorBox.textContent = message;
            errorBox.classList.remove('hidden');
            form.setAttribute('aria-busy', 'false');
        }

        function hideError() {
            errorBox.classList.add('hidden');
        }

        nikInput.addEventListener('input', hideError);
        passwordInput.addEventListener('input', hideError);

        // Toggle show/hide password.
        function togglePasswordVisibility() {
            const toggleBtn = document.getElementById('togglePassword');
            const show = passwordInput.type === 'password';

            passwordInput.type = show ? 'text' : 'password';
            toggleBtn.textContent = show ? 'Sembunyikan' : 'Lihat';
            toggleBtn.setAttribute('aria-pressed', String(show));
            toggleBtn.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
            passwordInput.focus();
        }
        document.getElementById('togglePassword').addEventListener('click', togglePasswordVisibility);

        // Login handler.
        function handleLogin() {
            const nik = nikInput.value.trim();
            const password = passwordInput.value;
            const label = submitBtn.textContent;

            hideError();
            form.setAttribute('aria-busy', 'true');
            submitBtn.textContent = 'Memproses...';
            submitBtn.disabled = true;

            fetch('/api/login', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nik, password })
            })
                .then(r => r.json().catch(() => ({ ok: false })))
                .then(j => {
                    if (j && j.ok) { window.location.replace(j.redirect); return; }
                    showError((j && j.error) || 'Login gagal. Silakan coba lagi.');
                    submitBtn.textContent = label;
                    submitBtn.disabled = false;
                })
                .catch(() => {
                    showError('Tidak bisa terhubung ke server. Periksa WiFi / jaringan.');
                    submitBtn.textContent = label;
                    submitBtn.disabled = false;
                });
        }

        form.addEventListener('submit', event => {
            event.preventDefault();
            handleLogin();
        });

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
        }
    
