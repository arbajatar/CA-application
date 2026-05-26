import { useState, useEffect, useCallback } from 'react'
import { 
    ClipboardList, Calendar, Users, Briefcase, Clock, 
    FileSpreadsheet, Plus, Search, Edit3, Trash2, CheckCircle2, 
    AlertCircle, ChevronDown, ChevronUp, UserCheck, CheckSquare, 
    ArrowUpDown, RefreshCw, X, MessageSquare, Info,
    ShieldCheck, ShieldAlert
} from 'lucide-react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import ExcelJS from 'exceljs'
import StatusBadge from '../../components/ui/StatusBadge'
import { formatDate } from '../../utils/dateHelper'

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

    const handleAddCustomReview = (currentVal, setterFunc) => {
        const custom = prompt('Enter custom review status (e.g. VERY SLOW, EXCELLENT):')
        if (custom && custom.trim()) {
            const trimmed = custom.trim().toUpperCase()
            if (!CA_REVIEW_OPTIONS.some(o => o.value === trimmed) && !customReviewOptions.includes(trimmed)) {
                setCustomReviewOptions(prev => [...prev, trimmed])
            }
            setterFunc(trimmed)
        } else {
            setterFunc(currentVal || '')
        }
    }

    // States
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')
    const [filterStaff, setFilterStaff] = useState('')
    const [filterClient, setFilterClient] = useState('')
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
            user_id: user?.id || '',
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

    // Excel Export with Professional formatting matching Workbook sheet exactly
    const handleExportExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook()
            
            // Create Sheets corresponding to excel
            const sheet = workbook.addWorksheet('TEAM DAILY WORK PROGRESS REPORT')

            // Enable gridlines
            sheet.views = [{ showGridLines: true }]

            // Style definitions
            const titleFill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F4E78' } // Premium Deep Navy Blue
            }

            const headerFill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF2F5597' } // Muted Steel Blue
            }

            const titleFont = {
                name: 'Segoe UI',
                size: 16,
                bold: true,
                color: { argb: 'FFFFFFFF' }
            }

            const headerFont = {
                name: 'Segoe UI',
                size: 11,
                bold: true,
                color: { argb: 'FFFFFFFF' }
            }

            const bodyFont = {
                name: 'Segoe UI',
                size: 10
            }

            const borderStyle = {
                top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
            }

            // Title Block
            sheet.mergeCells('B2:P3')
            const titleCell = sheet.getCell('B2')
            titleCell.value = 'TEAM DAILY WORK PROGRESS REPORT'
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
            titleCell.fill = titleFill
            titleCell.font = titleFont

            // Metadata row
            sheet.getCell('B4').value = `Generated At: ${new Date().toLocaleString()}`
            sheet.getCell('B4').font = { name: 'Segoe UI', size: 9, italic: true }

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

            const headerRow = sheet.getRow(6)
            headerRow.height = 26

            headers.forEach((h, idx) => {
                const cell = headerRow.getCell(idx + 2) // Start from Col B (index 2)
                cell.value = h
                cell.fill = headerFill
                cell.font = headerFont
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
                cell.border = borderStyle
            })

            // Populate rows
            displayedReports.forEach((item, rIdx) => {
                const rowNum = 7 + rIdx
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
                    const cell = row.getCell(cIdx + 2)
                    cell.value = val
                    cell.font = bodyFont
                    cell.border = borderStyle
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
                if (idx === 0) {
                    col.width = 3 // Margin column A
                    return
                }
                
                let maxLen = 12
                sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
                    if (rowNum < 5) return // Skip title block
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
            {/* Header section with high-end premium aesthetics */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#1F5C99]/5 rounded-full blur-3xl -z-10"></div>
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Team Daily Work Progress Report</h1>
                    <p className="text-sm text-gray-500 font-medium">
                        {isCA ? 'Administrative portal for overviewing employee progress, remarks, and review logging.' : 'My personal workspace for submitting and editing daily progress activities.'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 active:bg-gray-100 transition shadow-sm"
                    >
                        <FileSpreadsheet size={16} className="text-green-600" />
                        Export Excel
                    </button>
                    <button 
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#0f1c2e] hover:bg-[#1a304e] active:bg-[#08101b] text-white font-bold text-sm transition shadow-sm"
                    >
                        <Plus size={16} />
                        Log Today's Work
                    </button>
                </div>
            </div>

            {/* Premium Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-[#EEF4FB] text-[#1F5C99] flex items-center justify-center">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Total Hours Logged</p>
                        <p className="text-2xl font-bold text-gray-800">{totalHours.toFixed(1)} hrs</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckSquare size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Logged Activities</p>
                        <p className="text-2xl font-bold text-gray-800">{displayedReports.length}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <UserCheck size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Pending Reviews</p>
                        <p className="text-2xl font-bold text-gray-800">{pendingReviews}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <ClipboardList size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Avg Completion %</p>
                        <p className="text-2xl font-bold text-gray-800">{completionAvg}%</p>
                    </div>
                </div>
            </div>

            {/* Interactive Status Cards Grid */}
            <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Filter by Status</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {[
                        {
                            status: '',
                            label: 'All Status',
                            count: reports.length,
                            colorClass: 'bg-[#1F5C99]',
                            textClass: 'text-[#1F5C99]',
                            activeBorder: 'border-[#1F5C99]',
                            activeBg: 'bg-[#EEF4FB]',
                            ring: 'ring-[#1F5C99]/20'
                        },
                        {
                            status: 'pending',
                            label: 'Pending',
                            count: pendingCount,
                            colorClass: 'bg-amber-400',
                            textClass: 'text-amber-700',
                            activeBorder: 'border-amber-400',
                            activeBg: 'bg-amber-50/40',
                            ring: 'ring-amber-400/20'
                        },
                        {
                            status: 'work_in_progress',
                            label: 'In Progress',
                            count: wipCount,
                            colorClass: 'bg-blue-500',
                            textClass: 'text-blue-700',
                            activeBorder: 'border-blue-500',
                            activeBg: 'bg-blue-50/40',
                            ring: 'ring-blue-500/20'
                        },
                        {
                            status: 'complete',
                            label: 'Complete',
                            count: completeCount,
                            colorClass: 'bg-emerald-500',
                            textClass: 'text-emerald-700',
                            activeBorder: 'border-emerald-500',
                            activeBg: 'bg-emerald-50/40',
                            ring: 'ring-emerald-500/20'
                        },
                        {
                            status: 'not_to_be_done',
                            label: 'Not To Be Done',
                            count: notToBeDoneCount,
                            colorClass: 'bg-rose-500',
                            textClass: 'text-rose-700',
                            activeBorder: 'border-rose-500',
                            activeBg: 'bg-rose-50/40',
                            ring: 'ring-rose-500/20'
                        },
                        {
                            status: 'other',
                            label: 'Other',
                            count: otherCount,
                            colorClass: 'bg-slate-400',
                            textClass: 'text-slate-700',
                            activeBorder: 'border-slate-400',
                            activeBg: 'bg-slate-50',
                            ring: 'ring-slate-400/20'
                        }
                    ].map(c => (
                        <button
                            key={c.status}
                            type="button"
                            onClick={() => setFilterStatus(c.status)}
                            className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all duration-200 shadow-sm ${
                                filterStatus === c.status
                                    ? `${c.activeBorder} ${c.activeBg} ring-2 ${c.ring} font-bold transform translate-y-[1px]`
                                    : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-md'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${c.colorClass} shadow-sm`}></span>
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</span>
                            </div>
                            <span className={`text-sm font-extrabold ${c.textClass}`}>{c.count}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter Section with high-quality widgets */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                        <Search size={16} className="text-[#1F5C99]" />
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
                        className="text-xs font-semibold text-gray-400 hover:text-red-500 active:text-red-600 transition flex items-center gap-1"
                    >
                        <RefreshCw size={12} /> Clear all filters
                    </button>
                </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {/* Search field */}
                    <div className="relative md:col-span-2">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search tasks, descriptions, clients..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"
                        />
                    </div>

                    {/* Employee Filter - CA Only */}
                    {isCA ? (
                        <select
                            value={filterStaff}
                            onChange={e => setFilterStaff(e.target.value)}
                            className="py-2.5 px-3 text-sm bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition text-gray-700 font-semibold"
                        >
                            <option value="">All Team Members</option>
                            <option value={user?.id}>{user?.name} (Admin / Me)</option>
                            {staff.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="py-2.5 px-4 text-sm bg-gray-50 border border-gray-100 rounded-xl text-gray-400 font-bold italic">
                            My Logs only
                        </div>
                    )}

                    {/* Client Filter */}
                    <select
                        value={filterClient}
                        onChange={e => setFilterClient(e.target.value)}
                        className="py-2.5 px-3 text-sm bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition text-gray-700 font-semibold"
                    >
                        <option value="">All Clients (Optional)</option>
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>

                    {/* Custom Date Range Picker */}
                    <div className="relative col-span-1 sm:col-span-2">
                        <button
                            type="button"
                            onClick={() => setShowCustomCalendar(!showCustomCalendar)}
                            className="w-full flex items-center justify-between gap-2 py-2.5 px-4 text-sm bg-gray-50 border border-gray-100 rounded-xl hover:border-gray-200 transition text-gray-700 font-semibold shadow-sm"
                        >
                            <div className="flex items-center gap-2">
                                <Calendar size={15} className="text-[#1F5C99]" />
                                <span>
                                    {startDate && endDate 
                                        ? `${formatDate(startDate)} - ${formatDate(endDate)}` 
                                        : startDate 
                                            ? `${formatDate(startDate)} - Select End` 
                                            : 'Select Date Range'}
                                </span>
                            </div>
                            <ChevronDown size={14} className="text-gray-400" />
                        </button>
                        
                        {showCustomCalendar && (
                            <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50 w-72 animate-fade-in">
                                {/* Month Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <button 
                                        type="button"
                                        onClick={prevCalendarMonth} 
                                        className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-600 font-bold"
                                    >
                                        &larr;
                                    </button>
                                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                                        {calendarDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
                                    </h4>
                                    <button 
                                        type="button"
                                        onClick={nextCalendarMonth} 
                                        className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-600 font-bold"
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
                                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-100 bg-gray-50">
                                    <th className="px-6 py-4 text-left whitespace-nowrap">#</th>
                                    {isCA && <th className="px-6 py-4 text-left whitespace-nowrap">Team Member</th>}
                                    <th onClick={() => handleSort('date')} className="px-6 py-4 text-left whitespace-nowrap cursor-pointer hover:text-gray-700">
                                        <div className="flex items-center gap-1.5">
                                            Date <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left whitespace-nowrap">Main Task / Work Type</th>
                                    <th className="px-6 py-4 text-left whitespace-nowrap">Sub Task</th>
                                    <th className="px-6 py-4 text-left whitespace-nowrap">Duration</th>
                                    <th className="px-6 py-4 text-center whitespace-nowrap">Start Time</th>
                                    <th className="px-6 py-4 text-center whitespace-nowrap">End Time</th>
                                    <th onClick={() => handleSort('hours_taken')} className="px-6 py-4 text-right whitespace-nowrap cursor-pointer hover:text-gray-700">
                                        <div className="flex items-center gap-1.5 justify-end">
                                            Hours <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left whitespace-nowrap">Client</th>
                                    <th className="px-6 py-4 text-left whitespace-nowrap">Sub Task Description</th>
                                    <th className="px-6 py-4 text-left whitespace-nowrap">Status</th>
                                    <th onClick={() => handleSort('pct_completion')} className="px-6 py-4 text-center whitespace-nowrap cursor-pointer hover:text-gray-700">
                                        <div className="flex items-center gap-1.5 justify-center">
                                            % Done <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left whitespace-nowrap">Final Remark</th>
                                    <th className="px-6 py-4 text-left whitespace-nowrap">CA Review</th>
                                    <th className="px-6 py-4 text-left whitespace-nowrap">CA Remark</th>
                                    <th className="px-6 py-4 text-center whitespace-nowrap sticky right-0 bg-gray-50 z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] border-b border-gray-100">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {displayedReports.length === 0 ? (
                                    <tr>
                                        <td colSpan={isCA ? 17 : 16} className="text-center py-20 text-gray-400 font-medium">
                                            <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
                                            No daily work progress reports found matching your criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    displayedReports.map((report, idx) => (
                                        <tr 
                                            key={report.id} 
                                            className={`group hover:bg-slate-100 transition ${
                                                (pendingUpdates[report.id] && Object.keys(pendingUpdates[report.id]).length > 0)
                                                    ? 'bg-amber-50/80 hover:bg-amber-100/90 border-l-4 border-amber-500'
                                                    : ''
                                            }`}
                                        >
                                            <td className="px-6 py-4 text-gray-400 font-bold">{idx + 1}</td>
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
                                                {report.start_time || '—'}
                                            </td>
                                            <td className="px-6 py-4 text-center text-gray-500 whitespace-nowrap">
                                                {report.end_time || '—'}
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
                                                    {isCA && (
                                                        <button 
                                                            onClick={() => openReviewModal(report)}
                                                            className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition"
                                                            title="Write Review & Comments"
                                                        >
                                                            Review
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => openEditModal(report)}
                                                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition"
                                                        title="Edit Daily Work Log"
                                                    >
                                                        <Edit3 size={15} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedReport(report)
                                                            setDeleteModalOpen(true)
                                                        }}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                                                        title="Delete Daily Work Log"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
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
                        <div className={selectedReport ? "grid grid-cols-2 gap-2" : "space-y-1"}>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Start Time</label>
                                <input
                                    type="time"
                                    name="start_time"
                                    value={logForm.start_time}
                                    onChange={handleLogFormChange}
                                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-semibold"
                                />
                            </div>
                            {selectedReport && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">End Time</label>
                                    <input
                                        type="time"
                                        name="end_time"
                                        value={logForm.end_time}
                                        onChange={handleLogFormChange}
                                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-semibold"
                                    />
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
                                placeholder="Describe details of the subtask performed..."
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

                    {/* Output timing feedback */}
                    {currentCalculatedHours > 0 && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-[#EEF4FB] text-[#1F5C99] rounded-xl border border-[#1F5C99]/20 text-xs font-bold">
                            <Info size={14} /> Total time calculated automatically: {currentCalculatedHours} Hours
                        </div>
                    )}

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
