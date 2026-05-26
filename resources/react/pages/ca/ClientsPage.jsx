import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Search, Pencil, Trash2, ShieldCheck, ShieldAlert, Key, Globe, Eye, EyeOff, FileDown, FileUp, AlertTriangle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Tooltip from '../../components/ui/Tooltip'

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
    const [clients, setClients] = useState([])
    const [meta, setMeta] = useState(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [filterType, setFilterType] = useState('')
    const [filterGroup, setFilterGroup] = useState('')
    const [page, setPage] = useState(1)

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
                    page, 
                    per_page: 15 
                } 
            })
            setClients(res.data.data)
            setMeta(res.data.meta)
        } finally { 
            setLoading(false) 
        }
    }, [search, status, page])

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
                pan_no: form.pan_no.toUpperCase() // Save always capitalized
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
            toast.success('Client archived successfully')
            setDeleteOpen(false)
            fetchClients()
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to archive client')
        } finally {
            setSaving(false)
        }
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
        if (clients.length === 0) {
            toast.error('No client records to export.')
            return
        }

        try {
            const ExcelJS = await import('exceljs')
            const workbook = new ExcelJS.Workbook()
            const worksheet = workbook.addWorksheet('Clients Register')

            const headers = [
                { name: 'SR NO', key: 'sr_no' },
                { name: 'Client Name', key: 'name' },
                { name: 'Name as per PAN', key: 'name_as_per_pan' },
                { name: 'PAN No', key: 'pan_no' },
                { name: 'Type', key: 'type' },
                { name: 'Group', key: 'group' },
                { name: 'Contact No', key: 'contact' },
                { name: 'Alternative Contact', key: 'alternative_contact' },
                { name: 'Email ID', key: 'email' },
                { name: 'Reference No', key: 'reference_no' },
                { name: 'Date of Birth', key: 'dob' },
                { name: 'City', key: 'city' },
                { name: 'Pin Code', key: 'pin_code' },
                { name: 'State', key: 'state' },
                { name: 'GST No', key: 'gst_number' },
                { name: 'Status', key: 'status' }
            ]

            // Write header row
            const headerRow = worksheet.addRow(headers.map(h => h.name))
            headerRow.height = 28

            // Style headers with Navy Blue background & White text
            headerRow.eachCell(cell => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1F5C99' }
                }
                cell.font = {
                    name: 'Segoe UI',
                    size: 11,
                    bold: true,
                    color: { argb: 'FFFFFFFF' }
                }
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: 'center',
                    wrapText: true
                }
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
                }
            })

            // Write details rows
            let srNo = 1
            clients.forEach(c => {
                const rowValues = [
                    srNo++,
                    c.name,
                    c.name_as_per_pan || '—',
                    c.pan_no || '—',
                    c.type || '—',
                    c.group || '—',
                    c.contact || '—',
                    c.alternative_contact || '—',
                    c.email || '—',
                    c.reference_no || '—',
                    c.dob || '—',
                    c.city || '—',
                    c.pin_code || '—',
                    c.state || '—',
                    c.gst_number || '—',
                    c.status.toUpperCase()
                ]
                const row = worksheet.addRow(rowValues)
                row.height = 22
                row.eachCell(cell => {
                    cell.font = { name: 'Segoe UI', size: 10 }
                    cell.alignment = { vertical: 'middle', horizontal: 'left' }
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                    }
                })
            })

            // Mathematical Auto-fit columns
            worksheet.columns.forEach(column => {
                let maxLen = 0
                column.eachCell({ includeEmpty: true }, cell => {
                    const val = cell.value ? cell.value.toString() : ''
                    if (val.length > maxLen) {
                        maxLen = val.length
                    }
                })
                column.width = Math.max(maxLen + 5, 12)
            })

            // Trigger direct download
            const buffer = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Clients_Register_${new Date().toISOString().split('T')[0]}.xlsx`
            a.click()
            window.URL.revokeObjectURL(url)
            toast.success('Client List exported successfully')
        } catch (e) {
            console.error(e)
            toast.error('Failed to export clients list.')
        }
    }

    // Excel Client Side Import & Preview logic
    const handleImportFile = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

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

                    // Match headers fuzzymatched
                    const headers = json[0].map(h => String(h || '').trim().toLowerCase())
                    
                    const idxName = headers.findIndex(h => h.includes('name') && !h.includes('pan'))
                    const idxNameAsPan = headers.findIndex(h => h.includes('name as per pan') || h.includes('as per pan'))
                    const idxPan = headers.findIndex(h => h.includes('pan') && !h.includes('name') && !h.includes('as per'))
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

                    if (idxName === -1 || idxPan === -1) {
                        toast.error('Could not find mandatory "Client Name" or "PAN No" columns in Excel header.')
                        return
                    }

                    // Load all active database PANs to flag duplicate rows in RED
                    const pansRes = await api.get('/ca/clients/pan-numbers')
                    const existingPans = new Set(pansRes.data.data.map(p => p.toUpperCase()))
                    existingPansRef.current = existingPans

                    const rows = []
                    for (let i = 1; i < json.length; i++) {
                        const rowData = json[i]
                        if (rowData.length === 0 || !rowData[idxName] || !rowData[idxPan]) {
                            continue // Skip completely empty rows
                        }

                        const rawPan = String(rowData[idxPan] || '').trim().toUpperCase()
                        const rawType = String(rowData[idxType] || '').trim()
                        const rawDob = String(rowData[idxDob] || '').trim()

                        const isDuplicate = existingPans.has(rawPan)

                        // Parse date properly from excel serial or string formats
                        let dobStr = ''
                        if (rawDob) {
                            if (!isNaN(rawDob)) {
                                const dateObj = new Date((Number(rawDob) - 25569) * 86400 * 1000)
                                dobStr = dateObj.toISOString().split('T')[0]
                            } else {
                                const parts = rawDob.split('/')
                                if (parts.length === 3) {
                                    dobStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
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

                        // Validate GST if provided
                        const rawGst = idxGst !== -1 ? String(rowData[idxGst] || '').trim().toUpperCase() : ''
                        if (rawGst) {
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
                            gst_number: idxGst !== -1 ? String(rowData[idxGst] || '').trim() : '',
                            credentials: {
                                efiling_password: idxEfilingPwd !== -1 ? String(rowData[idxEfilingPwd] || '').trim() : '',
                                ais_tis_password: aisTisPassword
                            },
                            isDuplicate,
                            validationError
                        })
                    }

                    setPreviewRows(rows)
                    setImportOpen(true)
                    toast.success(`Parsed ${rows.length} rows successfully. Please review preview list.`)
                } catch (e) {
                    console.error(e)
                    toast.error('Error reading details from selected sheet.')
                }
            }
            reader.readAsArrayBuffer(file)
        } catch (e) {
            console.error(e)
            toast.error('Failed to import file.')
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
            if (!row.pan_no) {
                validationError = 'PAN No is required.'
            } else if (!panRegex.test(row.pan_no)) {
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

            if (!validationError && row.gst_number) {
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

            // Re-evaluate database duplication check
            row.isDuplicate = existingPansRef.current ? existingPansRef.current.has(row.pan_no) : false

            updated[idx] = row
            return updated
        })
    }

    const handleConfirmImport = async () => {
        const validRows = previewRows.filter(r => !r.isDuplicate && !r.validationError)
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

    // Client-side search and dropdown list filtering
    const filteredClients = clients.filter(c => {
        const matchesGroup = !filterGroup || c.group === filterGroup
        const matchesType = !filterType || c.type === filterType
        return matchesGroup && matchesType
    })

    const inputCls = "w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-semibold text-slate-700 placeholder-slate-400"
    const labelCls = "text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1"

    const renderClientForm = () => (
        <div className="space-y-6 px-1">
            {/* Main Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client Name */}
                <div>
                    <label className={labelCls}>Client Name *</label>
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
                    <label className={labelCls}>Client Name As Per PAN</label>
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
                    <label className={labelCls}>PAN No *</label>
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
                    <label className={labelCls}>Contact No</label>
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
                    <label className={labelCls}>Alternative Contact No</label>
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
                    <label className={labelCls}>Email ID</label>
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
                    <label className={labelCls}>Reference No</label>
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
                    <label className={labelCls}>City</label>
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
                    <label className={labelCls}>Pin Code</label>
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
                    <label className={labelCls}>State</label>
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
                    <label className={labelCls}>Date Of Birth *</label>
                    <input 
                        type="date" 
                        value={form.dob} 
                        onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} 
                        className={inputCls} 
                    />
                    {errors.dob && <p className="text-[10px] text-red-500 mt-1">{errors.dob[0]}</p>}
                </div>

                {/* GST Number */}
                <div>
                    <label className={labelCls}>GST No</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            value={form.gst_number || ''} 
                            onChange={e => setForm(f => ({ ...f, gst_number: e.target.value.toUpperCase() }))} 
                            placeholder="GST Identification Number" 
                            className={`${inputCls} pr-8`} 
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
                    <button 
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="text-xs text-[#1F5C99] hover:underline font-bold flex items-center gap-1"
                    >
                        {showPasswords ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{showPasswords ? 'Hide Credentials' : 'Reveal Credentials'}</span>
                    </button>
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
                                <td className="px-4 py-3 font-semibold text-slate-600 flex items-center gap-1.5">
                                    <Globe size={13} className="text-slate-400" />
                                    <span>WWW.EFILING INCOME TAX</span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-indigo-100">
                                        EFILING
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-slate-600">
                                    {form.pan_no ? form.pan_no : 'LINKED TO PAN'}
                                </td>
                                <td className="px-4 py-3">
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
                                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-xs font-semibold text-slate-700"
                                    />
                                </td>
                            </tr>

                            {/* AIS & TIS row (Auto generated) */}
                            <tr>
                                <td className="px-4 py-3 font-semibold text-slate-600 flex items-center gap-1.5">
                                    <Globe size={13} className="text-slate-400" />
                                    <span>WWW.EFILING INCOME TAX</span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-100">
                                        AIS & TIS
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-slate-600">
                                    {form.pan_no ? form.pan_no : 'LINKED TO PAN'}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                        <input 
                                            type={showPasswords ? "text" : "password"} 
                                            value={form.credentials.ais_tis_password}
                                            disabled
                                            className="w-full px-2 py-1 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold cursor-not-allowed"
                                        />
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

            {/* Form Footer Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                    onClick={() => { setAddOpen(false); setEditOpen(false) }} 
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
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Client Registry</h1>
                    <p className="text-sm font-semibold text-slate-400 mt-1">Comprehensive register of business clients with secure validation checks.</p>
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
                    <button 
                        onClick={() => document.getElementById('excel-import-file').click()}
                        className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition duration-200 active:scale-95 flex-1 sm:flex-initial"
                        title="Import clients from Excel sheet"
                    >
                        <FileUp size={16} /> Import Excel
                    </button>

                    {/* Export Button */}
                    <button 
                        onClick={handleExportExcel}
                        className="flex items-center justify-center gap-2 bg-[#1F5C99] hover:bg-[#154675] text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-100 transition duration-200 active:scale-95 flex-1 sm:flex-initial"
                        title="Export clients to formatted Excel"
                    >
                        <FileDown size={16} /> Export Excel
                    </button>

                    {/* Add Client Button */}
                    <button 
                        onClick={() => { setForm(EMPTY_FORM); setErrors({}); setAddOpen(true) }}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-100 transition duration-200 active:scale-95 flex-1 sm:flex-initial"
                    >
                        <Plus size={16} /> Register Client
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
                    <select 
                        value={filterGroup} 
                        onChange={e => { setFilterGroup(e.target.value); setPage(1) }}
                        className="py-2 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition font-semibold text-slate-600"
                    >
                        <option value="">All Groups</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.name}>{g.name}</option>
                        ))}
                    </select>

                    {/* Type Filter */}
                    <select 
                        value={filterType} 
                        onChange={e => { setFilterType(e.target.value); setPage(1) }}
                        className="py-2 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition font-semibold text-slate-600"
                    >
                        <option value="">All Types</option>
                        {types.map(t => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                    </select>

                    {/* Status Filter */}
                    <select 
                        value={status} 
                        onChange={e => { setStatus(e.target.value); setPage(1) }}
                        className="py-2 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition font-semibold text-slate-600"
                    >
                        <option value="">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    {loading ? <Spinner /> : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/20">
                                    <th className="px-6 py-4 text-left">Client Name</th>
                                    <th className="px-6 py-4 text-left">PAN No</th>
                                    <th className="px-6 py-4 text-left">Type & Group</th>
                                    <th className="px-6 py-4 text-left">Contact Info</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-slate-700">
                                {filteredClients.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-slate-400 font-bold">
                                            No clients registered matching search criteria.
                                        </td>
                                    </tr>
                                ) : filteredClients.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50/30 transition">
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
                                                <Tooltip content="Edit Client">
                                                    <button 
                                                        onClick={() => openEdit(c)} 
                                                        className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-[#1F5C99] transition border border-transparent hover:border-slate-100"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                </Tooltip>
                                                <Tooltip content="Archive Client">
                                                    <button 
                                                        onClick={() => { setSelected(c); setDeleteOpen(true) }} 
                                                        className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition border border-transparent hover:border-red-100"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </Tooltip>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50 bg-slate-50/30">
                        <p className="text-xs font-semibold text-slate-400">Showing {meta.from}–{meta.to} of {meta.total} registered clients</p>
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
                    setForm(EMPTY_FORM); 
                    setErrors({}); 
                }} 
                title={editOpen ? 'Update Registered Client Details' : 'Register New CA Business Client'}
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
                                Rows highlighted in **Red** are duplicate PAN numbers already registered in the system or contain format errors and will be skipped.
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 block uppercase">Valid Rows</span>
                                <span className="text-lg font-black text-emerald-600">
                                    {previewRows.filter(r => !r.isDuplicate && !r.validationError).length}
                                </span>
                            </div>
                            <div className="text-right border-l pl-4 border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 block uppercase font-bold text-rose-600">Skipped Rows</span>
                                <span className="text-lg font-black text-rose-600">
                                    {previewRows.filter(r => r.isDuplicate || r.validationError).length}
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
                                    const hasErr = row.isDuplicate || row.validationError
                                    return (
                                        <tr 
                                            key={idx} 
                                            className={`transition ${hasErr ? 'bg-rose-50/50 hover:bg-rose-50' : 'hover:bg-slate-50/30'}`}
                                        >
                                            {/* Status Badge */}
                                            <td className="px-4 py-3 min-w-[150px]">
                                                <div className="flex flex-col gap-1">
                                                    {row.isDuplicate ? (
                                                        <span className="inline-flex items-center gap-1 bg-rose-100 border border-rose-200 text-rose-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                            <AlertTriangle size={11} /> Duplicate PAN
                                                        </span>
                                                    ) : row.validationError ? (
                                                        <span className="inline-flex items-center gap-1 bg-amber-100 border border-amber-200 text-amber-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                            <AlertTriangle size={11} /> Format Error
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
                            disabled={saving || previewRows.filter(r => !r.isDuplicate && !r.validationError).length === 0} 
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