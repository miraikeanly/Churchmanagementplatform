import { classifyTransaction, BankStatementRow } from './glDefinitions';

/**
 * Parses raw text extracted from a BCA Rekening Koran PDF or text copy
 */
export function parseBcaStatementText(text: string, defaultYear: number = new Date().getFullYear()): BankStatementRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows: BankStatementRow[] = [];

  // Regex for date: e.g. 01/09 or 28/09 or 30/09
  const dateRegex = /^(\d{2}\/\d{2})\b/;
  const amountRegex = /([\d,]+\.\d{2})(\s+(?:DB|CR))?$/;

  let currentEntry: {
    rawDate: string;
    lines: string[];
    amountStr?: string;
    isDb?: boolean;
    saldoStr?: string;
  } | null = null;

  const flushEntry = () => {
    if (!currentEntry || currentEntry.lines.length === 0) return;
    
    const combinedDesc = currentEntry.lines.join(' ');
    // Skip headers and summary lines
    if (combinedDesc.includes('SALDO AWAL') || combinedDesc.includes('MUTASI CR') || combinedDesc.includes('MUTASI DB') || combinedDesc.includes('SALDO AKHIR') || combinedDesc.includes('Bersambung ke halaman')) {
      currentEntry = null;
      return;
    }

    // Try to find amount and DB/CR from lines
    let mutasiType: 'CR' | 'DB' = currentEntry.isDb ? 'DB' : 'CR';
    let amount = 0;
    let saldo: number | undefined = undefined;

    // Search for numbers in combined text
    // Example: "5,295,700.00 317,066,882.79" or "29,080,050.00 DB"
    for (let i = currentEntry.lines.length - 1; i >= 0; i--) {
      const line = currentEntry.lines[i];
      const matchDb = line.match(/([\d,]+\.\d{2})\s+DB/);
      const matchCr = line.match(/([\d,]+\.\d{2})(?:\s+CR)?(?:\s+([\d,]+\.\d{2}))?$/);
      
      if (matchDb) {
        amount = parseFloat(matchDb[1].replace(/,/g, ''));
        mutasiType = 'DB';
        break;
      } else if (matchCr) {
        const num1 = parseFloat(matchCr[1].replace(/,/g, ''));
        if (matchCr[2]) {
          saldo = parseFloat(matchCr[2].replace(/,/g, ''));
        }
        amount = num1;
        mutasiType = 'CR';
        break;
      }
    }

    if (amount > 0) {
      const [day, month] = currentEntry.rawDate.split('/');
      const isoDate = `${defaultYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      // Clean description
      const cleanDesc = combinedDesc
        .replace(/([\d,]+\.\d{2})(\s+(?:DB|CR))?/g, '')
        .replace(/\b\d{4}\/FTSCY\/[A-Z0-9]+\b/g, '')
        .replace(/\b\d{4}\/FTFVA\/[A-Z0-9]+\b/g, '')
        .replace(/\bWSID\d+\b/g, '')
        .replace(/TRSF E-BANKING (?:CR|DB)/g, '')
        .replace(/BYR VIA E-BANKING/g, '')
        .replace(/BI-FAST CR/g, '')
        .replace(/TANGGAL\s*:\d{2}\/\d{2}/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const classified = classifyTransaction(cleanDesc || combinedDesc, mutasiType, amount);

      rows.push({
        date: isoDate,
        rawDate: currentEntry.rawDate,
        description: cleanDesc || combinedDesc,
        mutasiType,
        amount,
        saldo,
        autoGLCode: classified.glCode,
        notes: classified.targetUnit ? `Auto Masuk Kas Unit: ${classified.targetUnit}` : undefined
      });
    }

    currentEntry = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(dateRegex);

    if (dateMatch) {
      flushEntry();
      const rawDate = dateMatch[1];
      const restOfLine = line.slice(rawDate.length).trim();
      currentEntry = {
        rawDate,
        lines: restOfLine ? [restOfLine] : [],
        isDb: line.includes(' DB')
      };
    } else if (currentEntry) {
      currentEntry.lines.push(line);
      if (line.includes(' DB')) currentEntry.isDb = true;
    }
  }

  flushEntry();
  return rows;
}

/**
 * Parses CSV/Excel exported rows from internet banking or general kas
 */
export function parseBcaCsvRows(data: any[][], defaultYear: number = new Date().getFullYear()): BankStatementRow[] {
  const rows: BankStatementRow[] = [];

  if (!Array.isArray(data)) return rows;

  for (const row of data) {
    if (!row || !Array.isArray(row) || row.length < 2) continue;

    // Filter out completely empty rows
    const nonNullCols = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '');
    if (nonNullCols.length === 0) continue;

    // Look for date in the first 3 columns
    let isoDate = '';
    let rawDate = '';
    let dateColIdx = -1;

    for (let c = 0; c < Math.min(row.length, 3); c++) {
      const cellVal = row[c];
      if (cellVal === null || cellVal === undefined) continue;

      let cellStr = '';
      if (typeof cellVal === 'number') {
        // Excel serial date number check (e.g., 45500 for ~2024)
        if (cellVal > 25569 && cellVal < 60000) {
          const jsDate = new Date(Math.round((cellVal - 25569) * 86400 * 1000));
          if (!isNaN(jsDate.getTime())) {
            const y = jsDate.getFullYear();
            const m = String(jsDate.getMonth() + 1).padStart(2, '0');
            const d = String(jsDate.getDate()).padStart(2, '0');
            isoDate = `${y}-${m}-${d}`;
            rawDate = `${d}/${m}`;
            dateColIdx = c;
            break;
          }
        }
        cellStr = String(cellVal);
      } else if (cellVal instanceof Date) {
        const y = cellVal.getFullYear();
        const m = String(cellVal.getMonth() + 1).padStart(2, '0');
        const d = String(cellVal.getDate()).padStart(2, '0');
        isoDate = `${y}-${m}-${d}`;
        rawDate = `${d}/${m}`;
        dateColIdx = c;
        break;
      } else {
        cellStr = String(cellVal).trim();
      }

      if (!cellStr) continue;

      // 1. Format: YYYY-MM-DD
      const mIso = cellStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (mIso) {
        isoDate = `${mIso[1]}-${mIso[2].padStart(2, '0')}-${mIso[3].padStart(2, '0')}`;
        rawDate = `${mIso[3].padStart(2, '0')}/${mIso[2].padStart(2, '0')}`;
        dateColIdx = c;
        break;
      }

      // 2. Format: DD/MM/YYYY or DD-MM-YYYY
      const mDmy = cellStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (mDmy) {
        const y = mDmy[3].length === 2 ? `20${mDmy[3]}` : mDmy[3];
        isoDate = `${y}-${mDmy[2].padStart(2, '0')}-${mDmy[1].padStart(2, '0')}`;
        rawDate = `${mDmy[1].padStart(2, '0')}/${mDmy[2].padStart(2, '0')}`;
        dateColIdx = c;
        break;
      }

      // 3. Format: DD/MM
      const mDm = cellStr.match(/^(\d{1,2})\/(\d{1,2})$/);
      if (mDm) {
        isoDate = `${defaultYear}-${mDm[2].padStart(2, '0')}-${mDm[1].padStart(2, '0')}`;
        rawDate = `${mDm[1].padStart(2, '0')}/${mDm[2].padStart(2, '0')}`;
        dateColIdx = c;
        break;
      }
    }

    if (!isoDate || dateColIdx === -1) continue;

    // Scan subsequent columns for text description and debet/kredit amounts
    let desc = '';
    let debet = 0;
    let kredit = 0;

    for (let c = 0; c < row.length; c++) {
      if (c === dateColIdx) continue;
      const cell = row[c];
      if (cell === null || cell === undefined) continue;

      if (typeof cell === 'number') {
        if (cell > 0) {
          if (debet === 0) debet = cell;
          else if (kredit === 0) kredit = cell;
        }
      } else {
        const strVal = String(cell).trim();
        if (!strVal) continue;

        // Skip headers or saldo words
        if (strVal.toUpperCase() === 'SALDO' || strVal.toUpperCase() === 'TANGGAL' || strVal.toUpperCase() === 'DEBET' || strVal.toUpperCase() === 'KREDIT') {
          continue;
        }

        // Check if string is a number (e.g. "6,300,000" or "6300000.00")
        const cleanNumStr = strVal.replace(/[^\d.-]/g, '');
        const parsedNum = parseFloat(cleanNumStr);
        if (!isNaN(parsedNum) && parsedNum > 0 && /^\d/.test(strVal)) {
          if (debet === 0) debet = parsedNum;
          else if (kredit === 0) kredit = parsedNum;
        } else {
          // It's a text description
          if (!strVal.startsWith('BCA') && !strVal.startsWith('KB') && !strVal.startsWith('KK') && !strVal.startsWith('i2')) {
            desc += (desc ? ' ' : '') + strVal;
          }
        }
      }
    }

    if (debet > 0 || kredit > 0) {
      const mutasiType = kredit > 0 ? 'DB' : 'CR';
      const amount = kredit > 0 ? kredit : debet;
      const cleanDesc = desc || 'Transaksi Kas';
      const classified = classifyTransaction(cleanDesc, mutasiType, amount);

      rows.push({
        date: isoDate,
        rawDate,
        description: cleanDesc,
        mutasiType,
        amount,
        autoGLCode: classified.glCode,
        notes: classified.targetUnit ? `Auto Masuk Kas: ${classified.targetUnit}` : undefined
      });
    }
  }

  return rows;
}
