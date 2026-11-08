import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Sparkles, Building2, Wallet, Plus, Trash2 } from 'lucide-react';
import { GL_ACCOUNTS, BankStatementRow, CashJournalEntry, classifyTransaction } from '../../../lib/glDefinitions';
import { parseBcaStatementText, parseBcaCsvRows } from '../../../lib/bcaParser';

interface Props {
  sourceType: 'bank' | 'petty_cash';
  existingEntries: CashJournalEntry[];
  canEdit: boolean;
  onImportComplete: (newEntries: CashJournalEntry[]) => Promise<void>;
}

export default function CashStatementImporter({ sourceType, existingEntries, canEdit, onImportComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [previewRows, setPreviewRows] = useState<BankStatementRow[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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
    
    // Find highest existing sequence for this prefix
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

    setFile(uploadedFile);
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
        }
      } else if (fileName.endsWith('.pdf')) {
        // Dynamic client-side reader or text fallback
        // Read as text if supported or inform user
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const rawText = reader.result as string;
            const parsed = parseBcaStatementText(rawText, selectedYear);
            if (parsed.length > 0) {
              setPreviewRows(parsed);
            } else {
              // Try parsing with pdf-parse on server or prompt text paste
              setStatusMsg({
                type: 'error',
                text: 'PDF BCA terenkripsi/berformat binary. Silakan simpan / copy text mutasi atau gunakan format Excel/CSV untuk hasil 100% akurat.'
              });
            }
          } catch (err: any) {
            setStatusMsg({ type: 'error', text: 'Gagal membaca PDF: ' + err.message });
          }
        };
        reader.readAsText(uploadedFile);
      } else {
        setStatusMsg({ type: 'error', text: 'Format file tidak didukung. Harap upload .xlsx, .xls, .csv, atau .pdf' });
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setStatusMsg({ type: 'error', text: 'Gagal memproses file: ' + err.message });
    } finally {
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

  // Process rows into formal CashJournalEntry records
  const handleCommitToJournal = async () => {
    if (previewRows.length === 0) return;
    setIsSubmitting(true);

    try {
      const convertedEntries: CashJournalEntry[] = [];
      const currentFullList = [...existingEntries];

      previewRows.forEach((row, i) => {
        // Reference code prefix
        let refPrefix: 'BCA' | 'KB' | 'KK' = 'BCA';
        if (sourceType === 'petty_cash') {
          refPrefix = 'KK';
        } else {
          refPrefix = row.mutasiType === 'DB' ? 'KB' : 'BCA';
        }

        const refNo = getNextRefSequence(refPrefix, selectedYear, currentFullList, i);
        const glAccount = GL_ACCOUNTS[row.autoGLCode || '6001'];
        const isTargetUnit = glAccount && glAccount.type === 'unit';

        const entry: CashJournalEntry = {
          id: `cj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          sourceType,
          date: row.date,
          noRef: refNo,
          glCode: row.autoGLCode || '6001',
          description: row.description,
          rincian: isTargetUnit ? `Pecahan ke ${glAccount.name}` : undefined,
          debet: row.mutasiType === 'CR' ? row.amount : 0,
          kredit: row.mutasiType === 'DB' ? row.amount : 0,
          targetUnit: isTargetUnit ? row.autoGLCode : undefined,
          isAutoClassified: true,
          createdAt: new Date().toISOString()
        };

        convertedEntries.push(entry);
        currentFullList.push(entry);
      });

      await onImportComplete(convertedEntries);
      setPreviewRows([]);
      setFile(null);
      setOpenConfirmDialog(false);
      setStatusMsg({ type: 'success', text: `Sukses menginput ${convertedEntries.length} transaksi ke Kas & GL!` });
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
              Auto-generate No Ref (BCA/KB/KK), auto-klasifikasi kode GL (1001, 1004, 2001, dll) & auto-split ke kas komisi
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
            variant="contained"
            size="small"
            onClick={() => fileInputRef.current?.click()}
            startIcon={<UploadCloud size={16} />}
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
            Upload RK BCA / Excel
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
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
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
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="CR">Penerimaan (CR / Masuk)</option>
            <option value="DB">Pengeluaran (DB / Keluar)</option>
          </select>
          <input
            type="number"
            placeholder="Nominal (Rp)"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
          />
          <div className="flex gap-1.5">
            <select
              value={manualGL}
              onChange={(e) => setManualGL(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white flex-1"
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
        <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              <span className="text-xs font-bold">Hasil Parsing Mutasi BCA ({previewRows.length} transaksi siap diproses)</span>
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
                  <th className="p-2.5">Keterangan BCA</th>
                  <th className="p-2.5 w-24">Tipe</th>
                  <th className="p-2.5 w-32 text-right">Nominal</th>
                  <th className="p-2.5 w-60">Auto-Kode GL & Unit</th>
                  <th className="p-2.5 w-12 text-center">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="p-2.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="p-2.5 font-mono text-slate-700 font-medium">{row.date}</td>
                    <td className="p-2.5 font-medium text-slate-800">
                      <div>{row.description}</div>
                      {row.notes && <div className="text-[10px] text-blue-600 font-semibold">{row.notes}</div>}
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
                        onClick={() => handleDeletePreviewRow(idx)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
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
            Sistem akan otomatis memasukkan <strong>{previewRows.length} transaksi</strong> ke dalam:
          </p>
          <ul className="text-xs space-y-1.5 list-disc list-inside text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <li><strong>Buku Kas Bank / Kas Kecil</strong> dengan No Referensi berurutan (BCA, KB, KK).</li>
            <li><strong>General Ledger (GL)</strong> terkelompok berdasarkan akun (1001, 1004, 2001, dll).</li>
            <li><strong>Kas Komisi & Unit Terkait</strong> (KABI, PRBI, WBI, KOMPAS, Vessel, Diakonia, Pembangunan, OTA) otomatis ter-update saldonya.</li>
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
    </div>
  );
}
