export interface GLAccount {
  code: string;
  name: string;
  type: 'income' | 'expense' | 'unit';
  unitCategory?: 'komisi' | 'kas-unit' | 'umum';
  description: string;
}

export const INITIAL_GL_ACCOUNTS: Record<string, GLAccount> = {
  // PENDAPATAN / KAS MASUK
  '1001': { code: '1001', name: 'Persembahan Pertama / Umum / QRIS', type: 'income', description: 'Persembahan umum ibadah raya, kantong & QRIS' },
  '1002': { code: '1002', name: 'Arus Kas Bank CIMB / Khusus', type: 'income', description: 'Persembahan via transfer bank CIMB / QR' },
  '1004': { code: '1004', name: 'Perpuluhan', type: 'income', description: 'Persepuluhan jemaat' },
  '1005': { code: '1005', name: 'Ucapan Syukur', type: 'income', description: 'Persembahan ucapan syukur HUT / berkat' },
  '1007': { code: '1007', name: 'Pendapatan Bunga Bank / Deposito', type: 'income', description: 'Transfer bunga deposito & jasa giro bank' },

  // BIAYA / PENGELUARAN
  '2001': { code: '2001', name: 'Pelayanan / Pengerja / Pastoral / Gaji', type: 'expense', description: 'Pastoral bulanan, salary staf, catering pelayan' },
  '2002': { code: '2002', name: 'Pembicara / Pengkhotbah', type: 'expense', description: 'Honorarium pembicara ibadah raya' },
  '2003': { code: '2003', name: 'Biaya Listrik PLN', type: 'expense', description: 'Tagihan PLN G35 & G52' },
  '2004': { code: '2004', name: 'Biaya Komunikasi / Telkom / Internet', type: 'expense', description: 'Telkom telepon kantor & Biznet WiFi' },
  '2005': { code: '2005', name: 'Biaya Air PAM', type: 'expense', description: 'PAM Jaya G35 & G52' },
  '2010': { code: '2010', name: 'Biaya Administrasi Bank & Pajak', type: 'expense', description: 'Biaya admin bulanan BCA dan pajak bunga' },
  '3001': { code: '3001', name: 'Biaya Pelayanan Besuk', type: 'expense', description: 'Kunjungan jemaat sakit, buah besuk' },
  '3002': { code: '3002', name: 'Biaya Perlengkapan / Hardware', type: 'expense', description: 'Peralatan musik, mic, komputer' },
  '3003': { code: '3003', name: 'Biaya Kesra', type: 'expense', description: 'Kesejahteraan jemaat / staf' },
  '4001': { code: '4001', name: 'Admin Fee Bank Lain (CIMB dll)', type: 'expense', description: 'Biaya admin rekening bank selain BCA' },
  '6001': { code: '6001', name: 'Biaya Lain-lain / Operasional', type: 'expense', description: 'Kopi, ATK, karbol, perlengkapan ibadah, bunga duka' },

  // UNIT / KOMISI
  'ABI': { code: 'ABI', name: 'Komisi Anak (KABI / Sekolah Minggu)', type: 'unit', unitCategory: 'komisi', description: 'Kas Bank & Kas Kecil KABI' },
  'RBI': { code: 'RBI', name: 'Komisi Remaja (PRBI / Teens)', type: 'unit', unitCategory: 'komisi', description: 'Kas Bank & Kas Kecil PRBI' },
  'WBI': { code: 'WBI', name: 'Komisi Wanita (WBI)', type: 'unit', unitCategory: 'komisi', description: 'Kas Bank & Kas Kecil Wanita Bethel Indonesia' },
  'KPS': { code: 'KPS', name: 'Komisi Pasutri (KOMPAS)', type: 'unit', unitCategory: 'komisi', description: 'Kas Bank Komunitas Pasutri' },
  'VSS': { code: 'VSS', name: 'Kas Vessel Youth Community', type: 'unit', unitCategory: 'komisi', description: 'Kas Pemuda Vessel Youth' },
  'DK':  { code: 'DK',  name: 'Kas Diakonia (Kowari & Koemas)', type: 'unit', unitCategory: 'kas-unit', description: 'Sembako, uang duka, santunan, bantuan kesehatan' },
  'KPP': { code: 'KPP', name: 'Kas Proyek Pembangunan (Gedung)', type: 'unit', unitCategory: 'kas-unit', description: 'Renovasi gedung, lift, sound system' },
  'OTA': { code: 'OTA', name: 'Kas Orang Tua Asuh (SPP / Beasiswa)', type: 'unit', unitCategory: 'kas-unit', description: 'Donasi beasiswa & pembayaran SPP anak asuh' },
  'NTL': { code: 'NTL', name: 'Kas Sisa Dana Natal', type: 'unit', unitCategory: 'kas-unit', description: 'Sisa anggaran perayaan Natal' },
  'U':   { code: 'U',   name: 'Kas Kecil Umum (Tante Yanti)', type: 'unit', unitCategory: 'umum', description: 'Petty cash operasional harian gereja' }
};

export interface BankStatementRow {
  date: string; // YYYY-MM-DD
  rawDate?: string;
  description: string;
  tipe: 'CR' | 'DB';
  amount: number;
  saldo?: number;
  glCode?: string;
  notes?: string;
  isTopUpBreakdown?: boolean;
}

export interface KasBankItem {
  id: string;
  tanggal: string; // YYYY-MM-DD
  noBank: string; // e.g. BCA260001, KB260001
  reff: string; // Kode GL / Unit (e.g. 1004, KPP, OTA)
  keterangan: string; // e.g. Perpuluhan Gina Jaya
  tipe: 'Debet' | 'Kredit'; // Debet: Masuk (CR), Kredit: Keluar (DB)
  nominal: number; // Raw amount
  rincian?: number; // Optional sub-detail amount (e.g. in multi-item transfers)
  debet?: number; // Calculated/explicit debet
  kredit?: number; // Calculated/explicit kredit
  saldoBerjalan?: number; // Running total balance
  note?: string; // Optional user note
  isOpeningBalance?: boolean;
  extraColumns?: Record<string, string | number>;
}

export interface CustomColumn {
  id: string;
  label: string;
  type: 'text' | 'number';
}

/**
 * Format currency in Indonesian Rupiah format: Rp 1.000.000,00
 */
export function formatRupiah(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '-';
  const parts = Math.abs(val).toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${val < 0 ? '-' : ''}Rp ${integerPart},${parts[1]}`;
}

/**
 * Auto-classify a transaction description to a GL code
 */
export function classifyTransaction(desc: string, tipe: 'CR' | 'DB' | 'Debet' | 'Kredit'): string {
  const upper = desc.toUpperCase();
  const isCredit = tipe === 'CR' || tipe === 'Debet'; // Uang Masuk

  if (upper.includes('TOP UP KK') || upper.includes('TOP UP')) {
    return 'U';
  }
  if (upper.includes('SEKOLAH MINGGU') || upper.includes(' KABI') || upper.includes('UTK ABI') || upper.includes('PERSEMBAHAN ABI') || upper.includes('KK ABI')) {
    return 'ABI';
  }
  if (upper.includes(' TEEN') || upper.includes(' PRBI') || upper.includes('PERSEMBAHAN RBI') || upper.includes('KK RBI') || upper.includes('PASKAH TEEN')) {
    return 'RBI';
  }
  if (upper.includes('PERSEMBAHAN WBI') || upper.includes('KK WBI') || upper.includes('KORWIL MARIA') || upper.includes('RAKERDA WBI')) {
    return 'WBI';
  }
  if (upper.includes('KOMPAS') || upper.includes('PERSEMBAHAN KPS') || upper.includes('PASUTRI') || upper.includes('KPS SS')) {
    return 'KPS';
  }
  if (upper.includes('VESSEL') || upper.includes('VSS') || upper.includes('KK VESSEL') || upper.includes('YOUTH VESSEL')) {
    return 'VSS';
  }
  if (upper.includes('DIAKONIA') || upper.includes('SEMBAKO') || upper.includes('KOEMAS') || upper.includes('KOWARI') || upper.includes('UANG DUKA') || upper.includes('BESUK')) {
    return 'DK';
  }
  if (upper.includes('PEMBANGUNAN') || upper.includes('ELEVATOR') || upper.includes('MITRA GLOBAL') || upper.includes('GRANIT') || upper.includes('KERAMIK') || upper.includes('RENOV')) {
    return 'KPP';
  }
  if (upper.includes('OTA') || upper.includes('SPP ') || upper.includes('ANAK ASUH') || upper.includes('ORANG TUA ASUH')) {
    return 'OTA';
  }

  if (!isCredit) {
    // Pengeluaran / Kredit di Buku Kas
    if (upper.includes('PLN') || upper.includes('LISTRIK')) return '2003';
    if (upper.includes('TELKOM') || upper.includes('BIZNET') || upper.includes('WIFI') || upper.includes('TELEPON')) return '2004';
    if (upper.includes('PAM JAYA') || upper.includes('PAM ') || upper.includes('AIR PAM')) return '2005';
    if (upper.includes('PASTORAL') || upper.includes('SALARY') || upper.includes('GAJI') || upper.includes('CATERING PELAYAN')) return '2001';
    if (upper.includes('PEMBICARA') || upper.includes('PENGKHOTBAH') || upper.includes('PK PEMBICARA')) return '2002';
    if (upper.includes('BIAYA ADM') || upper.includes('ADM BCA') || upper.includes('PAJAK BUNGA') || upper.includes('BIAYA STATEMENT')) return '2010';
    if (upper.includes('SOUND') || upper.includes('STAND') || upper.includes('MIC') || upper.includes('HARDWARE')) return '3002';
    return '6001';
  } else {
    // Penerimaan / Debet di Buku Kas
    if (upper.includes('BUNGA DEP') || upper.includes('BUNGA BANK') || upper.includes('BILYET') || upper.includes('JASA GIRO')) return '1007';
    if (upper.includes('PERPULUHAN') || upper.includes('PERSEPULUHAN') || upper.includes('GNA220425') || upper.includes('TPB826')) return '1004';
    if (upper.includes('UCAPAN SYUKUR') || upper.includes('SYUKUR')) return '1005';
    if (upper.includes('CIMB') || upper.includes('PBK DARI CIMB')) return '1002';
    if (upper.includes('QRIS') || upper.includes('KR OTOMATIS') || upper.includes('PERSEMBAHAN') || upper.includes('IR ')) return '1001';

    const tithesKeywords = ['EVA YULIANA', 'GINA JAYA', 'SANNY', 'VINETA', 'FANY LONTOH', 'LUTY', 'TITIH', 'FITRI', 'SANTI', 'ROSNAWI', 'RANDY', 'SILVIANY', 'MELIANA', 'LENASARI', 'HERVY', 'ANTIONY', 'DJONI', 'BELBEN'];
    for (const kw of tithesKeywords) {
      if (upper.includes(kw)) return '1004';
    }
    return '1001';
  }
}
