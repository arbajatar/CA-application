<?php

namespace App\Enums;

enum UserRole: string
{
    case CA = 'ca';
    case Staff = 'staff';
    case SuperAdmin = 'super_admin';

    public function label(): string
    {
        return match ($this) {
            UserRole::CA => 'CA / Admin',
            UserRole::Staff => 'Staff Member',
            UserRole::SuperAdmin => 'Super Admin',
        };
    }
}