<?php

namespace App\Http\Controllers;

use App\Exceptions\BusinessRuleException;
use App\Models\Employee;
use App\Support\Viber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EmployeeController extends Controller
{
    private function find(string $nik): Employee
    {
        return Employee::where('nik', $nik)->first() ?? throw new BusinessRuleException('Karyawan tidak ditemukan.', 404);
    }

    private function row(Employee $e): array
    {
        return ['nik' => $e->nik, 'name' => $e->name, 'bagian' => $e->bagian];
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'ok'        => true,
            'employees' => Employee::orderBy('name')->get()->map(fn ($e) => $this->row($e))->values(),
        ]);
    }

    public function store(Request $r): JsonResponse
    {
        $d = $r->validate([
            'nik'    => 'required|string|max:30|unique:employees,nik',
            'name'   => 'required|string|max:100',
            'bagian' => ['nullable', Rule::in(Viber::BAGIAN)],
        ], Viber::MESSAGES, Viber::ATTRIBUTES);

        return response()->json(['ok' => true, 'employee' => $this->row(Employee::create($d))], 201);
    }

    public function update(Request $r, string $nik): JsonResponse
    {
        $e = $this->find($nik);
        $d = $r->validate([
            'name'   => 'required|string|max:100',
            'bagian' => ['nullable', Rule::in(Viber::BAGIAN)],
        ], Viber::MESSAGES, Viber::ATTRIBUTES);

        $e->update($d);

        return response()->json(['ok' => true, 'employee' => $this->row($e)]);
    }

    public function destroy(string $nik): JsonResponse
    {
        $e = $this->find($nik);

        if ($e->workOrders()->exists()) {
            throw new BusinessRuleException('Karyawan masih tercatat di pekerjaan, tidak bisa dihapus.', 409);
        }
        $e->delete();

        return response()->json(['ok' => true]);
    }
}
