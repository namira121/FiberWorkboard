<?php

namespace App\Http\Controllers;

use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\PageSetup;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class ExportController extends Controller
{
    /**
     * POST /api/export/plan
     * Body: { date: 'YYYY-MM-DD'|'', jobs: [{ prod: '...' }, ...] }
     *
     * Dipanggil LeaderTools.exportPlan() dari dashboard dan riwayat. Daftar Prod. Order
     * diambil dari baris yang sedang tampil; datanya dibaca ulang dari database.
     * Hasil: lembar "Plan Karyawan" (No / Nama / Pekerjaan / Jumlah / Keterangan),
     * satu blok per karyawan, satu baris per pekerjaan.
     */
    public function plan(Request $request)
    {
        $data = $request->validate([
            'date'        => ['nullable', 'date_format:Y-m-d'],
            'jobs'        => ['required', 'array', 'min:1', 'max:2000'],
            'jobs.*.prod' => ['required', 'string', 'max:50'],
        ], [
            'jobs.required' => 'Tidak ada pekerjaan untuk di-export.',
            'jobs.min'      => 'Tidak ada pekerjaan untuk di-export.',
            'jobs.max'      => 'Terlalu banyak pekerjaan. Persempit filter dulu.',
        ]);

        $prods  = collect($data['jobs'])->pluck('prod')->unique()->values();
        $orders = WorkOrder::with('employees')->whereIn('prod_order', $prods)->orderBy('prod_order')->get();

        // kelompokkan per karyawan
        $byEmployee = [];
        $noTeam = [];
        foreach ($orders as $w) {
            $job = ['work' => (string) $w->work, 'qty' => (string) $w->qty];
            if ($w->employees->isEmpty()) {
                $noTeam[] = $job;
                continue;
            }
            foreach ($w->employees as $e) {
                $byEmployee[$e->nik]['name'] = $e->name;
                $byEmployee[$e->nik]['jobs'][] = $job;
            }
        }
        usort($byEmployee, fn ($a, $b) => strcasecmp($a['name'], $b['name']));

        $blocks = array_values($byEmployee);
        if ($noTeam) {
            $blocks[] = ['name' => '(belum ada tim)', 'jobs' => $noTeam, 'noNumber' => true];
        }

        $spreadsheet = $this->build($blocks, $data['date'] ?? '');

        return response()->streamDownload(function () use ($spreadsheet) {
            (new Xlsx($spreadsheet))->save('php://output');
        }, 'plan-karyawan.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    private function build(array $blocks, string $date): Spreadsheet
    {
        $ss = new Spreadsheet();
        $sh = $ss->getActiveSheet();
        $sh->setTitle('Plan Karyawan');

        $str = fn (string $cell, string $v) => $sh->setCellValueExplicit($cell, $v, DataType::TYPE_STRING);

        // judul + tanggal
        $str('A1', 'Plan Karyawan - Section Fiber');
        $sh->getStyle('A1')->getFont()->setBold(true)->setSize(16);
        $str('A2', 'Tanggal: ' . ($date !== '' ? Carbon::createFromFormat('Y-m-d', $date)->format('d/m/Y') : 'Semua tanggal'));
        $sh->getStyle('A2')->getFont()->getColor()->setRGB('666666');

        // header tabel (baris 4)
        foreach (['A' => 'No', 'B' => 'Nama', 'C' => 'Pekerjaan', 'D' => 'Jumlah', 'E' => 'Keterangan'] as $col => $label) {
            $str($col . '4', $label);
        }
        $sh->getStyle('A4:E4')->applyFromArray([
            'font'      => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '0F5E82']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sh->getRowDimension(4)->setRowHeight(22);

        // isi: satu blok per karyawan
        $r = 5;
        $no = 1;
        foreach ($blocks as $b) {
            foreach ($b['jobs'] as $i => $job) {
                if ($i === 0) {
                    if (! empty($b['noNumber'])) {
                        $str('A' . $r, '-');
                    } else {
                        $sh->setCellValueExplicit('A' . $r, $no++, DataType::TYPE_NUMERIC);
                    }
                    $str('B' . $r, $b['name']);
                }
                $str('C' . $r, '• ' . $job['work']);
                $str('D' . $r, $job['qty']);
                $r++;
            }
            // garis tipis pemisah antar karyawan
            $sh->getStyle('A' . ($r - 1) . ':E' . ($r - 1))->getBorders()->getBottom()
                ->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB('D9D9D9');
        }
        $last = max($r - 1, 5);

        $body = $sh->getStyle("A5:E{$last}");
        $body->getAlignment()->setVertical(Alignment::VERTICAL_TOP)->setWrapText(true);
        $sh->getStyle("A5:A{$last}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sh->getStyle("D5:D{$last}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        foreach (['A' => 6, 'B' => 30, 'C' => 52, 'D' => 12, 'E' => 26] as $col => $w) {
            $sh->getColumnDimension($col)->setWidth($w);
        }
        $sh->freezePane('A5');

        // siap print: A4 portrait, muat 1 halaman lebar, header tabel diulang
        $sh->getPageSetup()->setPaperSize(PageSetup::PAPERSIZE_A4)->setOrientation(PageSetup::ORIENTATION_PORTRAIT);
        $sh->getPageSetup()->setFitToWidth(1)->setFitToHeight(0);
        $sh->getPageSetup()->setRowsToRepeatAtTopByStartAndEnd(4, 4);
        $sh->getPageMargins()->setLeft(0.4)->setRight(0.4);

        return $ss;
    }
}
