<?php

namespace App\Exceptions;

use RuntimeException;

/** Pelanggaran aturan bisnis -> dijawab JSON {ok:false, error:"..."} (bukan error 500). */
class BusinessRuleException extends RuntimeException
{
    public function __construct(string $message, private int $status = 422)
    {
        parent::__construct($message);
    }

    public function render($request)
    {
        return response()->json(['ok' => false, 'error' => $this->getMessage()], $this->status);
    }

    /** true = sudah ditangani, jangan dicatat sebagai error di log. */
    public function report(): bool
    {
        return true;
    }
}
