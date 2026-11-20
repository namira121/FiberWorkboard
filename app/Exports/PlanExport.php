<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Plan karyawan: 1 baris = 1 karyawan x 1 Prod. Order (nama, proses, target).
 */
class PlanExport extends DefaultValueBinder implements FromArray, WithHeadings, WithTitle, ShouldAutoSize, WithStyles, WithCustomValueBinder
{
    public function __construct(private array $rows)
    {
    }

    public function headings(): array
    {
        return ['Nama Karyawan', 'NIK', 'Bagian', 'Prod. Order', 'SO', 'Proses', 'Qty', 'Target (%)', 'Progress (%)', 'Status', 'Tanggal'];
    }

    public function array(): array
    {
        return $this->rows;
    }

    public function title(): string
    {
        return 'Plan Karyawan';
    }

    public function styles(Worksheet $sheet)
    {
        $sheet->freezePane('A2');

        return [1 => ['font' => ['bold' => true]]];
    }

    /**
     * Semua teks disimpan sebagai teks murni: NIK / nomor SO yang diawali 0 tidak
     * berubah jadi angka, dan isi yang diawali "=" tidak dibaca sebagai rumus Excel.
     */
    public function bindValue(Cell $cell, $value): bool
    {
        if (is_string($value)) {
            $cell->setValueExplicit($value, DataType::TYPE_STRING);

            return true;
        }

        return parent::bindValue($cell, $value);
    }
}
