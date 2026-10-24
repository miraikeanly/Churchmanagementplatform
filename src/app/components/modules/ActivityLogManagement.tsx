import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import {
  fetchActivityLogs,
  fetchAdminPresence,
  AuditLogItem,
  OnlineAdmin,
} from '../../../lib/auditLogger';
import {
  Activity, Users, ShieldAlert, Clock, Search, Filter, RefreshCw,
  CheckCircle, AlertTriangle, Trash2, Edit3, PlusCircle, LogIn, LogOut,
  Monitor, Smartphone, Globe, ArrowUpDown, ChevronLeft, ChevronRight,
  ExternalLink, ShieldCheck, UserCheck, Calendar, Info, ArrowRight, ChevronDown
} from 'lucide-react';

// Format date to local Indonesian time
function formatDateTime(isoStr?: string | null) {
  if (!isoStr) return '–';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

// Relative time formatter
function formatTimeAgo(isoStr?: string | null) {
  if (!isoStr) return 'Belum pernah aktif';
  try {
    const diffSec = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
    if (diffSec < 60) return 'Baru saja';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
    return `${Math.floor(diffSec / 86400)} hari lalu`;
  } catch {
    return '–';
  }
}

// Clean device detector from user agent
function parseUserAgent(ua?: string | null) {
  if (!ua) return { device: 'Peramban Web', icon: Globe };
  const lower = ua.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|ipod/.test(lower);
  let browser = 'Browser';
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('chrome/')) browser = 'Chrome';
  else if (lower.includes('safari/')) browser = 'Safari';
  else if (lower.includes('firefox/')) browser = 'Firefox';

  let os = 'OS';
  if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('macintosh') || lower.includes('mac os')) os = 'macOS';
  else if (lower.includes('android')) os = 'Android';
  else if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS';
  else if (lower.includes('linux')) os = 'Linux';

  return {
    device: `${browser} di ${os}`,
    icon: isMobile ? Smartphone : Monitor,
  };
}

export default function ActivityLogManagement() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  // State
  const [activeSubTab, setActiveSubTab] = useState<'presence' | 'logs'>('presence');
  const [admins, setAdmins] = useState<OnlineAdmin[]>([]);
  const [presenceStats, setPresenceStats] = useState({ online: 0, idle: 0, total: 0 });
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterTarget, setFilterTarget] = useState('ALL');
  const [filterAdminId, setFilterAdminId] = useState('ALL');

  // Load presence data
  const loadPresence = useCallback(async () => {
    try {
      const res = await fetchAdminPresence();
      if (res?.success) {
        setAdmins(res.admins || []);
        if (res.stats) setPresenceStats(res.stats);
      }
    } catch (e) {
      console.error('Failed to load presence:', e);
    }
  }, []);

  // Load activity logs
  const loadLogs = useCallback(async () => {
    try {
      const res = await fetchActivityLogs({
        page,
        limit: 40,
        search: searchQuery || undefined,
        action: filterAction !== 'ALL' ? filterAction : undefined,
        target: filterTarget !== 'ALL' ? filterTarget : undefined,
      });
      if (res?.success) {
        setLogs(res.logs || []);
        setTotalLogs(res.total || 0);
      }
    } catch (e) {
      console.error('Failed to load logs:', e);
    }
  }, [page, searchQuery, filterAction, filterTarget]);

  // Initial load
  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPresence(), loadLogs()]);
    setLoading(false);
  }, [loadPresence, loadLogs]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-refresh every 20 seconds
  useAutoRefresh(() => {
    loadPresence();
    if (activeSubTab === 'logs') loadLogs();
  }, 20_000);

  // Filtered logs by selected admin if set
  const displayedLogs = useMemo(() => {
    if (filterAdminId === 'ALL') return logs;
    return logs.filter(l => l.user_id === filterAdminId);
  }, [logs, filterAdminId]);

  if (!isSuperAdmin) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center max-w-lg mx-auto mt-10">
        <ShieldAlert size={40} className="text-rose-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-rose-900">Akses Terbatas (Super Admin Only)</h3>
        <p className="text-sm text-rose-700 mt-1">
          Halaman Log Aktivitas & Pelacakan Admin hanya dapat diakses oleh Super Administrator gereja.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* ── Top Header & Stats ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">Log Aktivitas & Admin Online</h2>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
              Super Admin Only
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Pantau kehadiran real-time admin gereja dan rekam jejak setiap aksi (tambah, ubah, hapus).
          </p>
        </div>

        <button
          onClick={loadAll}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Online Now */}
        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Admin Online</span>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700">{presenceStats.online}</div>
          <p className="text-[11px] text-emerald-600 mt-0.5">Aktif dalam 3 menit terakhir</p>
        </div>

        {/* Idle */}
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Admin Idle</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-700">{presenceStats.idle}</div>
          <p className="text-[11px] text-amber-600 mt-0.5">Aktif 3–15 menit lalu</p>
        </div>

        {/* Total Registered Admins */}
        <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800">Total Akun Admin</span>
            <Users size={16} className="text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-700">{presenceStats.total}</div>
          <p className="text-[11px] text-blue-600 mt-0.5">Super Admin & Admin</p>
        </div>

        {/* Total Activity Logs */}
        <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-800">Total Log Aktivitas</span>
            <Activity size={16} className="text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-700">{totalLogs}</div>
          <p className="text-[11px] text-indigo-600 mt-0.5">Aksi tercatat di sistem</p>
        </div>
      </div>

      {/* ── Sub-tabs Navigation ── */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          onClick={() => setActiveSubTab('presence')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'presence'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Status Admin Online ({presenceStats.online})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('logs')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'logs'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Activity size={16} />
          <span>Log Riwayat Aktivitas ({totalLogs})</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: ONLINE ADMINS / PRESENCE TRACKER
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'presence' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200/80 rounded-2xl p-4 md:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-sm md:text-base flex items-center gap-2">
                  <UserCheck size={18} className="text-emerald-600" />
                  Daftar Status Penggunaan Admin
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Mendeteksi siapa yang sedang membuka dashboard web/aplikasi secara langsung.
                </p>
              </div>
              <span className="text-[11px] bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">
                Update Otomatis setiap 20 detik
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {admins.map(admin => {
                const isOnline = admin.presence_status === 'online';
                const isIdle = admin.presence_status === 'idle';
                const device = parseUserAgent(admin.user_agent);
                const DeviceIcon = device.icon;
                const initials = (admin.name || admin.email)
                  .split(' ')
                  .slice(0, 2)
                  .map(w => w[0])
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={admin.id}
                    className={`rounded-2xl border p-4 transition-all ${
                      isOnline
                        ? 'bg-gradient-to-br from-emerald-50/50 to-white border-emerald-300 shadow-sm'
                        : isIdle
                        ? 'bg-gradient-to-br from-amber-50/40 to-white border-amber-200'
                        : 'bg-white border-gray-100 opacity-80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar with Status Ring */}
                      <div className="relative flex-shrink-0">
                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${
                            isOnline
                              ? 'bg-emerald-600 text-white'
                              : isIdle
                              ? 'bg-amber-500 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {initials}
                        </div>
                        {/* Status badge */}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            isOnline
                              ? 'bg-emerald-500 animate-pulse'
                              : isIdle
                              ? 'bg-amber-400'
                              : 'bg-gray-400'
                          }`}
                          title={isOnline ? 'Online Sekarang' : isIdle ? 'Idle' : 'Offline'}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-sm text-gray-900 truncate">{admin.name}</p>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              admin.role === 'super_admin'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{admin.email}</p>

                        {/* Status Label */}
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              isOnline
                                ? 'bg-emerald-100 text-emerald-800'
                                : isIdle
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOnline ? 'bg-emerald-600' : isIdle ? 'bg-amber-500' : 'bg-gray-400'
                              }`}
                            />
                            {isOnline
                              ? '🟢 Sedang Online'
                              : isIdle
                              ? '🟡 Idle / Baru Saja'
                              : '⚪ Offline'}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {formatTimeAgo(admin.last_seen_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Metadata details */}
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs space-y-1.5 text-gray-600">
                      {admin.last_active_path && (
                        <div className="flex items-center justify-between text-[11px] bg-gray-50 px-2 py-1 rounded-lg">
                          <span className="text-gray-400">Halaman saat ini:</span>
                          <span className="font-medium text-blue-700 truncate max-w-40" title={admin.last_active_path}>
                            {admin.last_active_path.replace('/dashboard?tab=', 'Tab: ').replace('/dashboard', 'Dashboard')}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span className="flex items-center gap-1">
                          <DeviceIcon size={12} />
                          <span className="truncate max-w-40">{device.device}</span>
                        </span>
                        <span>{admin.last_seen_at ? formatDateTime(admin.last_seen_at).slice(-8) : ''}</span>
                      </div>
                    </div>

                    {/* Quick filter activity */}
                    <button
                      type="button"
                      onClick={() => {
                        setFilterAdminId(admin.id);
                        setActiveSubTab('logs');
                      }}
                      className="mt-3 w-full py-1.5 text-center text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50/60 rounded-xl transition-colors cursor-pointer"
                    >
                      Lihat Aktivitas Admin Ini →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: ACTIVITY LOGS / AUDIT TRAIL
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-56">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder="Cari aktivitas, nama admin, email, modul..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Action Filter */}
              <select
                aria-label="Filter berdasarkan jenis aksi"
                value={filterAction}
                onChange={e => { setFilterAction(e.target.value); setPage(1); }}
                className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">Semua Aksi</option>
                <option value="CREATE">CREATE (Tambah)</option>
                <option value="UPDATE">UPDATE (Edit / Simpan)</option>
                <option value="DELETE">DELETE (Hapus)</option>
                <option value="LOGIN">LOGIN</option>
                <option value="LOGOUT">LOGOUT</option>
                <option value="APPROVE">APPROVE (Setujui)</option>
                <option value="REJECT">REJECT (Tolak)</option>
              </select>

              {/* Target / Module Filter */}
              <select
                aria-label="Filter berdasarkan modul gereja"
                value={filterTarget}
                onChange={e => { setFilterTarget(e.target.value); setPage(1); }}
                className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">Semua Modul</option>
                <option value="Absensi">Absensi</option>
                <option value="Data Jemaat">Data Jemaat</option>
                <option value="User Management">User Management</option>
                <option value="Komsel">Komsel</option>
                <option value="Keuangan">Keuangan</option>
                <option value="Inventaris">Inventaris</option>
                <option value="Pengumuman">Pengumuman</option>
                <option value="Galeri Foto">Galeri Foto</option>
                <option value="Tim Pelayanan">Tim Pelayanan</option>
                <option value="Pendaftaran">Pendaftaran</option>
                <option value="Autentikasi">Autentikasi</option>
              </select>

              {/* Admin Filter */}
              <select
                aria-label="Filter berdasarkan admin"
                value={filterAdminId}
                onChange={e => setFilterAdminId(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">Semua Admin</option>
                {admins.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>

              {/* Reset filter button */}
              {(searchQuery || filterAction !== 'ALL' || filterTarget !== 'ALL' || filterAdminId !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterAction('ALL');
                    setFilterTarget('ALL');
                    setFilterAdminId('ALL');
                    setPage(1);
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-2 cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Logs Table / List */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                    <th className="px-4 py-3.5">Waktu</th>
                    <th className="px-4 py-3.5">Admin</th>
                    <th className="px-4 py-3.5">Aksi</th>
                    <th className="px-4 py-3.5">Modul / Target</th>
                    <th className="px-4 py-3.5">Rincian Perubahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400">
                        <Activity size={32} className="mx-auto mb-2 opacity-40 text-gray-400" />
                        <p className="font-semibold text-gray-600">Belum ada riwayat aktivitas tercatat</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Setiap penambahan, pengeditan, atau penghapusan data oleh admin akan terekam di sini secara otomatis.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    displayedLogs.map(log => {
                      const action = String(log.action || '').toUpperCase();
                      const detailText =
                        typeof log.detail === 'string'
                          ? log.detail
                          : log.detail?.message || log.detail?.summary || JSON.stringify(log.detail || {});

                      // Badge color based on action type
                      let badgeColor = 'bg-gray-100 text-gray-700 border-gray-200';
                      let ActionIcon = Info;
                      if (action.includes('CREATE') || action.includes('TAMBAH')) {
                        badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                        ActionIcon = PlusCircle;
                      } else if (action.includes('UPDATE') || action.includes('EDIT') || action.includes('SIMPAN') || action.includes('SAVE')) {
                        badgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
                        ActionIcon = Edit3;
                      } else if (action.includes('DELETE') || action.includes('HAPUS')) {
                        badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
                        ActionIcon = Trash2;
                      } else if (action.includes('LOGIN')) {
                        badgeColor = 'bg-violet-100 text-violet-800 border-violet-200';
                        ActionIcon = LogIn;
                      } else if (action.includes('LOGOUT')) {
                        badgeColor = 'bg-gray-100 text-gray-800 border-gray-200';
                        ActionIcon = LogOut;
                      } else if (action.includes('APPROVE')) {
                        badgeColor = 'bg-teal-100 text-teal-800 border-teal-200';
                        ActionIcon = CheckCircle;
                      } else if (action.includes('REJECT') || action.includes('SUSPEND')) {
                        badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
                        ActionIcon = AlertTriangle;
                      }

                      return (
                        <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                          {/* Timestamp */}
                          <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                            <div className="font-semibold text-gray-800">{formatDateTime(log.at)}</div>
                            <div className="text-[10px] text-gray-400">{formatTimeAgo(log.at)}</div>
                          </td>

                          {/* Admin */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                                {(log.user_name || log.user_email || 'A').slice(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 truncate">
                                  {log.user_name || 'Admin'}
                                </p>
                                <p className="text-[10px] text-gray-400 truncate">{log.user_email || '–'}</p>
                              </div>
                            </div>
                          </td>

                          {/* Action Badge */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeColor}`}>
                              <ActionIcon size={12} />
                              <span>{action}</span>
                            </span>
                          </td>

                          {/* Target / Module */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md text-[11px]">
                              {log.target || 'Sistem'}
                            </span>
                          </td>

                          {/* Detail Description & Field Diffs */}
                          <td className="px-4 py-3 text-gray-700 max-w-lg">
                            <p className="break-words font-medium text-gray-900 leading-snug">{detailText}</p>
                            
                            {/* Detailed changes list if available */}
                            {Array.isArray(log.detail?.changes) && log.detail.changes.length > 0 && (
                              <div className="mt-2 space-y-1.5 pt-1.5 border-t border-gray-100">
                                {log.detail.changes.map((c: any, ci: number) => (
                                  <div
                                    key={ci}
                                    className="text-[11px] bg-slate-50 border border-slate-200/70 rounded-lg px-2.5 py-1.5 flex items-center gap-2 flex-wrap"
                                  >
                                    <span className="font-bold text-slate-700 capitalize bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                                      {c.field}
                                    </span>
                                    <span className="text-rose-600 line-through bg-rose-50 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                      {c.oldText || 'kosong'}
                                    </span>
                                    <ArrowRight size={11} className="text-slate-400 flex-shrink-0" />
                                    <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                      {c.newText || 'kosong'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Additional info badge if entityName is provided */}
                            {log.detail?.entityName && !log.detail?.changes?.length && (
                              <div className="mt-1">
                                <span className="inline-block text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200/60 font-mono">
                                  ID/Nama: {log.detail.entityName}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalLogs > 40 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gray-50/80 border-t border-gray-200 pr-20 sm:pr-24">
                <span className="text-xs text-gray-500">
                  Menampilkan {displayedLogs.length} dari {totalLogs} riwayat
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-semibold px-2">Halaman {page}</span>
                  <button
                    disabled={displayedLogs.length < 40}
                    onClick={() => setPage(p => p + 1)}
                    className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
