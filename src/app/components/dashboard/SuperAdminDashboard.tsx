import { useState, useEffect, useCallback } from 'react';
import { loadAllMembers } from '../../../lib/komsel';
import { getAge, getAnniversaryYears, anniversaryInfo, parseLocalDate } from '../../../lib/age';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../../lib/api';
import { Alert } from '@mui/material';
import PendingApprovals from './PendingApprovals';
import CongregationManagement from '../modules/CongregationManagement';
import AttendanceManagement from '../modules/AttendanceManagement';
import KomselManagement from '../modules/KomselManagement';
import FinanceManagement from '../modules/FinanceManagement';
import InventoryManagement from '../modules/InventoryManagement';
import UserManagement from '../modules/UserManagement';
import AnnouncementManagement from '../modules/AnnouncementManagement';
import PelayanManagement from '../modules/PelayanManagement';
import GalleryManagement from '../modules/GalleryManagement';
import TeamManagement from '../modules/TeamManagement';
import RegistrationManagement from '../modules/RegistrationManagement';
import KomisiManagement from '../modules/KomisiManagement';
import ScheduleManagement from '../modules/ScheduleManagement';
import ActivityLogManagement from '../modules/ActivityLogManagement';
import ErrorBoundary from '../common/ErrorBoundary';
import AdminChatDrawer from './AdminChatDrawer';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { sendHeartbeat } from '../../../lib/auditLogger';
// @ts-ignore
import gbiLogo from '../../../imports/pngegg__1_-1.png';
import {
  LayoutDashboard, Users, ClipboardCheck, CalendarCheck, Group,
  Wallet, Package, HandHelping, Megaphone, ShieldCheck, Menu, X,
  LogOut, ChevronRight, Cake, Gift, Images, UserRound, Activity,
  HeartHandshake, Heart, Phone, MessageSquare
} from 'lucide-react';


// ── Birthday & Anniversary helpers ───────────────────────────────────────────
function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

/** Days until the next birthday and turning age (completed years on birthday) */
function birthdayInfo(birthDate: string): { daysUntil: number; age: number; turningAge: number } | null {
  if (!birthDate) return null;
  const birth = parseLocalDate(birthDate);
  if (!birth) return null;
  const age = getAge(birthDate);
  if (age < 0) return null;
  const today = new Date();
  const todayReset = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < todayReset) next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
  const daysUntil = Math.round((next.getTime() - todayReset.getTime()) / 86400000);
  const turningAge = next.getFullYear() - birth.getFullYear();
  return { daysUntil, age, turningAge };
}

interface AnniversaryEntry {
  key: string;
  names: string;
  spouseName?: string;
  member: any;
  spouseMember?: any;
  marriageDate: string;
  daysUntil: number;
  years: number;
  isToday: boolean;
  phones: string[];
}

function getWeddingAnniversaries(members: any[]): AnniversaryEntry[] {
  const eligible = members.filter(m => m.marriageDate && m.maritalStatus !== 'single');
  const processedKeys = new Set<string>();
  const entries: AnniversaryEntry[] = [];

  for (const m of eligible) {
    if (processedKeys.has(m.id)) continue;
    const info = anniversaryInfo(m.marriageDate);
    if (!info || info.daysUntil > 30) continue;

    // Deduplicate spouse if both are in congregation
    let spouse: any = null;
    if (m.spouseName) {
      spouse = eligible.find(other =>
        other.id !== m.id &&
        (other.name.toLowerCase().trim() === m.spouseName.toLowerCase().trim() ||
         (other.spouseName && other.spouseName.toLowerCase().trim() === m.name.toLowerCase().trim()))
      );
    }

    if (spouse) {
      processedKeys.add(spouse.id);
    }
    processedKeys.add(m.id);

    const coupleName = spouse
      ? `${m.name} & ${spouse.name}`
      : (m.spouseName ? `${m.name} & ${m.spouseName}` : m.name);

    const phones = [
      ...(m.phones || (m.phone ? [m.phone] : [])),
      ...(spouse ? (spouse.phones || (spouse.phone ? [spouse.phone] : [])) : [])
    ].filter(Boolean);

    entries.push({
      key: spouse ? `${m.id}-${spouse.id}` : m.id,
      names: coupleName,
      spouseName: m.spouseName || (spouse ? spouse.name : undefined),
      member: m,
      spouseMember: spouse,
      marriageDate: m.marriageDate,
      daysUntil: info.daysUntil,
      years: info.years,
      isToday: info.isToday,
      phones,
    });
  }

  return entries.sort((a, b) => a.daysUntil - b.daysUntil);
}

const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

const NAV_ICONS: Record<string, any> = {
  dashboard:       LayoutDashboard,
  userManagement:  ShieldCheck,
  pendingApprovals:ClipboardCheck,
  activityLog:     Activity,
  jemaat:          Users,
  absensi:         CalendarCheck,
  komsel:          Group,
  keuangan:        Wallet,
  inventaris:      Package,
  pelayan:         HandHelping,
  pengumuman:      Megaphone,
  galeri:          Images,
  tim:             UserRound,
  registrasi:      ClipboardCheck,
};

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { user, signOut, refreshSession } = useAuth();
  // Tab lives in the URL so the phone's Back button steps through tabs instead of leaving the app.
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';
  const setActiveTab = (key: string) => {
    if (key !== activeTab) navigate(key === 'dashboard' ? '/dashboard' : `/dashboard?tab=${key}`);
  };
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalKomsel: 0,
    pendingApprovals: 0,
    todayAttendance: 0,
    todayKomisiAttendance: 0,
    totalTodayAttendance: 0,
  });
  const [members, setMembers] = useState<any[]>([]);
  const [adminChatOpen, setAdminChatOpen] = useState(false);
  const [pendingTaskCount, setPendingTaskCount] = useState(0);
  const handlePendingTaskCountChange = useCallback((count: number) => {
    setPendingTaskCount(prev => prev === count ? prev : count);
  }, []);

  const isSuperAdmin = user?.role === 'super_admin';
  const permissions = user?.permissions || {};

  const navItems = [
    { label: 'Dashboard',         key: 'dashboard',        visible: true },
    { label: 'User Management',   key: 'userManagement',   visible: isSuperAdmin },
    { label: 'Pending Approvals', key: 'pendingApprovals', visible: isSuperAdmin },
    { label: 'Log Aktivitas',     key: 'activityLog',      visible: isSuperAdmin },
    { label: 'Data Jemaat',       key: 'jemaat',           visible: isSuperAdmin || Boolean(permissions.viewJemaat || permissions.editJemaat) },
    { label: 'Absensi',           key: 'absensi',          visible: isSuperAdmin || Boolean(permissions.viewAbsensi || permissions.viewAbsen || permissions.editAbsensi || permissions.editAbsen || permissions.manageAbsensi) },
    { label: 'Komsel',            key: 'komsel',           visible: isSuperAdmin || Boolean(permissions.viewKomsel || permissions.editKomsel) },
    { label: 'Keuangan',          key: 'keuangan',         visible: isSuperAdmin || Boolean(permissions.viewKeuangan || permissions.editKeuangan) },
    { label: 'Inventaris',        key: 'inventaris',       visible: isSuperAdmin || Boolean(permissions.viewInventaris || permissions.editInventaris) },
    { label: 'Pelayan',           key: 'pelayan',          visible: isSuperAdmin || Boolean(permissions.viewPelayan || permissions.editPelayan) },
    { label: 'Pengumuman',        key: 'pengumuman',       visible: isSuperAdmin || Boolean(permissions.viewPengumuman || permissions.editPengumuman) },
    { label: 'Galeri Foto',       key: 'galeri',           visible: isSuperAdmin || Boolean(permissions.viewGaleri || permissions.editGaleri) },
    { label: 'Komisi',            key: 'komisi',           visible: isSuperAdmin || Boolean(permissions.viewKomisi || permissions.editKomisi || (permissions.allowedKomisi && permissions.allowedKomisi.length > 0) || (permissions.komisiLeaderOf && permissions.komisiLeaderOf.length > 0)) },
    { label: 'Jadwal Pelayanan',  key: 'jadwal',           visible: isSuperAdmin || Boolean(permissions.viewJadwal || permissions.editJadwal) },
    { label: 'Tim Pelayanan',     key: 'tim',              visible: isSuperAdmin || Boolean(permissions.viewTim || permissions.viewTeam || permissions.editTim || permissions.editTeam) },
    { label: 'Pendaftaran',       key: 'registrasi',       visible: isSuperAdmin || Boolean(permissions.viewPendaftaran || permissions.editPendaftaran || permissions.viewRegistrasi || permissions.editRegistrasi) },
  ].filter(t => t.visible);

  const currentLabel = navItems.find(n => n.key === activeTab)?.label ?? 'Dashboard';

  // Guard: if user lands on an unpermitted tab, redirect to dashboard
  useEffect(() => {
    if (navItems.length > 0 && !navItems.some(n => n.key === activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, navItems]);

  useEffect(() => {
    loadStats();
    loadMembers();
    refreshSession?.();
    // Heartbeat ping immediately and every 30s
    sendHeartbeat();
    const interval = setInterval(() => {
      sendHeartbeat();
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeTab]);


  // Only poll dashboard stats + members when on the dashboard tab
  useAutoRefresh(() => {
    if (activeTab === 'dashboard') {
      loadStats();
      loadMembers();
    }
  }, 30_000);

  const loadMembers = async () => {
    try {
      const all = await loadAllMembers();
      setMembers(prev => {
        if (prev.length === all.length && prev[0]?.id === all[0]?.id) return prev;
        return all;
      });
    } catch {}
  };

  const loadStats = async () => {
    try {
      const result = await api.get('/api/stats/dashboard');
      if (result.success && result.stats) {
        setStats(prev => {
          if (JSON.stringify(prev) === JSON.stringify(result.stats)) return prev;
          return result.stats;
        });
      }
    } catch {}
  };

  const handleSignOut = async () => { await signOut(); navigate('/jemaat'); };

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-x-hidden">

      {/* ── Mobile overlay backdrop ── */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop: fixed, mobile: drawer) ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 flex flex-col bg-gradient-to-b from-blue-900 to-indigo-900 text-white transition-all duration-300
        md:translate-x-0
        ${mobileDrawerOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
        ${sidebarOpen ? 'md:w-60' : 'md:w-16'}
        safe-left safe-top safe-bottom
      `}>

        {/* Logo / toggle */}
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-4">
          {(sidebarOpen || mobileDrawerOpen) ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <img src={gbiLogo} alt="GBI Logo" className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-white" />
                <span className="text-sm font-semibold leading-tight">GBI Jelambar<br/>Timur</span>
              </div>
              <button
                onClick={() => { setSidebarOpen(false); setMobileDrawerOpen(false); }}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 active:bg-white/20 flex-shrink-0"
              >
                <X size={20} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 active:bg-white/20 mx-auto"
            >
              <Menu size={20} />
            </button>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {navItems.map(item => {
            const Icon = NAV_ICONS[item.key] ?? LayoutDashboard;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { setActiveTab(item.key); setMobileDrawerOpen(false); }}
                title={(!sidebarOpen && !mobileDrawerOpen) ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-3 min-h-[46px] rounded-xl text-sm font-medium transition-all duration-150 group active:scale-[0.98]
                  ${active ? 'bg-white text-blue-900 shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon size={18} className="flex-shrink-0" />
                {(sidebarOpen || mobileDrawerOpen) && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {active && <ChevronRight size={14} className="opacity-50" />}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className={`border-t border-white/10 p-3 ${(!sidebarOpen && !mobileDrawerOpen) ? 'md:flex md:flex-col md:items-center' : ''}`}>
          {(sidebarOpen || mobileDrawerOpen) && (
            <div className="mb-3 px-2">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-blue-300 truncate">{isSuperAdmin ? 'Super Admin' : 'Admin'}</p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            title={(!sidebarOpen && !mobileDrawerOpen) ? 'Keluar' : undefined}
            className="flex items-center gap-2.5 w-full px-3 py-3 min-h-[46px] rounded-xl text-sm text-white/80 hover:bg-white/10 active:bg-white/20 hover:text-white transition-all cursor-pointer"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {(sidebarOpen || mobileDrawerOpen) && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className={`flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-300 ml-0 ${sidebarOpen ? 'md:ml-60' : 'md:ml-16'}`}>

        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 pb-4 flex items-center justify-between sticky top-0 z-30 safe-header">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Buka Menu"
            >
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-bold text-gray-900 leading-tight truncate">{currentLabel}</h1>
              <p className="text-xs text-gray-400 hidden sm:block truncate">Gereja Jelambar Timur</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {stats.pendingApprovals > 0 && isSuperAdmin && (
              <button onClick={() => setActiveTab('pendingApprovals')}
                className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-orange-100">
                <ClipboardCheck size={14} />
                {stats.pendingApprovals} Pending
              </button>
            )}

            {/* Admin Internal Chat & Task Toggle Button */}
            <button
              type="button"
              onClick={() => setAdminChatOpen(prev => !prev)}
              className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none active:scale-95 ${
                adminChatOpen
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
              title="Chat & Tugas Khusus Admin"
              aria-label="Buka Chat & Tugas Admin"
            >
              <MessageSquare size={15} className={adminChatOpen ? 'text-white' : 'text-blue-600'} />
              <span className="hidden sm:inline">Chat &amp; Tugas</span>
              {pendingTaskCount > 0 && (
                <span className="bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-black tracking-tight animate-pulse">
                  {pendingTaskCount}
                </span>
              )}
            </button>

            <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 flex flex-col min-h-0 safe-bottom">
          <ErrorBoundary resetKey={activeTab}>

          {/* Dashboard overview */}
          {activeTab === 'dashboard' && (
            <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto">
              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Jemaat',    value: stats.totalMembers,    sub: 'Jemaat terdaftar', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   icon: Users, tab: 'jemaat' },
                  { label: 'Komsel Aktif',    value: stats.totalKomsel,     sub: 'Kelompok sel',     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: Group, tab: 'komsel' },
                  { label: 'Pending Approval',value: stats.pendingApprovals,sub: 'Menunggu konfirmasi', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: ClipboardCheck, tab: 'pendingApprovals' },
                  { 
                    label: 'Absensi Hari Ini',
                    value: stats.todayAttendance, 
                    sub: stats.todayKomisiAttendance > 0 
                      ? `Umum: ${stats.todayAttendance} • Komisi: ${stats.todayKomisiAttendance} (Total ${stats.totalTodayAttendance || (stats.todayAttendance + stats.todayKomisiAttendance)})`
                      : 'Ibadah Umum', 
                    color: 'text-purple-700', 
                    bg: 'bg-purple-50', 
                    border: 'border-purple-200', 
                    icon: CalendarCheck, 
                    tab: 'absensi' 
                  },
                ].map(s => (
                  <div 
                    key={s.label} 
                    onClick={() => s.tab && setActiveTab(s.tab)}
                    className={`${s.bg} border ${s.border} rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between`}
                    title="Klik untuk membuka menu terkait"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-600">{s.label}</p>
                        <s.icon size={16} className={s.color} />
                      </div>
                      <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                    </div>
                    {s.sub && (
                      <p className="text-[11px] text-gray-500 mt-2 font-medium truncate" title={s.sub}>
                        {s.sub}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Welcome message */}
              <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl p-6 text-white">
                <h2 className="text-lg font-bold mb-1">Selamat datang, {user?.name} 👋</h2>
                <p className="text-blue-200 text-sm">
                  {isSuperAdmin
                    ? 'Anda login sebagai Super Admin dengan akses penuh ke semua fitur.'
                    : 'Anda login sebagai Admin. Menu tampil sesuai permissions yang diberikan Super Admin.'}
                </p>
              </div>

              {/* Quick nav */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">Akses Cepat</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {navItems.filter(n => n.key !== 'dashboard').map(item => {
                    const Icon = NAV_ICONS[item.key] ?? LayoutDashboard;
                    return (
                      <button key={item.key} onClick={() => setActiveTab(item.key)}
                        className="flex items-center gap-2.5 sm:gap-3 bg-white border border-gray-100 rounded-xl px-3.5 sm:px-4 py-3 min-h-[48px] text-xs sm:text-sm font-medium text-gray-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.98] transition-all shadow-sm text-left">
                        <Icon size={18} className="text-blue-600 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Birthday section */}
              {(() => {
                const withBirthday = members
                  .map(m => ({ ...m, bday: birthdayInfo(m.birthDate) }))
                  .filter(m => m.bday && m.bday.daysUntil <= 30)
                  .sort((a, b) => a.bday!.daysUntil - b.bday!.daysUntil);

                const todayBdays = withBirthday.filter(m => m.bday!.daysUntil === 0);
                const upcomingBdays = withBirthday.filter(m => m.bday!.daysUntil > 0);

                if (withBirthday.length === 0) return null;

                return (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                      <Cake size={16} className="text-pink-500" /> Ulang Tahun
                    </h3>

                    {/* Today */}
                    {todayBdays.length > 0 && (
                      <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-5 text-white shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <Gift size={18} />
                          <span className="font-bold text-sm">Ulang Tahun Hari Ini 🎉</span>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                          {todayBdays.map(m => {
                            const age = m.bday!.age;
                            const initials = m.name.split(' ').slice(0,2).map((w: string) => w[0]).join('').toUpperCase();
                            const primaryPhone = (m.phones && m.phones[0]) || m.phone;
                            const waLink = primaryPhone ? `https://wa.me/${primaryPhone.replace(/\D/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(`Selamat Ulang Tahun yang ke-${age} untuk ${m.name}! Kiranya Tuhan Yesus senantiasa memberkati, memberikan kesehatan, dan sukacita yang melimpah. 🎂🎉`)}` : null;

                            return (
                              <div key={m.id} className="flex items-center justify-between gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-3.5 py-2.5 border border-white/20">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center text-xs font-bold">{initials}</div>
                                  <div>
                                    <p className="text-sm font-semibold leading-tight">{m.name}</p>
                                    <p className="text-xs text-white/90">Usia {age} tahun 🎂</p>
                                  </div>
                                </div>
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Kirim Ucapan WA"
                                    className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-all text-xs flex items-center gap-1 active:scale-95"
                                  >
                                    <Phone size={12} /> <span className="hidden sm:inline">Ucapan WA</span>
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Upcoming */}
                    {upcomingBdays.length > 0 && (
                      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                          <Cake size={15} className="text-pink-400" />
                          <span className="text-sm font-semibold text-gray-700">30 Hari ke Depan</span>
                          <span className="ml-auto bg-pink-100 text-pink-700 text-xs font-bold px-2 py-0.5 rounded-full">{upcomingBdays.length} orang</span>
                        </div>
                        <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                          {upcomingBdays.map(m => {
                            const birth = parseLocalDate(m.birthDate);
                            const nextAge = m.bday!.turningAge;
                            const initials = m.name.split(' ').slice(0,2).map((w: string) => w[0]).join('').toUpperCase();
                            const dateStr = birth ? `${birth.getDate()} ${MONTHS_ID[birth.getMonth()]}` : m.birthDate;
                            const urgent = m.bday!.daysUntil <= 7;
                            const primaryPhone = (m.phones && m.phones[0]) || m.phone;
                            const waLink = primaryPhone ? `https://wa.me/${primaryPhone.replace(/\D/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(`Selamat mendahului Ulang Tahun untuk ${m.name}! Kiranya Tuhan senantiasa memberkati. 🎂🎉`)}` : null;

                            return (
                              <div key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${urgent ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {initials}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                                  <p className="text-xs text-gray-400">{dateStr} · Usia {nextAge} tahun</p>
                                </div>
                                <div className={`text-right flex-shrink-0 ${urgent ? 'text-pink-600' : 'text-gray-400'}`}>
                                  <p className="text-xs font-semibold">{m.bday!.daysUntil} hari lagi</p>
                                  {urgent && <p className="text-xs font-bold text-pink-600">⚡ Segera</p>}
                                </div>
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Kirim pesan WA"
                                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors flex-shrink-0"
                                  >
                                    <Phone size={14} />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Wedding Anniversary section */}
              {(() => {
                const anniversaries = getWeddingAnniversaries(members);
                const todayAnniversaries = anniversaries.filter(a => a.isToday);
                const upcomingAnniversaries = anniversaries.filter(a => !a.isToday);

                if (anniversaries.length === 0) return null;

                return (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                      <HeartHandshake size={16} className="text-rose-500" /> Wedding Anniversary
                    </h3>

                    {/* Today Announcement */}
                    {todayAnniversaries.length > 0 && (
                      <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 rounded-2xl p-5 text-white shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <HeartHandshake size={20} className="animate-pulse" />
                          <span className="font-bold text-sm">Wedding Anniversary Hari Ini 🎉</span>
                        </div>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          {todayAnniversaries.map(a => {
                            const primaryPhone = a.phones[0];
                            const waLink = primaryPhone ? `https://wa.me/${primaryPhone.replace(/\D/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(`Selamat Ulang Tahun Pernikahan ke-${a.years} untuk ${a.names}! Kiranya Tuhan Yesus senantiasa memberkati, menjaga, dan memelihara cinta serta damai sejahtera dalam keluarga. 🎉💍`)}` : null;

                            return (
                              <div key={a.key} className="flex items-center justify-between gap-3 bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center flex-shrink-0 text-white">
                                    <Heart size={16} className="fill-white" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold leading-tight truncate">{a.names}</p>
                                    <p className="text-xs text-white/90">Anniversary ke-{a.years} Tahun 💍</p>
                                  </div>
                                </div>
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Kirim Ucapan via WhatsApp"
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-xs flex-shrink-0 transition-transform active:scale-95"
                                  >
                                    <Phone size={12} /> <span className="hidden sm:inline">Ucapan WA</span>
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Upcoming 30 Days */}
                    {upcomingAnniversaries.length > 0 && (
                      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                          <HeartHandshake size={15} className="text-rose-400" />
                          <span className="text-sm font-semibold text-gray-700">30 Hari ke Depan</span>
                          <span className="ml-auto bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">{upcomingAnniversaries.length} pasangan</span>
                        </div>
                        <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                          {upcomingAnniversaries.map(a => {
                            const mDate = parseLocalDate(a.marriageDate);
                            const dateStr = mDate ? `${mDate.getDate()} ${MONTHS_ID[mDate.getMonth()]}` : a.marriageDate;
                            const urgent = a.daysUntil <= 7;
                            const primaryPhone = a.phones[0];
                            const waLink = primaryPhone ? `https://wa.me/${primaryPhone.replace(/\D/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(`Selamat mendahului untuk Ulang Tahun Pernikahan ke-${a.years} untuk ${a.names}! Kiranya kasih dan berkat Tuhan senantiasa menyertai. 🎉💍`)}` : null;

                            return (
                              <div key={a.key} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${urgent ? 'bg-rose-100 text-rose-700' : 'bg-pink-50 text-pink-600'}`}>
                                  <HeartHandshake size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{a.names}</p>
                                  <p className="text-xs text-gray-400">{dateStr} · Menuju {a.years} tahun</p>
                                </div>
                                <div className={`text-right flex-shrink-0 ${urgent ? 'text-rose-600' : 'text-gray-400'}`}>
                                  <p className="text-xs font-semibold">{a.daysUntil} hari lagi</p>
                                  {urgent && <p className="text-xs font-bold text-rose-600">⚡ Segera</p>}
                                </div>
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Kirim pesan WA"
                                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors flex-shrink-0"
                                  >
                                    <Phone size={14} />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {!isSuperAdmin && (
                <Alert severity="info">
                  Beberapa menu mungkin tidak terlihat karena terbatas oleh permissions. Hubungi Super Admin untuk perubahan akses.
                </Alert>
              )}
            </div>
          )}

          {activeTab === 'userManagement'   && <div className="overflow-y-auto"><div className="p-4 md:p-6"><UserManagement /></div></div>}
          {activeTab === 'pendingApprovals' && <div className="overflow-y-auto"><div className="p-4 md:p-6"><PendingApprovals onApprovalChange={loadStats} /></div></div>}
          {activeTab === 'activityLog'      && <div className="overflow-y-auto"><div className="p-4 md:p-6"><ActivityLogManagement /></div></div>}
          {activeTab === 'jemaat'           && <div className="overflow-y-auto"><div className="p-4 md:p-6"><CongregationManagement /></div></div>}

          {activeTab === 'absensi'          && <div className="overflow-y-auto"><div className="p-4 md:p-6"><AttendanceManagement /></div></div>}
          {activeTab === 'komsel'           && <div className="overflow-y-auto"><div className="p-4 md:p-6"><KomselManagement /></div></div>}
          {activeTab === 'keuangan'         && <div className="overflow-y-auto"><div className="p-4 md:p-6"><FinanceManagement /></div></div>}
          {activeTab === 'inventaris'       && <div className="overflow-y-auto"><div className="p-4 md:p-6"><InventoryManagement /></div></div>}
          {activeTab === 'pelayan'          && <PelayanManagement />}
          {activeTab === 'pengumuman'       && <div className="overflow-y-auto"><div className="p-4 md:p-6"><AnnouncementManagement /></div></div>}
          {activeTab === 'galeri'           && <div className="overflow-y-auto"><div className="p-4 md:p-6"><GalleryManagement /></div></div>}
          {activeTab === 'komisi'           && <div className="overflow-y-auto"><div className="p-4 md:p-6"><KomisiManagement /></div></div>}
          {activeTab === 'jadwal'           && <ScheduleManagement />}
          {activeTab === 'tim'              && <div className="overflow-y-auto"><div className="p-4 md:p-6"><TeamManagement /></div></div>}
          {activeTab === 'registrasi'       && <div className="overflow-y-auto"><div className="p-4 md:p-6"><RegistrationManagement /></div></div>}
          </ErrorBoundary>
        </main>
      </div>

      {/* ── Admin Chat & Task Drawer ── */}
      <AdminChatDrawer
        isOpen={adminChatOpen}
        onClose={() => setAdminChatOpen(false)}
        pendingTaskCountChange={handlePendingTaskCountChange}
      />
    </div>
  );
}
