        /* Verifikasi NIK & password dilakukan di server (POST /api/login).
           Kalau benar, server menyimpan token perangkat di cookie -> login cukup sekali per HP.
           Akun diatur di data/accounts.json (lihat tambah-akun.js). */

        const errorBox = document.getElementById('loginError');

        function showError(message) {
            errorBox.textContent = message;
            errorBox.classList.remove('hidden');
        }

        function hideError() {
            errorBox.classList.add('hidden');
        }

        document.getElementById('nik').addEventListener('input', hideError);
        document.getElementById('password').addEventListener('input', hideError);

        // Toggle Show/Hide Password
        function togglePasswordVisibility() {
            const passwordInput = document.getElementById('password');
            const toggleBtn = document.getElementById('togglePassword');

            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleBtn.textContent = 'Sembunyikan';
            } else {
                passwordInput.type = 'password';
                toggleBtn.textContent = 'Lihat';
            }
        }

        // Login Handler
        function handleLogin() {
            const nik = document.getElementById('nik').value.trim();
            const password = document.getElementById('password').value;
            const submitBtn = document.getElementById('submitBtn');
            const label = submitBtn.textContent;

            hideError();
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

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
        }
    
