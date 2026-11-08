import React, { useState, useEffect } from 'react';
import { apiBase } from '../../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Alert } from '@mui/material';
import { Building2, Wallet, Layers, RefreshCw } from 'lucide-react';
import CashStatementImporter from './CashStatementImporter';
import GeneralLedgerViewer from './GeneralLedgerViewer';
import { CashJournalEntry } from '../../../lib/glDefinitions';

const API_URL = `${apiBase()}/api/content`;

export default function FinanceManagement() {
  const { accessToken, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'bca_kas' | 'kas_kecil' | 'gl'>('bca_kas');

  // GL & Cash Journal State
  const [journalEntries, setJournalEntries] = useState<CashJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Permissions
  const isSuperAdmin = user?.role === 'super_admin';
  const canEdit = isSuperAdmin || user?.permissions?.editKeuangan || false;

  useEffect(() => {
    loadJournalEntries();
  }, []);

  const loadJournalEntries = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/finance/journal`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.entries)) {
        setJournalEntries(data.entries);
      }
    } catch (err: any) {
      console.error('Load journal error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportJournalEntries = async (newEntries: CashJournalEntry[]) => {
    try {
      const res = await fetch(`${API_URL}/finance/journal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ entries: newEntries })
      });
      const data = await res.json();
      if (data.success) {
        setJournalEntries(prev => [...prev, ...newEntries]);
        setSuccessMsg(`Berhasil menginput ${newEntries.length} transaksi ke GL & Buku Kas!`);
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setError(data.error || 'Gagal menyimpan transaksi');
      }
    } catch (err: any) {
      console.error('Save journal entries error:', err);
      setError(err.message);
    }
  };

  const handleUpdateJournalEntry = async (updated: CashJournalEntry) => {
    if (!canEdit) return;
    try {
      const res = await fetch(`${API_URL}/finance/journal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ entry: updated })
      });
      const data = await res.json();
      if (data.success) {
        setJournalEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
        setSuccessMsg('Perubahan transaksi berhasil disimpan');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      console.error('Update journal error:', err);
      setError(err.message);
    }
  };

  const handleDeleteJournalEntry = async (id: string) => {
    if (!canEdit) return;
    if (!confirm('Yakin ingin menghapus transaksi jurnal ini?')) return;
    try {
      const res = await fetch(`${API_URL}/finance/journal/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setJournalEntries(prev => prev.filter(e => e.id !== id));
        setSuccessMsg('Transaksi berhasil dihapus');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      console.error('Delete journal error:', err);
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Top Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="text-blue-600" size={24} />
            Sistem Kas Bank & General Ledger (GL)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Otomatisasi Rekening Koran BCA & Kas Kecil (Tante Yanti) ke General Ledger & kas komisi gereja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshCw size={15} />}
            onClick={() => loadJournalEntries()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* 3 Main Focused Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('bca_kas')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'bca_kas'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Building2 size={16} />
          Kas Bank BCA (Auto-RK)
        </button>

        <button
          onClick={() => setActiveTab('kas_kecil')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'kas_kecil'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Wallet size={16} />
          Kas Kecil (Tante Yanti)
        </button>

        <button
          onClick={() => setActiveTab('gl')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'gl'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Layers size={16} />
          General Ledger & Kas Komisi
        </button>
      </div>

      {error && <Alert severity="error">{error}</Alert>}
      {successMsg && <Alert severity="success">{successMsg}</Alert>}

      {!canEdit && (
        <Alert severity="info">
          Anda hanya memiliki akses <strong>view-only</strong>. Hubungi Super Admin untuk mendapatkan akses edit.
        </Alert>
      )}

      {/* ── TAB 1: KAS BANK BCA (AUTO RK & IMPORT) ── */}
      {activeTab === 'bca_kas' && (
        <div className="space-y-6">
          <CashStatementImporter
            sourceType="bank"
            existingEntries={journalEntries}
            canEdit={canEdit}
            onImportComplete={handleImportJournalEntries}
          />
          <GeneralLedgerViewer
            entries={journalEntries}
            sourceFilter="bank"
            canEdit={canEdit}
            onDeleteEntry={handleDeleteJournalEntry}
            onUpdateEntry={handleUpdateJournalEntry}
          />
        </div>
      )}

      {/* ── TAB 2: KAS KECIL (TANTE YANTI) ── */}
      {activeTab === 'kas_kecil' && (
        <div className="space-y-6">
          <CashStatementImporter
            sourceType="petty_cash"
            existingEntries={journalEntries}
            canEdit={canEdit}
            onImportComplete={handleImportJournalEntries}
          />
          <GeneralLedgerViewer
            entries={journalEntries}
            sourceFilter="petty_cash"
            canEdit={canEdit}
            onDeleteEntry={handleDeleteJournalEntry}
            onUpdateEntry={handleUpdateJournalEntry}
          />
        </div>
      )}

      {/* ── TAB 3: GENERAL LEDGER & PECAHAN KOMISI LENGKAP ── */}
      {activeTab === 'gl' && (
        <div className="space-y-6">
          <GeneralLedgerViewer
            entries={journalEntries}
            sourceFilter="all"
            canEdit={canEdit}
            onDeleteEntry={handleDeleteJournalEntry}
            onUpdateEntry={handleUpdateJournalEntry}
          />
        </div>
      )}
    </div>
  );
}
