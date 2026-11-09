<?php

namespace App\Http\Controllers;

use App\Services\AuditService;
use App\Services\SapClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SapController extends Controller
{
    /** GET /api/sap/prod-order/{prod} : detail SATU Prod. Order dari SAP (tombol "Tampilkan detail"). */
    public function prodOrder(Request $r, SapClient $sap, string $prod): JsonResponse
    {
        if (! $sap->configured()) {
            return response()->json(['ok' => false, 'code' => 'not_configured', 'error' => 'Koneksi SAP belum diisi di server (.env).'], 503);
        }

        $data = $sap->prodOrder($prod);
        AuditService::record('sap_detail', "Ambil detail SAP untuk Prod. Order {$data['prod']}.", $r->user(), 'work_order', $data['prod']);

        return response()->json(['ok' => true, 'data' => $data]);
    }
}
