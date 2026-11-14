import { BankStatementRow, BreakdownSubItem } from './financeUtils';

/**
 * BCA Rekening Koran PDF Parser — precision-matched to Excel SEP26 layout
 *
 * Strategy:
 *  1. Extract all text lines from PDF via pdfjs (called in KasBankModule).
 *  2. Detect transaction lines by DD/MM date prefix.
 *  3. Each entry may span multiple lines (description continues).
 *  4. Amount/saldo are the last two numbers on the line group, with DB/CR suffix.
 *  5. Descriptions are cleaned of technical codes to match Excel keterangan.
 */

export interface ParsedTransaction {
  rawDate: string;       // DD/MM
  date: string;          // YYYY-MM-DD
  noBank?: string;       // assigned externally
  reff: string;          // GL code (e.g. 1004, OTA, ABI…)
  keterangan: string;    // cleaned description matching Excel
  tipe: 'DB' | 'CR';    // DB = keluar (Kredit), CR = masuk (Debet)
  amount: number;
  saldo?: number;
  isTopUpBreakdown: boolean;
  breakdownItems?: BreakdownSubItem[];
}

// ─── Boilerplate lines to skip ───────────────────────────────────────────────
const SKIP_PATTERNS: (string | RegExp)[] = [
  'SALDO AWAL   :',
  'MUTASI CR   :',
  'MUTASI DB   :',
  'SALDO AKHIR   :',
  'Bersambung ke halaman',
  'REKENING TAHAPAN',
  'K C P D U T A',
  'GEREJA BETHEL INDONESIA',
  'PEJAGALAN',
  'PENJARINGAN RT',
  'JL I NO 35',
  'JAKARTA 14450',
  'INDONESIA',
  'NO. REKENING',
  'HALAMAN   :',
  'PERIODE   :',
  'MATA UANG',
  'C A T A T A N',
  'Apabila nasabah',
  'Rekening ini sampai',
  'telah menyetujui',
  'Rekening ini.',
  'BCA berhak setiap',
  'Laporan Mutasi',
  'TANGGAL   KETERANGAN',
  /^\d+\s*\/\s*\d+$/,
];

function shouldSkip(line: string): boolean {
  return SKIP_PATTERNS.some(p =>
    typeof p === 'string' ? line.includes(p) : p.test(line)
  );
}

// ─── Date prefix: DD/MM ──────────────────────────────────────────────────────
const DATE_RE = /^(\d{2}\/(?:0[1-9]|1[0-2]))\s+/;

// ─── Amount extraction ───────────────────────────────────────────────────────
// Matches: 1,234,567.89 DB  or  1,234,567.89 CR  or  1,234,567.89 (last token)
const AMT_DB_RE = /([\d,]+\.\d{2})\s+DB(?:\s+([\d,]+\.\d{2}))?/;
const AMT_CR_RE = /([\d,]+\.\d{2})\s+CR(?:\s+([\d,]+\.\d{2}))?/;
const AMT_LAST_RE = /([\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?$/;

function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, ''));
}

// ─── Description cleaner ─────────────────────────────────────────────────────
// Remove amounts, CR/DB flags, reference codes that pdfjs injects
function cleanDesc(raw: string): string {
  return raw
    .replace(/[\d,]+\.\d{2}\s+(?:DB|CR)/g, '')
    .replace(/[\d,]+\.\d{2}/g, '')
    .replace(/\b\d{4}\/FT[A-Z]+\/[A-Z0-9]+\b/g, '')
    .replace(/\bWSID\d+\b/g, '')
    .replace(/TRSF\s+E-BANKING\s+(?:CR|DB)/gi, '')
    .replace(/BYR\s+VIA\s+E-BANKING/gi, '')
    .replace(/BI-FAST\s+(?:CR|DB)/gi, '')
    .replace(/TANGGAL\s*:\s*\d{2}\/\d{2}/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── GL classifier matching Excel "Reff." column ─────────────────────────────
function classifyGL(desc: string, isDB: boolean): string {
  const u = desc.toUpperCase();

  // Unit codes (match Excel exactly)
  if (u.includes('TOP UP KK') || u.includes('TOP UP'))          return 'U';
  if (u.includes('VESSEL') || u.includes('VSS'))                return 'VSS';
  if (u.includes('DIAKONIA') || u.includes('KOWARI') || u.includes('KOEMAS') || u.includes('UANG DUKA')) return 'DK';
  if (u.includes('OTA') || u.includes('SPP ') || u.includes('ANAK ASUH') || u.includes('ORANG TUA ASUH')) return 'OTA';
  if (u.includes('PEMBANGUNAN') || u.includes('ELEVATOR') || u.includes('GRANIT') || u.includes('KERAMIK') || u.includes('RENOV') || u.includes('KPP')) return 'KPP';
  if (u.includes('KOMPAS') || u.includes('PASUTRI') || u.includes('KPS'))    return 'KPS';
  if (u.includes('SEKOLAH MINGGU') || u.includes(' KABI') || u.includes('UTK ABI') || u.includes(' ABI')) return 'ABI';
  if (u.includes(' TEEN') || u.includes(' PRBI') || u.includes(' RBI'))      return 'RBI';
  if (u.includes(' WBI') || u.includes('WANITA BETHEL') || u.includes('KORWIL MARIA') || u.includes('RAKERDA WBI')) return 'WBI';

  if (isDB) {
    // Expenses / outflows
    if (u.includes('PLN') || u.includes('LISTRIK'))             return '2003';
    if (u.includes('TELKOM') || u.includes('BIZNET') || u.includes('WIFI') || u.includes('TELEPON')) return '2004';
    if (u.includes('PAM JAYA') || u.includes('PAM ') || u.includes('AIR PAM')) return '2005';
    if (u.includes('PASTORAL') || u.includes('SALARY') || u.includes('GAJI') || u.includes('CATERING')) return '2001';
    if (u.includes('PEMBICARA') || u.includes('PENGKHOTBAH'))   return '2002';
    if (u.includes('BIAYA ADM') || u.includes('ADM BCA') || u.includes('PAJAK BUNGA') || u.includes('BIAYA STATEMENT')) return '2010';
    if (u.includes('SOUND') || u.includes('MIC') || u.includes('HARDWARE')) return '3002';
    return '6001';
  } else {
    // Income / inflows
    if (u.includes('BUNGA DEP') || u.includes('BUNGA BANK') || u.includes('BILYET') || u.includes('JASA GIRO') || u.includes('TRSF BUNGA')) return '1007';
    if (u.includes('PERPULUHAN') || u.includes('PERSEPULUHAN') || u.includes('GNA220425') || u.includes('TPB826')) return '1004';
    if (u.includes('UCAPAN SYUKUR') || u.includes('UCAPAN')) return '1005';
    if (u.includes('CIMB') || u.includes('PBK DARI CIMB'))     return '1002';

    // Named tithers → 1004
    const tithers = ['EVA YULIANA', 'GINA JAYA', 'SANNY', 'VINETA', 'FANY LONTOH', 'LUTY', 'TITIH', 'FITRI', 'SANTI',
      'ROSNAWI', 'RANDY', 'SILVIANY', 'MELIANA', 'LENASARI', 'HERVY', 'ANTIONY', 'DJONI', 'BELBEN',
      'WILLIAM', 'NINI', 'IWAN', 'ONI', 'YULIANA', 'EM MELIANA'];
    if (tithers.some(t => u.includes(t)))                       return '1004';

    // General persembahan
    if (u.includes('PERSEMBAHAN KPS') || u.includes('KPS SS')) return 'KPS';
    if (u.includes('PERSEMBAHAN VESSEL'))                       return 'VSS';
    if (u.includes('QRIS') || u.includes('KR OTOMATIS') || u.includes('IR ') || u.includes('PERSEMBAHAN')) return '1001';
    return '1001';
  }
}

// ─── Main parser ─────────────────────────────────────────────────────────────
export function parseBcaPdfText(
  text: string,
  defaultYear: number = new Date().getFullYear()
): ParsedTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results: ParsedTransaction[] = [];

  // Group lines into entries starting with DD/MM
  type Entry = { rawDate: string; lines: string[] };
  const entries: Entry[] = [];
  let cur: Entry | null = null;

  for (const line of lines) {
    if (shouldSkip(line)) continue;

    const dm = line.match(DATE_RE);
    if (dm) {
      if (cur) entries.push(cur);
      cur = { rawDate: dm[1], lines: [line.slice(dm[0].length)] };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) entries.push(cur);

  for (const entry of entries) {
    const combined = entry.lines.join(' ');

    // Skip SALDO AWAL line
    if (/SALDO\s+AWAL/i.test(combined)) continue;

    // Determine DB/CR and extract amount+saldo
    let isDB = false;
    let amount = 0;
    let saldo: number | undefined;

    // Search from last line backwards for amount
    for (let i = entry.lines.length - 1; i >= 0; i--) {
      const ln = entry.lines[i];
      const mDB = ln.match(AMT_DB_RE);
      const mCR = ln.match(AMT_CR_RE);
      if (mDB) {
        amount = parseNum(mDB[1]);
        if (mDB[2]) saldo = parseNum(mDB[2]);
        isDB = true;
        break;
      }
      if (mCR) {
        amount = parseNum(mCR[1]);
        if (mCR[2]) saldo = parseNum(mCR[2]);
        isDB = false;
        break;
      }
      // Fallback: last two numbers on line without explicit CR/DB marker
      if (i === entry.lines.length - 1) {
        const mLast = ln.match(AMT_LAST_RE);
        if (mLast && !mLast[1].startsWith('0.')) {
          if (mLast[2]) {
            amount = parseNum(mLast[1]);
            saldo  = parseNum(mLast[2]);
          } else {
            amount = parseNum(mLast[1]);
          }
          // Determine direction: if 'DB' anywhere in combined text
          isDB = /\bDB\b/.test(combined);
          if (amount > 0) break;
        }
      }
    }

    if (amount <= 0) continue;

    const [day, month] = entry.rawDate.split('/');
    const date = `${defaultYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const desc = cleanDesc(combined);
    const reff = classifyGL(desc, isDB);
    const isTopUp = /TOP\s*UP\s*KK/i.test(desc);

    const breakdownItems: BreakdownSubItem[] | undefined = isTopUp ? [
      { id: `bk_${Date.now()}_1`, reff: 'U',   keterangan: 'Top Up KK Umum',   nominal: 0 },
      { id: `bk_${Date.now()}_2`, reff: 'ABI',  keterangan: 'Top Up KK ABI',    nominal: 0 },
      { id: `bk_${Date.now()}_3`, reff: 'WBI',  keterangan: 'Top Up KK WBI',    nominal: 0 },
      { id: `bk_${Date.now()}_4`, reff: 'RBI',  keterangan: 'Top Up KK RBI',    nominal: 0 },
      { id: `bk_${Date.now()}_5`, reff: 'VSS',  keterangan: 'Top Up KK Vessel', nominal: 0 },
    ] : undefined;

    results.push({
      rawDate: entry.rawDate,
      date,
      reff,
      keterangan: desc || combined,
      tipe: isDB ? 'DB' : 'CR',
      amount,
      saldo,
      isTopUpBreakdown: isTopUp,
      breakdownItems,
    });
  }

  return results;
}

// Re-export as BankStatementRow shape for backward compat
export function parseBcaPdfTextLegacy(text: string, defaultYear?: number): import('./financeUtils').BankStatementRow[] {
  return parseBcaPdfText(text, defaultYear).map(r => ({
    date: r.date,
    rawDate: r.rawDate,
    description: r.keterangan,
    tipe: r.tipe,
    amount: r.amount,
    saldo: r.saldo,
    glCode: r.reff,
    isTopUpBreakdown: r.isTopUpBreakdown,
    breakdownItems: r.breakdownItems,
  }));
}
