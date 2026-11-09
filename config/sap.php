<?php

/**
 * Koneksi API SAP. Semua nilai diisi lewat .env (jangan tulis password / API key di file ini).
 * Setelah mengubah .env jalankan: php artisan config:clear
 */
return [
    'base_url'       => env('SAP_BASE_URL', ''),
    'endpoint'       => env('SAP_ENDPOINT', ''),          // boleh pakai {prod}, mis. /ProdOrder('{prod}')
    'query'          => env('SAP_QUERY', ''),             // boleh pakai {prod}, mis. $filter=ProdOrder eq '{prod}'&$format=json

    // basic | bearer | apikey | none
    'auth_type'      => env('SAP_AUTH_TYPE', 'basic'),
    'username'       => env('SAP_USERNAME', ''),          // hanya untuk basic
    'password'       => env('SAP_PASSWORD', ''),          // password (basic) / token (bearer) / API key (apikey)
    'api_key_header' => env('SAP_API_KEY_HEADER', 'X-API-Key'),

    'timeout'        => (int) env('SAP_TIMEOUT', 20),
    'verify_ssl'     => filter_var(env('SAP_VERIFY_SSL', true), FILTER_VALIDATE_BOOLEAN),

    // lokasi daftar baris di JSON balasan SAP (notasi titik). OData v2 = d.results, OData v4 = value
    'data_path'      => env('SAP_DATA_PATH', 'd.results'),

    // nama field di JSON SAP untuk tiap kolom di aplikasi
    'map' => [
        'prod_order'    => env('SAP_MAP_PROD_ORDER', 'ProdOrder'),
        'material_no'   => env('SAP_MAP_MATERIAL', 'Material'),
        'material_desc' => env('SAP_MAP_DESC', 'MaterialDescription'),
        'so_number'     => env('SAP_MAP_SO', 'SalesOrder'),
        'work'          => env('SAP_MAP_WORK', 'OperationText'),
        'qty'           => env('SAP_MAP_QTY', 'Quantity'),
    ],
];