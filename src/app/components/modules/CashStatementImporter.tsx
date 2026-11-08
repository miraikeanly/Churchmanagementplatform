import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { UploadCloud, CheckCircle2, AlertCircle, Sparkles, Building2, Wallet, Plus, Trash2, Clipboard, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { GL_ACCOUNTS, BankStatementRow, CashJournalEntry, classifyTransaction } from '../../../lib/glDefinitions';
import { parseBcaStatementText, parseBcaCsvRows } from '../../../lib/bcaParser';
import { apiBase } from '../../../lib/api';

// Set up worker for client-side PDF.js rendering
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface Props {
  sourceType: 'bank' | 'petty_cash';
  existingEntries: CashJournalEntry[];
  canEdit: boolean;
  onImportComplete: (newEntries: CashJournalEntry[]) => Promise<void>;
}

export default function CashStatementImporter({ sourceType, existingEntries, canEdit, onImportComplete }: Props) {
  const [isParsing, setIsParsing] = useState(false);
  const [previewRows, setPreviewRows] = useState<BankStatementRow[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [openPasteDialog, setOpenPasteDialog] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual transaction input state
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualDesc, setManualDesc] = useState('');
  const [manualType, setManualType] = useState<'CR' | 'DB'>('CR');
  const [manualAmount, setManualAmount] = useState('');
  const [manualGL, setManualGL] = useState('1001');

  // Compute next Reference Number sequence
  const getNextRefSequence = (type: 'BCA' | 'KB' | 'KK', year: number, currentList: CashJournalEntry[], pendingCount: number) => {
    const yr2 = String(year).slice(-2);
    const prefix = `${type}${yr2}`;
    
    let maxSeq = 0;
    currentList.forEach(e => {
      if (e.noRef && e.noRef.startsWith(prefix)) {
        const numPart = parseInt(e.noRef.slice(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    });

    const nextSeq = maxSeq + 1 + pendingCount;
    return `${prefix}${String(nextSeq).padStart(type === 'KK' ? 5 : 4, '0')}`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setIsParsing(true);
    setStatusMsg(null);

    try {
      const fileName = uploadedFile.name.toLowerCase();

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        const data = await uploadedFile.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        const parsed = parseBcaCsvRows(jsonData, selectedYear);
        if (parsed.length === 0) {
          setStatusMsg({ type: 'error', text: 'Tidak dapat menemukan format tanggal & mutasi dari file Excel/CSV ini.' });
        } else {
          setPreviewRows(parsed);
          setStatusMsg({ type: 'success', text: `Berhasil membaca ${parsed.length} transaksi dari ${uploadedFile.name}` });
        }
        setIsParsing(false);
      } else if (fileName.endsWith('.pdf')) {
        // Direct Client-Side PDF Parsing using pdfjs-dist (100% immune to server node worker issues)
        try {
          const arrayBuffer = await uploadedFile.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
          const pdfDoc = await loadingTask.promise;
          let fullText = '';

          for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            // Reconstruct text line by line using y-coordinates
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

          const parsed = parseBcaStatementText(fullText, selectedYear);
          if (parsed.length > 0) {
            setPreviewRows(parsed);
            setStatusMsg({ type: 'success', text: `Berhasil mengekstrak ${parsed.length} transaksi dari PDF BCA (${pdfDoc.numPages} halaman)!` });
          } else {
            setStatusMsg({
              type: 'error',
              text: 'PDF terbaca tapi tidak ada mutasi yang cocok. Anda dapat mem-paste teksnya langsung lewat tombol "Paste Teks Mutasi".'
            });
          }
        } catch (pdfClientErr: any) {
          console.error('Client PDF parse error:', pdfClientErr);
          setStatusMsg({ type: 'error', text: 'Gagal membaca PDF: ' + (pdfClientErr.message || String(pdfClientErr)) });
        } finally {
          setIsParsing(false);
        }
      } else {
        setStatusMsg({ type: 'error', text: 'Format tidak didukung. Harap upload .xlsx, .xls, .csv, atau .pdf' });
        setIsParsing(false);
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setStatusMsg({ type: 'error', text: 'Gagal memproses file: ' + err.message });
      setIsParsing(false);
    }
  };

  const handleUpdateRowGL = (index: number, newGLCode: string) => {
    setPreviewRows(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        autoGLCode: newGLCode,
        notes: GL_ACCOUNTS[newGLCode]?.unitCategory ? `Masuk Kas: ${newGLCode}` : undefined
      };
      return updated;
    });
  };

  const handleUpdateRowDesc = (index: number, newDesc: string) => {
    setPreviewRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], description: newDesc };
      return updated;
    });
  };

  const handleToggleBreakdown = (index: number) => {
    setPreviewRows(prev => {
      const updated = [...prev];
      const curr = updated[index];
      const isTopUp = !curr.isTopUpBreakdown;
      updated[index] = {
        ...curr,
        isTopUpBreakdown: isTopUp,
        breakdownItems: isTopUp ? [
          { glCode: 'U', description: 'Top Up KK Umum', amount: 0 },
          { glCode: 'ABI', description: 'Top Up KK ABI', amount: 0 },
          { glCode: 'WBI', description: 'Top Up KK WBI', amount: 0 },
          { glCode: 'RBI', description: 'Top Up KK RBI', amount: 0 },
          { glCode: 'VSS', description: 'Top Up KK Vessel', amount: 0 },
        ] : undefined
      };
      return updated;
    });
  };

  const handleUpdateBreakdownItem = (rowIndex: number, itemIndex: number, field: 'glCode' | 'description' | 'amount', val: any) => {
    setPreviewRows(prev => {
      const updated = [...prev];
      const row = { ...updated[rowIndex] };
      if (!row.breakdownItems) return prev;
      
      const newItems = [...row.breakdownItems];
      newItems[itemIndex] = { ...newItems[itemIndex], [field]: val };
      row.breakdownItems = newItems;
      updated[rowIndex] = row;
      return updated;
    });
  };

  const handleAddBreakdownItem = (rowIndex: number) => {
    setPreviewRows(prev => {
      const updated = [...prev];
      const row = { ...updated[rowIndex] };
      if (!row.breakdownItems) row.breakdownItems = [];
      row.breakdownItems = [...row.breakdownItems, { glCode: 'DK', description: 'Top Up KK Kowari', amount: 0 }];
      updated[rowIndex] = row;
      return updated;
    });
  };

  const handleAddManualRow = () => {
    if (!manualDesc || !manualAmount || parseFloat(manualAmount) <= 0) {
      alert('Mohon isi keterangan dan nominal valid');
      return;
    }

    const amt = parseFloat(manualAmount);
    const [y, m, d] = manualDate.split('-');
    const classified = classifyTransaction(manualDesc, manualType, amt);

    const newRow: BankStatementRow = {
      date: manualDate,
      rawDate: `${d}/${m}`,
      description: manualDesc,
      mutasiType: manualType,
      amount: amt,
      autoGLCode: manualGL || classified.glCode,
      notes: classified.targetUnit ? `Auto Masuk Kas: ${classified.targetUnit}` : undefined
    };

    setPreviewRows(prev => [newRow, ...prev]);
    setManualDesc('');
    setManualAmount('');
  };

  const handleDeletePreviewRow = (idx: number) => {
    setPreviewRows(prev => prev.filter((_, i) => i !== idx));
  };

  // Commit preview rows into formal CashJournalEntry records (matching Excel GL structure)
  const handleCommitToJournal = async () => {
    if (previewRows.length === 0) return;
    setIsSubmitting(true);

    try {
      const convertedEntries: CashJournalEntry[] = [];
      const currentFullList = [...existingEntries];
      let seqOffset = 0;

      previewRows.forEach((row) => {
        let refPrefix: 'BCA' | 'KB' | 'KK' = 'BCA';
        if (sourceType === 'petty_cash') {
          refPrefix = 'KK';
        } else {
          refPrefix = row.mutasiType === 'DB' ? 'KB' : 'BCA';
        }

        const mainRefNo = getNextRefSequence(refPrefix, selectedYear, currentFullList, seqOffset);
        seqOffset++;

        // If top up or breakdown is active (e.g. Image 3 & 4: KB260196 top up rincian)
        if (row.isTopUpBreakdown && row.breakdownItems && row.breakdownItems.length > 0) {
          // Add sub-breakdown rows
          row.breakdownItems.forEach((subItem) => {
            if (subItem.amount > 0 || row.breakdownItems!.length <= 6) {
              const subEntry: CashJournalEntry = {
                id: `cj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                sourceType,
                date: row.date,
                noRef: mainRefNo,
                glCode: subItem.glCode,
                description: subItem.description,
                rincian: subItem.amount > 0 ? subItem.amount : null,
                debet: null,
                kredit: null,
                targetUnit: subItem.glCode,
                isAutoClassified: true,
                createdAt: new Date().toISOString()
              };
              convertedEntries.push(subEntry);
              currentFullList.push(subEntry);
            }
          });

          // Add final summary row with full amount in Kredit
          const totalSummaryEntry: CashJournalEntry = {
            id: `cj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            sourceType,
            date: row.date,
            noRef: mainRefNo,
            glCode: '',
            description: 'Transfer',
            rincian: null,
            debet: null,
            kredit: row.amount,
            targetUnit: undefined,
            isAutoClassified: true,
            createdAt: new Date().toISOString()
          };
          convertedEntries.push(totalSummaryEntry);
          currentFullList.push(totalSummaryEntry);
        } else {
          // Standard Single Row
          const glAccount = GL_ACCOUNTS[row.autoGLCode || '6001'];
          const isTargetUnit = glAccount && glAccount.type === 'unit';

          const entry: CashJournalEntry = {
            id: `cj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            sourceType,
            date: row.date,
            noRef: mainRefNo,
            glCode: row.autoGLCode || '6001',
            description: row.description,
            rincian: null,
            debet: row.mutasiType === 'CR' ? row.amount : null,
            kredit: row.mutasiType === 'DB' ? row.amount : null,
            targetUnit: isTargetUnit ? row.autoGLCode : undefined,
            isAutoClassified: true,
            createdAt: new Date().toISOString()
          };

          convertedEntries.push(entry);
          currentFullList.push(entry);
        }
      });

      await onImportComplete(convertedEntries);
      setPreviewRows([]);
      setOpenConfirmDialog(false);
      setStatusMsg({ type: 'success', text: `Sukses menginput ${convertedEntries.length} baris transaksi ke Buku Kas & GL!` });
    } catch (err: any) {
      console.error('Commit error:', err);
      setStatusMsg({ type: 'error', text: 'Gagal menyimpan ke jurnal: ' + err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            {sourceType === 'bank' ? <Building2 size={24} /> : <Wallet size={24} />}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {sourceType === 'bank' ? 'Otomatisasi Rekening Koran BCA ➔ GL' : 'Pencatatan Kas Kecil (Operasional Tante Yanti)'}
            </h3>
            <p className="text-xs text-slate-500">
              Auto-generate No Ref (BCA/KB/KK), auto-klasifikasi kode GL & rincian pecahan kas komisi persis format Excel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium bg-slate-50 text-slate-700"
          >
            {[2024, 2025, 2026, 2027].map(yr => (
              <option key={yr} value={yr}>Tahun Buku {yr}</option>
            ))}
          </select>

          <Button
            variant="outlined"
            size="small"
            onClick={() => setOpenPasteDialog(true)}
            startIcon={<Clipboard size={15} />}
            sx={{
              borderColor: '#cbd5e1',
              color: '#334155',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '12px',
              borderRadius: '10px',
              padding: '6px 12px',
              '&:hover': { backgroundColor: '#f1f5f9' }
            }}
          >
            Paste Teks Mutasi
          </Button>

          <Button
            variant="contained"
            size="small"
            onClick={() => fileInputRef.current?.click()}
            startIcon={<UploadCloud size={16} />}
            disabled={isParsing}
            sx={{
              backgroundColor: '#0f172a',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '12px',
              borderRadius: '10px',
              padding: '6px 14px',
              '&:hover': { backgroundColor: '#1e293b' }
            }}
          >
            {isParsing ? 'Membaca PDF/Excel...' : 'Upload RK BCA / Excel'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv, .pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {statusMsg && (
        <div className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
          statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Manual Input Quick Bar */}
      <div className="mt-5 p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
        <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <Plus size={14} className="text-blue-600" /> Input Cepat 1 Transaksi
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <input
            type="date"
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-mono"
          />
          <input
            type="text"
            placeholder="Keterangan transaksi..."
            value={manualDesc}
            onChange={(e) => setManualDesc(e.target.value)}
            className="sm:col-span-2 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
          />
          <select
            value={manualType}
            onChange={(e) => setManualType(e.target.value as any)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white font-medium"
          >
            <option value="CR">Penerimaan (CR / Debet)</option>
            <option value="DB">Pengeluaran (DB / Kredit)</option>
          </select>
          <input
            type="number"
            placeholder="Nominal (Rp)"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-mono"
          />
          <div className="flex gap-1.5">
            <select
              value={manualGL}
              onChange={(e) => setManualGL(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white flex-1 font-medium"
            >
              {Object.values(GL_ACCOUNTS).map(acc => (
                <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
              ))}
            </select>
            <button
              onClick={handleAddManualRow}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
            >
              Tambah
            </button>
          </div>
        </div>
      </div>

      {/* Preview Table if rows parsed */}
      {previewRows.length > 0 && (
        <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              <span className="text-xs font-bold">Preview Mutasi Terdeteksi ({previewRows.length} transaksi)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewRows([])}
                className="text-xs text-slate-300 hover:text-white px-2 py-1 rounded"
              >
                Batal
              </button>
              <button
                onClick={() => setOpenConfirmDialog(true)}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} /> Auto-Input ke GL & Buku Kas
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 w-12">#</th>
                  <th className="p-2.5 w-28">Tanggal</th>
                  <th className="p-2.5">Keterangan Transaksi</th>
                  <th className="p-2.5 w-24">Tipe</th>
                  <th className="p-2.5 w-32 text-right">Nominal</th>
                  <th className="p-2.5 w-56">Kode GL & Unit</th>
                  <th className="p-2.5 w-28 text-center">Jabarkan (Top Up)</th>
                  <th className="p-2.5 w-12 text-center">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((row, idx) => (
                  <React.Fragment key={idx}>
                    <tr className="hover:bg-slate-50/80">
                      <td className="p-2.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-2.5 font-mono text-slate-700 font-medium">{row.date}</td>
                      <td className="p-2.5 font-medium text-slate-800">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => handleUpdateRowDesc(idx, e.target.value)}
                          className="w-full border-b border-transparent hover:border-slate-300 focus:border-blue-500 bg-transparent px-1 py-0.5"
                        />
                        {row.notes && <div className="text-[10px] text-blue-600 font-semibold px-1">{row.notes}</div>}
                      </td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.mutasiType === 'CR' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {row.mutasiType === 'CR' ? 'Kredit (CR)' : 'Debet (DB)'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        Rp {row.amount.toLocaleString('id-ID')}
                      </td>
                      <td className="p-2.5">
                        <select
                          value={row.autoGLCode || '6001'}
                          onChange={(e) => handleUpdateRowGL(idx, e.target.value)}
                          className="text-xs border border-slate-200 rounded px-2 py-1 w-full bg-white font-medium text-slate-800"
                        >
                          {Object.values(GL_ACCOUNTS).map(acc => (
                            <option key={acc.code} value={acc.code}>
                              {acc.code} - {acc.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => handleToggleBreakdown(idx)}
                          className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                            row.isTopUpBreakdown
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {row.isTopUpBreakdown ? 'Tutup Rincian' : '+ Rincian'}
                        </button>
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => handleDeletePreviewRow(idx)}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Top Up Breakdown Form (Image 3 format) */}
                    {row.isTopUpBreakdown && row.breakdownItems && (
                      <tr className="bg-amber-50/50">
                        <td colSpan={8} className="p-3 pl-12 border-l-4 border-amber-400">
                          <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                            <span>Rincian Pengeluaran Kas Unit (Total mutasi bank: Rp {row.amount.toLocaleString('id-ID')}):</span>
                            <button
                              onClick={() => handleAddBreakdownItem(idx)}
                              className="text-[11px] text-blue-600 font-bold hover:underline"
                            >
                              + Tambah Unit Lain
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {row.breakdownItems.map((item, bIdx) => (
                              <div key={bIdx} className="grid grid-cols-12 gap-2 items-center text-xs">
                                <select
                                  value={item.glCode}
                                  onChange={(e) => handleUpdateBreakdownItem(idx, bIdx, 'glCode', e.target.value)}
                                  className="col-span-2 border border-slate-200 rounded px-2 py-1 bg-white font-mono font-bold"
                                >
                                  {['U', 'ABI', 'WBI', 'RBI', 'VSS', 'DK', 'KPS', 'KPP', 'OTA'].map(u => (
                                    <option key={u} value={u}>{u} - {GL_ACCOUNTS[u]?.name || u}</option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => handleUpdateBreakdownItem(idx, bIdx, 'description', e.target.value)}
                                  placeholder="Keterangan rincian (e.g. Top Up KK ABI)"
                                  className="col-span-6 border border-slate-200 rounded px-2 py-1 bg-white"
                                />
                                <div className="col-span-4 flex items-center gap-1.5">
                                  <span className="text-slate-400">Rp</span>
                                  <input
                                    type="number"
                                    value={item.amount || ''}
                                    onChange={(e) => handleUpdateBreakdownItem(idx, bIdx, 'amount', parseFloat(e.target.value) || 0)}
                                    placeholder="Nominal"
                                    className="w-full border border-slate-200 rounded px-2 py-1 bg-white font-mono font-semibold"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={openConfirmDialog} onClose={() => setOpenConfirmDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle className="font-bold text-slate-900">
          Konfirmasi Auto-Input ke GL & Kas
        </DialogTitle>
        <DialogContent>
          <p className="text-sm text-slate-600 mb-3">
            Sistem akan otomatis memasukkan <strong>{previewRows.length} transaksi</strong> ke dalam Buku Kas & GL:
          </p>
          <ul className="text-xs space-y-1.5 list-disc list-inside text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <li><strong>Auto-No Ref berurutan:</strong> BCA260xxx, KB260xxx, KK260xxx.</li>
            <li><strong>Auto-Format Excel:</strong> Rincian kolom terpisah persis seperti file Excel kas gereja.</li>
            <li><strong>Auto-Pecah ke Komisi:</strong> Otomatis masuk ke buku kas KABI, PRBI, WBI, KOMPAS, Vessel, Diakonia, Pembangunan, OTA.</li>
          </ul>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenConfirmDialog(false)} disabled={isSubmitting} sx={{ textTransform: 'none' }}>
            Batal
          </Button>
          <Button
            onClick={handleCommitToJournal}
            variant="contained"
            disabled={isSubmitting}
            sx={{
              backgroundColor: '#059669',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { backgroundColor: '#047857' }
            }}
          >
            {isSubmitting ? 'Memproses...' : 'Ya, Simpan ke GL Sekarang'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Paste Text Mutasi Modal */}
      <Dialog open={openPasteDialog} onClose={() => setOpenPasteDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle className="font-bold text-slate-900 flex items-center gap-2">
          <Clipboard size={18} className="text-blue-600" />
          Paste Teks Rekening Koran BCA
        </DialogTitle>
        <DialogContent>
          <p className="text-xs text-slate-500 mb-2">
            Anda dapat mem-blok dan copy teks langsung dari mutasi internet banking BCA (KlikBCA) atau dari PDF BCA, lalu paste di bawah ini:
          </p>
          <textarea
            rows={10}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Contoh:&#10;01/09 TRSF E-BANKING CR 5,295,700.00&#10;01/09 TRSF E-BANKING DB 29,080,050.00 DB Top Up KK Ags 2026..."
            className="w-full font-mono text-xs p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenPasteDialog(false)} sx={{ textTransform: 'none' }}>
            Batal
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!pastedText.trim()) return;
              const parsed = parseBcaStatementText(pastedText, selectedYear);
              if (parsed.length > 0) {
                setPreviewRows(parsed);
                setStatusMsg({ type: 'success', text: `Berhasil mengekstrak ${parsed.length} transaksi dari teks!` });
                setOpenPasteDialog(false);
                setPastedText('');
              } else {
                alert('Tidak dapat mendeteksi baris mutasi tanggal & nominal. Pastikan format teks memuat tanggal (DD/MM) dan nominal angka.');
              }
            }}
            sx={{
              backgroundColor: '#0f172a',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { backgroundColor: '#1e293b' }
            }}
          >
            Proses Teks Mutasi
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
