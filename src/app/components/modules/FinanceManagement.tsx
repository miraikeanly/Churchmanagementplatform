import { useState, useEffect } from 'react';
import { apiBase } from '../../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Alert } from '@mui/material';
import { Card, CardContent } from '../ui/card';
import ModernDatePicker from '../common/ModernDatePicker';
import { Plus, TrendingUp, TrendingDown, DollarSign, Heart, Settings, Check, X, Trash2, Edit2, RefreshCw } from 'lucide-react';

const API_URL = `${apiBase()}/api/content`;

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  givingSubmissionId?: string;
  createdBy: string;
  createdAt: string;
}

interface GivingSubmission {
  id: string;
  categoryCode: string;
  categoryName: string;
  amount: number;
  senderName: string;
  senderPhone?: string;
  senderEmail?: string;
  memo?: string;
  paymentMethod: string;
  userId?: string;
  status: 'pending' | 'verified' | 'rejected';
  submittedAt: string;
}

interface GivingCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
}

const DEFAULT_CATEGORIES: GivingCategory[] = [
  { id: 'tithes', code: 'TITHES', name: 'Persembahan Persepuluhan', description: 'Membawa seluruh persembahan persepuluhan ke dalam rumah perbendaharaan' },
  { id: 'offering', code: 'OFFERING', name: 'Persembahan Umum', description: 'Persembahan ibadah mingguan dan pelayanan umum gereja' },
  { id: 'thanksgiving', code: 'THANKSGIVING OFFERING', name: 'Persembahan Syukur', description: 'Ungkapan syukur atas berkat, kesehatan, dan penyertaan Tuhan' },
  { id: 'christmas', code: 'CHRISTMAS OFFERING', name: 'Persembahan Natal', description: 'Persembahan khusus sukacita Natal dan bakti kasih' }
];

export default function FinanceManagement() {
  const { accessToken, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'transactions' | 'giving' | 'categories'>('transactions');

  // Transactions State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Giving Submissions State
  const [submissions, setSubmissions] = useState<GivingSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Giving Categories State
  const [categories, setCategories] = useState<GivingCategory[]>(DEFAULT_CATEGORIES);
  const [editingCategory, setEditingCategory] = useState<GivingCategory | null>(null);
  const [openCatDialog, setOpenCatDialog] = useState(false);
  const [catFormData, setCatFormData] = useState({ code: '', name: '', description: '' });

  // Permissions & general state
  const isSuperAdmin = user?.role === 'super_admin';
  const canEdit = isSuperAdmin || user?.permissions?.editKeuangan || false;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadTransactions();
    loadGivingData();
  }, []);

  const loadTransactions = async () => {
    try {
      const response = await fetch(`${API_URL}/finance/transactions`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const result = await response.json();
      if (result.success) {
        setTransactions(result.transactions || []);
        setSummary(result.summary || { income: 0, expense: 0, balance: 0 });
      } else {
        setError(result.error);
      }
    } catch (error: any) {
      console.error('Load transactions error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadGivingData = async () => {
    try {
      setLoadingSubmissions(true);
      // Load categories
      const catRes = await fetch(`${API_URL}/giving/categories`);
      const catData = await catRes.json();
      if (catData.success && Array.isArray(catData.categories)) {
        setCategories(catData.categories);
      }

      // Load online giving submissions (admin only)
      if (accessToken) {
        const subRes = await fetch(`${API_URL}/giving/submissions`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const subData = await subRes.json();
        if (subData.success && Array.isArray(subData.submissions)) {
          setSubmissions(subData.submissions);
        }
      }
    } catch (err: any) {
      console.error('Load giving data error:', err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      type: 'income',
      category: '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
    });
    setOpenDialog(true);
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch(`${API_URL}/finance/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount)
        }),
      });

      const result = await response.json();
      if (result.success) {
        await loadTransactions();
        setOpenDialog(false);
        setSuccessMsg('Transaksi berhasil ditambahkan');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setError(result.error);
      }
    } catch (error: any) {
      console.error('Save transaction error:', error);
      setError(error.message);
    }
  };

  // Update submission status (e.g. verify / reject)
  const handleUpdateSubmissionStatus = async (id: string, newStatus: 'verified' | 'rejected') => {
    if (!canEdit) return;
    try {
      const res = await fetch(`${API_URL}/giving/submissions/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
        setSuccessMsg(`Status persembahan diubah menjadi ${newStatus === 'verified' ? 'Terverifikasi' : 'Ditolak'}`);
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      console.error('Update status error:', err);
    }
  };

  // Save / Update Category
  const handleSaveCategory = async () => {
    if (!catFormData.code || !catFormData.name) {
      alert('Kode dan nama persembahan wajib diisi');
      return;
    }

    let updatedList: GivingCategory[] = [];
    if (editingCategory) {
      updatedList = categories.map(c => c.id === editingCategory.id ? {
        ...c,
        code: catFormData.code.toUpperCase().trim(),
        name: catFormData.name.trim(),
        description: catFormData.description.trim()
      } : c);
    } else {
      const newCat: GivingCategory = {
        id: `cat_${Date.now()}`,
        code: catFormData.code.toUpperCase().trim(),
        name: catFormData.name.trim(),
        description: catFormData.description.trim()
      };
      updatedList = [...categories, newCat];
    }

    try {
      const res = await fetch(`${API_URL}/giving/categories`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ categories: updatedList })
      });
      const data = await res.json();
      if (data.success) {
        setCategories(updatedList);
        setOpenCatDialog(false);
        setEditingCategory(null);
        setSuccessMsg('Kategori persembahan berhasil disimpan');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      console.error('Save category error:', err);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus jenis persembahan ini?')) return;
    const updatedList = categories.filter(c => c.id !== id);
    try {
      const res = await fetch(`${API_URL}/giving/categories`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ categories: updatedList })
      });
      const data = await res.json();
      if (data.success) {
        setCategories(updatedList);
        setSuccessMsg('Kategori persembahan berhasil dihapus');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      console.error('Delete category error:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const pendingSubmissionsCount = submissions.filter(s => s.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header and Top Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="text-blue-600" size={24} />
            Manajemen Keuangan & Persembahan
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Kelola transaksi keuangan kas gereja, verifikasi persembahan online jemaat, dan pengaturan jenis persembahan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'transactions' && (
            <Button
              variant="contained"
              startIcon={<Plus size={18} />}
              onClick={handleOpenDialog}
              disabled={!canEdit}
            >
              Tambah Transaksi
            </Button>
          )}

          {activeTab === 'categories' && (
            <Button
              variant="contained"
              startIcon={<Plus size={18} />}
              onClick={() => {
                setEditingCategory(null);
                setCatFormData({ code: '', name: '', description: '' });
                setOpenCatDialog(true);
              }}
              disabled={!canEdit}
            >
              Tambah Jenis Persembahan
            </Button>
          )}

          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshCw size={15} />}
            onClick={() => {
              loadTransactions();
              loadGivingData();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'transactions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <DollarSign size={16} />
          Buku Kas Transaksi
        </button>

        <button
          onClick={() => setActiveTab('giving')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all relative ${
            activeTab === 'giving'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Heart size={16} />
          Persembahan Masuk Online
          {pendingSubmissionsCount > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white animate-pulse">
              {pendingSubmissionsCount} baru
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'categories'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Settings size={16} />
          Jenis Persembahan
        </button>
      </div>

      {error && <Alert severity="error">{error}</Alert>}
      {successMsg && <Alert severity="success">{successMsg}</Alert>}

      {!canEdit && (
        <Alert severity="info">
          Anda hanya memiliki akses <strong>view-only</strong>. Hubungi Super Admin untuk mendapatkan akses edit.
        </Alert>
      )}

      {/* ── TAB 1: TRANSAKSI & BUKU KAS ── */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Pemasukan</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.income)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
                    <TrendingUp size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Pengeluaran</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(summary.expense)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                    <TrendingDown size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Saldo Kas</p>
                    <p className={`text-2xl font-bold mt-1 ${summary.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatCurrency(summary.balance)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <DollarSign size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transactions Table Desktop */}
          <TableContainer component={Paper} className="hidden md:block rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <Table>
              <TableHead className="bg-gray-50">
                <TableRow>
                  <TableCell><strong>Tanggal</strong></TableCell>
                  <TableCell><strong>Tipe</strong></TableCell>
                  <TableCell><strong>Kategori</strong></TableCell>
                  <TableCell><strong>Deskripsi</strong></TableCell>
                  <TableCell align="right"><strong>Jumlah</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" className="py-8 text-gray-400">
                      Belum ada transaksi tercatat
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => (
                    <TableRow key={transaction.id} hover>
                      <TableCell className="text-sm font-medium">{new Date(transaction.date).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          transaction.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {transaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold text-gray-800">{transaction.category}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {transaction.description}
                        {transaction.givingSubmissionId && (
                          <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 font-semibold border border-blue-200">
                            Online Giving
                          </span>
                        )}
                      </TableCell>
                      <TableCell align="right" className={transaction.type === 'income' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                        {formatCurrency(transaction.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Transactions Mobile Cards */}
          <div className="md:hidden space-y-2.5">
            {transactions.length === 0 ? (
              <div className="text-center text-gray-400 bg-white rounded-2xl border border-gray-100 py-8">Belum ada transaksi</div>
            ) : transactions.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 break-words">{t.category || '-'}</p>
                    {t.givingSubmissionId && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 font-semibold">Online</span>
                    )}
                  </div>
                  {t.description && <p className="text-sm text-gray-500 break-words mt-0.5">{t.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(t.date).toLocaleDateString('id-ID')}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${t.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 2: PERSEMBAHAN MASUK ONLINE DARI JEMAAT ── */}
      {activeTab === 'giving' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <div>
              <h3 className="font-bold text-blue-950 text-sm">Daftar Konfirmasi Persembahan Online</h3>
              <p className="text-xs text-blue-800/80">
                Data yang dikirimkan oleh jemaat melalui form halaman Give / Persembahan (`/give`).
              </p>
            </div>
            <span className="text-xs font-semibold bg-blue-600 text-white px-3 py-1 rounded-full">
              {submissions.length} Total Konfirmasi
            </span>
          </div>

          {loadingSubmissions ? (
            <div className="text-center py-10 text-gray-400">Memuat data persembahan...</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-400">
              <Heart size={36} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-semibold">Belum ada konfirmasi persembahan masuk.</p>
              <p className="text-xs text-gray-400 mt-1">Konfirmasi dari jemaat akan otomatis muncul di sini dan memicu notifikasi.</p>
            </div>
          ) : (
            <TableContainer component={Paper} className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <Table>
                <TableHead className="bg-gray-50">
                  <TableRow>
                    <TableCell><strong>Waktu Masuk</strong></TableCell>
                    <TableCell><strong>Nama Jemaat</strong></TableCell>
                    <TableCell><strong>Jenis Persembahan</strong></TableCell>
                    <TableCell><strong>Metode & Memo</strong></TableCell>
                    <TableCell align="right"><strong>Nominal</strong></TableCell>
                    <TableCell align="center"><strong>Status</strong></TableCell>
                    <TableCell align="center"><strong>Aksi</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {submissions.map((sub) => (
                    <TableRow key={sub.id} hover>
                      <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(sub.submittedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>
                        <p className="font-bold text-gray-900 text-sm">{sub.senderName}</p>
                        <p className="text-xs text-gray-500">{sub.senderPhone || sub.senderEmail || '-'}</p>
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {sub.categoryCode}
                        </span>
                        <p className="text-xs text-gray-600 mt-0.5">{sub.categoryName}</p>
                      </TableCell>
                      <TableCell className="text-xs text-gray-600 max-w-xs">
                        <span className="font-semibold text-gray-800">{sub.paymentMethod}</span>
                        {sub.memo && <p className="italic text-gray-500 mt-0.5">&ldquo;{sub.memo}&rdquo;</p>}
                      </TableCell>
                      <TableCell align="right" className="font-bold text-green-600 text-sm whitespace-nowrap">
                        {formatCurrency(sub.amount)}
                      </TableCell>
                      <TableCell align="center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          sub.status === 'verified'
                            ? 'bg-green-100 text-green-800'
                            : sub.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {sub.status === 'verified' ? 'Terverifikasi' : sub.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                        </span>
                      </TableCell>
                      <TableCell align="center">
                        <div className="flex items-center justify-center gap-1">
                          {sub.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleUpdateSubmissionStatus(sub.id, 'verified')}
                                disabled={!canEdit}
                                title="Verifikasi Masuk"
                                className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-40"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => handleUpdateSubmissionStatus(sub.id, 'rejected')}
                                disabled={!canEdit}
                                title="Tolak / Tidak Sesuai"
                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40"
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                          {sub.status !== 'pending' && (
                            <button
                              onClick={() => handleUpdateSubmissionStatus(sub.id, sub.status === 'verified' ? 'pending' : 'verified')}
                              disabled={!canEdit}
                              className="text-xs text-gray-400 hover:text-gray-700 underline"
                            >
                              Ubah
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </div>
      )}

      {/* ── TAB 3: MANAJEMEN JENIS PERSEMBAHAN (CRUD) ── */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-2xl p-4">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Pengaturan Jenis / Kategori Persembahan</h3>
              <p className="text-xs text-gray-500">
                Kategori ini akan langsung tampil sebagai opsi di halaman Give/Persembahan jemaat.
              </p>
            </div>
            <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-3 py-1 rounded-full">
              {categories.length} Kategori Aktif
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((cat) => (
              <div key={cat.id || cat.code} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                      {cat.code}
                    </span>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingCategory(cat);
                            setCatFormData({
                              code: cat.code,
                              name: cat.name,
                              description: cat.description || ''
                            });
                            setOpenCatDialog(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                          title="Edit Kategori"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
                          title="Hapus Kategori"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                  <h4 className="font-bold text-gray-900 text-base mt-2.5">{cat.name}</h4>
                  {cat.description && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{cat.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Transaction Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tambah Transaksi Buku Kas</DialogTitle>
        <DialogContent>
          <div className="space-y-4 mt-4">
            <TextField
              fullWidth
              label="Tipe Transaksi"
              select
              SelectProps={{ native: true }}
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            >
              <option key="income" value="income">Pemasukan</option>
              <option key="expense" value="expense">Pengeluaran</option>
            </TextField>
            <TextField
              fullWidth
              label="Kategori"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="Contoh: Persembahan Persepuluhan, Donasi, Operasional Listrik..."
              required
            />
            <TextField
              fullWidth
              label="Jumlah Nominal (Rp)"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Deskripsi / Catatan"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal Transaksi</label>
              <ModernDatePicker
                value={formData.date}
                onChange={val => setFormData({ ...formData, date: val })}
                placeholder="Pilih tanggal transaksi"
                minYear={2015}
                maxYear={new Date().getFullYear() + 2}
              />
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Batal</Button>
          <Button onClick={handleSubmit} variant="contained">
            Simpan
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add / Edit Category Dialog */}
      <Dialog open={openCatDialog} onClose={() => setOpenCatDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingCategory ? 'Edit Jenis Persembahan' : 'Tambah Jenis Persembahan'}</DialogTitle>
        <DialogContent>
          <div className="space-y-4 mt-4">
            <TextField
              fullWidth
              label="Kode Persembahan (Singkat)"
              value={catFormData.code}
              onChange={(e) => setCatFormData({ ...catFormData, code: e.target.value })}
              placeholder="TITHES, OFFERING, CHRISTMAS..."
              helperText="Gunakan huruf kapital singkat"
              required
            />
            <TextField
              fullWidth
              label="Nama Lengkap Persembahan"
              value={catFormData.name}
              onChange={(e) => setCatFormData({ ...catFormData, name: e.target.value })}
              placeholder="Persembahan Persepuluhan..."
              required
            />
            <TextField
              fullWidth
              label="Keterangan / Ayat Alkitab"
              multiline
              rows={2}
              value={catFormData.description}
              onChange={(e) => setCatFormData({ ...catFormData, description: e.target.value })}
              placeholder="Penjelasan singkat untuk jemaat..."
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCatDialog(false)}>Batal</Button>
          <Button onClick={handleSaveCategory} variant="contained">
            Simpan Kategori
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
