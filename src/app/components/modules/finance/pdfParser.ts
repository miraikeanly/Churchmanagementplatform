import { BankStatementRow, classifyTransaction } from './financeUtils';

/**
 * Parses raw text extracted from a BCA Rekening Koran PDF or copy-paste text
 */
export function parseBcaPdfText(text: string, defaultYear: number = new Date().getFullYear()): BankStatementRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows: BankStatementRow[] = [];

  const dateRegex = /^(\d{2}\/\d{2})\b/;

  let currentEntry: {
    rawDate: string;
    lines: string[];
    isDb?: boolean;
  } | null = null;

  const flushEntry = () => {
    if (!currentEntry || currentEntry.lines.length === 0) return;

    const combinedDesc = currentEntry.lines.join(' ');
    // Skip headers and summary lines
    if (
      combinedDesc.includes('SALDO AWAL') ||
      combinedDesc.includes('MUTASI CR') ||
      combinedDesc.includes('MUTASI DB') ||
      combinedDesc.includes('SALDO AKHIR') ||
      combinedDesc.includes('Bersambung ke halaman') ||
      combinedDesc.includes('KETERANGAN') ||
      combinedDesc.includes('REKENING TAHAPAN')
    ) {
      currentEntry = null;
      return;
    }

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

      const glCode = classifyTransaction(cleanDesc || combinedDesc, mutasiType);
      const isTopUp = cleanDesc.toUpperCase().includes('TOP UP');

      rows.push({
        date: isoDate,
        rawDate: currentEntry.rawDate,
        description: cleanDesc || combinedDesc,
        tipe: mutasiType,
        amount,
        saldo,
        glCode,
        isTopUpBreakdown: isTopUp
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
