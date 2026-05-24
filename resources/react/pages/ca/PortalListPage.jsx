import { useState, useEffect } from 'react'
import { Plus, Search, ExternalLink, Pencil, Trash2, Globe } from 'lucide-react'
import api from '../../api/axios'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Spinner from '../../components/ui/Spinner'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

export default function PortalListPage() {
    const { user } = useAuth()
    const isCa = user?.role === 'ca'

    const [portals, setPortals] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [selected, setSelected] = useState(null)
    const [form, setForm] = useState({ name: '', url: '' })
    const [saving, setSaving] = useState(false)

    const fetchPortals = async () => {
        setLoading(true)
        try {
            const res = await api.get('/ca/portals')
            setPortals(res.data.data)
        } catch (e) {
            toast.error('Failed to fetch portals')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchPortals() }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            if (selected) {
                await api.put(`/ca/portals/${selected.id}`, form)
                toast.success('Portal updated successfully')
            } else {
                await api.post('/ca/portals', form)
                toast.success('Portal created successfully')
            }
            setModalOpen(false)
            fetchPortals()
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to save portal')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        setSaving(true)
        try {
            await api.delete(`/ca/portals/${selected.id}`)
            toast.success('Portal deleted successfully')
            setDeleteOpen(false)
            fetchPortals()
        } catch (e) {
            toast.error('Failed to delete portal')
        } finally {
            setSaving(false)
        }
    }

    const openCreate = () => {
        setSelected(null)
        setForm({ name: '', url: '' })
        setModalOpen(true)
    }

    const openEdit = (p) => {
        setSelected(p)
        setForm({ name: p.name, url: p.url })
        setModalOpen(true)
    }

    const formatUrl = (url) => {
        if (!url) return ''
        if (!/^https?:\/\//i.test(url)) {
            return `https://${url}`
        }
        return url
    }

    const filteredPortals = (portals || []).filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.url.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Portal List</h1>
                    <p className="text-sm text-gray-400 mt-1">{isCa ? 'Manage and access all external links in one place.' : 'Access external portal links.'}</p>
                </div>
                {isCa && (
                    <button onClick={openCreate} className="flex items-center justify-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition w-full sm:w-auto shadow-sm">
                        <Plus size={16} /> New Portal
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50/50">
                    <div className="relative max-w-md">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search portals..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] w-full transition shadow-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? <Spinner /> : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    <th className="px-6 py-4 text-left">#</th>
                                    <th className="px-6 py-4 text-left">Portal Name</th>
                                    <th className="px-6 py-4 text-left">Portal Link</th>
                                    {isCa && <th className="px-6 py-4 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredPortals.length === 0 ? (
                                    <tr><td colSpan={isCa ? 4 : 3} className="text-center py-12 text-gray-400 font-medium">No portals found</td></tr>
                                ) : filteredPortals.map((p, i) => (
                                    <tr key={p.id} className="hover:bg-gray-50 transition group">
                                        <td className="px-6 py-4 text-gray-400 font-medium">{String(i + 1).padStart(2, '0')}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                                                    <Globe size={14} />
                                                </div>
                                                <span className="font-bold text-gray-800">{p.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            <a href={formatUrl(p.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline font-medium break-all">
                                                {p.url}
                                                <ExternalLink size={12} className="shrink-0" />
                                            </a>
                                        </td>
                                        {isCa && (
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition shadow-sm bg-white border border-gray-100">
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button onClick={() => { setSelected(p); setDeleteOpen(true) }} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition shadow-sm bg-white border border-gray-100">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={selected ? "Edit Portal" : "New Portal"} width="max-w-md">
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Portal Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            placeholder="Enter portal name"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Portal Link <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            placeholder="example.com"
                            value={form.url}
                            onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                            className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition">Cancel</button>
                        <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md transition disabled:opacity-50">
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleDelete}
                loading={saving}
                title="Delete Portal"
                message={`Are you sure you want to delete "${selected?.name}"? This will permanently remove the link.`}
                danger
            />
        </div>
    )
}
