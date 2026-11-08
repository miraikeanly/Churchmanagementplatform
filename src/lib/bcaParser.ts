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

  for (const row of data) {
    if (!row || row.length < 3) continue;

    const rowStr = row.map(c => String(c || '').trim());
    const firstCol = rowStr[0];

    // Check if first col is a date (YYYY-MM-DD or DD/MM/YYYY or DD/MM)
    let isoDate = '';
    let rawDate = '';
    
    if (firstCol.match(/^\d{4}-\d{2}-\d{2}$/)) {
      isoDate = firstCol;
      rawDate = firstCol.slice(8, 10) + '/' + firstCol.slice(5, 7);
    } else if (firstCol.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)) {
      const match = firstCol.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)!;
      const y = match[3].length === 2 ? `20${match[3]}` : match[3];
      isoDate = `${y}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      rawDate = `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}`;
    } else if (firstCol.match(/^(\d{2})\/(\d{2})$/)) {
      const match = firstCol.match(/^(\d{2})\/(\d{2})$/)!;
      isoDate = `${defaultYear}-${match[2]}-${match[1]}`;
      rawDate = firstCol;
    }

    if (!isoDate) continue;

    // Find description and debet/kredit
    // In typical GL format: Tanggal, No, Reff, Keterangan, Rincian, Debet, Kredit, Saldo
    let desc = '';
    let debet = 0;
    let kredit = 0;

    for (let c = 1; c < rowStr.length; c++) {
      const val = rowStr[c];
      const num = parseFloat(val.replace(/[^\d.-]/g, ''));
      if (isNaN(num)) {
        if (val.length > 3 && !val.startsWith('BCA') && !val.startsWith('KB') && !val.startsWith('i2')) {
          desc += (desc ? ' - ' : '') + val;
        }
      } else if (num > 0) {
        if (debet === 0) debet = num;
        else if (kredit === 0) kredit = num;
      }
    }

    if (debet > 0 || kredit > 0) {
      const mutasiType = kredit > 0 ? 'DB' : 'CR';
      const amount = kredit > 0 ? kredit : debet;
      const classified = classifyTransaction(desc, mutasiType, amount);

      rows.push({
        date: isoDate,
        rawDate,
        description: desc,
        mutasiType,
        amount,
        autoGLCode: classified.glCode,
        notes: classified.targetUnit ? `Auto Masuk Kas: ${classified.targetUnit}` : undefined
      });
    }
  }

  return rows;
}
