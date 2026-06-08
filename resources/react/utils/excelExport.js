import { toast } from 'react-hot-toast'

/**
 * Common stylized Excel export function using exceljs.
 * Supports multiple sheets.
 * 
 * @param {Object} options
 * @param {string} options.filename - Name of the exported file
 * @param {Array} options.sheets - Array of sheet configurations
 * @param {string} options.sheets[].sheetName - Name of the worksheet
 * @param {string} options.sheets[].title - Large title for the sheet
 * @param {string} [options.sheets[].subtitle] - Subtitle (e.g. date generated)
 * @param {Array<string>} options.sheets[].headers - Column headers
 * @param {Array<Array<any>>} options.sheets[].rows - Row data arrays matching the headers
 */
export async function exportToExcel({ filename, sheets = [] }) {
    try {
        const ExcelJS = await import('exceljs')
        const workbook = new ExcelJS.Workbook()

        const getColLetter = (colIdx) => {
            let temp = colIdx
            let letter = ''
            while (temp > 0) {
                let modulo = (temp - 1) % 26
                letter = String.fromCharCode(65 + modulo) + letter
                temp = Math.floor((temp - modulo) / 26)
            }
            return letter
        }

        sheets.forEach(({ sheetName, title, subtitle, headers = [], rows = [] }) => {
            const worksheet = workbook.addWorksheet(sheetName || 'Sheet')

            const colCount = Math.max(headers.length, 6)
            const endColLetter = getColLetter(colCount)

            // 1. Title Row (Row 1)
            worksheet.mergeCells(`A1:${endColLetter}1`)
            const titleCell = worksheet.getCell('A1')
            titleCell.value = title
            titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
            
            // 2. Subtitle Row (Row 2)
            worksheet.mergeCells(`A2:${endColLetter}2`)
            const subtitleCell = worksheet.getCell('A2')
            subtitleCell.value = subtitle || `Generated at: ${new Date().toLocaleString()}`
            subtitleCell.font = { italic: true, color: { argb: 'FFFFFFFF' }, size: 10 }

            // Apply styling and fill to all cells in rows 1 and 2 to ensure styling stretches across the merge
            for (let i = 1; i <= colCount; i++) {
                const colLetter = getColLetter(i);
                const tCell = worksheet.getCell(`${colLetter}1`);
                tCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1F5C99' }
                };
                tCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

                const sCell = worksheet.getCell(`${colLetter}2`);
                sCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1F5C99' }
                };
                sCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            }

            worksheet.getRow(1).height = 30
            worksheet.getRow(2).height = 20

            // Row 3 is empty space
            worksheet.getRow(3).height = 10

            // 3. Header Row (Row 4)
            worksheet.getRow(4).values = headers
            const headerRow = worksheet.getRow(4)
            headerRow.height = 25
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF154673' }
                }
                cell.alignment = { vertical: 'middle', horizontal: 'center' }
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                }
            })

            // 4. Data Rows (Row 5+)
            rows.forEach((rowData) => {
                worksheet.addRow(rowData)
            })

            // Style data cells
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 4) {
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        }
                        cell.alignment = { vertical: 'middle', wrapText: true }
                    })
                }
            })

            // 5. Auto Column Widths (ignoring rows 1-3)
            worksheet.columns.forEach((column) => {
                let maxLength = 0
                column.eachCell({ includeEmpty: true }, (cell) => {
                    if (cell.row > 3) {
                        const columnLength = cell.value ? cell.value.toString().length : 10
                        if (columnLength > maxLength) {
                            maxLength = columnLength
                        }
                    }
                })
                column.width = maxLength < 12 ? 12 : (maxLength > 50 ? 50 : maxLength + 2)
            })
        })

        const buffer = await workbook.xlsx.writeBuffer()
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename || `export_${new Date().toISOString().split('T')[0]}.xlsx`
        a.click()
        window.URL.revokeObjectURL(url)
        toast.success('Excel exported successfully')
    } catch (err) {
        console.error('Export Error:', err)
        toast.error('Failed to export to Excel')
    }
}
