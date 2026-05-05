import Modal from './Modal'

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }) {
    return (
        <Modal open={open} onClose={onClose} title={title} width="max-w-md">
            <p className="text-gray-600 text-sm mb-6">{message}</p>
            <div className="flex justify-end gap-3">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                >
                    Cancel
                </button>
                <button
                    onClick={() => { onConfirm(); onClose() }}
                    className={`px-4 py-2 text-sm rounded-lg text-white transition ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-[#1F5C99] hover:bg-[#1a4f85]'}`}
                >
                    {confirmLabel}
                </button>
            </div>
        </Modal>
    )
}