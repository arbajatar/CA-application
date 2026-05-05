export default function Spinner({ fullScreen = false }) {
    if (fullScreen) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
                <div className="w-10 h-10 border-4 border-[#1F5C99] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }
    return (
        <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[#1F5C99] border-t-transparent rounded-full animate-spin" />
        </div>
    )
}