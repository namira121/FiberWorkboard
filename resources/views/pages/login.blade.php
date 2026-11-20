@extends('layouts.bare')

@section('title', 'Login - New Armada')

@push('head')
<link rel="stylesheet" href="@v('assets/pages/login.css')">
@endpush

@section('body_class', 'login-page')

@section('content')
@verbatim
    <main class="login-main">

        <!-- Logo Section -->
        <div class="flex flex-col items-center mb-6">
            <img src="/assets/images/logo-login-armada.png" alt="Logo New Armada" class="login-logo" draggable="false">
        </div>

        <section class="login-card" aria-labelledby="loginTitle">
            <div class="login-card-head">
                <h1 id="loginTitle">Masuk</h1>
                <p>Gunakan NIK dan password yang terdaftar. Sesi dapat berakhir setelah tidak aktif.</p>
            </div>

            <form id="loginForm" class="login-form">
                <div id="loginError" role="alert" class="login-error hidden"></div>

                <div class="login-field">
                    <label for="nik">NIK</label>
                    <div class="login-control">
                        <span class="login-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path>
                            </svg>
                        </span>
                        <input
                            type="text"
                            id="nik"
                            name="nik"
                            placeholder="Masukkan NIK"
                            required
                            autocapitalize="off"
                            autocomplete="username"
                            spellcheck="false"
                            class="login-input"
                        >
                    </div>
                </div>

                <div class="login-field">
                    <label for="password">Password</label>
                    <div class="login-control">
                        <span class="login-icon login-icon-password" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="12" r="8"/>
                            </svg>
                        </span>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            placeholder="Masukkan password"
                            required
                            autocomplete="current-password"
                            class="login-input login-input-password"
                        >
                        <button
                            type="button"
                            id="togglePassword"
                            class="login-toggle"
                            aria-label="Tampilkan password"
                            aria-pressed="false"
                        >Lihat</button>
                    </div>
                </div>

                <button type="submit" id="submitBtn" class="login-submit">Masuk</button>
            </form>

            <p class="login-note">Gunakan akun yang diberikan Leader atau Superadmin.</p>
        </section>
    </main>

    <footer class="login-footer">
        <div class="login-footer-brand">
            <img src="/assets/images/armada-logo-horizontal.png"
                 alt="New Armada"
                 class="login-footer-logo"
                 draggable="false">
            <span aria-hidden="true">|</span>
            <span>Portal Internal Section Viber</span>
        </div>
        <div>&copy; 2026 PT Mekar Armada Jaya.</div>
    </footer>
@endverbatim
@endsection

@push('scripts')
<script src="@v('assets/pages/login-2.js')"></script>
@endpush
