import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Coins, Plus, Save, Download, Upload, Trash2, Edit2, Check, X,
  ArrowDownCircle, ArrowUpCircle, RefreshCw, CheckCircle2, AlertCircle, Send, Layers
} from 'lucide-react';
import {
  KasBankItem,
  INITIAL_GL_ACCOUNTS,
  GLAccount,
  formatRupiah
} from './financeUtils';
import { parseBcaPdfText } from './pdfParser';
import { EdgeKV as supabaseAdmin } from '../../../../lib/edgeKvClient';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

const KV = 'kv_store_561004a0';
const STORAGE_KEY_PC = 'gbi_petty_cash_items_2026';
const DB_KEY_PC = 'finance:petty_cash_items_2026';
const STORAGE_KEY_KB = 'gbi_kas_bank_items_2026_v3';
const DB_KEY_KB = 'finance:kas_bank_items_2026_v3';
const STORAGE_KEY_KK = 'gbi_kas_kecil_items_2026';
const DB_KEY_KK = 'finance:kas_kecil_items_2026';
const STORAGE_KEY_GLS = 'gbi_kas_bank_gl_accounts_2026';

export interface PettyCashItem {
  id: string;
  tanggal: string;
  no: string;
  ref: string;
  keterangan: string;
  tipe: 'Debet' | 'Kredit';
  nominal: number;
  syncedToKasBank?: boolean;
  syncedToKasKecil?: boolean;
}

const BULAN_INDO: Record<string, string> = {
  '01': 'Januari', '02': 'Februari', '03': 'Maret', '04': 'April',
  '05': 'Mei', '06': 'Juni', '07': 'Juli', '08': 'Agustus',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember'
};

function formatTglIndo(iso: string): string {
  if (!iso) return '-';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function PettyCashModule() {
  const [items, setItems] = useState<PettyCashItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PC);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [glAccounts] = useState<Record<string, GLAccount>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GLS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_GL_ACCOUNTS;
  });

  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    String(new Date().getMonth() + 1).padStart(2, '0')
  );

  // Quick Input Form State
  const [formTgl, setFormTgl] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formNo, setFormNo] = useState<string>('');
  const [formRef, setFormRef] = useState<string>('1001');
  const [formKet, setFormKet] = useState<string>('');
  const [formTipe, setFormTipe] = useState<'Debet' | 'Kredit'>('Kredit');
  const [formNominal, setFormNominal] = useState<string>('');
  const [syncKasBankFlag, setSyncKasBankFlag] = useState<boolean>(false);
  const [syncKasKecilFlag, setSyncKasKecilFlag] = useState<boolean>(false);

  // Top Up Modal State (default 30.000.000 dari Kas Bank)
  const [showTopUpModal, setShowTopUpModal] = useState<boolean>(false);
  const [topUpNominal, setTopUpNominal] = useState<string>('30000000');
  const [topUpTgl, setTopUpTgl] = useState<string>(new Date().toISOString().split('T')[0]);
  const [topUpKet, setTopUpKet] = useState<string>('Top Up Umum Petty Cash dari Kas Bank');
  const [topUpRef, setTopUpRef] = useState<string>('1001');

  // Inline Edit & Bulk Edit All State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<PettyCashItem>>({});
  const [isBulkEdit, setIsBulkEdit] = useState<boolean>(false);
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, Partial<PettyCashItem>>>({});
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBulkUpdateField = (id: string, field: keyof PettyCashItem, value: any) => {
    setBulkDrafts(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value }
    }));
  };

  const toggleBulkEditPettyCash = () => {
    if (!isBulkEdit) {
      const drafts: Record<string, Partial<PettyCashItem>> = {};
      items.forEach(it => { drafts[it.id] = { ...it }; });
      setBulkDrafts(drafts);
      setEditingId(null);
      setIsBulkEdit(true);
    } else {
      const next = items.map(it => {
        const d = bulkDrafts[it.id];
        if (!d) return it;
        return {
          ...it,
          ...d,
          nominal: Math.round((Number(d.nominal ?? it.nominal) || 0) * 100) / 100
        } as PettyCashItem;
      });
      updateItems(next);
      setIsBulkEdit(false);
      setFeedback({ type: 'success', text: 'Semua perubahan Petty Cash berhasil disimpan ke Database!' });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Import PDF (BCA/Rekening) or Excel/CSV into Petty Cash
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const ext = file.name.toLowerCase().split('.').pop() || '';
      const imported: PettyCashItem[] = [];

      if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const lines: string[] = [];
          let lastY: number | null = null;
          let cur = '';
          for (const item of content.items as any[]) {
            const y = Math.round(item.transform?.[5] ?? 0);
            if (lastY !== null && Math.abs(y - lastY) > 4) {
              lines.push(cur.trim());
              cur = item.str;
            } else {
              cur += (cur ? ' ' : '') + item.str;
            }
            lastY = y;
          }
          if (cur.trim()) lines.push(cur.trim());
          fullText += lines.join('\n') + '\n';
        }

        // Dedicated parser for Arus Kas Kecil / Petty Cash PDF format:
        // [Tanggal?] [No?] [Reff?] [Keterangan] [Nominal] [Saldo]
        const parseMoney = (s: string) => {
          const cleaned = s.replace(/,/g, '').trim();
          const n = parseFloat(cleaned);
          return isNaN(n) ? 0 : Math.round(n * 100) / 100;
        };

        const rawLines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        let currentDate = `${selectedYear}-${selectedMonth === 'ALL' ? '01' : selectedMonth}-01`;
        let lastNo = '';
        let prevSaldo: number | null = null;

        for (let idx = 0; idx < rawLines.length; idx++) {
          let line = rawLines[idx];

          // Skip headers / titles
          if (/^(Arus Kas Kecil|Ibadah Raya|Per \d+|Tanggal\s+No)/i.test(line)) continue;

          // Opening balance line: e.g. "31 DES Saldo 30,000,000.00"
          const openMatch = line.match(/Saldo\s+([\d,]+\.\d{2})$/i);
          if (openMatch && !/(KK|KB|PC)\d{4,}/i.test(line)) {
            const openSaldo = parseMoney(openMatch[1]);
            if (openSaldo > 0) {
              prevSaldo = openSaldo;
              imported.push({
                id: `pc-pdf-open-${Date.now()}-${idx}`,
                tanggal: `${selectedYear}-${selectedMonth === 'ALL' ? '01' : selectedMonth}-01`,
                no: 'SALDO',
                ref: '1001',
                keterangan: 'Saldo Awal Petty Cash',
                tipe: 'Debet',
                nominal: openSaldo
              });
            }
            continue;
          }

          // Transaction line ends with TWO amounts: [nominal] [saldo]
          const twoNums = line.match(/([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/);
          if (!twoNums) continue;

          const nom = parseMoney(twoNums[1]);
          const saldo = parseMoney(twoNums[2]);
          if (nom <= 0) continue;

          // Determine Debet vs Kredit mathematically from prevSaldo
          let tipe: 'Debet' | 'Kredit' = 'Kredit';
          if (prevSaldo !== null) {
            if (Math.abs((prevSaldo + nom) - saldo) < 1) {
              tipe = 'Debet';
            } else if (Math.abs((prevSaldo - nom) - saldo) < 1) {
              tipe = 'Kredit';
            } else {
              tipe = saldo > prevSaldo ? 'Debet' : 'Kredit';
            }
          } else if (/top\s*up/i.test(line)) {
            tipe = 'Debet';
          }
          prevSaldo = saldo;

          // Strip trailing amounts
          let rest = line.slice(0, twoNums.index).trim();

          // Optional leading date DD/MM/YYYY
          const dateMatch = rest.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+/);
          if (dateMatch) {
            currentDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
            rest = rest.slice(dateMatch[0].length).trim();
          }

          // Optional doc No (KK260001, KB260023, PC260001, etc.)
          let docNo = lastNo;
          const noMatch = rest.match(/^([A-Z]{2,3}\d{4,})\s+/);
          if (noMatch) {
            docNo = noMatch[1];
            lastNo = docNo;
            rest = rest.slice(noMatch[0].length).trim();
          }

          // Optional Reff code (DK, OTA, KPP, 6001, 2001, 2002, 3002, etc.)
          let refCode = '1001';
          const refMatch = rest.match(/^(\d{4}|DK|OTA|KPP|WBI|SM|TEENS|YOUTH)\s+/i);
          if (refMatch) {
            refCode = refMatch[1].toUpperCase();
            rest = rest.slice(refMatch[0].length).trim();
          }

          imported.push({
            id: `pc-pdf-${Date.now()}-${idx}`,
            tanggal: currentDate,
            no: docNo || `PC${selectedYear.slice(-2)}${String(items.length + imported.length + 1).padStart(4, '0')}`,
            ref: refCode,
            keterangan: rest || 'Transaksi Petty Cash',
            tipe,
            nominal: nom
          });
        }
      } else {
        // CSV / TSV / Excel-saved CSV
        const text = await file.text();
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        lines.forEach((line, idx) => {
          if (idx === 0 && /tgl|tanggal|ket|debet|kredit/i.test(line)) return;
          const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)|;/).map(c => c.replace(/^"|"$/g, '').trim());
          if (cols.length < 4) return;
          const parseNum = (s: string) => {
            if (!s) return 0;
            const cleaned = s.replace(/Rp|\s/gi, '').replace(/\./g, '').replace(',', '.');
            const n = parseFloat(cleaned);
            return isNaN(n) ? 0 : Math.round(n * 100) / 100;
          };
          const rawDate = cols[0];
          let isoDate = new Date().toISOString().split('T')[0];
          if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) isoDate = rawDate;
          else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
            const [d, m, y] = rawDate.split('/');
            isoDate = `${y}-${m}-${d}`;
          }
          const deb = parseNum(cols[4] || '');
          const kre = parseNum(cols[5] || '');
          const nom = deb > 0 ? deb : kre;
          if (nom <= 0) return;
          imported.push({
            id: `pc-csv-${Date.now()}-${idx}`,
            tanggal: isoDate,
            no: cols[1] || `PC${selectedYear.slice(-2)}${String(items.length + idx + 1).padStart(4, '0')}`,
            ref: cols[2] || '1001',
            keterangan: cols[3] || 'Transaksi Import',
            tipe: deb > 0 ? 'Debet' : 'Kredit',
            nominal: nom
          });
        });
      }

      if (imported.length === 0) {
        setFeedback({ type: 'error', text: 'Tidak ada baris transaksi valid yang ditemukan di file tersebut.' });
      } else {
        updateItems([...items, ...imported]);
        setFeedback({ type: 'success', text: `Berhasil import ${imported.length} baris transaksi dari ${file.name}! Klik "Simpan Data" untuk simpan ke database.` });
      }
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({ type: 'error', text: `Gagal import file: ${err?.message || 'Format tidak didukung'}` });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // DB Save & Feedback
  const [isSavingDb, setIsSavingDb] = useState<boolean>(false);
  const [lastSavedDb, setLastSavedDb] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedPeriod = selectedMonth === 'ALL' ? 'ALL' : `${selectedYear}-${selectedMonth}`;

  // Load from Supabase KV on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabaseAdmin.from(KV).select('value').eq('key', DB_KEY_PC).maybeSingle();
        if (data?.value && Array.isArray(data.value) && data.value.length > 0) {
          setItems(data.value);
          try { localStorage.setItem(STORAGE_KEY_PC, JSON.stringify(data.value)); } catch {}
        }
      } catch (err) {
        console.warn('Gagal memuat Petty Cash dari database:', err);
      }
    })();
  }, []);

  // Persist locally & to Supabase DB on change
  const updateItems = (next: PettyCashItem[]) => {
    const sorted = [...next].sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));
    setItems(sorted);
    try { localStorage.setItem(STORAGE_KEY_PC, JSON.stringify(sorted)); } catch {}
    supabaseAdmin.from(KV).upsert({ key: DB_KEY_PC, value: sorted }, { onConflict: 'key' }).catch(() => {});
  };

  // Helper: push entry to Kas Bank & General Ledger
  const pushToKasBankAndGL = async (entry: {
    tanggal: string;
    noBank: string;
    reff: string;
    keterangan: string;
    tipe: 'Debet' | 'Kredit';
    nominal: number;
  }) => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_KB);
      const kbItems: KasBankItem[] = saved ? JSON.parse(saved) : [];
      const newKb: KasBankItem = {
        id: `pc-sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tanggal: entry.tanggal,
        noBank: entry.noBank,
        reff: entry.reff,
        keterangan: entry.keterangan,
        tipe: entry.tipe,
        nominal: entry.nominal,
        debet: entry.tipe === 'Debet' ? entry.nominal : 0,
        kredit: entry.tipe === 'Kredit' ? entry.nominal : 0,
        saldoBerjalan: 0,
        note: 'Auto-sync dari Petty Cash'
      };
      const nextKb = [...kbItems, newKb];
      localStorage.setItem(STORAGE_KEY_KB, JSON.stringify(nextKb));
      window.dispatchEvent(new Event('kasbank-updated'));
      await supabaseAdmin.from(KV).upsert({ key: DB_KEY_KB, value: nextKb }, { onConflict: 'key' });
    } catch (e) {
      console.warn('Sync ke Kas Bank gagal:', e);
    }
  };

  // Helper: push entry to Kas Kecil (Tante Yanti)
  const pushToKasKecil = async (entry: {
    tanggal: string;
    no: string;
    ref: string;
    keterangan: string;
    nominal: number;
  }) => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_KK);
      const kkItems: any[] = saved ? JSON.parse(saved) : [];
      const newKk = {
        id: `pc-kk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tanggal: entry.tanggal,
        no: entry.no,
        ref: entry.ref,
        keterangan: entry.keterangan,
        tipe: 'Debet',
        nominal: entry.nominal,
        source: 'Petty Cash'
      };
      const nextKk = [...kkItems, newKk];
      localStorage.setItem(STORAGE_KEY_KK, JSON.stringify(nextKk));
      window.dispatchEvent(new Event('kaskecil-updated'));
      await supabaseAdmin.from(KV).upsert({ key: DB_KEY_KK, value: nextKk }, { onConflict: 'key' });
    } catch (e) {
      console.warn('Sync ke Kas Kecil gagal:', e);
    }
  };

  // Auto-generate next No (PC260001...)
  const nextAutoNo = useMemo(() => {
    const yy = selectedYear.slice(-2);
    const num = String(items.length + 1).padStart(4, '0');
    return `PC${yy}${num}`;
  }, [items.length, selectedYear]);

  // Filter & calculate running balance in exact integer cents
  const { rowsWithSaldo, totalDebet, totalKredit, saldoAkhir } = useMemo(() => {
    const filtered = items.filter(it => {
      if (selectedMonth === 'ALL') return (it.tanggal || '').startsWith(selectedYear);
      return (it.tanggal || '').startsWith(selectedPeriod);
    });

    let runningCents = 0;
    let debCents = 0;
    let kreCents = 0;

    const mapped = filtered.map(it => {
      const nomCents = Math.round((Number(it.nominal) || 0) * 100);
      const isDeb = it.tipe === 'Debet';
      if (isDeb) {
        debCents += nomCents;
        runningCents += nomCents;
      } else {
        kreCents += nomCents;
        runningCents -= nomCents;
      }
      return {
        ...it,
        debetVal: isDeb ? nomCents / 100 : 0,
        kreditVal: !isDeb ? nomCents / 100 : 0,
        saldoBerjalan: runningCents / 100
      };
    });

    return {
      rowsWithSaldo: mapped,
      totalDebet: debCents / 100,
      totalKredit: kreCents / 100,
      saldoAkhir: runningCents / 100
    };
  }, [items, selectedYear, selectedMonth, selectedPeriod]);

  // Add Top Up Umum (default 30.000.000 dari Kas Bank)
  const handleTopUpFromKasBank = async (e: React.FormEvent) => {
    e.preventDefault();
    const nom = parseFloat(topUpNominal);
    if (isNaN(nom) || nom <= 0) return;

    const noDoc = nextAutoNo;
    const newItem: PettyCashItem = {
      id: `pc-topup-${Date.now()}`,
      tanggal: topUpTgl,
      no: noDoc,
      ref: topUpRef || '1001',
      keterangan: topUpKet || 'Top Up Umum Petty Cash dari Kas Bank',
      tipe: 'Debet',
      nominal: Math.round(nom * 100) / 100,
      syncedToKasBank: true
    };

    const next = [...items, newItem];
    updateItems(next);

    // Sync to Kas Bank & GL as Kredit (keluar dari Kas Bank)
    await pushToKasBankAndGL({
      tanggal: topUpTgl,
      noBank: noDoc,
      reff: topUpRef || '1001',
      keterangan: `[Top Up Petty Cash] ${topUpKet}`,
      tipe: 'Kredit',
      nominal: newItem.nominal
    });

    setShowTopUpModal(false);
    setFeedback({
      type: 'success',
      text: `Top Up ${formatRupiah(newItem.nominal)} masuk ke Petty Cash & otomatis tercatat sebagai Kredit di Kas Bank & General Ledger!`
    });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Add manual Petty Cash row
  const handleAddRow = async (e: React.FormEvent) => {
    e.preventDefault();
    const nom = parseFloat(formNominal);
    if (!formKet.trim() || isNaN(nom) || nom <= 0) return;

    const noDoc = formNo.trim() || nextAutoNo;
    const newItem: PettyCashItem = {
      id: `pc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      tanggal: formTgl,
      no: noDoc,
      ref: formRef.trim() || '1001',
      keterangan: formKet.trim(),
      tipe: formTipe,
      nominal: Math.round(nom * 100) / 100,
      syncedToKasBank: syncKasBankFlag,
      syncedToKasKecil: syncKasKecilFlag
    };

    updateItems([...items, newItem]);

    if (syncKasBankFlag) {
      await pushToKasBankAndGL({
        tanggal: newItem.tanggal,
        noBank: newItem.no,
        reff: newItem.ref,
        keterangan: `[Petty Cash] ${newItem.keterangan}`,
        tipe: newItem.tipe,
        nominal: newItem.nominal
      });
    }

    if (syncKasKecilFlag) {
      await pushToKasKecil({
        tanggal: newItem.tanggal,
        no: newItem.no,
        ref: newItem.ref,
        keterangan: `[Top Up dari Petty Cash] ${newItem.keterangan}`,
        nominal: newItem.nominal
      });
    }

    setFormNo('');
    setFormKet('');
    setFormNominal('');
    setSyncKasBankFlag(false);
    setSyncKasKecilFlag(false);
    setFeedback({
      type: 'success',
      text: `Baris "${newItem.keterangan}" berhasil ditambahkan${syncKasKecilFlag ? ' & disinkronkan ke Kas Kecil (Tante Yanti)' : ''}${syncKasBankFlag ? ' & disinkronkan ke Kas Bank / GL' : ''}!`
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Save to Database
  const handleSaveToDatabase = async () => {
    setIsSavingDb(true);
    try {
      localStorage.setItem(STORAGE_KEY_PC, JSON.stringify(items));
      await supabaseAdmin.from(KV).upsert({ key: DB_KEY_PC, value: items }, { onConflict: 'key' });
      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastSavedDb(nowStr);
      setFeedback({ type: 'success', text: `Data Petty Cash (${items.length} baris) berhasil disimpan ke Database (${nowStr})!` });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({ type: 'error', text: `Gagal menyimpan ke database: ${err?.message || 'Terjadi kesalahan'}` });
    } finally {
      setIsSavingDb(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const lines = [
      'Tgl,No,Ref,Keterangan,Debet,Kredit,Saldo',
      ...rowsWithSaldo.map(r =>
        `${formatTglIndo(r.tanggal)},"${r.no}","${r.ref}","${r.keterangan.replace(/"/g, '""')}",${r.debetVal},${r.kreditVal},${r.saldoBerjalan}`
      ),
      `TOTAL,,,,${totalDebet},${totalKredit},${saldoAkhir}`
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Petty_Cash_${selectedPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const glList = Object.values(glAccounts);

  return (
    <div className="space-y-4">
      {/* ── Header Card ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Coins size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Petty Cash (Sinkron Kas Bank, GL &amp; Kas Kecil)
              </h2>
              <p className="text-[11px] text-slate-500">
                Top Up Umum dari Kas Bank (default Rp 30.000.000/bln) &amp; distribusi ke Kas Kecil Tante Yanti
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf,.csv,.txt"
              className="hidden"
              onChange={handleFileImport}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Upload size={13} />
              {isImporting ? 'Mengimpor...' : 'Import PDF / CSV'}
            </button>
            <button
              type="button"
              onClick={toggleBulkEditPettyCash}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer ${
                isBulkEdit
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
              }`}
            >
              <Edit2 size={13} />
              {isBulkEdit ? '✓ Simpan & Selesai Edit' : 'Edit Semua'}
            </button>
            <button
              type="button"
              onClick={() => setShowTopUpModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <ArrowDownCircle size={13} />
              + Top Up dari Kas Bank
            </button>
            <button
              type="button"
              onClick={handleSaveToDatabase}
              disabled={isSavingDb}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save size={13} />
              {isSavingDb ? 'Menyimpan...' : lastSavedDb ? `Simpan Data (${lastSavedDb})` : 'Simpan Data'}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download size={13} />
              Export Excel
            </button>
          </div>
        </div>

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

        {/* Period Filter + KPI */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50/60 items-end">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bulan</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl"
            >
              <option value="ALL">Semua Bulan</option>
              {Object.entries(BULAN_INDO).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tahun</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl"
            >
              {['2026', '2025', '2027'].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <div className="text-[10px] font-bold text-emerald-700 uppercase">Total Debet</div>
            <div className="text-xs sm:text-sm font-mono font-black text-emerald-800 truncate">{formatRupiah(totalDebet)}</div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            <div className="text-[10px] font-bold text-rose-700 uppercase">Total Kredit</div>
            <div className="text-xs sm:text-sm font-mono font-black text-rose-800 truncate">{formatRupiah(totalKredit)}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 col-span-2 sm:col-span-1">
            <div className="text-[10px] font-bold text-blue-700 uppercase">Saldo Petty Cash</div>
            <div className="text-xs sm:text-sm font-mono font-black text-blue-900 truncate">{formatRupiah(saldoAkhir)}</div>
          </div>
        </div>
      </div>

      {/* ── Quick Input Form (Input Sendiri) ── */}
      <form onSubmit={handleAddRow} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Plus size={14} className="text-blue-600" />
          Input Transaksi Petty Cash
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Tanggal</label>
            <input
              type="date"
              value={formTgl}
              onChange={e => setFormTgl(e.target.value)}
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-white"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">No</label>
            <input
              type="text"
              placeholder={nextAutoNo}
              value={formNo}
              onChange={e => setFormNo(e.target.value)}
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-white font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Ref / Kode GL</label>
            <input
              list="pc-gl-options"
              value={formRef}
              onChange={e => setFormRef(e.target.value)}
              placeholder="1001 / custom..."
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-white font-mono"
            />
            <datalist id="pc-gl-options">
              {glList.map(g => (
                <option key={g.code} value={g.code}>{g.code} - {g.name}</option>
              ))}
            </datalist>
          </div>
          <div className="lg:col-span-1">
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Tipe</label>
            <select
              value={formTipe}
              onChange={e => setFormTipe(e.target.value as any)}
              className={`w-full px-2.5 py-2 text-xs font-bold border rounded-xl ${
                formTipe === 'Debet'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              <option value="Debet">Debet (+)</option>
              <option value="Kredit">Kredit (-)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Nominal (Rp)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0"
              value={formNominal}
              onChange={e => setFormNominal(e.target.value)}
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-white font-mono text-right"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Keterangan</label>
            <input
              type="text"
              placeholder="Contoh: Top Up Kas Kecil Tante Yanti"
              value={formKet}
              onChange={e => setFormKet(e.target.value)}
              className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-white"
              required
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-indigo-700">
              <input
                type="checkbox"
                checked={syncKasBankFlag}
                onChange={e => setSyncKasBankFlag(e.target.checked)}
                className="rounded accent-indigo-600"
              />
              Sync ke Kas Bank &amp; GL
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-amber-700">
              <input
                type="checkbox"
                checked={syncKasKecilFlag}
                onChange={e => setSyncKasKecilFlag(e.target.checked)}
                className="rounded accent-amber-600"
              />
              Sync ke Kas Kecil (Tante Yanti)
            </label>
          </div>

          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={14} />
            Tambah Baris
          </button>
        </div>
      </form>

      {/* ── Table: Tgl | No | Ref | Ket | Debet | Kredit | Saldo ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 text-left w-24">Tgl</th>
                <th className="py-3 px-3 text-left w-24">No</th>
                <th className="py-3 px-3 text-left w-20">Ref</th>
                <th className="py-3 px-3 text-left">Keterangan</th>
                <th className="py-3 px-3 text-right w-32">Debet</th>
                <th className="py-3 px-3 text-right w-32">Kredit</th>
                <th className="py-3 px-3 text-right w-36">Saldo</th>
                <th className="py-3 px-3 text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rowsWithSaldo.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    Belum ada transaksi Petty Cash pada periode ini. Klik <b>"+ Top Up dari Kas Bank"</b> atau input manual di atas.
                  </td>
                </tr>
              ) : (
                rowsWithSaldo.map(row => {
                  const isEditing = isBulkEdit || editingId === row.id;
                  const bDraft = bulkDrafts[row.id] || row;
                  const valTgl = isBulkEdit ? (bDraft.tanggal ?? row.tanggal) : (editDraft.tanggal || '');
                  const valNo = isBulkEdit ? (bDraft.no ?? row.no) : (editDraft.no || '');
                  const valRef = isBulkEdit ? (bDraft.ref ?? row.ref) : (editDraft.ref || '');
                  const valKet = isBulkEdit ? (bDraft.keterangan ?? row.keterangan) : (editDraft.keterangan || '');
                  const valTipe = isBulkEdit ? (bDraft.tipe ?? row.tipe) : (editDraft.tipe || row.tipe);
                  const valNom = isBulkEdit ? (bDraft.nominal ?? row.nominal) : (editDraft.nominal ?? 0);
                  return (
                    <tr key={row.id} className={isBulkEdit ? 'bg-indigo-50/20' : 'hover:bg-slate-50/80'}>
                      <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="date"
                            value={valTgl}
                            onChange={e => isBulkEdit ? handleBulkUpdateField(row.id, 'tanggal', e.target.value) : setEditDraft(d => ({ ...d, tanggal: e.target.value }))}
                            className="px-1.5 py-1 border rounded text-xs w-28 bg-white"
                          />
                        ) : formatTglIndo(row.tanggal)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={valNo}
                            onChange={e => isBulkEdit ? handleBulkUpdateField(row.id, 'no', e.target.value) : setEditDraft(d => ({ ...d, no: e.target.value }))}
                            className="px-1.5 py-1 border rounded text-xs w-20 bg-white"
                          />
                        ) : row.no}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={valRef}
                            onChange={e => isBulkEdit ? handleBulkUpdateField(row.id, 'ref', e.target.value) : setEditDraft(d => ({ ...d, ref: e.target.value }))}
                            className="px-1.5 py-1 border rounded text-xs w-16 bg-white"
                          />
                        ) : row.ref}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">
                        {isEditing ? (
                          <input
                            type="text"
                            value={valKet}
                            onChange={e => isBulkEdit ? handleBulkUpdateField(row.id, 'keterangan', e.target.value) : setEditDraft(d => ({ ...d, keterangan: e.target.value }))}
                            className="px-1.5 py-1 border rounded text-xs w-full bg-white"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{row.keterangan}</span>
                            {row.syncedToKasBank && (
                              <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded font-bold">
                                Sync Kas Bank/GL
                              </span>
                            )}
                            {row.syncedToKasKecil && (
                              <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-bold">
                                Sync Kas Kecil
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap">
                        {isEditing && valTipe === 'Debet' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={valNom}
                            onChange={e => isBulkEdit ? handleBulkUpdateField(row.id, 'nominal', parseFloat(e.target.value) || 0) : setEditDraft(d => ({ ...d, nominal: parseFloat(e.target.value) || 0 }))}
                            className="px-1.5 py-1 border rounded text-xs w-28 text-right bg-white"
                          />
                        ) : row.debetVal > 0 ? formatRupiah(row.debetVal) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-700 whitespace-nowrap">
                        {isEditing && valTipe === 'Kredit' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={valNom}
                            onChange={e => isBulkEdit ? handleBulkUpdateField(row.id, 'nominal', parseFloat(e.target.value) || 0) : setEditDraft(d => ({ ...d, nominal: parseFloat(e.target.value) || 0 }))}
                            className="px-1.5 py-1 border rounded text-xs w-28 text-right bg-white"
                          />
                        ) : row.kreditVal > 0 ? formatRupiah(row.kreditVal) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                        {formatRupiah(row.saldoBerjalan)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                updateItems(items.map(it => it.id === row.id ? { ...it, ...editDraft } as PettyCashItem : it));
                                setEditingId(null);
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1 text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => { setEditingId(row.id); setEditDraft(row); }}
                              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Hapus transaksi "${row.keterangan}"?`)) {
                                  updateItems(items.filter(it => it.id !== row.id));
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-black">
              <tr>
                <td colSpan={4} className="py-3 px-3 text-right uppercase text-xs">
                  TOTAL PETTY CASH:
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-800 whitespace-nowrap">
                  {formatRupiah(totalDebet)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-rose-800 whitespace-nowrap">
                  {formatRupiah(totalKredit)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-blue-900 bg-amber-100 whitespace-nowrap">
                  {formatRupiah(saldoAkhir)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Top Up Umum Modal (Default 30.000.000 dari Kas Bank) ── */}
      {showTopUpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setShowTopUpModal(false)}
        >
          <form
            onSubmit={handleTopUpFromKasBank}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
          >
            <div className="px-5 py-4 bg-amber-500 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Top Up Umum dari Kas Bank</h3>
                <p className="text-[11px] text-amber-100">Otomatis sync ke Kas Bank &amp; General Ledger</p>
              </div>
              <button type="button" onClick={() => setShowTopUpModal(false)} className="p-1 hover:bg-white/20 rounded-lg cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Tanggal Top Up</label>
                <input
                  type="date"
                  value={topUpTgl}
                  onChange={e => setTopUpTgl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Nominal Top Up (Rp) — Default 30.000.000</label>
                <input
                  type="number"
                  step="0.01"
                  value={topUpNominal}
                  onChange={e => setTopUpNominal(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold text-right"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Kode GL / Ref</label>
                <input
                  type="text"
                  value={topUpRef}
                  onChange={e => setTopUpRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Keterangan</label>
                <input
                  type="text"
                  value={topUpKet}
                  onChange={e => setTopUpKet(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  required
                />
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTopUpModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Simpan &amp; Sync ke Kas Bank
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
