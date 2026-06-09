const config = {
    // New 8-status system for Daily Work Reports
    'DONE- COMPLETE 100%':      { label: 'DONE- COMPLETE 100%', class: 'bg-green-100 text-green-700 border border-green-200', dot: 'bg-green-500' },
    'DONE- PARTIALLY':          { label: 'DONE- PARTIALLY', class: 'bg-teal-100 text-teal-700 border border-teal-200', dot: 'bg-teal-500' },
    'PENDING- FOR WORKING':     { label: 'PENDING- FOR WORKING', class: 'bg-yellow-100 text-yellow-755 border border-yellow-200', dot: 'bg-yellow-500' },
    'PENDING- DUE TO DOCUMENT':  { label: 'PENDING- DUE TO DOCUMENT', class: 'bg-orange-100 text-orange-700 border border-orange-200', dot: 'bg-orange-500' },
    'PENDING- DUE TO CLIENT':    { label: 'PENDING- DUE TO CLIENT', class: 'bg-sky-100 text-sky-700 border border-sky-200', dot: 'bg-sky-500' },
    'PENDING- SENIOR CHECKING':  { label: 'PENDING- SENIOR CHECKING', class: 'bg-purple-100 text-purple-755 border border-purple-200', dot: 'bg-purple-500' },
    'PENDING- SOME REASON':      { label: 'PENDING- SOME REASON', class: 'bg-slate-100 text-slate-700 border border-slate-200', dot: 'bg-slate-500' },
    'NOT TO BE DONE':           { label: 'NOT TO BE DONE', class: 'bg-red-100 text-red-700 border border-red-200', dot: 'bg-red-500' },

    // Legacy statuses for backward compatibility
    complete:          { label: 'Complete',          class: 'bg-green-100 text-green-700',   dot: 'bg-green-500' },
    work_in_progress:  { label: 'Work In Progress',  class: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
    pending:           { label: 'Pending',            class: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
    not_to_be_done:    { label: 'Not To Be Done',    class: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
    other:             { label: 'Other',              class: 'bg-gray-100 text-gray-700',    dot: 'bg-gray-500' },
    // User status
    active:            { label: 'Active',             class: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
    inactive:          { label: 'Inactive',           class: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
}

export default function StatusBadge({ status, iconOnly = false }) {
    const s = config[status] ?? { label: status ?? '—', class: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }

    if (iconOnly) {
        return <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} title={s.label} />
    }

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.class}`}>
            {s.label}
        </span>
    )
}