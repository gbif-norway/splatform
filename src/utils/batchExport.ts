/** Longest single line in a string (handles \n, \r\n). */
function longestLineLength(value: string): number {
    let max = 0;
    for (const line of String(value).split(/\r\n|\r|\n/)) {
        if (line.length > max) max = line.length;
    }
    return max;
}

/** Line count for row-height heuristic. */
function lineCount(value: string): number {
    const s = String(value);
    if (!s) return 1;
    return s.split(/\r\n|\r|\n/).length;
}

export function tableToCsvBlob(headers: string[], rows: string[][]): Blob {
    const escapeCell = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
    const lines = [headers.map(escapeCell).join(','), ...rows.map(row => row.map(escapeCell).join(','))];
    return new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
}

const MAX_ROW_HEIGHT_PT = 409;

export async function tableToXlsxBlob(headers: string[], rows: string[][]): Promise<Blob> {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Results', {
        views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.addRow(headers);
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' };

    for (const cells of rows) {
        const row = sheet.addRow(cells);
        const lines = cells.map(c => lineCount(c));
        const maxLines = Math.max(1, ...lines);
        row.height = Math.min(MAX_ROW_HEIGHT_PT, Math.max(15, 12 + maxLines * 14));
        row.eachCell((cell) => {
            cell.alignment = { wrapText: true, vertical: 'top' };
        });
    }

    const colCount = headers.length;
    const sample =
        rows.length <= 120 ? rows : [...rows.slice(0, 60), ...rows.slice(-60)];

    for (let c = 0; c < colCount; c++) {
        let widthChars = longestLineLength(headers[c] ?? '');
        for (const r of sample) {
            widthChars = Math.max(widthChars, longestLineLength(r[c] ?? ''));
        }
        widthChars = Math.min(widthChars, 240);
        sheet.getColumn(c + 1).width = Math.min(72, Math.max(10, 1.1 * widthChars + 2));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
}
