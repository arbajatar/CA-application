import React, { useState, useEffect } from 'react'
import { Video, FileText, Plus, Trash2, ExternalLink, Play, Download, File } from 'lucide-react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

export default function ThingsToKnowPage() {
    const { user } = useAuth()
    const isAdmin = user?.role === 'ca'

    const [activeTab, setActiveTab] = useState('videos')
    const [videos, setVideos] = useState([])
    const [loading, setLoading] = useState(true)
    const [addModalOpen, setAddModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    const [newVideo, setNewVideo] = useState({ title: '', url: '' })
    const [deleteVideoOpen, setDeleteVideoOpen] = useState(false)
    const [videoToDelete, setVideoToDelete] = useState(null)
    const [deleting, setDeleting] = useState(false)

    // Brochures state
    const [brochures, setBrochures] = useState([])
    const [addBrochureOpen, setAddBrochureOpen] = useState(false)
    const [newBrochure, setNewBrochure] = useState({ title: '', file: null })
    const [deleteBrochureOpen, setDeleteBrochureOpen] = useState(false)
    const [brochureToDelete, setBrochureToDelete] = useState(null)
    const [savingBrochure, setSavingBrochure] = useState(false)

    const fetchVideos = async () => {
        setLoading(true)
        try {
            const res = await api.get('/things-to-know/videos')
            setVideos(res.data.data)
        } catch (e) {
            toast.error('Failed to load videos')
        } finally {
            setLoading(false)
        }
    }

    const fetchBrochures = async () => {
        setLoading(true)
        try {
            const res = await api.get('/things-to-know/brochures')
            setBrochures(res.data.data)
        } catch (e) {
            toast.error('Failed to load brochures')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'videos') {
            fetchVideos()
        } else if (activeTab === 'brochures') {
            fetchBrochures()
        }
    }, [activeTab])

    const handleAddVideo = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await api.post('/ca/things-to-know/videos', newVideo)
            toast.success('Video added successfully')
            setAddModalOpen(false)
            setNewVideo({ title: '', url: '' })
            fetchVideos()
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to add video')
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteVideo = (video) => {
        setVideoToDelete(video)
        setDeleteVideoOpen(true)
    }

    const confirmDeleteVideo = async () => {
        if (!videoToDelete) return
        setDeleting(true)
        try {
            await api.delete(`/ca/things-to-know/videos/${videoToDelete.id}`)
            toast.success('Video removed successfully')
            setDeleteVideoOpen(false)
            setVideoToDelete(null)
            fetchVideos()
        } catch (e) {
            toast.error('Failed to remove video')
        } finally {
            setDeleting(false)
        }
    }

    const handleAddBrochure = async (e) => {
        e.preventDefault()
        if (!newBrochure.file) {
            toast.error('Please select a PDF file')
            return
        }

        // Client-side size check (10MB)
        if (newBrochure.file.size > 10 * 1024 * 1024) {
            toast.error('File size exceeds 10MB limit')
            return
        }

        setSavingBrochure(true)
        try {
            const formData = new FormData()
            formData.append('title', newBrochure.title)
            formData.append('file', newBrochure.file)

            await api.post('/ca/things-to-know/brochures', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            toast.success('Brochure added successfully')
            setAddBrochureOpen(false)
            setNewBrochure({ title: '', file: null })
            fetchBrochures()
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to add brochure')
        } finally {
            setSavingBrochure(false)
        }
    }

    const handleDeleteBrochure = (brochure) => {
        setBrochureToDelete(brochure)
        setDeleteBrochureOpen(true)
    }

    const confirmDeleteBrochure = async () => {
        if (!brochureToDelete) return
        setDeleting(true)
        try {
            await api.delete(`/ca/things-to-know/brochures/${brochureToDelete.id}`)
            toast.success('Brochure removed successfully')
            setDeleteBrochureOpen(false)
            setBrochureToDelete(null)
            fetchBrochures()
        } catch (e) {
            toast.error('Failed to remove brochure')
        } finally {
            setDeleting(false)
        }
    }

    const getYoutubeId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Learning Library</h1>
                    <p className="text-sm text-gray-400 mt-1">Tutorials, guides and important documents.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('videos')}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'videos'
                            ? 'border-[#1F5C99] text-[#1F5C99]'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Video size={18} />
                    Videos
                </button>
                <button
                    onClick={() => setActiveTab('brochures')}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'brochures'
                            ? 'border-[#1F5C99] text-[#1F5C99]'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <FileText size={18} />
                    Brochures
                </button>
            </div>

            {/* Content Section */}
            <div className="min-h-[400px]">
                {activeTab === 'videos' ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Play className="text-red-600" fill="currentColor" size={20} />
                                Video Tutorials
                            </h2>
                            {isAdmin && (
                                <button
                                    onClick={() => setAddModalOpen(true)}
                                    className="flex items-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
                                >
                                    <Plus size={16} /> Add Video
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <Spinner />
                        ) : videos.length === 0 ? (
                            <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                                <Video size={48} className="text-gray-200 mb-4" />
                                <p className="text-gray-400 font-medium text-lg">No videos added yet.</p>
                                {isAdmin && <p className="text-gray-400 text-sm mt-1">Click "Add Video" to share a tutorial.</p>}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {videos.map((video) => {
                                    const ytId = getYoutubeId(video.url)
                                    return (
                                        <div key={video.id} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
                                            <div className="relative aspect-video bg-gray-900 overflow-hidden">
                                                {ytId ? (
                                                    <img
                                                        src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`}
                                                        alt={video.title}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        onError={(e) => { e.target.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                                        <Video className="text-slate-600" size={40} />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                    <a
                                                        href={video.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-all duration-300 hover:bg-white hover:text-red-600"
                                                    >
                                                        <Play fill="currentColor" size={20} />
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <h3 className="font-bold text-gray-800 line-clamp-2 leading-tight flex-1">{video.title}</h3>
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => handleDeleteVideo(video)}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                            title="Remove Video"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                                <a
                                                    href={video.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 mt-3 hover:underline"
                                                >
                                                    <ExternalLink size={12} />
                                                    Watch on YouTube
                                                </a>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <FileText className="text-blue-600" />
                                Brochures & Documents
                            </h2>
                            {isAdmin && (
                                <button
                                    onClick={() => setAddBrochureOpen(true)}
                                    className="flex items-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
                                >
                                    <Plus size={16} /> Add Brochure
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <Spinner />
                        ) : brochures.length === 0 ? (
                            <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                                <FileText size={48} className="text-gray-200 mb-4" />
                                <p className="text-gray-400 font-medium text-lg">No brochures added yet.</p>
                                {isAdmin && <p className="text-gray-400 text-sm mt-1">Click "Add Brochure" to share a PDF.</p>}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {brochures.map((brochure) => (
                                    <div key={brochure.id} className="group bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-xl transition-all duration-300 flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center text-red-500 shrink-0 group-hover:scale-110 transition-transform">
                                            <File size={28} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-gray-800 truncate" title={brochure.title}>{brochure.title}</h3>
                                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-0.5">PDF Document</p>
                                            <div className="flex items-center gap-3 mt-3">
                                                <a
                                                    href={brochure.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                                                >
                                                    <Download size={14} />
                                                    View / Download
                                                </a>
                                            </div>
                                        </div>
                                        {isAdmin && (
                                            <button
                                                onClick={() => handleDeleteBrochure(brochure)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                title="Remove Brochure"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Add Video Modal */}
            <Modal
                open={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                title="Add New Video"
                width="max-w-md"
            >
                <form onSubmit={handleAddVideo} className="space-y-4 py-2">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Video Title</label>
                        <input
                            required
                            type="text"
                            placeholder="e.g. How to manage tasks"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] outline-none transition"
                            value={newVideo.title}
                            onChange={e => setNewVideo({ ...newVideo, title: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">YouTube URL</label>
                        <input
                            required
                            type="url"
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] outline-none transition"
                            value={newVideo.url}
                            onChange={e => setNewVideo({ ...newVideo, url: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setAddModalOpen(false)}
                            className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-6 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50"
                        >
                            {saving ? 'Adding...' : 'Add Video'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Add Brochure Modal */}
            <Modal
                open={addBrochureOpen}
                onClose={() => setAddBrochureOpen(false)}
                title="Add New Brochure"
                width="max-w-md"
            >
                <form onSubmit={handleAddBrochure} className="space-y-4 py-2">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Brochure Title</label>
                        <input
                            required
                            type="text"
                            placeholder="e.g. Service Catalogue 2024"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] outline-none transition"
                            value={newBrochure.title}
                            onChange={e => setNewBrochure({ ...newBrochure, title: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">PDF File</label>
                        <div className="relative">
                            <input
                                required
                                type="file"
                                accept=".pdf"
                                className="hidden"
                                id="brochure-file"
                                onChange={e => setNewBrochure({ ...newBrochure, file: e.target.files[0] })}
                            />
                            <label
                                htmlFor="brochure-file"
                                className="flex items-center justify-between w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition"
                            >
                                <span className="text-sm text-gray-500 truncate">
                                    {newBrochure.file ? newBrochure.file.name : 'Select PDF file...'}
                                </span>
                                <Plus size={18} className="text-gray-400" />
                            </label>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Maximum file size: 10MB (PDF only)</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setAddBrochureOpen(false)}
                            className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={savingBrochure}
                            className="bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-6 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50"
                        >
                            {savingBrochure ? 'Uploading...' : 'Add Brochure'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Dialogs */}
            <ConfirmDialog
                open={deleteVideoOpen}
                onClose={() => setDeleteVideoOpen(false)}
                onConfirm={confirmDeleteVideo}
                title="Remove Video"
                message={`Are you sure you want to remove "${videoToDelete?.title}"? This action cannot be undone.`}
                confirmLabel="Remove Video"
                danger
                loading={deleting}
            />

            <ConfirmDialog
                open={deleteBrochureOpen}
                onClose={() => setDeleteBrochureOpen(false)}
                onConfirm={confirmDeleteBrochure}
                title="Remove Brochure"
                message={`Are you sure you want to remove "${brochureToDelete?.title}"? This action cannot be undone.`}
                confirmLabel="Remove Brochure"
                danger
                loading={deleting}
            />
        </div>
    )
}
