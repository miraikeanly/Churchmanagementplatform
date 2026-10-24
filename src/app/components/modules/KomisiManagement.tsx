import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { EdgeKV as supabaseAdmin } from '../../../lib/edgeKvClient';
import { useAuth } from '../../contexts/AuthContext';
import { projectId } from '/utils/supabase/info';
import { getAge, getAgeGroup, AGE_GROUP_STYLES } from '../../../lib/age';
import KomisiReport from './KomisiReport';
import ModernDatePicker from '../common/ModernDatePicker';
import {
  Users, Plus, Trash2, Edit2, X, Check, ChevronDown, AlertTriangle,
  ClipboardList, Download, Calendar, Calendar as CalendarIcon, UserCheck, UserX, Link, Unlink,
  Search, RefreshCw, ShieldAlert, Info, Activity, Circle, Save, Phone,
  ChevronLeft, ChevronRight, CheckCircle2, Clock, Sparkles
} from 'lucide-react';

const KV = 'kv_store_561004a0';
const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-561004a0`;

export const KOMISI_LIST = [
  { id: 'sekolah-minggu', label: 'Sekolah Minggu',          color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { id: 'teens',          label: 'Teens',                   color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'wbi',            label: 'Wanita Bethel Indonesia',  color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { id: 'vessel',         label: 'Vessel Youth Community',   color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'koemas',         label: 'Koemas',                   color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'kompas',         label: 'Komunitas Pasutri',        color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'kowari',         label: 'Komunitas Wanita Mandiri', color: 'bg-rose-100 text-rose-800 border-rose-200' },
] as const;

export type KomisiId = typeof KOMISI_LIST[number]['id'];
type Tab = 'anggota' | 'absensi' | 'laporan';

export interface KomisiMember {
  id: string;
  name: string;
  phone: string;
  address?: string;
  birthDate?: string;
  role?: 'anggota' | 'pengurus' | 'guru';
  status?: string;
  joinedAt: string;
  jemaatId?: string;
  komisiId: KomisiId;
  photoUrl?: string;
}

interface AbsenSession {
  id: string;
  komisiId: KomisiId;
  title: string;
  date: string;
  createdAt: string;
  presentIds: string[];
  absentIds: string[];
}

interface JemaatMember {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  birthDate?: string;
  photoUrl?: string;
  role?: 'anggota' | 'pengurus' | 'guru';
  status?: string;
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-gray-100 text-gray-500 border-gray-200',
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  visitor: 'bg-amber-50 text-amber-800 border-amber-200',
  visitors: 'bg-amber-50 text-amber-800 border-amber-200',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Aktif',
  inactive: 'Tidak Aktif',
  new: 'Jemaat Baru',
  visitor: 'Visitors',
  visitors: 'Visitors',
};

interface MatchResult {
  jemaat: JemaatMember;
  score: number;
  reasons: string[];
}

// ── Matching algorithm ────────────────────────────────────────────────────────
function calcMatchScore(
  candidate: { name: string; phone?: string; address?: string; birthDate?: string },
  jemaat: JemaatMember
): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  const cName = candidate.name.toLowerCase().trim();
  const jName = jemaat.name.toLowerCase().trim();

  if (cName === jName) { score += 50; reasons.push('nama sama persis'); }
  else if (cName.includes(jName) || jName.includes(cName)) { score += 25; reasons.push('nama mirip'); }
  else {
    const cWords = cName.split(' ').filter(w => w.length > 2);
    const jWords = jName.split(' ').filter(w => w.length > 2);
    const overlap = cWords.filter(w => jWords.includes(w)).length;
    if (overlap >= 2) { score += 20; reasons.push(`${overlap} kata nama cocok`); }
    else if (overlap === 1) { score += 8; }
  }

  if (candidate.birthDate && jemaat.birthDate && candidate.birthDate === jemaat.birthDate) {
    score += 40; reasons.push('tanggal lahir sama');
  }

  if (candidate.phone && jemaat.phone) {
    const pC = candidate.phone.replace(/\D/g, '').slice(-8);
    const pJ = jemaat.phone.replace(/\D/g, '').slice(-8);
    if (pC.length >= 6 && pC === pJ) { score += 20; reasons.push('nomor HP sama'); }
  }

  if (candidate.address && jemaat.address) {
    const aC = candidate.address.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 25);
    const aJ = jemaat.address.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 25);
    if (aC.length > 8 && aJ.includes(aC.slice(0, 15))) { score += 15; reasons.push('alamat cocok'); }
  }

  return { jemaat, score, reasons };
}

function formatDate(iso: string) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const isoDate = fmt;

/** The Sunday that ends the current Mon–Sun week (today if it is Sunday). Attendance resets every Monday. */
function currentWeekSunday(): string {
  const d = new Date();
  if (d.getDay() === 0 && d.getHours() < 8) d.setDate(d.getDate() - 7);
  else d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return isoDate(d);
}

/** Age bands of the age-based komisi; used to flag members who have outgrown theirs. */
const KOMISI_AGE_RANGE: Record<string, [number, number]> = { 'sekolah-minggu': [0, 12], teens: [13, 17], vessel: [18, 30] };

export function KomisiBadge({ id }: { id: string }) {
  const k = KOMISI_LIST.find(k => k.id === id);
  if (!k) return null;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${k.color}`}>{k.label}</span>;
}

const monthLabel = (y: number, m: number) =>
  new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

function formatDateLabel(dateStr: string) {
  if (!dateStr) return 'Pilih Tanggal';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const dayName = d.toLocaleDateString('id-ID', { weekday: 'long' });
  return `${dayName}, ${parts[2]} ${MONTH_SHORT[Number(parts[1]) - 1]} ${parts[0]}`;
}

function getWeekInfo(dateStr: string) {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = d.getDay(); // 0 is Sun, 1 is Mon
  const diffToMonday = day === 0 ? -6 : 1 - day;
  
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    dates.push(fmt(cur));
  }

  return {
    monday: fmt(monday),
    sunday: fmt(sunday),
    dates,
    sundayDate: fmt(sunday),
  };
}

// ── Member Avatar with photo and initials ───────────────────────────────────
function MemberAvatar({ name, photoUrl, present }: { name: string; photoUrl?: string; present: boolean }) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  if (photoUrl && !imgError) {
    return (
      <div className="relative flex-shrink-0">
        <img
          src={photoUrl}
          alt={name}
          onError={() => setImgError(true)}
          className={`w-11 h-11 rounded-full object-cover border-2 transition-all ${
            present ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-gray-200'
          }`}
        />
        {present && (
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
        )}
      </div>
    );
  }

  return (
    <div
      className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all ${
        present
          ? 'bg-emerald-500 text-white shadow-xs ring-2 ring-emerald-200'
          : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 border border-slate-200'
      }`}
    >
      {initials || '?'}
    </div>
  );
}

// ── Interactive Calendar Modal for Komisi Attendance ────────────────────────
function KomisiCalendarModal({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
  sessions,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  sessions: AbsenSession[];
}) {
  const initialDate = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear() || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState((initialDate.getMonth() + 1) || (new Date().getMonth() + 1));

  useEffect(() => {
    if (selectedDate && isOpen) {
      const parts = selectedDate.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setViewYear(parts[0]);
        setViewMonth(parts[1]);
      }
    }
  }, [selectedDate, isOpen]);

  if (!isOpen) return null;

  const firstDayOfMonth = new Date(viewYear, viewMonth - 1, 1);
  const startDay = firstDayOfMonth.getDay(); // 0 is Sun, 1 is Mon
  const offset = startDay === 0 ? 6 : startDay - 1; // Mon = 0, Sun = 6

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const days: { dateStr: string; dayNum: number; isSunday: boolean }[] = [];

  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(viewYear, viewMonth - 1, i);
    const dateStr = fmt(d);
    days.push({
      dateStr,
      dayNum: i,
      isSunday: d.getDay() === 0,
    });
  }

  const selectedWeek = getWeekInfo(selectedDate || fmt(new Date()));
  const todayStr = fmt(new Date());
  const thisWeekSundayStr = currentWeekSunday();

  const sessionMap = new Map<string, number>();
  sessions.forEach(s => {
    if (s.date) {
      sessionMap.set(s.date, (s.presentIds || []).length);
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <CalendarIcon size={17} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Kalender Absensi Komisi</h3>
              <p className="text-[11px] text-indigo-200/80">Pilih tanggal ibadah / kegiatan komisi</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Year Navigator & Slider */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-1">
              <button 
                type="button" 
                onClick={() => setViewYear(y => Math.max(2015, y - 5))} 
                className="px-2 py-1 rounded-xl hover:bg-white text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer border border-transparent hover:border-slate-200 text-xs font-bold"
                title="-5 Tahun"
              >
                &laquo; 5th
              </button>
              <button 
                type="button" 
                onClick={() => setViewYear(y => Math.max(2015, y - 1))} 
                className="p-1.5 rounded-xl hover:bg-white text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                title="Tahun Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tahun:</span>
                <select
                  value={viewYear}
                  onChange={e => setViewYear(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1 text-sm font-extrabold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-2xs"
                >
                  {Array.from({ length: 31 }, (_, i) => 2015 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <button 
                type="button" 
                onClick={() => setViewYear(y => Math.min(2045, y + 1))} 
                className="p-1.5 rounded-xl hover:bg-white text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                title="Tahun Selanjutnya"
              >
                <ChevronRight size={16} />
              </button>
              <button 
                type="button" 
                onClick={() => setViewYear(y => Math.min(2045, y + 5))} 
                className="px-2 py-1 rounded-xl hover:bg-white text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer border border-transparent hover:border-slate-200 text-xs font-bold"
                title="+5 Tahun"
              >
                5th &raquo;
              </button>
            </div>

            <div className="pt-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1 px-1">
                <span>2015</span>
                <span className="text-indigo-700 font-extrabold text-xs bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                  Tahun: {viewYear}
                </span>
                <span>2045</span>
              </div>
              <input
                type="range"
                min={2015}
                max={2045}
                value={viewYear}
                onChange={e => setViewYear(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 transition-all"
              />
            </div>
          </div>

          {/* Month Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Pilih Bulan</span>
              <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-lg">
                {monthLabel(viewYear, viewMonth)}
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              {['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'].map((mName, idx) => {
                const mNum = idx + 1;
                const isSelected = viewMonth === mNum;
                return (
                  <button
                    key={mNum}
                    type="button"
                    onClick={() => setViewMonth(mNum)}
                    className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs scale-102 ring-2 ring-indigo-400/30'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70'
                    }`}
                  >
                    {mName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 pt-2 border-t border-slate-100">
            <span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span className="text-rose-500 font-extrabold">Min</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: offset }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-12 rounded-xl opacity-0" />
            ))}

            {days.map(d => {
              const count = sessionMap.get(d.dateStr);
              const inSelectedWeek = selectedWeek.dates.includes(d.dateStr);
              const isSelectedDate = selectedDate === d.dateStr;
              const isToday = d.dateStr === todayStr;

              return (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => {
                    onSelectDate(d.dateStr);
                    onClose();
                  }}
                  className={`h-12 rounded-xl p-1 flex flex-col items-center justify-between transition-all cursor-pointer border ${
                    isSelectedDate
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md font-bold ring-2 ring-blue-300'
                      : inSelectedWeek
                      ? 'bg-blue-50/70 border-blue-200 text-blue-900 font-semibold'
                      : d.isSunday
                      ? 'bg-rose-50/40 border-rose-100 text-rose-700 hover:bg-rose-50'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700'
                  } ${isToday && !isSelectedDate ? 'ring-2 ring-amber-400' : ''}`}
                >
                  <span className="text-xs leading-none font-bold">{d.dayNum}</span>
                  {count !== undefined ? (
                    <span
                      className={`text-[9px] px-1 py-0.5 rounded-full font-extrabold leading-none ${
                        isSelectedDate
                          ? 'bg-white text-blue-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                      title={`${count} anggota hadir`}
                    >
                      {count}
                    </span>
                  ) : d.isSunday ? (
                    <span className="text-[8px] text-rose-400">ibadah</span>
                  ) : (
                    <span className="h-1.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Selection Buttons */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-[11px] font-medium text-slate-600">Ada Data Absen</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onSelectDate(todayStr);
                  onClose();
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer transition-colors text-[11px]"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectDate(thisWeekSundayStr);
                  onClose();
                }}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg cursor-pointer transition-colors text-[11px]"
              >
                Minggu Ini
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function KomisiManagement() {
  const { user, accessToken } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const permissions = user?.permissions;

  // Which komisi this user can see
  const visibleKomisi = useMemo(() => {
    if (isSuperAdmin || permissions?.editKomisi || permissions?.viewKomisi) return [...KOMISI_LIST];
    const leaderOf = permissions?.komisiLeaderOf || [];
    const visible = KOMISI_LIST.filter(k => leaderOf.includes(k.id));
    return visible;
  }, [isSuperAdmin, permissions]);

  const [searchParams] = useSearchParams();
  const komisiParam = searchParams.get('komisi');

  const [activeKomisi, setActiveKomisi] = useState<KomisiId>(() => {
    if (komisiParam) {
      const match = KOMISI_LIST.find(k => k.id === komisiParam || k.label.toLowerCase() === komisiParam.toLowerCase());
      if (match) return match.id as KomisiId;
    }
    return (visibleKomisi[0]?.id as KomisiId) ?? 'sekolah-minggu';
  });

  useEffect(() => {
    if (komisiParam) {
      const match = KOMISI_LIST.find(k => k.id === komisiParam || k.label.toLowerCase() === komisiParam.toLowerCase());
      if (match) {
        setActiveKomisi(match.id as KomisiId);
      }
    }
  }, [komisiParam]);

  const [tab, setTab] = useState<Tab>('anggota');

  const canEdit = isSuperAdmin || permissions?.editKomisi ||
    (permissions?.komisiLeaderOf || []).includes(activeKomisi);

  const [members, setMembers] = useState<KomisiMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [jemaatList, setJemaatList] = useState<JemaatMember[]>([]);

  const [sessions, setSessions] = useState<AbsenSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => currentWeekSunday());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [activeSession, setActiveSession] = useState<AbsenSession | null>(null);
  const [draftPresentIds, setDraftPresentIds] = useState<Set<string>>(new Set());
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceSaved, setAttendanceSaved] = useState(true);

  // Member form
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editMember, setEditMember] = useState<KomisiMember | null>(null);
  const [memberForm, setMemberForm] = useState({ name: '', phone: '', address: '', birthDate: '', role: 'anggota' as 'anggota' | 'pengurus' | 'guru' });
  const [savingMember, setSavingMember] = useState(false);
  const [selectedJemaatId, setSelectedJemaatId] = useState('');
  const [linkSearch, setLinkSearch] = useState('');

  // Session form
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionForm, setSessionForm] = useState({ title: '', date: new Date().toISOString().slice(0, 10) });
  const [savingSession, setSavingSession] = useState(false);

  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [deletingMember, setDeletingMember] = useState<KomisiMember | null>(null);

  const komisiInfo = KOMISI_LIST.find(k => k.id === activeKomisi)!;

  // ── Load jemaat directly from kv_store (union both formats) ─────────────
  const loadJemaat = useCallback(async () => {
    try {
      const toJ = (r: any): JemaatMember | null => {
        const m = r.value as any;
        if (!m?.name) return null;
        return { 
          id: m.id || r.key, 
          name: m.name, 
          phone: m.phone || '', 
          address: m.address || '', 
          birthDate: m.birthDate || '',
          photoUrl: m.photoUrl || undefined,
          status: m.status || 'active',
        };
      };

      const [{ data: d1 }, { data: d2 }] = await Promise.all([
        supabaseAdmin.from(KV).select('key, value').like('key', 'congregation:member:%'),
        supabaseAdmin.from(KV).select('key, value').like('key', 'member:%'),
      ]);

      const seen = new Set<string>();
      const list: JemaatMember[] = [];
      for (const r of [...(d1 || []), ...(d2 || [])]) {
        const j = toJ(r);
        if (j && !seen.has(j.id)) { seen.add(j.id); list.push(j); }
      }
      list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      setJemaatList(list);
    } catch {}
  }, []);

  // ── Load komisi members ───────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const { data, error: err } = await supabaseAdmin
        .from(KV).select('key, value')
        .like('key', `komisi:${activeKomisi}:member:%`);
      if (err) throw err;
      const list = (data ?? []).map((r: any) => r.value as KomisiMember).filter(Boolean);
      list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      setMembers(list);
    } catch (e: any) { setError(e.message); }
    setLoadingMembers(false);
  }, [activeKomisi]);

  // ── Load attendance sessions ──────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const { data, error: err } = await supabaseAdmin
        .from(KV).select('key, value')
        .like('key', `komisi:${activeKomisi}:absen:%`);
      if (err) throw err;
      const list = (data ?? []).map((r: any) => r.value as AbsenSession).filter(Boolean);

      // Tidy up: clean up old empty blank sessions
      const blanks = list.filter(x => x.id.startsWith('week-') && (x.presentIds || []).length + (x.absentIds || []).length === 0);
      if (blanks.length > 0) {
        for (let i = 0; i < blanks.length; i += 10) {
          await Promise.all(blanks.slice(i, i + 10).map(x => supabaseAdmin.from(KV).delete().eq('key', `komisi:${activeKomisi}:absen:${x.id}`)));
        }
      }
      const kept = list.filter(x => !blanks.includes(x));
      kept.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setSessions(kept);
    } catch (e: any) { setError(e.message); }
    setLoadingSessions(false);
  }, [activeKomisi]);

  const changeDateByDays = (days: number) => {
    const parts = selectedDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + days);
    setSelectedDate(fmt(d));
  };

  useEffect(() => { loadJemaat(); }, [loadJemaat]);
  useEffect(() => {
    setDraftPresentIds(new Set()); setAttendanceSaved(true); setSearch('');
    loadMembers(); loadSessions();
  }, [activeKomisi]);

  // Sync activeSession whenever selectedDate, sessions, or activeKomisi change
  useEffect(() => {
    if (loadingSessions) return;
    const found = sessions.find(s => s.date === selectedDate);
    if (found) {
      setActiveSession(found);
    } else {
      const dt = new Date(selectedDate + 'T00:00:00');
      const isSun = dt.getDay() === 0;
      const title = isSun
        ? `Ibadah Minggu ${dt.getDate()} ${MONTH_SHORT[dt.getMonth()]} ${dt.getFullYear()}`
        : `Kegiatan Komisi ${dt.getDate()} ${MONTH_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
      setActiveSession({
        id: `session-${activeKomisi}-${selectedDate}`,
        komisiId: activeKomisi,
        date: selectedDate,
        title,
        createdAt: new Date().toISOString(),
        presentIds: [],
        absentIds: [],
      });
    }
  }, [selectedDate, sessions, activeKomisi, loadingSessions]);

  useEffect(() => { 
    setDraftPresentIds(new Set(activeSession?.presentIds || [])); 
    setAttendanceSaved(true); 
  }, [activeSession?.id, activeSession?.date]);

  // ── Jemaat lookup map ─────────────────────────────────────────────────────
  const jemaatMap = useMemo(() => {
    const m: Record<string, JemaatMember> = {};
    jemaatList.forEach(j => { m[j.id] = j; });
    return m;
  }, [jemaatList]);

  // ── Live suggestions when typing in form ─────────────────────────────────
  const formSuggestions = useMemo((): MatchResult[] => {
    // Manual link-search: simple substring, always shows results
    if (linkSearch.length >= 2) {
      const q = linkSearch.toLowerCase().trim();
      return jemaatList
        .filter(j => j.name.toLowerCase().includes(q))
        .map(j => ({ jemaat: j, score: 100, reasons: ['pencarian manual'] }))
        .slice(0, 10);
    }
    // Auto-suggest from form data
    if (!memberForm.name.trim() || memberForm.name.length < 2) return [];
    return jemaatList
      .map(j => calcMatchScore({
        name: memberForm.name,
        phone: memberForm.phone,
        address: memberForm.address,
        birthDate: memberForm.birthDate,
      }, j))
      .filter(r => r.score >= 50)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [linkSearch, memberForm, jemaatList]);

  // Auto-suggestions when name/birthDate/address filled
  const autoSuggestion = useMemo((): MatchResult | null => {
    if (!memberForm.name.trim()) return null;
    const results = jemaatList
      .map(j => calcMatchScore({
        name: memberForm.name,
        phone: memberForm.phone,
        address: memberForm.address,
        birthDate: memberForm.birthDate,
      }, j))
      .filter(r => r.score >= 80)
      .sort((a, b) => b.score - a.score);
    return results[0] ?? null;
  }, [memberForm, jemaatList]);


  // ── Member CRUD ───────────────────────────────────────────────────────────
  const filteredMembers = useMemo(() =>
    members.filter(m => m.name.toLowerCase().includes(search.toLowerCase())),
    [members, search]);

  const linkedCount = members.filter(m => m.jemaatId && jemaatMap[m.jemaatId]).length;

  const openAddMember = () => {
    setEditMember(null);
    setMemberForm({ name: '', phone: '', address: '', birthDate: '', role: 'anggota' });
    setSelectedJemaatId(''); setLinkSearch('');
    setShowMemberForm(true);
  };

  const openEditMember = (m: KomisiMember) => {
    setEditMember(m);
    const linked = m.jemaatId ? jemaatMap[m.jemaatId] : null;
    const resolvedBirthDate = m.birthDate || linked?.birthDate || '';
    const resolvedPhone = m.phone || linked?.phone || '';
    const resolvedAddress = m.address || linked?.address || '';

    setMemberForm({
      name: m.name,
      phone: resolvedPhone,
      address: resolvedAddress,
      birthDate: resolvedBirthDate,
      role: m.role || 'anggota',
    });
    setSelectedJemaatId(m.jemaatId || '');
    setLinkSearch('');
    setShowMemberForm(true);
  };

  const selectJemaatToForm = (j: JemaatMember) => {
    setSelectedJemaatId(j.id);
    setMemberForm(prev => ({
      ...prev,
      name: j.name || prev.name,
      phone: j.phone || prev.phone,
      address: j.address || prev.address,
      birthDate: j.birthDate || prev.birthDate,
    }));
    setLinkSearch('');
  };

  const handleSaveMember = async () => {
    if (!memberForm.name.trim()) return;
    setSavingMember(true);
    try {
      const id = editMember?.id || crypto.randomUUID();
      const member: KomisiMember = {
        id,
        komisiId: activeKomisi,
        name: memberForm.name.trim(),
        phone: memberForm.phone.trim(),
        address: memberForm.address.trim(),
        birthDate: memberForm.birthDate,
        role: memberForm.role,
        joinedAt: editMember?.joinedAt || new Date().toISOString(),
        ...(selectedJemaatId ? { jemaatId: selectedJemaatId } : {}),
      };
      const key = `komisi:${activeKomisi}:member:${id}`;
      if (editMember) {
        await supabaseAdmin.from(KV).update({ value: member }).eq('key', key);
      } else {
        await supabaseAdmin.from(KV).insert({ key, value: member });
      }

      // If linked to Data Jemaat, sync updated info back to Data Jemaat if exists
      if (selectedJemaatId) {
        try {
          const rawId = selectedJemaatId.replace(/^congregation:member:/, '').replace(/^member:/, '');
          const primaryJemaatKey = `congregation:member:${rawId}`;
          const legacyJemaatKey = `member:${rawId}`;
          const { data: jRow } = await supabaseAdmin.from(KV).select('key, value').eq('key', primaryJemaatKey).maybeSingle()
            || await supabaseAdmin.from(KV).select('key, value').eq('key', legacyJemaatKey).maybeSingle()
            || await supabaseAdmin.from(KV).select('key, value').eq('key', selectedJemaatId).maybeSingle();

          if (jRow && jRow.value) {
            const updatedJemaat = {
              ...jRow.value,
              name: memberForm.name.trim(),
              birthDate: memberForm.birthDate || jRow.value.birthDate,
              phone: memberForm.phone.trim() || jRow.value.phone,
              address: memberForm.address.trim() || jRow.value.address,
              updatedAt: new Date().toISOString(),
            };
            const targetKey = jRow.key || primaryJemaatKey;
            await supabaseAdmin.from(KV).update({ value: updatedJemaat }).eq('key', targetKey);
          }
        } catch (syncErr) {
          console.warn('Sync back to jemaat error (non-fatal):', syncErr);
        }
      }

      setShowMemberForm(false);
      await Promise.all([loadMembers(), loadJemaat()]);
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan anggota');
    }
    setSavingMember(false);
  };

  const handleDeleteMember = (m: KomisiMember) => setDeletingMember(m);

  const confirmDeleteMember = async () => {
    if (!deletingMember) return;
    await supabaseAdmin.from(KV).delete().eq('key', `komisi:${activeKomisi}:member:${deletingMember.id}`);
    setDeletingMember(null);
    loadMembers();
  };

  // ── Attendance ────────────────────────────────────────────────────────────
  const handleCreateSession = async () => {
    if (!sessionForm.title.trim() || !sessionForm.date) return;
    setSavingSession(true);
    try {
      const id = crypto.randomUUID();
      const session: AbsenSession = {
        id, komisiId: activeKomisi,
        title: sessionForm.title.trim(), date: sessionForm.date,
        createdAt: new Date().toISOString(), presentIds: [], absentIds: [],
      };
      await supabaseAdmin.from(KV).insert({ key: `komisi:${activeKomisi}:absen:${id}`, value: session });
      setShowSessionForm(false);
      setSessionForm({ title: '', date: new Date().toISOString().slice(0, 10) });
      await loadSessions();
      setActiveSession(session);
    } catch (e: any) { setError(e.message); }
    setSavingSession(false);
  };

  const toggleAttendance = (id: string) => {
    if (!canEdit) return;
    setDraftPresentIds(old => {
      const next = new Set(old);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setAttendanceSaved(false);
  };

  const markAll = (present: boolean) => {
    if (!canEdit) return;
    setDraftPresentIds(new Set(present ? members.map(m => m.id) : []));
    setAttendanceSaved(false);
  };

  const saveAttendance = async () => {
    if (!activeSession || !canEdit) return;
    setSavingAttendance(true);
    setError('');
    try {
      const presentIds = [...draftPresentIds];
      const absentIds = members.map(m => m.id).filter(id => !draftPresentIds.has(id));
      const updated: AbsenSession = {
        ...activeSession,
        presentIds,
        absentIds,
      };
      const kv = supabaseAdmin.from(KV);
      const result = typeof (kv as any).upsert === 'function'
        ? await (kv as any).upsert({
            key: `komisi:${activeKomisi}:absen:${activeSession.id}`,
            value: updated,
          })
        : await kv.insert({
            key: `komisi:${activeKomisi}:absen:${activeSession.id}`,
            value: updated,
          });
      if (result.error) throw result.error;
      setActiveSession(updated);
      setSessions(old => {
        const idx = old.findIndex(x => x.id === updated.id || x.date === updated.date);
        if (idx >= 0) {
          const next = [...old];
          next[idx] = updated;
          return next;
        }
        return [updated, ...old].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      });
      setAttendanceSaved(true);
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan absensi');
    } finally {
      setSavingAttendance(false);
    }
  };

  const [deletingSession, setDeletingSession] = useState<AbsenSession | null>(null);

  const handleDeleteSession = (session: AbsenSession) => setDeletingSession(session);

  const confirmDeleteSession = async () => {
    if (!deletingSession) return;
    await supabaseAdmin.from(KV).delete().eq('key', `komisi:${activeKomisi}:absen:${deletingSession.id}`);
    if (activeSession?.id === deletingSession.id) setActiveSession(null);
    setDeletingSession(null);
    loadSessions();
  };

  // ── Excel exports ─────────────────────────────────────────────────────────
  const exportMembers = () => {
    const rows = members.map(m => ({
      'Nama': m.name,
      'No. Telepon': m.phone,
      'Alamat Domisili': m.address || '',
      'Tanggal Lahir': m.birthDate || '',
      'Peran': m.role === 'pengurus' ? 'Pengurus' : m.role === 'guru' ? 'Guru' : 'Anggota',
      'Bergabung': formatDate(m.joinedAt),
      'Status Jemaat Umum': m.jemaatId && jemaatMap[m.jemaatId] ? 'Terdaftar' : 'Belum di database umum',
      'Komisi': komisiInfo.label,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Anggota');
    XLSX.writeFile(wb, `Komisi_${komisiInfo.label.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportAttendance = (session: AbsenSession) => {
    const rows = members.map(m => ({
      'Nama': m.name, 'No. Telepon': m.phone,
      'Status': session.presentIds.includes(m.id) ? 'Hadir'
        : session.absentIds.includes(m.id) ? 'Tidak Hadir' : 'Belum dicatat',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Absensi');
    XLSX.writeFile(wb, `Absen_${komisiInfo.label.replace(/\s+/g, '_')}_${session.date}.xlsx`);
  };

  // ── No access ─────────────────────────────────────────────────────────────
  if (visibleKomisi.length === 0) {
    return (
      <div className="p-12 text-center text-gray-400">
        <ShieldAlert size={48} className="mx-auto mb-4 opacity-40" />
        <p className="font-semibold text-gray-600">Tidak ada akses komisi</p>
        <p className="text-sm mt-1">Hubungi Super Admin untuk mendapatkan akses komisi.</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Komisi</h1>
          <p className="text-gray-500 text-sm mt-0.5">Data anggota & absensi per komisi gereja</p>
        </div>
        <div className="relative">
          <select value={activeKomisi} onChange={e => setActiveKomisi(e.target.value as KomisiId)}
            className="appearance-none bg-white border border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm cursor-pointer">
            {visibleKomisi.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-2 sm:gap-4 mb-6 flex-wrap text-xs sm:text-sm">
        <KomisiBadge id={activeKomisi} />
        <span className="flex items-center gap-1 text-gray-600 bg-gray-100 sm:bg-transparent px-2.5 sm:px-0 py-1 sm:py-0 rounded-lg"><Users size={13} />{members.length} anggota</span>
        <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 sm:bg-transparent px-2.5 sm:px-0 py-1 sm:py-0 rounded-lg"><Link size={13} />{linkedCount} terhubung ke umum</span>
        {members.length - linkedCount > 0 && (
          <span className="flex items-center gap-1 text-amber-700 bg-amber-50 sm:bg-transparent px-2.5 sm:px-0 py-1 sm:py-0 rounded-lg">
            <AlertTriangle size={13} />{members.length - linkedCount} belum di db umum
          </span>
        )}
        {!canEdit && (
          <span className="flex items-center gap-1 text-gray-400"><Info size={12} />View only</span>
        )}
        <button onClick={() => { loadMembers(); loadSessions(); }} className="text-gray-400 hover:text-gray-600 p-2 sm:p-1 ml-auto min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl active:bg-gray-100 transition-colors" title="Segarkan Data">
          <RefreshCw size={15} />
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle size={15} />{error}
          <button onClick={() => setError('')} className="ml-auto p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center"><X size={14} /></button>
        </div>
      )}

      {!canEdit && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm">
          Anda hanya memiliki akses <strong>view-only</strong>. Hubungi Super Admin untuk akses edit.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 bg-gray-100 rounded-2xl p-1.5 mb-6 w-full sm:w-fit overflow-x-auto no-scrollbar">
        {(['anggota', 'absensi', 'laporan'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 sm:flex-none justify-center px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'anggota'
              ? <span className="flex items-center justify-center gap-1.5"><Users size={15} />Data Anggota</span>
              : t === 'absensi'
                ? <span className="flex items-center justify-center gap-1.5"><ClipboardList size={15} />Absensi</span>
                : <span className="flex items-center justify-center gap-1.5"><Calendar size={15} />Laporan</span>}
          </button>
        ))}
      </div>

      {/* ── ANGGOTA TAB ── */}
      {tab === 'anggota' && (
        <div>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Cari anggota..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <button onClick={exportMembers}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
              <Download size={14} />Export
            </button>
            {canEdit && (
              <button onClick={openAddMember}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-colors">
                <Plus size={15} />Tambah Anggota
              </button>
            )}
          </div>

          {loadingMembers ? (
            <div className="text-center py-16 text-gray-400">Memuat data...</div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users size={40} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">Belum ada anggota di {komisiInfo.label}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map(m => {
                const linked = m.jemaatId ? jemaatMap[m.jemaatId] : null;
                const notInDb = !linked;
                const jMember = linked || jemaatList.find(j => j.name.toLowerCase().trim() === m.name.toLowerCase().trim());
                const memberStatus = jMember?.status || m.status || 'active';
                // Linked members always follow Data Jemaat; the age is computed today, so it rolls over on each birthday.
                const birthDate = linked?.birthDate || m.birthDate || '';
                const age = birthDate ? getAge(birthDate) : -1;
                const range = KOMISI_AGE_RANGE[activeKomisi];
                const outOfRange = !!range && age >= 0 && (age < range[0] || age > range[1]);
                return (
                  <div key={m.id} className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:shadow-sm ${notInDb ? 'border-amber-200 bg-amber-50/20' : 'border-gray-200/80 hover:border-blue-200'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm shadow-2xs">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          {/* Nama & Status Terhubung */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-gray-900 text-sm sm:text-base leading-tight break-words">{m.name}</h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[memberStatus] || STATUS_STYLE.active}`}>
                              {STATUS_LABEL[memberStatus] || memberStatus}
                            </span>
                            {linked ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                <Link size={11} className="text-emerald-600" /> Terhubung ke Jemaat Umum
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                <AlertTriangle size={11} className="text-amber-600" /> Belum di database jemaat umum
                              </span>
                            )}
                          </div>

                          {/* Detail Badges: Usia & Rentang Komisi */}
                          <div className="flex items-center gap-2 flex-wrap mt-2">
                            {age >= 0 && (
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${AGE_GROUP_STYLES[getAgeGroup(birthDate)]}`}>
                                {age} thn ({getAgeGroup(birthDate)})
                              </span>
                            )}
                            {outOfRange && (
                              <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                Usia di luar rentang komisi
                              </span>
                            )}
                          </div>

                          {/* Data Rinci: HP, Tgl Lahir, Alamat */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
                            {m.phone && (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Phone size={13} className="text-emerald-500 flex-shrink-0" />
                                <a
                                  href={`https://wa.me/${m.phone.replace(/\D/g, '').replace(/^0/, '62')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-600 font-medium hover:underline truncate"
                                >
                                  {m.phone}
                                </a>
                              </div>
                            )}
                            {birthDate && (
                              <div className="flex items-center gap-1.5 min-w-0 text-gray-600">
                                <Calendar size={13} className="text-pink-400 flex-shrink-0" />
                                <span>{formatDate(birthDate)}</span>
                              </div>
                            )}
                            {m.address && (
                              <div className="flex items-center gap-1.5 min-w-0 sm:col-span-2 lg:col-span-1 text-gray-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                                <span className="truncate" title={m.address}>{m.address}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {canEdit && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditMember(m)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
                            title="Edit data anggota"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(m)}
                            className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                            title="Hapus dari komisi"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'laporan' && (
        <KomisiReport
          komisiLabel={KOMISI_LIST.find(k => k.id === activeKomisi)?.label || ''}
          sessions={sessions}
          members={members.map(m => ({ id: m.id, name: m.name }))}
        />
      )}

      {/* ── ABSENSI TAB: Dynamic Date & Enhanced UI ── */}
      {tab === 'absensi' && (
        <div className="space-y-4">
          <KomisiCalendarModal
            isOpen={calendarOpen}
            onClose={() => setCalendarOpen(false)}
            selectedDate={selectedDate}
            onSelectDate={(newDate) => {
              setSelectedDate(newDate);
            }}
            sessions={sessions}
          />

          {loadingSessions || !activeSession ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-xs">
              <RefreshCw size={28} className="animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">Memuat data absensi...</p>
              <p className="text-xs text-slate-400 mt-1">Mengambil sesi untuk tanggal {formatDateLabel(selectedDate)}</p>
            </div>
          ) : (
            <>
              {/* Header Card: Calendar date picker, navigation & stats */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left: Date selector & Navigation */}
                  <div className="space-y-2.5 w-full lg:w-auto">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1">
                        {selectedDate === fmt(new Date()) ? 'Hari Ini' : selectedDate === currentWeekSunday() ? 'Minggu Ini' : 'Sesi Terpilih'}
                      </span>
                      {sessions.some(s => s.date === selectedDate && (s.presentIds || []).length > 0) && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Tersimpan di Database
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      {/* Big Interactive Calendar Button */}
                      <button
                        type="button"
                        onClick={() => setCalendarOpen(true)}
                        className="group flex items-center justify-between sm:justify-start gap-2.5 bg-gradient-to-r from-slate-900 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-white px-4 py-3 min-h-[48px] rounded-2xl shadow-sm active:scale-[0.98] transition-all cursor-pointer text-left w-full sm:w-auto"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-white/10 group-hover:bg-white/20 flex items-center justify-center text-indigo-200 shrink-0 transition-colors">
                            <CalendarIcon size={17} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] font-medium text-indigo-200/80 uppercase tracking-wider">Pilih Tanggal</div>
                            <div className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 truncate">
                              <span>{formatDateLabel(selectedDate)}</span>
                              <ChevronDown size={15} className="text-indigo-300 group-hover:translate-y-0.5 transition-transform shrink-0" />
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Quick Day Stepper */}
                      <div className="flex items-center justify-between sm:justify-start bg-slate-100 p-1 rounded-2xl border border-slate-200/80 min-h-[44px]">
                        <button
                          type="button"
                          onClick={() => changeDateByDays(-1)}
                          title="Hari Sebelumnya"
                          className="p-2.5 sm:p-2 min-h-[40px] min-w-[40px] flex items-center justify-center hover:bg-white active:bg-white text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDate(fmt(new Date()))}
                          className="flex-1 sm:flex-none text-center px-4 py-2 min-h-[40px] flex items-center justify-center text-xs font-bold text-slate-700 hover:bg-white active:bg-white rounded-xl transition-all cursor-pointer"
                        >
                          Hari Ini
                        </button>
                        <button
                          type="button"
                          onClick={() => changeDateByDays(1)}
                          title="Hari Selanjutnya"
                          className="p-2.5 sm:p-2 min-h-[40px] min-w-[40px] flex items-center justify-center hover:bg-white active:bg-white text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick actions (Hadir Semua, Reset, Export) */}
                  <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full lg:w-auto">
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => markAll(true)}
                          className="text-xs font-bold px-3 py-2.5 min-h-[44px] justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Check size={14} className="shrink-0" /> <span className="truncate">Hadir Semua</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => markAll(false)}
                          className="text-xs font-bold px-3 py-2.5 min-h-[44px] justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer flex items-center"
                        >
                          <span>Reset</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => exportAttendance(activeSession)}
                      className={`flex items-center justify-center gap-1.5 text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2.5 min-h-[44px] rounded-xl active:scale-[0.98] transition-all cursor-pointer shadow-2xs ${!canEdit ? 'col-span-3' : ''}`}
                    >
                      <Download size={14} className="shrink-0" /> <span className="truncate">Export Excel</span>
                    </button>
                  </div>
                </div>

                {/* Progress bar and statistics */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-700 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <strong>{draftPresentIds.size}</strong> Hadir
                      </span>
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                        <strong>{Math.max(0, members.length - draftPresentIds.size)}</strong> Belum Hadir
                      </span>
                    </div>
                    <span className="text-slate-600 font-bold">
                      {members.length > 0 ? Math.round((draftPresentIds.size / members.length) * 100) : 0}% Kehadiran
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${members.length > 0 ? Math.round((draftPresentIds.size / members.length) * 100) : 0}%` }}
                    />
                  </div>
                </div>

                {/* Filter tabs & Member Search bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setAttendanceFilter('all')}
                      className={`flex-1 sm:flex-initial text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        attendanceFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua ({members.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceFilter('present')}
                      className={`flex-1 sm:flex-initial text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        attendanceFilter === 'present'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-emerald-700'
                      }`}
                    >
                      Hadir ({draftPresentIds.size})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceFilter('absent')}
                      className={`flex-1 sm:flex-initial text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        attendanceFilter === 'absent'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-rose-700'
                      }`}
                    >
                      Belum Hadir ({Math.max(0, members.length - draftPresentIds.size)})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari nama anggota..."
                      value={attendanceSearch}
                      onChange={e => setAttendanceSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                    />
                    {attendanceSearch && (
                      <button
                        type="button"
                        onClick={() => setAttendanceSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Members Attendance List */}
              {(() => {
                const filteredMembers = members.filter(m => {
                  if (attendanceFilter === 'present' && !draftPresentIds.has(m.id)) return false;
                  if (attendanceFilter === 'absent' && draftPresentIds.has(m.id)) return false;
                  if (attendanceSearch.trim()) {
                    const q = attendanceSearch.toLowerCase();
                    const nameMatch = m.name.toLowerCase().includes(q);
                    const phoneMatch = m.phone.toLowerCase().includes(q);
                    return nameMatch || phoneMatch;
                  }
                  return true;
                });

                if (filteredMembers.length === 0) {
                  return (
                    <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-xs">
                      <Users size={32} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">Tidak ada anggota yang cocok</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {attendanceSearch ? `Tidak ditemukan anggota dengan kata kunci "${attendanceSearch}"` : 'Belum ada data untuk filter ini.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {filteredMembers.map(m => {
                      const isPresent = draftPresentIds.has(m.id);
                      const jMember = (m.jemaatId ? jemaatMap[m.jemaatId] : undefined) || jemaatList.find(j => j.name.toLowerCase().trim() === m.name.toLowerCase().trim());
                      const memberStatus = jMember?.status || m.status || 'active';
                      const photoUrl = jMember?.photoUrl || m.photoUrl;
                      const birthDate = jMember?.birthDate || m.birthDate;
                      const age = birthDate ? getAge(birthDate) : -1;

                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            if (canEdit) toggleAttendance(m.id);
                          }}
                          className={`rounded-2xl p-3.5 flex items-center justify-between gap-3 border transition-all cursor-pointer ${
                            isPresent
                              ? 'bg-gradient-to-r from-emerald-50/80 to-teal-50/40 border-emerald-300/80 shadow-xs ring-1 ring-emerald-200'
                              : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Member Avatar (Photo or Initials) */}
                            <MemberAvatar name={m.name} photoUrl={photoUrl} present={isPresent} />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className={`text-sm font-bold truncate ${isPresent ? 'text-emerald-950' : 'text-slate-800'}`}>
                                  {m.name}
                                </h4>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[memberStatus] || STATUS_STYLE.active}`}>
                                  {STATUS_LABEL[memberStatus] || memberStatus}
                                </span>
                                {m.role && m.role !== 'anggota' && (
                                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                    m.role === 'pengurus'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {m.role === 'guru' ? 'Guru' : 'Pengurus'}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
                                {m.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone size={11} className="text-slate-400" />
                                    <span>{m.phone}</span>
                                  </span>
                                )}
                                {age >= 0 && (
                                  <>
                                    <span>·</span>
                                    <span>{age} thn</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Attendance Checkbox Button */}
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAttendance(m.id);
                              }}
                              aria-label={`Tandai kehadiran: ${m.name}`}
                              aria-pressed={isPresent}
                              className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] min-w-[80px] rounded-xl font-bold text-xs transition-all cursor-pointer flex-shrink-0 active:scale-95 ${
                                isPresent
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 active:bg-slate-200'
                              }`}
                            >
                              {isPresent ? (
                                <>
                                  <Check size={16} strokeWidth={2.5} />
                                  <span>Hadir</span>
                                </>
                              ) : (
                                <>
                                  <Circle size={15} />
                                  <span>Absen</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <span
                              className={`text-xs font-bold px-3 py-2 min-h-[38px] flex items-center justify-center rounded-xl ${
                                isPresent ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {isPresent ? 'Hadir' : 'Absen'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Sticky bottom save bar */}
              {canEdit && (
                <div className="sticky bottom-3 z-20 mt-6 flex justify-center px-2 sm:px-4 safe-bottom-floating">
                  <div className="w-full sm:w-auto bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-2 sm:p-1.5 shadow-2xl border border-white/10 flex flex-col sm:flex-row items-center gap-2 animate-in slide-in-from-bottom-2">
                    <button
                      type="button"
                      onClick={saveAttendance}
                      disabled={savingAttendance || attendanceSaved}
                      className={`w-full sm:w-auto justify-center flex items-center gap-2 rounded-xl px-6 py-3 min-h-[48px] font-bold text-sm transition-all active:scale-[0.98] cursor-pointer ${
                        attendanceSaved
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                      } disabled:opacity-80`}
                    >
                      {savingAttendance ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : attendanceSaved ? (
                        <Check size={16} strokeWidth={2.5} />
                      ) : (
                        <Save size={16} />
                      )}
                      <span>
                        {savingAttendance
                          ? 'Menyimpan...'
                          : attendanceSaved
                          ? 'Absensi Tersimpan'
                          : 'Simpan Absensi'}
                      </span>
                    </button>
                    {!attendanceSaved && (
                      <span className="text-xs text-amber-300 font-medium px-2 py-1 flex items-center justify-center gap-1 text-center">
                        <AlertTriangle size={13} className="shrink-0" />
                        Perubahan belum disimpan
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Member Form Modal ── */}
      {showMemberForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh] overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {editMember ? 'Edit Data Anggota' : 'Tambah Anggota Baru'}
                  </h3>
                  <p className="text-xs text-indigo-200/80">Komisi {komisiInfo.label}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowMemberForm(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4 bg-slate-50/50">
              {/* Method Selection & Sync Section at TOP */}
              <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Link size={14} className="text-indigo-600" />
                    <span>Sinkronisasi ke Data Jemaat Umum</span>
                  </label>
                  {selectedJemaatId ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <Check size={10} /> Terhubung
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-400">
                      Opsional (Cari untuk mengisi otomatis)
                    </span>
                  )}
                </div>

                {selectedJemaatId ? (
                  <div className="flex items-center gap-3 bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <Check size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-emerald-900 font-bold truncate">
                        {jemaatMap[selectedJemaatId]?.name || memberForm.name || selectedJemaatId}
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        {memberForm.birthDate ? `${formatDate(memberForm.birthDate)} · ` : ''}
                        {memberForm.phone || 'Tanpa no. HP'}
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setSelectedJemaatId('')} 
                      className="p-1.5 text-emerald-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Lepas tautan"
                    >
                      <Unlink size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder={`Ketik nama jemaat umum untuk sinkron otomatis (${jemaatList.length} jemaat)...`} 
                        value={linkSearch}
                        onChange={e => setLinkSearch(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                      />
                    </div>
                    {/* Inline suggestions */}
                    {linkSearch.length >= 2 && formSuggestions.length > 0 && (
                      <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-white shadow-md">
                        {formSuggestions.map(r => (
                          <button 
                            key={r.jemaat.id}
                            type="button"
                            onMouseDown={e => {
                              e.preventDefault();
                              selectJemaatToForm(r.jemaat);
                            }}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer flex items-center justify-between group"
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <p className="font-bold text-slate-900 text-xs group-hover:text-indigo-600 transition-colors">{r.jemaat.name}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {r.jemaat.birthDate && `${formatDate(r.jemaat.birthDate)} · `}
                                {r.jemaat.phone ? r.jemaat.phone : 'Tanpa no. HP'}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 flex items-center gap-1 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                              <Link size={10} /> Hubungkan
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {linkSearch.length >= 2 && formSuggestions.length === 0 && (
                      <p className="text-[11px] text-slate-400 px-1">Tidak ditemukan jemaat dengan nama tersebut. Anda bisa input manual di bawah.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Auto-suggestion banner */}
              {!selectedJemaatId && autoSuggestion && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
                  <Activity size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-indigo-900">Cocok dengan database jemaat umum:</p>
                    <p className="text-xs text-indigo-800 font-semibold mt-1">
                      {autoSuggestion.jemaat.name}
                      {autoSuggestion.jemaat.birthDate && ` · ${formatDate(autoSuggestion.jemaat.birthDate)}`}
                      {autoSuggestion.jemaat.phone && ` · ${autoSuggestion.jemaat.phone}`}
                    </p>
                    <p className="text-[11px] text-indigo-600 mt-0.5">Kriteria cocok: {autoSuggestion.reasons.join(', ')}</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => selectJemaatToForm(autoSuggestion.jemaat)}
                    className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl font-bold flex-shrink-0 shadow-2xs cursor-pointer transition-colors"
                  >
                    <Link size={12} /> Hubungkan
                  </button>
                </div>
              )}

              {/* Card 1: Informasi Utama */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3.5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Informasi Pokok</p>

                {/* Nama Lengkap */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Elizabeth Damaira"
                    value={memberForm.name} 
                    onChange={e => setMemberForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                  />
                </div>

                {/* Tanggal Lahir & Peran */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tanggal Lahir
                    </label>
                    <ModernDatePicker
                      value={memberForm.birthDate}
                      onChange={val => setMemberForm(p => ({ ...p, birthDate: val }))}
                      placeholder="Pilih tanggal lahir"
                      minYear={1930}
                      maxYear={new Date().getFullYear()}
                      showAge={true}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Membantu kalkulasi usia & sinkronisasi</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Peran di Komisi
                    </label>
                    <select 
                      value={memberForm.role} 
                      onChange={e => setMemberForm(p => ({ ...p, role: e.target.value as any }))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                    >
                      <option value="anggota">Anggota</option>
                      <option value="pengurus">Pengurus / PIC</option>
                      <option value="guru">Guru (Khusus Sekolah Minggu)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Card 2: Kontak & Domisili */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3.5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kontak & Domisili</p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    No. Telepon / WhatsApp
                  </label>
                  <input 
                    type="tel" 
                    placeholder="08123456789"
                    value={memberForm.phone} 
                    onChange={e => setMemberForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alamat Domisili
                  </label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Jl. Jelambar Fajar No. 12"
                    value={memberForm.address} 
                    onChange={e => setMemberForm(p => ({ ...p, address: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                  />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 bg-white flex items-center justify-end gap-2.5 border-t border-slate-200">
              <button 
                type="button"
                onClick={() => setShowMemberForm(false)} 
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleSaveMember} 
                disabled={!memberForm.name.trim() || savingMember}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
              >
                {savingMember ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>{editMember ? 'Simpan Perubahan' : 'Tambah Anggota'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Session Form Modal ── */}
      {showSessionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900">Buat Sesi Absensi</h2>
              <button onClick={() => setShowSessionForm(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Sesi *</label>
                <input type="text" placeholder="contoh: Ibadah Minggu 27 Juli" value={sessionForm.title}
                  onChange={e => setSessionForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal *</label>
                <ModernDatePicker
                  value={sessionForm.date}
                  onChange={val => setSessionForm(p => ({ ...p, date: val }))}
                  placeholder="Pilih tanggal sesi"
                  minYear={new Date().getFullYear() - 2}
                  maxYear={new Date().getFullYear() + 2}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowSessionForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
              <button onClick={handleCreateSession} disabled={!sessionForm.title.trim() || savingSession}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-bold">
                {savingSession ? 'Membuat...' : 'Buat Sesi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete session confirm ── */}
      {deletingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex flex-col items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={22} className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-base text-center">Hapus Sesi?</h3>
              <p className="text-sm text-gray-500 text-center">
                Sesi <strong>{deletingSession.title}</strong> dan semua data absensinya akan dihapus.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeletingSession(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
              <button onClick={confirmDeleteSession} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete member confirm ── */}
      {deletingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex flex-col items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={22} className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-base text-center">Hapus Anggota?</h3>
              <p className="text-sm text-gray-500 text-center">
                <strong>{deletingMember.name}</strong> akan dihapus dari <strong>{komisiInfo.label}</strong>.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeletingMember(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
              <button onClick={confirmDeleteMember} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
