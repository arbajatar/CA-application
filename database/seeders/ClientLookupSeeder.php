<?php

namespace Database\Seeders;

use App\Models\ClientGroup;
use App\Models\ClientType;
use Illuminate\Database\Seeder;

class ClientLookupSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $types = [
            ['name' => 'Individual', 'pan_char' => 'P'],
            ['name' => 'Sole Proprietorship', 'pan_char' => 'P'],
            ['name' => 'Partnership Firm', 'pan_char' => 'F'],
            ['name' => 'LLP', 'pan_char' => 'F'],
            ['name' => 'HUF', 'pan_char' => 'H'],
            ['name' => 'Private Limited', 'pan_char' => 'C'],
            ['name' => 'Limited Company', 'pan_char' => 'C'],
            ['name' => 'Joint-Venture Company', 'pan_char' => 'C'],
            ['name' => 'One Person Company', 'pan_char' => 'C'],
            ['name' => 'NGO', 'pan_char' => 'T'],
            ['name' => 'Trust', 'pan_char' => 'T'],
            ['name' => 'Section 8 Company', 'pan_char' => 'C'],
            ['name' => 'Government Entity', 'pan_char' => 'G'],
            ['name' => 'Co-operative Society', 'pan_char' => 'B'],
            ['name' => 'Branch Office', 'pan_char' => 'C'],
            ['name' => 'AOP', 'pan_char' => 'A'],
            ['name' => 'Society', 'pan_char' => 'B'],
            ['name' => 'Artificial Juridical Person', 'pan_char' => 'J'],
            ['name' => 'Body of Individual', 'pan_char' => 'B'],
        ];

        foreach ($types as $t) {
            ClientType::updateOrCreate(['name' => $t['name']], $t);
        }

        $groups = [
            'Salary',
            'Business',
            'Company',
            'Salary- 2027',
            'AOP',
            'BUSINESS CLIENT (INDIVIDUAL)',
            'CA MAHESH BHUTADA OWN (MPPB)',
            'COMPANY- CA MPPB',
            'COMPANY/LLP - RUSHABH DESAI',
            '1. CONFIRM CLIENT 2027 SALARY',
            '2. DOUBTFUL CLIENT 2027 SALARY',
            '3. NO MORE CLIENT 2027 SALARY',
        ];

        foreach ($groups as $g) {
            ClientGroup::updateOrCreate(['name' => $g]);
        }
    }
}
