<?php

namespace App\Providers;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191);

        // Convert query parameter 'token' to 'Authorization' header for download/direct access routes
        if (request()->has('token') && !request()->headers->has('Authorization')) {
            request()->headers->set('Authorization', 'Bearer ' . request()->query('token'));
        }
    }
}
