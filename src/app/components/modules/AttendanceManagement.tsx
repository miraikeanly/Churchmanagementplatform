import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { EdgeKV as supabaseAdmin } from '../../../lib/edgeKvClient';
import { trackActivity } from '../../../lib/auditLogger';
import {
  Search, SortAsc, SortDesc, CheckCircle2, Circle, CheckSquare, Square,
  Save, Download, Calendar as CalendarIcon, Users, TrendingDown, TrendingUp,
  ChevronLeft, ChevronRight, BarChart3, ClipboardList, AlertTriangle,
  Loader2, X, Sparkles, Filter, RotateCcw, Phone, MessageCircle, Edit2
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, Cell
} from 'recharts';

const KV = 'kv_store_561004a0';
const SERVICE_TYPE = 'Ibadah Umum';

function toMember(r: { key: string; value: unknown }): Member | null {
  const m = r.value as any;
  if (!m?.name) return null;
  return {
    id: m.id || r.key,
    name: m.name,
    photoUrl: m.photoUrl || undefined,
    address: m.address,
    phone: m.phone || (Array.isArray(m.phones) && m.phones.length > 0 ? m.phones[0] : undefined),
    status: m.status,
    pksName: m.pksName,
    komselId: m.komselId,
    joinDate: m.joinDate,
    createdAt: m.createdAt,
  };
}

interface Member {
  id: string;
  name: string;
  photoUrl?: string;
  address?: string;
  phone?: string;
  status?: string;
  pksName?: string;
  komselId?: string;
  joinDate?: string;
  createdAt?: string;
}

interface Session {
  id: string;
  date: string;
  serviceType: string;
  presentIds: string[];
  savedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const monthLabel = (y: number, m: number) =>
  new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

function formatDateLabel(dateStr: string) {
  if (!dateStr) return 'Pilih Tanggal';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
  return `${dayName}, ${parts[2]}/${parts[1]}/${parts[0]}`;
}


// Get all Sundays in a given year-month
function sundaysInMonth(year: number, month: number): string[] {
  const dates: string[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    if (d.getDay() === 0) dates.push(fmt(new Date(d)));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// Inactive rule: only inactive if absent in 3 consecutive distinct weeks of general service sessions
// Must have at least 3 distinct weeks recorded in history; excludes visitors and members joined within 3 weeks.
function getInactiveMembers(members: Member[], sessions: Session[], currentPresent?: Set<string>): string[] {
  const generalSessions = sessions
    .filter(s => s.serviceType === SERVICE_TYPE)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Group sessions by distinct Sunday/week key
  const distinctWeeksMap = new Map<string, Session[]>();
  for (const s of generalSessions) {
    const wInfo = getWeekInfo(s.date);
    const weekKey = wInfo.sundayDate;
    if (!distinctWeeksMap.has(weekKey)) {
      distinctWeeksMap.set(weekKey, []);
    }
    distinctWeeksMap.get(weekKey)!.push(s);
  }

  const distinctWeekKeys = Array.from(distinctWeeksMap.keys()).sort().reverse();

  // If there are less than 3 distinct weeks recorded in history, no one can be declared "jarang aktif"
  if (distinctWeekKeys.length < 3) return [];

  const last3WeekKeys = distinctWeekKeys.slice(0, 3);
  const oldestOf3Weeks = last3WeekKeys[last3WeekKeys.length - 1]; // earliest Sunday date among the 3

  return members
    .filter(m => {
      // Exclude visitors
      const statusLower = (m.status || '').toLowerCase();
      if (statusLower === 'visitor' || statusLower === 'visitors' || statusLower === 'tamu') return false;

      // Exclude members who joined recently (less than 3 weeks ago)
      const joinStr = (m.joinDate || m.createdAt || '').slice(0, 10);
      if (joinStr && joinStr > oldestOf3Weeks) {
        return false;
      }

      // If currently checked as present in this session, exclude from inactive list
      if (currentPresent?.has(m.id)) return false;

      // Inactive if NOT present in any session across the last 3 distinct weeks
      let attendedInLast3Weeks = false;
      for (const wKey of last3WeekKeys) {
        const weekSessions = distinctWeeksMap.get(wKey) || [];
        const attendedThisWeek = weekSessions.some(s => s.presentIds && s.presentIds.includes(m.id));
        if (attendedThisWeek) {
          attendedInLast3Weeks = true;
          break;
        }
      }

      return !attendedInLast3Weeks;
    })
    .map(m => m.id);
}

// Week calculations (Monday - Sunday)
function getWeekInfo(dateStr: string) {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday
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
    label: `${monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    shortLabel: `${monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function Avatar({ name, photoUrl, present }: { name: string; photoUrl?: string; present: boolean }) {
  const [imgError, setImgError] = useState(false);
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  if (photoUrl && !imgError) {
    return (
      <div className="relative flex-shrink-0">
        <img
          src={photoUrl}
          alt={name}
          onError={() => setImgError(true)}
          className={`w-11 h-11 rounded-full object-cover border-2 transition-all ${
            present ? 'border-emerald-500 shadow-xs' : 'border-gray-200'
          }`}
        />
        {present && (
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
        )}
      </div>
    );
  }

  return (
    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${present ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
      {initials}
    </div>
  );
}

// ─── Calendar Picker Modal ──────────────────────────────────────────────────
function CalendarModal({
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
  sessions: Session[];
}) {
  const initialDate = selectedDate ? new Date(selectedDate) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth() + 1);

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


  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Build days grid for viewMonth & viewYear
  const firstDayOfMonth = new Date(viewYear, viewMonth - 1, 1);
  const startDay = firstDayOfMonth.getDay(); // 0 is Sun, 1 is Mon
  const offset = startDay === 0 ? 6 : startDay - 1; // Mon = 0, Sun = 6

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isSunday: boolean }[] = [];

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(viewYear, viewMonth - 1, i);
    const dateStr = fmt(d);
    days.push({
      dateStr,
      dayNum: i,
      isCurrentMonth: true,
      isSunday: d.getDay() === 0,
    });
  }

  const selectedWeek = getWeekInfo(selectedDate);
  const todayStr = fmt(new Date());

  // Quick map of sessions by date
  const sessionMap = new Map<string, number>();
  sessions.forEach(s => {
    sessionMap.set(s.date, (s.presentIds || []).length);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/80">
          <div className="flex items-center gap-2">
            <CalendarIcon size={18} className="text-blue-600" />
            <h3 className="font-bold text-gray-900 text-sm">Kalender Kehadiran & Sesi</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Modern Month & Year Slider Selector */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Year Slider / Quick Jump */}
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
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1 text-sm font-extrabold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-2xs"
                >
                  {Array.from({ length: 30 }, (_, i) => 2015 + i).map(y => (
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
                  Geser Tahun: {viewYear}
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

          {/* Month Slider & Navigator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Pilih Bulan</span>
              <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-lg">
                {monthLabel(viewYear, viewMonth)}
              </span>
            </div>

            {/* Quick 12-Month Pills Slider */}
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

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 pt-2 border-t border-slate-100">
            <span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span className="text-rose-500 font-extrabold">Min</span>
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: offset }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-14 rounded-xl opacity-0" />
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
                  className={`h-14 rounded-xl p-1 flex flex-col items-center justify-between transition-all cursor-pointer border ${
                    isSelectedDate
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md font-bold'
                      : inSelectedWeek
                      ? 'bg-blue-50 border-blue-200 text-blue-900 font-medium'
                      : d.isSunday
                      ? 'bg-rose-50/50 border-rose-100 text-rose-700 hover:bg-rose-50'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-700'
                  } ${isToday && !isSelectedDate ? 'ring-2 ring-blue-400' : ''}`}
                >
                  <span className="text-xs leading-none">{d.dayNum}</span>
                  {count !== undefined ? (
                    <span
                      className={`text-[9px] px-1 py-0.5 rounded-full font-bold leading-none ${
                        isSelectedDate
                          ? 'bg-white text-blue-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                      title={`${count} jemaat hadir`}
                    >
                      {count}
                    </span>
                  ) : d.isSunday ? (
                    <span className="text-[8px] text-gray-300">ibadah</span>
                  ) : (
                    <span className="h-2" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Ada Data Absen</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onSelectDate(todayStr);
                onClose();
              }}
              className="text-blue-600 font-semibold hover:underline cursor-pointer"
            >
              Pilih Hari Ini
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Custom Tooltip for Chart ────────────────────────────────────────────────
function CustomChartTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const delta = data.delta || 0;
    return (
      <div className="bg-gray-900/95 backdrop-blur-xs text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-gray-800 min-w-44 animate-in fade-in zoom-in-95">
        <p className="font-semibold text-gray-100">{data.fullLabel || data.label}</p>
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-800">
          <span className="text-gray-400">Total Hadir:</span>
          <span className="font-bold text-emerald-400 text-sm">{data.hadir} orang</span>
        </div>
        {delta !== 0 && (
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-gray-400">Perubahan:</span>
            <span className={`font-semibold ${delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {delta > 0 ? `+${delta} (Naik)` : `${delta} (Turun)`}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 text-[11px] text-gray-400">
          <span>Jemaat Baru:</span>
          <span className="font-semibold text-blue-300">
            +{data.newMembers || 0} orang
          </span>
        </div>
        {data.totalMembers > 0 && (
          <div className="flex items-center justify-between gap-3 text-[11px] text-gray-400">
            <span>Persentase:</span>
            <span className="font-semibold text-gray-200">
              {Math.round((data.hadir / data.totalMembers) * 100)}%
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
}

// ─── Daily Input Tab ─────────────────────────────────────────────────────────
function DailyInput({
  members,
  sessions,
  setSessions,
  onSessionSaved,
  canEdit,
  date,
  setDate,
}: {
  members: Member[];
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  onSessionSaved: () => void;
  canEdit: boolean;
  date: string;
  setDate: (d: string) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState<'all' | 'hadir' | 'absen'>('all');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState('');

  const sessionId = `sess_${date}_Ibadah_Umum`;
  const existingSession = useMemo(() => sessions.find(s => s.id === sessionId), [sessions, sessionId]);

  const [present, setPresent] = useState<Set<string>>(() => new Set(existingSession?.presentIds || []));
  const [saved, setSaved] = useState<boolean>(() => !!existingSession);
  const [isEditing, setIsEditing] = useState<boolean>(() => !existingSession);

  // Load session only when date changes (sessionId changes)
  useEffect(() => {
    const s = sessions.find(item => item.id === sessionId);
    setPresent(new Set(s?.presentIds || []));
    setSaved(!!s);
    setIsEditing(!s);
    setSaveSuccessNotice('');
  }, [sessionId]);

  const toggle = (id: string) => {
    if (!canEdit) return;
    setIsEditing(true);
    setSaved(false);
    setSaveSuccessNotice('');
    setPresent(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const markAll = () => {
    if (!canEdit) return;
    setIsEditing(true);
    setSaved(false);
    setSaveSuccessNotice('');
    setPresent(new Set(filtered.map(m => m.id)));
  };

  const clearAll = () => {
    if (!canEdit) return;
    setIsEditing(true);
    setSaved(false);
    setSaveSuccessNotice('');
    setPresent(new Set());
  };

  const filtered = useMemo(() => {
    let list = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
    if (filter === 'hadir') list = list.filter(m => present.has(m.id));
    if (filter === 'absen') list = list.filter(m => !present.has(m.id));
    list = [...list].sort((a, b) =>
      sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );
    return list;
  }, [members, search, filter, sortDir, present]);

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const session: Session = {
        id: sessionId,
        date,
        serviceType: SERVICE_TYPE,
        presentIds: [...present],
        savedAt: nowIso,
      };
      const key = `attendance_session:${sessionId}`;
      const { data: existing } = await supabaseAdmin.from(KV).select('key').eq('key', key).maybeSingle();
      if (existing) {
        await supabaseAdmin.from(KV).update({ value: session }).eq('key', key);
      } else {
        await supabaseAdmin.from(KV).insert({ key, value: session });
      }

      // Optimistically update sessions in parent state so view updates instantly
      setSessions(prev => {
        const filteredList = prev.filter(s => s.id !== sessionId);
        return [...filteredList, session];
      });

      await trackActivity(
        'SAVE_ATTENDANCE',
        'Absensi',
        `Menyimpan absensi ${SERVICE_TYPE} untuk tanggal ${date} (${present.size} jemaat hadir)`
      );

      setSaved(true);
      setIsEditing(false);
      setSaveSuccessNotice(`Absensi ${formatDateLabel(date)} berhasil disimpan! (${present.size} orang hadir)`);
      setTimeout(() => setSaveSuccessNotice(''), 4000);
      onSessionSaved();
    } catch (err: any) {
      alert(`Gagal menyimpan absensi: ${err.message || 'Terjadi kesalahan'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!canEdit) return;
    const confirmMsg = `Reset & hapus data absensi untuk tanggal ${date}?\nSemua centang kehadiran pada tanggal ini akan dibersihkan.`;
    if (!window.confirm(confirmMsg)) return;

    setResetting(true);
    try {
      const key = `attendance_session:${sessionId}`;
      await supabaseAdmin.from(KV).delete().eq('key', key);

      await trackActivity(
        'RESET_ATTENDANCE',
        'Absensi',
        `Mereset dan menghapus data absensi ${SERVICE_TYPE} tanggal ${date}`
      );

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setPresent(new Set());
      setSaved(false);
      setIsEditing(true);
      setSaveSuccessNotice('Data absensi tanggal ini telah direset.');
      setTimeout(() => setSaveSuccessNotice(''), 3000);
      onSessionSaved();
    } catch (err: any) {
      alert(`Gagal mereset absensi: ${err.message || 'Terjadi kesalahan'}`);
    } finally {
      setResetting(false);
    }
  };

  const presentCount = present.size;
  const absentCount = members.length - presentCount;
  const todayStr = fmt(new Date());

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="w-full sm:w-auto">
          <label className="text-xs text-gray-500 font-medium block mb-1">Tanggal Absensi</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-4 py-2.5 min-h-[44px] bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50/20 active:scale-[0.98] rounded-xl text-sm font-semibold text-gray-800 transition-all shadow-xs cursor-pointer group"
              title="Buka Kalender Kehadiran & Sesi"
            >
              <CalendarIcon size={16} className="text-blue-600 group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">{formatDateLabel(date)}</span>
            </button>
            <button
              type="button"
              onClick={() => setDate(todayStr)}
              className={`text-xs px-3.5 py-2.5 min-h-[44px] rounded-xl border transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center ${
                date === todayStr ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'border-gray-200 hover:bg-gray-50 text-gray-600 font-medium'
              }`}
            >
              Hari Ini
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:justify-end w-full sm:w-auto">
          {/* Status badge when saved */}
          {existingSession && (
            <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
              <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-2 min-h-[40px] rounded-xl font-medium inline-flex items-center gap-1">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Sesi Tersimpan ({existingSession.presentIds?.length || 0} hadir)</span>
              </span>

              {canEdit && !isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] bg-amber-50 hover:bg-amber-100 active:scale-[0.98] text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  title="Klik untuk mengedit/memperbaiki data absensi minggu ini atau minggu sebelumnya"
                >
                  <Edit2 size={13} /> Edit Absensi
                </button>
              )}
            </div>
          )}

          {isEditing && existingSession && (
            <button
              type="button"
              onClick={() => {
                setPresent(new Set(existingSession.presentIds || []));
                setIsEditing(false);
                setSaved(true);
              }}
              className="text-xs px-3 py-2.5 min-h-[44px] text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:scale-[0.98] rounded-xl transition-all cursor-pointer border border-gray-200"
            >
              Batal Edit
            </button>
          )}

          {(saved || existingSession || present.size > 0) && canEdit && (
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting || saving}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold transition-all active:scale-[0.98] border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 shadow-xs cursor-pointer disabled:opacity-50"
              title="Reset dan hapus data absensi tanggal ini"
            >
              {resetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              <span>{resetting ? 'Mereset...' : 'Reset'}</span>
            </button>
          )}

          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving || resetting}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold transition-all active:scale-[0.98] shadow-sm cursor-pointer w-full sm:w-auto ${
                saved && !isEditing
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-700 text-white hover:bg-blue-800 ring-2 ring-blue-300'
              } disabled:opacity-50`}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{saving ? 'Menyimpan...' : (saved && !isEditing) ? 'Tersimpan ✓' : existingSession ? 'Simpan Perubahan' : 'Simpan Absensi'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Success banner if any */}
      {saveSuccessNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{saveSuccessNotice}</span>
          </div>
          <button onClick={() => setSaveSuccessNotice('')} className="text-emerald-600 hover:text-emerald-800">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-700">{presentCount}</div>
          <div className="text-xs text-emerald-600 mt-1">Hadir</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{absentCount}</div>
          <div className="text-xs text-red-500 mt-1">Absen</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{members.length}</div>
          <div className="text-xs text-blue-600 mt-1">Total Jemaat</div>
        </div>
      </div>

      {/* Search + Sort + Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama jemaat..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2.5 min-h-[40px] text-sm text-gray-600 hover:bg-gray-50 active:scale-[0.98] bg-white cursor-pointer">
          {sortDir === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
          {sortDir === 'asc' ? 'Asc' : 'Desc'}
        </button>
        {(['all', 'hadir', 'absen'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2.5 min-h-[40px] rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] cursor-pointer ${filter === f ? 'bg-blue-700 text-white border-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50 bg-white'}`}>
            {f === 'all' ? 'Semua' : f === 'hadir' ? 'Hadir' : 'Absen'}
          </button>
        ))}
        {canEdit && (
          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <button onClick={markAll} className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 text-xs px-3.5 py-2.5 min-h-[40px] border border-emerald-200 text-emerald-700 rounded-xl hover:bg-emerald-50 active:scale-[0.98] bg-white cursor-pointer font-semibold">
              <CheckSquare size={14} /> Semua Hadir
            </button>
            <button onClick={clearAll} className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 text-xs px-3.5 py-2.5 min-h-[40px] border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 active:scale-[0.98] bg-white cursor-pointer font-semibold">
              <Square size={14} /> Clear
            </button>
          </div>
        )}
      </div>

      {/* Member checklist */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Tidak ada jemaat ditemukan</div>
        ) : (
          filtered.map((m, i) => {
            const isPresent = present.has(m.id);
            return (
              <div key={m.id}
                onClick={() => toggle(m.id)}
                className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors select-none ${i > 0 ? 'border-t border-gray-50' : ''} ${isPresent ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-gray-50'}`}>
                <Avatar name={m.name} photoUrl={m.photoUrl} present={isPresent} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 truncate">{m.name}</p>
                    {m.pksName && (
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">PKS: {m.pksName}</span>
                    )}
                  </div>
                  <p className={`text-sm mt-0.5 ${isPresent ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {isPresent ? 'Hadir ✓' : 'Belum hadir'}
                  </p>
                </div>
                {isPresent
                  ? <CheckCircle2 size={26} className="text-emerald-500 flex-shrink-0" />
                  : <Circle size={26} className="text-gray-300 flex-shrink-0" />}
              </div>
            );
          })
        )}
      </div>

      {/* Calendar Picker Modal */}
      <CalendarModal
        isOpen={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        selectedDate={date}
        onSelectDate={d => setDate(d)}
        sessions={sessions}
      />
    </div>
  );
}


// ─── Report Tab ──────────────────────────────────────────────────────────────
function ReportSummary({ members, sessions }: { members: Member[]; sessions: Session[] }) {
  const now = new Date();
  const todayStr = fmt(now);

  const [view, setView] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // If sessions exist, default to the latest session date, else today
    if (sessions.length > 0) {
      const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
      return sorted[0].date;
    }
    return todayStr;
  });

  const [year, setYear] = useState(() => {
    if (sessions.length > 0) {
      const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
      return Number(sorted[0].date.slice(0, 4));
    }
    return now.getFullYear();
  });

  const [month, setMonth] = useState(() => {
    if (sessions.length > 0) {
      const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
      return Number(sorted[0].date.slice(5, 7));
    }
    return now.getMonth() + 1;
  });

  const [search, setSearch] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const currentWeek = useMemo(() => getWeekInfo(selectedDate), [selectedDate]);
  const sundays = useMemo(() => sundaysInMonth(year, month), [year, month]);

  const inactiveMembers = useMemo(() => {
    const ids = getInactiveMembers(members, sessions);
    return members.filter(m => ids.includes(m.id));
  }, [members, sessions]);

  // Navigate weeks
  const prevWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 7);
    setSelectedDate(fmt(d));
  };

  const nextWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 7);
    setSelectedDate(fmt(d));
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Sessions matching current filter
  const relevantSessions = useMemo(() => {
    if (view === 'weekly') {
      return sessions.filter(s => currentWeek.dates.includes(s.date));
    } else if (view === 'monthly') {
      const prefix = `${year}-${pad2(month)}`;
      return sessions.filter(s => s.date.startsWith(prefix));
    } else {
      return sessions.filter(s => s.date.startsWith(String(year)));
    }
  }, [sessions, view, currentWeek, year, month]);

  // Dates (columns) for the table
  const dateCols = useMemo(() => {
    if (view === 'weekly') {
      // Show session dates in that week, or at least the Sunday date
      const sessionDatesInWeek = relevantSessions.map(s => s.date);
      const combined = [...new Set([currentWeek.sundayDate, ...sessionDatesInWeek])];
      return combined.sort();
    } else if (view === 'monthly') {
      const allDates = [...new Set([...sundays, ...relevantSessions.map(s => s.date)])];
      return allDates.sort();
    } else {
      // yearly
      const all = relevantSessions.map(s => s.date);
      return [...new Set(all)].sort();
    }
  }, [view, currentWeek, sundays, relevantSessions]);

  const getPresentSet = (date: string) =>
    sessions.find(s => s.date === date)?.presentIds || [];

  const totalByDate = (date: string) => getPresentSet(date).length;
  const totalByMember = (memberId: string) =>
    dateCols.filter(d => getPresentSet(d).includes(memberId)).length;

  const filteredMembers = useMemo(() =>
    members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [members, search]);

  // ─── Chart Data Preparation ──────────────────────────────────────────────
  const chartData = useMemo(() => {
    let result = [];
    if (view === 'weekly') {
      // Recent 8 weeks ending at or around currentWeek
      const weeksData = [];
      const baseDate = new Date(currentWeek.sundayDate);
      
      // Look back 6 weeks and ahead 1 week
      for (let i = -5; i <= 1; i++) {
        const target = new Date(baseDate);
        target.setDate(baseDate.getDate() + (i * 7));
        const wInfo = getWeekInfo(fmt(target));
        const count = sessions
          .filter(s => wInfo.dates.includes(s.date))
          .reduce((sum, s) => sum + s.presentIds.length, 0);

        const isCurrent = wInfo.sundayDate === currentWeek.sundayDate;

        // Count new members joined in this week window
        const newMembersCount = members.filter(m => {
          const jd = (m.joinDate || m.createdAt || '').slice(0, 10);
          return jd >= wInfo.monday && jd <= wInfo.sunday;
        }).length;

        weeksData.push({
          key: wInfo.sundayDate,
          label: wInfo.shortLabel,
          periodName: `Minggu (${wInfo.shortLabel})`,
          fullLabel: `Minggu: ${wInfo.label}`,
          hadir: count,
          delta: 0,
          newMembers: newMembersCount,
          isCurrent,
          totalMembers: members.length,
          dateStr: wInfo.sundayDate,
        });
      }
      result = weeksData;
    } else if (view === 'monthly') {
      // All Sundays in that month
      result = dateCols.map(d => {
        const count = totalByDate(d);
        const parts = d.split('-');
        const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));

        // New members on that date
        const newMembersCount = members.filter(m => {
          const jd = (m.joinDate || m.createdAt || '').slice(0, 10);
          return jd === d;
        }).length;

        return {
          key: d,
          label: `${parts[2]}/${parts[1]}`,
          periodName: `Ibadah ${parts[2]}/${parts[1]}`,
          fullLabel: dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          hadir: count,
          delta: 0,
          newMembers: newMembersCount,
          isCurrent: d === selectedDate,
          totalMembers: members.length,
          dateStr: d,
        };
      });
    } else {
      // Yearly: 12 months
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      result = months.map((mName, idx) => {
        const mPrefix = `${year}-${pad2(idx + 1)}`;
        const mSessions = sessions.filter(s => s.date.startsWith(mPrefix));
        const total = mSessions.reduce((sum, s) => sum + s.presentIds.length, 0);
        const avg = mSessions.length > 0 ? Math.round(total / mSessions.length) : 0;

        // New members in this month
        const newMembersCount = members.filter(m => {
          const jd = (m.joinDate || m.createdAt || '').slice(0, 7);
          return jd === mPrefix;
        }).length;

        return {
          key: mPrefix,
          label: mName,
          periodName: `Bulan ${mName}`,
          fullLabel: `Bulan ${monthLabel(year, idx + 1)}`,
          hadir: avg,
          delta: 0,
          newMembers: newMembersCount,
          sessionsCount: mSessions.length,
          totalMembers: members.length,
          dateStr: `${mPrefix}-01`,
        };
      });
    }

    // Calculate delta (kenaikan / penurunan) relative to previous period item
    for (let i = 0; i < result.length; i++) {
      if (i > 0) {
        result[i].delta = result[i].hadir - result[i - 1].hadir;
      }
    }
    return result;
  }, [view, currentWeek, sessions, dateCols, members, year, month, selectedDate]);

  const avgAttendance = useMemo(() => {
    const valid = chartData.filter(d => d.hadir > 0);
    if (valid.length === 0) return 0;
    return Math.round(valid.reduce((sum, d) => sum + d.hadir, 0) / valid.length);
  }, [chartData]);

  const maxAttendance = useMemo(() => {
    return chartData.reduce((max, d) => (d.hadir > max ? d.hadir : max), 0);
  }, [chartData]);

  const exportCSV = () => {
    const header = ['No', 'Nama', ...dateCols.map(d => d.slice(5)), 'Total'];
    const rows = filteredMembers.map((m, i) => [
      i + 1,
      m.name,
      ...dateCols.map(d => getPresentSet(d).includes(m.id) ? '1' : '-'),
      totalByMember(m.id),
    ]);
    const totalRow = ['', 'TOTAL HADIR', ...dateCols.map(d => totalByDate(d)), ''];
    const csv = [header, ...rows, totalRow]
      .map(r => r.map(c => `"${c}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const exportName = view === 'weekly'
      ? `Ibadah_Umum_Minggu_${currentWeek.sundayDate}`
      : view === 'monthly'
      ? `Ibadah_Umum_${year}_${pad2(month)}`
      : `Ibadah_Umum_${year}`;
    a.download = `${exportName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* View toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 shadow-inner">
          {(['weekly', 'monthly', 'yearly'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                view === v
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {v === 'weekly' ? 'Per Minggu' : v === 'monthly' ? 'Per Bulan' : 'Per Tahun'}
            </button>
          ))}
        </div>

        {/* Dynamic Period Navigator */}
        {view === 'weekly' && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={prevWeek} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 bg-white cursor-pointer" title="Minggu Sebelumnya">
              <ChevronLeft size={16} />
            </button>
            <div className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-800">
              {currentWeek.label}
            </div>
            <button onClick={nextWeek} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 bg-white cursor-pointer" title="Minggu Selanjutnya">
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className="text-xs px-2.5 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 bg-white text-gray-700 font-medium cursor-pointer"
            >
              Minggu Ini
            </button>
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <CalendarIcon size={14} /> Pilih dari Kalender
            </button>
          </div>
        )}

        {view === 'monthly' && (
          <div className="flex items-center gap-2">
            <input
              aria-label="Pilih bulan laporan"
              type="month"
              value={`${year}-${pad2(month)}`}
              onChange={e => {
                if (!e.target.value) return;
                const [y, m] = e.target.value.split('-').map(Number);
                setYear(y); setMonth(m);
              }}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white"
            />
            <button onClick={prevMonth} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 bg-white cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold min-w-28 text-center text-gray-800">{monthLabel(year, month)}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 bg-white cursor-pointer">
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <CalendarIcon size={14} /> Kalender
            </button>
          </div>
        )}

        {view === 'yearly' && (
          <div className="flex items-center gap-2">
            <input
              aria-label="Pilih tahun laporan"
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={e => setYear(Number(e.target.value) || now.getFullYear())}
              className="w-24 border border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white"
            />
            <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 bg-white cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 bg-white cursor-pointer">
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <button onClick={exportCSV}
          className="flex items-center gap-2 ml-auto bg-emerald-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-sm cursor-pointer transition-colors">
          <Download size={16} /> Export Excel (CSV)
        </button>
      </div>

      {/* ─── ENHANCED VISUALIZATION CHART ─── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Chart Header + KPI Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 size={20} className="text-blue-600" />
              <h3 className="font-bold text-gray-900 text-base">
                {view === 'weekly' ? 'Kehadiran Mingguan' : view === 'monthly' ? `Kehadiran per Minggu (${monthLabel(year, month)})` : `Rata-rata Kehadiran per Bulan (${year})`}
              </h3>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {view === 'weekly'
                ? 'Perbandingan kehadiran mingguan dengan rincian kenaikan/penurunan & jemaat baru'
                : 'Grafik interaktif jemaat hadir per sesi ibadah'}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-xl text-xs flex items-center gap-1.5 text-emerald-800">
              <TrendingUp size={14} className="text-emerald-600" />
              <span>Tertinggi: <strong>{maxAttendance}</strong></span>
            </div>
            <div className="bg-blue-50 border border-blue-100 px-3 py-1 rounded-xl text-xs flex items-center gap-1.5 text-blue-800">
              <Users size={14} className="text-blue-600" />
              <span>Rata-rata: <strong>{avgAttendance}</strong></span>
            </div>
          </div>
        </div>

        {/* Recharts Bar Container */}
        <div className="w-full h-64 pt-2">
          {chartData.length === 0 || chartData.every(d => d.hadir === 0) ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2 border-2 border-dashed border-gray-100 rounded-xl">
              <BarChart3 size={32} className="opacity-30" />
              <p className="text-sm">Belum ada data kehadiran pada periode ini.</p>
              <button
                type="button"
                onClick={() => setCalendarOpen(true)}
                className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                Buka kalender untuk melihat tanggal yang tersedia
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    const d = e.activePayload[0].payload;
                    if (d.dateStr) {
                      setSelectedDate(d.dateStr);
                    }
                  }
                }}
              >
                <defs>
                  <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.85} />
                  </linearGradient>
                  <linearGradient id="barActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomChartTooltip />} />
                {avgAttendance > 0 && (
                  <ReferenceLine
                    y={avgAttendance}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      value: `Rata-rata: ${avgAttendance}`,
                      position: 'top',
                      fill: '#059669',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  />
                )}
                <Bar dataKey="hadir" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isCurrent ? 'url(#barActive)' : 'url(#barBlue)'}
                      cursor="pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ─── Data List Breakdown (Kenaikan / Penurunan & Jemaat Baru) ─── */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>Rincian Per Periode: Kenaikan/Penurunan & Jemaat Baru</span>
            </h4>
            <span className="text-[11px] text-gray-400">
              {view === 'weekly' ? 'Data per minggu' : view === 'monthly' ? 'Data per sesi bulan ini' : 'Data per bulan sepanjang tahun'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {chartData.map((item, idx) => {
              const delta = item.delta || 0;
              const newCount = item.newMembers || 0;
              return (
                <div
                  key={idx}
                  onClick={() => item.dateStr && setSelectedDate(item.dateStr)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    item.isCurrent
                      ? 'border-indigo-400 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-200'
                      : 'border-gray-100 bg-gray-50/70 hover:bg-white hover:border-gray-200'
                  }`}
                >
                  <p className="text-[11px] font-bold text-gray-700 truncate" title={item.fullLabel}>
                    {item.label}
                  </p>
                  <div className="mt-1 flex items-baseline justify-between gap-1">
                    <span className="text-base font-extrabold text-gray-900">{item.hadir}</span>
                    <span className="text-[10px] text-gray-500 font-medium">hadir</span>
                  </div>

                  <div className="mt-1.5 pt-1.5 border-t border-gray-200/60 flex flex-col gap-1 text-[10px]">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-gray-500">Perubahan:</span>
                      {idx === 0 ? (
                        <span className="text-gray-400 font-medium">–</span>
                      ) : delta > 0 ? (
                        <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                          <TrendingUp size={10} /> +{delta}
                        </span>
                      ) : delta < 0 ? (
                        <span className="font-bold text-rose-600 flex items-center gap-0.5">
                          <TrendingDown size={10} /> {delta}
                        </span>
                      ) : (
                        <span className="font-medium text-gray-500">Tetap (0)</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <span className="text-gray-500">Jemaat Baru:</span>
                      <span className={`font-bold ${newCount > 0 ? 'text-blue-600 bg-blue-100/70 px-1 rounded' : 'text-gray-400'}`}>
                        +{newCount}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Inactive Members Alert (Laporan Absensi) ─── */}
      {inactiveMembers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-700">
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900">
                  Jemaat Jarang Aktif ({inactiveMembers.length} orang)
                </p>
                <p className="text-xs text-amber-700">
                  Tidak hadir dalam 3 sesi ibadah umum berturut-turut. Hubungi untuk pelayanan penggembalaan:
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
            {inactiveMembers.map(m => {
              const cleanPhone = (m.phone || '').replace(/[^0-9]/g, '');
              let waNumber = cleanPhone;
              if (waNumber.startsWith('0')) {
                waNumber = '62' + waNumber.slice(1);
              }
              const waText = encodeURIComponent(
                `Shalom ${m.name}, salam kasih dari gereja GBI Jeltim. Kami rindu menyapa dan menanyakan kabar Bpk/Ibu/Sdr. Semoga selalu dalam lindungan dan berkat Tuhan.`
              );

              return (
                <div key={m.id} className="flex flex-col justify-between rounded-xl bg-white border border-amber-200/70 p-3 shadow-xs hover:border-amber-400 transition-colors">
                  <div className="flex items-start gap-2.5 min-w-0 mb-2">
                    {m.photoUrl ? (
                      <img
                        src={m.photoUrl}
                        alt={m.name}
                        className="w-9 h-9 rounded-full object-cover border border-amber-300 flex-shrink-0"
                      />
                    ) : (
                      <span className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {m.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-900 truncate" title={m.name}>
                        {m.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {m.pksName ? (
                          <span className="inline-block text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                            PKS: {m.pksName}
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            Non-PKS
                          </span>
                        )}
                        <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                          3x Berturut Absen
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-1 text-[11px]">
                    <div className="truncate text-gray-600 font-medium">
                      {m.phone ? (
                        <a href={`tel:${m.phone}`} className="hover:text-blue-600 flex items-center gap-1">
                          <Phone size={11} className="text-gray-400" />
                          <span>{m.phone}</span>
                        </a>
                      ) : (
                        <span className="text-gray-400 italic">No HP belum ada</span>
                      )}
                    </div>
                    {waNumber && (
                      <a
                        href={`https://wa.me/${waNumber}?text=${waText}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-semibold transition-colors flex-shrink-0 cursor-pointer"
                        title="Hubungi via WhatsApp"
                      >
                        <MessageCircle size={12} className="text-emerald-600" />
                        <span>Chat WA</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{relevantSessions.length}</div>
          <div className="text-xs text-blue-600 mt-1">Sesi Tersimpan</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-700">
            {relevantSessions.length > 0
              ? Math.round(relevantSessions.reduce((s, sess) => s + sess.presentIds.length, 0) / relevantSessions.length)
              : 0}
          </div>
          <div className="text-xs text-emerald-600 mt-1">Rata-rata Hadir/Minggu</div>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-purple-700">
            {relevantSessions.reduce((s, sess) => s + sess.presentIds.length, 0)}
          </div>
          <div className="text-xs text-purple-600 mt-1">Total Kehadiran</div>
        </div>
      </div>

      {/* Table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-500 w-10">No</th>
              <th className="sticky left-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-500 min-w-40">Nama</th>
              {dateCols.map(d => (
                <th key={d} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 min-w-14">
                  <div>{d.slice(5, 7)}/{d.slice(8)}</div>
                  {view === 'yearly' && <div className="text-gray-400">{d.slice(0, 4)}</div>}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-bold text-blue-700 min-w-14">Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? (
              <tr><td colSpan={dateCols.length + 3} className="py-12 text-center text-gray-400">Belum ada data</td></tr>
            ) : (
              filteredMembers.map((m, i) => {
                const total = totalByMember(m.id);
                const pct = dateCols.length > 0 ? total / dateCols.length : 0;
                return (
                  <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                    <td className="sticky left-0 bg-inherit px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="sticky left-10 bg-inherit px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {m.name}
                        {pct < 0.5 && dateCols.length >= 2 && (
                          <span title="Jarang hadir"><TrendingDown size={13} className="text-amber-500" /></span>
                        )}
                      </div>
                    </td>
                    {dateCols.map(d => {
                      const hadir = getPresentSet(d).includes(m.id);
                      return (
                        <td key={d} className="px-3 py-3 text-center">
                          {hadir
                            ? <span className="text-emerald-600 font-bold">✓</span>
                            : <span className="text-gray-300">–</span>}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center font-bold text-blue-700">{total}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          {dateCols.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 border-t-2 border-gray-200">
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-xs font-bold text-gray-700">TOTAL HADIR</td>
                {dateCols.map(d => (
                  <td key={d} className="px-3 py-3 text-center text-xs font-bold text-emerald-700">
                    {totalByDate(d)}
                  </td>
                ))}
                <td className="px-4 py-3 text-center text-xs font-bold text-blue-700">
                  {relevantSessions.reduce((s, sess) => s + sess.presentIds.length, 0)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobile Table */}
      <div className="md:hidden space-y-2">
        {filteredMembers.length === 0 ? <div className="text-center text-sm text-gray-400 py-8">Belum ada data</div> : filteredMembers.map(m => {
          const total = totalByMember(m.id);
          return <article key={m.id} className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="flex items-center justify-between gap-3"><p className="font-semibold text-sm text-gray-900 break-words">{m.name}</p><span className="text-sm font-bold text-blue-700 flex-shrink-0">{total} hadir</span></div>
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1">{dateCols.map(d => <div key={d} className="min-w-14 text-center rounded-lg bg-gray-50 px-2 py-1.5"><p className="text-[10px] text-gray-400">{d.slice(5)}</p><p className={getPresentSet(d).includes(m.id) ? 'text-emerald-600 font-bold' : 'text-gray-300'}>{getPresentSet(d).includes(m.id) ? '✓' : '–'}</p></div>)}</div>
          </article>;
        })}
      </div>

      {/* Calendar Picker Modal */}
      <CalendarModal
        isOpen={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        selectedDate={selectedDate}
        onSelectDate={date => {
          setSelectedDate(date);
          const parts = date.split('-').map(Number);
          setYear(parts[0]);
          setMonth(parts[1]);
        }}
        sessions={sessions}
      />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AttendanceManagement() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'input' | 'report'>('input');
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const todayStr = useMemo(() => fmt(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const isSuperAdmin = user?.role === 'super_admin';
  const canEdit = isSuperAdmin || user?.permissions?.editAbsensi || user?.permissions?.editAbsen || user?.permissions?.manageAbsensi || false;

  const loadData = async (silent = false) => {
    try {
      if (!silent && members.length === 0) setLoading(true);
      const [{ data: d1 }, { data: d2 }, { data: sessData }] = await Promise.all([
        supabaseAdmin.from(KV).select('key,value').like('key', 'congregation:member:%'),
        supabaseAdmin.from(KV).select('key,value').like('key', 'member:%'),
        supabaseAdmin.from(KV).select('key,value').like('key', 'attendance_session:%'),
      ]);
      const seen = new Set<string>();
      const memberList: Member[] = [];
      for (const r of [...(d1 || []), ...(d2 || [])]) {
        const m = toMember(r);
        if (m && !seen.has(m.id)) { seen.add(m.id); memberList.push(m); }
      }
      memberList.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      setMembers(memberList);

      const sessionList: Session[] = (sessData || [])
        .map((r: any) => r.value as Session)
        .filter((s: any) => s?.id);
      setSessions(sessionList);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  // NOTE: AutoRefresh removed so that active inputs, scroll position, and selected dates are never wiped out

  if (loading && members.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={28} className="animate-spin mr-3" /> Memuat data...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Absensi Jemaat</h2>
          <p className="text-sm text-gray-500 mt-1">Catat kehadiran dan lihat laporan per minggu / bulan / tahun</p>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button onClick={() => setTab('input')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${tab === 'input' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <ClipboardList size={16} /> Input Absensi
          </button>
          <button onClick={() => setTab('report')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${tab === 'report' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <BarChart3 size={16} /> Laporan
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      {!canEdit && tab === 'input' && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm">
          Anda hanya memiliki akses <strong>view-only</strong>. Hubungi Super Admin untuk akses edit.
        </div>
      )}

      {members.length === 0 && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-700 text-sm">
          <Users size={16} /> Belum ada data jemaat. Tambahkan jemaat di menu "Data Jemaat" terlebih dahulu.
        </div>
      )}

      {tab === 'input' ? (
        <DailyInput
          members={members}
          sessions={sessions}
          setSessions={setSessions}
          onSessionSaved={() => loadData(true)}
          canEdit={canEdit}
          date={selectedDate}
          setDate={setSelectedDate}
        />
      ) : (
        <ReportSummary members={members} sessions={sessions} />
      )}
    </div>
  );
}
