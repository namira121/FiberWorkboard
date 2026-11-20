@php
    $u = auth()->user();
    $profileName = $u->name ?: $u->nik;
    $profileRole = ['superadmin' => 'Superadmin', 'leader' => 'Leader', 'public' => 'Public'][$u->role] ?? ucfirst($u->role);
@endphp
<style>
    .profile-wrap{margin-left:auto;position:relative}
    .profile{display:flex;align-items:center;gap:10px;padding:4px 10px 4px 4px;border:0;border-radius:999px;background:none;font:inherit;text-align:left;cursor:pointer}
    .profile:hover,.profile-wrap.open .profile{background:#f1f6fa}
    .profile-avatar{width:34px;height:34px;border-radius:50%;background:#e6f0f7;color:#0f5e82;display:grid;place-items:center;flex-shrink:0}
    .profile-text{display:flex;flex-direction:column;line-height:1.25;min-width:0}
    .profile-name{font-size:13px;font-weight:600;color:#1b2a38;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .profile-role{font-size:11px;color:var(--muted,#7b8794)}
    .profile-chev{color:var(--muted,#7b8794);transition:transform .15s;flex-shrink:0}
    .profile-wrap.open .profile-chev{transform:rotate(180deg)}
    .profile-menu{display:none;position:absolute;right:0;top:calc(100% + 8px);min-width:210px;padding:6px;background:#fff;border:1px solid var(--line,#e3ebf2);border-radius:12px;box-shadow:0 10px 30px rgba(15,40,70,.14);z-index:60}
    .profile-wrap.open .profile-menu{display:block}
    .profile-menu-head{padding:8px 10px 10px;margin-bottom:6px;border-bottom:1px solid #eef2f6}
    .profile-menu-head strong{display:block;font-size:13px;color:#1b2a38;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .profile-menu-head small{font-size:11px;color:var(--muted,#7b8794)}
    .profile-logout{width:100%;display:flex;align-items:center;gap:10px;padding:9px 10px;border:0;border-radius:8px;background:none;font:inherit;font-size:13px;font-weight:600;color:#c0392b;cursor:pointer}
    .profile-logout:hover{background:#fdecea}
    @media (max-width:480px){.profile-text{display:none}}
</style>
<div class="profile-wrap" id="profileWrap">
    <button type="button" class="profile" id="profileBtn" aria-haspopup="true" aria-expanded="false" title="{{ $profileName }} ({{ $profileRole }})">
        <span class="profile-avatar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </span>
        <span class="profile-text">
            <strong class="profile-name">{{ $profileName }}</strong>
            <small class="profile-role">{{ $profileRole }}</small>
        </span>
        <svg class="profile-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <div class="profile-menu" role="menu">
        <div class="profile-menu-head">
            <strong>{{ $profileName }}</strong>
            <small>{{ $profileRole }}</small>
        </div>
        <button type="button" class="profile-logout" id="logoutBtn" role="menuitem">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
            Log out
        </button>
    </div>
</div>
<script>
(function () {
    var wrap = document.getElementById('profileWrap'), btn = document.getElementById('profileBtn');
    if (!wrap || !btn) return;
    function setOpen(o) { wrap.classList.toggle('open', o); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!wrap.classList.contains('open')); });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
})();
</script>