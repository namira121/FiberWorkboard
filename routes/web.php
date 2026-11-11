<?php

use App\Http\Controllers\AdminDataController;
use App\Http\Controllers\AuditController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\LogController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\SapController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WorkOrderController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PageController::class, 'home']);
Route::get('/login', [PageController::class, 'login'])->name('login');

// Alamat lama (.html) diarahkan ke alamat baru, supaya bookmark / aplikasi di layar utama HP tetap jalan.
$legacy = [
    '/Login.html'                       => '/login',
    '/Leader/dashboard-lead.html'       => '/leader/dashboard',
    '/Leader/karyawan.html'             => '/leader/karyawan',
    '/Leader/riwayat.html'              => '/leader/riwayat',
    '/Leader/scanpicklist.html'         => '/leader/scan',
    '/Public/dashboard-public.html'     => '/public/dashboard',
    '/Public/riwayat.html'              => '/public/riwayat',
    '/Admin/akun.html'                  => '/admin/akun',
    '/Admin/data.html'                  => '/admin/data',
    '/Admin/audit.html'                 => '/admin/audit',
];
foreach ($legacy as $old => $new) {
    Route::get($old, [PageController::class, 'legacy'])->defaults('to', $new);
}
Route::post('/api/login', [AuthController::class, 'login']);

Route::middleware('auth')->group(function () {
    Route::post('/api/logout', [AuthController::class, 'logout']);
    Route::get('/api/me', [AuthController::class, 'me']);

    /* ---- Leader & Public ---- */
    Route::get('/api/employees', [EmployeeController::class, 'index']);
    Route::get('/api/work-orders', [WorkOrderController::class, 'index']);
    Route::post('/api/work-orders', [WorkOrderController::class, 'store']);
    Route::patch('/api/work-orders/{prod}/progress', [WorkOrderController::class, 'progress']);
    Route::post('/api/work-orders/{prod}/hold', [WorkOrderController::class, 'hold']);
    Route::get('/api/logs', [LogController::class, 'index']);

    /* ---- hanya Leader (superadmin otomatis boleh) ---- */
    Route::middleware('role:leader')->group(function () {
        Route::get('/leader/{page}', [PageController::class, 'leader'])
            ->where('page', 'dashboard|karyawan|riwayat|scan');

        Route::post('/api/employees', [EmployeeController::class, 'store']);
        Route::put('/api/employees/{nik}', [EmployeeController::class, 'update']);
        Route::delete('/api/employees/{nik}', [EmployeeController::class, 'destroy']);

        Route::put('/api/work-orders/{prod}', [WorkOrderController::class, 'update']);
        Route::put('/api/work-orders/{prod}/target', [WorkOrderController::class, 'target']);
        // detail satu Prod. Order dari SAP (tombol "Tampilkan detail" di dashboard)
        Route::get('/api/sap/prod-order/{prod}', [SapController::class, 'prodOrder'])->middleware('throttle:60,1');

        Route::post('/api/work-orders/{prod}/reactivate', [WorkOrderController::class, 'reactivate']);
        Route::post('/api/work-orders/{prod}/detail', [WorkOrderController::class, 'detail'])->middleware('throttle:60,1');
        Route::post('/api/work-orders/{prod}/link', [WorkOrderController::class, 'link']);
        Route::post('/api/work-orders/{prod}/members', [WorkOrderController::class, 'addMember']);
        Route::delete('/api/work-orders/{prod}/members/{nik}', [WorkOrderController::class, 'removeMember']);
    });

    /* ---- hanya Public (superadmin otomatis boleh) ---- */
    Route::middleware('role:public')->group(function () {
        Route::get('/public/{page}', [PageController::class, 'pub'])
            ->where('page', 'dashboard|riwayat');
    });

    /* ---- HANYA superadmin ---- */
    Route::middleware('role:superadmin')->group(function () {
        Route::get('/admin/{page}', [PageController::class, 'admin'])
            ->where('page', 'akun|data|audit');

        // kelola akun login
        Route::get('/api/admin/users', [UserController::class, 'index']);
        Route::post('/api/admin/users', [UserController::class, 'store']);
        Route::put('/api/admin/users/{id}', [UserController::class, 'update'])->whereNumber('id');
        Route::post('/api/admin/users/{id}/password', [UserController::class, 'resetPassword'])->whereNumber('id');
        Route::post('/api/admin/users/{id}/logout', [UserController::class, 'forceLogout'])->whereNumber('id');
        Route::delete('/api/admin/users/{id}', [UserController::class, 'destroy'])->whereNumber('id');

        // log aktivitas / audit
        Route::get('/api/admin/audit', [AuditController::class, 'index']);

        // hapus pekerjaan
        Route::get('/api/admin/work-orders', [AdminDataController::class, 'workOrders']);
        Route::delete('/api/admin/work-orders/{prod}', [AdminDataController::class, 'destroyWorkOrder']);
    });
});
