import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, TrendingUp, CalendarDays, Users, ClipboardList, Edit, Trash2 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
} from 'recharts';

export interface ReportSession { id: string; title: string; date: string; presentIds: string[]; absentIds: string[]; }
export interface ReportMember { id: string; name: string; }

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmtDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

/**
 * Yearly attendance report for one komisi.
 * Only weeks where someone was actually marked Hadir/Absen are counted, so empty upcoming weeks never show up.
 * The year list is built from the data plus the current year, so 2027 appears by itself when it arrives.
 */
export default function KomisiReport({ komisiLabel, sessions, members, canEdit, onSelectDate, onDeleteSession }: {
  komisiLabel: string;
  sessions: ReportSession[];
  members: ReportMember[];
  canEdit?: boolean;
  onSelectDate?: (date: string) => void;
  onDeleteSession?: (session: ReportSession) => void;
}) {
  const recorded = useMemo(
    () => sessions.filter(s => s.presentIds.length + s.absentIds.length > 0).sort((a, b) => a.date.localeCompare(b.date)),
    [sessions]
  );
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const set = new Set<number>(recorded.map(s => Number(s.date.slice(0, 4))));
    set.add(currentYear);
    return [...set].sort((a, b) => b - a);
  }, [recorded, currentYear]);
  const [year, setYear] = useState(currentYear);

  const yearSessions = useMemo(() => recorded.filter(s => Number(s.date.slice(0, 4)) === year), [recorded, year]);
  const total = members.length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const weekly = yearSessions.map(s => ({
    session: s,
    date: s.date, label: fmtDay(s.date), title: s.title,
    hadir: s.presentIds.length, absen: s.absentIds.length, persen: pct(s.presentIds.length),
  }));

  const monthly = MONTHS.map((name, i) => {
    const inMonth = yearSessions.filter(s => Number(s.date.slice(5, 7)) === i + 1);
    const avg = inMonth.length ? inMonth.reduce((n, s) => n + s.presentIds.length, 0) / inMonth.length : 0;
    return { i, name, short: MONTHS_SHORT[i], weeks: inMonth.length, avg: Math.round(avg * 10) / 10, persen: pct(avg) };
  }).filter(m => m.weeks > 0);

  const avgAll = yearSessions.length ? yearSessions.reduce((n, s) => n + s.presentIds.length, 0) / yearSessions.length : 0;
  const best = weekly.reduce((b, w) => (w.hadir > (b?.hadir ?? -1) ? w : b), null as null | (typeof weekly)[number]);

  const perMember = members.map(m => {
    const hadir = yearSessions.filter(s => s.presentIds.includes(m.id)).length;
    return { id: m.id, name: m.name, hadir, persen: yearSessions.length ? Math.round((hadir / yearSessions.length) * 100) : 0 };
  }).sort((a, b) => b.hadir - a.hadir || a.name.localeCompare(b.name, 'id'));

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(perMember.map(r => ({
      Nama: r.name, Hadir: r.hadir, 'Minggu Tercatat': yearSessions.length, 'Kehadiran (%)': r.persen,
    }))), 'Per Anggota');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(weekly.map(w => ({
      Tanggal: w.date, Sesi: w.title, Hadir: w.hadir, Absen: w.absen, 'Total Anggota': total, 'Kehadiran (%)': w.persen,
    }))), 'Per Minggu');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthly.map(m => ({
      Bulan: m.name, 'Minggu Tercatat': m.weeks, 'Rata-rata Hadir': m.avg, 'Kehadiran (%)': m.persen,
    }))), 'Per Bulan');
    XLSX.writeFile(wb, `Laporan_Absensi_${komisiLabel.replace(/\s+/g, '_')}_${year}.xlsx`);
  };

  const th = 'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold text-gray-900">Laporan {komisiLabel}</h3>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={exportExcel} disabled={yearSessions.length === 0}
          className="ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
          <Download size={13} /> Export Excel
        </button>
      </div>

      {yearSessions.length === 0 ? (
        <div className="text-center py-14 px-6 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
          <ClipboardList size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-gray-500">Belum ada data absensi di tahun {year}</p>
          <p className="text-xs mt-1">Laporan muncul otomatis setelah absensi minggu ini diisi di tab Absensi.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs text-blue-600 flex items-center gap-1"><CalendarDays size={12} />Minggu Tercatat</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{yearSessions.length}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-xs text-emerald-600 flex items-center gap-1"><Users size={12} />Rata-rata Hadir</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{avgAll.toFixed(1)} <span className="text-sm font-medium">/ {total}</span></p>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
              <p className="text-xs text-purple-600 flex items-center gap-1"><TrendingUp size={12} />Tertinggi</p>
              <p className="text-2xl font-bold text-purple-700 mt-1">{best?.hadir ?? 0} <span className="text-sm font-medium">{best?.label}</span></p>
            </div>
          </div>

          {/* Per month */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <p className="text-sm font-semibold text-gray-700 px-4 py-3 border-b border-gray-50">Rekap per Bulan</p>
            <table className="w-full text-sm">
              <thead className="bg-gray-50/70">
                <tr><th className={`${th} text-left`}>Bulan</th><th className={`${th} text-center`}>Minggu</th><th className={`${th} text-center`}>Rata-rata</th><th className={`${th} text-right`}>Kehadiran</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {monthly.map(m => (
                  <tr key={m.i}>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{m.name}</td>
                    <td className="px-3 py-2.5 text-center text-gray-600">{m.weeks}</td>
                    <td className="px-3 py-2.5 text-center text-gray-600">{m.avg}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-block min-w-[3rem] text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{m.persen}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per week */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-2xs">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-700">Rekap per Minggu</p>
              <p className="text-[11px] text-gray-400">Klik Edit untuk revisi absensi atau Hapus untuk menghapus data sesi</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/70">
                  <tr>
                    <th className={`${th} text-left`}>Tanggal</th>
                    <th className={`${th} text-left`}>Sesi</th>
                    <th className={`${th} text-center`}>Hadir</th>
                    <th className={`${th} text-center`}>Absen</th>
                    <th className={`${th} text-right`}>Kehadiran</th>
                    {canEdit && (
                      <th className={`${th} text-center`}>Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...weekly].reverse().map(w => (
                    <tr key={w.date} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                        {new Date(w.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[150px] truncate" title={w.title}>
                        {w.title}
                      </td>
                      <td className="px-3 py-2.5 text-center text-emerald-700 font-semibold">{w.hadir}</td>
                      <td className="px-3 py-2.5 text-center text-red-500">{w.absen}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className="inline-block min-w-[3rem] text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{w.persen}%</span>
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {onSelectDate && (
                              <button
                                type="button"
                                onClick={() => onSelectDate(w.date)}
                                title="Edit / Revisi absensi sesi ini"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80 transition-colors cursor-pointer"
                              >
                                <Edit size={12} />
                                <span>Revisi</span>
                              </button>
                            )}
                            {onDeleteSession && (
                              <button
                                type="button"
                                onClick={() => onDeleteSession(w.session)}
                                title="Hapus sesi dan rekaman absensi ini"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80 transition-colors cursor-pointer"
                              >
                                <Trash2 size={12} />
                                <span>Hapus</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Grafik Kehadiran per Minggu</p>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={weekly} margin={{ left: -20, right: 8, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="hadir" name="Hadir" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {monthly.length > 1 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Grafik Rata-rata per Bulan (%)</p>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <LineChart data={monthly} margin={{ left: -20, right: 8, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="short" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="persen" name="Kehadiran (%)" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Per member */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <p className="text-sm font-semibold text-gray-700 px-4 py-3 border-b border-gray-50">Kehadiran per Anggota</p>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {perMember.map(r => (
                <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                  <p className="flex-1 min-w-0 text-sm text-gray-800 break-words">{r.name}</p>
                  <div className="w-20 bg-gray-100 rounded-full h-1.5 flex-shrink-0">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${r.persen}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">{r.hadir}/{yearSessions.length} · {r.persen}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
