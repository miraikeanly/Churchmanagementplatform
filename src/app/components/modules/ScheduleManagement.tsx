import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useAuth } from '../../contexts/AuthContext';
import {
  ChevronLeft, ChevronRight, Download, ExternalLink, AlertTriangle,
  Check, X, Settings, RefreshCw, Link2, Info, Upload, Copy, ChevronDown, Trash2,
} from 'lucide-react';

const KV = 'kv_store_561004a0';

const MONTHS_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
];

function getSundaysInMonth(year: number, month: number): Date[] {
  const sundays: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  while (d.getMonth() === month) { sundays.push(new Date(d)); d.setDate(d.getDate() + 7); }
  return sundays;
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function displayDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]}`;
}

// ── Division definitions ──────────────────────────────────────────────────────
const DIVISIONS = [
  {
    id: 'pemuji', label: 'PEMUJI',
    color: 'bg-blue-600', lightColor: 'bg-blue-50 border-blue-200 text-blue-800',
    roles: ['Worship Leader','Singer 1','Singer 2','Singer 3','Tema','Pembicara'],
    pelayanKeys: ['Pemuji'],
    notes: '',
  },
  {
    id: 'pemusik', label: 'PEMUSIK',
    color: 'bg-purple-600', lightColor: 'bg-purple-50 border-purple-200 text-purple-800',
    roles: ['Drum','Bass','Key 1','Key 2','Gitar','Gitar Acc','MD'],
    pelayanKeys: ['Pemusik'],
    notes: 'Kalau ada halangan, silahkan cari pengganti (tukar jadwal atau ganti) setelah itu confirm ke ketua musik',
  },
  {
    id: 'multimedia', label: 'MULTIMEDIA PRODUKSI',
    color: 'bg-indigo-600', lightColor: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    roles: ['OBS','CAM','Editor'],
    pelayanKeys: ['Multimedia Produksi'],
    notes: 'Kalau ada halangan, silahkan cari pengganti, hari minggu datang maks jam 07.15 WIB',
  },
  {
    id: 'propresenter', label: 'PRO PRESENTER',
    color: 'bg-cyan-600', lightColor: 'bg-cyan-50 border-cyan-200 text-cyan-800',
    roles: ['Operator'],
    pelayanKeys: ['Multimedia Propresenter'],
    notes: '',
  },
  {
    id: 'sound', label: 'SOUND SYSTEM + RUNNER',
    color: 'bg-emerald-600', lightColor: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    roles: ['Sound','Runner'],
    pelayanKeys: ['Sound Audio'],
    notes: '',
  },
  {
    id: 'lighting', label: 'LIGHTING',
    color: 'bg-amber-600', lightColor: 'bg-amber-50 border-amber-200 text-amber-800',
    roles: ['Operator'],
    pelayanKeys: ['Lighting'],
    notes: '',
  },
  {
    id: 'tamborin', label: 'TAMBORIN',
    color: 'bg-rose-600', lightColor: 'bg-rose-50 border-rose-200 text-rose-800',
    roles: ['Tamborin 1','Tamborin 2','Tamborin 3'],
    pelayanKeys: ['Tamborin'],
    notes: 'Hari minggu wajib datang pukul 07.00 WIB atau selambat-lambatnya 07.15 WIB\nBaju tamborin wajib disetrika\nJika berhalangan hadir di latihan ataupun melayani harap secepatnya memberi kabar',
  },
] as const;

// ExcelJS ARGB colors (FF prefix = fully opaque)
const DIV_EXCEL = {
  pemuji:       { header: 'FF2563EB', subheader: 'FFD1E3FF', alt: 'FFEFF6FF' },
  pemusik:      { header: 'FF7C3AED', subheader: 'FFE9D5FF', alt: 'FFFAF5FF' },
  multimedia:   { header: 'FF4338CA', subheader: 'FFC7D2FE', alt: 'FFEEF2FF' },
  propresenter: { header: 'FF0E7490', subheader: 'FFA5F3FC', alt: 'FFECFEFF' },
  sound:        { header: 'FF047857', subheader: 'FF6EE7B7', alt: 'FFECFDF5' },
  lighting:     { header: 'FFB45309', subheader: 'FFFCD34D', alt: 'FFFFFBEB' },
  tamborin:     { header: 'FFBE123C', subheader: 'FFFDA4AF', alt: 'FFFFF1F2' },
} as const;

// Google Sheets RGB colors for Apps Script sync
const DIV_GS = {
  pemuji:       { header: '#2563EB', subheader: '#D1E3FF', alt: '#EFF6FF' },
  pemusik:      { header: '#7C3AED', subheader: '#E9D5FF', alt: '#FAF5FF' },
  multimedia:   { header: '#4338CA', subheader: '#C7D2FE', alt: '#EEF2FF' },
  propresenter: { header: '#0E7490', subheader: '#A5F3FC', alt: '#ECFEFF' },
  sound:        { header: '#047857', subheader: '#6EE7B7', alt: '#ECFDF5' },
  lighting:     { header: '#B45309', subheader: '#FCD34D', alt: '#FFFBEB' },
  tamborin:     { header: '#BE123C', subheader: '#FDA4AF', alt: '#FFF1F2' },
} as const;

type DivId = typeof DIVISIONS[number]['id'];

type WeekSchedule = {
  date: string;
  divisions: Record<string, Record<string, string>>;
};

interface JemaatMember { id: string; name: string; nickname?: string; pelayan?: string[]; }

// ── Name cell editor ──────────────────────────────────────────────────────────
// ── Text cell editor (for manual input like Tema & Pembicara) ────────────────
function ManualTextCell({
  value, onSave, onClear, disabled, placeholder = 'Ketik isi...',
}: {
  value: string;
  onSave: (v: string) => void;
  onClear: () => void;
  disabled: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      if (trimmed) onSave(trimmed);
      else onClear();
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="min-h-[42px] flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(value);
              setEditing(false);
            }
          }}
          onBlur={commit}
          className="w-full h-9 px-2.5 py-1 text-xs bg-white border-2 border-blue-500 rounded-xl outline-hidden font-medium text-gray-900 shadow-sm"
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => { if (!disabled) setEditing(true); }}
      className={`min-h-[42px] px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 group transition-all select-none border ${
        disabled ? 'cursor-default border-transparent' : 'cursor-pointer hover:bg-blue-50/70 hover:border-blue-200 border-transparent'
      }`}
    >
      {value ? (
        <>
          <span className="font-medium flex-1 text-gray-900 leading-tight break-words">{value}</span>
          {!disabled && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onClear();
              }}
              title="Hapus isi"
              className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
            >
              <X size={12} />
            </button>
          )}
        </>
      ) : (
        !disabled && <span className="text-gray-400 italic text-xs font-normal hover:text-blue-600">+ ketik {placeholder}</span>
      )}
    </div>
  );
}

// ── Name cell editor (using createPortal for guaranteed on-top dropdown) ──────
function NameCell({
  value, suggestions, onSave, onClear, isConflict, conflictDivisions, disabled,
}: {
  value: string;
  suggestions: JemaatMember[];
  onSave: (v: string) => void;
  onClear: () => void;
  isConflict: boolean;
  conflictDivisions: string[];
  disabled: boolean;
  openUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; placeAbove: boolean } | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!cellRef.current) return;
    const rect = cellRef.current.getBoundingClientRect();
    const dropdownHeight = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setCoords({
      top: placeAbove ? rect.top - 8 : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 240)),
      width: Math.max(rect.width, 220),
      placeAbove,
    });
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!open) {
      updatePosition();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        cellRef.current && !cellRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('mousedown', onMouseDown);

    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, updatePosition]);

  return (
    <>
      <div
        ref={cellRef}
        onClick={handleToggle}
        title={isConflict ? `Tabrakan dengan: ${conflictDivisions.join(', ')}` : undefined}
        className={`min-h-[42px] px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 group transition-all select-none border ${
          disabled ? 'cursor-default border-transparent' : 'cursor-pointer hover:bg-blue-50 hover:border-blue-200'
        } ${isConflict ? 'bg-red-50 border-red-200' : open ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100' : 'border-transparent'}`}
      >
        {value ? (
          <>
            <span className={`font-medium flex-1 leading-tight ${isConflict ? 'text-red-700 font-semibold' : 'text-gray-900'}`}>{value}</span>
            {isConflict && <AlertTriangle size={11} className="text-red-500 flex-shrink-0" />}
            {!disabled && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onClear();
                  setOpen(false);
                }}
                title="Hapus / Kosongkan pelayan ini"
                className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
              >
                <X size={12} />
              </button>
            )}
          </>
        ) : (
          !disabled && <span className="text-blue-400 text-xs font-medium hover:text-blue-600">+ pilih</span>
        )}
      </div>

      {/* Dropdown in React Portal to completely break free from all table overflows */}
      {open && !disabled && coords && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: coords.placeAbove ? 'auto' : `${coords.top}px`,
            bottom: coords.placeAbove ? `${window.innerHeight - coords.top}px` : 'auto',
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 999999,
            maxHeight: 250,
          }}
          className="bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Opsi Kosongkan / Hapus jika sudah terisi */}
          {value && (
            <button
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                onClear();
                setOpen(false);
              }}
              className="w-full text-left px-3.5 py-2.5 bg-red-50/70 hover:bg-red-100 text-red-600 border-b border-red-100 flex items-center gap-2.5 transition-colors font-medium text-xs"
            >
              <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <Trash2 size={12} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="leading-tight text-xs font-semibold">Kosongkan Kolom Ini</p>
                <p className="text-[10px] text-red-400 leading-tight truncate">Hapus "{value}"</p>
              </div>
            </button>
          )}

          {suggestions.length === 0 ? (
            <div className="px-4 py-4 text-xs text-gray-400 text-center">
              Belum ada data pelayan
            </div>
          ) : (
            suggestions.map(m => (
              <button
                key={m.id}
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  onSave(m.name);
                  setOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 flex items-center gap-2.5 ${
                  m.name === value ? 'bg-blue-50/80 font-semibold text-blue-900' : ''
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-900 leading-tight truncate">{m.name}</p>
                  {m.nickname && <p className="text-[10px] text-gray-400 leading-tight truncate">{m.nickname}</p>}
                </div>
                {m.name === value && <Check size={13} className="text-blue-600 flex-shrink-0" />}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Google Apps Script code for the user to deploy ───────────────────────────
const GAS_SCRIPT = `function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Jadwal Pelayanan') || ss.insertSheet('Jadwal Pelayanan');
    sheet.clearContents(); sheet.clearFormats(); sheet.setFrozenRows(0);
    var rows = payload.rows;
    var maxCols = rows.reduce(function(m, r) { return Math.max(m, r.length); }, 1);
    sheet.getRange(1, 1, rows.length, maxCols).setValues(
      rows.map(function(r) { while (r.length < maxCols) r.push(''); return r; })
    );
    payload.formats.forEach(function(f) {
      var r = f.row + 1;
      var rg = sheet.getRange(r, 1, 1, f.merge || maxCols);
      if (f.bg)     rg.setBackground(f.bg);
      if (f.color)  rg.setFontColor(f.color);
      if (f.bold)   rg.setFontWeight('bold');
      if (f.italic) rg.setFontStyle('italic');
      if (f.size)   rg.setFontSize(f.size);
      if (f.align)  rg.setHorizontalAlignment(f.align);
      if (f.merge)  sheet.getRange(r, 1, 1, f.merge).merge();
      if (f.height) sheet.setRowHeight(r, f.height);
      if (f.cells)  f.cells.forEach(function(c) {
        if (c.bold) sheet.getRange(r, c.col+1).setFontWeight('bold');
      });
    });
    sheet.setColumnWidth(1, 140);
    for (var i = 2; i <= maxCols; i++) sheet.setColumnWidth(i, 120);
    return ContentService.createTextOutput(JSON.stringify({success:true}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({success:false,error:err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({status:'ok'}))
    .setMimeType(ContentService.MimeType.JSON);
}`;

// ── Main component ────────────────────────────────────────────────────────────
export default function ScheduleManagement() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const canEdit = isSuperAdmin || user?.permissions?.editJadwal || user?.permissions?.editPelayan || false;

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [activeDivision, setActiveDivision] = useState<DivId>('pemuji');
  const [scheduleData, setScheduleData] = useState<Record<string, WeekSchedule>>({});
  const [jemaatList, setJemaatList] = useState<JemaatMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [gsheetsUrl, setGsheetsUrl] = useState('');
  const [scriptUrl, setScriptUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [gsheetsInput, setGsheetsInput] = useState('');
  const [scriptInput, setScriptInput] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [cleanupPreview, setCleanupPreview] = useState<{ date: string; divId: string; role: string; name: string }[] | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const sundays = useMemo(() => getSundaysInMonth(year, month), [year, month]);
  const divInfo = DIVISIONS.find(d => d.id === activeDivision)!;

  // ── Load jemaat directly from kv_store (includes pelayan field) ─────────────
  const loadJemaat = useCallback(async () => {
    try {
      const toMember = (r: any) => {
        const m = r.value as any;
        if (!m?.name) return null;
        return {
          id: (m.id || r.key) as string,
          name: m.name as string,
          nickname: m.nickname as string | undefined,
          pelayan: (m.pelayan || []) as string[],
        };
      };

      // Union both formats — congregation:member: (new) + member: (old), deduped by id
      const [{ data: d1 }, { data: d2 }] = await Promise.all([
        supabase.from(KV).select('key, value').like('key', 'congregation:member:%'),
        supabase.from(KV).select('key, value').like('key', 'member:%'),
      ]);

      const seen = new Set<string>();
      const list: JemaatMember[] = [];
      for (const r of [...(d1 || []), ...(d2 || [])]) {
        const m = toMember(r);
        if (m && !seen.has(m.id)) { seen.add(m.id); list.push(m); }
      }
      list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      setJemaatList(list);
    } catch {}
  }, []);

  // ── Load schedule for current month ────────────────────────────────────────
  const loadSchedule = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Load all weeks in this month (+ buffer)
      const from = isoDate(sundays[0] || new Date(year, month, 1));
      const to   = isoDate(sundays[sundays.length - 1] || new Date(year, month, 28));
      const { data } = await supabase
        .from(KV).select('key, value')
        .like('key', 'schedule:week:%');
      const map: Record<string, WeekSchedule> = {};
      (data || []).forEach((r: any) => {
        const w = r.value as WeekSchedule;
        if (w?.date >= from && w?.date <= to) map[w.date] = w;
      });
      // Ensure all sundays have a record
      sundays.forEach(s => {
        const iso = isoDate(s);
        if (!map[iso]) map[iso] = { date: iso, divisions: {} };
      });
      setScheduleData(map);
    } catch (e: any) {
      if (!silent) setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sundays, year, month]);

  // ── Load Google Sheets config from settings ─────────────────────────────────
  const loadGsheetsUrl = useCallback(async () => {
    try {
      const { data } = await supabase.from(KV).select('value').eq('key', 'schedule:config:gsheets_url').single();
      const cfg = data?.value as any;
      const url = cfg?.url || '';
      const script = cfg?.scriptUrl || '';
      setGsheetsUrl(url);
      setGsheetsInput(url);
      setScriptUrl(script);
      setScriptInput(script);
    } catch {}
  }, []);

  useEffect(() => { loadJemaat(); }, []);
  useAutoRefresh(loadJemaat, 30_000);
  useEffect(() => { loadSchedule(); loadGsheetsUrl(); }, [month, year]);

  // ── Save one week ───────────────────────────────────────────────────────────
  const saveWeek = async (weekData: WeekSchedule) => {
    setSaving(true);
    try {
      const key = `schedule:week:${weekData.date}`;
      const { data: existing } = await supabase.from(KV).select('key').eq('key', key).single();
      if (existing) {
        await supabase.from(KV).update({ value: weekData }).eq('key', key);
      } else {
        await supabase.from(KV).insert({ key, value: weekData });
      }
      setScheduleData(prev => ({ ...prev, [weekData.date]: weekData }));
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  // ── Set a name in a cell ────────────────────────────────────────────────────
  const setName = (date: string, divId: string, role: string, name: string) => {
    const current = scheduleData[date] || { date, divisions: {} };
    const updated: WeekSchedule = {
      ...current,
      divisions: {
        ...current.divisions,
        [divId]: { ...(current.divisions[divId] || {}), [role]: name },
      },
    };
    saveWeek(updated);
  };

  const clearName = (date: string, divId: string, role: string) => setName(date, divId, role, '');

  // ── Conflict detection ──────────────────────────────────────────────────────
  // Returns a map: name → [divisionLabels] that have that name on the same date
  const conflictsForDate = useCallback((date: string): Record<string, string[]> => {
    const week = scheduleData[date];
    if (!week) return {};
    const nameDiv: Record<string, string[]> = {};
    Object.entries(week.divisions).forEach(([dId, roles]) => {
      const divLabel = DIVISIONS.find(d => d.id === dId)?.label || dId;
      Object.values(roles).forEach(name => {
        if (!name) return;
        const key = name.toLowerCase().trim();
        if (!nameDiv[key]) nameDiv[key] = [];
        if (!nameDiv[key].includes(divLabel)) nameDiv[key].push(divLabel);
      });
    });
    // Only return names that appear in >1 division
    const conflicts: Record<string, string[]> = {};
    Object.entries(nameDiv).forEach(([name, divs]) => {
      if (divs.length > 1) conflicts[name] = divs;
    });
    return conflicts;
  }, [scheduleData]);

  // ── Suggestions per division — strictly filtered by pelayan keys ─────────────
  const suggestions = useMemo(() => {
    const keys = divInfo.pelayanKeys as readonly string[];
    return jemaatList.filter(m =>
      (m.pelayan || []).some(p => keys.includes(p))
    );
  }, [divInfo, jemaatList]);

  // ── Save Google Sheets config ───────────────────────────────────────────────
  const saveGsheetsUrl = async () => {
    setSavingUrl(true);
    const key = 'schedule:config:gsheets_url';
    const val = { url: gsheetsInput.trim(), scriptUrl: scriptInput.trim() };
    const { data: ex } = await supabase.from(KV).select('key').eq('key', key).single();
    if (ex) await supabase.from(KV).update({ value: val }).eq('key', key);
    else await supabase.from(KV).insert({ key, value: val });
    setGsheetsUrl(gsheetsInput.trim());
    setScriptUrl(scriptInput.trim());
    setShowSettings(false);
    setSavingUrl(false);
  };

  // ── Build schedule rows + formats (shared by export + sync) ─────────────────
  const buildSchedulePayload = () => {
    const rows: any[][] = [];
    const formats: any[] = [];
    let ri = 0;

    rows.push(['JADWAL PELAYANAN IBADAH UMUM GBI JELAMBAR TIMUR']);
    formats.push({ row: ri, bg: '#1E3A5F', color: '#FFFFFF', bold: true, size: 13, align: 'center', merge: 10, height: 30 });
    ri++;
    rows.push([]); ri++;

    for (const div of DIVISIONS) {
      const gs = DIV_GS[div.id];
      const colCount = div.roles.length + 1;

      rows.push([div.label]);
      formats.push({ row: ri, bg: gs.header, color: '#FFFFFF', bold: true, size: 11, align: 'center', merge: colCount, height: 22 });
      ri++;

      rows.push(['Tanggal', ...div.roles]);
      formats.push({ row: ri, bg: gs.subheader, bold: true, size: 10, height: 18 });
      ri++;

      sundays.forEach((s, si) => {
        const iso = isoDate(s);
        const weekDiv = scheduleData[iso]?.divisions[div.id] || {};
        rows.push([displayDate(iso), ...div.roles.map(r => weekDiv[r] || '')]);
        const fmt: any = { row: ri, size: 10, height: 18, cells: [{ col: 0, bold: true }] };
        if (si % 2 === 1) fmt.bg = gs.alt;
        formats.push(fmt);
        ri++;
      });

      if (div.notes) {
        div.notes.split('\n').forEach(note => {
          rows.push([`• ${note}`]);
          formats.push({ row: ri, bg: '#FFFBEB', color: '#92400E', italic: true, size: 9, merge: colCount, height: 16 });
          ri++;
        });
      }

      rows.push([]); ri++;
    }

    return { rows, formats };
  };

  // ── Excel export with colors (ExcelJS) ──────────────────────────────────────
  const exportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Jadwal Pelayanan');

      let rowNum = 1;

      // Title
      const titleRow = ws.getRow(rowNum);
      titleRow.height = 30;
      const titleCell = titleRow.getCell(1);
      titleCell.value = 'JADWAL PELAYANAN IBADAH UMUM GBI JELAMBAR TIMUR';
      titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.mergeCells(rowNum, 1, rowNum, 10);
      rowNum++;

      ws.addRow([]); rowNum++;

      for (const div of DIVISIONS) {
        const ec = DIV_EXCEL[div.id];
        const colCount = div.roles.length + 1;

        // Division header
        const hRow = ws.getRow(rowNum);
        hRow.height = 22;
        ws.mergeCells(rowNum, 1, rowNum, colCount);
        const hCell = hRow.getCell(1);
        hCell.value = div.label;
        hCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ec.header } };
        hCell.alignment = { horizontal: 'center', vertical: 'middle' };
        rowNum++;

        // Column headers
        const chRow = ws.getRow(rowNum);
        chRow.height = 18;
        ['Tanggal', ...div.roles].forEach((label, ci) => {
          const cell = chRow.getCell(ci + 1);
          cell.value = label;
          cell.font = { bold: true, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ec.subheader } };
          cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
        });
        rowNum++;

        // Data rows
        sundays.forEach((s, si) => {
          const iso = isoDate(s);
          const weekDiv = scheduleData[iso]?.divisions[div.id] || {};
          const dataRow = ws.getRow(rowNum);
          dataRow.height = 18;
          [displayDate(iso), ...div.roles.map(r => weekDiv[r] || '')].forEach((v, ci) => {
            const cell = dataRow.getCell(ci + 1);
            cell.value = v;
            cell.font = { bold: ci === 0, size: 10 };
            if (si % 2 === 1) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ec.alt } };
            }
          });
          rowNum++;
        });

        // Notes
        if (div.notes) {
          div.notes.split('\n').forEach(note => {
            const nRow = ws.getRow(rowNum);
            nRow.height = 16;
            ws.mergeCells(rowNum, 1, rowNum, colCount);
            const nCell = nRow.getCell(1);
            nCell.value = `• ${note}`;
            nCell.font = { italic: true, size: 9, color: { argb: 'FF92400E' } };
            nCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
            rowNum++;
          });
        }

        ws.addRow([]); rowNum++;
      }

      // Column widths
      ws.getColumn(1).width = 16;
      for (let i = 2; i <= 12; i++) ws.getColumn(i).width = 15;

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Jadwal_Pelayanan_${MONTHS_ID[month]}_${year}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(`Gagal export: ${e.message}`);
    }
  };

  // ── Sync directly to Google Sheets via Apps Script ───────────────────────────
  const syncToGSheets = async () => {
    if (!scriptUrl) return;
    setSyncing(true);
    setSyncSuccess(false);
    try {
      const { rows, formats } = buildSchedulePayload();
      const res = await fetch(scriptUrl, {
        method: 'POST',
        body: JSON.stringify({ rows, formats, month: MONTHS_ID[month], year }),
        redirect: 'follow',
      });
      if (!res.ok && res.status !== 0) throw new Error(`HTTP ${res.status}`);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 4000);
    } catch (e: any) {
      setError(`Gagal sync: ${e.message}. Pastikan Apps Script sudah di-deploy dengan benar.`);
    }
    setSyncing(false);
  };

  // ── Cleanup: find schedule entries whose name isn't in jemaatList ────────────
  const previewCleanup = () => {
    const validNames = new Set(jemaatList.map(m => m.name.toLowerCase().trim()));
    const stale: { date: string; divId: string; role: string; name: string }[] = [];
    Object.values(scheduleData).forEach(week => {
      Object.entries(week.divisions).forEach(([divId, roles]) => {
        Object.entries(roles).forEach(([role, name]) => {
          if (name && !validNames.has(name.toLowerCase().trim())) {
            stale.push({ date: week.date, divId, role, name });
          }
        });
      });
    });
    stale.sort((a, b) => a.name.localeCompare(b.name, 'id'));
    setCleanupPreview(stale);
  };

  const confirmCleanup = async () => {
    if (!cleanupPreview?.length) return;
    setCleaning(true);
    try {
      // Group by date to batch updates
      const byDate: Record<string, typeof cleanupPreview> = {};
      cleanupPreview.forEach(e => {
        if (!byDate[e.date]) byDate[e.date] = [];
        byDate[e.date].push(e);
      });

      for (const [date, entries] of Object.entries(byDate)) {
        const week = scheduleData[date];
        if (!week) continue;
        const updated: WeekSchedule = {
          ...week,
          divisions: { ...week.divisions },
        };
        entries.forEach(e => {
          if (updated.divisions[e.divId]) {
            updated.divisions[e.divId] = { ...updated.divisions[e.divId], [e.role]: '' };
          }
        });
        await saveWeek(updated);
      }
    } catch {}
    setCleaning(false);
    setCleanupPreview(null);
  };

  // ── All conflicts for display ───────────────────────────────────────────────
  const allConflicts = useMemo(() => {
    const all: { name: string; date: string; divisions: string[] }[] = [];
    sundays.forEach(s => {
      const iso = isoDate(s);
      const c = conflictsForDate(iso);
      Object.entries(c).forEach(([name, divs]) => {
        all.push({ name, date: iso, divisions: divs });
      });
    });
    return all;
  }, [sundays, conflictsForDate]);

  if (loading && Object.keys(scheduleData).length === 0) return <div className="text-center py-16 text-gray-400">Memuat jadwal...</div>;

  return (
    <div className="overflow-y-auto flex-1">
    <div className="space-y-5 max-w-full p-4 md:p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Jadwal Pelayanan</h2>
          <p className="text-gray-400 text-sm mt-0.5">Ibadah Umum GBI Jelambar Timur</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            <Download size={14} />Export Excel
          </button>
          {canEdit && (
            <button onClick={previewCleanup} className="p-2 text-gray-400 hover:text-amber-600 transition-colors" title="Bersihkan nama lama">
              <Trash2 size={15} />
            </button>
          )}
          <button onClick={() => { loadSchedule(); loadJemaat(); }} className="p-2 text-gray-400 hover:text-gray-600">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle size={14} />{error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {!canEdit && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm">
          Anda hanya memiliki akses <strong>view-only</strong>. Hubungi Super Admin untuk akses edit.
        </div>
      )}

      {/* ── Conflict warning ── */}
      {allConflicts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-2">
            <AlertTriangle size={15} />
            {allConflicts.length} Tabrakan Jadwal Ditemukan
          </div>
          <div className="space-y-1">
            {allConflicts.map((c, i) => (
              <p key={i} className="text-xs text-amber-700">
                • <strong>{c.name}</strong> pada {displayDate(c.date)} terdaftar di: {c.divisions.join(' & ')}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Month navigation ── */}
      <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm w-fit">
        <button onClick={() => { const d = new Date(year, month - 1); setMonth(d.getMonth()); setYear(d.getFullYear()); }}
          className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </button>
        <span className="font-bold text-gray-900 min-w-[140px] text-center text-sm">
          {MONTHS_ID[month]} {year}
        </span>
        <button onClick={() => { const d = new Date(year, month + 1); setMonth(d.getMonth()); setYear(d.getFullYear()); }}
          className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronRight size={18} />
        </button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <span className="text-xs text-gray-400">{sundays.length} minggu</span>
        {saving && <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-1" />}
      </div>

      {/* ── Division tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-hide">
        {DIVISIONS.map(div => {
          const isActive = activeDivision === div.id;
          return (
            <button
              key={div.id}
              onClick={() => { setActiveDivision(div.id as DivId); loadJemaat(); }}
              className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-2 ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-indigo-500/25'
                  : 'bg-white border-slate-200/90 text-slate-700 hover:border-indigo-300 hover:bg-slate-50/70 shadow-2xs'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${div.color} flex-shrink-0`} />
              <span>{div.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Schedule table for active division ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Division header banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl ${divInfo.color} flex items-center justify-center text-white shadow-2xs flex-shrink-0`}>
              <span className="font-black text-xs">{divInfo.label.charAt(0)}</span>
            </div>
            <div>
              <h3 className="text-white font-bold text-sm tracking-wide leading-tight">{divInfo.label}</h3>
              <p className="text-[11px] text-indigo-200 mt-0.5">
                Jadwal pelayan bulan {MONTHS_ID[month]} {year} ({sundays.length} Minggu)
              </p>
            </div>
          </div>
          {divInfo.notes && (
            <div className="relative group">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xs transition-colors cursor-help border border-white/10">
                <Info size={13} className="text-amber-300" />
                <span>Ketentuan & Notes</span>
              </div>
              <div className="absolute right-0 top-full mt-2 bg-slate-900/95 text-white border border-slate-700 text-xs rounded-2xl p-3.5 shadow-2xl w-80 z-30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none backdrop-blur-md">
                <p className="font-bold text-amber-300 mb-1 text-[11px] uppercase tracking-wider">Catatan Divisi:</p>
                {divInfo.notes.split('\n').map((n, i) => <p key={i} className="leading-relaxed text-slate-200 mt-1">• {n}</p>)}
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto pb-28 min-h-[380px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80">
                <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-32">
                  Tanggal
                </th>
                {divInfo.roles.map(role => (
                  <th key={role} className="px-3.5 py-3.5 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sundays.map((s, si) => {
                const iso = isoDate(s);
                const weekDiv = scheduleData[iso]?.divisions[activeDivision] || {};
                const conflicts = conflictsForDate(iso);
                const isBottomRows = si >= Math.max(1, sundays.length - 2);

                return (
                  <tr key={iso} className={`border-b border-slate-100 hover:bg-slate-50/60 transition-colors ${si % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs font-bold text-slate-900">{displayDate(iso)}</span>
                    </td>
                    {divInfo.roles.map(role => {
                      const val = weekDiv[role] || '';
                      const isManualText = role.toLowerCase() === 'tema' || role.toLowerCase() === 'pembicara';

                      if (isManualText) {
                        return (
                          <td key={role} className="px-2.5 py-2.5">
                            <ManualTextCell
                              value={val}
                              placeholder={role}
                              onSave={text => setName(iso, activeDivision, role, text)}
                              onClear={() => clearName(iso, activeDivision, role)}
                              disabled={!canEdit}
                            />
                          </td>
                        );
                      }

                      const nameKey = val.toLowerCase().trim();
                      const isConflict = !!(val && conflicts[nameKey] && conflicts[nameKey].length > 1);
                      const conflictDivisions = isConflict
                        ? conflicts[nameKey].filter(d => d !== divInfo.label)
                        : [];

                      return (
                        <td key={role} className="px-2.5 py-2.5">
                          <NameCell
                            value={val}
                            suggestions={suggestions}
                            onSave={name => setName(iso, activeDivision, role, name)}
                            onClear={() => clearName(iso, activeDivision, role)}
                            isConflict={isConflict}
                            conflictDivisions={conflictDivisions}
                            disabled={!canEdit}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Notes footer */}
        {divInfo.notes && (
          <div className="px-5 py-3 bg-amber-50/70 border-t border-amber-100/80 flex items-start gap-2">
            <Info size={14} className="text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="font-bold text-amber-900">Perhatian: </strong>
              {divInfo.notes.split('\n').join(' • ')}
            </div>
          </div>
        )}
      </div>

      {/* ── Ringkasan semua divisi: matrix divisi x minggu ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Ringkasan Semua Divisi</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Seluruh petugas gabungan dalam setiap minggu</p>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs">
            Nama merah = bertugas lebih dari satu divisi di hari yang sama
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left" style={{ minWidth: 160 + sundays.length * 170 }}>
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/80">
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-44 border-r border-slate-200/80">
                  Divisi
                </th>
                {sundays.map(sd => {
                  const iso = isoDate(sd);
                  const nConf = Object.keys(conflictsForDate(iso)).length;
                  return (
                    <th key={iso} className="px-4 py-3 text-xs font-bold text-slate-800 align-bottom">
                      <div>{displayDate(iso)}</div>
                      {nConf > 0 && (
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 w-fit">
                          <AlertTriangle size={10} />
                          <span>{nConf} tabrakan</span>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {DIVISIONS.map(div => (
                <tr key={div.id} className="align-top border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                  <th className="sticky left-0 z-10 bg-white px-4 py-3 border-r border-slate-200/80 font-normal">
                    <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-xl border leading-tight ${div.lightColor}`}>
                      {div.label}
                    </span>
                  </th>
                  {sundays.map(sd => {
                    const iso = isoDate(sd);
                    const conflicts = conflictsForDate(iso);
                    const divData = scheduleData[iso]?.divisions[div.id] || {};
                    const names = Object.values(divData).filter(Boolean) as string[];
                    return (
                      <td key={iso} className="px-4 py-3">
                        {names.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {names.map((name, i) => {
                              const nk = name.toLowerCase().trim();
                              const isConflict = !!(conflicts[nk] && conflicts[nk].length > 1);
                              return (
                                <span
                                  key={i}
                                  className={`text-xs px-2.5 py-1 rounded-xl font-medium border ${
                                    isConflict
                                      ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold shadow-2xs'
                                      : 'bg-slate-50 text-slate-800 border-slate-200/80'
                                  }`}
                                >
                                  {name}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 font-medium">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cleanup preview modal ── */}
      {cleanupPreview !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Bersihkan Nama Tidak Valid</h2>
              <button onClick={() => setCleanupPreview(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {cleanupPreview.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
                <Check size={32} className="text-emerald-500" />
                <p className="text-emerald-700 font-semibold text-sm">Semua nama valid!</p>
                <p className="text-gray-400 text-xs text-center">Tidak ada nama di jadwal yang tidak terdaftar di Data Jemaat.</p>
              </div>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-xs text-amber-800">
                  <strong>{cleanupPreview.length} entri</strong> ditemukan namanya tidak ada di Data Jemaat. Apakah ingin menghapus semua?
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 mb-4">
                  {cleanupPreview.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{e.name}</p>
                        <p className="text-xs text-gray-400">
                          {displayDate(e.date)} · {DIVISIONS.find(d => d.id === e.divId)?.label} · {e.role}
                        </p>
                      </div>
                      <span className="text-xs text-red-500 font-medium flex-shrink-0">Tidak ditemukan</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setCleanupPreview(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
                  <button onClick={confirmCleanup} disabled={cleaning}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                    {cleaning ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 size={14} />}
                    Hapus {cleanupPreview.length} Entri
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Google Sheets settings modal ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900">Integrasi Google Sheets</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              {/* Apps Script URL */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700">
                    Apps Script URL
                    <span className="ml-2 text-xs font-normal text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Untuk sync langsung</span>
                  </label>
                  <button
                    onClick={() => setShowInstructions(v => !v)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                    Cara setup <ChevronDown size={12} className={showInstructions ? 'rotate-180' : ''} />
                  </button>
                </div>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={scriptInput}
                  onChange={e => setScriptInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <p className="text-xs text-gray-400">Setelah setup, tombol "Sync ke Google Sheets" akan muncul di halaman jadwal.</p>
              </div>

              {/* Instructions collapsible */}
              {showInstructions && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-indigo-800">Cara setup sync langsung (sekali saja):</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-indigo-700">
                    <li>Buka Google Sheets yang ingin diisi jadwal</li>
                    <li>Klik <strong>Extensions → Apps Script</strong></li>
                    <li>Hapus kode yang ada, paste kode di bawah ini</li>
                    <li>Klik <strong>Deploy → New deployment → Web app</strong></li>
                    <li>Set <strong>Execute as: Me</strong> &amp; <strong>Who has access: Anyone</strong></li>
                    <li>Klik Deploy, copy URL web app → paste di kolom atas</li>
                  </ol>
                  <div className="relative">
                    <pre className="bg-gray-900 text-green-300 text-[10px] rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">{GAS_SCRIPT}</pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(GAS_SCRIPT)}
                      className="absolute top-2 right-2 flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors">
                      <Copy size={10} />Copy
                    </button>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4 space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  URL Google Sheets
                  <span className="ml-2 text-xs font-normal text-gray-400">Untuk tombol "Buka"</span>
                </label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={gsheetsInput}
                  onChange={e => setGsheetsInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowSettings(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
              <button onClick={saveGsheetsUrl} disabled={savingUrl}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                {savingUrl ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={14} />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
