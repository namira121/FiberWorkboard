<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\LogController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\WorkOrderController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PageController::class, 'home']);
Route::get('/Login.html', [PageController::class, 'login'])->name('login');
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

    /* ---- hanya Leader ---- */
    Route::middleware('role:leader')->group(function () {
        Route::get('/Leader/{page}', [PageController::class, 'leader'])
            ->where('page', '(dashboard-lead|karyawan|riwayat|scanpicklist)\.html');

        Route::post('/api/employees', [EmployeeController::class, 'store']);
        Route::put('/api/employees/{nik}', [EmployeeController::class, 'update']);
        Route::delete('/api/employees/{nik}', [EmployeeController::class, 'destroy']);

        Route::put('/api/work-orders/{prod}', [WorkOrderController::class, 'update']);
        Route::put('/api/work-orders/{prod}/target', [WorkOrderController::class, 'target']);
        Route::post('/api/work-orders/{prod}/reactivate', [WorkOrderController::class, 'reactivate']);
        Route::post('/api/work-orders/{prod}/members', [WorkOrderController::class, 'addMember']);
        Route::delete('/api/work-orders/{prod}/members/{nik}', [WorkOrderController::class, 'removeMember']);
    });

    /* ---- hanya Public ---- */
    Route::middleware('role:public')->group(function () {
        Route::get('/Public/{page}', [PageController::class, 'pub'])
            ->where('page', '(dashboard-public|riwayat)\.html');
    });
});
