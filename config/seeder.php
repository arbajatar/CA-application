<?php

use App\Enums\UserRole;

return [

    'users' => [
        ['name' => 'CA Admin', 'username' => 'ca_admin', 'password' => 'admin@123', 'role' => UserRole::CA],
        ['name' => 'Sarthak', 'username' => 'sarthak', 'password' => 'staff@123', 'role' => UserRole::Staff],
        ['name' => 'Sanket', 'username' => 'sanket', 'password' => 'staff@123', 'role' => UserRole::Staff],
        ['name' => 'Kalpesh', 'username' => 'kalpesh', 'password' => 'staff@123', 'role' => UserRole::Staff],
        ['name' => 'Pratik', 'username' => 'pratik', 'password' => 'staff@123', 'role' => UserRole::Staff],
        ['name' => 'Sachin', 'username' => 'sachin', 'password' => 'staff@123', 'role' => UserRole::Staff],
        ['name' => 'Prem', 'username' => 'prem', 'password' => 'staff@123', 'role' => UserRole::Staff],
    ],

    'work_types' => [
        'Income Tax Return (ITR)',
        'GST Registration (GST REG)',
        'GST Core Amendment',
        'Shop Act',
        'Shop Act / Udyam',
        'Partnership Deed',
        'PT Return',
        'PAN Correction',
        'PF / ESIC Registration',
        'Accounting',
    ],

    'clients' => [
        ['name' => 'Shakti Enterprises', 'contact' => '9876543210', 'gst_number' => '27AABCS1429B1Z1'],
        ['name' => 'Nikhil Satav', 'contact' => '9823456781', 'gst_number' => null],
        ['name' => 'Rohan Traders', 'contact' => '9812345670', 'gst_number' => '27AAPCS2012B1Z5'],
        ['name' => 'Priya Enterprises', 'contact' => '9745612380', 'gst_number' => null],
        ['name' => 'Mehta & Co.', 'contact' => '9934567821', 'gst_number' => '27AACPM1234C1Z3'],
        ['name' => 'Suresh Patil', 'contact' => '9856234701', 'gst_number' => null],
        ['name' => 'Sunrise Industries', 'contact' => '9765432109', 'gst_number' => '27AACKS4567D1Z7'],
        ['name' => 'Deepak Motors', 'contact' => '9643218705', 'gst_number' => null],
    ],

    'tasks' => [
        ['client' => 'Shakti Enterprises', 'work_type' => 'Income Tax Return (ITR)', 'allocated_to' => 'sarthak', 'date_inward' => '2024-03-01', 'date_allocated' => '2024-03-01', 'status' => 'completed', 'date_completed' => '2024-03-10', 'remarks' => null],
        ['client' => 'Nikhil Satav', 'work_type' => 'GST Registration (GST REG)', 'allocated_to' => 'kalpesh', 'date_inward' => '2024-03-05', 'date_allocated' => '2024-03-05', 'status' => 'in_progress', 'date_completed' => null, 'remarks' => 'Processing'],
        ['client' => 'Rohan Traders', 'work_type' => 'Shop Act', 'allocated_to' => 'sarthak', 'date_inward' => '2024-03-08', 'date_allocated' => '2024-03-08', 'status' => 'assigned', 'date_completed' => null, 'remarks' => null],
        ['client' => 'Priya Enterprises', 'work_type' => 'Partnership Deed', 'allocated_to' => 'kalpesh', 'date_inward' => '2024-03-10', 'date_allocated' => '2024-03-10', 'status' => 'awaiting_information', 'date_completed' => null, 'remarks' => 'Awaiting partner details'],
        ['client' => 'Mehta & Co.', 'work_type' => 'PT Return', 'allocated_to' => 'sanket', 'date_inward' => '2024-03-12', 'date_allocated' => '2024-03-12', 'status' => 'completed', 'date_completed' => '2024-03-18', 'remarks' => null],
        ['client' => 'Suresh Patil', 'work_type' => 'PAN Correction', 'allocated_to' => 'pratik', 'date_inward' => '2024-03-14', 'date_allocated' => '2024-03-14', 'status' => 'in_progress', 'date_completed' => null, 'remarks' => 'Light bill problem'],
        ['client' => 'Sunrise Industries', 'work_type' => 'Accounting', 'allocated_to' => 'sachin', 'date_inward' => '2024-03-15', 'date_allocated' => '2024-03-15', 'status' => 'assigned', 'date_completed' => null, 'remarks' => null],
        ['client' => 'Deepak Motors', 'work_type' => 'GST Core Amendment', 'allocated_to' => 'kalpesh', 'date_inward' => '2024-03-16', 'date_allocated' => '2024-03-16', 'status' => 'completed', 'date_completed' => '2024-03-20', 'remarks' => null],
        ['client' => 'Shakti Enterprises', 'work_type' => 'PF / ESIC Registration', 'allocated_to' => 'prem', 'date_inward' => '2024-03-18', 'date_allocated' => '2024-03-18', 'status' => 'assigned', 'date_completed' => null, 'remarks' => null],
        ['client' => 'Nikhil Satav', 'work_type' => 'Income Tax Return (ITR)', 'allocated_to' => 'sarthak', 'date_inward' => '2024-03-20', 'date_allocated' => '2024-03-20', 'status' => 'in_progress', 'date_completed' => null, 'remarks' => null],
    ],

];