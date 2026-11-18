<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     */
    public function test_guests_are_redirected_to_login(): void
    {
        $response = $this->get('/');

        $response->assertRedirect('/login');
    }

    public function test_login_page_is_served_without_runtime_css_cdn(): void
    {
        $response = $this->get('/login');

        $response
            ->assertOk()
            ->assertSee('Masuk')
            ->assertDontSee('cdn.tailwindcss.com');
    }
}
