const config = {
    assigned: { label: 'Assigned', class: 'bg-blue-100 text-blue-700' },
    in_progress: { label: 'In Progress', class: 'bg-orange-100 text-orange-700' },
    awaiting_information: { label: 'Awaiting Information', class: 'bg-yellow-100 text-yellow-700' },
    completed: { label: 'Completed', class: 'bg-green-100 text-green-700' },
    active: { label: 'Active', class: 'bg-green-100 text-green-700' },
    inactive: { label: 'Inactive', class: 'bg-red-100 text-red-700' },
}

export default function StatusBadge({ status }) {
    const s = config[status] ?? { label: status, class: 'bg-gray-100 text-gray-600' }
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.class}`}>
            {s.label}
        </span>
    )
}