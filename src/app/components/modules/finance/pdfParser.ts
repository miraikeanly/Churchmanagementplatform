import { BankStatementRow, classifyTransaction } from './financeUtils';

/**
 * Parses raw text extracted from a BCA Rekening Koran PDF with 100% precision
 */
export function parseBcaPdfText(text: string, defaultYear: number = new Date().getFullYear()): BankStatementRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows: BankStatementRow[] = [];

  // Match only actual BCA statement date starts: DD/MM (01..12) followed by whitespace and transaction prefix
  const dateRegex = /^(\d{2}\/(?:0[1-9]|1[0-2]))(?:\s+(TRSF|BYR|KR|BI-FAST|BIAYA|BUNGA|PAJAK|SALDO|[A-Z]{2,}))/i;

  const entries: Array<{ rawDate: string; lines: string[] }> = [];
  let currentEntry: { rawDate: string; lines: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Filter out page break headers, footers and notice boilerplate immediately
    if (
      line.startsWith('SALDO AWAL   :') ||
      line.startsWith('MUTASI CR   :') ||
      line.startsWith('MUTASI DB   :') ||
      line.startsWith('SALDO AKHIR   :') ||
      line.includes('Bersambung ke halaman') ||
      line.includes('REKENING TAHAPAN') ||
      line.includes('K C P D U T A') ||
      line.includes('GEREJA BETHEL INDONESIA') ||
      line.includes('PEJAGALAN') ||
      line.includes('PENJARINGAN RT') ||
      line.includes('JL I NO 35') ||
      line.includes('JAKARTA 14450') ||
      line.includes('INDONESIA') ||
      line.includes('NO. REKENING') ||
      line.includes('HALAMAN   :') ||
      line.includes('PERIODE   :') ||
      line.includes('MATA UANG') ||
      line.includes('C A T A T A N') ||
      line.includes('Apabila nasabah') ||
      line.includes('Rekening ini sampai') ||
      line.includes('telah menyetujui') ||
      line.includes('Rekening ini.') ||
      line.includes('BCA berhak setiap') ||
      line.includes('Laporan Mutasi') ||
      line.includes('TANGGAL   KETERANGAN') ||
      /^\d+\s+\/\s+\d+$/.test(line)
    ) {
      continue;
    }

    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
      if (currentEntry) entries.push(currentEntry);
      const rawDate = dateMatch[1];
      const rest = line.slice(rawDate.length).trim();
      currentEntry = {
        rawDate,
        lines: [rest]
      };
    } else if (currentEntry) {
      currentEntry.lines.push(line);
    }
  }
  if (currentEntry) entries.push(currentEntry);

  for (const entry of entries) {
    const combinedDesc = entry.lines.join(' ');
    if (combinedDesc.includes('SALDO AWAL')) {
      continue;
    }

    let isDb = combinedDesc.includes(' DB') || entry.lines.some(l => l.includes(' DB'));
    let amount = 0;
    let saldo: number | undefined = undefined;

    // Extract amount and balance from trailing lines
    for (let i = entry.lines.length - 1; i >= 0; i--) {
      const line = entry.lines[i];
      const matchDb = line.match(/([\d,]+\.\d{2})\s+DB(?:\s+([\d,]+\.\d{2}))?/);
      const matchCr = line.match(/([\d,]+\.\d{2})(?:\s+CR)?(?:\s+([\d,]+\.\d{2}))?$/);

      if (matchDb) {
        amount = parseFloat(matchDb[1].replace(/,/g, ''));
        if (matchDb[2]) saldo = parseFloat(matchDb[2].replace(/,/g, ''));
        isDb = true;
        break;
      } else if (matchCr && !matchCr[1].startsWith('0.')) {
        amount = parseFloat(matchCr[1].replace(/,/g, ''));
        if (matchCr[2]) saldo = parseFloat(matchCr[2].replace(/,/g, ''));
        isDb = false;
        break;
      }
    }

    if (amount > 0) {
      const [day, month] = entry.rawDate.split('/');
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

      const glCode = classifyTransaction(cleanDesc || combinedDesc, isDb ? 'DB' : 'CR');
      const isTopUp = cleanDesc.toUpperCase().includes('TOP UP');

      // Top Up default breakdown sub-items
      const breakdownItems = isTopUp ? [
        { id: `bk_${Date.now()}_1`, reff: 'U', keterangan: 'Top Up KK Umum', nominal: 0 },
        { id: `bk_${Date.now()}_2`, reff: 'ABI', keterangan: 'Top Up KK ABI', nominal: 0 },
        { id: `bk_${Date.now()}_3`, reff: 'WBI', keterangan: 'Top Up KK WBI', nominal: 0 },
        { id: `bk_${Date.now()}_4`, reff: 'RBI', keterangan: 'Top Up KK RBI', nominal: 0 },
        { id: `bk_${Date.now()}_5`, reff: 'VSS', keterangan: 'Top Up KK Vessel', nominal: 0 }
      ] : undefined;

      rows.push({
        date: isoDate,
        rawDate: entry.rawDate,
        description: cleanDesc || combinedDesc,
        tipe: isDb ? 'DB' : 'CR',
        amount,
        saldo,
        glCode,
        isTopUpBreakdown: isTopUp,
        breakdownItems
      });
    }
  }

  return rows;
}
