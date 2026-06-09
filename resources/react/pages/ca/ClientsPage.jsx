import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Search, Pencil, Trash2, ShieldCheck, ShieldAlert, Key, Globe, Eye, EyeOff, FileDown, FileUp, AlertTriangle, CheckCircle2, Copy, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Tooltip from '../../components/ui/Tooltip'
import CustomSelect from '../../components/ui/CustomSelect'
import { useAuth } from '../../context/AuthContext'
import { exportToExcel } from '../../utils/excelExport'

const EMPTY_FORM = {
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
}

export default function ClientsPage() {
    const { user } = useAuth()
    const isCA = user?.role === 'ca'
    const [isViewOnly, setIsViewOnly] = useState(false)

    const [selectedClients, setSelectedClients] = useState([])
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
    const [isParsingExcel, setIsParsingExcel] = useState(false)

    const [clients, setClients] = useState([])
    const [meta, setMeta] = useState(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [filterType, setFilterType] = useState('')
    const [filterGroup, setFilterGroup] = useState('')
    const [page, setPage] = useState(1)
    const [perPage, setPerPage] = useState(150)

    const [addOpen, setAddOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [selected, setSelected] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState({})

    // Dynamic select lookup options
    const [types, setTypes] = useState([])
    const [groups, setGroups] = useState([])

    // Sub-modal states for adding custom type/group dynamically
    const [addTypeOpen, setAddTypeOpen] = useState(false)
    const [newTypeName, setNewTypeName] = useState('')
    const [newTypePanChar, setNewTypePanChar] = useState('')

    const [addGroupOpen, setAddGroupOpen] = useState(false)
    const [newGroupName, setNewGroupName] = useState('')

    // Password visibility toggle
    const [showPasswords, setShowPasswords] = useState(false)

    // Excel Import States
    const [importOpen, setImportOpen] = useState(false)
    const [previewRows, setPreviewRows] = useState([])
    const existingPansRef = useRef(new Set())

    // Fetch lists
    const fetchLookups = async () => {
        try {
            const [typesRes, groupsRes] = await Promise.all([
                api.get('/ca/client-types'),
                api.get('/ca/client-groups')
            ])
            setTypes(typesRes.data.data || [])
            setGroups(groupsRes.data.data || [])
        } catch (e) {
            console.error('Failed to load lookup options', e)
        }
    }

    const fetchClients = useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.get('/ca/clients', {
                params: {
                    search,
                    status,
                    group: filterGroup,
                    type: filterType,
                    page,
                    per_page: perPage
                }
            })
            setClients(res.data.data)
            setMeta(res.data.meta)
        } finally {
            setLoading(false)
        }
    }, [search, status, filterGroup, filterType, page, perPage])

    useEffect(() => {
        fetchLookups()
    }, [])

    useEffect(() => {
        fetchClients()
    }, [fetchClients])

    // Generate AIS & TIS password dynamically in real-time
    useEffect(() => {
        if (form.pan_no && form.dob) {
            const panLower = form.pan_no.toLowerCase()
            const dobParts = form.dob.split('-') // YYYY-MM-DD
            if (dobParts.length === 3) {
                const year = dobParts[0]
                const month = dobParts[1]
                const day = dobParts[2]
                const dobDigits = `${day}${month}${year}`
                setForm(prev => ({
                    ...prev,
                    credentials: {
                        ...prev.credentials,
                        ais_tis_password: `${panLower}${dobDigits}`
                    }
                }))
            }
        }
    }, [form.pan_no, form.dob])

    // Validate PAN locally in real-time
    const getPanValidation = () => {
        const pan = form.pan_no.toUpperCase()
        if (!pan) return null

        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
        if (!panRegex.test(pan)) {
            return { valid: false, msg: 'Invalid general PAN format (e.g. ABCDE1234F).' }
        }

        const typeOption = types.find(t => t.name === form.type)
        if (typeOption && typeOption.pan_char) {
            const expectedChar = typeOption.pan_char.toUpperCase()
            const fourthChar = pan.charAt(3)
            if (fourthChar !== expectedChar) {
                return {
                    valid: false,
                    msg: `4th character of PAN must be "${expectedChar}" for type "${form.type}".`
                }
            }
        }

        return { valid: true, msg: 'PAN format is fully valid and verified!' }
    }

    const panStatus = getPanValidation()

    // Validate GST locally in real-time
    const getGstValidation = () => {
        const gst = (form.gst_number || '').trim().toUpperCase()
        if (!gst) return null

        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
        if (!gstRegex.test(gst)) {
            return { valid: false, msg: 'Invalid GST format (e.g. 22AAAAA0000A1Z5).' }
        }

        if (form.pan_no) {
            const panInGst = gst.substring(2, 12)
            if (panInGst !== form.pan_no.toUpperCase()) {
                return { valid: false, msg: `GST characters 3-12 (${panInGst}) must match the Client PAN No (${form.pan_no.toUpperCase()}).` }
            }
        }

        return { valid: true, msg: 'GST format is fully valid and verified!' }
    }

    const gstStatus = getGstValidation()

    const handleSave = async () => {
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
        if (form.contact && form.contact.replace(/\D/g, '').length !== 10) {
            toast.error('Contact No must be exactly 10 digits.')
            return
        }
        if (form.alternative_contact && form.alternative_contact.replace(/\D/g, '').length !== 10) {
            toast.error('Alternative Contact No must be exactly 10 digits.')
            return
        }

        setSaving(true)
        setErrors({})
        try {
            const payload = {
                ...form,
                pan_no: (form.pan_no || '').toUpperCase() // Save always capitalized
            }
            if (editOpen) {
                await api.put(`/ca/clients/${selected.id}`, payload)
                toast.success('Client updated successfully')
            } else {
                await api.post('/ca/clients', payload)
                toast.success('Client registered successfully')
            }
            setAddOpen(false)
            setEditOpen(false)
            fetchClients()
        } catch (e) {
            setErrors(e.response?.data?.errors ?? {})
            toast.error('Please fix validation errors')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        setSaving(true)
        try {
            await api.delete(`/ca/clients/${selected.id}`)
            toast.success('Client archived successfully.')
            setDeleteOpen(false)
            fetchClients()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to archive client.')
        } finally {
            setSaving(false)
        }
    }

    const handleBulkDelete = async () => {
        setSaving(true)
        try {
            const res = await api.post('/ca/clients/bulk-delete', { client_ids: selectedClients })
            toast.success(res.data.message || 'Clients archived successfully.')
            setBulkDeleteOpen(false)
            setSelectedClients([])
            fetchClients()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to archive clients.')
        } finally {
            setSaving(false)
        }
    }

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedClients(clients.map(c => c.id))
        } else {
            setSelectedClients([])
        }
    }

    const handleSelectRow = (id) => {
        setSelectedClients(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        )
    }

    const openEdit = (c) => {
        setSelected(c)
        setForm({
            name: c.name,
            name_as_per_pan: c.name_as_per_pan ?? '',
            pan_no: c.pan_no ?? '',
            type: c.type ?? '',
            group: c.group ?? '',
            contact: c.contact ?? '',
            alternative_contact: c.alternative_contact ?? '',
            email: c.email ?? '',
            reference_no: c.reference_no ?? '',
            dob: c.dob ?? '',
            city: c.city ?? '',
            pin_code: c.pin_code ?? '',
            state: c.state ?? '',
            gst_number: c.gst_number ?? '',
            status: c.status,
            credentials: c.credentials || { efiling_password: '', ais_tis_password: '' }
        })
        setErrors({})
        setEditOpen(true)
    }

    const handleCreateType = async () => {
        if (!newTypeName) return
        setSaving(true)
        try {
            const res = await api.post('/ca/client-types', {
                name: newTypeName,
                pan_char: newTypePanChar
            })
            setTypes(prev => [...prev, res.data.data])
            setForm(prev => ({ ...prev, type: res.data.data.name }))
            setNewTypeName('')
            setNewTypePanChar('')
            setAddTypeOpen(false)
            toast.success('Custom client type added successfully')
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to create client type')
        } finally {
            setSaving(false)
        }
    }

    const handleCreateGroup = async () => {
        if (!newGroupName) return
        setSaving(true)
        try {
            const res = await api.post('/ca/client-groups', {
                name: newGroupName
            })
            setGroups(prev => [...prev, res.data.data])
            setForm(prev => ({ ...prev, group: res.data.data.name }))
            setNewGroupName('')
            setAddGroupOpen(false)
            toast.success('Custom client group added successfully')
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to create client group')
        } finally {
            setSaving(false)
        }
    }

    // Excel Exporter logic using ExcelJS
    const handleExportExcel = async () => {
        try {
            setSaving(true)
            toast.loading('Fetching all matching clients for export...', { id: 'export-toast' })
            
            const res = await api.get('/ca/clients', {
                params: {
                    search,
                    status,
                    group: filterGroup,
                    type: filterType,
                    page: 1,
                    per_page: 100000 // High number to fetch all
                }
            })
            const exportClients = res.data.data;

            if (exportClients.length === 0) {
                toast.dismiss('export-toast')
                toast.error('No client records to export.')
                setSaving(false)
                return
            }

            const headers = [
                'SR NO',
                'ID',
                'Client Name',
                'Name as per PAN',
                'PAN No',
                'Type',
                'Group',
                'Contact No',
                'Alternative Contact',
                'Email ID',
                'Reference No',
                'Date of Birth',
                'City',
                'Pin Code',
                'State',
                'GST No',
                'Status',
                'Income Tax User ID',
                'E-Filing Password',
                'AIS/TIS Password'
            ]

            let srNo = 1
            const rows = exportClients.map(c => {
                let formattedDob = '—'
                if (c.dob) {
                    const parts = c.dob.split('-')
                    if (parts.length === 3) {
                        formattedDob = `${parts[2]}/${parts[1]}/${parts[0]}`
                    } else {
                        formattedDob = c.dob
                    }
                }

                return [
                    srNo++,
                    c.id,
                    c.name,
                    c.name_as_per_pan || '—',
                    c.pan_no || '—',
                    c.type || '—',
                    c.group || '—',
                    c.contact || '—',
                    c.alternative_contact || '—',
                    c.email || '—',
                    c.reference_no || '—',
                    formattedDob,
                    c.city || '—',
                    c.pin_code || '—',
                    c.state || '—',
                    c.gst_number || '—',
                    c.status.toUpperCase(),
                    c.pan_no || '—', // Income Tax User ID is usually PAN
                    c.credentials?.efiling_password || '—',
                    c.credentials?.ais_tis_password || '—'
                ]
            })

            toast.dismiss('export-toast')

            await exportToExcel({
                filename: `Clients_Registry_Export_${new Date().toISOString().split('T')[0]}.xlsx`,
                sheets: [
                    {
                        sheetName: "Clients Register",
                        title: "Clients Registry Details",
                        subtitle: `Generated at: ${new Date().toLocaleString()}`,
                        headers,
                        rows
                    }
                ]
            });
        } catch (error) {
            console.error('Export error:', error)
            toast.dismiss('export-toast')
            toast.error('Failed to export registry to Excel')
        } finally {
            setSaving(false)
        }
    }

    // Excel Client Side Import & Preview logic
    const handleImportFile = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsParsingExcel(true)
        try {
            const XLSX = await import('xlsx')
            const reader = new FileReader()
            reader.onload = async (evt) => {
                try {
                    const data = new Uint8Array(evt.target.result)
                    const workbook = XLSX.read(data, { type: 'array' })
                    const firstSheetName = workbook.SheetNames[0]
                    const worksheet = workbook.Sheets[firstSheetName]
                    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

                    if (json.length < 2) {
                        toast.error('Excel file must contain a header row and at least one data row.')
                        return
                    }

                    // Scan first 10 rows to locate header row index dynamically
                    let headerRowIndex = 0
                    let headers = []
                    let idxName = -1
                    let idxPan = -1

                    for (let i = 0; i < Math.min(json.length, 10); i++) {
                        const candidateRow = json[i]
                        if (!candidateRow || candidateRow.length === 0) continue

                        const candidateHeaders = candidateRow.map(h => String(h || '').trim().toLowerCase())
                        const tempName = candidateHeaders.findIndex(h => h.includes('name') && !h.includes('pan'))
                        const tempPan = candidateHeaders.findIndex(h => h.includes('pan') && !h.includes('name') && !h.includes('as per'))

                        if (tempName !== -1 && tempPan !== -1) {
                            headerRowIndex = i
                            headers = candidateHeaders
                            idxName = tempName
                            idxPan = tempPan
                            break
                        }
                    }

                    if (idxName === -1 || idxPan === -1) {
                        toast.error('Could not find mandatory "Client Name" or "PAN No" columns in Excel header.')
                        return
                    }

                    const idxNameAsPan = headers.findIndex(h => h.includes('name as per pan') || h.includes('as per pan'))
                    const idxType = headers.findIndex(h => h.includes('type'))
                    const idxGroup = headers.findIndex(h => h.includes('group'))
                    const idxContact = headers.findIndex(h => h.includes('contact') && !h.includes('alternative'))
                    const idxAltContact = headers.findIndex(h => h.includes('alternative'))
                    const idxEmail = headers.findIndex(h => h.includes('email'))
                    const idxRef = headers.findIndex(h => h.includes('reference'))
                    const idxDob = headers.findIndex(h => h.includes('dob') || h.includes('birth') || h.includes('date of birth'))
                    const idxCity = headers.findIndex(h => h.includes('city'))
                    const idxPin = headers.findIndex(h => h.includes('pin') || h.includes('pincode'))
                    const idxState = headers.findIndex(h => h.includes('state'))
                    const idxGst = headers.findIndex(h => h.includes('gst'))
                    const idxEfilingPwd = headers.findIndex(h => h.includes('password') || h.includes('efiling password'))

                    // Load all active database PANs to flag duplicate rows in RED
                    const pansRes = await api.get('/ca/clients/pan-numbers')
                    const existingPans = new Set(pansRes.data.data.map(p => p.toUpperCase()))
                    existingPansRef.current = existingPans

                    const rows = []
                    for (let i = headerRowIndex + 1; i < json.length; i++) {
                        const rowData = json[i]
                        if (rowData.length === 0 || !rowData[idxName]) {
                            continue // Skip completely empty rows
                        }

                        const rawPan = idxPan !== -1 ? String(rowData[idxPan] || '').trim().toUpperCase() : ''
                        const rawType = String(rowData[idxType] || '').trim()
                        const rawDob = String(rowData[idxDob] || '').trim()

                        const isUpdate = rawPan ? existingPans.has(rawPan) : false

                        // Parse date properly from excel serial or string formats
                        let dobStr = ''
                        if (rawDob) {
                            if (!isNaN(rawDob)) {
                                const dateObj = new Date((Number(rawDob) - 25569) * 86400 * 1000)
                                dobStr = dateObj.toISOString().split('T')[0]
                            } else {
                                const parts = rawDob.split(/[\/\-]/)
                                if (parts.length === 3) {
                                    let year = parts[2].trim()
                                    if (year.length === 2) {
                                        const numYear = parseInt(year, 10)
                                        const currentYearLastTwo = new Date().getFullYear() % 100
                                        if (numYear <= currentYearLastTwo + 10) {
                                            year = '20' + year
                                        } else {
                                            year = '19' + year
                                        }
                                    }
                                    dobStr = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
                                } else {
                                    const parsed = new Date(rawDob)
                                    if (!isNaN(parsed.getTime())) {
                                        dobStr = parsed.toISOString().split('T')[0]
                                    }
                                }
                            }
                        }

                        // Local validation check
                        let validationError = ''
                        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
                        if (rawPan) {
                            if (!panRegex.test(rawPan)) {
                                validationError = 'Invalid general PAN format.'
                            } else {
                                const typeOption = types.find(t => t.name.toLowerCase() === rawType.toLowerCase())
                                if (typeOption && typeOption.pan_char) {
                                    const expectedChar = typeOption.pan_char.toUpperCase()
                                    if (rawPan.charAt(3) !== expectedChar) {
                                        validationError = `PAN character 4 must be "${expectedChar}" for type "${rawType}".`
                                    }
                                }
                            }
                        }

                        // Validate GST if provided
                        const rawGst = idxGst !== -1 ? String(rowData[idxGst] || '').trim().toUpperCase() : ''
                        const isGstEmpty = !rawGst || rawGst === '-' || rawGst === '—' || rawGst === 'N/A' || rawGst === 'NA'
                        if (rawGst && !isGstEmpty) {
                            const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
                            if (!gstRegex.test(rawGst)) {
                                validationError = 'Invalid GST format.'
                            } else if (rawPan) {
                                const panInGst = rawGst.substring(2, 12)
                                if (panInGst !== rawPan) {
                                    validationError = 'GST PAN segment must match client PAN.'
                                }
                            }
                        }

                        // Auto generate AIS & TIS password
                        let aisTisPassword = ''
                        if (rawPan && dobStr) {
                            const dobParts = dobStr.split('-')
                            if (dobParts.length === 3) {
                                aisTisPassword = `${rawPan.toLowerCase()}${dobParts[2]}${dobParts[1]}${dobParts[0]}`
                            }
                        }

                        let parsedContact = idxContact !== -1 ? String(rowData[idxContact] || '').trim().replace(/\D/g, '') : ''
                        if (parsedContact.length > 10) {
                            parsedContact = parsedContact.slice(-10)
                        }

                        let parsedAltContact = idxAltContact !== -1 ? String(rowData[idxAltContact] || '').trim().replace(/\D/g, '') : ''
                        if (parsedAltContact.length > 10) {
                            parsedAltContact = parsedAltContact.slice(-10)
                        }

                        if (!validationError && parsedContact && parsedContact.length !== 10) {
                            validationError = 'Contact No must be exactly 10 digits.'
                        }
                        if (!validationError && parsedAltContact && parsedAltContact.length !== 10) {
                            validationError = 'Alternative Contact No must be exactly 10 digits.'
                        }

                        rows.push({
                            name: String(rowData[idxName] || '').trim(),
                            name_as_per_pan: idxNameAsPan !== -1 ? String(rowData[idxNameAsPan] || '').trim() : '',
                            pan_no: rawPan,
                            type: rawType || 'Individual',
                            group: idxGroup !== -1 ? String(rowData[idxGroup] || '').trim() : 'Salary',
                            contact: parsedContact,
                            alternative_contact: parsedAltContact,
                            email: idxEmail !== -1 ? String(rowData[idxEmail] || '').trim() : '',
                            reference_no: idxRef !== -1 ? String(rowData[idxRef] || '').trim() : '',
                            dob: dobStr,
                            city: idxCity !== -1 ? String(rowData[idxCity] || '').trim() : '',
                            pin_code: idxPin !== -1 ? String(rowData[idxPin] || '').trim() : '',
                            state: idxState !== -1 ? String(rowData[idxState] || '').trim() : '',
                            gst_number: (idxGst !== -1 && !isGstEmpty) ? rawGst : '',
                            credentials: {
                                efiling_password: idxEfilingPwd !== -1 ? String(rowData[idxEfilingPwd] || '').trim() : '',
                                ais_tis_password: aisTisPassword
                            },
                            isUpdate,
                            validationError
                        })
                    }

                    setPreviewRows(rows)
                    setImportOpen(true)
                    toast.success(`Parsed ${rows.length} rows successfully. Please review preview list.`)
                } catch (e) {
                    console.error(e)
                    toast.error('Error reading details from selected sheet.')
                } finally {
                    setIsParsingExcel(false)
                }
            }
            reader.readAsArrayBuffer(file)
        } catch (e) {
            console.error(e)
            toast.error('Failed to import file.')
            setIsParsingExcel(false)
        } finally {
            e.target.value = ''
        }
    }

    const handleUpdatePreviewRow = (idx, field, val) => {
        setPreviewRows(prev => {
            const updated = [...prev]
            const row = { ...updated[idx] }

            if (field === 'pan_no') {
                row.pan_no = String(val || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
            } else if (field === 'gst_number') {
                const cleanedGst = String(val || '').trim().toUpperCase()
                const isGstEmpty = !cleanedGst || cleanedGst === '-' || cleanedGst === '—' || cleanedGst === 'N/A' || cleanedGst === 'NA'
                row.gst_number = isGstEmpty ? '' : cleanedGst
            } else if (field.startsWith('credentials.')) {
                const subKey = field.split('.')[1]
                row.credentials = {
                    ...(row.credentials || {}),
                    [subKey]: val
                }
            } else {
                row[field] = val
            }

            // Re-run validation
            let validationError = ''
            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
            if (row.pan_no) {
                if (!panRegex.test(row.pan_no)) {
                    validationError = 'Invalid general PAN format.'
                } else {
                    const typeOption = types.find(t => t.name.toLowerCase() === (row.type || '').toLowerCase())
                    if (typeOption && typeOption.pan_char) {
                        const expectedChar = typeOption.pan_char.toUpperCase()
                        if (row.pan_no.charAt(3) !== expectedChar) {
                            validationError = `PAN character 4 must be "${expectedChar}" for type "${row.type}".`
                        }
                    }
                }
            }

            if (!validationError && row.gst_number) {
                const isGstEmpty = !row.gst_number || row.gst_number === '-' || row.gst_number === '—' || row.gst_number === 'N/A' || row.gst_number === 'NA'
                if (!isGstEmpty) {
                    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
                    if (!gstRegex.test(row.gst_number)) {
                        validationError = 'Invalid GST format.'
                    } else if (row.pan_no) {
                        const panInGst = row.gst_number.substring(2, 12)
                        if (panInGst !== row.pan_no.toUpperCase()) {
                            validationError = 'GST PAN segment must match client PAN.'
                        }
                    }
                }
            }

            if (!validationError && row.contact && row.contact.replace(/\D/g, '').length !== 10) {
                validationError = 'Contact No must be exactly 10 digits.'
            }
            if (!validationError && row.alternative_contact && row.alternative_contact.replace(/\D/g, '').length !== 10) {
                validationError = 'Alternative Contact No must be exactly 10 digits.'
            }

            row.validationError = validationError

            // Re-generate password if dob or pan changed
            if (row.pan_no && row.dob) {
                const dobParts = row.dob.split('-')
                if (dobParts.length === 3) {
                    row.credentials = {
                        ...(row.credentials || {}),
                        ais_tis_password: `${row.pan_no.toLowerCase()}${dobParts[2]}${dobParts[1]}${dobParts[0]}`
                    }
                }
            }

            // Re-evaluate database duplication check (now update check)
            row.isUpdate = (row.pan_no && existingPansRef.current) ? existingPansRef.current.has(row.pan_no) : false

            updated[idx] = row
            return updated
        })
    }

    const handleConfirmImport = async () => {
        const validRows = previewRows.filter(r => !r.validationError)
        if (validRows.length === 0) {
            toast.error('No valid rows found in sheet to import. Resolve errors first.')
            return
        }

        setSaving(true)
        try {
            const res = await api.post('/ca/clients/bulk-store', { clients: validRows })
            toast.success(res.data.message || `Import completed successfully.`)
            setImportOpen(false)
            fetchClients()
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to bulk save clients.')
        } finally {
            setSaving(false)
        }
    }

    // Clients are now filtered server-side
    const filteredClients = clients;

    const handleCopy = (text, fieldName) => {
        if (!text) return
        navigator.clipboard.writeText(text)
        toast.success(`${fieldName} copied!`)
    }

    const inputCls = "w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-semibold text-slate-700 placeholder-slate-400"
    const labelCls = "text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1"

    const renderClientForm = () => (
        <div className="space-y-6 px-1">
            <fieldset disabled={isViewOnly} className="space-y-6 border-none p-0 m-0">
                {/* Main Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client Name */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className={labelCls + " !mb-0"}>Client Name *</label>
                        {form.name && (
                            <button
                                type="button"
                                onClick={() => handleCopy(form.name, 'Client Name')}
                                className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                            >
                                <Copy size={10} /> Copy
                            </button>
                        )}
                    </div>
                    <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Enter Client Name"
                        className={inputCls}
                    />
                    {errors.name && <p className="text-[10px] text-red-500 mt-1">{errors.name[0]}</p>}
                </div>

                {/* Client Type */}
                <div>
                    <label className={labelCls}>Type *</label>
                    <select
                        value={form.type}
                        onChange={e => {
                            if (e.target.value === 'ADD_NEW') {
                                setAddTypeOpen(true)
                            } else {
                                setForm(f => ({ ...f, type: e.target.value }))
                            }
                        }}
                        className={inputCls}
                    >
                        <option value="">Select Type...</option>
                        {types.map(t => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                        <option value="ADD_NEW" className="text-indigo-600 font-bold bg-slate-50">+ Add New Option...</option>
                    </select>
                    {errors.type && <p className="text-[10px] text-red-500 mt-1">{errors.type[0]}</p>}
                </div>

                {/* Client Name As per PAN */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className={labelCls + " !mb-0"}>Client Name As Per PAN</label>
                        {form.name_as_per_pan && (
                            <button
                                type="button"
                                onClick={() => handleCopy(form.name_as_per_pan, 'Name As Per PAN')}
                                className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                            >
                                <Copy size={10} /> Copy
                            </button>
                        )}
                    </div>
                    <input
                        type="text"
                        value={form.name_as_per_pan}
                        onChange={e => setForm(f => ({ ...f, name_as_per_pan: e.target.value }))}
                        placeholder="Enter Name exactly as printed on PAN"
                        className={inputCls}
                    />
                    {errors.name_as_per_pan && <p className="text-[10px] text-red-500 mt-1">{errors.name_as_per_pan[0]}</p>}
                </div>

                {/* PAN Number with Validation Indicator */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className={labelCls + " !mb-0"}>PAN No</label>
                        {form.pan_no && (
                            <button
                                type="button"
                                onClick={() => handleCopy(form.pan_no, 'PAN No')}
                                className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                            >
                                <Copy size={10} /> Copy
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            maxLength={10}
                            value={form.pan_no}
                            onChange={e => setForm(f => ({ ...f, pan_no: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                            placeholder="Enter 10-Digit PAN (e.g. BIBPB1899L)"
                            className={`${inputCls} uppercase pr-8`}
                        />
                        {panStatus && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                {panStatus.valid ? (
                                    <ShieldCheck className="text-emerald-500 w-4 h-4" />
                                ) : (
                                    <ShieldAlert className="text-rose-500 w-4 h-4" />
                                )}
                            </div>
                        )}
                    </div>
                    {panStatus && (
                        <p className={`text-[9px] font-bold mt-1 ${panStatus.valid ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {panStatus.msg}
                        </p>
                    )}
                    {errors.pan_no && <p className="text-[10px] text-red-500 mt-1">{errors.pan_no[0]}</p>}
                </div>

                {/* Group */}
                <div>
                    <label className={labelCls}>Group *</label>
                    <select
                        value={form.group}
                        onChange={e => {
                            if (e.target.value === 'ADD_NEW') {
                                setAddGroupOpen(true)
                            } else {
                                setForm(f => ({ ...f, group: e.target.value }))
                            }
                        }}
                        className={inputCls}
                    >
                        <option value="">Select Group...</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.name}>{g.name}</option>
                        ))}
                        <option value="ADD_NEW" className="text-indigo-600 font-bold bg-slate-50">+ Add New Option...</option>
                    </select>
                    {errors.group && <p className="text-[10px] text-red-500 mt-1">{errors.group[0]}</p>}
                </div>

                {/* Contact No */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className={labelCls + " !mb-0"}>Contact No</label>
                        {form.contact && (
                            <button
                                type="button"
                                onClick={() => handleCopy(form.contact, 'Contact No')}
                                className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                            >
                                <Copy size={10} /> Copy
                            </button>
                        )}
                    </div>
                    <input
                        type="text"
                        maxLength={10}
                        value={form.contact}
                        onChange={e => setForm(f => ({ ...f, contact: e.target.value.replace(/\D/g, '') }))}
                        placeholder="10-digit mobile number"
                        className={inputCls}
                    />
                    {errors.contact && <p className="text-[10px] text-red-500 mt-1">{errors.contact[0]}</p>}
                </div>

                {/* Alternative Contact No */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className={labelCls + " !mb-0"}>Alternative Contact No</label>
                        {form.alternative_contact && (
                            <button
                                type="button"
                                onClick={() => handleCopy(form.alternative_contact, 'Alternative Contact No')}
                                className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                            >
                                <Copy size={10} /> Copy
                            </button>
                        )}
                    </div>
                    <input
                        type="text"
                        maxLength={10}
                        value={form.alternative_contact}
                        onChange={e => setForm(f => ({ ...f, alternative_contact: e.target.value.replace(/\D/g, '') }))}
                        placeholder="Alternative 10-digit number"
                        className={inputCls}
                    />
                    {errors.alternative_contact && <p className="text-[10px] text-red-500 mt-1">{errors.alternative_contact[0]}</p>}
                </div>

                {/* Email Address */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className={labelCls + " !mb-0"}>Email ID</label>
                        {form.email && (
                            <button
                                type="button"
                                onClick={() => handleCopy(form.email, 'Email ID')}
                                className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                            >
                                <Copy size={10} /> Copy
                            </button>
                        )}
                    </div>
                    <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="client@example.com"
                        className={inputCls}
                    />
                    {errors.email && <p className="text-[10px] text-red-500 mt-1">{errors.email[0]}</p>}
                </div>

                {/* Reference No */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className={labelCls + " !mb-0"}>Reference No</label>
                        {form.reference_no && (
                            <button
                                type="button"
                                onClick={() => handleCopy(form.reference_no, 'Reference No')}
                                className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                            >
                                <Copy size={10} /> Copy
                            </button>
                        )}
                    </div>
                    <input
                        type="text"
                        value={form.reference_no}
                        onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))}
                        placeholder="Enter reference details"
                        className={inputCls}
                    />
                    {errors.reference_no && <p className="text-[10px] text-red-500 mt-1">{errors.reference_no[0]}</p>}
                </div>

                {/* City */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className={labelCls + " !mb-0"}>City</label>
                        {form.city && (
                            <button
                                type="button"
                                onClick={() => handleCopy(form.city, 'City')}
                                className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                            >
                                <Copy size={10} /> Copy
                            </button>
                        )}
                    </div>
                    <input
                        type="text"
                        value={form.city}
                        onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                        placeholder="Enter City"
                        className={inputCls}
                    />
                    {errors.city && <p className="text-[10px] text-red-500 mt-1">{errors.city[0]}</p>}
                </div>

                {/* Pin Code */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className={labelCls + " !mb-0"}>Pin Code</label>
                        {form.pin_code && (
                            <button
                                type="button"
                                onClick={() => handleCopy(form.pin_code, 'Pin Code')}
                                className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                            >
                                <Copy size={10} /> Copy
                            </button>
                        )}
                    </div>
                    <input
                        type="text"
                        maxLength={6}
                        value={form.pin_code}
                        onChange={e => setForm(f => ({ ...f, pin_code: e.target.value.replace(/\D/g, '') }))}
                        placeholder="6-digit postal code"
                        className={inputCls}
                    />
                    {errors.pin_code && <p className="text-[10px] text-red-500 mt-1">{errors.pin_code[0]}</p>}
                </div>

                {/* State */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className={labelCls + " !mb-0"}>State</label>
                        {form.state && (
                            <button
                                type="button"
                                onClick={() => handleCopy(form.state, 'State')}
                                className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                            >
                                <Copy size={10} /> Copy
                            </button>
                        )}
                    </div>
                    <input
                        type="text"
                        value={form.state}
                        onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                        placeholder="Enter State"
                        className={inputCls}
                    />
                    {errors.state && <p className="text-[10px] text-red-500 mt-1">{errors.state[0]}</p>}
                </div>

                {/* Date of Birth */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className={labelCls + " !mb-0"}>Date Of Birth</label>
                        {form.dob && (
                            <button
                                type="button"
                                onClick={() => {
                                    // format to dd/mm/yy on copying dob
                                    const parts = form.dob.split('-')
                                    const formatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}` : form.dob
                                    handleCopy(formatted, 'Date of Birth (dd/mm/yy)')
                                }}
                                className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                            >
                                <Copy size={10} /> Copy (dd/mm/yy)
                            </button>
                        )}
                    </div>
                    <input
                        type="date"
                        value={form.dob || ''}
                        onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                        className={inputCls}
                    />
                    {errors.dob && <p className="text-[10px] text-red-500 mt-1">{errors.dob[0]}</p>}
                </div>

                {/* GST Number */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className={labelCls + " !mb-0"}>GST No</label>
                        {form.gst_number && (
                            <button
                                type="button"
                                onClick={() => handleCopy(form.gst_number, 'GST No')}
                                className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                            >
                                <Copy size={10} /> Copy
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            value={form.gst_number || ''}
                            onChange={e => setForm(f => ({ ...f, gst_number: e.target.value.toUpperCase() }))}
                            placeholder="GST Identification Number"
                            className={`${inputCls} pr-8`}
                            autoComplete="off"
                        />
                        {gstStatus && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                {gstStatus.valid ? (
                                    <ShieldCheck className="text-emerald-500 w-4 h-4" />
                                ) : (
                                    <ShieldAlert className="text-rose-500 w-4 h-4" />
                                )}
                            </div>
                        )}
                    </div>
                    {gstStatus && (
                        <p className={`text-[9px] font-bold mt-1 ${gstStatus.valid ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {gstStatus.msg}
                        </p>
                    )}
                    {errors.gst_number && <p className="text-[10px] text-red-500 mt-1">{errors.gst_number[0]}</p>}
                </div>
            </div>

            {/* Status */}
            <div>
                <label className={labelCls}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            {/* Portal Credentials Section */}
            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Key className="text-indigo-500 w-4 h-4" />
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Portal Credentials (Passwords)</h4>
                    </div>
                    <div role="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="text-xs text-[#1F5C99] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                        {showPasswords ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{showPasswords ? 'Hide Credentials' : 'Reveal Credentials'}</span>
                    </div>
                </div>

                <div className="overflow-hidden border border-slate-200/60 rounded-2xl bg-white shadow-sm">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                <th className="px-4 py-3">Portal URL</th>
                                <th className="px-4 py-3">Auth Type</th>
                                <th className="px-4 py-3">User ID</th>
                                <th className="px-4 py-3">Password</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {/* EFILING row (Manual) */}
                            <tr>
                                <td className="px-4 py-3 font-semibold text-slate-600">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <Globe size={13} className="text-slate-400" />
                                        <a
                                            href="https://eportal.incometax.gov.in/iec/foservices/#/login"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#1F5C99] hover:underline font-bold flex items-center gap-1"
                                        >
                                            WWW.EFILING INCOME TAX <ExternalLink size={12} />
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy('https://eportal.incometax.gov.in/iec/foservices/#/login', 'IT Portal URL')}
                                            className="p-1 text-slate-400 hover:text-[#1F5C99] transition rounded hover:bg-slate-100"
                                            title="Copy IT URL"
                                        >
                                            <Copy size={11} />
                                        </button>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-indigo-100">
                                        EFILING
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-slate-600">
                                    <div className="flex items-center gap-1.5">
                                        <span>{form.pan_no ? form.pan_no : 'LINKED TO PAN'}</span>
                                        {form.pan_no && (
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(form.pan_no, 'User ID (PAN)')}
                                                className="p-1 text-slate-400 hover:text-[#1F5C99] transition rounded hover:bg-slate-100"
                                                title="Copy User ID"
                                            >
                                                <Copy size={11} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="relative flex items-center">
                                        <input
                                            type={showPasswords ? "text" : "password"}
                                            value={form.credentials.efiling_password}
                                            onChange={e => setForm(f => ({
                                                ...f,
                                                credentials: {
                                                    ...f.credentials,
                                                    efiling_password: e.target.value
                                                }
                                            }))}
                                            placeholder="Type manual password..."
                                            className="w-full pl-2 pr-8 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-xs font-semibold text-slate-700"
                                            autoComplete="new-password"
                                        />
                                        {form.credentials.efiling_password && (
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(form.credentials.efiling_password, 'E-filing Password')}
                                                className="absolute right-2 text-slate-400 hover:text-[#1F5C99] transition"
                                                title="Copy Password"
                                            >
                                                <Copy size={12} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>

                            {/* AIS & TIS row (Auto generated) */}
                            <tr>
                                <td className="px-4 py-3 font-semibold text-slate-600">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <Globe size={13} className="text-slate-400" />
                                        <a
                                            href="https://eportal.incometax.gov.in/iec/foservices/#/login"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#1F5C99] hover:underline font-bold flex items-center gap-1"
                                        >
                                            WWW.EFILING INCOME TAX <ExternalLink size={12} />
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy('https://eportal.incometax.gov.in/iec/foservices/#/login', 'IT Portal URL')}
                                            className="p-1 text-slate-400 hover:text-[#1F5C99] transition rounded hover:bg-slate-100"
                                            title="Copy IT URL"
                                        >
                                            <Copy size={11} />
                                        </button>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-100">
                                        AIS & TIS
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-slate-600">
                                    <div className="flex items-center gap-1.5">
                                        <span>{form.pan_no ? form.pan_no : 'LINKED TO PAN'}</span>
                                        {form.pan_no && (
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(form.pan_no, 'User ID (PAN)')}
                                                className="p-1 text-slate-400 hover:text-[#1F5C99] transition rounded hover:bg-slate-100"
                                                title="Copy User ID"
                                            >
                                                <Copy size={11} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                        <div className="relative flex items-center">
                                            <input
                                                type={showPasswords ? "text" : "password"}
                                                value={form.credentials.ais_tis_password}
                                                disabled
                                                className="w-full pl-2 pr-8 py-1 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold cursor-not-allowed"
                                                autoComplete="new-password"
                                            />
                                            {form.credentials.ais_tis_password && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(form.credentials.ais_tis_password, 'AIS/TIS Password')}
                                                    className="absolute right-2 text-slate-400 hover:text-[#1F5C99] transition"
                                                    title="Copy Password"
                                                >
                                                    <Copy size={12} />
                                                </button>
                                            )}
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-400 mt-1">
                                            Auto Generated: lower(PAN) + DOB
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            </fieldset>

            {/* Form Footer Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 items-center">
                {isViewOnly ? (
                    <>
                        <button
                            onClick={() => {
                                setIsViewOnly(false);
                            }}
                            className="px-6 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition active:scale-95 cursor-pointer"
                        >
                            Edit Details
                        </button>
                        <button
                            onClick={() => { setAddOpen(false); setEditOpen(false); setIsViewOnly(false); }}
                            className="px-5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition active:scale-95 cursor-pointer"
                        >
                            Close
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => { 
                                if (editOpen && selected) {
                                    setIsViewOnly(true);
                                } else {
                                    setAddOpen(false); 
                                    setEditOpen(false);
                                }
                            }}
                            className="px-5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2.5 text-xs font-bold bg-[#1F5C99] text-white rounded-xl hover:bg-[#154675] disabled:opacity-60 transition"
                        >
                            {saving ? 'Saving...' : (editOpen ? 'Update Client' : 'Register Client')}
                        </button>
                    </>
                )}
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            {/* Header / Actions Area */}
            {isParsingExcel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center max-w-sm w-full mx-4">
                        <Spinner size="xl" />
                        <h3 className="mt-4 text-sm font-bold text-slate-800">Reading Excel File...</h3>
                        <p className="text-xs text-slate-500 text-center mt-1">Please wait while we parse and validate your spreadsheet data. This might take a moment for large files.</p>
                    </div>
                </div>
            )}
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Client Registry</h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Comprehensive register of business clients with secure validation checks.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Invisible File Input for Import */}
                    <input
                        type="file"
                        id="excel-import-file"
                        accept=".xlsx, .xls"
                        className="hidden"
                        onChange={handleImportFile}
                    />

                    {/* Import Button */}
                    {isCA && (
                        <button
                            onClick={() => document.getElementById('excel-import-file').click()}
                            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition duration-200 active:scale-95 flex-1 sm:flex-initial cursor-pointer"
                            title="Import clients from Excel sheet"
                        >
                            <FileUp size={15} /> Import Excel
                        </button>
                    )}

                    {/* Bulk Delete Button */}
                    {isCA && selectedClients.length > 0 && (
                        <button
                            onClick={() => setBulkDeleteOpen(true)}
                            className="flex items-center justify-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition duration-200 active:scale-95 flex-1 sm:flex-initial cursor-pointer"
                        >
                            <Trash2 size={15} /> Delete Selected ({selectedClients.length})
                        </button>
                    )}

                    {/* Export Button */}
                    {isCA && (
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center justify-center gap-2 bg-[#1F5C99] hover:bg-[#154675] text-white px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition duration-200 active:scale-95 flex-1 sm:flex-initial cursor-pointer"
                            title="Export clients to formatted Excel"
                        >
                            <FileDown size={15} /> Export Excel
                        </button>
                    )}

                    {/* Add Client Button */}
                    <button
                        onClick={() => { setForm(EMPTY_FORM); setErrors({}); setAddOpen(true) }}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition duration-200 active:scale-95 flex-1 sm:flex-initial cursor-pointer"
                    >
                        <Plus size={15} /> Register Client
                    </button>
                </div>
            </div>

            {/* List panel */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Advanced Search & Filtering toolbar */}
                <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-slate-50/80 bg-slate-50/50">
                    <div className="relative flex-1 sm:flex-none">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search client name, contact, PAN..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            className="pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-64 transition font-semibold text-slate-700"
                        />
                    </div>

                    {/* Group Filter */}
                    <CustomSelect
                        value={filterGroup}
                        onChange={e => { setFilterGroup(e.target.value); setPage(1) }}
                        options={[
                            { value: '', label: 'All Groups' },
                            ...groups.map(g => ({ value: g.name, label: g.name }))
                        ]}
                        widthClass="w-full sm:w-auto min-w-[125px]"
                    />

                    {/* Type Filter */}
                    <CustomSelect
                        value={filterType}
                        onChange={e => { setFilterType(e.target.value); setPage(1) }}
                        options={[
                            { value: '', label: 'All Types' },
                            ...types.map(t => ({ value: t.name, label: t.name }))
                        ]}
                        widthClass="w-full sm:w-auto min-w-[125px]"
                    />

                    {/* Status Filter */}
                    <CustomSelect
                        value={status}
                        onChange={e => { setStatus(e.target.value); setPage(1) }}
                        options={[
                            { value: '', label: 'All Statuses' },
                            { value: 'active', label: 'Active' },
                            { value: 'inactive', label: 'Inactive' }
                        ]}
                        widthClass="w-full sm:w-auto min-w-[125px]"
                    />
                </div>

                <div className="overflow-x-auto min-h-[400px] relative">
                    {loading && (
                        <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center backdrop-blur-[1px]">
                            <Spinner />
                        </div>
                    )}
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#154673] bg-[#1F5C99]">
                                {isCA && (
                                    <th className="px-6 py-3.5 text-left w-12">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            checked={filteredClients.length > 0 && selectedClients.length === filteredClients.length}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                )}
                                <th className="px-6 py-3.5 text-left">Client Name</th>
                                <th className="px-6 py-3.5 text-left">PAN No</th>
                                <th className="px-6 py-3.5 text-left">Type & Group</th>
                                <th className="px-6 py-3.5 text-left">Contact Info</th>
                                <th className="px-6 py-3.5 text-center">Status</th>
                                <th className="px-6 py-3.5 text-center">Actions</th>
                            </tr>
                        </thead>
                            <tbody className="divide-y divide-slate-50 text-slate-700">
                                {filteredClients.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-slate-400 font-bold">
                                            No clients registered matching search criteria.
                                        </td>
                                    </tr>
                                ) : filteredClients.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50/30 transition">
                                        {/* Checkbox */}
                                        {isCA && (
                                            <td className="px-6 py-4">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    checked={selectedClients.includes(c.id)}
                                                    onChange={() => handleSelectRow(c.id)}
                                                />
                                            </td>
                                        )}
                                        {/* Client Name & City */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-black text-indigo-600">
                                                    {c.name ? c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'C'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 leading-tight">{c.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{c.city ? `${c.city}, ` : ''}{c.state || 'India'}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* PAN No */}
                                        <td className="px-6 py-4 font-mono font-bold text-xs text-slate-600">
                                            {c.pan_no || '—'}
                                        </td>

                                        {/* Type & Group */}
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-semibold text-slate-700 text-xs">{c.type || '—'}</span>
                                                <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">{c.group || '—'}</span>
                                            </div>
                                        </td>

                                        {/* Contact */}
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-600 text-xs">{c.contact || '—'}</span>
                                                <span className="text-[10px] text-slate-400 font-semibold">{c.email || ''}</span>
                                            </div>
                                        </td>
                                        {/* Status */}
                                        <td className="px-6 py-4 text-center">
                                            <StatusBadge status={c.status} />
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <Tooltip content="View Client">
                                                    <button
                                                        onClick={() => {
                                                            setIsViewOnly(true);
                                                            openEdit(c);
                                                        }}
                                                        className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100/40 text-[#1F5C99] hover:bg-indigo-100 hover:text-indigo-800 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                </Tooltip>
                                                {isCA && (
                                                    <Tooltip content="Archive Client">
                                                        <button
                                                            onClick={() => { setSelected(c); setDeleteOpen(true) }}
                                                            className="p-2 rounded-lg bg-rose-50/70 border border-rose-100/40 text-rose-600 hover:bg-rose-100 hover:text-rose-800 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                </div>

                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50 bg-slate-50/30">
                        <div className="flex items-center gap-4">
                            <p className="text-xs font-semibold text-slate-400">Showing {meta.from}–{meta.to} of {meta.total} registered clients</p>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-semibold text-slate-400">Per page:</label>
                                <select 
                                    value={perPage} 
                                    onChange={(e) => {
                                        setPerPage(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="bg-white border border-slate-200 text-slate-600 text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value={150}>150</option>
                                    <option value={200}>200</option>
                                    <option value={250}>250</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
                            >
                                Previous
                            </button>
                            <button
                                disabled={page === meta.last_page}
                                onClick={() => setPage(p => p + 1)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <Modal
                open={addOpen || editOpen}
                onClose={() => {
                    setAddOpen(false);
                    setEditOpen(false);
                    setIsViewOnly(false);
                    setForm(EMPTY_FORM);
                    setErrors({});
                }}
                title={isViewOnly ? `Client Details: ${form.name}` : (editOpen ? 'Update Registered Client Details' : 'Register New CA Business Client')}
                width="max-w-4xl" // Large layout for form elements
            >
                {renderClientForm()}
            </Modal>

            {/* Archive Confirm Dialog */}
            <ConfirmDialog
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleDelete}
                danger
                loading={saving}
                title="Archive Registered Client"
                message={`Are you sure you want to archive "${selected?.name}"? All future sheet logs will reference archived state.`}
                confirmLabel="Archive Client"
            />

            {/* Bulk Archive Confirm Dialog */}
            <ConfirmDialog
                open={bulkDeleteOpen}
                onClose={() => setBulkDeleteOpen(false)}
                onConfirm={handleBulkDelete}
                danger
                loading={saving}
                title="Bulk Archive Clients"
                message={`Are you sure you want to archive ${selectedClients.length} selected clients?`}
                confirmLabel={`Archive ${selectedClients.length} Clients`}
            />

            {/* Dropdown Lookups: ADD NEW TYPE Sub-modal */}
            <Modal open={addTypeOpen} onClose={() => setAddTypeOpen(false)} title="Create Custom Client Type">
                <div className="space-y-4">
                    <div>
                        <label className={labelCls}>Type Name *</label>
                        <input
                            type="text"
                            placeholder="e.g. Sole Proprietorship"
                            value={newTypeName}
                            onChange={e => setNewTypeName(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Indian PAN 4th Character (Optional)</label>
                        <input
                            type="text"
                            maxLength={1}
                            placeholder="e.g. F"
                            value={newTypePanChar}
                            onChange={e => setNewTypePanChar(e.target.value.toUpperCase())}
                            className={inputCls + " uppercase"}
                        />
                        <p className="text-[9px] font-bold text-slate-400 mt-1">
                            Used to auto-validate client PAN cards. Example: P for Individual, C for Company, F for Firm.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setAddTypeOpen(false)} disabled={saving} className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                        <button onClick={handleCreateType} disabled={saving} className="px-4 py-2 text-xs font-bold bg-[#1F5C99] text-white rounded-xl hover:bg-[#154675] disabled:opacity-50">
                            {saving ? 'Adding...' : 'Add Type'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Dropdown Lookups: ADD NEW GROUP Sub-modal */}
            <Modal open={addGroupOpen} onClose={() => setAddGroupOpen(false)} title="Create Custom Client Group">
                <div className="space-y-4">
                    <div>
                        <label className={labelCls}>Group Name *</label>
                        <input
                            type="text"
                            placeholder="e.g. Salary-2027"
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setAddGroupOpen(false)} disabled={saving} className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                        <button onClick={handleCreateGroup} disabled={saving} className="px-4 py-2 text-xs font-bold bg-[#1F5C99] text-white rounded-xl hover:bg-[#154675] disabled:opacity-50">
                            {saving ? 'Adding...' : 'Add Group'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Excel Import Preview Modal */}
            <Modal
                open={importOpen}
                onClose={() => setImportOpen(false)}
                title="Excel Import Registry Preview"
                width="max-w-7xl"
            >
                <div className="space-y-6">
                    {/* Header Summary Banner */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                                <CheckCircle2 className="text-indigo-600 w-5 h-5" />
                                <span>Parsed {previewRows.length} total rows from Excel sheet</span>
                            </h4>
                            <p className="text-xs font-semibold text-slate-400">
                                Rows highlighted in <span className="text-sky-600 font-bold">Blue</span> represent existing clients and will be updated. Rows in <span className="text-rose-600 font-bold">Red</span> contain format errors and will be skipped.
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right border-r pr-4 border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 block uppercase">New Valid Rows</span>
                                <span className="text-lg font-black text-emerald-600">
                                    {previewRows.filter(r => !r.isUpdate && !r.validationError).length}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 block uppercase font-bold text-sky-600">Updates</span>
                                <span className="text-lg font-black text-sky-600">
                                    {previewRows.filter(r => r.isUpdate && !r.validationError).length}
                                </span>
                            </div>
                            <div className="text-right border-l pl-4 border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 block uppercase font-bold text-rose-600">Skipped Rows</span>
                                <span className="text-lg font-black text-rose-600">
                                    {previewRows.filter(r => r.validationError).length}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Preview Table */}
                    <div className="overflow-x-auto border border-slate-200/60 rounded-3xl bg-white shadow-sm max-h-[55vh]">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 sticky top-0 z-10">
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Client Name</th>
                                    <th className="px-4 py-3">Name as per PAN</th>
                                    <th className="px-4 py-3">PAN No</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Group</th>
                                    <th className="px-4 py-3">Contact</th>
                                    <th className="px-4 py-3">Alternative Contact</th>
                                    <th className="px-4 py-3">Email</th>
                                    <th className="px-4 py-3">Reference No</th>
                                    <th className="px-4 py-3">Date Of Birth</th>
                                    <th className="px-4 py-3">City</th>
                                    <th className="px-4 py-3">Pin Code</th>
                                    <th className="px-4 py-3">State</th>
                                    <th className="px-4 py-3">GST No</th>
                                    <th className="px-4 py-3">E-Filing Password</th>
                                    <th className="px-4 py-3">AIS/TIS Password</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {previewRows.map((row, idx) => {
                                    const hasErr = row.validationError
                                    const isUpdate = row.isUpdate && !hasErr
                                    return (
                                        <tr
                                            key={idx}
                                            className={`transition ${hasErr ? 'bg-rose-50/50 hover:bg-rose-50' : isUpdate ? 'bg-sky-50/50 hover:bg-sky-50' : 'hover:bg-slate-50/30'}`}
                                        >
                                            {/* Status Badge */}
                                            <td className="px-4 py-3 min-w-[150px]">
                                                <div className="flex flex-col gap-1">
                                                    {row.validationError ? (
                                                        <span className="inline-flex items-center gap-1 bg-rose-100 border border-rose-200 text-rose-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                            <AlertTriangle size={11} /> Format Error
                                                        </span>
                                                    ) : row.isUpdate ? (
                                                        <span className="inline-flex items-center gap-1 bg-sky-100 border border-sky-200 text-sky-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                            <CheckCircle2 size={11} /> Update
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 bg-emerald-100 border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                            <ShieldCheck size={11} /> Ready
                                                        </span>
                                                    )}
                                                    {row.validationError && (
                                                        <span className="text-[9px] font-bold text-rose-600 block leading-tight max-w-[140px] whitespace-normal">
                                                            {row.validationError}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Name */}
                                            <td className="px-4 py-3 min-w-[180px]">
                                                <input
                                                    type="text"
                                                    value={row.name || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'name', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-bold text-slate-800"
                                                />
                                            </td>

                                            {/* Name as per PAN */}
                                            <td className="px-4 py-3 min-w-[180px]">
                                                <input
                                                    type="text"
                                                    value={row.name_as_per_pan || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'name_as_per_pan', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-semibold text-slate-700"
                                                />
                                            </td>

                                            {/* PAN */}
                                            <td className="px-4 py-3 min-w-[130px]">
                                                <input
                                                    type="text"
                                                    maxLength={10}
                                                    value={row.pan_no || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'pan_no', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-mono font-bold text-slate-700 uppercase"
                                                />
                                            </td>

                                            {/* Type */}
                                            <td className="px-4 py-3 min-w-[140px]">
                                                <select
                                                    value={row.type || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'type', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-semibold text-slate-600"
                                                >
                                                    <option value="">Select Type...</option>
                                                    {types.map(t => (
                                                        <option key={t.id} value={t.name}>{t.name}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Group */}
                                            <td className="px-4 py-3 min-w-[140px]">
                                                <select
                                                    value={row.group || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'group', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-semibold text-slate-600"
                                                >
                                                    <option value="">Select Group...</option>
                                                    {groups.map(g => (
                                                        <option key={g.id} value={g.name}>{g.name}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Contact */}
                                            <td className="px-4 py-3 min-w-[140px]">
                                                <input
                                                    type="text"
                                                    maxLength={10}
                                                    value={row.contact || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'contact', e.target.value.replace(/\D/g, ''))}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-semibold text-slate-600"
                                                />
                                            </td>

                                            {/* Alternative Contact */}
                                            <td className="px-4 py-3 min-w-[140px]">
                                                <input
                                                    type="text"
                                                    maxLength={10}
                                                    value={row.alternative_contact || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'alternative_contact', e.target.value.replace(/\D/g, ''))}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-semibold text-slate-600"
                                                />
                                            </td>

                                            {/* Email */}
                                            <td className="px-4 py-3 min-w-[180px]">
                                                <input
                                                    type="email"
                                                    value={row.email || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'email', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-semibold text-slate-600"
                                                />
                                            </td>

                                            {/* Reference No */}
                                            <td className="px-4 py-3 min-w-[120px]">
                                                <input
                                                    type="text"
                                                    value={row.reference_no || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'reference_no', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-semibold text-slate-600"
                                                />
                                            </td>

                                            {/* DOB */}
                                            <td className="px-4 py-3 min-w-[130px]">
                                                <input
                                                    type="date"
                                                    value={row.dob || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'dob', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-semibold text-slate-600"
                                                />
                                            </td>

                                            {/* City */}
                                            <td className="px-4 py-3 min-w-[120px]">
                                                <input
                                                    type="text"
                                                    value={row.city || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'city', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-semibold text-slate-600"
                                                />
                                            </td>

                                            {/* Pin Code */}
                                            <td className="px-4 py-3 min-w-[120px]">
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    value={row.pin_code || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'pin_code', e.target.value.replace(/\D/g, ''))}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-semibold text-slate-600"
                                                />
                                            </td>

                                            {/* State */}
                                            <td className="px-4 py-3 min-w-[140px]">
                                                <input
                                                    type="text"
                                                    value={row.state || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'state', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-semibold text-slate-600"
                                                />
                                            </td>

                                            {/* GST No */}
                                            <td className="px-4 py-3 min-w-[140px]">
                                                <input
                                                    type="text"
                                                    maxLength={15}
                                                    value={row.gst_number || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'gst_number', e.target.value.toUpperCase())}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-semibold text-slate-600 uppercase"
                                                />
                                            </td>

                                            {/* E-Filing Password */}
                                            <td className="px-4 py-3 min-w-[130px]">
                                                <input
                                                    type="text"
                                                    value={row.credentials?.efiling_password || ''}
                                                    onChange={e => handleUpdatePreviewRow(idx, 'credentials.efiling_password', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] font-semibold text-slate-600"
                                                />
                                            </td>

                                            {/* AIS/TIS Password */}
                                            <td className="px-4 py-3 min-w-[130px]">
                                                <input
                                                    type="text"
                                                    disabled
                                                    value={row.credentials?.ais_tis_password || ''}
                                                    className="w-full px-2 py-1 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-400 font-mono font-semibold"
                                                />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Preview Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            onClick={() => setImportOpen(false)}
                            className="px-5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmImport}
                            disabled={saving || previewRows.filter(r => !r.validationError).length === 0}
                            className="px-6 py-2.5 text-xs font-bold bg-[#1F5C99] text-white rounded-xl hover:bg-[#154675] disabled:opacity-60 transition"
                        >
                            {saving ? 'Importing...' : 'Confirm & Save Valid Clients'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}