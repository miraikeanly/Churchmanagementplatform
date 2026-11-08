/**
 * GL and Finance Master Definitions & Auto-Classification Rules
 * Matched exactly with GBI Jelambar Timur's Buku Kas & GL Excel architecture.
 */

export interface GLAccount {
  code: string;
  name: string;
  type: 'income' | 'expense' | 'unit';
  unitCategory?: 'komisi' | 'kas-unit' | 'umum';
  description: string;
}

export const GL_ACCOUNTS: Record<string, GLAccount> = {
  // PENDAPATAN / KAS MASUK
  '1001': { code: '1001', name: 'Persembahan Pertama / Umum / QRIS', type: 'income', description: 'Persembahan umum ibadah raya, kantong persembahan & QRIS' },
  '1002': { code: '1002', name: 'Arus Kas Bank CIMB / Khusus', type: 'income', description: 'Persembahan via transfer bank CIMB / QR' },
  '1004': { code: '1004', name: 'Perpuluhan', type: 'income', description: 'Persepuluhan jemaat' },
  '1005': { code: '1005', name: 'Ucapan Syukur', type: 'income', description: 'Persembahan ucapan syukur jemaat / HUT / berkat' },
  '1007': { code: '1007', name: 'Pendapatan Bunga Bank / Deposito', type: 'income', description: 'Transfer bunga deposito & jasa giro bank' },

  // BIAYA / PENGELUARAN
  '2001': { code: '2001', name: 'Pelayanan / Pengerja / Pastoral / Gaji', type: 'expense', description: 'Pastoral bulanan, salary staf, catering pelayan, gathering pelayan' },
  '2002': { code: '2002', name: 'Pembicara / Pengkhotbah', type: 'expense', description: 'Honorarium & PK pembicara ibadah raya' },
  '2003': { code: '2003', name: 'Biaya Listrik PLN', type: 'expense', description: 'Tagihan PLN G35 & G52' },
  '2004': { code: '2004', name: 'Biaya Komunikasi / Telkom / Internet', type: 'expense', description: 'Telkom telepon kantor & Biznet WiFi' },
  '2005': { code: '2005', name: 'Biaya Air PAM', type: 'expense', description: 'PAM Jaya G35 & G52' },
  '2010': { code: '2010', name: 'Biaya Administrasi Bank & Pajak', type: 'expense', description: 'Biaya admin bulanan BCA, buku cek, dan pajak bunga' },
  '3001': { code: '3001', name: 'Biaya Pelayanan Besuk', type: 'expense', description: 'Kunjungan jemaat sakit, buah besuk' },
  '3002': { code: '3002', name: 'Biaya Perlengkapan / Hardware', type: 'expense', description: 'Peralatan musik, mic, komputer, stand' },
  '3003': { code: '3003', name: 'Biaya Kesra', type: 'expense', description: 'Kesejahteraan jemaat / staf' },
  '4001': { code: '4001', name: 'Admin Fee Bank Lain (CIMB dll)', type: 'expense', description: 'Biaya admin rekening bank selain BCA' },
  '6001': { code: '6001', name: 'Biaya Lain-lain / Operasional', type: 'expense', description: 'Kopi, ATK, karbol, laundry tamborin, aqua/cleo, sampah, bensin vario' },

  // KAS UNIT / KOMISI (Pecahan Kas Bank & Kas Kecil)
  'ABI': { code: 'ABI', name: 'Komisi Anak (KABI / Sekolah Minggu)', type: 'unit', unitCategory: 'komisi', description: 'Kas Bank & Kas Kecil KABI' },
  'RBI': { code: 'RBI', name: 'Komisi Remaja (PRBI / Teens)', type: 'unit', unitCategory: 'komisi', description: 'Kas Bank & Kas Kecil PRBI' },
  'WBI': { code: 'WBI', name: 'Komisi Wanita (WBI)', type: 'unit', unitCategory: 'komisi', description: 'Kas Bank & Kas Kecil Wanita Bethel Indonesia' },
  'KPS': { code: 'KPS', name: 'Komisi Pasutri (KOMPAS)', type: 'unit', unitCategory: 'komisi', description: 'Kas Bank Komunitas Pasutri' },
  'VSS': { code: 'VSS', name: 'Kas Vessel Youth Community', type: 'unit', unitCategory: 'komisi', description: 'Kas Pemuda Vessel Youth' },
  'DK':  { code: 'DK',  name: 'Kas Diakonia (Kowari & Koemas)', type: 'unit', unitCategory: 'kas-unit', description: 'Sembako, uang duka, santunan, bantuan kesehatan, kas Kowari' },
  'KPP': { code: 'KPP', name: 'Kas Proyek Pembangunan (Gedung)', type: 'unit', unitCategory: 'kas-unit', description: 'Renovasi gedung, persembahan pembangunan, lift, sound system' },
  'OTA': { code: 'OTA', name: 'Kas Orang Tua Asuh (SPP / Beasiswa)', type: 'unit', unitCategory: 'kas-unit', description: 'Donasi beasiswa & pembayaran SPP anak asuh' },
  'NTL': { code: 'NTL', name: 'Kas Sisa Dana Natal', type: 'unit', unitCategory: 'kas-unit', description: 'Akumulasi sisa anggaran perayaan Natal' },
  'U':   { code: 'U',   name: 'Kas Kecil Umum (Tante Yanti)', type: 'unit', unitCategory: 'umum', description: 'Petty cash operasional harian gereja' }
};

export interface BankStatementRow {
  date: string; // YYYY-MM-DD
  rawDate: string; // e.g. "01/09"
  description: string;
  branch?: string;
  mutasiType: 'CR' | 'DB';
  amount: number;
  saldo?: number;
  autoRefNo?: string;
  autoGLCode?: string;
  notes?: string;
  isTopUpBreakdown?: boolean;
  breakdownItems?: Array<{
    glCode: string;
    description: string;
    amount: number;
  }>;
}

export interface CashJournalEntry {
  id: string;
  sourceType: 'bank' | 'petty_cash'; // Kas Bank vs Kas Kecil Tante Yanti
  date: string; // YYYY-MM-DD
  noRef: string; // e.g. BCA260001, KB260001, KK260001, i260001
  glCode: string; // e.g. 1001, 1004, OTA, ABI
  description: string;
  rincian?: number | null; // Kolom Rincian di Excel untuk breakdown persembahan/topup
  debet?: number | null; // Kolom Debet
  kredit?: number | null; // Kolom Kredit
  saldo?: number | null; // Kolom Saldo
  targetUnit?: string; // e.g. 'ABI', 'RBI', 'WBI', 'KPS', 'VSS', 'DK', 'KPP', 'OTA', 'U'
  isHeader?: boolean; // Untuk baris Saldo Awal per bulan
  isAutoClassified?: boolean;
  createdAt: string;
}

/**
 * Intelligent Rule Matcher based on real Bank Mutation keywords
 */
export function classifyTransaction(desc: string, mutasiType: 'CR' | 'DB', amount: number): {
  glCode: string;
  targetUnit?: string;
  cleanDescription: string;
  isTopUp?: boolean;
} {
  const upper = desc.toUpperCase();

  // Top Up detection
  if (upper.includes('TOP UP KK') || upper.includes('TOPUP KK') || upper.includes('TOP UP KAS') || upper.includes('KK UMUM')) {
    return { glCode: 'U', targetUnit: 'U', cleanDescription: desc, isTopUp: true };
  }

  // 1. Check Komisi / Unit Specifics
  if (upper.includes('SEKOLAH MINGGU') || upper.includes(' KABI') || upper.includes('UTK ABI') || upper.includes('UNTUK ABI') || upper.includes('PERSEMBAHAN ABI') || upper.includes('KK ABI')) {
    return { glCode: 'ABI', targetUnit: 'ABI', cleanDescription: desc };
  }
  if (upper.includes(' TEEN') || upper.includes(' PRBI') || upper.includes('PERSEMBAHAN RBI') || upper.includes('KK RBI') || upper.includes('PASKAH TEEN')) {
    return { glCode: 'RBI', targetUnit: 'RBI', cleanDescription: desc };
  }
  if (upper.includes('PERSEMBAHAN WBI') || upper.includes('KK WBI') || upper.includes('KORWIL MARIA') || upper.includes('RAKERDA WBI')) {
    return { glCode: 'WBI', targetUnit: 'WBI', cleanDescription: desc };
  }
  if (upper.includes('KOMPAS') || upper.includes('PERSEMBAHAN KPS') || upper.includes('PASUTRI') || upper.includes('KPS SS')) {
    return { glCode: 'KPS', targetUnit: 'KPS', cleanDescription: desc };
  }
  if (upper.includes('VESSEL') || upper.includes('VSS') || upper.includes('KK VESSEL') || upper.includes('YOUTH VESSEL')) {
    return { glCode: 'VSS', targetUnit: 'VSS', cleanDescription: desc };
  }
  if (upper.includes('DIAKONIA') || upper.includes('SEMBAKO') || upper.includes('KOEMAS') || upper.includes('KOWARI') || upper.includes('UANG DUKA') || upper.includes('PAMPERS') || upper.includes('BESUK')) {
    return { glCode: 'DK', targetUnit: 'DK', cleanDescription: desc };
  }
  if (upper.includes('PEMBANGUNAN') || upper.includes('ELEVATOR') || upper.includes('MITRA GLOBAL') || upper.includes('GRANIT') || upper.includes('KERAMIK') || upper.includes('RENOV')) {
    return { glCode: 'KPP', targetUnit: 'KPP', cleanDescription: desc };
  }
  if (upper.includes('OTA') || upper.includes('SPP ') || upper.includes('ANAK ASUH') || upper.includes('ORANG TUA ASUH')) {
    return { glCode: 'OTA', targetUnit: 'OTA', cleanDescription: desc };
  }

  // 2. Debet (Pengeluaran Operasional / Biaya)
  if (mutasiType === 'DB') {
    if (upper.includes('PLN') || upper.includes('LISTRIK')) {
      return { glCode: '2003', cleanDescription: desc };
    }
    if (upper.includes('TELKOM') || upper.includes('BIZNET') || upper.includes('WIFI') || upper.includes('TELEPON')) {
      return { glCode: '2004', cleanDescription: desc };
    }
    if (upper.includes('PAM JAYA') || upper.includes('PAM ') || upper.includes('AIR PAM')) {
      return { glCode: '2005', cleanDescription: desc };
    }
    if (upper.includes('PASTORAL') || upper.includes('SALARY') || upper.includes('GAJI') || upper.includes('CATERING PELAYAN')) {
      return { glCode: '2001', cleanDescription: desc };
    }
    if (upper.includes('PEMBICARA') || upper.includes('PENGKHOTBAH') || upper.includes('PK PEMBICARA')) {
      return { glCode: '2002', cleanDescription: desc };
    }
    if (upper.includes('BIAYA ADM') || upper.includes('ADM BCA') || upper.includes('PAJAK BUNGA') || upper.includes('BIAYA STATEMENT')) {
      return { glCode: '2010', cleanDescription: desc };
    }
    if (upper.includes('MAINBOARD') || upper.includes('SOUND') || upper.includes('STAND') || upper.includes('MIC') || upper.includes('HARDWARE')) {
      return { glCode: '3002', cleanDescription: desc };
    }
    return { glCode: '6001', cleanDescription: desc };
  }

  // 3. Kredit (Penerimaan / Pendapatan)
  if (mutasiType === 'CR') {
    if (upper.includes('BUNGA DEP') || upper.includes('BUNGA BANK') || upper.includes('BILYET') || upper.includes('JASA GIRO')) {
      return { glCode: '1007', cleanDescription: desc };
    }
    if (upper.includes('PERPULUHAN') || upper.includes('PERSEPULUHAN') || upper.includes('GNA220425') || upper.includes('TPB826')) {
      return { glCode: '1004', cleanDescription: desc };
    }
    if (upper.includes('UCAPAN SYUKUR') || upper.includes('SYUKUR')) {
      return { glCode: '1005', cleanDescription: desc };
    }
    if (upper.includes('CIMB') || upper.includes('PBK DARI CIMB')) {
      return { glCode: '1002', cleanDescription: desc };
    }
    if (upper.includes('QRIS') || upper.includes('KR OTOMATIS') || upper.includes('PERSEMBAHAN') || upper.includes('IR ') || upper.includes('OBED') || upper.includes('ELVINA')) {
      return { glCode: '1001', cleanDescription: desc };
    }

    const knownTithesDonors = ['GINA JAYA', 'EVA YULIANA', 'SANNY THERESIA', 'VINETA CLAURINA', 'FANY LONTOH', 'LUTY', 'TITIH RIA', 'FITRI ELIZABETH', 'SANTI DEWY', 'ROSNAWI', 'RANDY ARIAWIRA', 'SILVIANY TANSIKA', 'MELIANA', 'LENASARI', 'HERVY', 'ANTIONY HANSEN', 'DJONI', 'BELBEN'];
    for (const donor of knownTithesDonors) {
      if (upper.includes(donor) && !upper.includes('PERSEMBAHAN')) {
        return { glCode: '1004', cleanDescription: desc };
      }
    }

    return { glCode: '1001', cleanDescription: desc };
  }

  return { glCode: '6001', cleanDescription: desc };
}
