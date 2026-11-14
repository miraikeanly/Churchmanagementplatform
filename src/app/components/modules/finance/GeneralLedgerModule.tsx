import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Download, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { KasBankItem, INITIAL_GL_ACCOUNTS, GLAccount, formatRupiah } from './financeUtils';

const STORAGE_KEY_ITEMS = 'gbi_kas_bank_items_2026_v3';

function formatTgl(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function GeneralLedgerModule() {
  const [items, setItems] = useState<KasBankItem[]>([]);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Load items from Kas Bank
  const loadData = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ITEMS);
      const parsed: KasBankItem[] = saved ? JSON.parse(saved) : [];
      setItems(parsed);
      return parsed;
    } catch {
      setItems([]);
      return [];
    }
  };

  useEffect(() => {
    loadData();
    const handleStorageChange = () => loadData();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('kasbank-updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('kasbank-updated', handleStorageChange);
    };
  }, []);

  // Manual Trigger Button "Generate dari Kas Bank"
  const handleSyncFromKasBank = () => {
    const loaded = loadData();
    const nonOpening = loaded.filter(it => !it.isOpeningBalance);
    setSyncFeedback(`Berhasil menyinkronkan ${nonOpening.length} transaksi dari Kas Bank ke General Ledger!`);
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  // ── Unique GL codes ──
  const allGLCodes = useMemo(() => {
    const codes = new Set<string>();
    items.filter(it => !it.isOpeningBalance).forEach(it => {
      if (it.reff) codes.add(it.reff);
    });
    return Array.from(codes).sort((a, b) => {
      const aNum = parseInt(a, 10), bNum = parseInt(b, 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      if (!isNaN(aNum)) return -1;
      if (!isNaN(bNum)) return 1;
      return a.localeCompare(b);
    });
  }, [items]);

  // Set default selected code to first available if not set
  const [selectedCode, setSelectedCode] = useState<string>('');

  useEffect(() => {
    if (!selectedCode && allGLCodes.length > 0) {
      setSelectedCode(allGLCodes[0]);
    }
  }, [allGLCodes, selectedCode]);

  const [searchTerm, setSearchTerm] = useState('');

  // ── Filtered items based on selected GL Code ──
  const filtered = useMemo(() => {
    return items.filter(it => {
      if (it.isOpeningBalance) return false;
      if (selectedCode && it.reff !== selectedCode) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!it.keterangan?.toLowerCase().includes(q) && !it.noBank?.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [items, selectedCode, searchTerm]);

  // Running balance for this specific GL Code
  const { rowsWithSaldo, totalDebet, totalKredit, finalSaldo } = useMemo(() => {
    let running = 0;
    let tDeb = 0;
    let tKre = 0;

    const mapped = filtered.map(it => {
      const nom = Number(it.nominal) || 0;
      const isDebet = it.tipe === 'Debet';
      if (isDebet) {
        tDeb += nom;
        running += nom;
      } else {
        tKre += nom;
        running -= nom;
      }
      return {
        ...it,
        runningSaldoGL: running
      };
    });

    return {
      rowsWithSaldo: mapped,
      totalDebet: tDeb,
      totalKredit: tKre,
      finalSaldo: running
    };
  }, [filtered]);

  const glInfo: GLAccount | undefined = selectedCode ? INITIAL_GL_ACCOUNTS[selectedCode] : undefined;

  // Export CSV
  const handleExportCsv = () => {
    const header = ['Tgl', 'No Bank', 'Ket', 'Debet', 'Kredit', 'Saldo', 'Note'];
    const rows = rowsWithSaldo.map(it => [
      formatTgl(it.tanggal),
      it.noBank ?? '',
      it.keterangan ?? '',
      it.tipe === 'Debet' ? it.nominal : '',
      it.tipe === 'Kredit' ? it.nominal : '',
      it.runningSaldoGL,
      it.note ?? ''
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `General_Ledger_${selectedCode || 'Semua'}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4 w-full">
      {/* ── Top Bar / Action ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase">General Ledger (Buku Besar)</h2>
          <p className="text-[11px] text-slate-500">Tampilan per kategori Kode Ref / GL sesuai buku kas gereja</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncFromKasBank}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw size={13} />
            Generate dari Kas Bank
          </button>
          <button
            onClick={handleExportCsv}
            disabled={rowsWithSaldo.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {syncFeedback && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium animate-fadeIn">
          <CheckCircle2 size={15} />
          {syncFeedback}
        </div>
      )}

      {/* ── Card Filter Format Gambar Sketsa ── */}
      <div className="bg-white rounded-2xl border-2 border-slate-300 p-4 shadow-xs space-y-4">
        {/* Header GL & Kode Picker sesuai gambar sketsa */}
        <div className="border-b-2 border-slate-200 pb-3">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-base font-black text-slate-900 tracking-tight">GL</span>
            <span className="text-xs font-semibold text-slate-500 uppercase">Pilih Kode Akun (Ref):</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-center">
            {/* Box input/select kode v persis sketsa */}
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                Kode GL <span className="text-indigo-600">▼</span>
              </label>
              <select
                value={selectedCode}
                onChange={e => setSelectedCode(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-800 rounded-lg px-3 py-1.5 text-sm font-black font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">-- PILIH KODE --</option>
                {allGLCodes.map(c => (
                  <option key={c} value={c}>
                    {c} {INITIAL_GL_ACCOUNTS[c] ? `— ${INITIAL_GL_ACCOUNTS[c].name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Keterangan Akun Terpilih */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Nama Akun:</span>
              <span className="text-xs font-bold text-slate-800">
                {glInfo ? glInfo.name : selectedCode ? `Akun GL ${selectedCode}` : 'Semua Akun'}
              </span>
              {glInfo && (
                <span className="text-[10px] text-slate-500 block truncate">{glInfo.description}</span>
              )}
            </div>

            {/* Quick Search */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Cari Keterangan:</label>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ketik keterangan..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── TABEL FORMAT SKETSA: Tgl | No Bank | Ket | Debet | Kredit | Saldo | Note ── */}
        <div className="overflow-x-auto border-2 border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-black text-center divide-x divide-slate-700">
                <th className="py-2 px-2.5 w-24 text-center">Tgl</th>
                <th className="py-2 px-2.5 w-28 text-center">No Bank</th>
                <th className="py-2 px-3 text-left">Ket</th>
                <th className="py-2 px-3 w-32 text-right">Debet</th>
                <th className="py-2 px-3 w-32 text-right">Kredit</th>
                <th className="py-2 px-3 w-36 text-right">Saldo</th>
                <th className="py-2 px-2.5 w-28 text-center">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 font-medium text-slate-800">
              {rowsWithSaldo.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <AlertCircle size={28} className="mx-auto mb-1.5 opacity-50" />
                    Belum ada transaksi untuk Kode GL ini. Klik <b>"Generate dari Kas Bank"</b> di atas jika data Kas Bank sudah ada.
                  </td>
                </tr>
              ) : (
                rowsWithSaldo.map((it, idx) => {
                  const isDebet = it.tipe === 'Debet';
                  return (
                    <tr
                      key={it.id || idx}
                      className={`divide-x divide-slate-200 hover:bg-slate-100/70 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      {/* Tgl */}
                      <td className="py-2 px-2.5 text-center font-mono text-[11px] whitespace-nowrap text-slate-600">
                        {formatTgl(it.tanggal)}
                      </td>

                      {/* No Bank */}
                      <td className="py-2 px-2.5 text-center font-mono font-bold text-[11px] whitespace-nowrap text-slate-800">
                        {it.noBank || '-'}
                      </td>

                      {/* Ket */}
                      <td className="py-2 px-3 text-slate-900 font-medium max-w-sm truncate" title={it.keterangan}>
                        {it.keterangan}
                      </td>

                      {/* Debet */}
                      <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap bg-emerald-50/30">
                        {isDebet ? formatRupiah(it.nominal) : '-'}
                      </td>

                      {/* Kredit */}
                      <td className="py-2 px-3 text-right font-mono font-semibold text-rose-700 whitespace-nowrap bg-rose-50/30">
                        {!isDebet ? formatRupiah(it.nominal) : '-'}
                      </td>

                      {/* Saldo */}
                      <td className="py-2 px-3 text-right font-mono font-black text-slate-900 whitespace-nowrap bg-blue-50/30">
                        {formatRupiah(it.runningSaldoGL)}
                      </td>

                      {/* Note */}
                      <td className="py-2 px-2.5 text-center text-slate-500 italic text-[11px] truncate max-w-[120px]">
                        {it.note || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Total Footer baris sesuai sketsa */}
            {rowsWithSaldo.length > 0 && (
              <tfoot className="border-t-2 border-slate-800 bg-slate-100 font-black text-slate-900 divide-x divide-slate-300">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-right uppercase tracking-wider text-xs">
                    TOTAL KODE {selectedCode || 'SEMUA'}:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-800 bg-emerald-100/60 whitespace-nowrap">
                    {formatRupiah(totalDebet)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-800 bg-rose-100/60 whitespace-nowrap">
                    {formatRupiah(totalKredit)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm font-black text-slate-950 bg-amber-100/80 whitespace-nowrap">
                    {formatRupiah(finalSaldo)}
                  </td>
                  <td className="py-2.5 px-2 text-center text-[11px] text-slate-500">
                    {rowsWithSaldo.length} baris
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
