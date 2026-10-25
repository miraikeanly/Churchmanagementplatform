import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { Trash2, Plus, RefreshCw, Shield, Edit2, X, Check, Eye, EyeOff, KeyRound, Copy, CheckCircle2, ShieldCheck, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  permissions: any;
};

const MODULES = [
  { key: 'Jemaat', label: 'Data Jemaat' },
  { key: 'Absensi', label: 'Absensi' },
  { key: 'Komsel', label: 'Komsel' },
  { key: 'Keuangan', label: 'Keuangan' },
  { key: 'Inventaris', label: 'Inventaris' },
  { key: 'Pelayan', label: 'Pelayan' },
  { key: 'Pengumuman', label: 'Pengumuman' },
  { key: 'Galeri', label: 'Galeri Foto' },
  { key: 'Komisi', label: 'Komisi (Per-Komisi)' },
  { key: 'Jadwal', label: 'Jadwal Pelayanan' },
  { key: 'Tim', label: 'Tim Pelayanan' },
  { key: 'Pendaftaran', label: 'Pendaftaran' }
];

export const KOMISI_OPTIONS = [
  { id: 'sekolah-minggu', label: 'Sekolah Minggu (Anak)', badgeColor: 'bg-yellow-100 text-yellow-800' },
  { id: 'teens', label: 'Teens (Remaja)', badgeColor: 'bg-purple-100 text-purple-800' },
  { id: 'wbi', label: 'Wanita Bethel Indonesia (WBI)', badgeColor: 'bg-pink-100 text-pink-800' },
  { id: 'vessel', label: 'Vessel Youth Community (Pemuda)', badgeColor: 'bg-indigo-100 text-indigo-800' },
  { id: 'koemas', label: 'Koemas (Lansia)', badgeColor: 'bg-orange-100 text-orange-800' },
  { id: 'kompas', label: 'Komunitas Pasutri (KOMPAS)', badgeColor: 'bg-emerald-100 text-emerald-800' },
  { id: 'kowari', label: 'Komunitas Wanita Mandiri (KOWARI)', badgeColor: 'bg-rose-100 text-rose-800' },
];

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [allowlist, setAllowlist] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingAllowlist, setLoadingAllowlist] = useState(true);
  
  // Admin Portal PIN State
  const [pinConfig, setPinConfig] = useState<{ pin: string; enabled: boolean; updatedAt?: string; updatedBy?: string }>({
    pin: '123456',
    enabled: true
  });
  const [loadingPin, setLoadingPin] = useState(true);
  const [showPlainPin, setShowPlainPin] = useState(false);
  const [showEditPinModal, setShowEditPinModal] = useState(false);
  const [editPinValue, setEditPinValue] = useState('');
  const [editPinEnabled, setEditPinEnabled] = useState(true);
  const [savingPin, setSavingPin] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [pinSuccessMsg, setPinSuccessMsg] = useState('');

  // Modal state
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [tempPermissions, setTempPermissions] = useState<any>({});
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Add / edit user modal
  type UserForm = { id?: string; name: string; email: string; role: string; status: string; password: string };
  const BLANK_USER: UserForm = { name: '', email: '', role: 'admin', status: 'approved', password: '' };
  const [userForm, setUserForm] = useState<UserForm | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [error, setError] = useState('');

  const openAddUser = () => { setError(''); setUserForm({ ...BLANK_USER }); };
  const openEditUser = (u: AppUser) => {
    setError('');
    setUserForm({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, password: '' });
  };

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm) return;
    setSavingUser(true);
    setError('');
    try {
      if (userForm.id) {
        const body: any = { name: userForm.name, email: userForm.email, role: userForm.role, status: userForm.status };
        if (userForm.password) body.password = userForm.password;
        await api.put(`/api/admin/users/${userForm.id}`, body);
      } else {
        await api.post('/api/admin/users', userForm);
      }
      setUserForm(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (u: AppUser) => {
    if (!confirm(`Hapus pengguna ${u.name} (${u.email})? Tindakan ini tidak bisa dibatalkan.`)) return;
    setError('');
    try {
      await api.del(`/api/admin/users/${u.id}`);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus');
    }
  };

  const fetchData = async () => {
    try {
      const [resAllow, resUsers, resPin] = await Promise.all([
        api.get('/api/admin/allowlist'),
        api.get('/api/admin/users'),
        api.get('/api/admin/pin').catch(() => ({ success: false, data: null }))
      ]);
      if (resAllow.success) setAllowlist(resAllow.data);
      if (resUsers.success) setUsers(resUsers.data);
      if (resPin && resPin.success && resPin.data) setPinConfig(resPin.data);
    } catch (err) {} finally {
      setLoadingAllowlist(false);
      setLoadingUsers(false);
      setLoadingPin(false);
    }
  };

  const handleOpenEditPin = () => {
    setEditPinValue(pinConfig.pin || '123456');
    setEditPinEnabled(pinConfig.enabled !== false);
    setShowEditPinModal(true);
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = editPinValue.trim();
    if (cleanPin.length < 4) {
      alert('PIN minimal harus terdiri dari 4 karakter/digit');
      return;
    }
    setSavingPin(true);
    try {
      const res = await api.post('/api/admin/pin', {
        pin: cleanPin,
        enabled: editPinEnabled
      });
      if (res && res.success && res.data) {
        setPinConfig(res.data);
        setShowEditPinModal(false);
        setPinSuccessMsg('PIN akses portal admin berhasil diperbarui!');
        setTimeout(() => setPinSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan PIN');
    } finally {
      setSavingPin(false);
    }
  };

  const handleTogglePinEnabled = async () => {
    const nextState = !pinConfig.enabled;
    setSavingPin(true);
    try {
      const res = await api.post('/api/admin/pin', {
        pin: pinConfig.pin,
        enabled: nextState
      });
      if (res && res.success && res.data) {
        setPinConfig(res.data);
        setPinSuccessMsg(nextState ? 'Proteksi PIN portal admin diaktifkan.' : 'Proteksi PIN portal admin dinonaktifkan.');
        setTimeout(() => setPinSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status proteksi PIN');
    } finally {
      setSavingPin(false);
    }
  };

  const handleCopyPin = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pinConfig.pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'super_admin') fetchData();
  }, [currentUser]);

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    try {
      await api.post('/api/admin/allowlist', { email: newEmail });
      setNewEmail('');
      fetchData();
    } catch (err) {}
  };

  const handleDeleteAllowlist = async (email: string) => {
    try {
      await api.del(`/api/admin/allowlist?email=${email}`);
      fetchData();
    } catch (err) {}
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.put(`/api/admin/users/${userId}`, { role: newRole });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah role');
    }
  };

  const openAccessModal = (user: AppUser) => {
    setEditingUser(user);
    const p = user.permissions || {};
    const rawAllowed = p.allowedKomisi || p.komisiLeaderOf;
    const isAll = !rawAllowed || (Array.isArray(rawAllowed) && (rawAllowed.includes('*') || rawAllowed.length === 0));
    const initialAllowedList = isAll
      ? KOMISI_OPTIONS.map(k => k.id)
      : (Array.isArray(rawAllowed) ? rawAllowed : []);

    setTempPermissions({
      ...p,
      viewAbsensi: !!(p.viewAbsensi || p.viewAbsen),
      editAbsensi: !!(p.editAbsensi || p.editAbsen || p.manageAbsensi),
      viewTim: !!(p.viewTim || p.viewTeam),
      editTim: !!(p.editTim || p.editTeam),
      viewPendaftaran: !!(p.viewPendaftaran || p.viewRegistrasi),
      editPendaftaran: !!(p.editPendaftaran || p.editRegistrasi),
      viewJadwal: !!p.viewJadwal,
      editJadwal: !!p.editJadwal,
      viewKomisi: !!p.viewKomisi,
      editKomisi: !!p.editKomisi,
      viewPelayan: !!p.viewPelayan,
      editPelayan: !!p.editPelayan,
      allKomisi: isAll,
      allowedKomisi: initialAllowedList,
    });
  };

  const handleTogglePermission = (modKey: string, type: 'view' | 'edit') => {
    const permKey = `${type}${modKey}`;
    setTempPermissions((prev: any) => {
      const nextVal = !prev[permKey];
      const updated = {
        ...prev,
        [permKey]: nextVal
      };
      // If turning on edit, automatically ensure view is also turned on
      if (type === 'edit' && nextVal) {
        updated[`view${modKey}`] = true;
      }
      // If turning off view, automatically ensure edit is also turned off
      if (type === 'view' && !nextVal) {
        updated[`edit${modKey}`] = false;
      }
      return updated;
    });
  };

  const savePermissions = async () => {
    if (!editingUser) return;
    setSavingPermissions(true);
    try {
      const p = { ...tempPermissions };

      // Ensure that if edit is granted, view is also granted. If neither, both are false.
      MODULES.forEach(m => {
        const vKey = `view${m.key}`;
        const eKey = `edit${m.key}`;
        if (p[eKey]) {
          p[vKey] = true;
        }
        p[vKey] = !!p[vKey];
        p[eKey] = !!p[eKey];
      });

      // Synchronize alias keys for backward compatibility and multi-component checks
      p.viewAbsen = !!p.viewAbsensi;
      p.editAbsen = !!p.editAbsensi;
      p.manageAbsensi = !!p.editAbsensi;

      p.viewTeam = !!p.viewTim;
      p.editTeam = !!p.editTim;

      p.viewRegistrasi = !!p.viewPendaftaran;
      p.editRegistrasi = !!p.editPendaftaran;

      p.deleteJemaat = !!p.editJemaat;

      // Handle komisi permissions
      if (p.allKomisi) {
        p.allowedKomisi = ['*'];
        p.komisiLeaderOf = KOMISI_OPTIONS.map(k => k.id);
      } else {
        const selected = Array.isArray(tempPermissions.allowedKomisi) ? tempPermissions.allowedKomisi : [];
        p.allowedKomisi = selected;
        p.komisiLeaderOf = selected;
      }
      delete p.allKomisi;

      await api.put(`/api/admin/users/${editingUser.id}`, { permissions: p });
      setEditingUser(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan permissions');
    } finally {
      setSavingPermissions(false);
    }
  };

  if (currentUser?.role !== 'super_admin') return <div>Akses ditolak</div>;

  return (
    <div className="space-y-6">
      {/* ── Security / Admin Portal PIN Card ── */}
      <div className="bg-gradient-to-br from-white via-blue-50/20 to-indigo-50/30 p-5 md:p-6 rounded-2xl shadow-sm border border-blue-100/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
              <KeyRound size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base font-bold text-gray-900">PIN Akses Portal Admin</h3>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  pinConfig.enabled !== false
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                  <ShieldCheck size={12} />
                  {pinConfig.enabled !== false ? 'Proteksi PIN Aktif' : 'Nonaktif'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
                PIN ini wajib dimasukkan di website jemaat sebelum siapa pun dapat mengakses halaman login atau pendaftaran admin. Ini mencegah orang asing mendaftar dan meminta persetujuan admin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
            <button
              type="button"
              onClick={handleTogglePinEnabled}
              disabled={savingPin}
              className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                pinConfig.enabled !== false
                  ? 'border-gray-200 text-gray-600 hover:bg-gray-50 bg-white'
                  : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              {pinConfig.enabled !== false ? 'Nonaktifkan Proteksi' : 'Aktifkan Proteksi'}
            </button>
            <button
              type="button"
              onClick={handleOpenEditPin}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Edit2 size={13} />
              Ubah PIN
            </button>
          </div>
        </div>

        {pinSuccessMsg && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={15} className="flex-shrink-0" />
            <span>{pinSuccessMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
          {/* PIN Display Box */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[11px] font-medium text-gray-400 block uppercase tracking-wider">PIN Saat Ini</span>
              <span className="text-lg font-mono font-bold text-gray-800 tracking-widest">
                {showPlainPin ? pinConfig.pin : '••••••'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowPlainPin(!showPlainPin)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                title={showPlainPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
              >
                {showPlainPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                onClick={handleCopyPin}
                className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                title="Salin PIN"
              >
                {copiedPin ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          {/* Last Updated */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-2xs">
            <span className="text-[11px] font-medium text-gray-400 block uppercase tracking-wider">Terakhir Diperbarui</span>
            <span className="text-xs font-semibold text-gray-700 block mt-1">
              {pinConfig.updatedAt
                ? new Date(pinConfig.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                : 'PIN Bawaan Sistem'}
            </span>
            {pinConfig.updatedBy && (
              <span className="text-[11px] text-gray-400 block">oleh {pinConfig.updatedBy}</span>
            )}
          </div>

          {/* Usage hint */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-2xs sm:col-span-2 lg:col-span-1">
            <span className="text-[11px] font-medium text-gray-400 block uppercase tracking-wider">Instruksi Penggunaan</span>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              Bagikan PIN ini hanya kepada staf atau pelayan yang membutuhkan akses login ke portal admin.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Manajemen Pengguna & Hak Akses
          </h3>
          <button onClick={openAddUser} className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Tambah
          </button>
        </div>
        {error && !userForm && (
          <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-xl flex justify-between items-start gap-2">
            <span>{error}</span>
            <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </div>
        )}
        
        {loadingUsers ? <RefreshCw className="animate-spin text-gray-400" /> : (
          <>
          {/* Phones: one card per user so nothing is cut off */}
          <div className="md:hidden space-y-3">
            {users.map((u) => (
              <div key={u.id} className="border border-gray-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 break-words">{u.name}</p>
                    <p className="text-sm text-gray-500 break-all">{u.email}</p>
                  </div>
                  <span className={`flex-shrink-0 px-2 text-xs leading-5 font-semibold rounded-full ${u.status === 'approved' ? 'bg-green-100 text-green-800' : (u.status === 'rejected' || u.status === 'suspended') ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{u.status}</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)} disabled={u.email === currentUser.email}
                    className="text-sm rounded-lg border border-gray-300 py-1.5 pl-2 pr-6">
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  {u.role === 'admin' ? (
                    <button onClick={() => openAccessModal(u)} className="text-blue-600 text-sm font-medium flex items-center gap-1"><Edit2 className="w-4 h-4" /> Kelola Akses</button>
                  ) : u.role === 'super_admin' ? <span className="text-gray-400 text-sm">Akses Penuh</span> : null}
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-50">
                  <button onClick={() => openEditUser(u)} className="flex-1 flex items-center justify-center gap-1 text-sm px-3 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium"><Edit2 className="w-4 h-4" />Ubah</button>
                  <button onClick={() => handleDeleteUser(u)} disabled={u.email === currentUser.email}
                    className="flex-1 flex items-center justify-center gap-1 text-sm px-3 py-2 bg-red-50 text-red-600 rounded-lg font-medium disabled:opacity-30"><Trash2 className="w-4 h-4" />Hapus</button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama / Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Akses (Admin)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{u.name}</div>
                      <div className="text-sm text-gray-500">{u.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={u.email === currentUser.email} // prevent self-demotion
                        className="text-sm rounded border-gray-300 py-1 pl-2 pr-6 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.status === 'approved' ? 'bg-green-100 text-green-800' : (u.status === 'rejected' || u.status === 'suspended') ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {u.role === 'admin' ? (
                        <div className="flex flex-col items-end gap-1">
                          <button
                            onClick={() => openAccessModal(u)}
                            className="text-blue-600 hover:text-blue-900 flex items-center justify-end gap-1 cursor-pointer font-bold text-xs"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Kelola Akses
                          </button>
                          {(() => {
                            const p = u.permissions || {};
                            if (!p.viewKomisi && !p.editKomisi) return null;
                            const allowed = p.allowedKomisi || p.komisiLeaderOf;
                            if (!allowed || allowed.includes('*') || allowed.length === KOMISI_OPTIONS.length) {
                              return (
                                <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                  Komisi: Semua
                                </span>
                              );
                            }
                            const labels = KOMISI_OPTIONS.filter(k => allowed.includes(k.id)).map(k => k.label.split(' ')[0]);
                            return (
                              <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 font-semibold truncate max-w-[150px]" title={labels.join(', ')}>
                                Komisi: {labels.join(', ')}
                              </span>
                            );
                          })()}
                        </div>
                      ) : u.role === 'super_admin' ? (
                        <span className="text-gray-400">Akses Penuh</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEditUser(u)} title="Ubah" className="p-2 text-blue-600 hover:bg-blue-50 rounded-full">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={u.email === currentUser.email}
                          title={u.email === currentUser.email ? 'Tidak bisa menghapus akun sendiri' : 'Hapus'}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Email yang otomatis disetujui (Allowlist)</h3>
        <p className="text-sm text-gray-500 mb-4">Email dalam daftar ini akan langsung disetujui (approved) saat pertama kali mendaftar.</p>
        
        <form onSubmit={handleAddEmail} className="flex gap-2 mb-6">
          <input 
            type="email" 
            value={newEmail} 
            onChange={e => setNewEmail(e.target.value)} 
            placeholder="admin@gbijeltim.com" 
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          />
          <button type="submit" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Tambah
          </button>
        </form>

        {loadingAllowlist ? <RefreshCw className="animate-spin text-gray-400" /> : (
          <ul className="divide-y divide-gray-200">
            {allowlist.map((item) => (
              <li key={item.email} className="py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.email}</p>
                  <p className="text-xs text-gray-500">Ditambahkan oleh {item.added_by_name} pada {new Date(item.added_at).toLocaleDateString('id-ID')}</p>
                </div>
                <button onClick={() => handleDeleteAllowlist(item.email)} className="text-red-500 hover:text-red-700 p-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add / Edit User Modal */}
      {userForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <form onSubmit={saveUser} className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900">{userForm.id ? 'Ubah Pengguna' : 'Tambah Pengguna'}</h3>
              <button type="button" onClick={() => setUserForm(null)} className="text-gray-400 hover:text-gray-500">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}
              <label className="block text-sm font-medium text-gray-700">Nama
                <input required value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm" />
              </label>
              <label className="block text-sm font-medium text-gray-700">Email
                <input required type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                {userForm.id ? 'Password baru (kosongkan jika tidak diubah)' : 'Password'}
                <input required={!userForm.id} type="password" minLength={6} value={userForm.password}
                  onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-medium text-gray-700">Role
                  <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                    disabled={userForm.email === currentUser.email}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm">
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-gray-700">Status
                  <select value={userForm.status} onChange={e => setUserForm({ ...userForm, status: e.target.value })}
                    disabled={userForm.email === currentUser.email}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm">
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setUserForm(null)}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                Batal
              </button>
              <button type="submit" disabled={savingUser}
                className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                {savingUser ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Permissions Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900">
                Kelola Akses Admin: {editingUser.name}
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-500">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MODULES.map(mod => {
                  const viewKey = `view${mod.key}`;
                  const editKey = `edit${mod.key}`;
                  const canView = !!tempPermissions[viewKey];
                  const canEdit = !!tempPermissions[editKey];
                  
                  return (
                    <div key={mod.key} className={`border rounded-xl p-4 transition-all ${
                      mod.key === 'Komisi' && (canView || canEdit)
                        ? 'col-span-1 sm:col-span-2 bg-gradient-to-br from-white to-blue-50/30 border-blue-200 ring-1 ring-blue-100 shadow-2xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}>
                      <div className="flex items-center justify-between mb-2.5">
                        <p className="font-bold text-gray-900 text-sm">{mod.label}</p>
                        {mod.key === 'Komisi' && (canView || canEdit) && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {tempPermissions.allKomisi ? 'Semua Komisi' : `${(tempPermissions.allowedKomisi || []).length} Komisi Terpilih`}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={canView}
                            onChange={() => handleTogglePermission(mod.key, 'view')}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="text-sm text-gray-700 flex items-center gap-1 font-medium">
                            <Eye className="w-4 h-4 text-slate-500" /> Lihat
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={canEdit}
                            onChange={() => handleTogglePermission(mod.key, 'edit')}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="text-sm text-gray-700 flex items-center gap-1 font-medium">
                            <Edit2 className="w-4 h-4 text-slate-500" /> Edit
                          </span>
                        </label>
                      </div>

                      {/* Sub-selector khusus Komisi: batasan per komisi */}
                      {mod.key === 'Komisi' && (canView || canEdit) && (
                        <div className="mt-3 pt-3 border-t border-blue-100 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800">Cakupan Komisi yang Diizinkan:</span>
                            <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
                              <button
                                type="button"
                                onClick={() => setTempPermissions((prev: any) => ({
                                  ...prev,
                                  allKomisi: true,
                                  allowedKomisi: KOMISI_OPTIONS.map(k => k.id)
                                }))}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                  tempPermissions.allKomisi ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Semua Komisi
                              </button>
                              <button
                                type="button"
                                onClick={() => setTempPermissions((prev: any) => ({
                                  ...prev,
                                  allKomisi: false
                                }))}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                  !tempPermissions.allKomisi ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Pilih Komisi Tertentu
                              </button>
                            </div>
                          </div>

                          {!tempPermissions.allKomisi ? (
                            <div className="bg-white/90 p-3 rounded-xl border border-slate-200/90 space-y-2.5">
                              <p className="text-[11px] text-slate-500">
                                Centang hanya komisi yang boleh diakses oleh admin ini (misal: hanya <strong>Sekolah Minggu</strong>):
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {KOMISI_OPTIONS.map(kom => {
                                  const isChecked = (tempPermissions.allowedKomisi || []).includes(kom.id);
                                  return (
                                    <label
                                      key={kom.id}
                                      className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all cursor-pointer select-none ${
                                        isChecked
                                          ? 'bg-blue-50/60 border-blue-300 ring-1 ring-blue-200'
                                          : 'bg-white border-slate-200 hover:border-slate-300'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setTempPermissions((prev: any) => {
                                            const current = prev.allowedKomisi || [];
                                            const next = isChecked
                                              ? current.filter((id: string) => id !== kom.id)
                                              : [...current, kom.id];
                                            return { ...prev, allowedKomisi: next, allKomisi: false };
                                          });
                                        }}
                                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                      />
                                      <div className="min-w-0">
                                        <p className="font-bold text-slate-800 text-xs truncate">{kom.label}</p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                                <span className="text-slate-400 font-medium">
                                  Terpilih: <strong>{(tempPermissions.allowedKomisi || []).length}</strong> dari {KOMISI_OPTIONS.length} komisi
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setTempPermissions((p: any) => ({ ...p, allowedKomisi: KOMISI_OPTIONS.map(k => k.id) }))}
                                    className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                                  >
                                    Pilih Semua
                                  </button>
                                  <span className="text-slate-300">•</span>
                                  <button
                                    type="button"
                                    onClick={() => setTempPermissions((p: any) => ({ ...p, allowedKomisi: [] }))}
                                    className="text-red-500 hover:text-red-700 font-bold cursor-pointer"
                                  >
                                    Kosongkan
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/80 text-[11px] text-emerald-800 font-medium flex items-center gap-2">
                              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                              <span>Admin ini dapat melihat dan mengelola seluruh komisi gereja tanpa pembatasan.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={savePermissions}
                disabled={savingPermissions}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {savingPermissions ? 'Menyimpan...' : (
                  <>
                    <Check className="w-4 h-4 mr-2" /> Simpan Hak Akses
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit PIN Modal */}
      {showEditPinModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex justify-center items-center p-4">
          <form onSubmit={handleSavePin} className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/70">
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-blue-600" />
                <h3 className="font-bold text-gray-900 text-sm">Ubah PIN Portal Admin</h3>
              </div>
              <button type="button" onClick={() => setShowEditPinModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  PIN Baru (Minimal 4 Karakter)
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={editPinValue}
                  onChange={e => setEditPinValue(e.target.value)}
                  placeholder="Contoh: 123456"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-center font-mono font-bold text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                />
                <p className="text-[11px] text-gray-400 mt-1">Bisa berupa angka atau kombinasi huruf dan angka.</p>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editPinEnabled}
                    onChange={e => setEditPinEnabled(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-medium">Wajibkan PIN saat membuka portal admin</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2.5 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setShowEditPinModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingPin}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {savingPin ? <RefreshCw size={14} className="animate-spin" /> : null}
                <span>Simpan PIN</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
