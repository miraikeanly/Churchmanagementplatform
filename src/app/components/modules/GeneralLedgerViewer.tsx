import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { Download, Search, Building2, Wallet, Users, Layers, ArrowUpRight, ArrowDownRight, Edit2, Trash2, Calendar, Plus } from 'lucide-react';
import { CashJournalEntry, GL_ACCOUNTS } from '../../../lib/glDefinitions';

interface Props {
  entries: CashJournalEntry[];
  sourceFilter: 'all' | 'bank' | 'petty_cash';
  onDeleteEntry?: (id: string) => Promise<void>;
  onUpdateEntry?: (entry: CashJournalEntry) => Promise<void>;
  canEdit: boolean;
}

const MONTH_NAMES = [
  'Semua Bulan', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function GeneralLedgerViewer({ entries, sourceFilter, onDeleteEntry, onUpdateEntry, canEdit }: Props) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(9); // Default September (month 9) or current
  const [selectedGL, setSelectedGL] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'buku_kas' | 'gl_rekap' | 'komisi_unit'>('buku_kas');

  // Edit Row State
  const [editingEntry, setEditingEntry] = useState<CashJournalEntry | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<CashJournalEntry>>({});
  const [openEditDialog, setOpenEditDialog] = useState(false);

  // Set Saldo Awal per month modal state
  const [openSaldoAwalDialog, setOpenSaldoAwalDialog] = useState(false);
  const [saldoAwalAmount, setSaldoAwalAmount] = useState<string>('');

  // 1. Filter entries for the selected month & year
  const monthEntries = useMemo(() => {
    return entries.filter(e => {
      if (sourceFilter !== 'all' && e.sourceType !== sourceFilter) return false;
      if (e.date) {
        const [y, m] = e.date.split('-');
        if (parseInt(y, 10) !== selectedYear) return false;
        if (selectedMonth > 0 && parseInt(m, 10) !== selectedMonth) return false;
      }
      return true;
    }).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.noRef || '').localeCompare(b.noRef || ''));
  }, [entries, sourceFilter, selectedYear, selectedMonth]);

  // Find if there is an explicit Saldo Awal header entry for this month
  const saldoAwalEntry = useMemo(() => {
    return monthEntries.find(e => e.isHeader || (e.description || '').toUpperCase().includes('SALDO AWAL') || ((e.description || '').trim() === 'Saldo' && !e.debet && !e.kredit));
  }, [monthEntries]);

  // Compute exact running balances like Excel:
  // Saldo = Saldo Sebelumnya + Debet - Kredit
  const { tableRows, totalDebet, totalKredit, finalSaldo } = useMemo(() => {
    let currentBalance = saldoAwalEntry?.saldo || (saldoAwalAmount ? parseFloat(saldoAwalAmount) : 0);
    let sumDebet = 0;
    let sumKredit = 0;

    const rows = monthEntries.map(e => {
      // If it's a header line (Saldo awal)
      if (e.id === saldoAwalEntry?.id) {
        return { ...e, calculatedSaldo: e.saldo || currentBalance };
      }

      const d = Number(e.debet || 0);
      const k = Number(e.kredit || 0);
      sumDebet += d;
      sumKredit += k;
      currentBalance = currentBalance + d - k;

      return {
        ...e,
        calculatedSaldo: currentBalance
      };
    });

    return {
      tableRows: rows,
      totalDebet: sumDebet,
      totalKredit: sumKredit,
      finalSaldo: currentBalance
    };
  }, [monthEntries, saldoAwalEntry, saldoAwalAmount]);

  // Filtered by Search & GL Account
  const displayedRows = useMemo(() => {
    return tableRows.filter(e => {
      if (selectedGL !== 'all' && e.glCode !== selectedGL && e.targetUnit !== selectedGL) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchDesc = (e.description || '').toLowerCase().includes(term);
        const matchRef = (e.noRef || '').toLowerCase().includes(term);
        const matchGl = (e.glCode || '').toLowerCase().includes(term);
        if (!matchDesc && !matchRef && !matchGl) return false;
      }
      return true;
    });
  }, [tableRows, selectedGL, searchTerm]);

  // GL Grouped Summary
  const glSummary = useMemo(() => {
    const map: Record<string, { code: string; name: string; debet: number; kredit: number; count: number }> = {};
    
    monthEntries.forEach(e => {
      const code = e.glCode || '6001';
      const acc = GL_ACCOUNTS[code] || { code, name: 'Lainnya' };
      if (!map[code]) {
        map[code] = { code, name: acc.name, debet: 0, kredit: 0, count: 0 };
      }
      map[code].debet += Number(e.debet || 0);
      map[code].kredit += Number(e.kredit || 0);
      map[code].count += 1;
    });

    return Object.values(map).sort((a, b) => a.code.localeCompare(b.code));
  }, [monthEntries]);

  // Unit / Komisi Summary
  const unitSummary = useMemo(() => {
    const units = ['ABI', 'RBI', 'WBI', 'KPS', 'VSS', 'DK', 'KPP', 'OTA', 'U'];
    return units.map(u => {
      const acc = GL_ACCOUNTS[u];
      const items = entries.filter(e => {
        if (e.targetUnit !== u && e.glCode !== u) return false;
        if (e.date) {
          const [y, m] = e.date.split('-');
          if (parseInt(y, 10) !== selectedYear) return false;
          if (selectedMonth > 0 && parseInt(m, 10) !== selectedMonth) return false;
        }
        return true;
      });

      const masuk = items.reduce((sum, x) => sum + Number(x.debet || 0) + Number(x.rincian || 0), 0);
      const keluar = items.reduce((sum, x) => sum + Number(x.kredit || 0), 0);

      return {
        unitCode: u,
        name: acc?.name || u,
        description: acc?.description || '',
        count: items.length,
        masuk,
        keluar,
        saldo: masuk - keluar
      };
    });
  }, [entries, selectedYear, selectedMonth]);

  // Handle Edit Action
  const handleStartEdit = (entry: CashJournalEntry) => {
    setEditingEntry(entry);
    setEditFormData({ ...entry });
    setOpenEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry || !onUpdateEntry) return;
    const updated = { ...editingEntry, ...editFormData } as CashJournalEntry;
    await onUpdateEntry(updated);
    setOpenEditDialog(false);
  };

  // Export to Excel (Exact format of GBI Jeltim Excel file)
  const handleExportExcel = () => {
    const sheetData = displayedRows.map((e) => ({
      'Tanggal': e.date,
      'No': e.noRef,
      'Reff.': e.glCode,
      'Keterangan': e.description,
      'Rincian': e.rincian || '',
      'Debet': e.debet || '',
      'Kredit': e.kredit || '',
      'Saldo': e.calculatedSaldo || ''
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Kas_${selectedYear}_${selectedMonth}`);
    XLSX.writeFile(wb, `Kas_Bank_GBI_Jeltim_${selectedYear}_${MONTH_NAMES[selectedMonth]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs Switcher */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
        <button
          onClick={() => setActiveSubTab('buku_kas')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSubTab === 'buku_kas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 size={14} /> Buku Kas (Format Persis Excel)
        </button>

        <button
          onClick={() => setActiveSubTab('gl_rekap')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSubTab === 'gl_rekap' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers size={14} /> Rekap General Ledger (GL)
        </button>

        <button
          onClick={() => setActiveSubTab('komisi_unit')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSubTab === 'komisi_unit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users size={14} /> Kas Komisi & Unit Terpecah
        </button>
      </div>

      {/* Filter Toolbar & Calendar Tabs per Bulan (Like Excel Sheet Tabs JAN26, FEB26, etc) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        {/* Month selector pills (JAN, FEB, MAR, APR, MEI, JUN, JUL, AGS, SEP, OKT, NOV, DES) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Calendar size={13} /> Bulan:
          </span>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
            const shortName = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGS', 'SEP', 'OKT', 'NOV', 'DES'][m - 1];
            const isSelected = selectedMonth === m;
            return (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm scale-105'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {shortName}{String(selectedYear).slice(-2)}
              </button>
            );
          })}
          <button
            onClick={() => setSelectedMonth(0)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              selectedMonth === 0 ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Semua
          </button>
        </div>

        {/* Filter controls row */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 font-bold text-slate-800"
            >
              {[2024, 2025, 2026, 2027].map(yr => (
                <option key={yr} value={yr}>Tahun {yr}</option>
              ))}
            </select>

            <select
              value={selectedGL}
              onChange={(e) => setSelectedGL(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 font-medium text-slate-700 max-w-xs"
            >
              <option value="all">Semua Kode Reff / GL</option>
              {Object.values(GL_ACCOUNTS).map(acc => (
                <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
              ))}
            </select>

            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari transaksi / no ref..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs bg-slate-50 w-44 md:w-56"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outlined"
              size="small"
              onClick={handleExportExcel}
              startIcon={<Download size={14} />}
              sx={{
                borderColor: '#e2e8f0',
                color: '#334155',
                textTransform: 'none',
                fontSize: '12px',
                borderRadius: '10px',
                '&:hover': { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }
              }}
            >
              Export Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Overview Cards (Debet, Kredit, Saldo Akhir) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Kas Masuk (Debet)</div>
            <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">Rp {totalDebet.toLocaleString('id-ID')}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{MONTH_NAMES[selectedMonth]} {selectedYear}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowDownRight size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Kas Keluar (Kredit)</div>
            <div className="text-xl font-bold text-red-600 mt-1 font-mono">Rp {totalKredit.toLocaleString('id-ID')}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Operasional & Komisi</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <ArrowUpRight size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo Akhir Bank</div>
            <div className="text-xl font-bold mt-1 font-mono text-blue-600">
              Rp {finalSaldo.toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Saldo Buku Kas Berjalan</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Wallet size={22} />
          </div>
        </div>
      </div>

      {/* VIEW 1: BUKU KAS (EXACT EXCEL COLUMNS) */}
      {activeSubTab === 'buku_kas' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm">
                Arus Kas Bank - {selectedMonth ? `Per ${MONTH_NAMES[selectedMonth]}` : 'Sepanjang'} {selectedYear}
              </h4>
              <p className="text-xs text-slate-400">
                Format 8 Kolom: Tanggal | No | Reff. | Keterangan | Rincian | Debet | Kredit | Saldo
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-amber-400">
              Saldo: Rp {finalSaldo.toLocaleString('id-ID')}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2.5 border-r border-slate-200 w-28">Tanggal</th>
                  <th className="p-2.5 border-r border-slate-200 w-28">No</th>
                  <th className="p-2.5 border-r border-slate-200 w-20 text-center">Reff.</th>
                  <th className="p-2.5 border-r border-slate-200">Keterangan</th>
                  <th className="p-2.5 border-r border-slate-200 w-28 text-right">Rincian</th>
                  <th className="p-2.5 border-r border-slate-200 w-32 text-right">Debet</th>
                  <th className="p-2.5 border-r border-slate-200 w-32 text-right">Kredit</th>
                  <th className="p-2.5 border-r border-slate-200 w-36 text-right">Saldo</th>
                  {canEdit && <th className="p-2.5 w-16 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      Belum ada transaksi di bulan {MONTH_NAMES[selectedMonth]} {selectedYear}.
                      Silakan upload RK BCA di atas.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((e, idx) => {
                    const isHeaderRow = e.isHeader || (e.description || '').toUpperCase() === 'SALDO';
                    return (
                      <tr
                        key={e.id || idx}
                        className={isHeaderRow ? 'bg-amber-50/60 font-bold' : 'hover:bg-slate-50/80'}
                      >
                        {/* Tanggal */}
                        <td className="p-2.5 border-r border-slate-100 font-mono text-slate-700">
                          {e.date || ''}
                        </td>

                        {/* No Ref */}
                        <td className="p-2.5 border-r border-slate-100 font-mono font-semibold text-slate-800">
                          {e.noRef || ''}
                        </td>

                        {/* Reff / GL Code */}
                        <td className="p-2.5 border-r border-slate-100 text-center font-bold">
                          {e.glCode ? (
                            <span className="px-1.5 py-0.5 rounded text-[11px] bg-blue-50 text-blue-700">
                              {e.glCode}
                            </span>
                          ) : ''}
                        </td>

                        {/* Keterangan */}
                        <td className="p-2.5 border-r border-slate-100 font-medium text-slate-900">
                          {e.description}
                        </td>

                        {/* Rincian (e.g. breakdown topup or breakdown persembahan) */}
                        <td className="p-2.5 border-r border-slate-100 text-right font-mono text-slate-600">
                          {e.rincian ? Number(e.rincian).toLocaleString('id-ID') : ''}
                        </td>

                        {/* Debet */}
                        <td className="p-2.5 border-r border-slate-100 text-right font-mono font-semibold text-emerald-600">
                          {e.debet ? Number(e.debet).toLocaleString('id-ID') : ''}
                        </td>

                        {/* Kredit */}
                        <td className="p-2.5 border-r border-slate-100 text-right font-mono font-semibold text-red-600">
                          {e.kredit ? Number(e.kredit).toLocaleString('id-ID') : ''}
                        </td>

                        {/* Saldo */}
                        <td className="p-2.5 border-r border-slate-100 text-right font-mono font-bold text-slate-900">
                          {e.calculatedSaldo ? Number(e.calculatedSaldo).toLocaleString('id-ID') : ''}
                        </td>

                        {/* Action buttons (Edit & Delete) */}
                        {canEdit && (
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleStartEdit(e)}
                                className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                title="Edit Transaksi"
                              >
                                <Edit2 size={13} />
                              </button>
                              {onDeleteEntry && (
                                <button
                                  onClick={() => onDeleteEntry(e.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                  title="Hapus Transaksi"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: REKAP GENERAL LEDGER (GL) */}
      {activeSubTab === 'gl_rekap' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h4 className="font-bold text-slate-900 text-sm">
              Rekapitulasi General Ledger per Kode Akun ({MONTH_NAMES[selectedMonth]} {selectedYear})
            </h4>
            <p className="text-xs text-slate-500">
              Semua mutasi otomatis terkelompokkan ke pos pendapatan dan biaya masing-masing
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-28">Kode Akun</th>
                  <th className="p-3">Nama Akun GL</th>
                  <th className="p-3 w-24 text-center">Frekuensi</th>
                  <th className="p-3 w-40 text-right">Total Debet (Masuk)</th>
                  <th className="p-3 w-40 text-right">Total Kredit (Keluar)</th>
                  <th className="p-3 w-40 text-right">Netto / Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {glSummary.map(row => {
                  const net = row.debet - row.kredit;
                  return (
                    <tr key={row.code} className="hover:bg-slate-50/70">
                      <td className="p-3 font-mono font-bold text-blue-700">{row.code}</td>
                      <td className="p-3 font-medium text-slate-900">{row.name}</td>
                      <td className="p-3 text-center text-slate-500">{row.count} trx</td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-600">
                        {row.debet > 0 ? `Rp ${row.debet.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-red-600">
                        {row.kredit > 0 ? `Rp ${row.kredit.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className={`p-3 text-right font-mono font-bold ${net >= 0 ? 'text-slate-900' : 'text-red-700'}`}>
                        Rp {net.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: KAS KOMISI & PECAHAN UNIT */}
      {activeSubTab === 'komisi_unit' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <h4 className="font-bold text-slate-900 text-sm">
              Kas Komisi & Unit Terkait ({MONTH_NAMES[selectedMonth]} {selectedYear})
            </h4>
            <p className="text-xs text-slate-500">
              Transaksi yang mencantumkan referensi komisi otomatis dialirkan ke masing-masing saldo kas komisi
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {unitSummary.map(unit => (
              <div key={unit.unitCode} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-900 text-white">
                      {unit.unitCode}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{unit.count} transaksi</span>
                  </div>
                  <h5 className="font-bold text-slate-900 text-sm mt-3">{unit.name}</h5>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{unit.description}</p>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Total Masuk:</span>
                      <span className="font-mono font-bold text-emerald-600">Rp {unit.masuk.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Total Keluar:</span>
                      <span className="font-mono font-bold text-red-600">Rp {unit.keluar.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Saldo Akhir:</span>
                  <span className={`text-sm font-mono font-bold ${unit.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    Rp {unit.saldo.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Entry Dialog Modal */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle className="font-bold text-slate-900 text-base">
          Edit Baris Transaksi Buku Kas
        </DialogTitle>
        <DialogContent>
          <div className="space-y-3.5 mt-3 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Tanggal</label>
              <input
                type="date"
                value={editFormData.date || ''}
                onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">No. Ref</label>
                <input
                  type="text"
                  value={editFormData.noRef || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, noRef: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Kode GL / Reff</label>
                <select
                  value={editFormData.glCode || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, glCode: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2 font-bold"
                >
                  <option value="">- Kosong -</option>
                  {Object.values(GL_ACCOUNTS).map(acc => (
                    <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Keterangan Transaksi</label>
              <input
                type="text"
                value={editFormData.description || ''}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 font-medium"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Rincian</label>
                <input
                  type="number"
                  value={editFormData.rincian || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, rincian: parseFloat(e.target.value) || null })}
                  className="w-full border border-slate-200 rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Debet (Masuk)</label>
                <input
                  type="number"
                  value={editFormData.debet || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, debet: parseFloat(e.target.value) || null })}
                  className="w-full border border-slate-200 rounded-lg p-2 font-mono text-emerald-600 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Kredit (Keluar)</label>
                <input
                  type="number"
                  value={editFormData.kredit || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, kredit: parseFloat(e.target.value) || null })}
                  className="w-full border border-slate-200 rounded-lg p-2 font-mono text-red-600 font-bold"
                />
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenEditDialog(false)} sx={{ textTransform: 'none' }}>
            Batal
          </Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            sx={{
              backgroundColor: '#0f172a',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { backgroundColor: '#1e293b' }
            }}
          >
            Simpan Perubahan
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
