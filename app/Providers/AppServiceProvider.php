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

        // Register real-time sync event listeners
        \App\Models\Client::saved(fn() => \App\Helpers\RealtimeHelper::trigger('clients_changed'));
        \App\Models\Client::deleted(fn() => \App\Helpers\RealtimeHelper::trigger('clients_changed'));
        
        \App\Models\ClientType::saved(fn() => \App\Helpers\RealtimeHelper::trigger('clients_changed'));
        \App\Models\ClientType::deleted(fn() => \App\Helpers\RealtimeHelper::trigger('clients_changed'));

        \App\Models\ClientGroup::saved(fn() => \App\Helpers\RealtimeHelper::trigger('clients_changed'));
        \App\Models\ClientGroup::deleted(fn() => \App\Helpers\RealtimeHelper::trigger('clients_changed'));

        \App\Models\User::saved(fn() => \App\Helpers\RealtimeHelper::trigger('staff_changed'));
        \App\Models\User::deleted(fn() => \App\Helpers\RealtimeHelper::trigger('staff_changed'));

        \App\Models\Task::saved(fn() => \App\Helpers\RealtimeHelper::trigger('tasks_changed'));
        \App\Models\Task::deleted(fn() => \App\Helpers\RealtimeHelper::trigger('tasks_changed'));

        \App\Models\SubTask::saved(fn() => \App\Helpers\RealtimeHelper::trigger('tasks_changed'));
        \App\Models\SubTask::deleted(fn() => \App\Helpers\RealtimeHelper::trigger('tasks_changed'));

        \App\Models\WorkType::saved(fn() => \App\Helpers\RealtimeHelper::trigger('tasks_changed'));
        \App\Models\WorkType::deleted(fn() => \App\Helpers\RealtimeHelper::trigger('tasks_changed'));
    }
}
