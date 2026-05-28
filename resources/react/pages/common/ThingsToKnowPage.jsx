import React, { useState, useEffect } from 'react'
import { Video, FileText, Plus, Trash2, ExternalLink, Play, Download, File, Search, Eye, Pencil, Check, X } from 'lucide-react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

export default function ThingsToKnowPage() {
    const { user } = useAuth()
    const isAdmin = user?.role === 'ca' || user?.role === 'staff'
    const rolePrefix = user?.role === 'ca' ? '/ca' : '/staff'

    const getFileExtension = (url) => {
        if (!url) return '';
        const parts = url.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    };

    const getDocumentTypeLabel = (ext) => {
        switch(ext) {
            case 'pdf': return 'PDF Document';
            case 'doc':
            case 'docx': return 'Word Document';
            case 'xls':
            case 'xlsx': return 'Excel Spreadsheet';
            case 'ppt':
            case 'pptx': return 'PowerPoint Presentation';
            case 'zip':
            case 'rar': return 'Compressed Archive';
            case 'csv': return 'CSV Spreadsheet';
            case 'txt': return 'Text File';
            case 'rtf': return 'Rich Text Format';
            default: return ext ? `${ext.toUpperCase()} File` : 'Document';
        }
    };

    const getDocColorClasses = (ext) => {
        switch (ext) {
            case 'pdf':
                return 'bg-red-50 text-red-500';
            case 'doc':
            case 'docx':
                return 'bg-blue-50 text-blue-500';
            case 'xls':
            case 'xlsx':
            case 'csv':
                return 'bg-emerald-50 text-emerald-500';
            case 'ppt':
            case 'pptx':
                return 'bg-amber-50 text-amber-600';
            case 'zip':
            case 'rar':
                return 'bg-purple-50 text-purple-500';
            default:
                return 'bg-gray-50 text-gray-500';
        }
    };

    const getRelativeUrl = (url) => {
        if (!url) return '';
        try {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                const parsed = new URL(url);
                return parsed.pathname;
            }
        } catch (e) {
            console.error(e);
        }
        return url;
    };

    const handleDownload = async (e, url, filename) => {
        e.preventDefault();
        const toastId = toast.loading('Preparing download...');
        try {
            const relativeUrl = getRelativeUrl(url);
            const response = await fetch(relativeUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();
            
            // Check if returned blob is actually HTML (which means missing file redirect)
            if (blob.type.includes('html')) {
                toast.error('The file could not be found on the server.', { id: toastId });
                return;
            }

            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            
            const ext = getFileExtension(url);
            let finalFilename = filename;
            if (ext) {
                const dotExt = `.${ext}`;
                if (!filename.toLowerCase().endsWith(dotExt.toLowerCase())) {
                    finalFilename = `${filename}${dotExt}`;
                }
            }
            link.download = finalFilename;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            toast.success('Download completed successfully!', { id: toastId });
        } catch (error) {
            console.error('Download failed:', error);
            const relativeUrl = getRelativeUrl(url);
            window.open(relativeUrl, '_blank');
            toast.dismiss(toastId);
        }
    };

    const [activeTab, setActiveTab] = useState('videos')
    const [videos, setVideos] = useState([])
    const [loading, setLoading] = useState(true)
    const [addModalOpen, setAddModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    const [newVideo, setNewVideo] = useState({ title: '', url: '', group_name: 'General' })
    const [deleteVideoOpen, setDeleteVideoOpen] = useState(false)
    const [videoToDelete, setVideoToDelete] = useState(null)
    const [deleting, setDeleting] = useState(false)

    // Brochures state
    const [brochures, setBrochures] = useState([])
    const [addBrochureOpen, setAddBrochureOpen] = useState(false)
    const [newBrochure, setNewBrochure] = useState({ title: '', file: null, group_name: 'General' })
    const [deleteBrochureOpen, setDeleteBrochureOpen] = useState(false)
    const [brochureToDelete, setBrochureToDelete] = useState(null)
    const [savingBrochure, setSavingBrochure] = useState(false)
    const [previewBrochure, setPreviewBrochure] = useState(null)

    // Folder/playlist drill-down: null = show group cards, string = open that group
    const [selectedVideoGroup, setSelectedVideoGroup] = useState(null)
    const [selectedBrochureGroup, setSelectedBrochureGroup] = useState(null)
    const [showNewVideoGroupInput, setShowNewVideoGroupInput] = useState(false)
    const [showNewBrochureGroupInput, setShowNewBrochureGroupInput] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [editingGroup, setEditingGroup] = useState({ type: null, name: '', value: '' })

    const fetchVideos = async () => {
        setLoading(true)
        try {
            const res = await api.get('/things-to-know/videos')
            setVideos(res.data.data || [])
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
            setBrochures(res.data.data || [])
        } catch (e) {
            toast.error('Failed to load brochures')
        } finally {
            setLoading(false)
        }
    }

    const handleRenameGroup = async () => {
        if (!editingGroup.value.trim() || editingGroup.value.trim() === editingGroup.name) {
            setEditingGroup({ type: null, name: '', value: '' })
            return
        }

        const isVideo = editingGroup.type === 'videos'
        const endpoint = isVideo ? `${rolePrefix}/things-to-know/videos/group` : `${rolePrefix}/things-to-know/brochures/group`
        
        try {
            await api.patch(endpoint, {
                old_group_name: editingGroup.name,
                new_group_name: editingGroup.value.trim()
            })
            toast.success('Category renamed successfully')
            setEditingGroup({ type: null, name: '', value: '' })
            if (isVideo) {
                fetchVideos()
            } else {
                fetchBrochures()
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to rename category')
        }
    }

    useEffect(() => {
        if (activeTab === 'videos') {
            fetchVideos()
            setSelectedVideoGroup(null)
            setSearchQuery('')
        } else if (activeTab === 'brochures') {
            fetchBrochures()
            setSelectedBrochureGroup(null)
            setSearchQuery('')
        }
    }, [activeTab])

    const handleAddVideo = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await api.post(`${rolePrefix}/things-to-know/videos`, newVideo)
            toast.success('Video added successfully')
            setAddModalOpen(false)
            setNewVideo({ title: '', url: '', group_name: 'General' })
            setShowNewVideoGroupInput(false)
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
            await api.delete(`${rolePrefix}/things-to-know/videos/${videoToDelete.id}`)
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
            toast.error('Please select a document file')
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
            formData.append('group_name', newBrochure.group_name || 'General')

            await api.post(`${rolePrefix}/things-to-know/brochures`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            toast.success('Brochure added successfully')
            setAddBrochureOpen(false)
            setNewBrochure({ title: '', file: null, group_name: 'General' })
            setShowNewBrochureGroupInput(false)
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
            await api.delete(`${rolePrefix}/things-to-know/brochures/${brochureToDelete.id}`)
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

            {/* Tabs & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
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

                <div className="relative pb-2 md:pb-0 md:pr-2 w-full md:w-64">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder={activeTab === 'videos' ? "Search videos/playlists..." : "Search brochures/categories..."}
                        className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition w-full"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Content Section */}
            <div className="min-h-[400px]">
                {activeTab === 'videos' ? (
                    <div className="space-y-6">
                        {/* Header row */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                {selectedVideoGroup && (
                                    <button
                                        onClick={() => { setSelectedVideoGroup(null); setSearchQuery('') }}
                                        className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-800 transition"
                                    >
                                        <span className="text-lg leading-none">←</span> Playlists
                                    </button>
                                )}
                                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <Play className="text-red-600" fill="currentColor" size={20} />
                                    {selectedVideoGroup ? selectedVideoGroup : 'Video Playlists'}
                                </h2>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                {isAdmin && (
                                    <button
                                        onClick={() => setAddModalOpen(true)}
                                        className="flex items-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
                                    >
                                        <Plus size={16} /> Add Video
                                    </button>
                                )}
                            </div>
                        </div>

                        {loading ? (
                            <Spinner />
                        ) : (videos?.length ?? 0) === 0 ? (
                            <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                                <Video size={48} className="text-gray-200 mb-4" />
                                <p className="text-gray-400 font-medium text-lg">No videos added yet.</p>
                                {isAdmin && <p className="text-gray-400 text-sm mt-1">Click "Add Video" to share a tutorial.</p>}
                            </div>
                        ) : selectedVideoGroup === null ? (
                            // ── FOLDER VIEW: show playlist cards ──────────────────────────
                            (() => {
                                const groups = [...new Set(
                                    videos
                                        .filter(v => 
                                            (v.group_name || 'General').toLowerCase().includes(searchQuery.toLowerCase()) || 
                                            v.title.toLowerCase().includes(searchQuery.toLowerCase())
                                        )
                                        .map(v => v.group_name || 'General')
                                )].sort((a, b) => {
                                    if (a === 'General') return -1;
                                    if (b === 'General') return 1;
                                    return a.localeCompare(b);
                                });
                                return (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {groups.map(group => {
                                            const groupVideos = videos.filter(v => (v.group_name || 'General') === group);
                                            const firstYtId = getYoutubeId(groupVideos[0]?.url || '');
                                            const isEditing = editingGroup.type === 'videos' && editingGroup.name === group;
                                            return (
                                                <div
                                                    key={group}
                                                    onClick={() => !isEditing && setSelectedVideoGroup(group)}
                                                    className="group text-left bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-red-100 transition-all duration-300 cursor-pointer"
                                                >
                                                    {/* Thumbnail strip */}
                                                    <div className="relative h-36 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
                                                        {firstYtId ? (
                                                            <img
                                                                src={`https://img.youtube.com/vi/${firstYtId}/maxresdefault.jpg`}
                                                                alt={group}
                                                                className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500"
                                                                onError={e => { e.target.src = `https://img.youtube.com/vi/${firstYtId}/hqdefault.jpg` }}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <Play className="text-slate-600" size={40} />
                                                            </div>
                                                        )}
                                                        {/* Count badge overlay */}
                                                        <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm">
                                                            {groupVideos.length} {groupVideos.length === 1 ? 'video' : 'videos'}
                                                        </div>
                                                        {/* Play overlay */}
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                                                                <Play fill="white" size={18} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Card body */}
                                                    <div className="p-4 flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                                                            <Play fill="currentColor" size={16} />
                                                        </div>
                                                        {isEditing ? (
                                                            <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 font-semibold"
                                                                    value={editingGroup.value}
                                                                    onChange={e => setEditingGroup({ ...editingGroup, value: e.target.value })}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') handleRenameGroup()
                                                                        else if (e.key === 'Escape') setEditingGroup({ type: null, name: '', value: '' })
                                                                    }}
                                                                />
                                                                <button
                                                                    onClick={handleRenameGroup}
                                                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition shrink-0"
                                                                    title="Save"
                                                                >
                                                                    <Check size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingGroup({ type: null, name: '', value: '' })}
                                                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition shrink-0"
                                                                    title="Cancel"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-between w-full min-w-0">
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="font-extrabold text-gray-800 truncate">{group}</p>
                                                                    <p className="text-xs text-gray-400 mt-0.5">Playlist · {groupVideos.length} {groupVideos.length === 1 ? 'video' : 'videos'}</p>
                                                                </div>
                                                                {isAdmin && group !== 'General' && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingGroup({ type: 'videos', name: group, value: group });
                                                                        }}
                                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-slate-50 rounded-lg transition opacity-0 group-hover:opacity-100 shrink-0 ml-1"
                                                                        title="Rename Category"
                                                                    >
                                                                        <Pencil size={13} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()
                        ) : (
                            // ── DETAIL VIEW: show videos inside selected group ──────────
                            (() => {
                                const groupVideos = videos
                                    .filter(v => (v.group_name || 'General') === selectedVideoGroup)
                                    .filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()));
                                if (groupVideos.length === 0) {
                                    return (
                                        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                                            <Search size={48} className="text-gray-200 mb-4" />
                                            <p className="text-gray-400 font-medium text-lg">No matching videos found.</p>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {groupVideos.map((video) => {
                                            const ytId = getYoutubeId(video.url);
                                            return (
                                                <div key={video.id} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
                                                    <div className="relative aspect-video bg-gray-900 overflow-hidden">
                                                        {ytId ? (
                                                            <img
                                                                src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`}
                                                                alt={video.title}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                                onError={e => { e.target.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                                                <Video className="text-slate-600" size={40} />
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                            <a href={video.url} target="_blank" rel="noopener noreferrer"
                                                                className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-all duration-300 hover:bg-white hover:text-red-600">
                                                                <Play fill="currentColor" size={20} />
                                                            </a>
                                                        </div>
                                                    </div>
                                                    <div className="p-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <h3 className="font-bold text-gray-800 line-clamp-2 leading-tight flex-1">{video.title}</h3>
                                                            {isAdmin && (
                                                                <button onClick={() => handleDeleteVideo(video)}
                                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Remove Video">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <a href={video.url} target="_blank" rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 mt-3 hover:underline">
                                                            <ExternalLink size={12} /> Watch on YouTube
                                                        </a>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Header row */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                {selectedBrochureGroup && (
                                    <button
                                        onClick={() => { setSelectedBrochureGroup(null); setSearchQuery('') }}
                                        className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-800 transition"
                                    >
                                        <span className="text-lg leading-none">←</span> Categories
                                    </button>
                                )}
                                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <FileText className="text-blue-600" />
                                    {selectedBrochureGroup ? selectedBrochureGroup : 'Document Categories'}
                                </h2>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                {isAdmin && (
                                    <button
                                        onClick={() => setAddBrochureOpen(true)}
                                        className="flex items-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
                                    >
                                        <Plus size={16} /> Add Brochure
                                    </button>
                                )}
                            </div>
                        </div>

                        {loading ? (
                            <Spinner />
                        ) : (brochures?.length ?? 0) === 0 ? (
                            <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                                <FileText size={48} className="text-gray-200 mb-4" />
                                <p className="text-gray-400 font-medium text-lg">No brochures added yet.</p>
                                {isAdmin && <p className="text-gray-400 text-sm mt-1">Click "Add Brochure" to share a PDF.</p>}
                            </div>
                        ) : selectedBrochureGroup === null ? (
                            // ── FOLDER VIEW: show category cards ──────────────────────────
                            (() => {
                                const groups = [...new Set(
                                    brochures
                                        .filter(b => 
                                            (b.group_name || 'General').toLowerCase().includes(searchQuery.toLowerCase()) || 
                                            b.title.toLowerCase().includes(searchQuery.toLowerCase())
                                        )
                                        .map(b => b.group_name || 'General')
                                )].sort((a, b) => {
                                    if (a === 'General') return -1;
                                    if (b === 'General') return 1;
                                    return a.localeCompare(b);
                                });
                                return (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {groups.map(group => {
                                            const groupBrochures = brochures.filter(b => (b.group_name || 'General') === group);
                                            const isEditing = editingGroup.type === 'brochures' && editingGroup.name === group;
                                            return (
                                                <div
                                                    key={group}
                                                    onClick={() => !isEditing && setSelectedBrochureGroup(group)}
                                                    className="group text-left bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-blue-100 transition-all duration-300 cursor-pointer"
                                                >
                                                    {/* Folder cover art */}
                                                    <div className="relative h-36 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center overflow-hidden">
                                                        <div className="flex gap-2 opacity-30 group-hover:opacity-50 transition-opacity">
                                                            {[...Array(Math.min(3, groupBrochures.length))].map((_, i) => (
                                                                <div key={i} className={`w-14 h-18 bg-white rounded-lg shadow-md border border-gray-200 flex items-center justify-center ${i === 1 ? 'scale-110 -mt-2' : 'mt-2'}`}>
                                                                    <File className="text-blue-400" size={24} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {/* Count badge */}
                                                        <div className="absolute top-3 right-3 bg-blue-600/80 text-white text-xs font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm">
                                                            {groupBrochures.length} {groupBrochures.length === 1 ? 'file' : 'files'}
                                                        </div>
                                                    </div>
                                                    {/* Card body */}
                                                    <div className="p-4 flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                                                            <FileText size={16} />
                                                        </div>
                                                        {isEditing ? (
                                                            <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-350 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                                                                    value={editingGroup.value}
                                                                    onChange={e => setEditingGroup({ ...editingGroup, value: e.target.value })}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') handleRenameGroup()
                                                                        else if (e.key === 'Escape') setEditingGroup({ type: null, name: '', value: '' })
                                                                    }}
                                                                />
                                                                <button
                                                                    onClick={handleRenameGroup}
                                                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition shrink-0"
                                                                    title="Save"
                                                                >
                                                                    <Check size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingGroup({ type: null, name: '', value: '' })}
                                                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition shrink-0"
                                                                    title="Cancel"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-between w-full min-w-0">
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="font-extrabold text-gray-800 truncate">{group}</p>
                                                                    <p className="text-xs text-gray-400 mt-0.5">Documents · {groupBrochures.length} {groupBrochures.length === 1 ? 'file' : 'files'}</p>
                                                                </div>
                                                                {isAdmin && group !== 'General' && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingGroup({ type: 'brochures', name: group, value: group });
                                                                        }}
                                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition opacity-0 group-hover:opacity-100 shrink-0 ml-1"
                                                                        title="Rename Category"
                                                                    >
                                                                        <Pencil size={13} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()
                        ) : (
                            // ── DETAIL VIEW: show brochures inside selected group ──────────
                            (() => {
                                const groupBrochures = brochures
                                    .filter(b => (b.group_name || 'General') === selectedBrochureGroup)
                                    .filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()));
                                if (groupBrochures.length === 0) {
                                    return (
                                        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                                            <Search size={48} className="text-gray-200 mb-4" />
                                            <p className="text-gray-400 font-medium text-lg">No matching brochures found.</p>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {groupBrochures.map((brochure) => {
                                            const ext = getFileExtension(brochure.file_url);
                                            const canPreview = ext === 'pdf';
                                            return (
                                                <div key={brochure.id} className="group bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-xl transition-all duration-300 flex items-center gap-4">
                                                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${getDocColorClasses(ext)}`}>
                                                        <File size={28} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-gray-800 truncate" title={brochure.title}>{brochure.title}</h3>
                                                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-0.5">{getDocumentTypeLabel(ext)}</p>
                                                        <div className="flex items-center gap-3 mt-3">
                                                            {canPreview && (
                                                                <>
                                                                    <button 
                                                                        onClick={() => setPreviewBrochure(brochure)}
                                                                        className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                                                                    >
                                                                        <Eye size={13} /> Preview
                                                                    </button>
                                                                    <span className="text-gray-300 text-xs">|</span>
                                                                </>
                                                            )}
                                                            <a 
                                                                href={getRelativeUrl(brochure.file_url)} 
                                                                download={brochure.title}
                                                                onClick={(e) => handleDownload(e, brochure.file_url, brochure.title)}
                                                                className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition"
                                                            >
                                                                <Download size={13} /> Download
                                                            </a>
                                                        </div>
                                                    </div>
                                                    {isAdmin && (
                                                        <button onClick={() => handleDeleteBrochure(brochure)}
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Remove Brochure">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()
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
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Playlist / Group</label>
                        {!showNewVideoGroupInput ? (
                            <select
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] outline-none transition"
                                value={newVideo.group_name}
                                onChange={e => {
                                    if (e.target.value === '__new__') {
                                        setShowNewVideoGroupInput(true)
                                        setNewVideo({ ...newVideo, group_name: '' })
                                    } else {
                                        setNewVideo({ ...newVideo, group_name: e.target.value })
                                    }
                                }}
                            >
                                <option value="General">General</option>
                                {[...new Set(videos.map(v => v.group_name).filter(g => g && g !== 'General'))].sort().map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                                <option value="__new__">＋ Create new group...</option>
                            </select>
                        ) : (
                            <div className="flex gap-2">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Enter new group name..."
                                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] outline-none transition"
                                    value={newVideo.group_name}
                                    onChange={e => setNewVideo({ ...newVideo, group_name: e.target.value })}
                                />
                                <button type="button" onClick={() => { setShowNewVideoGroupInput(false); setNewVideo({ ...newVideo, group_name: 'General' }) }}
                                    className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => { setAddModalOpen(false); setShowNewVideoGroupInput(false) }}
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
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Document File</label>
                        <div className="relative">
                            <input
                                required
                                type="file"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.csv,.txt,.rtf"
                                className="hidden"
                                id="brochure-file"
                                onChange={e => setNewBrochure({ ...newBrochure, file: e.target.files[0] })}
                            />
                            <label
                                htmlFor="brochure-file"
                                className="flex items-center justify-between w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition"
                            >
                                <span className="text-sm text-gray-500 truncate">
                                    {newBrochure.file ? newBrochure.file.name : 'Select file...'}
                                </span>
                                <Plus size={18} className="text-gray-400" />
                            </label>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Maximum file size: 10MB (PDF, Word, Excel, PPT, ZIP, CSV, TXT, RTF)</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Category / Group</label>
                        {!showNewBrochureGroupInput ? (
                            <select
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] outline-none transition"
                                value={newBrochure.group_name}
                                onChange={e => {
                                    if (e.target.value === '__new__') {
                                        setShowNewBrochureGroupInput(true)
                                        setNewBrochure({ ...newBrochure, group_name: '' })
                                    } else {
                                        setNewBrochure({ ...newBrochure, group_name: e.target.value })
                                    }
                                }}
                            >
                                <option value="General">General</option>
                                {[...new Set(brochures.map(b => b.group_name).filter(g => g && g !== 'General'))].sort().map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                                <option value="__new__">＋ Create new group...</option>
                            </select>
                        ) : (
                            <div className="flex gap-2">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Enter new group name..."
                                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] outline-none transition"
                                    value={newBrochure.group_name}
                                    onChange={e => setNewBrochure({ ...newBrochure, group_name: e.target.value })}
                                />
                                <button type="button" onClick={() => { setShowNewBrochureGroupInput(false); setNewBrochure({ ...newBrochure, group_name: 'General' }) }}
                                    className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => { setAddBrochureOpen(false); setShowNewBrochureGroupInput(false) }}
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

            {/* Native PDF Preview Modal */}
            <Modal
                open={!!previewBrochure}
                onClose={() => setPreviewBrochure(null)}
                title={previewBrochure?.title || "Brochure Preview"}
                width="max-w-4xl"
            >
                <div className="flex flex-col h-[75vh]">
                    {/* Toolbar with action buttons */}
                    <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50/50 rounded-t-xl shrink-0">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                            <File size={16} className="text-red-500" />
                            <span>PDF Viewer</span>
                        </div>
                        <a 
                            href={getRelativeUrl(previewBrochure?.file_url)} 
                            download={`${previewBrochure?.title}.pdf`}
                            onClick={(e) => handleDownload(e, previewBrochure.file_url, previewBrochure.title)}
                            className="flex items-center gap-2 bg-[#1F5C99] hover:bg-[#154675] text-white px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-md shadow-blue-100"
                        >
                            <Download size={14} />
                            <span>Download PDF</span>
                        </a>
                    </div>
                    
                    {/* PDF embed/iframe container */}
                    <div className="flex-1 bg-slate-100 rounded-b-xl overflow-hidden relative">
                        {previewBrochure && (
                            <iframe 
                                src={`${getRelativeUrl(previewBrochure.file_url)}#toolbar=0`} 
                                className="w-full h-full border-none"
                                title={previewBrochure.title}
                            />
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    )
}
