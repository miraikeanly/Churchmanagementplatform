import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Save, RefreshCw, Download, Printer, Edit2, Check,
  TrendingUp, TrendingDown, Wallet, Calendar, CheckCircle2, AlertCircle
} from 'lucide-react';
import {
  KasBankItem,
  GLAccount,
  INITIAL_GL_ACCOUNTS,
  formatRupiah
} from './financeUtils';
import { EdgeKV as supabaseAdmin } from '../../../../lib/edgeKvClient';

const KV = 'kv_store_561004a0';
const STORAGE_KEY_ITEMS = 'gbi_kas_bank_items_2026_v3';
const STORAGE_KEY_GLS = 'gbi_kas_bank_gl_accounts_2026';
const DB_KEY_ITEMS = 'finance:kas_bank_items_2026_v3';
const DB_KEY_GLS = 'finance:kas_bank_gl_accounts_2026';
const DB_KEY_REPORTS = 'finance:laporan_keuangan_meta_2026';
const STORAGE_KEY_REPORTS = 'gbi_laporan_keuangan_meta_2026';
const STORAGE_KEY_LAPORAN_SYNC = 'gbi_laporan_gl_sync_2026';
const DB_KEY_LAPORAN_SYNC = 'finance:laporan_gl_sync_2026';

interface ReportMeta {
  tanggalLaporan: string;
  catatan: string;
  bendahara: string;
  updatedAt?: string;
}

interface GLRow {
  code: string;
  name: string;
  amount: number;
  count: number;
}

const BULAN_INDO: Record<string, string> = {
  '01': 'Januari', '02': 'Februari', '03': 'Maret', '04': 'April',
  '05': 'Mei', '06': 'Juni', '07': 'Juli', '08': 'Agustus',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember'
};

function formatPeriodeIndo(period: string): string {
  if (!period || period === 'ALL') return 'Semua Periode';
  const [y, m] = period.split('-');
  return `${BULAN_INDO[m] || m} ${y}`;
}

export default function LaporanKeuanganModule() {
  const [items, setItems] = useState<KasBankItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [glAccounts, setGlAccounts] = useState<Record<string, GLAccount>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GLS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_GL_ACCOUNTS;
  });

  const [reportMetaMap, setReportMetaMap] = useState<Record<string, ReportMeta>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REPORTS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'all' | 'debet' | 'kredit'>('all');
  const [glSyncedOverrides, setGlSyncedOverrides] = useState<Record<string, { code: string; name: string; totalDebet: number; totalKredit: number; finalSaldo: number; count: number; syncedAt: string }>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAPORAN_SYNC);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [isSavingDb, setIsSavingDb] = useState(false);
  const [lastSavedDb, setLastSavedDb] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isBulkEdit, setIsBulkEdit] = useState<boolean>(false);
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);

  const handleEditLaporanRow = (
    side: 'debet' | 'kredit',
    oldCode: string,
    patch: { code?: string; name?: string; amount?: number }
  ) => {
    const key = oldCode.trim().toUpperCase();
    const newKey = (patch.code ?? key).trim().toUpperCase() || key;
    setGlSyncedOverrides(prev => {
      const next = { ...prev };
      const existing = next[key] || {
        code: key,
        name: (glAccounts[key] || INITIAL_GL_ACCOUNTS[key])?.name || `Kode GL ${key}`,
        totalDebet: side === 'debet' ? (debetRows.find(r => r.code === key)?.amount || 0) : 0,
        totalKredit: side === 'kredit' ? (kreditRows.find(r => r.code === key)?.amount || 0) : 0,
        finalSaldo: 0,
        count: 1,
        syncedAt: new Date().toISOString()
      };
      const updated = {
        ...existing,
        code: newKey,
        name: patch.name !== undefined ? patch.name : existing.name,
        totalDebet: side === 'debet' && patch.amount !== undefined ? patch.amount : existing.totalDebet,
        totalKredit: side === 'kredit' && patch.amount !== undefined ? patch.amount : existing.totalKredit,
        syncedAt: new Date().toISOString()
      };
      if (newKey !== key) delete next[key];
      next[newKey] = updated;
      try { localStorage.setItem(STORAGE_KEY_LAPORAN_SYNC, JSON.stringify(next)); } catch {}
      supabaseAdmin.from(KV).upsert({ key: DB_KEY_LAPORAN_SYNC, value: next }, { onConflict: 'key' }).catch(() => {});
      return next;
    });
  };

  const selectedPeriod = selectedMonth === 'ALL' ? 'ALL' : `${selectedYear}-${selectedMonth}`;

  // Load latest data from Supabase KV & localStorage
  const syncFromSource = async (showToast = false) => {
    try {
      const [{ data: itemsRow }, { data: glsRow }, { data: metaRow }, { data: syncRow }] = await Promise.all([
        supabaseAdmin.from(KV).select('value').eq('key', DB_KEY_ITEMS).maybeSingle(),
        supabaseAdmin.from(KV).select('value').eq('key', DB_KEY_GLS).maybeSingle(),
        supabaseAdmin.from(KV).select('value').eq('key', DB_KEY_REPORTS).maybeSingle(),
        supabaseAdmin.from(KV).select('value').eq('key', DB_KEY_LAPORAN_SYNC).maybeSingle(),
      ]);

      if (syncRow?.value && typeof syncRow.value === 'object') {
        setGlSyncedOverrides(syncRow.value);
        try { localStorage.setItem(STORAGE_KEY_LAPORAN_SYNC, JSON.stringify(syncRow.value)); } catch {}
      }

      if (itemsRow?.value && Array.isArray(itemsRow.value) && itemsRow.value.length > 0) {
        setItems(itemsRow.value);
        try { localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(itemsRow.value)); } catch {}
      } else {
        const local = localStorage.getItem(STORAGE_KEY_ITEMS);
        if (local) setItems(JSON.parse(local));
      }

      if (glsRow?.value && typeof glsRow.value === 'object') {
        setGlAccounts(glsRow.value);
        try { localStorage.setItem(STORAGE_KEY_GLS, JSON.stringify(glsRow.value)); } catch {}
      }

      if (metaRow?.value && typeof metaRow.value === 'object') {
        setReportMetaMap(metaRow.value);
        try { localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(metaRow.value)); } catch {}
      }

      if (showToast) {
        setFeedback({ type: 'success', text: 'Data Laporan Keuangan berhasil disinkronkan dari General Ledger & Database!' });
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err) {
      console.warn('Sync Laporan Keuangan fallback ke lokal:', err);
      try {
        const local = localStorage.getItem(STORAGE_KEY_ITEMS);
        if (local) setItems(JSON.parse(local));
      } catch {}
    }
  };

  useEffect(() => {
    syncFromSource(false);
    const onUpdate = () => {
      try {
        const local = localStorage.getItem(STORAGE_KEY_ITEMS);
        if (local) setItems(JSON.parse(local));
        const synced = localStorage.getItem(STORAGE_KEY_LAPORAN_SYNC);
        if (synced) setGlSyncedOverrides(JSON.parse(synced));
      } catch {}
    };
    window.addEventListener('kasbank-updated', onUpdate);
    window.addEventListener('laporan-gl-synced', onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener('kasbank-updated', onUpdate);
      window.removeEventListener('laporan-gl-synced', onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, []);

  // Available years from transactions
  const availableYears = useMemo(() => {
    const set = new Set<string>([String(new Date().getFullYear()), '2026']);
    items.forEach(it => {
      if (it.tanggal && it.tanggal.length >= 4) set.add(it.tanggal.slice(0, 4));
    });
    return Array.from(set).sort().reverse();
  }, [items]);

  // Current period metadata
  const currentMeta: ReportMeta = reportMetaMap[selectedPeriod] || {
    tanggalLaporan: new Date().toISOString().split('T')[0],
    catatan: '',
    bendahara: ''
  };

  const updateCurrentMeta = (patch: Partial<ReportMeta>) => {
    setReportMetaMap(prev => {
      const next = {
        ...prev,
        [selectedPeriod]: { ...currentMeta, ...patch }
      };
      try { localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(next)); } catch {}
      supabaseAdmin.from(KV).upsert({ key: DB_KEY_REPORTS, value: next }, { onConflict: 'key' }).catch(() => {});
      return next;
    });
  };

  // Aggregate totals per GL code for selected period (exact integer-cent math)
  const {
    debetRows,
    kreditRows,
    totalDebet,
    totalKredit,
    saldoAwal,
    surplusDefisit,
    saldoAkhir
  } = useMemo(() => {
    const debetMap = new Map<string, { cents: number; count: number }>();
    const kreditMap = new Map<string, { cents: number; count: number }>();

    let openingCents = 0;
    let totalDebCents = 0;
    let totalKreCents = 0;

    items.forEach(it => {
      const itemPeriod = it.tanggal ? it.tanggal.slice(0, 7) : '';
      const matchesYear = it.tanggal ? it.tanggal.startsWith(selectedYear) : false;
      const inPeriod = selectedMonth === 'ALL' ? matchesYear : itemPeriod === selectedPeriod;

      if (!inPeriod) return;

      if (it.isOpeningBalance) {
        openingCents += Math.round((Number(it.nominal ?? it.saldoBerjalan) || 0) * 100);
        return;
      }

      const code = (it.reff || 'TANPA-GL').trim().toUpperCase();
      const nomCents = Math.round((Number(it.nominal) || 0) * 100);

      if (it.tipe === 'Debet') {
        totalDebCents += nomCents;
        const cur = debetMap.get(code) || { cents: 0, count: 0 };
        debetMap.set(code, { cents: cur.cents + nomCents, count: cur.count + 1 });
      } else {
        totalKreCents += nomCents;
        const cur = kreditMap.get(code) || { cents: 0, count: 0 };
        kreditMap.set(code, { cents: cur.cents + nomCents, count: cur.count + 1 });
      }
    });

    // Apply explicit GL synced overrides when viewing ALL months so GL totals match 100%
    if (selectedMonth === 'ALL') {
      Object.values(glSyncedOverrides).forEach(ov => {
        if (!ov || !ov.code) return;
        const code = ov.code.trim().toUpperCase();
        const prevDeb = debetMap.get(code)?.cents || 0;
        const prevKre = kreditMap.get(code)?.cents || 0;
        const newDebCents = Math.round((Number(ov.totalDebet) || 0) * 100);
        const newKreCents = Math.round((Number(ov.totalKredit) || 0) * 100);

        totalDebCents = totalDebCents - prevDeb + newDebCents;
        totalKreCents = totalKreCents - prevKre + newKreCents;

        if (newDebCents > 0) debetMap.set(code, { cents: newDebCents, count: ov.count || 1 });
        else debetMap.delete(code);

        if (newKreCents > 0) kreditMap.set(code, { cents: newKreCents, count: ov.count || 1 });
        else kreditMap.delete(code);
      });
    }

    const getGlName = (code: string) => {
      if (glSyncedOverrides[code]?.name) return glSyncedOverrides[code].name;
      const found = glAccounts[code] || INITIAL_GL_ACCOUNTS[code];
      return found ? found.name : `Kode GL ${code}`;
    };

    const dRows: GLRow[] = Array.from(debetMap.entries())
      .map(([code, v]) => ({ code, name: getGlName(code), amount: v.cents / 100, count: v.count }))
      .sort((a, b) => a.code.localeCompare(b.code));

    const kRows: GLRow[] = Array.from(kreditMap.entries())
      .map(([code, v]) => ({ code, name: getGlName(code), amount: v.cents / 100, count: v.count }))
      .sort((a, b) => a.code.localeCompare(b.code));

    const netCents = totalDebCents - totalKreCents;
    const endCents = openingCents + netCents;

    return {
      debetRows: dRows,
      kreditRows: kRows,
      totalDebet: totalDebCents / 100,
      totalKredit: totalKreCents / 100,
      saldoAwal: openingCents / 100,
      surplusDefisit: netCents / 100,
      saldoAkhir: endCents / 100
    };
  }, [items, glAccounts, selectedYear, selectedMonth, selectedPeriod, glSyncedOverrides]);

  // Save Laporan Keuangan + latest items to Database (Supabase KV)
  const handleSaveToDatabase = async () => {
    setIsSavingDb(true);
    try {
      const nowIso = new Date().toISOString();
      const nextMetaMap: Record<string, ReportMeta> = {
        ...reportMetaMap,
        [selectedPeriod]: { ...currentMeta, updatedAt: nowIso }
      };
      setReportMetaMap(nextMetaMap);
      try {
        localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(nextMetaMap));
      } catch {}

      await Promise.all([
        supabaseAdmin.from(KV).upsert({ key: DB_KEY_REPORTS, value: nextMetaMap }, { onConflict: 'key' }),
        supabaseAdmin.from(KV).upsert({ key: DB_KEY_ITEMS, value: items }, { onConflict: 'key' }),
        supabaseAdmin.from(KV).upsert({ key: DB_KEY_LAPORAN_SYNC, value: glSyncedOverrides }, { onConflict: 'key' }),
      ]);

      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastSavedDb(nowStr);
      setFeedback({
        type: 'success',
        text: `Laporan Keuangan ${formatPeriodeIndo(selectedPeriod)} berhasil disimpan ke Database (${nowStr})! Bisa dilihat di device lain.`
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({ type: 'error', text: `Gagal menyimpan ke database: ${err?.message || 'Terjadi kesalahan'}` });
    } finally {
      setIsSavingDb(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const maxLen = Math.max(debetRows.length, kreditRows.length);
    const lines: string[] = [
      `LAPORAN KEUANGAN GBI JELAMBAR TIMUR`,
      `Periode,${formatPeriodeIndo(selectedPeriod)}`,
      `Tanggal Laporan,${currentMeta.tanggalLaporan}`,
      `Saldo Awal,${saldoAwal}`,
      ``,
      `REK DEBET,KETERANGAN DEBET,SALDO DEBET,,REK KREDIT,KETERANGAN KREDIT,SALDO KREDIT`
    ];
    for (let i = 0; i < maxLen; i++) {
      const d = debetRows[i];
      const k = kreditRows[i];
      lines.push(
        `${d ? `"${d.code}","${d.name}",${d.amount}` : ',,'},,${k ? `"${k.code}","${k.name}",${k.amount}` : ',,'}`
      );
    }
    lines.push(``);
    lines.push(`TOTAL DEBET,,${totalDebet},,TOTAL KREDIT,,${totalKredit}`);
    lines.push(`SURPLUS / DEFISIT,,${surplusDefisit}`);
    lines.push(`SALDO AKHIR,,${saldoAkhir}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Keuangan_${selectedPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxRows = Math.max(debetRows.length, kreditRows.length);

  return (
    <div className="space-y-4">
      {/* ── Top Header & Controls ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Laporan Keuangan (Sync Kode GL)
              </h2>
              <p className="text-[11px] text-slate-500">
                Otomatis mengambil total per Kode GL dari Kas Bank &amp; General Ledger
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setIsBulkEdit(prev => !prev); setEditingRowKey(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer ${
                isBulkEdit
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
              }`}
              title="Edit semua kolom Rek/GL, Keterangan, dan Saldo sekaligus"
            >
              <Edit2 size={13} />
              {isBulkEdit ? 'Selesai Edit Semua' : 'Edit Semua'}
            </button>
            <button
              type="button"
              onClick={handleSaveToDatabase}
              disabled={isSavingDb}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Simpan Laporan Keuangan ke Database agar bisa dilihat di device lain"
            >
              <Save size={13} />
              {isSavingDb ? 'Menyimpan...' : lastSavedDb ? `Simpan Data (${lastSavedDb})` : 'Simpan Data'}
            </button>
            <button
              type="button"
              onClick={() => syncFromSource(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all cursor-pointer"
            >
              <RefreshCw size={13} />
              Sync GL
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download size={13} />
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Printer size={13} />
              Cetak
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Filter Bar: Bulan, Tahun, Tanggal Laporan, Dropdown View Mode */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/60">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Periode Bulan
            </label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Semua Bulan (Tahunan)</option>
              {Object.entries(BULAN_INDO).map(([num, label]) => (
                <option key={num} value={num}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Tahun
            </label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Tanggal Laporan
            </label>
            <div className="relative">
              <input
                type="date"
                value={currentMeta.tanggalLaporan}
                onChange={e => updateCurrentMeta({ tanggalLaporan: e.target.value })}
                className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Tampilan Kolom
            </label>
            <select
              value={viewMode}
              onChange={e => setViewMode(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">View All (Debet &amp; Kredit Berdampingan)</option>
              <option value="debet">Hanya Debet (Pemasukan)</option>
              <option value="kredit">Hanya Kredit (Pengeluaran)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
            <Calendar size={13} className="text-slate-400" />
            Saldo Awal Periode
          </div>
          <div className="text-sm sm:text-base font-mono font-black text-slate-900 mt-1 truncate">
            {formatRupiah(saldoAwal)}
          </div>
        </div>

        <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200 p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
            <TrendingUp size={13} />
            Total Debet (Masuk)
          </div>
          <div className="text-sm sm:text-base font-mono font-black text-emerald-800 mt-1 truncate">
            {formatRupiah(totalDebet)}
          </div>
        </div>

        <div className="bg-rose-50/70 rounded-2xl border border-rose-200 p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-rose-700 flex items-center gap-1.5">
            <TrendingDown size={13} />
            Total Kredit (Keluar)
          </div>
          <div className="text-sm sm:text-base font-mono font-black text-rose-800 mt-1 truncate">
            {formatRupiah(totalKredit)}
          </div>
        </div>

        <div className="bg-blue-50/80 rounded-2xl border border-blue-200 p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-blue-700 flex items-center gap-1.5">
            <Wallet size={13} />
            Saldo Akhir
          </div>
          <div className="text-sm sm:text-base font-mono font-black text-blue-900 mt-1 truncate">
            {formatRupiah(saldoAkhir)}
          </div>
        </div>
      </div>

      {/* ── Main Laporan Keuangan Table (View All Side-by-Side / Debet Only / Kredit Only) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <div className="text-xs font-black tracking-wider uppercase">
              LAPORAN KEUANGAN — {formatPeriodeIndo(selectedPeriod).toUpperCase()}
            </div>
            <div className="text-[11px] text-slate-300">
              GBI Jelambar Timur • Tanggal Laporan: {currentMeta.tanggalLaporan}
            </div>
          </div>
          <div className="text-[11px] font-mono bg-white/10 px-2.5 py-1 rounded-lg">
            Surplus/Defisit: <strong className={surplusDefisit >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{formatRupiah(surplusDefisit)}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          {viewMode === 'all' ? (
            <table className="w-full text-xs border-collapse min-w-[680px]">
              <thead>
                <tr className="border-b border-slate-300">
                  <th colSpan={3} className="py-2.5 px-3 text-center bg-emerald-100/80 text-emerald-900 font-black uppercase tracking-wider border-r-2 border-slate-300">
                    DEBET (PEMASUKAN — TOTAL PER KODE GL)
                  </th>
                  <th colSpan={3} className="py-2.5 px-3 text-center bg-rose-100/80 text-rose-900 font-black uppercase tracking-wider">
                    KREDIT (PENGELUARAN — TOTAL PER KODE GL)
                  </th>
                </tr>
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-300">
                  <th className="py-2 px-3 text-left w-20">Rek / GL</th>
                  <th className="py-2 px-3 text-left">Keterangan</th>
                  <th className="py-2 px-3 text-right w-36 border-r-2 border-slate-300">Saldo</th>
                  <th className="py-2 px-3 text-left w-20">Rek / GL</th>
                  <th className="py-2 px-3 text-left">Keterangan</th>
                  <th className="py-2 px-3 text-right w-36">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {maxRows === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Belum ada data transaksi GL pada periode <b>{formatPeriodeIndo(selectedPeriod)}</b>.
                    </td>
                  </tr>
                ) : (
                  Array.from({ length: maxRows }).map((_, idx) => {
                    const d = debetRows[idx];
                    const k = kreditRows[idx];
                    const editD = isBulkEdit || (d && editingRowKey === `D:${d.code}`);
                    const editK = isBulkEdit || (k && editingRowKey === `K:${k.code}`);
                    return (
                      <tr key={idx} className={isBulkEdit ? 'bg-indigo-50/20' : 'hover:bg-slate-50/80'}>
                        {/* DEBET */}
                        <td
                          className="py-2 px-3 font-mono font-bold text-emerald-800 whitespace-nowrap cursor-pointer"
                          onClick={() => d && !isBulkEdit && setEditingRowKey(`D:${d.code}`)}
                        >
                          {d ? (
                            editD ? (
                              <input
                                type="text"
                                defaultValue={d.code}
                                onBlur={e => handleEditLaporanRow('debet', d.code, { code: e.target.value })}
                                className="w-16 px-1.5 py-0.5 border border-emerald-300 rounded bg-white text-xs font-mono"
                              />
                            ) : d.code
                          ) : ''}
                        </td>
                        <td
                          className="py-2 px-3 text-slate-800 cursor-pointer"
                          onClick={() => d && !isBulkEdit && setEditingRowKey(`D:${d.code}`)}
                        >
                          {d ? (
                            editD ? (
                              <input
                                type="text"
                                defaultValue={d.name}
                                onBlur={e => handleEditLaporanRow('debet', d.code, { name: e.target.value })}
                                className="w-full px-1.5 py-0.5 border border-emerald-300 rounded bg-white text-xs"
                              />
                            ) : (
                              <span>
                                {d.name}{' '}
                                <span className="text-[10px] text-slate-400">({d.count}x)</span>
                              </span>
                            )
                          ) : ''}
                        </td>
                        <td
                          className="py-2 px-3 text-right font-mono font-semibold text-emerald-700 border-r-2 border-slate-300 whitespace-nowrap cursor-pointer"
                          onClick={() => d && !isBulkEdit && setEditingRowKey(`D:${d.code}`)}
                        >
                          {d ? (
                            editD ? (
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={d.amount}
                                onBlur={e => handleEditLaporanRow('debet', d.code, { amount: parseFloat(e.target.value) || 0 })}
                                className="w-32 px-1.5 py-0.5 border border-emerald-300 rounded bg-white text-xs font-mono text-right"
                              />
                            ) : formatRupiah(d.amount)
                          ) : ''}
                        </td>

                        {/* KREDIT */}
                        <td
                          className="py-2 px-3 font-mono font-bold text-rose-800 whitespace-nowrap cursor-pointer"
                          onClick={() => k && !isBulkEdit && setEditingRowKey(`K:${k.code}`)}
                        >
                          {k ? (
                            editK ? (
                              <input
                                type="text"
                                defaultValue={k.code}
                                onBlur={e => handleEditLaporanRow('kredit', k.code, { code: e.target.value })}
                                className="w-16 px-1.5 py-0.5 border border-rose-300 rounded bg-white text-xs font-mono"
                              />
                            ) : k.code
                          ) : ''}
                        </td>
                        <td
                          className="py-2 px-3 text-slate-800 cursor-pointer"
                          onClick={() => k && !isBulkEdit && setEditingRowKey(`K:${k.code}`)}
                        >
                          {k ? (
                            editK ? (
                              <input
                                type="text"
                                defaultValue={k.name}
                                onBlur={e => handleEditLaporanRow('kredit', k.code, { name: e.target.value })}
                                className="w-full px-1.5 py-0.5 border border-rose-300 rounded bg-white text-xs"
                              />
                            ) : (
                              <span>
                                {k.name}{' '}
                                <span className="text-[10px] text-slate-400">({k.count}x)</span>
                              </span>
                            )
                          ) : ''}
                        </td>
                        <td
                          className="py-2 px-3 text-right font-mono font-semibold text-rose-700 whitespace-nowrap cursor-pointer"
                          onClick={() => k && !isBulkEdit && setEditingRowKey(`K:${k.code}`)}
                        >
                          {k ? (
                            editK ? (
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={k.amount}
                                onBlur={e => handleEditLaporanRow('kredit', k.code, { amount: parseFloat(e.target.value) || 0 })}
                                className="w-32 px-1.5 py-0.5 border border-rose-300 rounded bg-white text-xs font-mono text-right"
                              />
                            ) : formatRupiah(k.amount)
                          ) : ''}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-400 bg-slate-100 font-bold">
                <tr>
                  <td colSpan={2} className="py-3 px-3 text-right uppercase text-[11px] text-emerald-900">
                    Total Debet:
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-sm font-black text-emerald-800 bg-emerald-100/70 border-r-2 border-slate-300 whitespace-nowrap">
                    {formatRupiah(totalDebet)}
                  </td>
                  <td colSpan={2} className="py-3 px-3 text-right uppercase text-[11px] text-rose-900">
                    Total Kredit:
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-sm font-black text-rose-800 bg-rose-100/70 whitespace-nowrap">
                    {formatRupiah(totalKredit)}
                  </td>
                </tr>
                <tr className="bg-amber-100/80 border-t border-slate-300">
                  <td colSpan={4} className="py-3 px-3 text-right uppercase tracking-wider text-xs font-black text-slate-900">
                    SALDO AKHIR (Saldo Awal + Debet - Kredit):
                  </td>
                  <td colSpan={2} className="py-3 px-3 text-right font-mono text-base font-black text-slate-950 whitespace-nowrap">
                    {formatRupiah(saldoAkhir)}
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className={viewMode === 'debet' ? 'bg-emerald-100/80 text-emerald-900' : 'bg-rose-100/80 text-rose-900'}>
                  <th className="py-2.5 px-4 text-left w-28 font-black uppercase">Rek / Kode GL</th>
                  <th className="py-2.5 px-4 text-left font-black uppercase">Keterangan</th>
                  <th className="py-2.5 px-4 text-center w-24 font-black uppercase">Transaksi</th>
                  <th className="py-2.5 px-4 text-right w-44 font-black uppercase">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(viewMode === 'debet' ? debetRows : kreditRows).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400">
                      Belum ada transaksi {viewMode === 'debet' ? 'Debet' : 'Kredit'} pada periode ini.
                    </td>
                  </tr>
                ) : (
                  (viewMode === 'debet' ? debetRows : kreditRows).map(row => (
                    <tr key={row.code} className="hover:bg-slate-50">
                      <td className={`py-2.5 px-4 font-mono font-bold ${viewMode === 'debet' ? 'text-emerald-800' : 'text-rose-800'}`}>
                        {row.code}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">{row.name}</td>
                      <td className="py-2.5 px-4 text-center text-slate-500">{row.count}x</td>
                      <td className={`py-2.5 px-4 text-right font-mono font-bold ${viewMode === 'debet' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatRupiah(row.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-black">
                <tr>
                  <td colSpan={3} className="py-3 px-4 text-right uppercase">
                    Total {viewMode === 'debet' ? 'Debet' : 'Kredit'}:
                  </td>
                  <td className={`py-3 px-4 text-right font-mono text-sm ${viewMode === 'debet' ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {formatRupiah(viewMode === 'debet' ? totalDebet : totalKredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer Metadata: Bendahara & Catatan */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Penanggung Jawab / Bendahara
            </label>
            <input
              type="text"
              placeholder="Contoh: Bendahara GBI Jeltim"
              value={currentMeta.bendahara}
              onChange={e => updateCurrentMeta({ bendahara: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Catatan Laporan
            </label>
            <input
              type="text"
              placeholder="Catatan tambahan untuk periode ini..."
              value={currentMeta.catatan}
              onChange={e => updateCurrentMeta({ catatan: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
