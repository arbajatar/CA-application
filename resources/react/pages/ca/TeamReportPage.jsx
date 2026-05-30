import { useState, useEffect, useCallback, useRef } from 'react'
import { 
    ClipboardList, Calendar, Users, Briefcase, Clock, 
    FileSpreadsheet, Plus, Search, Edit3, Trash2, CheckCircle2, 
    AlertCircle, ChevronDown, ChevronUp, UserCheck, CheckSquare, 
    ArrowUpDown, RefreshCw, X, MessageSquare, Info,
    ShieldCheck, ShieldAlert, Folder, ArrowLeft, User, ChevronRight
} from 'lucide-react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import ExcelJS from 'exceljs'
import StatusBadge from '../../components/ui/StatusBadge'
import CustomSelect from '../../components/ui/CustomSelect'
import { formatDate } from '../../utils/dateHelper'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const formatTime12Hour = (time24) => {
    if (!time24 || time24 === '—') return '—'
    const parts = time24.split(':')
    if (parts.length < 2) return time24
    let hours = parseInt(parts[0], 10)
    const minutes = parts[1]
    if (isNaN(hours)) return time24
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12 // the hour '0' should be '12'
    const hoursStr = String(hours).padStart(2, '0')
    return `${hoursStr}:${minutes} ${ampm}`
}

const parseTime24Hour = (time12) => {
    if (!time12) return ''
    const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!match) return time12
    let hours = parseInt(match[1], 10)
    const minutes = match[2]
    const ampm = match[3].toUpperCase()
    if (ampm === 'PM' && hours < 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0
    return `${String(hours).padStart(2, '0')}:${minutes}`
}

function TimePicker12Hour({ value, onChange, label, className = "" }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    let currentHour = "10";
    let currentMinute = "00";
    let currentAmpm = "AM";

    if (value) {
        const parts = value.split(':');
        if (parts.length >= 2) {
            let h = parseInt(parts[0], 10);
            const m = parts[1];
            if (!isNaN(h)) {
                currentAmpm = h >= 12 ? 'PM' : 'AM';
                h = h % 12;
                h = h ? h : 12;
                currentHour = String(h).padStart(2, '0');
                currentMinute = String(m).substring(0, 2);
            }
        }
    }

    const hoursList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    const minutesList = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (hour, minute, ampm) => {
        let h = parseInt(hour, 10);
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        const formatted24 = `${String(h).padStart(2, '0')}:${minute}`;
        onChange(formatted24);
    };

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">{label}</label>}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 transition font-semibold text-gray-800 ${className}`}
            >
                <span>{`${currentHour}:${currentMinute} ${currentAmpm}`}</span>
                <Clock size={16} className="text-gray-400" />
            </div>
            
            {isOpen && (
                <div className="absolute left-0 mt-1 bg-white border border-gray-100 rounded-2xl shadow-xl p-3 z-50 flex gap-2 w-64">
                    {/* Hours */}
                    <div className="flex-1 flex flex-col h-40 overflow-y-auto select-none border-r border-gray-100 pr-1">
                        <p className="text-[10px] font-bold text-gray-400 text-center sticky top-0 bg-white pb-1">HR</p>
                        {hoursList.map(h => (
                            <button
                                type="button"
                                key={h}
                                onClick={() => handleSelect(h, currentMinute, currentAmpm)}
                                className={`py-1 text-xs font-semibold rounded-lg transition ${h === currentHour ? 'bg-[#EEF4FB] text-[#1F5C99] font-bold hover:bg-[#d8e7f5]' : 'text-gray-700 hover:bg-gray-100'}`}
                            >
                                {h}
                            </button>
                        ))}
                    </div>
                    {/* Minutes */}
                    <div className="flex-1 flex flex-col h-40 overflow-y-auto select-none pr-1">
                        <p className="text-[10px] font-bold text-gray-400 text-center sticky top-0 bg-white pb-1">MIN</p>
                        {minutesList.map(m => (
                            <button
                                type="button"
                                key={m}
                                onClick={() => handleSelect(currentHour, m, currentAmpm)}
                                className={`py-1 text-xs font-semibold rounded-lg transition ${m === currentMinute ? 'bg-[#EEF4FB] text-[#1F5C99] font-bold hover:bg-[#d8e7f5]' : 'text-gray-700 hover:bg-gray-100'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    {/* AM/PM */}
                    <div className="w-12 flex flex-col justify-center gap-1 border-l border-gray-100 pl-2">
                        {['AM', 'PM'].map(period => (
                            <button
                                type="button"
                                key={period}
                                onClick={() => handleSelect(currentHour, currentMinute, period)}
                                className={`py-2 text-xs font-bold rounded-lg transition ${period === currentAmpm ? 'bg-[#1F5C99] text-white hover:bg-[#154673]' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                {period}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Folders grid */}
        </div>
    );
}



const DURATION_OPTIONS = [
    { value: '1st Half', label: '1st Half' },
    { value: '2nd Half', label: '2nd Half' },
    { value: '3rd Half', label: '3rd Half' }
]

const STATUS_OPTIONS = [
    { value: 'pending', label: 'Pending' },
    { value: 'work_in_progress', label: 'Work In Progress' },
    { value: 'complete', label: 'Complete' },
    { value: 'not_to_be_done', label: 'Not To Be Done' },
    { value: 'other', label: 'Other' }
]

const CA_REVIEW_OPTIONS = [
    { value: 'WORK- VERY WELL', label: 'WORK- VERY WELL' },
    { value: 'WORK- DONE', label: 'WORK- DONE' },
    { value: 'WORK- TIME TAKEN', label: 'WORK- TIME TAKEN' },
    { value: 'WORK- WRONG WORK DONE', label: 'WORK- WRONG WORK DONE' },
    { value: 'WORK- DOUBLE WORK DONE', label: 'WORK- DOUBLE WORK DONE' },
    { value: 'OTHER', label: 'OTHER' }
]

const DEFAULT_MAIN_TASKS = [
    'ACCOUNTING',
    'ROC',
    'GST RETURN',
    'GST MISC WORK',
    'GST NOTICE',
    'INCOME TAX RETURN- SALARY',
    'INCOME TAX RETURN- BUSINESS',
    'INCOME TAX NOTICE',
    'INCOME TAX MISC WORK',
    'REGISTRATION & LICENSING',
    'PROFESSION TAX',
    'TDS',
    'PF & ESIC',
    'CERTIFICATE',
    'AUDIT',
    'VOUCHING',
    'MISC REPORTING',
    'VISIT- CLIENT',
    'MIS REPORTING',
    'DRAFTING',
    'CA MAHESH SIR TASK',
    'TEAM MEETING',
    'SIR MEETING',
    'CLIENT MEETING',
    'CLIENT CALL HANDLING',
    'BILLING',
    'ADMIN',
    'TEAM TRAINING',
    'ROUTIN TASK',
    'OTHER WORK',
    'OFFICE WORK'
]

export default function TeamReportPage() {
    const { user } = useAuth()
    const isCA = user?.role === 'ca'

    // Lists
    const [reports, setReports] = useState([])
    const [clients, setClients] = useState([])
    const [workTypes, setWorkTypes] = useState([])
    const [staff, setStaff] = useState([])
    const [clientTypes, setClientTypes] = useState([])
    const [clientGroups, setClientGroups] = useState([])
    const [customDurations, setCustomDurations] = useState([])
    const [customReviewOptions, setCustomReviewOptions] = useState(() => {
        try {
            const cached = localStorage.getItem('ca_custom_review_options')
            return cached ? JSON.parse(cached) : []
        } catch {
            return []
        }
    })

    useEffect(() => {
        localStorage.setItem('ca_custom_review_options', JSON.stringify(customReviewOptions))
    }, [customReviewOptions])

    const combinedReviewOptions = [
        ...CA_REVIEW_OPTIONS,
        ...customReviewOptions.map(cro => ({ value: cro, label: cro }))
    ]


    const [pendingUpdates, setPendingUpdates] = useState({})

    const handleBulkFieldChange = (reportId, fieldKey, newValue) => {
        setPendingUpdates(prev => {
            const current = prev[reportId] || {}
            return {
                ...prev,
                [reportId]: {
                    ...current,
                    [fieldKey]: newValue
                }
            }
        })
    }

    const handleSaveAllBulkUpdates = async () => {
        const reportIds = Object.keys(pendingUpdates)
        if (reportIds.length === 0) return
        setSaving(true)
        try {
            await Promise.all(
                reportIds.map(reportId => {
                    const updates = pendingUpdates[reportId]
                    return api.patch(`/daily-reports/${reportId}`, updates)
                })
            )
            toast.success(`Successfully saved bulk reviews for ${reportIds.length} reports!`)
            setPendingUpdates({})
            fetchReports()
        } catch (e) {
            console.error(e)
            toast.error('Failed to save bulk reviews.')
        } finally {
            setSaving(false)
        }
    }

    const [customReviewModalOpen, setCustomReviewModalOpen] = useState(false)
    const [newCustomReviewVal, setNewCustomReviewVal] = useState('')
    const [customReviewCallback, setCustomReviewCallback] = useState(null)

    const handleAddCustomReview = (currentVal, setterFunc) => {
        setNewCustomReviewVal('')
        setCustomReviewCallback(() => (newVal) => {
            if (newVal && newVal.trim()) {
                const trimmed = newVal.trim().toUpperCase()
                if (!CA_REVIEW_OPTIONS.some(o => o.value === trimmed) && !customReviewOptions.includes(trimmed)) {
                    setCustomReviewOptions(prev => [...prev, trimmed])
                }
                setterFunc(trimmed)
            } else {
                setterFunc(currentVal || '')
            }
        })
        setCustomReviewModalOpen(true)
    }

    // States
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')
    const [filterStaff, setFilterStaff] = useState('')
    const [selectedStaffId, setSelectedStaffId] = useState('all')
    const [editingRowId, setEditingRowId] = useState(null)
    const [inlineForm, setInlineForm] = useState(null)
    const [inlineNewRows, setInlineNewRows] = useState([])
    const [filterClient, setFilterClient] = useState('')
    const [notesList, setNotesList] = useState([])
    const notesKey = selectedStaffId ? `team_notes_staff_${selectedStaffId}` : `team_notes_general`

    useEffect(() => {
        const saved = localStorage.getItem(notesKey)
        try {
            const parsed = saved ? JSON.parse(saved) : []
            setNotesList(parsed.length > 0 ? parsed : [{ id: 'init', text: '', timestamp: new Date().toLocaleString() }])
        } catch {
            setNotesList([{ id: 'init', text: '', timestamp: new Date().toLocaleString() }])
        }
    }, [notesKey])

    const handleSaveNotesList = (newList) => {
        setNotesList(newList)
        localStorage.setItem(notesKey, JSON.stringify(newList))
    }

    const handleUpdateNoteText = (id, text) => {
        const updated = notesList.map(n => n.id === id ? { ...n, text } : n)
        handleSaveNotesList(updated)
    }

    const handleAddNoteAfter = (id) => {
        const idx = notesList.findIndex(n => n.id === id)
        const newNote = {
            id: `note-${Date.now()}`,
            text: '',
            timestamp: new Date().toLocaleString()
        }
        const updated = [...notesList]
        updated.splice(idx + 1, 0, newNote)
        handleSaveNotesList(updated)
    }

    const handleDeleteNote = (id) => {
        let updated = notesList.filter(n => n.id !== id)
        if (updated.length === 0) {
            updated = [{ id: `note-${Date.now()}`, text: '', timestamp: new Date().toLocaleString() }]
        }
        handleSaveNotesList(updated)
    }
    const [filterStatus, setFilterStatus] = useState('')
    const todayStr = new Date().toISOString().substring(0, 10)
    const [startDate, setStartDate] = useState(todayStr)
    const [endDate, setEndDate] = useState(todayStr)
    const [showCustomCalendar, setShowCustomCalendar] = useState(false)
    const [calendarDate, setCalendarDate] = useState(new Date())

    const nextCalendarMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))
    const prevCalendarMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))

    const calDaysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate()
    const calFirstDayOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay()

    const calDays = []
    for (let i = 0; i < calFirstDayOfMonth; i++) {
        calDays.push(null)
    }
    for (let i = 1; i <= calDaysInMonth; i++) {
        calDays.push(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), i))
    }

    const handleCalendarDateClick = (date) => {
        if (!date) return
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        
        if (!startDate || (startDate && endDate)) {
            setStartDate(dateStr)
            setEndDate('')
        } else {
            const startParsed = new Date(startDate)
            if (date < startParsed) {
                setStartDate(dateStr)
                setEndDate('')
            } else {
                setEndDate(dateStr)
                setShowCustomCalendar(false)
            }
        }
    }

    const isDateSelected = (date) => {
        if (!date) return false
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        return dateStr === startDate || dateStr === endDate
    }

    const isDateInRange = (date) => {
        if (!date || !startDate || !endDate) return false
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        return dateStr > startDate && dateStr < endDate
    }

    const isDateToday = (date) => {
        if (!date) return false
        return date.toDateString() === new Date().toDateString()
    }

    const [sortBy, setSortBy] = useState('date')
    const [sortOrder, setSortOrder] = useState('desc')

    // Modals
    const [logModalOpen, setLogModalOpen] = useState(false)
    const [reviewModalOpen, setReviewModalOpen] = useState(false)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [newClientModalOpen, setNewClientModalOpen] = useState(false)
    const [newWorkTypeModalOpen, setNewWorkTypeModalOpen] = useState(false)

    // Form states
    const [selectedReport, setSelectedReport] = useState(null)
    const [formErrors, setFormErrors] = useState({})
    const [logForm, setLogForm] = useState({
        date: new Date().toISOString().substring(0, 10),
        main_task: '',
        sub_task: '',
        duration: '1st Half',
        start_time: '',
        end_time: '',
        client_id: '',
        client_name_custom: '',
        sub_task_description: '',
        status: 'pending',
        pct_completion: 50,
        final_remark: '',
        user_id: '',
        ca_review: '',
        ca_remark: ''
    })

    const [isManualClient, setIsManualClient] = useState(false)

    // Review form
    const [reviewForm, setReviewForm] = useState({
        ca_review: 'WORK- VERY WELL',
        ca_remark: ''
    })

    // Inline additions
    const [newClientForm, setNewClientForm] = useState({
        name: '',
        name_as_per_pan: '',
        pan_no: '',
        type: '',
        group: '',
        contact: '',
        alternative_contact: '',
        email: '',
        reference_no: '',
        dob: '',
        city: '',
        pin_code: '',
        state: '',
        gst_number: '',
        status: 'active',
        credentials: {
            efiling_password: '',
            ais_tis_password: ''
        }
    })
    const [newWorkTypeForm, setNewWorkTypeForm] = useState({
        name: '',
        description: ''
    })

    // Fetch reports
    const fetchReports = useCallback(async () => {
        setLoading(true)
        try {
            const params = {
                search,
                client_id: filterClient,
                start_date: startDate,
                end_date: endDate,
                sort_by: sortBy,
                sort_order: sortOrder
            }
            if (isCA && filterStaff) {
                params.user_id = filterStaff
            }
            const res = await api.get('/daily-reports', { params })
            setReports(res.data.data || [])
        } catch (e) {
            console.error(e)
            toast.error('Failed to load reports')
        } finally {
            setLoading(false)
        }
    }, [search, filterClient, filterStaff, startDate, endDate, sortBy, sortOrder, isCA])

    // Load dependencies
    useEffect(() => {
        const loadDependencies = async () => {
            try {
                const [clientsRes, workTypesRes, typesRes, groupsRes] = await Promise.all([
                    api.get('/daily-reports/clients'),
                    api.get('/daily-reports/work-types'),
                    api.get('/daily-reports/client-types'),
                    api.get('/daily-reports/client-groups')
                ])
                setClients(clientsRes.data.data || [])
                setWorkTypes(workTypesRes.data.data || [])
                setClientTypes(typesRes.data.data || [])
                setClientGroups(groupsRes.data.data || [])

                if (isCA) {
                    const staffRes = await api.get('/ca/staff')
                    setStaff(staffRes.data.data || [])
                }
            } catch (e) {
                console.error('Failed to load filter choices', e)
            }
        }
        loadDependencies()
    }, [isCA])

    // Generate AIS & TIS password dynamically in real-time
    useEffect(() => {
        if (newClientForm.pan_no && newClientForm.dob) {
            const panLower = newClientForm.pan_no.toLowerCase()
            const dobParts = newClientForm.dob.split('-') // YYYY-MM-DD
            if (dobParts.length === 3) {
                const year = dobParts[0]
                const month = dobParts[1]
                const day = dobParts[2]
                const dobDigits = `${day}${month}${year}`
                setNewClientForm(prev => ({
                    ...prev,
                    credentials: {
                        ...prev.credentials,
                        ais_tis_password: `${panLower}${dobDigits}`
                    }
                }))
            }
        }
    }, [newClientForm.pan_no, newClientForm.dob])

    // Validate PAN locally in real-time
    const getPanValidation = () => {
        const pan = (newClientForm.pan_no || '').toUpperCase()
        if (!pan) return null
        
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
        if (!panRegex.test(pan)) {
            return { valid: false, msg: 'Invalid general PAN format (e.g. ABCDE1234F).' }
        }

        const typeOption = clientTypes.find(t => t.name === newClientForm.type)
        if (typeOption && typeOption.pan_char) {
            const expectedChar = typeOption.pan_char.toUpperCase()
            const fourthChar = pan.charAt(3)
            if (fourthChar !== expectedChar) {
                return { 
                    valid: false, 
                    msg: `4th character of PAN must be "${expectedChar}" for type "${newClientForm.type}".` 
                }
            }
        }

        return { valid: true, msg: 'PAN format is fully valid and verified!' }
    }

    const panStatus = getPanValidation()

    // Validate GST locally in real-time
    const getGstValidation = () => {
        const gst = (newClientForm.gst_number || '').trim().toUpperCase()
        if (!gst) return null
        
        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
        if (!gstRegex.test(gst)) {
            return { valid: false, msg: 'Invalid GST format (e.g. 22AAAAA0000A1Z5).' }
        }

        if (newClientForm.pan_no) {
            const panInGst = gst.substring(2, 12)
            if (panInGst !== newClientForm.pan_no.toUpperCase()) {
                return { valid: false, msg: `GST characters 3-12 (${panInGst}) must match the Client PAN No (${newClientForm.pan_no.toUpperCase()}).` }
            }
        }

        return { valid: true, msg: 'GST format is fully valid and verified!' }
    }

    const gstStatus = getGstValidation()

    useEffect(() => {
        fetchReports()
    }, [fetchReports])

    // Calculate Hours Taken
    const calculateHours = (start, end) => {
        if (!start || !end) return 0
        try {
            const [sh, sm] = start.split(':').map(Number)
            const [eh, em] = end.split(':').map(Number)
            const diffMin = (eh * 60 + em) - (sh * 60 + sm)
            if (diffMin <= 0) return 0
            return parseFloat((diffMin / 60).toFixed(2))
        } catch (e) {
            return 0
        }
    }

    const currentCalculatedHours = calculateHours(logForm.start_time, logForm.end_time)

    // Handlers
    const handleLogFormChange = (e) => {
        const { name, value } = e.target
        setLogForm(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const openCreateModal = () => {
        setSelectedReport(null)
        setIsManualClient(false)
        setLogForm({
            date: new Date().toISOString().substring(0, 10),
            main_task: 'ACCOUNTING',
            sub_task: '',
            duration: '1st Half',
            start_time: '10:15',
            end_time: '12:15',
            client_id: '',
            client_name_custom: '',
            sub_task_description: '',
            status: 'pending',
            pct_completion: 50,
            final_remark: '',
            user_id: filterStaff || user?.id || '',
            ca_review: '',
            ca_remark: ''
        })
        setFormErrors({})
        setLogModalOpen(true)
    }

    const openEditModal = (report) => {
        setSelectedReport(report)
        setIsManualClient(!!report.client_name_custom)
        setLogForm({
            date: report.date,
            main_task: report.main_task,
            sub_task: report.sub_task || '',
            duration: report.duration || '1st Half',
            start_time: report.start_time || '',
            end_time: report.end_time || '',
            client_id: report.client_id || '',
            client_name_custom: report.client_name_custom || '',
            sub_task_description: report.sub_task_description || '',
            status: report.status || 'pending',
            pct_completion: report.pct_completion || 0,
            final_remark: report.final_remark || '',
            user_id: report.user_id,
            ca_review: report.ca_review || '',
            ca_remark: report.ca_remark || ''
        })
        setFormErrors({})
        setLogModalOpen(true)
    }

    const handleSaveLog = async (e) => {
        e.preventDefault()
        setSaving(true)
        setFormErrors({})
        try {
            const payload = { ...logForm }
            if (isManualClient) {
                payload.client_id = null
            } else {
                payload.client_name_custom = null
            }

            if (selectedReport) {
                await api.patch(`/daily-reports/${selectedReport.id}`, payload)
                toast.success('Daily report updated successfully')
            } else {
                await api.post('/daily-reports', payload)
                toast.success('Daily report saved successfully')
            }
            setLogModalOpen(false)
            fetchReports()
        } catch (error) {
            if (error.response?.data?.errors) {
                setFormErrors(error.response.data.errors)
            }
            toast.error(error.response?.data?.message || 'Failed to save daily work progress report')
        } finally {
            setSaving(false)
        }
    }

    const handleStartInlineEdit = (report) => {
        setEditingRowId(report.id)
        setInlineForm({
            date: report.date || new Date().toISOString().substring(0, 10),
            main_task: report.main_task || 'ACCOUNTING',
            sub_task: report.sub_task || '',
            duration: report.duration || '1st Half',
            start_time: report.start_time || '10:15',
            end_time: report.end_time || '12:15',
            client_id: report.client_id || '',
            client_name_custom: report.client_name_custom || '',
            sub_task_description: report.sub_task_description || '',
            status: report.status || 'pending',
            pct_completion: report.pct_completion || 50,
            final_remark: report.final_remark || '',
            user_id: report.user_id,
            ca_review: report.ca_review || '',
            ca_remark: report.ca_remark || ''
        })
    }

    const handleSaveInlineEdit = async (reportId) => {
        setSaving(true)
        try {
            const isNew = String(reportId).startsWith('new-')
            const payload = { ...inlineForm }
            if (payload.client_name_custom) {
                payload.client_id = null
            } else {
                payload.client_name_custom = null
            }
            if (isNew) {
                await api.post('/daily-reports', payload)
                toast.success('Daily report added inline successfully')
                setInlineNewRows(prev => prev.filter(r => r.id !== reportId))
            } else {
                await api.patch(`/daily-reports/${reportId}`, payload)
                toast.success('Daily report updated inline successfully')
            }
            setEditingRowId(null)
            setInlineForm(null)
            fetchReports()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save inline work progress report')
        } finally {
            setSaving(false)
        }
    }

    const handleAddRowInline = () => {
        const tempId = `new-${Date.now()}`
        const newRow = {
            id: tempId,
            date: new Date().toISOString().substring(0, 10),
            main_task: 'ACCOUNTING',
            sub_task: '',
            duration: '1st Half',
            start_time: '10:15',
            end_time: '12:15',
            client_id: '',
            client_name_custom: '',
            sub_task_description: '',
            status: 'pending',
            pct_completion: 50,
            final_remark: '',
            user_id: filterStaff || user?.id || '',
            user_name: user?.name || '',
            ca_review: '',
            ca_remark: ''
        }
        setInlineNewRows(prev => [...prev, newRow])
        setEditingRowId(tempId)
        setInlineForm({ ...newRow })
    }

    // CA Review Handlers
    const openReviewModal = (report) => {
        setSelectedReport(report)
        setReviewForm({
            ca_review: report.ca_review || 'WORK- VERY WELL',
            ca_remark: report.ca_remark || ''
        })
        setReviewModalOpen(true)
    }

    const handleSaveReview = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await api.patch(`/daily-reports/${selectedReport.id}`, reviewForm)
            toast.success('CA Review and remarks updated')
            setReviewModalOpen(false)
            fetchReports()
        } catch (error) {
            toast.error('Failed to submit review')
        } finally {
            setSaving(false)
        }
    }

    // Add Client Inline
    const handleCreateClient = async (e) => {
        e.preventDefault()
        if (!newClientForm.name) {
            toast.error('Name is required')
            return
        }

        // Run pre-submit PAN validation check
        if (panStatus && !panStatus.valid) {
            toast.error(panStatus.msg)
            return
        }

        // Run pre-submit GST validation check
        if (gstStatus && !gstStatus.valid) {
            toast.error(gstStatus.msg)
            return
        }

        // Validate mobile number lengths (exactly 10 digits if provided)
        if (newClientForm.contact && newClientForm.contact.replace(/\D/g, '').length !== 10) {
            toast.error('Contact No must be exactly 10 digits.')
            return
        }
        if (newClientForm.alternative_contact && newClientForm.alternative_contact.replace(/\D/g, '').length !== 10) {
            toast.error('Alternative Contact No must be exactly 10 digits.')
            return
        }

        setSaving(true)
        try {
            const payload = {
                ...newClientForm,
                pan_no: (newClientForm.pan_no || '').toUpperCase(),
                gst_number: (newClientForm.gst_number || '').toUpperCase()
            }
            const res = await api.post('/ca/clients', payload)
            const created = res.data.data
            setClients(prev => [...prev, created])
            setLogForm(prev => ({ ...prev, client_id: created.id }))
            setNewClientModalOpen(false)
            setNewClientForm({
                name: '',
                name_as_per_pan: '',
                pan_no: '',
                type: '',
                group: '',
                contact: '',
                alternative_contact: '',
                email: '',
                reference_no: '',
                dob: '',
                city: '',
                pin_code: '',
                state: '',
                gst_number: '',
                status: 'active',
                credentials: {
                    efiling_password: '',
                    ais_tis_password: ''
                }
            })
            toast.success('New client registered successfully!')
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to register client')
        } finally {
            setSaving(false)
        }
    }

    // Add Work Type Inline
    const handleCreateWorkType = async (e) => {
        e.preventDefault()
        if (!newWorkTypeForm.name) {
            toast.error('Work Type name is required')
            return
        }
        setSaving(true)
        try {
            const res = await api.post('/ca/work-types', newWorkTypeForm)
            const created = res.data.data
            setWorkTypes(prev => [...prev, created])
            setLogForm(prev => ({ ...prev, main_task: created.name }))
            setNewWorkTypeModalOpen(false)
            setNewWorkTypeForm({ name: '', description: '' })
            toast.success('New work task registered successfully!')
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to add work task')
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteReport = async () => {
        setSaving(true)
        try {
            await api.delete(`/daily-reports/${selectedReport.id}`)
            toast.success('Report entry deleted successfully')
            setDeleteModalOpen(false)
            fetchReports()
        } catch (e) {
            toast.error('Failed to delete report')
        } finally {
            setSaving(false)
        }
    }

    // Sort Handler
    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(field)
            setSortOrder('desc')
        }
    }

    const handleDownloadPDF = () => {
        try {
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            })

            // Title
            doc.setFontSize(16)
            doc.setTextColor(31, 92, 153) // Deep Navy
            doc.text('TEAM DAILY WORK PROGRESS REPORT', 14, 15)

            // Subtitle metadata
            doc.setFontSize(9)
            doc.setTextColor(100, 100, 100)
            doc.text(`Generated At: ${new Date().toLocaleString()}`, 14, 20)

            // Prepare columns and rows
            const headers = [
                '#',
                ...(isCA ? ['Team Member'] : []),
                'Date',
                'Main Task',
                'Sub Task',
                'Duration',
                'Start',
                'End',
                'Hours',
                'Client',
                'Description',
                'Status',
                '% Done',
                'Remark',
                'Review',
                'Feedback'
            ]

            const tableRows = displayedReports.map((report, idx) => [
                idx + 1,
                ...(isCA ? [report.user_name || '—'] : []),
                formatDate(report.date),
                report.main_task,
                report.sub_task || '—',
                report.duration || '—',
                formatTime12Hour(report.start_time),
                formatTime12Hour(report.end_time),
                report.hours_taken ? `${report.hours_taken} hrs` : '0',
                report.client_name || '—',
                report.sub_task_description || '—',
                report.status.toUpperCase(),
                `${report.pct_completion}%`,
                report.final_remark || '—',
                report.ca_review || '—',
                report.ca_remark || '—'
            ])

            autoTable(doc, {
                head: [headers],
                body: tableRows,
                startY: 25,
                theme: 'striped',
                styles: {
                    fontSize: 7,
                    cellPadding: 1.5,
                    valign: 'middle',
                    font: 'helvetica'
                },
                headStyles: {
                    fillColor: [31, 92, 153], // #1F5C99
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                margin: { top: 25, right: 10, bottom: 15, left: 10 },
                didParseCell: function(data) {
                    if (data.column.index === (isCA ? 11 : 10)) {
                        const val = data.cell.text[0];
                        if (val === 'COMPLETE') {
                            data.cell.styles.textColor = [22, 101, 52]; // Green
                            data.cell.styles.fontStyle = 'bold';
                        } else if (val === 'WORK_IN_PROGRESS') {
                            data.cell.styles.textColor = [30, 64, 175]; // Blue
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            })

            // Save PDF
            doc.save(`Daily_Work_Progress_Report_${new Date().toISOString().substring(0, 10)}.pdf`)
            toast.success('PDF report downloaded successfully!')
        } catch (err) {
            console.error(err)
            toast.error('Failed to generate PDF')
        }
    }

    // Excel Export with Professional formatting matching Workbook sheet exactly
    const handleExportExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook()
            
            // Create Sheets corresponding to excel
            const sheet = workbook.addWorksheet('TEAM DAILY WORK PROGRESS REPORT')

            // Enable gridlines
            sheet.views = [{ showGridLines: true }]

            // Style definitions
            // Style definitions
            const titleFill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F5C99' } // Standard blue
            }

            const titleFont = {
                name: 'Segoe UI',
                size: 14,
                bold: true,
                color: { argb: 'FFFFFFFF' }
            }

            const bodyFont = {
                name: 'Segoe UI',
                size: 10
            }

            // Title Block
            sheet.mergeCells('A1:O1')
            const titleCell = sheet.getCell('A1')
            titleCell.value = 'TEAM DAILY WORK PROGRESS REPORT'
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
            titleCell.fill = titleFill
            titleCell.font = titleFont

            // Metadata row
            sheet.mergeCells('A2:O2')
            const dateCell = sheet.getCell('A2')
            dateCell.value = `Generated At: ${new Date().toLocaleString()}`
            dateCell.alignment = { horizontal: 'center', vertical: 'middle' }
            dateCell.fill = titleFill
            dateCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FFFFFFFF' } }

            sheet.getRow(1).height = 30
            sheet.getRow(2).height = 20

            // Skip row 3

            // Column Header Block
            const headers = [
                'TEAM MEMBER NAME',
                'DATE',
                'MAIN TASK',
                'SUB TASK',
                'DURATION',
                'START TIME',
                'END TIME',
                'HOURS TAKEN',
                'NAME OF CLIENT',
                'SUB TASK DESCRIPTION',
                'TASK STATUS',
                '% COMPLETION',
                'FINAL REMARK',
                'CA REVIEW',
                'CA REMARK'
            ]

            const headerRow = sheet.getRow(4)
            headerRow.height = 28

            headers.forEach((h, idx) => {
                const cell = headerRow.getCell(idx + 1) // Start from Col A (index 1)
                cell.value = h
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF154673' } // Dark blue
                }
                cell.font = {
                    name: 'Segoe UI',
                    size: 11,
                    bold: true,
                    color: { argb: 'FFFFFFFF' }
                }
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                    right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
                }
            })

            // Populate rows
            displayedReports.forEach((item, rIdx) => {
                const rowNum = 5 + rIdx
                const row = sheet.getRow(rowNum)
                row.height = 22

                const values = [
                    item.user_name,
                    item.date,
                    item.main_task,
                    item.sub_task || '—',
                    item.duration || '—',
                    item.start_time || '—',
                    item.end_time || '—',
                    item.hours_taken || 0,
                    item.client_name,
                    item.sub_task_description || '—',
                    item.status.toUpperCase(),
                    (item.pct_completion || 0) / 100, // For percentage styling
                    item.final_remark || '—',
                    item.ca_review || 'PENDING',
                    item.ca_remark || '—'
                ]

                values.forEach((val, cIdx) => {
                    const cell = row.getCell(cIdx + 1)
                    cell.value = val
                    cell.font = bodyFont
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                    }
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }

                    // Formatting specifics
                    if (cIdx === 1) { // Date
                        cell.alignment = { horizontal: 'center', vertical: 'middle' }
                    } else if (cIdx === 7) { // Hours
                        cell.numFmt = '0.00" HRS"'
                        cell.alignment = { horizontal: 'right', vertical: 'middle' }
                    } else if (cIdx === 11) { // % Completion
                        cell.numFmt = '0%'
                        cell.alignment = { horizontal: 'right', vertical: 'middle' }
                    } else if (cIdx === 10) { // Status Badge Accent
                        cell.alignment = { horizontal: 'center', vertical: 'middle' }
                        if (val === 'COMPLETE') {
                            cell.font = { ...bodyFont, bold: true, color: { argb: 'FF2E7D32' } }
                        } else if (val === 'WORK_IN_PROGRESS') {
                            cell.font = { ...bodyFont, bold: true, color: { argb: 'FF1565C0' } }
                        } else {
                            cell.font = { ...bodyFont, color: { argb: 'FF757575' } }
                        }
                    } else if (cIdx === 13) { // CA Review accent
                        cell.alignment = { horizontal: 'center', vertical: 'middle' }
                        if (val && val !== 'PENDING') {
                            cell.font = { ...bodyFont, bold: true, color: { argb: 'FF2E7D32' } }
                        }
                    }
                })
            })

            // Auto-adjust Column widths
            sheet.columns.forEach((col, idx) => {
                let maxLen = 12
                sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
                    if (rowNum < 4) return // Skip title block
                    const cellVal = row.getCell(idx + 1).value
                    if (cellVal) {
                        const len = String(cellVal).length
                        if (len > maxLen) maxLen = len
                    }
                })
                col.width = Math.min(maxLen + 4, 30) // Cap max width at 30 to avoid giant rows
            })

            // Generate buffer
            const buffer = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `DAILY_WORK_PROGRESS_REPORT_${new Date().toISOString().substring(0, 10)}.xlsx`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)

            toast.success('Professional Progress Report exported successfully!')
        } catch (err) {
            console.error(err)
            toast.error('Failed to export Excel report')
        }
    }

    // Dynamic work types + default tasks list (avoiding duplicates)
    const combinedMainTasks = [
        ...DEFAULT_MAIN_TASKS,
        ...workTypes.map(w => w.name).filter(name => !DEFAULT_MAIN_TASKS.includes(name))
    ]

    const combinedDurations = [
        ...DURATION_OPTIONS,
        ...customDurations.map(cd => ({ value: cd, label: cd }))
    ]

    // Calculated metrics
    const displayedReports = filterStatus ? reports.filter(r => r.status === filterStatus) : reports
    const totalHours = displayedReports.reduce((acc, curr) => acc + (curr.hours_taken || 0), 0)
    const pendingReviews = displayedReports.filter(r => !r.ca_review).length
    const completionAvg = displayedReports.length > 0 
        ? Math.round(displayedReports.reduce((acc, curr) => acc + (curr.pct_completion || 0), 0) / displayedReports.length) 
        : 0

    // Status counts based on loaded reports
    const pendingCount = reports.filter(r => r.status === 'pending').length
    const wipCount = reports.filter(r => r.status === 'work_in_progress').length
    const completeCount = reports.filter(r => r.status === 'complete').length
    const notToBeDoneCount = reports.filter(r => r.status === 'not_to_be_done').length
    const otherCount = reports.filter(r => r.status === 'other').length

    return (
        <div className="space-y-8 pb-12 transition-all">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Team Work Reports</h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">
                        Select an employee folder below to overview their progress, logged hours, and review their activities.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button 
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-semibold text-xs uppercase tracking-wider active:scale-95 transition shadow-sm cursor-pointer"
                    >
                        <svg className="w-3.5 h-3.5 text-red-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        Download PDF
                    </button>
                    <button 
                        onClick={handleExportExcel}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-semibold text-xs uppercase tracking-wider active:scale-95 transition shadow-sm cursor-pointer"
                    >
                        <FileSpreadsheet size={14} className="text-emerald-700" />
                        Export Excel
                    </button>
                    <button 
                        onClick={openCreateModal}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0f1c2e] hover:bg-[#1a304e] active:scale-95 text-white font-semibold text-xs uppercase tracking-wider transition shadow-sm cursor-pointer"
                    >
                        <Plus size={14} />
                        Log Today's Work
                    </button>
                </div>
            </div>

            {isCA && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5 animate-fade-in">
                    <h3 className="text-xs font-bold text-gray-855 uppercase tracking-wider flex items-center gap-1.5">
                        <Users size={14} className="text-[#1F5C99]" />
                        Team Members
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 select-none">
                        {/* All Team Members Card */}
                        <div 
                            onClick={() => {
                                setSelectedStaffId("all");
                                setFilterStaff("");
                            }}
                            className={`group cursor-pointer p-2 rounded-xl border transition-all duration-200 flex items-center gap-2.5 w-full ${
                                selectedStaffId === 'all' 
                                    ? 'ring-2 ring-[#1F5C99]/20 border-[#1F5C99] bg-[#EEF4FB] font-bold shadow-sm' 
                                    : 'bg-white border-slate-200 hover:border-[#1F5C99] hover:shadow-md'
                            }`}
                        >
                            <div className="p-1.5 rounded-lg bg-slate-100 flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shrink-0 shadow-sm">
                                <Folder size={16} className="text-slate-650" fill="currentColor" fillOpacity={0.2} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className={`text-xs truncate transition-colors ${selectedStaffId === 'all' ? 'text-[#1F5C99] font-extrabold' : 'text-gray-800 font-semibold group-hover:text-[#1F5C99]'}`}>
                                    All Team Members
                                </h4>
                                <p className="text-[9px] text-[#1F5C99] font-bold uppercase tracking-wider mt-0.5">
                                    Unified View
                                </p>
                            </div>
                        </div>

                        {/* Staff Cards */}
                        {staff.map((member, idx) => {
                            const colors = [
                                { bg: 'bg-blue-50', text: 'text-blue-500' },
                                { bg: 'bg-orange-50', text: 'text-orange-500' },
                                { bg: 'bg-emerald-50', text: 'text-emerald-500' },
                                { bg: 'bg-sky-50', text: 'text-sky-500' },
                                { bg: 'bg-teal-50', text: 'text-teal-500' },
                                { bg: 'bg-red-50', text: 'text-red-500' },
                                { bg: 'bg-indigo-50', text: 'text-indigo-500' },
                                { bg: 'bg-purple-50', text: 'text-purple-500' },
                                { bg: 'bg-pink-50', text: 'text-pink-500' },
                            ];
                            const color = colors[idx % colors.length];

                            const borderClasses = {
                                'text-slate-500': 'border-slate-200 hover:border-slate-500',
                                'text-blue-500': 'border-blue-200 hover:border-blue-500',
                                'text-orange-500': 'border-orange-200 hover:border-orange-500',
                                'text-emerald-500': 'border-emerald-200 hover:border-emerald-500',
                                'text-sky-500': 'border-sky-200 hover:border-sky-500',
                                'text-teal-500': 'border-teal-200 hover:border-teal-500',
                                'text-red-500': 'border-red-200 hover:border-red-500',
                                'text-indigo-500': 'border-indigo-200 hover:border-indigo-500',
                                'text-purple-500': 'border-purple-200 hover:border-purple-500',
                                'text-pink-500': 'border-pink-200 hover:border-pink-500',
                            };
                            const colorClasses = borderClasses[color.text] || 'border-slate-200 hover:border-[#1F5C99]';
                            const isActive = selectedStaffId === member.id;

                            return (
                                <div 
                                    key={member.id}
                                    onClick={() => {
                                        setSelectedStaffId(member.id);
                                        setFilterStaff(member.id);
                                    }}
                                    className={`group cursor-pointer p-2 rounded-xl border transition-all duration-200 flex items-center gap-2.5 w-full ${
                                        isActive 
                                            ? 'ring-2 ring-[#1F5C99]/20 border-[#1F5C99] bg-[#EEF4FB] font-bold shadow-sm' 
                                            : `bg-white ${colorClasses} hover:shadow-md`
                                    }`}
                                >
                                    <div className={`p-1.5 rounded-lg ${color.bg} flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shrink-0 shadow-sm`}>
                                        <Folder size={16} className={color.text} fill="currentColor" fillOpacity={0.2} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className={`text-xs truncate transition-colors ${isActive ? 'text-[#1F5C99] font-extrabold' : 'text-gray-800 font-semibold group-hover:text-[#1F5C99]'}`} title={member.name}>
                                            {member.name}
                                        </h4>
                                        <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5 truncate" title={member.custom_roles && member.custom_roles.length > 0 ? member.custom_roles.map(r => r.name).join(', ') : (member.role_label || (member.role === 'ca' ? 'CA Admin' : 'Staff'))}>
                                            {member.custom_roles && member.custom_roles.length > 0 
                                                ? member.custom_roles.map(r => r.name).join(', ') 
                                                : member.role_label || (member.role === 'ca' ? 'CA Admin' : 'Staff')}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Premium Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-white to-blue-50/20 p-4 rounded-2xl border border-blue-100/50 shadow-sm flex items-center gap-4 hover:shadow-md hover:border-blue-100 transition-all duration-200">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1F5C99] to-[#3b82f6] text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Clock size={20} />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Hours Logged</p>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{totalHours.toFixed(1)} hrs</p>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-white to-emerald-50/20 p-4 rounded-2xl border border-emerald-100/50 shadow-sm flex items-center gap-4 hover:shadow-md hover:border-emerald-100 transition-all duration-200">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <CheckSquare size={20} />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Logged Activities</p>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{displayedReports.length}</p>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-white to-amber-50/20 p-4 rounded-2xl border border-amber-100/50 shadow-sm flex items-center gap-4 hover:shadow-md hover:border-amber-100 transition-all duration-200">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <UserCheck size={20} />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending Reviews</p>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{pendingReviews}</p>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-white to-[#F9F7FC] p-4 rounded-2xl border border-purple-100/50 shadow-sm flex items-center gap-4 hover:shadow-md hover:border-purple-100 transition-all duration-200">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Briefcase size={20} />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Avg Completion %</p>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{completionAvg}%</p>
                    </div>
                </div>
            </div>

            {/* Interactive Status Cards Grid */}
            <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-650 uppercase tracking-wider px-1">Filter by Status</p>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                        {
                            status: '',
                            label: 'All Status',
                            count: reports.length,
                            colorClass: 'bg-[#1F5C99]',
                            textClass: 'text-[#1F5C99]',
                            activeBorder: 'border-[#1F5C99]',
                            activeBg: 'bg-[#EEF4FB]',
                            ring: 'ring-[#1F5C99]/10'
                        },
                        {
                            status: 'pending',
                            label: 'Pending',
                            count: pendingCount,
                            colorClass: 'bg-amber-400',
                            textClass: 'text-amber-700',
                            activeBorder: 'border-amber-400',
                            activeBg: 'bg-amber-50/30',
                            ring: 'ring-amber-400/10'
                        },
                        {
                            status: 'work_in_progress',
                            label: 'In Progress',
                            count: wipCount,
                            colorClass: 'bg-blue-500',
                            textClass: 'text-blue-700',
                            activeBorder: 'border-blue-500',
                            activeBg: 'bg-blue-50/30',
                            ring: 'ring-blue-500/10'
                        },
                        {
                            status: 'complete',
                            label: 'Complete',
                            count: completeCount,
                            colorClass: 'bg-emerald-500',
                            textClass: 'text-emerald-700',
                            activeBorder: 'border-emerald-500',
                            activeBg: 'bg-emerald-50/30',
                            ring: 'ring-emerald-500/10'
                        },
                        {
                            status: 'not_to_be_done',
                            label: 'Not To Be Done',
                            count: notToBeDoneCount,
                            colorClass: 'bg-rose-500',
                            textClass: 'text-rose-700',
                            activeBorder: 'border-rose-500',
                            activeBg: 'bg-rose-50/30',
                            ring: 'ring-rose-500/10'
                        },
                        {
                            status: 'other',
                            label: 'Other',
                            count: otherCount,
                            colorClass: 'bg-slate-400',
                            textClass: 'text-slate-700',
                            activeBorder: 'border-slate-400',
                            activeBg: 'bg-slate-50',
                            ring: 'ring-slate-400/10'
                        }
                    ].map(c => (
                        <button
                            key={c.status}
                            type="button"
                            onClick={() => setFilterStatus(c.status)}
                            className={`flex items-center justify-between px-3 py-1.5 rounded-xl border transition-all duration-150 shadow-sm ${
                                filterStatus === c.status
                                    ? `${c.activeBorder} ${c.activeBg} ring-1 ${c.ring} font-bold`
                                    : 'bg-white border-slate-200 hover:border-slate-350 hover:shadow'
                            }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${c.colorClass} shadow-sm`}></span>
                                <span className="text-[10px] font-bold text-slate-750 uppercase tracking-wider">{c.label}</span>
                            </div>
                            <span className={`text-xs font-extrabold ${c.textClass}`}>{c.count}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter Section with high-quality widgets */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Search size={14} className="text-[#1F5C99]" />
                        Search & Advanced Filters
                    </h3>
                    <button 
                        onClick={() => {
                            setSearch('')
                            setFilterStaff('')
                            setFilterClient('')
                            setFilterStatus('')
                            const todayStr = new Date().toISOString().substring(0, 10)
                            setStartDate(todayStr)
                            setEndDate(todayStr)
                        }}
                        className="text-[10px] font-semibold text-gray-400 hover:text-red-500 active:text-red-600 transition flex items-center gap-1"
                    >
                        <RefreshCw size={10} /> Clear all filters
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {/* Search field */}
                    <div className="relative md:col-span-2">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search tasks, descriptions, clients..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] transition font-semibold"
                        />
                    </div>

                    {/* Employee Filter - CA Only */}
                    {isCA ? (
                        <CustomSelect
                            value={filterStaff}
                            onChange={e => setFilterStaff(e.target.value)}
                            options={[
                                { value: '', label: 'All Team Members' },
                                ...(user ? [{ value: user.id, label: `${user.name} (Admin / Me)` }] : []),
                                ...staff.map(s => ({ value: s.id, label: s.name }))
                            ]}
                            widthClass="w-full sm:w-auto"
                        />
                    ) : (
                        <div className="py-1.5 px-3 text-xs bg-gray-50 border border-slate-200 rounded-lg text-gray-450 font-bold italic">
                            My Logs only
                        </div>
                    )}

                    {/* Client Filter */}
                    <CustomSelect
                        value={filterClient}
                        onChange={e => setFilterClient(e.target.value)}
                        options={[
                            { value: '', label: 'All Clients (Optional)' },
                            ...clients.map(c => ({ value: c.id, label: c.name }))
                        ]}
                        widthClass="w-full sm:w-auto"
                    />

                    {/* Custom Date Range Picker */}
                    <div className="relative col-span-1 sm:col-span-2">
                        <button
                            type="button"
                            onClick={() => setShowCustomCalendar(!showCustomCalendar)}
                            className="w-full flex items-center justify-between gap-1.5 py-1.5 px-3 text-xs bg-gray-50 border border-slate-200 rounded-lg hover:border-slate-350 transition text-gray-700 font-semibold shadow-sm"
                        >
                            <div className="flex items-center gap-1.5">
                                <Calendar size={13} className="text-[#1F5C99]" />
                                <span>
                                    {startDate && endDate 
                                        ? `${formatDate(startDate)} - ${formatDate(endDate)}` 
                                        : startDate 
                                            ? `${formatDate(startDate)} - Select End` 
                                            : 'Select Date Range'}
                                </span>
                            </div>
                            <ChevronDown size={12} className="text-gray-400" />
                        </button>
                        
                        {showCustomCalendar && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 p-3 z-50 w-64 animate-fade-in">
                                {/* Month Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <button 
                                        type="button"
                                        onClick={prevCalendarMonth} 
                                        className="p-1 hover:bg-gray-100 rounded-md transition text-gray-600 font-bold text-xs"
                                    >
                                        &larr;
                                    </button>
                                    <h4 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider">
                                        {calendarDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
                                    </h4>
                                    <button 
                                        type="button"
                                        onClick={nextCalendarMonth} 
                                        className="p-1 hover:bg-gray-100 rounded-md transition text-gray-600 font-bold text-xs"
                                    >
                                        &rarr;
                                    </button>
                                </div>
                                
                                {/* Days Header */}
                                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                        <span key={d} className="text-[10px] font-bold text-gray-400 uppercase">
                                            {d}
                                        </span>
                                    ))}
                                </div>
                                
                                {/* Days Grid */}
                                <div className="grid grid-cols-7 gap-1">
                                    {calDays.map((date, i) => {
                                        const isSelected = isDateSelected(date)
                                        const isInRange = isDateInRange(date)
                                        const isToday = isDateToday(date)
                                        
                                        return (
                                            <div key={i} className="flex items-center justify-center h-8">
                                                {date ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCalendarDateClick(date)}
                                                        className={`w-7 h-7 flex items-center justify-center text-xs font-semibold rounded-full transition-all
                                                            ${isSelected 
                                                                ? 'bg-[#1F5C99] text-white shadow font-bold' 
                                                                : isInRange 
                                                                    ? 'bg-[#EEF4FB] text-[#1F5C99] rounded-none w-full h-7' 
                                                                    : isToday 
                                                                        ? 'border border-[#1F5C99] text-[#1F5C99]' 
                                                                        : 'text-gray-700 hover:bg-gray-100'
                                                            }
                                                        `}
                                                    >
                                                        {date.getDate()}
                                                    </button>
                                                ) : (
                                                    <span className="w-7 h-7"></span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                
                                {/* Action row */}
                                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px]">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const todayStr = new Date().toISOString().substring(0, 10)
                                            setStartDate(todayStr)
                                            setEndDate(todayStr)
                                        }}
                                        className="text-red-550 hover:underline font-bold"
                                    >
                                        Reset to Today
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomCalendar(false)}
                                        className="bg-[#1F5C99] text-white px-3 py-1.5 rounded-lg font-bold shadow-sm hover:bg-[#154675] transition"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Interactive Data Table Area */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="py-20 flex justify-center"><Spinner /></div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#154673] bg-[#1F5C99]">
                                    <th className="px-6 py-3.5 text-left whitespace-nowrap">#</th>
                                    {isCA && <th className="px-6 py-3.5 text-left whitespace-nowrap">Team Member</th>}
                                    <th onClick={() => handleSort('date')} className="px-6 py-3.5 text-left whitespace-nowrap cursor-pointer hover:bg-[#154673] transition-colors">
                                        <div className="flex items-center gap-1.5">
                                            Date <ArrowUpDown size={11} className="text-blue-100" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3.5 text-left whitespace-nowrap">Main Task / Work Type</th>
                                    <th className="px-6 py-3.5 text-left whitespace-nowrap">Sub Task</th>
                                    <th className="px-6 py-3.5 text-left whitespace-nowrap">Duration</th>
                                    <th className="px-6 py-3.5 text-center whitespace-nowrap">Start Time</th>
                                    <th className="px-6 py-3.5 text-center whitespace-nowrap">End Time</th>
                                    <th onClick={() => handleSort('hours_taken')} className="px-6 py-3.5 text-right whitespace-nowrap cursor-pointer hover:bg-[#154673] transition-colors">
                                        <div className="flex items-center gap-1.5 justify-end">
                                            Hours <ArrowUpDown size={11} className="text-blue-100" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3.5 text-left whitespace-nowrap">Client</th>
                                    <th className="px-6 py-3.5 text-left whitespace-nowrap">Sub Task Description</th>
                                    <th className="px-6 py-3.5 text-left whitespace-nowrap">Status</th>
                                    <th onClick={() => handleSort('pct_completion')} className="px-6 py-3.5 text-center whitespace-nowrap cursor-pointer hover:bg-[#154673] transition-colors">
                                        <div className="flex items-center gap-1.5 justify-center">
                                            % Done <ArrowUpDown size={11} className="text-blue-100" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3.5 text-left whitespace-nowrap">Final Remark</th>
                                    <th className="px-6 py-3.5 text-left whitespace-nowrap">CA Review</th>
                                    <th className="px-6 py-3.5 text-left whitespace-nowrap">CA Remark</th>
                                    <th className="px-6 py-3.5 text-center whitespace-nowrap sticky right-0 bg-[#1F5C99] z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] border-b border-[#154673] text-white">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {[...displayedReports, ...inlineNewRows].length === 0 ? (
                                    <tr>
                                        <td colSpan={isCA ? 17 : 16} className="text-center py-20 text-gray-400 font-medium">
                                            <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
                                            No daily work progress reports found matching your criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    [...displayedReports, ...inlineNewRows].map((report, idx) => {
                                        const isEditing = editingRowId === report.id;
                                        if (isEditing) {
                                            return (
                                                <tr key={report.id} className="bg-blue-50/40 hover:bg-blue-50/60 transition">
                                                    <td className="px-6 py-4 text-gray-400 font-bold">
                                                        {String(report.id).startsWith('new-') ? 'New' : idx + 1}
                                                    </td>
                                                    {isCA && (
                                                        <td className="px-6 py-4 font-bold whitespace-nowrap">
                                                            <select 
                                                                value={inlineForm.user_id} 
                                                                onChange={e => setInlineForm(p => ({ ...p, user_id: e.target.value }))}
                                                                className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
                                                            >
                                                                <option value={user?.id}>{user?.name} (Admin / Me)</option>
                                                                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                            </select>
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <input 
                                                            type="date" 
                                                            value={inlineForm.date} 
                                                            onChange={e => setInlineForm(p => ({ ...p, date: e.target.value }))} 
                                                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white font-semibold"
                                                            required
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <select 
                                                            value={inlineForm.main_task} 
                                                            onChange={e => setInlineForm(p => ({ ...p, main_task: e.target.value }))}
                                                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
                                                            required
                                                        >
                                                            {combinedMainTasks.map(t => <option key={t} value={t}>{t}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <input 
                                                            type="text" 
                                                            value={inlineForm.sub_task} 
                                                            onChange={e => setInlineForm(p => ({ ...p, sub_task: e.target.value }))} 
                                                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white w-32 font-semibold"
                                                            placeholder="Sub Task"
                                                            required
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <select 
                                                            value={inlineForm.duration} 
                                                            onChange={e => setInlineForm(p => ({ ...p, duration: e.target.value }))}
                                                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
                                                        >
                                                            {combinedDurations.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <TimePicker12Hour 
                                                            value={inlineForm.start_time} 
                                                            onChange={val => setInlineForm(p => ({ ...p, start_time: val }))} 
                                                            className="!py-1 !px-2 text-xs"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <TimePicker12Hour 
                                                            value={inlineForm.end_time} 
                                                            onChange={val => setInlineForm(p => ({ ...p, end_time: val }))} 
                                                            className="!py-1 !px-2 text-xs"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-gray-800 whitespace-nowrap">
                                                        {calculateHours(inlineForm.start_time, inlineForm.end_time)} hrs
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <select 
                                                            value={inlineForm.client_id || ''} 
                                                            onChange={e => setInlineForm(p => ({ ...p, client_id: e.target.value }))}
                                                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
                                                        >
                                                            <option value="">Select Client</option>
                                                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <input 
                                                            type="text" 
                                                            value={inlineForm.sub_task_description} 
                                                            onChange={e => setInlineForm(p => ({ ...p, sub_task_description: e.target.value }))} 
                                                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white w-40"
                                                            placeholder="Description"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <select 
                                                            value={inlineForm.status} 
                                                            onChange={e => setInlineForm(p => ({ ...p, status: e.target.value }))}
                                                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
                                                        >
                                                            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            max="100" 
                                                            step="5" 
                                                            value={inlineForm.pct_completion} 
                                                            onChange={e => setInlineForm(p => ({ ...p, pct_completion: parseInt(e.target.value) || 0 }))} 
                                                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white w-16"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <input 
                                                            type="text" 
                                                            value={inlineForm.final_remark} 
                                                            onChange={e => setInlineForm(p => ({ ...p, final_remark: e.target.value }))} 
                                                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white w-40"
                                                            placeholder="Remark"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {isCA ? (
                                                            <select 
                                                                value={inlineForm.ca_review} 
                                                                onChange={e => setInlineForm(p => ({ ...p, ca_review: e.target.value }))}
                                                                className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white"
                                                            >
                                                                <option value="">Awaiting Review</option>
                                                                {combinedReviewOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                            </select>
                                                        ) : (
                                                            <span className="text-gray-400 italic text-xs">{inlineForm.ca_review || 'Awaiting Review'}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {isCA ? (
                                                            <input 
                                                                type="text" 
                                                                value={inlineForm.ca_remark} 
                                                                onChange={e => setInlineForm(p => ({ ...p, ca_remark: e.target.value }))} 
                                                                className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white w-40"
                                                                placeholder="Feedback"
                                                            />
                                                        ) : (
                                                            <span className="text-gray-450 text-xs">{inlineForm.ca_remark || '—'}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-center whitespace-nowrap sticky right-0 bg-blue-50/90 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                                                         <div className="flex items-center gap-2 justify-center">
                                                             <button 
                                                                 type="button"
                                                                 onClick={() => handleSaveInlineEdit(report.id)} 
                                                                 disabled={saving}
                                                                 className="p-1.5 text-emerald-600 bg-emerald-50 border border-emerald-250/50 hover:bg-emerald-100 rounded-lg transition cursor-pointer hover:scale-110 active:scale-95 shadow-sm"
                                                                 title="Save"
                                                             >
                                                                 <CheckCircle2 size={16} />
                                                             </button>
                                                             <button 
                                                                 type="button"
                                                                 onClick={() => {
                                                                     setEditingRowId(null);
                                                                     setInlineForm(null);
                                                                     if (String(report.id).startsWith('new-')) {
                                                                         setInlineNewRows(prev => prev.filter(r => r.id !== report.id));
                                                                     }
                                                                 }} 
                                                                 className="p-1.5 text-rose-650 bg-rose-50 border border-rose-250/50 hover:bg-rose-100 rounded-lg transition cursor-pointer hover:scale-110 active:scale-95 shadow-sm"
                                                                 title="Cancel"
                                                             >
                                                                 <X size={16} />
                                                             </button>
                                                         </div>
                                                     </td>
                                                </tr>
                                            );
                                        }

                                        return (
                                            <tr 
                                                key={report.id} 
                                                className={`group hover:bg-slate-100 transition ${
                                                    (pendingUpdates[report.id] && Object.keys(pendingUpdates[report.id]).length > 0)
                                                        ? 'bg-amber-50/80 hover:bg-amber-100/90 border-l-4 border-amber-500'
                                                        : ''
                                                }`}
                                            >
                                                <td className="px-6 py-4 text-gray-400 font-bold">{String(report.id).startsWith('new-') ? 'New' : idx + 1}</td>
                                                {isCA && (
                                                    <td className="px-6 py-4 font-bold text-[#1F5C99] whitespace-nowrap">
                                                        {report.user_name}
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap">
                                                    {formatDate(report.date)}
                                                </td>
                                                <td className="px-6 py-4 text-gray-800 whitespace-nowrap font-medium">
                                                    {report.main_task}
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate" title={report.sub_task}>
                                                    {report.sub_task || '—'}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 whitespace-nowrap font-medium">
                                                    {report.duration || '—'}
                                                </td>
                                                <td className="px-6 py-4 text-center text-gray-500 whitespace-nowrap">
                                                    {formatTime12Hour(report.start_time)}
                                                </td>
                                                <td className="px-6 py-4 text-center text-gray-500 whitespace-nowrap">
                                                    {formatTime12Hour(report.end_time)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-gray-800 whitespace-nowrap">
                                                    {report.hours_taken ? `${report.hours_taken} hrs` : '—'}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 font-semibold whitespace-nowrap">
                                                    {report.client_name || <span className="text-gray-300 italic">Optional</span>}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 max-w-[200px] truncate" title={report.sub_task_description}>
                                                    {report.sub_task_description || '—'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <StatusBadge status={report.status} />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col items-center justify-center gap-1">
                                                        <span className="font-bold text-gray-700 text-xs">{report.pct_completion}%</span>
                                                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-emerald-500" 
                                                                style={{ width: `${report.pct_completion}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 max-w-[200px] truncate" title={report.final_remark}>
                                                    {report.final_remark || '—'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap min-w-[200px]">
                                                    {isCA ? (
                                                        <select
                                                            value={pendingUpdates[report.id]?.ca_review !== undefined ? pendingUpdates[report.id].ca_review : (report.ca_review || '')}
                                                            onChange={e => {
                                                                if (e.target.value === 'ADD_NEW') {
                                                                    handleAddCustomReview(
                                                                        pendingUpdates[report.id]?.ca_review || report.ca_review || '',
                                                                        val => handleBulkFieldChange(report.id, 'ca_review', val)
                                                                    )
                                                                } else {
                                                                    handleBulkFieldChange(report.id, 'ca_review', e.target.value)
                                                                }
                                                            }}
                                                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] text-gray-700 font-semibold bg-white"
                                                        >
                                                            <option value="">Awaiting Review</option>
                                                            {combinedReviewOptions.map(o => (
                                                                <option key={o.value} value={o.value}>{o.label}</option>
                                                            ))}
                                                            <option value="ADD_NEW" className="text-[#1F5C99] font-bold bg-[#1F5C99]/5">+ Add Custom Review Status...</option>
                                                        </select>
                                                    ) : report.ca_review ? (
                                                        <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                                                            {report.ca_review}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300 italic text-xs">Awaiting Review</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 min-w-[180px]">
                                                    {isCA ? (
                                                        <input
                                                            type="text"
                                                            placeholder="Write review comment..."
                                                            value={pendingUpdates[report.id]?.ca_remark !== undefined ? pendingUpdates[report.id].ca_remark : (report.ca_remark || '')}
                                                            onChange={e => handleBulkFieldChange(report.id, 'ca_remark', e.target.value)}
                                                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] text-gray-700 font-semibold bg-white"
                                                        />
                                                    ) : (
                                                        report.ca_remark || '—'
                                                    )}
                                                </td>
                                                <td className={`px-6 py-4 text-center whitespace-nowrap sticky right-0 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] transition ${
                                                    (pendingUpdates[report.id] && Object.keys(pendingUpdates[report.id]).length > 0)
                                                        ? 'bg-amber-50 group-hover:bg-amber-100/90'
                                                        : 'bg-white group-hover:bg-slate-100'
                                                }`}>
                                                    <div className="flex items-center gap-2 justify-center">
                                                         <button 
                                                             type="button"
                                                             onClick={() => handleStartInlineEdit(report)}
                                                             className="px-2 py-1 rounded bg-indigo-50 border border-indigo-150/50 hover:bg-indigo-100 text-indigo-750 font-bold text-xs transition cursor-pointer hover:scale-105 active:scale-95"
                                                             title="Edit Inline"
                                                         >
                                                             Inline Edit
                                                         </button>
                                                         {isCA && (
                                                             <button 
                                                                 type="button"
                                                                 onClick={() => openReviewModal(report)}
                                                                 className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-150/50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition cursor-pointer hover:scale-105 active:scale-95"
                                                                 title="Write Review & Comments"
                                                             >
                                                                 Review
                                                             </button>
                                                         )}
                                                         <button 
                                                             type="button"
                                                             onClick={() => openEditModal(report)}
                                                             className="p-1.5 rounded-lg bg-blue-50/70 border border-blue-100/40 text-blue-600 hover:bg-blue-100 hover:text-blue-800 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                                                             title="Edit Daily Work Log"
                                                         >
                                                             <Edit3 size={15} />
                                                         </button>
                                                         <button 
                                                             type="button"
                                                             onClick={() => {
                                                                 setSelectedReport(report)
                                                                 setDeleteModalOpen(true)
                                                             }}
                                                             className="p-1.5 rounded-lg bg-rose-50/70 border border-rose-100/40 text-rose-600 hover:bg-rose-100 hover:text-rose-800 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                                                             title="Delete Daily Work Log"
                                                         >
                                                             <Trash2 size={15} />
                                                         </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                                    <tr className="bg-gray-50/50 hover:bg-slate-50 transition cursor-pointer" onClick={handleAddRowInline}>
                                        <td colSpan={isCA ? 17 : 16} className="px-6 py-4 text-center text-[#1F5C99] font-bold text-sm">
                                            <div className="flex items-center justify-center gap-2">
                                                <Plus size={16} /> Add New Row Inline
                                            </div>
                                        </td>
                                    </tr>
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Notes Section at the Bottom */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                    <div className="space-y-1">
                        <h3 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2 select-none">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#1F5C99] shadow-sm"></span>
                            Important Notes Registry
                        </h3>
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Internal reminders & administrative observations</p>
                    </div>
                    <span className="text-xs font-bold text-[#1F5C99] bg-[#EEF4FB] px-3 py-1.5 rounded-xl select-none">
                        {new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                </div>

                <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto pr-1">
                    {notesList.map((note, idx) => (
                        <div key={note.id} className="flex flex-col md:flex-row md:items-start gap-4 py-4 first:pt-0 last:pb-0">
                            {/* Date/Time badge */}
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-gray-50 px-2.5 py-1.5 rounded-xl select-none w-fit">
                                <Calendar size={13} className="text-[#1F5C99]" />
                                <span>{note.timestamp}</span>
                            </div>

                            {/* Auto-growing Textarea to wrap text naturally */}
                            <textarea
                                value={note.text}
                                onChange={e => {
                                    handleUpdateNoteText(note.id, e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                }}
                                placeholder="Write your observation/note here... (Saved automatically)"
                                rows={1}
                                className="flex-1 bg-gray-50 border border-slate-200 focus:border-[#1F5C99] outline-none focus:ring-2 focus:ring-[#1F5C99]/15 rounded-xl px-4 py-2.5 text-sm text-gray-700 placeholder-slate-450 font-semibold resize-none h-auto min-h-[38px] transition"
                                style={{ height: 'auto' }}
                                ref={el => {
                                    if (el) {
                                        el.style.height = 'auto';
                                        el.style.height = el.scrollHeight + 'px';
                                    }
                                }}
                            />

                            {/* Always visible action buttons */}
                            <div className="flex items-center gap-2 select-none self-end md:self-start">
                                {idx === notesList.length - 1 && (
                                    <button 
                                        type="button"
                                        onClick={() => handleAddNoteAfter(note.id)}
                                        className="p-2 text-white bg-[#1F5C99] hover:bg-[#154673] rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center"
                                        title="Add Note Row"
                                    >
                                        <Plus size={14} />
                                    </button>
                                )}
                                <button 
                                     type="button"
                                     onClick={() => handleDeleteNote(note.id)}
                                     className="p-2 text-rose-600 bg-rose-50 border border-rose-100/40 hover:bg-rose-100 rounded-xl transition cursor-pointer flex items-center justify-center hover:scale-110 active:scale-95 shadow-sm"
                                     title="Delete Note"
                                 >
                                     <Trash2 size={14} />
                                 </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Daily Log Modal */}
            <Modal
                open={logModalOpen}
                onClose={() => setLogModalOpen(false)}
                title={selectedReport ? "Update Daily Progress Log" : "Log Daily Work Progress Activity"}
                width="max-w-2xl"
            >
                <form onSubmit={handleSaveLog} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Date */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date</label>
                            <input
                                type="date"
                                name="date"
                                value={logForm.date}
                                onChange={handleLogFormChange}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-semibold"
                                required
                            />
                            {formErrors.date && <p className="text-xs text-red-500 mt-1">{formErrors.date[0]}</p>}
                        </div>

                        {/* Employee assignment (Admin only) */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Team Member</label>
                            {isCA ? (
                                <select
                                    name="user_id"
                                    value={logForm.user_id}
                                    onChange={handleLogFormChange}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-semibold"
                                    required
                                >
                                    <option value={user?.id}>{user?.name} (Admin / Me)</option>
                                    {staff.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="px-3 py-2 bg-gray-100 rounded-xl text-gray-600 font-bold text-sm">
                                    {user?.name}
                                </div>
                            )}
                        </div>

                        {/* Main Task / Work Type Selector */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Main Task / Work Type</label>
                                <button 
                                    type="button" 
                                    onClick={() => setNewWorkTypeModalOpen(true)}
                                    className="text-[10px] font-bold text-[#1F5C99] hover:underline"
                                >
                                    + Add New Work Type
                                </button>
                            </div>
                            <select
                                name="main_task"
                                value={logForm.main_task}
                                onChange={e => {
                                    if (e.target.value === 'ADD_NEW') {
                                        setNewWorkTypeModalOpen(true)
                                    } else {
                                        handleLogFormChange(e)
                                    }
                                }}
                                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition text-gray-700 font-semibold"
                                required
                            >
                                <option value="">Select Main Task</option>
                                {combinedMainTasks.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                                <option value="ADD_NEW" className="text-[#1F5C99] font-bold bg-[#1F5C99]/5">+ Add New Work Type...</option>
                            </select>
                            {formErrors.main_task && <p className="text-xs text-red-500 mt-1">{formErrors.main_task[0]}</p>}
                        </div>

                        {/* Subtask Title */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sub Task Title</label>
                            <input
                                type="text"
                                name="sub_task"
                                placeholder="e.g. MCA Search, Audit preparation"
                                value={logForm.sub_task}
                                onChange={handleLogFormChange}
                                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-semibold"
                                required
                            />
                            {formErrors.sub_task && <p className="text-xs text-red-500 mt-1">{formErrors.sub_task[0]}</p>}
                        </div>

                        {/* Duration option */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Duration</label>
                            <select
                                name="duration"
                                value={logForm.duration}
                                onChange={e => {
                                    if (e.target.value === 'ADD_NEW') {
                                        const custom = prompt('Enter custom duration label (e.g. Full Day, 4 Hours, etc.):')
                                        if (custom && custom.trim()) {
                                            const trimmed = custom.trim()
                                            setCustomDurations(prev => [...prev, trimmed])
                                            setLogForm(prev => ({ ...prev, duration: trimmed }))
                                        }
                                    } else {
                                        handleLogFormChange(e)
                                    }
                                }}
                                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition text-gray-700 font-semibold"
                            >
                                {combinedDurations.map(d => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                                <option value="ADD_NEW" className="text-[#1F5C99] font-bold bg-[#1F5C99]/5">+ Add Custom Duration...</option>
                            </select>
                        </div>

                        {/* Hours / Timings */}
                        <div className="grid grid-cols-2 gap-4 md:col-span-2">
                            <TimePicker12Hour
                                value={logForm.start_time}
                                onChange={val => setLogForm(prev => ({ ...prev, start_time: val }))}
                                label="Start Time"
                            />
                            <TimePicker12Hour
                                value={logForm.end_time}
                                onChange={val => setLogForm(prev => ({ ...prev, end_time: val }))}
                                label="End Time"
                            />
                            {currentCalculatedHours > 0 && (
                                <div className="col-span-2 flex items-center gap-2 px-4 py-3 bg-[#EEF4FB] text-[#1F5C99] rounded-xl border border-[#1F5C99]/20 text-xs font-bold">
                                    <Info size={14} /> Total time calculated automatically: {currentCalculatedHours} Hours
                                </div>
                            )}
                        </div>

                        {/* Optional Client Selector / Creator */}
                        <div className="space-y-1 md:col-span-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Name of Client <span className="text-gray-300 font-normal">(Optional)</span>
                                </label>
                                <div className="flex gap-3">
                                    <button 
                                        type="button" 
                                        onClick={() => setNewClientModalOpen(true)}
                                        className="text-[10px] font-bold text-[#1F5C99] hover:underline"
                                    >
                                        + Register New Client
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setIsManualClient(!isManualClient)
                                            setLogForm(prev => ({ ...prev, client_id: '', client_name_custom: '' }))
                                        }}
                                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline"
                                    >
                                        {isManualClient ? 'Choose from registry' : 'Type manual text instead'}
                                    </button>
                                </div>
                            </div>

                            {isManualClient ? (
                                <input
                                    type="text"
                                    name="client_name_custom"
                                    placeholder="Enter client name as text..."
                                    value={logForm.client_name_custom}
                                    onChange={handleLogFormChange}
                                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-semibold"
                                />
                            ) : (
                                <select
                                    name="client_id"
                                    value={logForm.client_id}
                                    onChange={e => {
                                        if (e.target.value === 'ADD_NEW') {
                                            setNewClientModalOpen(true)
                                        } else {
                                            handleLogFormChange(e)
                                        }
                                    }}
                                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition text-gray-700 font-semibold"
                                >
                                    <option value="">Select Client (Optional)</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                    <option value="ADD_NEW" className="text-[#1F5C99] font-bold bg-[#1F5C99]/5">+ Register New Client...</option>
                                </select>
                            )}
                        </div>

                        {/* Task Status */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Task Status</label>
                            <select
                                name="status"
                                value={logForm.status}
                                onChange={handleLogFormChange}
                                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition text-gray-700 font-semibold"
                                required
                            >
                                {STATUS_OPTIONS.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* % Completion */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                                % Completion ({logForm.pct_completion}%)
                            </label>
                            <div className="flex items-center gap-3 pt-2">
                                <input
                                    type="range"
                                    name="pct_completion"
                                    min="0"
                                    max="100"
                                    step="5"
                                    value={logForm.pct_completion}
                                    onChange={handleLogFormChange}
                                    className="w-full accent-[#0f1c2e] cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Sub task description */}
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sub Task Description</label>
                            <textarea
                                name="sub_task_description"
                                rows={2}
                                placeholder="Describe details of the task performed..."
                                value={logForm.sub_task_description}
                                onChange={handleLogFormChange}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20"
                            />
                        </div>

                        {/* Final Remark */}
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Final Remark / Observations</label>
                            <textarea
                                name="final_remark"
                                rows={2}
                                placeholder="Any additional notes or problems faced..."
                                value={logForm.final_remark}
                                onChange={handleLogFormChange}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2"
                            />
                        </div>

                        {/* CA Review and CA Remark (Admin only) */}
                        {isCA && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">CA Review Status</label>
                                    <select
                                        name="ca_review"
                                        value={logForm.ca_review}
                                        onChange={e => {
                                            if (e.target.value === 'ADD_NEW') {
                                                handleAddCustomReview(logForm.ca_review, val => setLogForm(prev => ({ ...prev, ca_review: val })))
                                            } else {
                                                handleLogFormChange(e)
                                            }
                                        }}
                                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 text-gray-700 font-semibold"
                                    >
                                        <option value="">Awaiting Review</option>
                                        {combinedReviewOptions.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                        <option value="ADD_NEW" className="text-[#1F5C99] font-bold bg-[#1F5C99]/5">+ Add Custom Review Status...</option>
                                    </select>
                                </div>

                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">CA Remark / Feedback</label>
                                    <textarea
                                        name="ca_remark"
                                        rows={2}
                                        placeholder="Admin feedback or remarks regarding the work quality..."
                                        value={logForm.ca_remark}
                                        onChange={handleLogFormChange}
                                        className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2"
                                    />
                                </div>
                            </>
                        )}
                    </div>



                    {/* Buttons */}
                    <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setLogModalOpen(false)}
                            className="px-5 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-bold transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2 text-sm bg-[#0f1c2e] hover:bg-[#1c324e] text-white rounded-xl font-bold transition disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Log'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* CA Review Modal */}
            <Modal
                open={reviewModalOpen}
                onClose={() => setReviewModalOpen(false)}
                title="Log CA Review & Remarks"
                width="max-w-md"
            >
                <form onSubmit={handleSaveReview} className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-1">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Task Info</p>
                        <p className="text-sm font-bold text-gray-900">{selectedReport?.sub_task}</p>
                        <p className="text-xs text-gray-500 font-semibold">{selectedReport?.user_name} • {selectedReport?.date}</p>
                    </div>

                    {/* CA Review Status dropdown */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">CA Review Status</label>
                        <select
                            value={reviewForm.ca_review}
                            onChange={e => {
                                if (e.target.value === 'ADD_NEW') {
                                    handleAddCustomReview(reviewForm.ca_review, val => setReviewForm(prev => ({ ...prev, ca_review: val })))
                                } else {
                                    setReviewForm(prev => ({ ...prev, ca_review: e.target.value }))
                                }
                            }}
                            className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none text-gray-700 font-semibold"
                            required
                        >
                            {combinedReviewOptions.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                            <option value="ADD_NEW" className="text-[#1F5C99] font-bold bg-[#1F5C99]/5">+ Add Custom Review Status...</option>
                        </select>
                    </div>

                    {/* CA Remark */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">CA Remarks</label>
                        <textarea
                            rows={3}
                            placeholder="Write your feedback..."
                            value={reviewForm.ca_remark}
                            onChange={e => setReviewForm(prev => ({ ...prev, ca_remark: e.target.value }))}
                            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-3">
                        <button
                            type="button"
                            onClick={() => setReviewModalOpen(false)}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 font-bold transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2 text-sm bg-[#0f1c2e] hover:bg-[#1a304e] text-white rounded-xl font-bold transition"
                        >
                            {saving ? 'Saving...' : 'Submit Review'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Inline Add Client Modal */}
            <Modal
                open={newClientModalOpen}
                onClose={() => setNewClientModalOpen(false)}
                title="Register New Client"
                width="max-w-3xl"
            >
                <form onSubmit={handleCreateClient} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Client Name */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Client Name *</label>
                            <input
                                type="text"
                                value={newClientForm.name}
                                onChange={e => setNewClientForm(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20"
                                placeholder="e.g. Genx Riders Pvt Ltd"
                                required
                            />
                        </div>

                        {/* Client Name As per PAN */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Client Name As Per PAN</label>
                            <input
                                type="text"
                                value={newClientForm.name_as_per_pan}
                                onChange={e => setNewClientForm(prev => ({ ...prev, name_as_per_pan: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20"
                                placeholder="Exactly as printed on PAN"
                            />
                        </div>

                        {/* Client Type select */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Client Type *</label>
                            <select
                                value={newClientForm.type}
                                onChange={e => setNewClientForm(prev => ({ ...prev, type: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 text-gray-700 font-semibold"
                                required
                            >
                                <option value="">Select Type...</option>
                                {clientTypes.map(t => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Client Group select */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Client Group *</label>
                            <select
                                value={newClientForm.group}
                                onChange={e => setNewClientForm(prev => ({ ...prev, group: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 text-gray-700 font-semibold"
                                required
                            >
                                <option value="">Select Group...</option>
                                {clientGroups.map(g => (
                                    <option key={g.id} value={g.name}>{g.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* PAN Number */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">PAN No. *</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    maxLength={10}
                                    value={newClientForm.pan_no}
                                    onChange={e => setNewClientForm(prev => ({ ...prev, pan_no: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 uppercase pr-8"
                                    placeholder="e.g. ABCDE1234F"
                                    required
                                />
                                {panStatus && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                        {panStatus.valid ? (
                                            <ShieldCheck size={16} className="text-emerald-500" />
                                        ) : (
                                            <ShieldAlert size={16} className="text-rose-500" />
                                        )}
                                    </div>
                                )}
                            </div>
                            {panStatus && (
                                <p className={`text-[10px] font-bold mt-0.5 ${panStatus.valid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {panStatus.msg}
                                </p>
                            )}
                        </div>

                        {/* GST Number */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">GST Number</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    maxLength={15}
                                    value={newClientForm.gst_number}
                                    onChange={e => setNewClientForm(prev => ({ ...prev, gst_number: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 uppercase pr-8"
                                    placeholder="e.g. 22AAAAA0000A1Z5"
                                />
                                {gstStatus && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                        {gstStatus.valid ? (
                                            <ShieldCheck size={16} className="text-emerald-500" />
                                        ) : (
                                            <ShieldAlert size={16} className="text-rose-500" />
                                        )}
                                    </div>
                                )}
                            </div>
                            {gstStatus && (
                                <p className={`text-[10px] font-bold mt-0.5 ${gstStatus.valid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {gstStatus.msg}
                                </p>
                            )}
                        </div>

                        {/* Date of Birth */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Date of Birth</label>
                            <input
                                type="date"
                                value={newClientForm.dob}
                                onChange={e => setNewClientForm(prev => ({ ...prev, dob: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20"
                            />
                        </div>

                        {/* Reference No */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Reference No.</label>
                            <input
                                type="text"
                                value={newClientForm.reference_no}
                                onChange={e => setNewClientForm(prev => ({ ...prev, reference_no: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20"
                                placeholder="Internal ref or code"
                            />
                        </div>

                        {/* Contact No */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Contact No.</label>
                            <input
                                type="text"
                                maxLength={10}
                                value={newClientForm.contact}
                                onChange={e => setNewClientForm(prev => ({ ...prev, contact: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20"
                                placeholder="10-digit number"
                            />
                        </div>

                        {/* Alternative Contact */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Alt. Contact No.</label>
                            <input
                                type="text"
                                maxLength={10}
                                value={newClientForm.alternative_contact}
                                onChange={e => setNewClientForm(prev => ({ ...prev, alternative_contact: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20"
                                placeholder="Secondary contact"
                            />
                        </div>

                        {/* Email Address */}
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Email Address</label>
                            <input
                                type="email"
                                value={newClientForm.email}
                                onChange={e => setNewClientForm(prev => ({ ...prev, email: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2"
                                placeholder="client@example.com"
                            />
                        </div>

                        {/* Address segment */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">City</label>
                            <input
                                type="text"
                                value={newClientForm.city}
                                onChange={e => setNewClientForm(prev => ({ ...prev, city: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                                placeholder="City"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Pin Code</label>
                            <input
                                type="text"
                                value={newClientForm.pin_code}
                                onChange={e => setNewClientForm(prev => ({ ...prev, pin_code: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                                placeholder="Pin Code"
                            />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">State</label>
                            <input
                                type="text"
                                value={newClientForm.state}
                                onChange={e => setNewClientForm(prev => ({ ...prev, state: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                                placeholder="State"
                            />
                        </div>

                        {/* Credentials */}
                        <div className="space-y-1 md:col-span-2 pt-2">
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Portal Credentials</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">E-Filing Password</label>
                                    <input
                                        type="text"
                                        value={newClientForm.credentials.efiling_password}
                                        onChange={e => setNewClientForm(prev => ({
                                            ...prev,
                                            credentials: {
                                                ...prev.credentials,
                                                efiling_password: e.target.value
                                            }
                                        }))}
                                        className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                                        placeholder="E-filing portal password"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">AIS & TIS Password (Auto Generated)</label>
                                    <input
                                        type="text"
                                        value={newClientForm.credentials.ais_tis_password}
                                        disabled
                                        className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 text-slate-500 rounded-xl cursor-not-allowed font-mono"
                                        placeholder="lower(PAN) + DOB"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setNewClientModalOpen(false)}
                            className="px-5 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 font-bold transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 text-sm bg-[#0f1c2e] hover:bg-[#1c324e] text-white rounded-xl font-bold transition disabled:opacity-50"
                        >
                            {saving ? 'Registering...' : 'Register Client'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Inline Add Work Type Modal */}
            <Modal
                open={newWorkTypeModalOpen}
                onClose={() => setNewWorkTypeModalOpen(false)}
                title="Add New Work Type"
                width="max-w-md"
            >
                <form onSubmit={handleCreateWorkType} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Work Type Name *</label>
                        <input
                            type="text"
                            value={newWorkTypeForm.name}
                            onChange={e => setNewWorkTypeForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                            placeholder="e.g. INCOME TAX RETURN- SALARY, ROC FILING"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Description</label>
                        <textarea
                            rows={3}
                            value={newWorkTypeForm.description}
                            onChange={e => setNewWorkTypeForm(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                            placeholder="e.g. Standard tax return operations"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-3">
                        <button
                            type="button"
                            onClick={() => setNewWorkTypeModalOpen(false)}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 font-bold transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2 text-sm bg-[#0f1c2e] hover:bg-[#1a304e] text-white rounded-xl font-bold transition"
                        >
                            {saving ? 'Creating...' : 'Add Work Type'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                open={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Delete Report Log"
                width="max-w-md"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Are you sure you want to permanently delete this daily progress log entry? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => setDeleteModalOpen(false)}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 font-bold transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteReport}
                            disabled={saving}
                            className="px-5 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition"
                        >
                            {saving ? 'Deleting...' : 'Delete Permanently'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Custom Review Status Modal */}
            <Modal
                open={customReviewModalOpen}
                onClose={() => {
                    setCustomReviewModalOpen(false)
                    if (customReviewCallback) customReviewCallback(null)
                }}
                title="Add Custom Review Status"
                width="max-w-md"
            >
                <form 
                    onSubmit={e => {
                        e.preventDefault()
                        setCustomReviewModalOpen(false)
                        if (customReviewCallback) customReviewCallback(newCustomReviewVal)
                    }}
                    className="space-y-4"
                >
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                            Custom Review Status Name
                        </label>
                        <input
                            type="text"
                            value={newCustomReviewVal}
                            onChange={e => setNewCustomReviewVal(e.target.value)}
                            placeholder="e.g. VERY SLOW, EXCELLENT"
                            className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-semibold text-gray-800"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => {
                                setCustomReviewModalOpen(false)
                                if (customReviewCallback) customReviewCallback(null)
                            }}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 font-bold transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 text-sm bg-[#0f1c2e] hover:bg-[#1c324e] text-white rounded-xl font-bold transition"
                        >
                            Add Status
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Sliding Bottom Bulk Action Panel */}
            {Object.keys(pendingUpdates).length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50 border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div>
                        <p className="text-sm font-extrabold text-white">Unsaved Bulk Reviews</p>
                        <p className="text-xs text-slate-400 font-medium">You have {Object.keys(pendingUpdates).length} unsaved report reviews.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setPendingUpdates({})}
                            disabled={saving}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
                        >
                            Discard
                        </button>
                        <button
                            onClick={handleSaveAllBulkUpdates}
                            disabled={saving}
                            className="flex items-center gap-2 bg-[#1F5C99] hover:bg-[#154673] text-white px-5 py-2 rounded-xl text-xs font-bold transition shadow-md shadow-[#1F5C99]/20 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save All Reviews'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
