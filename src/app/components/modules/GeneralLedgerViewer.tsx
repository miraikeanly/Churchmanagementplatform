import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@mui/material';
import { Download, Filter, Search, Calendar, Building2, Wallet, Users, ChevronRight, Layers, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { CashJournalEntry, GL_ACCOUNTS } from '../../../lib/glDefinitions';

interface Props {
  entries: CashJournalEntry[];
  sourceFilter: 'all' | 'bank' | 'petty_cash';
  onDeleteEntry?: (id: string) => Promise<void>;
  canEdit: boolean;
}

const MONTH_NAMES = [
  'Semua Bulan', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function GeneralLedgerViewer({ entries, sourceFilter, onDeleteEntry, canEdit }: Props) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0 = all
  const [selectedGL, setSelectedGL] = useState<string>('all');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'buku_kas' | 'gl_rekap' | 'komisi_unit'>('buku_kas');

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      // Source filter
      if (sourceFilter !== 'all' && e.sourceType !== sourceFilter) return false;

      // Year & Month filter
      if (e.date) {
        const [y, m] = e.date.split('-');
        if (parseInt(y, 10) !== selectedYear) return false;
        if (selectedMonth > 0 && parseInt(m, 10) !== selectedMonth) return false;
      }

      // GL Account filter
      if (selectedGL !== 'all' && e.glCode !== selectedGL) return false;

      // Unit filter
      if (selectedUnit !== 'all') {
        if (e.targetUnit !== selectedUnit && e.glCode !== selectedUnit) return false;
      }

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchDesc = (e.description || '').toLowerCase().includes(term);
        const matchRef = (e.noRef || '').toLowerCase().includes(term);
        const matchGl = (e.glCode || '').toLowerCase().includes(term);
        if (!matchDesc && !matchRef && !matchGl) return false;
      }

      return true;
    }).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.noRef || '').localeCompare(b.noRef || ''));
  }, [entries, sourceFilter, selectedYear, selectedMonth, selectedGL, selectedUnit, searchTerm]);

  // Compute running balance & summary
  const { totalDebet, totalKredit, balance, runningEntries } = useMemo(() => {
    let deb = 0;
    let kre = 0;
    let bal = 0;

    const running = filteredEntries.map(e => {
      deb += Number(e.debet || 0);
      kre += Number(e.kredit || 0);
      bal = bal + Number(e.debet || 0) - Number(e.kredit || 0);
      return { ...e, calculatedSaldo: bal };
    });

    return { totalDebet: deb, totalKredit: kre, balance: deb - kre, runningEntries: running };
  }, [filteredEntries]);

  // GL Grouped Summary
  const glSummary = useMemo(() => {
    const map: Record<string, { code: string; name: string; debet: number; kredit: number; count: number }> = {};
    
    entries.forEach(e => {
      if (e.date) {
        const [y, m] = e.date.split('-');
        if (parseInt(y, 10) !== selectedYear) return;
        if (selectedMonth > 0 && parseInt(m, 10) !== selectedMonth) return;
      }

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
  }, [entries, selectedYear, selectedMonth]);

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

      const masuk = items.reduce((sum, x) => sum + Number(x.debet || 0), 0);
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

  // Export to Excel
  const handleExportExcel = () => {
    const sheetData = runningEntries.map((e, idx) => ({
      'No': idx + 1,
      'Tanggal': e.date,
      'No. Ref': e.noRef,
      'Kode GL': e.glCode,
      'Nama Akun / GL': GL_ACCOUNTS[e.glCode]?.name || e.glCode,
      'Keterangan': e.description,
      'Rincian': e.rincian || '',
      'Debet (Masuk)': e.debet || 0,
      'Kredit (Keluar)': e.kredit || 0,
      'Saldo': e.calculatedSaldo || 0,
      'Unit / Komisi': e.targetUnit || ''
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Buku Kas & GL');
    XLSX.writeFile(wb, `Buku_Kas_GL_GBIJeltim_${selectedYear}_${selectedMonth || 'Semua'}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs: Buku Kas vs Rekap GL vs Kas Komisi */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
        <button
          onClick={() => setActiveSubTab('buku_kas')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSubTab === 'buku_kas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 size={14} /> Buku Kas (Arus Kas Bank & Kas Kecil)
        </button>

        <button
          onClick={() => setActiveSubTab('gl_rekap')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSubTab === 'gl_rekap' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers size={14} /> Rekap General Ledger (GL Kode Akun)
        </button>

        <button
          onClick={() => setActiveSubTab('komisi_unit')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSubTab === 'komisi_unit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users size={14} /> Kas Komisi & Unit (Pecahan Masuk)
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Year */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-medium text-slate-700"
          >
            {[2024, 2025, 2026, 2027].map(yr => (
              <option key={yr} value={yr}>Tahun {yr}</option>
            ))}
          </select>

          {/* Month */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-medium text-slate-700"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>

          {/* GL filter if in Buku Kas */}
          {activeSubTab === 'buku_kas' && (
            <select
              value={selectedGL}
              onChange={(e) => setSelectedGL(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-medium text-slate-700 max-w-xs"
            >
              <option value="all">Semua Kode GL</option>
              {Object.values(GL_ACCOUNTS).map(acc => (
                <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
              ))}
            </select>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari transaksi / no ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs bg-slate-50 w-44 md:w-56"
            />
          </div>
        </div>

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

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Kas Masuk (Debet)</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">Rp {totalDebet.toLocaleString('id-ID')}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Penerimaan & Persembahan</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowDownRight size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Kas Keluar (Kredit)</div>
            <div className="text-xl font-bold text-red-600 mt-1">Rp {totalKredit.toLocaleString('id-ID')}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Operasional, Pastoral & Komisi</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <ArrowUpRight size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo Kas Berjalan</div>
            <div className={`text-xl font-bold mt-1 ${balance >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
              Rp {balance.toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Selisih Debet & Kredit</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Wallet size={22} />
          </div>
        </div>
      </div>

      {/* VIEW 1: BUKU KAS TABLE */}
      {activeSubTab === 'buku_kas' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm">
              Daftar Transaksi Arus Kas ({runningEntries.length} entri)
            </h4>
            <div className="text-xs text-slate-500">
              Periode: {selectedMonth ? MONTH_NAMES[selectedMonth] : 'Sepanjang'} {selectedYear}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-28">Tanggal</th>
                  <th className="p-3 w-28">No. Ref</th>
                  <th className="p-3 w-24">Kode GL</th>
                  <th className="p-3">Keterangan Transaksi</th>
                  <th className="p-3 w-32 text-right">Debet (Masuk)</th>
                  <th className="p-3 w-32 text-right">Kredit (Keluar)</th>
                  <th className="p-3 w-36 text-right">Saldo</th>
                  <th className="p-3 w-24 text-center">Unit</th>
                  {canEdit && <th className="p-3 w-16 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {runningEntries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      Belum ada transaksi di periode ini. Silakan upload file RK BCA di atas.
                    </td>
                  </tr>
                ) : (
                  runningEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/70">
                      <td className="p-3 font-mono text-slate-600">{e.date}</td>
                      <td className="p-3 font-mono font-bold text-slate-800">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px]">
                          {e.noRef}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-blue-50 text-blue-700 border border-blue-200/60">
                          {e.glCode}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-900">{e.description}</div>
                        {e.rincian && <div className="text-[11px] text-slate-500">{e.rincian}</div>}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-600">
                        {e.debet > 0 ? `Rp ${e.debet.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-red-600">
                        {e.kredit > 0 ? `Rp ${e.kredit.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        Rp {e.calculatedSaldo?.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-center">
                        {e.targetUnit ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            {e.targetUnit}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="p-3 text-center">
                          {onDeleteEntry && (
                            <button
                              onClick={() => onDeleteEntry(e.id)}
                              className="text-slate-400 hover:text-red-600 transition-colors text-[11px]"
                            >
                              Hapus
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
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
              Rekapitulasi General Ledger per Kode Akun
            </h4>
            <p className="text-xs text-slate-500">
              Semua transaksi otomatis terkelompokkan ke akun penerimaan & biaya masing-masing
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
              Pecahan Kas Bank & Kas Kecil ke Komisi & Unit Terkait
            </h4>
            <p className="text-xs text-slate-500">
              Transaksi yang memiliki referensi komisi otomatis masuk ke buku kas masing-masing komisi
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
    </div>
  );
}
