<?php

namespace App\Enums;

enum UserRole: string
{
    case CA = 'ca';
    case Staff = 'staff';

    public function label(): string
    {
        return match ($this) {
            UserRole::CA => 'CA / Admin',
            UserRole::Staff => 'Staff Member',
        };
    }
}