import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RefreshCw, Download, Search, AlertCircle, CheckCircle2,
  Plus, Edit2, Trash2, Check, X, RotateCcw, Link2, Type
} from 'lucide-react';
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

  const saveItems = (updated: KasBankItem[]) => {
    const sorted = [...updated].sort((a, b) => {
      if (a.isOpeningBalance) return -1;
      if (b.isOpeningBalance) return 1;
      return (a.tanggal || '').localeCompare(b.tanggal || '');
    });
    setItems(sorted);
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(sorted));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('kasbank-updated'));
      }
    } catch (e) {
      console.error('Failed saving items to localStorage', e);
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
    if (codes.size === 0) {
      ['1001', '1004', '1007', '2001', '2010', 'OTA', 'DK', 'KPP', 'ABI', 'WBI', 'RBI', 'VSS', 'U'].forEach(c => codes.add(c));
    }
    return Array.from(codes).sort((a, b) => {
      const aNum = parseInt(a, 10), bNum = parseInt(b, 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      if (!isNaN(aNum)) return -1;
      if (!isNaN(bNum)) return 1;
      return a.localeCompare(b);
    });
  }, [items]);

  const [selectedCode, setSelectedCode] = useState<string>('');

  useEffect(() => {
    if (!selectedCode && allGLCodes.length > 0) {
      setSelectedCode(allGLCodes[0]);
    }
  }, [allGLCodes, selectedCode]);

  const [searchTerm, setSearchTerm] = useState('');

  // ── Master transaksi Kas Bank untuk dropdown pintar (Nama + Nominal + Tipe) ──
  const kasBankReferenceItems = useMemo(() => {
    return items.filter(it => !it.isOpeningBalance && it.keterangan);
  }, [items]);

  // ── Quick Inline Add Baris Baru di Bawah Tabel ──
  const [quickAddDate, setQuickAddDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickAddNoBank, setQuickAddNoBank] = useState('');
  const [quickAddKet, setQuickAddKet] = useState('');
  const [quickAddTipe, setQuickAddTipe] = useState<'Debet' | 'Kredit'>('Debet');
  const [quickAddNominal, setQuickAddNominal] = useState('');
  const [quickAddManualSaldo, setQuickAddManualSaldo] = useState('');
  const [quickAddNote, setQuickAddNote] = useState('');

  // Dropdown search state untuk Quick Add
  const [quickDropdownOpen, setQuickDropdownOpen] = useState(false);
  const [quickKetSearch, setQuickKetSearch] = useState('');
  const quickRef = useRef<HTMLDivElement>(null);

  // ── Editing Row State ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRowData, setEditRowData] = useState<{
    tanggal: string;
    noBank: string;
    keterangan: string;
    tipe: 'Debet' | 'Kredit';
    nominal: number;
    manualSaldo?: number;
    note?: string;
  }>({
    tanggal: '',
    noBank: '',
    keterangan: '',
    tipe: 'Debet',
    nominal: 0,
    note: ''
  });

  // Dropdown search state untuk Edit Row
  const [editDropdownOpen, setEditDropdownOpen] = useState(false);
  const [editKetSearch, setEditKetSearch] = useState('');
  const editRef = useRef<HTMLDivElement>(null);

  // ── Modal Tambah Baris State ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRowData, setNewRowData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    noBank: '',
    reff: selectedCode || '1001',
    keterangan: '',
    tipe: 'Debet' as 'Debet' | 'Kredit',
    nominal: '',
    manualSaldo: '',
    note: ''
  });
  const [modalDropdownOpen, setModalDropdownOpen] = useState(false);
  const [modalKetSearch, setModalKetSearch] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // ── Reset Modal State (PIN: 0000) ──
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPeriodTarget, setResetPeriodTarget] = useState('ALL');
  const [resetPinInput, setResetPinInput] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCode) {
      setNewRowData(prev => ({ ...prev, reff: selectedCode }));
    }
  }, [selectedCode]);

  // Click outside listener to close custom dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        setEditDropdownOpen(false);
      }
      if (quickRef.current && !quickRef.current.contains(e.target as Node)) {
        setQuickDropdownOpen(false);
      }
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setModalDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Running balance for this specific GL Code with support for manualSaldo overrides
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

      const currentSaldo = it.manualSaldo !== undefined && it.manualSaldo !== null && !isNaN(Number(it.manualSaldo))
        ? Number(it.manualSaldo)
        : running;

      if (it.manualSaldo !== undefined && it.manualSaldo !== null && !isNaN(Number(it.manualSaldo))) {
        running = Number(it.manualSaldo);
      }

      return {
        ...it,
        runningSaldoGL: currentSaldo,
        isManualSaldo: it.manualSaldo !== undefined && it.manualSaldo !== null
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

  // ── Handlers Edit Row ──
  const handleStartEdit = (item: any) => {
    setEditingId(item.id);
    setEditRowData({
      tanggal: item.tanggal || '',
      noBank: item.noBank || '',
      keterangan: item.keterangan || '',
      tipe: item.tipe || 'Debet',
      nominal: Number(item.nominal) || 0,
      manualSaldo: item.manualSaldo,
      note: item.note || ''
    });
    setEditKetSearch(item.keterangan || '');
    setEditDropdownOpen(false);
  };

  const handleSaveEdit = (id: string) => {
    const updated = items.map(it => {
      if (it.id === id) {
        const nom = Number(editRowData.nominal) || 0;
        const isDeb = editRowData.tipe === 'Debet';
        return {
          ...it,
          tanggal: editRowData.tanggal,
          noBank: editRowData.noBank,
          keterangan: editRowData.keterangan,
          tipe: editRowData.tipe,
          nominal: nom,
          debet: isDeb ? nom : 0,
          kredit: !isDeb ? nom : 0,
          manualSaldo: editRowData.manualSaldo !== undefined && !isNaN(Number(editRowData.manualSaldo))
            ? Number(editRowData.manualSaldo)
            : undefined,
          note: editRowData.note
        };
      }
      return it;
    });

    saveItems(updated);
    setEditingId(null);
    setSyncFeedback('Baris transaksi berhasil diperbarui!');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleDeleteRow = (id: string) => {
    if (window.confirm('Hapus baris transaksi ini?')) {
      const updated = items.filter(it => it.id !== id);
      saveItems(updated);
      setSyncFeedback('Baris transaksi berhasil dihapus!');
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  const getNextNoBank = (tipe: 'Debet' | 'Kredit') => {
    const prefix = tipe === 'Debet' ? 'BCA26' : 'KB26';
    let maxN = 0;
    items.forEach(it => {
      if (it.noBank?.startsWith(prefix)) {
        const num = parseInt(it.noBank.replace(prefix, ''), 10);
        if (!isNaN(num) && num > maxN) maxN = num;
      }
    });
    return `${prefix}${String(maxN + 1).padStart(4, '0')}`;
  };

  // ── Handler Reset Data dengan PIN 0000 ──
  const handleExecuteReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPinInput !== '0000') {
      setResetError('PIN salah! Masukkan PIN 0000 untuk konfirmasi reset.');
      return;
    }

    if (resetPeriodTarget === 'ALL') {
      const defaultOpening: KasBankItem = {
        id: 'initial-saldo',
        tanggal: '2026-09-01',
        noBank: 'BCA260000',
        reff: '1001',
        keterangan: 'Saldo Awal Rekening',
        tipe: 'Debet',
        nominal: 311771182.79,
        debet: 311771182.79,
        kredit: 0,
        saldoBerjalan: 311771182.79,
        isOpeningBalance: true
      };
      saveItems([defaultOpening]);
      setSyncFeedback('Seluruh data transaksi berhasil di-reset!');
    } else {
      const kept = items.filter(it => {
        if (it.isOpeningBalance && it.id.includes(resetPeriodTarget)) return false;
        if (!it.isOpeningBalance && it.tanggal.startsWith(resetPeriodTarget)) return false;
        return true;
      });
      if (kept.length === 0) {
        saveItems([{
          id: 'initial-saldo',
          tanggal: '2026-09-01',
          noBank: 'BCA260000',
          reff: '1001',
          keterangan: 'Saldo Awal Rekening',
          tipe: 'Debet',
          nominal: 311771182.79,
          debet: 311771182.79,
          kredit: 0,
          saldoBerjalan: 311771182.79,
          isOpeningBalance: true
        }]);
      } else {
        saveItems(kept);
      }
      setSyncFeedback(`Data transaksi periode ${resetPeriodTarget} berhasil di-reset!`);
    }

    setShowResetModal(false);
    setResetPinInput('');
    setResetError(null);
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  // ── Handler Quick Inline Add Baris Langsung di Bawah Tabel ──
  const handleQuickAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    const nom = parseFloat(quickAddNominal.replace(/[^0-9.]/g, '')) || 0;
    if (nom <= 0 && !quickAddKet.trim()) {
      alert('Mohon isi Keterangan dan Nominal transaksi yang ingin ditambahkan!');
      return;
    }

    const assignedCode = selectedCode || '1001';
    const isDeb = quickAddTipe === 'Debet';
    const autoNo = quickAddNoBank.trim() || getNextNoBank(quickAddTipe);

    const parsedManualSaldo = quickAddManualSaldo.trim() !== ''
      ? parseFloat(quickAddManualSaldo.replace(/[^0-9.]/g, ''))
      : undefined;

    const newItem: KasBankItem = {
      id: `gl_row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tanggal: quickAddDate,
      noBank: autoNo,
      reff: assignedCode,
      keterangan: quickAddKet.trim() || `Transaksi ${assignedCode}`,
      tipe: quickAddTipe,
      nominal: nom,
      debet: isDeb ? nom : 0,
      kredit: !isDeb ? nom : 0,
      manualSaldo: !isNaN(Number(parsedManualSaldo)) ? parsedManualSaldo : undefined,
      note: quickAddNote.trim() || undefined
    };

    saveItems([...items, newItem]);
    setQuickAddKet('');
    setQuickKetSearch('');
    setQuickAddNominal('');
    setQuickAddNoBank('');
    setQuickAddManualSaldo('');
    setQuickAddNote('');
    setSyncFeedback(`Baris transaksi baru berhasil ditambahkan ke Kode ${assignedCode}!`);
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  // ── Handler Tambah Baris Manual (Modal) ──
  const handleAddNewRowModal = (e: React.FormEvent) => {
    e.preventDefault();
    const nom = parseFloat(newRowData.nominal.replace(/[^0-9.]/g, '')) || 0;
    if (nom <= 0 && !newRowData.keterangan.trim()) {
      alert('Mohon isi Keterangan dan Nominal transaksi!');
      return;
    }

    const assignedCode = newRowData.reff || selectedCode || '1001';
    const isDeb = newRowData.tipe === 'Debet';
    const autoNo = newRowData.noBank.trim() || getNextNoBank(newRowData.tipe);

    const parsedManualSaldo = newRowData.manualSaldo.trim() !== ''
      ? parseFloat(newRowData.manualSaldo.replace(/[^0-9.]/g, ''))
      : undefined;

    const newItem: KasBankItem = {
      id: `gl_manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tanggal: newRowData.tanggal,
      noBank: autoNo,
      reff: assignedCode,
      keterangan: newRowData.keterangan.trim() || `Transaksi ${assignedCode}`,
      tipe: newRowData.tipe,
      nominal: nom,
      debet: isDeb ? nom : 0,
      kredit: !isDeb ? nom : 0,
      manualSaldo: !isNaN(Number(parsedManualSaldo)) ? parsedManualSaldo : undefined,
      note: newRowData.note.trim() || undefined
    };

    saveItems([...items, newItem]);
    setShowAddModal(false);
    setNewRowData({
      tanggal: new Date().toISOString().split('T')[0],
      noBank: '',
      reff: selectedCode || '1001',
      keterangan: '',
      tipe: 'Debet',
      nominal: '',
      manualSaldo: '',
      note: ''
    });
    setModalKetSearch('');
    setSyncFeedback(`Baris transaksi berhasil ditambahkan ke Kode ${assignedCode}!`);
    setTimeout(() => setSyncFeedback(null), 3000);
  };

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
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={13} />
            + Tambah Baris Manual
          </button>
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
          <button
            onClick={() => {
              setResetPeriodTarget('ALL');
              setResetPinInput('');
              setResetError(null);
              setShowResetModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
            title="Reset data dengan pengaman PIN 0000"
          >
            <RotateCcw size={13} />
            Reset Data
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

        {/* ── TABEL FORMAT SKETSA: Tgl | No Bank | Ket | Debet | Kredit | Saldo | Note | Aksi ── */}
        <div className="overflow-x-auto border-2 border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-black text-center divide-x divide-slate-700">
                <th className="py-2 px-2.5 w-28 text-center whitespace-nowrap">Tgl</th>
                <th className="py-2 px-2.5 w-28 text-center whitespace-nowrap">No Bank</th>
                <th className="py-2 px-3 text-left min-w-[240px]">Ket</th>
                <th className="py-2 px-3 w-32 text-right whitespace-nowrap">Debet</th>
                <th className="py-2 px-3 w-32 text-right whitespace-nowrap">Kredit</th>
                <th className="py-2 px-3 w-36 text-right whitespace-nowrap">Saldo</th>
                <th className="py-2 px-2.5 w-28 text-center whitespace-nowrap">Note</th>
                <th className="py-2 px-2 w-20 text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 font-medium text-slate-800">
              {rowsWithSaldo.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <AlertCircle size={28} className="mx-auto mb-1.5 opacity-50" />
                    Belum ada transaksi untuk Kode GL ini. Tambahkan data di form bawah atau klik <b>"+ Tambah Baris Manual"</b> di atas.
                  </td>
                </tr>
              ) : (
                rowsWithSaldo.map((it, idx) => {
                  const isEditing = editingId === it.id;
                  const isDebet = it.tipe === 'Debet';

                  if (isEditing) {
                    const filteredRefs = kasBankReferenceItems.filter(refIt =>
                      refIt.keterangan.toLowerCase().includes(editKetSearch.toLowerCase())
                    );

                    return (
                      <tr key={it.id || idx} className="bg-amber-50 divide-x divide-amber-200">
                        {/* Tanggal Edit */}
                        <td className="p-1">
                          <input
                            type="date"
                            value={editRowData.tanggal}
                            onChange={e => setEditRowData(p => ({ ...p, tanggal: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                          />
                        </td>

                        {/* No Bank Edit */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={editRowData.noBank}
                            onChange={e => setEditRowData(p => ({ ...p, noBank: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-mono font-bold"
                          />
                        </td>

                        {/* Ket Edit with Smart Dropdown (Auto Sync Nominal + Tipe, OR Edit Text Only) */}
                        <td className="p-1 relative" ref={editRef}>
                          <div className="relative">
                            <input
                              type="text"
                              value={editKetSearch}
                              onChange={e => {
                                setEditKetSearch(e.target.value);
                                setEditRowData(p => ({ ...p, keterangan: e.target.value }));
                                setEditDropdownOpen(true);
                              }}
                              onFocus={() => setEditDropdownOpen(true)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs pr-6"
                              placeholder="Cari transaksi kas bank / ketik bebas..."
                            />
                            <button
                              type="button"
                              onClick={() => setEditDropdownOpen(p => !p)}
                              className="absolute right-1 top-1 text-slate-400 hover:text-slate-600 text-[10px]"
                            >
                              ▼
                            </button>
                          </div>

                          {editDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto text-xs divide-y divide-slate-100">
                              {/* Option: Hanya Ubah Keterangan Doang */}
                              <div
                                onClick={() => {
                                  setEditRowData(p => ({ ...p, keterangan: editKetSearch }));
                                  setEditDropdownOpen(false);
                                }}
                                className="p-2 hover:bg-amber-50 cursor-pointer bg-slate-50 flex items-center justify-between text-indigo-700 font-semibold"
                              >
                                <span className="flex items-center gap-1.5">
                                  <Type size={12} />
                                  Gunakan teks ini: "{editKetSearch || '...'}" (Hanya ubah keterangan, nominal tetap)
                                </span>
                              </div>

                              {/* Kas Bank Transaction Options (Syncs Keterangan + Nominal + Tipe) */}
                              {filteredRefs.length === 0 ? (
                                <div className="p-2 text-slate-400 text-center italic">Tidak ada saran dari Kas Bank</div>
                              ) : (
                                filteredRefs.map((refIt, rIdx) => (
                                  <div
                                    key={refIt.id || rIdx}
                                    onClick={() => {
                                      const isRefDeb = refIt.tipe === 'Debet';
                                      const refNom = Number(refIt.nominal) || 0;
                                      setEditRowData(p => ({
                                        ...p,
                                        keterangan: refIt.keterangan,
                                        nominal: refNom,
                                        tipe: refIt.tipe,
                                        noBank: refIt.noBank || p.noBank
                                      }));
                                      setEditKetSearch(refIt.keterangan);
                                      setEditDropdownOpen(false);
                                    }}
                                    className="p-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between gap-2"
                                  >
                                    <div className="truncate">
                                      <span className="font-bold text-slate-800 block truncate">{refIt.keterangan}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">{refIt.noBank} • Ref: {refIt.reff}</span>
                                    </div>
                                    <div className="text-right whitespace-nowrap flex-shrink-0">
                                      <span className={`text-[11px] font-bold font-mono block ${
                                        refIt.tipe === 'Debet' ? 'text-emerald-700' : 'text-rose-700'
                                      }`}>
                                        {refIt.tipe === 'Debet' ? '+ ' : '- '}
                                        {formatRupiah(refIt.nominal)}
                                      </span>
                                      <span className="text-[9px] text-blue-600 flex items-center justify-end gap-1">
                                        <Link2 size={9} /> Auto-sinkron
                                      </span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </td>

                        {/* Debet Edit */}
                        <td className="p-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="any"
                              disabled={editRowData.tipe !== 'Debet'}
                              value={editRowData.tipe === 'Debet' ? editRowData.nominal : ''}
                              onChange={e => setEditRowData(p => ({ ...p, nominal: parseFloat(e.target.value) || 0 }))}
                              placeholder="0"
                              className={`w-full border rounded px-1.5 py-1 text-xs text-right font-mono font-semibold ${
                                editRowData.tipe === 'Debet' ? 'bg-white border-emerald-300 text-emerald-800' : 'bg-slate-100 border-slate-200 text-slate-400'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setEditRowData(p => ({ ...p, tipe: 'Debet' }))}
                              className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                                editRowData.tipe === 'Debet' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                              }`}
                              title="Set sebagai Debet (Masuk)"
                            >
                              D
                            </button>
                          </div>
                        </td>

                        {/* Kredit Edit */}
                        <td className="p-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="any"
                              disabled={editRowData.tipe !== 'Kredit'}
                              value={editRowData.tipe === 'Kredit' ? editRowData.nominal : ''}
                              onChange={e => setEditRowData(p => ({ ...p, nominal: parseFloat(e.target.value) || 0 }))}
                              placeholder="0"
                              className={`w-full border rounded px-1.5 py-1 text-xs text-right font-mono font-semibold ${
                                editRowData.tipe === 'Kredit' ? 'bg-white border-rose-300 text-rose-800' : 'bg-slate-100 border-slate-200 text-slate-400'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setEditRowData(p => ({ ...p, tipe: 'Kredit' }))}
                              className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                                editRowData.tipe === 'Kredit' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'
                              }`}
                              title="Set sebagai Kredit (Keluar)"
                            >
                              K
                            </button>
                          </div>
                        </td>

                        {/* Saldo Edit (Auto-sum atau Custom Override) */}
                        <td className="p-1">
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={editRowData.manualSaldo !== undefined ? editRowData.manualSaldo : ''}
                              onChange={e => setEditRowData(p => ({
                                ...p,
                                manualSaldo: e.target.value !== '' ? parseFloat(e.target.value) : undefined
                              }))}
                              placeholder="Auto sum"
                              className="w-full bg-white border border-blue-400 rounded px-1.5 py-1 text-xs text-right font-mono font-bold text-blue-900"
                              title="Ketik angka untuk override manual, atau kosongkan untuk kembali ke auto sum"
                            />
                            {editRowData.manualSaldo !== undefined && (
                              <button
                                type="button"
                                onClick={() => setEditRowData(p => ({ ...p, manualSaldo: undefined }))}
                                className="absolute left-1 top-1.5 text-slate-400 hover:text-slate-600"
                                title="Kembalikan ke Auto Sum"
                              >
                                <RotateCcw size={10} />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Note Edit */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={editRowData.note || ''}
                            onChange={e => setEditRowData(p => ({ ...p, note: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs"
                            placeholder="Catatan..."
                          />
                        </td>

                        {/* Actions Save / Cancel */}
                        <td className="p-1 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(it.id)}
                            className="p-1 text-emerald-600 hover:text-emerald-700 mr-1 cursor-pointer"
                            title="Simpan"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="Batal"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  }

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

                      {/* Saldo with indicator if manual override */}
                      <td className="py-2 px-3 text-right font-mono font-black text-slate-900 whitespace-nowrap bg-blue-50/30">
                        <span className="flex items-center justify-end gap-1">
                          {formatRupiah(it.runningSaldoGL)}
                          {it.isManualSaldo && (
                            <span className="text-[9px] bg-amber-200 text-amber-900 px-1 rounded font-sans font-bold" title="Saldo ini diisi manual">
                              Edit
                            </span>
                          )}
                        </span>
                      </td>

                      {/* Note */}
                      <td className="py-2 px-2.5 text-center text-slate-500 italic text-[11px] truncate max-w-[120px]">
                        {it.note || '-'}
                      </td>

                      {/* Aksi Edit & Hapus */}
                      <td className="py-1 px-1 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(it)}
                          className="p-1 text-slate-500 hover:text-blue-600 transition-colors mr-1 cursor-pointer"
                          title="Edit baris"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(it.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Hapus baris"
                        >
                          <Trash2 size={13} />
                        </button>
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
                  <td colSpan={2} className="py-2.5 px-2 text-center text-[11px] text-slate-500">
                    {rowsWithSaldo.length} baris
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── Form Langsung Tambah Baris Transaksi Baru dengan Dropdown Pintar ── */}
        <form onSubmit={handleQuickAddRow} className="bg-indigo-50/50 border-2 border-dashed border-indigo-300 rounded-xl p-3">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-indigo-200/60">
            <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5 uppercase">
              <Plus size={14} className="text-indigo-600" />
              Tambah Baris Transaksi ke Kode GL: <span className="bg-indigo-600 text-white px-2 py-0.5 rounded font-mono text-xs">{selectedCode || 'Semua'}</span>
            </span>
            <span className="text-[10px] text-slate-500 italic">
              Input data yang kelewat / tambahan transaksi tanpa perlu buka modal
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 items-end">
            {/* Tgl */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Tgl</label>
              <input
                type="date"
                required
                value={quickAddDate}
                onChange={e => setQuickAddDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
              />
            </div>

            {/* No Bank */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">No Bank</label>
              <input
                type="text"
                placeholder={getNextNoBank(quickAddTipe)}
                value={quickAddNoBank}
                onChange={e => setQuickAddNoBank(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-semibold"
              />
            </div>

            {/* Keterangan dengan Dropdown Kas Bank Pintar */}
            <div className="col-span-2 relative" ref={quickRef}>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                Keterangan Transaksi
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Ketik / cari nama transaksi..."
                  value={quickKetSearch}
                  onChange={e => {
                    setQuickKetSearch(e.target.value);
                    setQuickAddKet(e.target.value);
                    setQuickDropdownOpen(true);
                  }}
                  onFocus={() => setQuickDropdownOpen(true)}
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs pr-6"
                />
                <button
                  type="button"
                  onClick={() => setQuickDropdownOpen(p => !p)}
                  className="absolute right-1 top-1 text-slate-400 hover:text-slate-600 text-[10px]"
                >
                  ▼
                </button>
              </div>

              {quickDropdownOpen && (
                <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto text-xs divide-y divide-slate-100">
                  <div
                    onClick={() => {
                      setQuickAddKet(quickKetSearch);
                      setQuickDropdownOpen(false);
                    }}
                    className="p-2 hover:bg-amber-50 cursor-pointer bg-slate-50 flex items-center justify-between text-indigo-700 font-semibold"
                  >
                    <span className="flex items-center gap-1.5">
                      <Type size={12} />
                      Gunakan teks ini: "{quickKetSearch || '...'}" (Hanya keterangan)
                    </span>
                  </div>

                  {kasBankReferenceItems
                    .filter(r => r.keterangan.toLowerCase().includes(quickKetSearch.toLowerCase()))
                    .map((refIt, rIdx) => (
                      <div
                        key={refIt.id || rIdx}
                        onClick={() => {
                          setQuickAddKet(refIt.keterangan);
                          setQuickKetSearch(refIt.keterangan);
                          setQuickAddNominal(String(refIt.nominal || ''));
                          setQuickAddTipe(refIt.tipe);
                          if (refIt.noBank) setQuickAddNoBank(refIt.noBank);
                          setQuickDropdownOpen(false);
                        }}
                        className="p-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between gap-2"
                      >
                        <div className="truncate">
                          <span className="font-bold text-slate-800 block truncate">{refIt.keterangan}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{refIt.noBank}</span>
                        </div>
                        <div className="text-right whitespace-nowrap flex-shrink-0">
                          <span className={`text-[11px] font-bold font-mono block ${
                            refIt.tipe === 'Debet' ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {refIt.tipe === 'Debet' ? '+ ' : '- '}
                            {formatRupiah(refIt.nominal)}
                          </span>
                          <span className="text-[9px] text-blue-600 flex items-center justify-end gap-1">
                            <Link2 size={9} /> Auto-sinkron nominal
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Tipe */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Tipe</label>
              <select
                value={quickAddTipe}
                onChange={e => setQuickAddTipe(e.target.value as any)}
                className={`w-full border rounded px-1.5 py-1 text-xs font-bold cursor-pointer ${
                  quickAddTipe === 'Debet' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}
              >
                <option value="Debet">Debet (+)</option>
                <option value="Kredit">Kredit (-)</option>
              </select>
            </div>

            {/* Nominal */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Nominal (Rp)</label>
              <input
                type="text"
                required
                placeholder="0"
                value={quickAddNominal}
                onChange={e => setQuickAddNominal(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-right font-mono font-bold"
              />
            </div>

            {/* Tombol Tambahkan */}
            <div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Plus size={13} />
                + Tambah Baris
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Modal Tambah Baris Manual ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Tambah Transaksi Manual ke General Ledger</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddNewRowModal} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={newRowData.tanggal}
                    onChange={e => setNewRowData(p => ({ ...p, tanggal: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Kode GL (Ref)</label>
                  <select
                    value={newRowData.reff}
                    onChange={e => setNewRowData(p => ({ ...p, reff: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-mono font-bold focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    {allGLCodes.map(c => (
                      <option key={c} value={c}>
                        {c} {INITIAL_GL_ACCOUNTS[c] ? `— ${INITIAL_GL_ACCOUNTS[c].name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">No Bank (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Auto generated"
                    value={newRowData.noBank}
                    onChange={e => setNewRowData(p => ({ ...p, noBank: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tipe</label>
                  <select
                    value={newRowData.tipe}
                    onChange={e => setNewRowData(p => ({ ...p, tipe: e.target.value as any }))}
                    className={`w-full border rounded px-2.5 py-1 text-xs font-bold cursor-pointer ${
                      newRowData.tipe === 'Debet' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}
                  >
                    <option value="Debet">Debet (Masuk)</option>
                    <option value="Kredit">Kredit (Keluar)</option>
                  </select>
                </div>
              </div>

              {/* Keterangan dengan Dropdown Pintar */}
              <div className="relative" ref={modalRef}>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Keterangan Transaksi
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Ketik atau pilih transaksi dari Kas Bank..."
                    value={modalKetSearch}
                    onChange={e => {
                      setModalKetSearch(e.target.value);
                      setNewRowData(p => ({ ...p, keterangan: e.target.value }));
                      setModalDropdownOpen(true);
                    }}
                    onFocus={() => setModalDropdownOpen(true)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs pr-6"
                  />
                  <button
                    type="button"
                    onClick={() => setModalDropdownOpen(p => !p)}
                    className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-[10px]"
                  >
                    ▼
                  </button>
                </div>

                {modalDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto text-xs divide-y divide-slate-100">
                    <div
                      onClick={() => {
                        setNewRowData(p => ({ ...p, keterangan: modalKetSearch }));
                        setModalDropdownOpen(false);
                      }}
                      className="p-2 hover:bg-amber-50 cursor-pointer bg-slate-50 flex items-center justify-between text-indigo-700 font-semibold"
                    >
                      <span className="flex items-center gap-1.5">
                        <Type size={12} />
                        Gunakan teks ini: "{modalKetSearch || '...'}" (Hanya keterangan)
                      </span>
                    </div>

                    {kasBankReferenceItems
                      .filter(r => r.keterangan.toLowerCase().includes(modalKetSearch.toLowerCase()))
                      .map((refIt, rIdx) => (
                        <div
                          key={refIt.id || rIdx}
                          onClick={() => {
                            setNewRowData(p => ({
                              ...p,
                              keterangan: refIt.keterangan,
                              nominal: String(refIt.nominal || ''),
                              tipe: refIt.tipe,
                              noBank: refIt.noBank || p.noBank
                            }));
                            setModalKetSearch(refIt.keterangan);
                            setModalDropdownOpen(false);
                          }}
                          className="p-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="truncate">
                            <span className="font-bold text-slate-800 block truncate">{refIt.keterangan}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{refIt.noBank}</span>
                          </div>
                          <div className="text-right whitespace-nowrap flex-shrink-0">
                            <span className={`text-[11px] font-bold font-mono block ${
                              refIt.tipe === 'Debet' ? 'text-emerald-700' : 'text-rose-700'
                            }`}>
                              {refIt.tipe === 'Debet' ? '+ ' : '- '}
                              {formatRupiah(refIt.nominal)}
                            </span>
                            <span className="text-[9px] text-blue-600 flex items-center justify-end gap-1">
                              <Link2 size={9} /> Auto-sinkron nominal
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nominal (Rp)</label>
                  <input
                    type="text"
                    required
                    placeholder="0"
                    value={newRowData.nominal}
                    onChange={e => setNewRowData(p => ({ ...p, nominal: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs text-right font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Saldo Khusus <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-sum jika kosong"
                    value={newRowData.manualSaldo}
                    onChange={e => setNewRowData(p => ({ ...p, manualSaldo: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs text-right font-mono text-blue-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Note (Catatan)</label>
                <input
                  type="text"
                  placeholder="Catatan tambahan jika ada..."
                  value={newRowData.note}
                  onChange={e => setNewRowData(p => ({ ...p, note: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Reset Data General Ledger (PIN 0000) ── */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-rose-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertCircle size={20} />
                <h3 className="text-sm font-black uppercase tracking-wide">Konfirmasi Reset General Ledger</h3>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleExecuteReset} className="mt-4 space-y-3.5">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 leading-relaxed">
                Fitur ini akan menghapus data transaksi General Ledger / Kas Bank. Untuk mencegah kesalahan klik, fitur ini dikunci dengan <b>PIN keamanan</b>.
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Pilih Periode yang Ingin Di-Reset:
                </label>
                <select
                  value={resetPeriodTarget}
                  onChange={e => setResetPeriodTarget(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  <option value="ALL">🔴 SEMUA PERIODE (Hapus Seluruh Data Transaksi)</option>
                  <option value="2026-09">Hanya Bulan September 2026 (2026-09)</option>
                  <option value="2026-10">Hanya Bulan Oktober 2026 (2026-10)</option>
                  <option value="2026-11">Hanya Bulan November 2026 (2026-11)</option>
                  <option value="2026-12">Hanya Bulan Desember 2026 (2026-12)</option>
                  <option value="2026-01">Hanya Bulan Januari 2026 (2026-01)</option>
                  <option value="2026-02">Hanya Bulan Februari 2026 (2026-02)</option>
                  <option value="2026-03">Hanya Bulan Maret 2026 (2026-03)</option>
                  <option value="2026-04">Hanya Bulan April 2026 (2026-04)</option>
                  <option value="2026-05">Hanya Bulan Mei 2026 (2026-05)</option>
                  <option value="2026-06">Hanya Bulan Juni 2026 (2026-06)</option>
                  <option value="2026-07">Hanya Bulan Juli 2026 (2026-07)</option>
                  <option value="2026-08">Hanya Bulan Agustus 2026 (2026-08)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Masukkan PIN Keamanan (Ketik: <span className="font-mono text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">0000</span>):
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  placeholder="Ketik 0000"
                  value={resetPinInput}
                  onChange={e => {
                    setResetPinInput(e.target.value);
                    setResetError(null);
                  }}
                  className="w-full bg-slate-50 border-2 border-slate-400 rounded-lg px-3 py-2 text-center text-lg font-black font-mono tracking-widest text-slate-900 focus:outline-none focus:border-rose-600"
                />
                {resetError && (
                  <p className="text-xs font-semibold text-rose-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={13} /> {resetError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetPinInput.length !== 4}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  Konfirmasi Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
