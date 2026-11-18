@php
    $roleLabel = match (auth()->user()?->role) {
        'superadmin' => 'Superadmin',
        'leader' => 'Leader',
        'public' => 'Public',
        default => 'Pengguna',
    };
    $resolvedParentHref = $parentHref
        ?? (isset($parentPage) ? \App\Support\Workspace::url($parentPage) : null);
@endphp
<span class="crumb">
    {{ $roleLabel }} /
    @if (! empty($parent) && ! empty($resolvedParentHref))
        <a href="{{ $resolvedParentHref }}">{{ $parent }}</a> /
    @endif
    <strong>{{ $title }}</strong>
</span>
