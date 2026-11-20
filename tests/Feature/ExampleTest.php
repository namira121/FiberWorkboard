<?php

namespace Tests\Feature;

use Tests\TestCase;

class ExampleTest extends TestCase
{
    public function test_halaman_utama_mengarahkan_tamu_ke_login(): void
    {
        $this->get('/')->assertRedirect('/login');
    }
}