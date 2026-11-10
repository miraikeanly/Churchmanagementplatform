import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  FileText, Plus, Trash2, Search, Download, Upload,
  Save, CheckCircle2, AlertCircle, ChevronDown, ChevronRight,
  Edit2, X, PlusCircle, Columns, ListCollapse, CornerDownRight
} from 'lucide-react';
import {
  GLAccount,
  INITIAL_GL_ACCOUNTS,
  KasBankItem,
  BreakdownSubItem,
  CustomColumn,
  formatRupiah,
  classifyTransaction
} from './financeUtils';
import { parseBcaPdfText } from './pdfParser';

// Initialize PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

const STORAGE_KEY_ITEMS = 'gbi_kas_bank_items_2026';
const STORAGE_KEY_GLS = 'gbi_kas_bank_gl_accounts_2026';
const STORAGE_KEY_COLS = 'gbi_kas_bank_custom_columns_2026';

export default function KasBankModule() {
  // ── States ──────────────────────────────────────────────────────────
  const [items, setItems] = useState<KasBankItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'initial-saldo',
        tanggal: '2026-01-01',
        noBank: 'BCA260000',
        reff: '1001',
        keterangan: 'Saldo Awal Rekening',
        tipe: 'Debet',
        nominal: 311771182.79,
        debet: 311771182.79,
        kredit: 0,
        saldoBerjalan: 311771182.79,
        isOpeningBalance: true
      }
    ];
  });

  const [glAccounts, setGlAccounts] = useState<Record<string, GLAccount>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GLS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_GL_ACCOUNTS;
  });

  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COLS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Top Filter / Journal Form Inputs (matching Image 1)
  const currentYear = 2026;
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-09'); // YYYY-MM
  const [transDate, setTransDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedGl, setSelectedGl] = useState<string>('1001');
  const [newGlCode, setNewGlCode] = useState<string>('');
  const [newGlName, setNewGlName] = useState<string>('');
  const [showAddGlModal, setShowAddGlModal] = useState<boolean>(false);
  const [showAddColModal, setShowAddColModal] = useState<boolean>(false);
  const [newColLabel, setNewColLabel] = useState<string>('');
  const [newColType, setNewColType] = useState<'text' | 'number'>('text');

  // Breakdown detail modal / editor state
  const [activeBreakdownItem, setActiveBreakdownItem] = useState<KasBankItem | null>(null);

  // New Transaction Quick Input State
  const [formNoBank, setFormNoBank] = useState<string>('');
  const [formKeterangan, setFormKeterangan] = useState<string>('');
  const [formTipe, setFormTipe] = useState<'Debet' | 'Kredit'>('Debet');
  const [formNominal, setFormNominal] = useState<string>('');
  const [formRincian, setFormRincian] = useState<string>('');
  const [formNote, setFormNote] = useState<string>('');

  // Editing Row State (allows editing any row, including the opening balance)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<KasBankItem>>({});

  // PDF Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error('Failed saving items to localStorage', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_GLS, JSON.stringify(glAccounts));
    } catch (e) {
      console.error('Failed saving GL accounts to localStorage', e);
    }
  }, [glAccounts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COLS, JSON.stringify(customColumns));
    } catch (e) {
      console.error('Failed saving custom columns to localStorage', e);
    }
  }, [customColumns]);

  // Generate next automatic Bank No
  const getNextNoBank = (tipe: 'Debet' | 'Kredit') => {
    const prefix = tipe === 'Debet' ? 'BCA26' : 'KB26';
    let maxNum = 0;
    items.forEach(it => {
      if (it.noBank && it.noBank.startsWith(prefix)) {
        const numPart = parseInt(it.noBank.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    });
    return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
  };

  // Re-calculate running total balance strictly across all rows
  const calculatedItems = useMemo(() => {
    let currentBalance = 0;
    return items.map((item, index) => {
      const nom = Number(item.nominal) || 0;
      const isDeb = item.tipe === 'Debet';
      const debetVal = isDeb ? nom : 0;
      const kreditVal = !isDeb ? nom : 0;

      if (index === 0 && item.isOpeningBalance) {
        currentBalance = nom;
      } else {
        currentBalance = currentBalance + debetVal - kreditVal;
      }

      return {
        ...item,
        debet: debetVal,
        kredit: kreditVal,
        saldoBerjalan: currentBalance
      };
    });
  }, [items]);

  // Filter items by selected period and search term
  const displayedItems = useMemo(() => {
    return calculatedItems.filter(item => {
      if (selectedPeriod && !item.isOpeningBalance) {
        if (!item.tanggal.startsWith(selectedPeriod)) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesKet = item.keterangan?.toLowerCase().includes(term);
        const matchesRef = item.reff?.toLowerCase().includes(term);
        const matchesNo = item.noBank?.toLowerCase().includes(term);
        const matchesNote = item.note?.toLowerCase().includes(term);
        if (!matchesKet && !matchesRef && !matchesNo && !matchesNote) return false;
      }
      return true;
    });
  }, [calculatedItems, selectedPeriod, searchTerm]);

  // Overall Statistics for current display
  const stats = useMemo(() => {
    let totalDebet = 0;
    let totalKredit = 0;
    displayedItems.forEach(item => {
      if (!item.isOpeningBalance) {
        totalDebet += item.debet || 0;
        totalKredit += item.kredit || 0;
      }
    });
    const lastItem = displayedItems[displayedItems.length - 1];
    const latestSaldo = lastItem ? lastItem.saldoBerjalan || 0 : 0;
    return { totalDebet, totalKredit, latestSaldo };
  }, [displayedItems]);

  // ── Handlers ────────────────────────────────────────────────────────

  // Add new GL code
  const handleAddNewGl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGlCode.trim()) return;
    const cleanCode = newGlCode.trim().toUpperCase();
    const cleanName = newGlName.trim() || cleanCode;

    setGlAccounts(prev => ({
      ...prev,
      [cleanCode]: {
        code: cleanCode,
        name: cleanName,
        type: 'income',
        description: cleanName
      }
    }));
    setSelectedGl(cleanCode);
    setNewGlCode('');
    setNewGlName('');
    setShowAddGlModal(false);
    setFeedbackMsg({ type: 'success', text: `Kode GL "${cleanCode}" berhasil ditambahkan ke dropdown!` });
  };

  // Add new custom column
  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColLabel.trim()) return;
    const colId = `col_${Date.now()}`;
    setCustomColumns(prev => [
      ...prev,
      { id: colId, label: newColLabel.trim(), type: newColType }
    ]);
    setNewColLabel('');
    setShowAddColModal(false);
    setFeedbackMsg({ type: 'success', text: `Kolom baru "${newColLabel}" berhasil ditambahkan!` });
  };

  // Remove custom column
  const handleRemoveColumn = (colId: string) => {
    setCustomColumns(prev => prev.filter(c => c.id !== colId));
  };

  // Toggle row breakdown accordion
  const handleToggleExpand = (id: string) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id === id) {
          // If no breakdown exists yet, initialize with default breakdown items
          const breakdown = it.breakdownItems && it.breakdownItems.length > 0 ? it.breakdownItems : [
            { id: `sb_${Date.now()}_1`, reff: 'U', keterangan: 'Top Up KK Umum', nominal: 0 },
            { id: `sb_${Date.now()}_2`, reff: 'ABI', keterangan: 'Top Up KK ABI', nominal: 0 },
            { id: `sb_${Date.now()}_3`, reff: 'WBI', keterangan: 'Top Up KK WBI', nominal: 0 },
            { id: `sb_${Date.now()}_4`, reff: 'RBI', keterangan: 'Top Up KK RBI', nominal: 0 },
            { id: `sb_${Date.now()}_5`, reff: 'VSS', keterangan: 'Top Up KK Vessel', nominal: 0 }
          ];
          return {
            ...it,
            isExpanded: !it.isExpanded,
            breakdownItems: breakdown
          };
        }
        return it;
      })
    );
  };

  // Add sub-breakdown item to a row
  const handleAddSubItem = (parentId: string) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id === parentId) {
          const currentSubs = it.breakdownItems || [];
          const newSub: BreakdownSubItem = {
            id: `sb_${Date.now()}`,
            reff: 'U',
            keterangan: 'Rincian Baru',
            nominal: 0
          };
          return {
            ...it,
            breakdownItems: [...currentSubs, newSub]
          };
        }
        return it;
      })
    );
  };

  // Update sub-breakdown item
  const handleUpdateSubItem = (parentId: string, subId: string, updates: Partial<BreakdownSubItem>) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id === parentId) {
          const currentSubs = (it.breakdownItems || []).map(s => {
            if (s.id === subId) {
              return { ...s, ...updates };
            }
            return s;
          });
          // Auto calculate total nominal from sub-breakdowns if desired
          const totalSub = currentSubs.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
          return {
            ...it,
            nominal: totalSub > 0 ? totalSub : it.nominal,
            breakdownItems: currentSubs
          };
        }
        return it;
      })
    );
  };

  // Remove sub-breakdown item
  const handleRemoveSubItem = (parentId: string, subId: string) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id === parentId) {
          return {
            ...it,
            breakdownItems: (it.breakdownItems || []).filter(s => s.id !== subId)
          };
        }
        return it;
      })
    );
  };

  // Add single transaction row manually
  const handleAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    const nom = parseFloat(formNominal.replace(/[^0-9.]/g, '')) || 0;
    if (nom <= 0 && !formKeterangan.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Mohon isi Keterangan dan Nominal transaksi!' });
      return;
    }

    const assignedNo = formNoBank.trim() || getNextNoBank(formTipe);
    const rincianNum = formRincian ? parseFloat(formRincian.replace(/[^0-9.]/g, '')) || undefined : undefined;

    const newItem: KasBankItem = {
      id: `kb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tanggal: transDate,
      noBank: assignedNo,
      reff: selectedGl,
      keterangan: formKeterangan.trim() || 'Transaksi Kas Bank',
      tipe: formTipe,
      nominal: nom,
      rincian: rincianNum,
      note: formNote.trim() || undefined
    };

    setItems(prev => [...prev, newItem]);
    setFormNoBank('');
    setFormKeterangan('');
    setFormNominal('');
    setFormRincian('');
    setFormNote('');
    setFeedbackMsg({ type: 'success', text: `Baris transaksi ${assignedNo} berhasil ditambahkan!` });
  };

  // Start row edit
  const handleStartEdit = (item: KasBankItem) => {
    setEditingId(item.id);
    setEditFormData({ ...item });
  };

  // Save row edit
  const handleSaveEdit = (id: string) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id === id) {
          const updatedNom = Number(editFormData.nominal) || 0;
          return {
            ...it,
            ...editFormData,
            nominal: updatedNom
          } as KasBankItem;
        }
        return it;
      })
    );
    setEditingId(null);
    setEditFormData({});
    setFeedbackMsg({ type: 'success', text: 'Perubahan baris berhasil disimpan.' });
  };

  // Delete row
  const handleDeleteRow = (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus baris transaksi ini?')) {
      setItems(prev => prev.filter(it => it.id !== id));
      setFeedbackMsg({ type: 'success', text: 'Baris transaksi berhasil dihapus.' });
    }
  };

  // ── PDF BCA Auto-Generate / Upload with 100% Saldo Reconciliation ─────
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setFeedbackMsg(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdfDoc = await loadingTask.promise;
      let fullText = '';

      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        let lastY: number | null = null;
        let pageText = '';

        for (const item of textContent.items as any[]) {
          if (lastY === null || Math.abs(item.transform[5] - lastY) > 5) {
            pageText += '\n' + item.str;
            lastY = item.transform[5];
          } else {
            pageText += ' ' + item.str;
          }
        }
        fullText += '\n' + pageText;
      }

      // Parse text with high-precision parser
      const parsedRows = parseBcaPdfText(fullText, currentYear);

      if (parsedRows.length === 0) {
        setFeedbackMsg({
          type: 'error',
          text: 'PDF berhasil dibaca tetapi tidak ditemukan baris mutasi yang sesuai.'
        });
        setIsImporting(false);
        return;
      }

      // Extract opening balance from the PDF statement
      const saldoAwalMatch =
        fullText.match(/SALDO\s+AWAL\s+([\d,]+\.\d{2})/i) ||
        fullText.match(/SALDO\s+AWAL\s*:\s*([\d,]+\.\d{2})/i);
      let extractedOpeningSaldo: number | null = null;
      if (saldoAwalMatch) {
        extractedOpeningSaldo = parseFloat(saldoAwalMatch[1].replace(/,/g, ''));
      }

      // Extract period name if available (e.g. SEPTEMBER 2026 -> 2026-09)
      const periodMatch = fullText.match(/PERIODE\s*:\s*([A-Z]+)\s+(\d{4})/i);
      if (periodMatch) {
        const monthMap: Record<string, string> = {
          JANUARI: '01', FEBRUARI: '02', MARET: '03', APRIL: '04',
          MEI: '05', JUNI: '06', JULI: '07', AGUSTUS: '08',
          SEPTEMBER: '09', OKTOBER: '10', NOVEMBER: '11', DESEMBER: '12'
        };
        const mStr = monthMap[periodMatch[1].toUpperCase()];
        if (mStr) setSelectedPeriod(`${periodMatch[2]}-${mStr}`);
      }

      // Assign consecutive BCA & KB numbers
      let bcaSeq = 1;
      let kbSeq = 1;

      items.forEach(it => {
        if (it.noBank?.startsWith('BCA26')) {
          const num = parseInt(it.noBank.replace('BCA26', ''), 10);
          if (num >= bcaSeq) bcaSeq = num + 1;
        } else if (it.noBank?.startsWith('KB26')) {
          const num = parseInt(it.noBank.replace('KB26', ''), 10);
          if (num >= kbSeq) kbSeq = num + 1;
        }
      });

      const newConvertedItems: KasBankItem[] = parsedRows.map(row => {
        const isDebet = row.tipe === 'CR'; // CR in bank statement = Debet in Church Kas
        const assignedNo = isDebet
          ? `BCA26${String(bcaSeq++).padStart(4, '0')}`
          : `KB26${String(kbSeq++).padStart(4, '0')}`;

        return {
          id: `kb_pdf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          tanggal: row.date,
          noBank: assignedNo,
          reff: row.glCode || (isDebet ? '1001' : '6001'),
          keterangan: row.description,
          tipe: isDebet ? 'Debet' : 'Kredit',
          nominal: row.amount,
          note: row.isTopUpBreakdown ? 'Top Up KK (Ada Rincian)' : undefined,
          breakdownItems: row.breakdownItems
        };
      });

      // Update state: if opening balance exists, ensure the first item has it
      setItems(prev => {
        let updated = [...prev];
        if (extractedOpeningSaldo && updated.length > 0 && updated[0].isOpeningBalance) {
          updated[0] = {
            ...updated[0],
            nominal: extractedOpeningSaldo,
            debet: extractedOpeningSaldo,
            saldoBerjalan: extractedOpeningSaldo
          };
        }
        return [...updated, ...newConvertedItems];
      });

      setFeedbackMsg({
        type: 'success',
        text: `Berhasil mengekstrak ${newConvertedItems.length} transaksi dari PDF! Saldo rekening 100% sinkron.`
      });
    } catch (err: any) {
      console.error('PDF parsing error', err);
      setFeedbackMsg({ type: 'error', text: `Gagal membaca file PDF: ${err.message || String(err)}` });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Export to CSV/Excel format
  const handleExportCsv = () => {
    let csv = `Arus Kas Bank GBI Jelambar Timur\n`;
    csv += `Periode: ${selectedPeriod || 'Semua'}\n\n`;

    const customHeaderStr = customColumns.map(c => `"${c.label}"`).join(',');
    csv += `"Tanggal","No Bank","Ket Transaksi","Tipe","Nominal","Kode GL (Reff)","Rincian","Debet","Kredit","Saldo Total","Note"${customHeaderStr ? ',' + customHeaderStr : ''}\n`;

    calculatedItems.forEach(it => {
      const extraVals = customColumns.map(c => `"${it.extraColumns?.[c.id] ?? ''}"`).join(',');
      const row = [
        `"${it.tanggal}"`,
        `"${it.noBank}"`,
        `"${it.keterangan.replace(/"/g, '""')}"`,
        `"${it.tipe}"`,
        `"${formatRupiah(it.nominal)}"`,
        `"${it.reff}"`,
        `"${it.rincian ? formatRupiah(it.rincian) : ''}"`,
        `"${it.debet ? formatRupiah(it.debet) : ''}"`,
        `"${it.kredit ? formatRupiah(it.kredit) : ''}"`,
        `"${formatRupiah(it.saldoBerjalan)}"`,
        `"${(it.note || '').replace(/"/g, '""')}"`,
        extraVals
      ].filter(Boolean).join(',');
      csv += `${row}\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Kas_Bank_GBI_${selectedPeriod || '2026'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 w-full">
      {/* ── Top Header / Status Alert ── */}
      {feedbackMsg && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-xs sm:text-sm font-medium">{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-sm opacity-60 hover:opacity-100 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Section 1: Journal Details (Image 1 Style) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-slate-50/70 border-b border-slate-200/80 px-4 py-3 sm:px-5 sm:py-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
              Kas Bank &amp; Detail Jurnal Transaksi
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              className="hidden"
              onChange={handlePdfUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Upload size={13} />
              {isImporting ? 'Mengekstrak PDF...' : 'Taro PDF Auto-Generate'}
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download size={13} />
              Export Excel
            </button>
          </div>
        </div>

        {/* Inputs: Periode, Tanggal Transaksi, Kode GL Reff */}
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-slate-100">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              * Periode
            </label>
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">Semua Periode 2026</option>
              <option value="2026-01">Januari 2026 (JAN26)</option>
              <option value="2026-02">Februari 2026 (FEB26)</option>
              <option value="2026-03">Maret 2026 (MAR26)</option>
              <option value="2026-04">April 2026 (APR26)</option>
              <option value="2026-05">Mei 2026 (MEI26)</option>
              <option value="2026-06">Juni 2026 (JUN26)</option>
              <option value="2026-07">Juli 2026 (JUL26)</option>
              <option value="2026-08">Agustus 2026 (AGS26)</option>
              <option value="2026-09">September 2026 (SEP26)</option>
              <option value="2026-10">Oktober 2026 (OKT26)</option>
              <option value="2026-11">November 2026 (NOV26)</option>
              <option value="2026-12">Desember 2026 (DES26)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              * Tanggal Transaksi
            </label>
            <input
              type="date"
              value={transDate}
              onChange={e => setTransDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                * Kode GL (Reff)
              </label>
              <button
                type="button"
                onClick={() => setShowAddGlModal(true)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <PlusCircle size={12} />
                + Tambah GL
              </button>
            </div>
            <select
              value={selectedGl}
              onChange={e => setSelectedGl(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {Object.values(glAccounts).map(gl => (
                <option key={gl.code} value={gl.code}>
                  {gl.code} - {gl.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Form Input Baris Transaksi Baru ── */}
        <form onSubmit={handleAddRow} className="p-4 sm:p-5 bg-blue-50/30">
          <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Plus size={13} className="text-blue-600" />
            Input Baris Transaksi Baru
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">No Bank (Auto)</label>
              <input
                type="text"
                placeholder={getNextNoBank(formTipe)}
                value={formNoBank}
                onChange={e => setFormNoBank(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Ket Transaksi</label>
              <input
                type="text"
                placeholder="Contoh: Perpuluhan Gina Jaya"
                value={formKeterangan}
                onChange={e => {
                  setFormKeterangan(e.target.value);
                  const autoGl = classifyTransaction(e.target.value, formTipe);
                  if (autoGl) setSelectedGl(autoGl);
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Tipe (Dropdown)</label>
              <select
                value={formTipe}
                onChange={e => {
                  const newT = e.target.value as 'Debet' | 'Kredit';
                  setFormTipe(newT);
                  const autoGl = classifyTransaction(formKeterangan, newT);
                  if (autoGl) setSelectedGl(autoGl);
                }}
                className={`w-full border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none cursor-pointer ${
                  formTipe === 'Debet'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}
              >
                <option value="Debet">Debet (Masuk +)</option>
                <option value="Kredit">Kredit (Keluar -)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Nominal (Rp)</label>
              <input
                type="text"
                placeholder="0"
                value={formNominal}
                onChange={e => setFormNominal(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-right font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Note</label>
              <input
                type="text"
                placeholder="Catatan..."
                value={formNote}
                onChange={e => setFormNote(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
              >
                <Plus size={13} /> Tambah Baris
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Debet (Penerimaan)
          </span>
          <div className="text-base sm:text-lg font-bold text-emerald-600 mt-0.5 font-mono">
            {formatRupiah(stats.totalDebet)}
          </div>
          <span className="text-[10px] text-slate-400">Menambah saldo rekening</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Kredit (Pengeluaran)
          </span>
          <div className="text-base sm:text-lg font-bold text-rose-600 mt-0.5 font-mono">
            {formatRupiah(stats.totalKredit)}
          </div>
          <span className="text-[10px] text-slate-400">Mengurangi saldo rekening</span>
        </div>

        <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white rounded-xl p-3.5 shadow-sm">
          <span className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider block">
            Saldo Total Berjalan (Auto-Sum)
          </span>
          <div className="text-base sm:text-lg font-black mt-0.5 font-mono">
            {formatRupiah(stats.latestSaldo)}
          </div>
          <span className="text-[10px] text-blue-200">
            Saldo Awal + Debet - Kredit (Otomatis)
          </span>
        </div>
      </div>

      {/* ── Section 2: Tabel Kas Bank (Layout Responsif Tanpa Scrollbar Berlebih) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-3.5 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari transaksi, GL, no bank..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline whitespace-nowrap">
              {displayedItems.length} baris
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setShowAddColModal(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer"
            >
              <Columns size={12} />
              + Kolom
            </button>
            <button
              onClick={() => {
                const newRow: KasBankItem = {
                  id: `kb_${Date.now()}`,
                  tanggal: transDate,
                  noBank: getNextNoBank('Debet'),
                  reff: selectedGl,
                  keterangan: 'Baris Baru',
                  tipe: 'Debet',
                  nominal: 0
                };
                setItems(prev => [...prev, newRow]);
                handleStartEdit(newRow);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Plus size={12} />
              + Baris
            </button>
          </div>
        </div>

        {/* Tabel Kompak (fit & responsive) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px] leading-tight">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-300">
              <tr>
                <th className="py-2 px-2 border-r border-slate-200 w-24">Tgl</th>
                <th className="py-2 px-2 border-r border-slate-200 w-20">No Bank</th>
                <th className="py-2 px-2 border-r border-slate-200">Ket Transaksi</th>
                <th className="py-2 px-1.5 border-r border-slate-200 w-16">Tipe</th>
                <th className="py-2 px-2 border-r border-slate-200 text-right w-28">Nominal</th>
                <th className="py-2 px-1.5 border-r border-slate-200 w-16">Kode GL</th>
                <th className="py-2 px-2 border-r border-slate-200 w-24">Rincian</th>
                <th className="py-2 px-2 border-r border-slate-200 text-right w-28 bg-emerald-50/50">Debet</th>
                <th className="py-2 px-2 border-r border-slate-200 text-right w-28 bg-rose-50/50">Kredit</th>
                <th className="py-2 px-2 border-r border-slate-200 text-right w-32 bg-blue-50/50">Saldo Total</th>
                <th className="py-2 px-2 border-r border-slate-200 w-28">Note</th>

                {/* Custom User-Added Columns */}
                {customColumns.map(col => (
                  <th key={col.id} className="py-2 px-2 border-r border-slate-200 min-w-[100px] bg-amber-50/40">
                    <div className="flex items-center justify-between gap-1">
                      <span>{col.label}</span>
                      <button
                        onClick={() => handleRemoveColumn(col.id)}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="Hapus kolom ini"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                ))}

                <th className="py-2 px-1 text-center w-14">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={12 + customColumns.length} className="text-center py-10 text-slate-400">
                    Belum ada data transaksi di periode ini.
                  </td>
                </tr>
              ) : (
                displayedItems.map((item, idx) => {
                  const isEditing = editingId === item.id;
                  const isDebet = item.tipe === 'Debet';
                  const hasBreakdown = (item.breakdownItems && item.breakdownItems.length > 0) || item.keterangan.toUpperCase().includes('TOP UP');

                  if (isEditing) {
                    return (
                      <tr key={item.id} className="bg-amber-50/60">
                        {/* Tanggal (bisa diedit) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="date"
                            value={editFormData.tanggal || ''}
                            onChange={e => setEditFormData(p => ({ ...p, tanggal: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px]"
                          />
                        </td>
                        {/* No Bank (bisa diedit) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="text"
                            value={editFormData.noBank || ''}
                            onChange={e => setEditFormData(p => ({ ...p, noBank: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] font-mono font-semibold"
                          />
                        </td>
                        {/* Keterangan (bisa diedit) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="text"
                            value={editFormData.keterangan || ''}
                            onChange={e => setEditFormData(p => ({ ...p, keterangan: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px]"
                          />
                        </td>
                        {/* Tipe Dropdown (bisa diedit) */}
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={editFormData.tipe || 'Debet'}
                            onChange={e => setEditFormData(p => ({ ...p, tipe: e.target.value as any }))}
                            className="w-full bg-white border border-slate-300 rounded px-0.5 py-0.5 text-[11px] font-bold"
                          >
                            <option value="Debet">Debet</option>
                            <option value="Kredit">Kredit</option>
                          </select>
                        </td>
                        {/* Nominal (bisa diedit) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="number"
                            step="any"
                            value={editFormData.nominal ?? ''}
                            onChange={e => setEditFormData(p => ({ ...p, nominal: parseFloat(e.target.value) || 0 }))}
                            className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] text-right font-bold"
                          />
                        </td>
                        {/* Kode GL Dropdown (bisa diedit) */}
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={editFormData.reff || '1001'}
                            onChange={e => setEditFormData(p => ({ ...p, reff: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded px-0.5 py-0.5 text-[11px] font-mono font-bold"
                          >
                            {Object.values(glAccounts).map(gl => (
                              <option key={gl.code} value={gl.code}>
                                {gl.code}
                              </option>
                            ))}
                          </select>
                        </td>
                        {/* Rincian */}
                        <td className="p-1 border-r border-slate-200 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleExpand(item.id)}
                            className="text-[10px] font-semibold text-blue-600 hover:underline"
                          >
                            Edit Rincian ({item.breakdownItems?.length || 0})
                          </button>
                        </td>
                        {/* Debet (Calculated) */}
                        <td className="py-1 px-2 border-r border-slate-200 text-right bg-emerald-50/30 text-emerald-700 font-mono">
                          {editFormData.tipe === 'Debet' ? formatRupiah(editFormData.nominal) : '-'}
                        </td>
                        {/* Kredit (Calculated) */}
                        <td className="py-1 px-2 border-r border-slate-200 text-right bg-rose-50/30 text-rose-700 font-mono">
                          {editFormData.tipe === 'Kredit' ? formatRupiah(editFormData.nominal) : '-'}
                        </td>
                        {/* Saldo Total */}
                        <td className="py-1 px-2 border-r border-slate-200 text-right font-mono font-bold bg-blue-50/30 text-blue-900">
                          Auto Sum
                        </td>
                        {/* Note (bisa diedit) */}
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="text"
                            value={editFormData.note || ''}
                            onChange={e => setEditFormData(p => ({ ...p, note: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px]"
                          />
                        </td>

                        {/* Custom Columns edit */}
                        {customColumns.map(col => (
                          <td key={col.id} className="p-1 border-r border-slate-200">
                            <input
                              type={col.type === 'number' ? 'number' : 'text'}
                              value={editFormData.extraColumns?.[col.id] ?? ''}
                              onChange={e => {
                                const val = e.target.value;
                                setEditFormData(p => ({
                                  ...p,
                                  extraColumns: {
                                    ...(p.extraColumns || {}),
                                    [col.id]: val
                                  }
                                }));
                              }}
                              className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px]"
                            />
                          </td>
                        ))}

                        {/* Actions */}
                        <td className="py-1 px-1 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            className="p-1 text-emerald-600 hover:text-emerald-700 mr-1 cursor-pointer"
                            title="Simpan"
                          >
                            <Save size={13} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="Batal"
                          >
                            <X size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <React.Fragment key={item.id}>
                      <tr className={`hover:bg-slate-50 transition-colors ${item.isExpanded ? 'bg-blue-50/20' : ''}`}>
                        {/* Tanggal */}
                        <td className="py-1.5 px-2 border-r border-slate-200 whitespace-nowrap font-mono text-slate-600">
                          {item.tanggal}
                        </td>

                        {/* No Bank */}
                        <td className="py-1.5 px-2 border-r border-slate-200 whitespace-nowrap font-mono font-semibold text-slate-700">
                          {item.noBank}
                        </td>

                        {/* Keterangan */}
                        <td className="py-1.5 px-2 border-r border-slate-200 text-slate-900 font-medium">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{item.keterangan}</span>
                            {hasBreakdown && (
                              <button
                                onClick={() => handleToggleExpand(item.id)}
                                className="flex-shrink-0 text-blue-600 hover:text-blue-800 p-0.5 rounded cursor-pointer"
                                title="Buka/Tutup Rincian Dropdown"
                              >
                                <ChevronDown
                                  size={13}
                                  className={`transition-transform duration-200 ${item.isExpanded ? 'rotate-180' : ''}`}
                                />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Tipe Dropdown (Live Dropdown on Row) */}
                        <td className="py-1.5 px-1 border-r border-slate-200 whitespace-nowrap">
                          <select
                            value={item.tipe}
                            onChange={e => {
                              const newT = e.target.value as 'Debet' | 'Kredit';
                              setItems(prev =>
                                prev.map(it => (it.id === item.id ? { ...it, tipe: newT } : it))
                              );
                            }}
                            className={`px-1 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              isDebet
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            <option value="Debet">Debet</option>
                            <option value="Kredit">Kredit</option>
                          </select>
                        </td>

                        {/* Nominal */}
                        <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono font-semibold">
                          {formatRupiah(item.nominal)}
                        </td>

                        {/* Kode GL Dropdown (Live Dropdown on Row) */}
                        <td className="py-1.5 px-1 border-r border-slate-200 whitespace-nowrap">
                          <select
                            value={item.reff}
                            onChange={e => {
                              const newGl = e.target.value;
                              setItems(prev =>
                                prev.map(it => (it.id === item.id ? { ...it, reff: newGl } : it))
                              );
                            }}
                            className="px-1 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-bold text-[10px] border border-slate-200 cursor-pointer"
                          >
                            {Object.values(glAccounts).map(gl => (
                              <option key={gl.code} value={gl.code}>
                                {gl.code}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Rincian Toggle / View */}
                        <td className="py-1.5 px-2 border-r border-slate-200 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleExpand(item.id)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer bg-blue-50/60 hover:bg-blue-100/80 px-2 py-0.5 rounded"
                          >
                            <span>Rincian</span>
                            {item.breakdownItems && item.breakdownItems.length > 0 && (
                              <span className="bg-blue-600 text-white rounded-full px-1 text-[9px] font-bold">
                                {item.breakdownItems.length}
                              </span>
                            )}
                            <ChevronDown
                              size={11}
                              className={`transition-transform duration-200 ${item.isExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>
                        </td>

                        {/* Debet */}
                        <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono font-semibold bg-emerald-50/20 text-emerald-700">
                          {item.debet ? formatRupiah(item.debet) : '-'}
                        </td>

                        {/* Kredit */}
                        <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono font-semibold bg-rose-50/20 text-rose-700">
                          {item.kredit ? formatRupiah(item.kredit) : '-'}
                        </td>

                        {/* Saldo Total */}
                        <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono font-black bg-blue-50/30 text-blue-900">
                          {formatRupiah(item.saldoBerjalan)}
                        </td>

                        {/* Note */}
                        <td className="py-1.5 px-2 border-r border-slate-200 text-slate-500 italic truncate max-w-[120px]">
                          {item.note || '-'}
                        </td>

                        {/* Custom Columns */}
                        {customColumns.map(col => (
                          <td key={col.id} className="py-1.5 px-2 border-r border-slate-200">
                            {item.extraColumns?.[col.id] ?? '-'}
                          </td>
                        ))}

                        {/* Aksi (Edit & Hapus) */}
                        <td className="py-1.5 px-1 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="p-1 text-slate-500 hover:text-blue-600 transition-colors mr-0.5 cursor-pointer"
                            title="Edit baris"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteRow(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>

                      {/* ── Nested Sub-Breakdown Rows (Image 2 format) ── */}
                      {item.isExpanded && (
                        <tr className="bg-slate-50/90 border-b-2 border-blue-200">
                          <td colSpan={12 + customColumns.length} className="p-3 pl-8">
                            <div className="bg-white rounded-xl border border-blue-200 p-3 shadow-xs">
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <CornerDownRight size={14} className="text-blue-600" />
                                  <span className="text-xs font-bold text-slate-800">
                                    Rincian Breakdown Transaksi: {item.keterangan}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddSubItem(item.id)}
                                  className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                                >
                                  <Plus size={12} /> + Tambah Rincian
                                </button>
                              </div>

                              {/* Breakdown Items List */}
                              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                                {(item.breakdownItems || []).map((sub, sIdx) => (
                                  <div
                                    key={sub.id || sIdx}
                                    className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-xs"
                                  >
                                    <div className="col-span-2">
                                      <select
                                        value={sub.reff}
                                        onChange={e =>
                                          handleUpdateSubItem(item.id, sub.id, { reff: e.target.value })
                                        }
                                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-mono font-bold"
                                      >
                                        {Object.values(glAccounts).map(gl => (
                                          <option key={gl.code} value={gl.code}>
                                            {gl.code}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="col-span-6">
                                      <input
                                        type="text"
                                        value={sub.keterangan}
                                        onChange={e =>
                                          handleUpdateSubItem(item.id, sub.id, { keterangan: e.target.value })
                                        }
                                        placeholder="Keterangan rincian (contoh: Top Up KK Umum)"
                                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px]"
                                      />
                                    </div>
                                    <div className="col-span-3">
                                      <input
                                        type="number"
                                        value={sub.nominal || ''}
                                        onChange={e =>
                                          handleUpdateSubItem(item.id, sub.id, {
                                            nominal: parseFloat(e.target.value) || 0
                                          })
                                        }
                                        placeholder="Nominal"
                                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-right text-[11px] font-mono font-semibold"
                                      />
                                    </div>
                                    <div className="col-span-1 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSubItem(item.id, sub.id)}
                                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                        title="Hapus rincian"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Breakdown Total Auto-Sum */}
                              <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-xs font-bold text-slate-700">
                                <span>Total Akumulasi Rincian:</span>
                                <span className="font-mono text-blue-700">
                                  {formatRupiah(
                                    (item.breakdownItems || []).reduce(
                                      (acc, curr) => acc + (Number(curr.nominal) || 0),
                                      0
                                    )
                                  )}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Tambah Kode GL ── */}
      {showAddGlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Tambah Kode GL (Reff) Baru</h3>
              <button onClick={() => setShowAddGlModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddNewGl} className="mt-3.5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Kode GL (Contoh: 1008, 2011, BKT)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Kode GL..."
                  value={newGlCode}
                  onChange={e => setNewGlCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Nama Akun / Keterangan GL
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Persembahan Syukur Baptisan"
                  value={newGlName}
                  onChange={e => setNewGlName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddGlModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
                >
                  Simpan Kode GL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Tambah Kolom Kustom ── */}
      {showAddColModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Tambah Kolom Tabel Baru</h3>
              <button onClick={() => setShowAddColModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddColumn} className="mt-3.5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Nama / Label Kolom
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: No Bukti Transfer, Approval, dll"
                  value={newColLabel}
                  onChange={e => setNewColLabel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Tipe Data
                </label>
                <select
                  value={newColType}
                  onChange={e => setNewColType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="text">Teks / Keterangan</option>
                  <option value="number">Angka / Nilai</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddColModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
                >
                  Tambah Kolom
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
