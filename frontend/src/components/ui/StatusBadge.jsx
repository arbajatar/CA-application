const config = {
    assigned: { label: 'Assigned', class: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    in_progress: { label: 'In Progress', class: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
    awaiting_information: { label: 'Awaiting Information', class: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
    completed: { label: 'Completed', class: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
    active: { label: 'Active', class: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
    inactive: { label: 'Inactive', class: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
}

export default function StatusBadge({ status, iconOnly = false }) {
    const s = config[status] ?? { label: status, class: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }

    if (iconOnly) {
        return <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} title={s.label} />
    }

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.class}`}>
            {s.label}
        </span>
    )
}