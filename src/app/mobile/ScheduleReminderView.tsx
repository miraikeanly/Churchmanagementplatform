import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar as CalendarIcon, Clock, Bell, MapPin, Check, Plus, ExternalLink } from 'lucide-react';
import { ADULT } from '../../lib/ministries';
import { CHURCH } from '../../lib/church';

export default function ScheduleReminderView() {
  const [reminders, setReminders] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('gjt_reminders');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [notificationStatus, setNotificationStatus] = useState<string>('');

  const toggleReminder = async (id: string, name: string, time: string) => {
    const nextState = !reminders[id];
    const updated = { ...reminders, [id]: nextState };
    setReminders(updated);
    try {
      localStorage.setItem('gjt_reminders', JSON.stringify(updated));
    } catch {}

    if (nextState) {
      // Request notification permission if supported
      if ('Notification' in window) {
        if (Notification.permission !== 'granted') {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            new Notification('Pengingat Ibadah Diaktifkan! 🔔', {
              body: `Anda akan diingatkan untuk ${name} (${time})`,
              icon: '/icons/icon-192.png',
            });
          }
        } else {
          new Notification('Pengingat Ibadah Diaktifkan! 🔔', {
            body: `Anda akan diingatkan untuk ${name} (${time})`,
            icon: '/icons/icon-192.png',
          });
        }
      }

      setNotificationStatus(`Pengingat untuk ${name} berhasil diaktifkan!`);
      setTimeout(() => setNotificationStatus(''), 3500);
    } else {
      setNotificationStatus(`Pengingat ${name} dimatikan.`);
      setTimeout(() => setNotificationStatus(''), 3000);
    }
  };

  const handleAddToCalendar = (name: string, timeStr: string, location: string) => {
    // Generate Google Calendar Link for next Sunday
    const nextSunday = new Date();
    nextSunday.setDate(nextSunday.getDate() + ((7 - nextSunday.getDay()) % 7 || 7));
    const dateFormatted = nextSunday.toISOString().slice(0, 10).replace(/-/g, '');

    const startTime = `${dateFormatted}T010000Z`; // ~08.00 WIB
    const endTime = `${dateFormatted}T030000Z`;   // ~10.00 WIB

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      name + ' - GBI Jelambar Timur'
    )}&dates=${startTime}/${endTime}&details=${encodeURIComponent(
      'Ibadah bersama di GBI Jelambar Timur. ' + location
    )}&location=${encodeURIComponent(CHURCH.address)}`;

    window.open(gcalUrl, '_blank');
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Banner Notice */}
      {notificationStatus && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-sm"
        >
          <span>{notificationStatus}</span>
          <button onClick={() => setNotificationStatus('')} className="text-emerald-600">✕</button>
        </motion.div>
      )}

      {/* Main Schedule Cards with 3D Clay Vibe */}
      <div className="space-y-3.5">
        {ADULT.map(item => {
          const isReminded = !!reminders[item.id];
          const scheduleStr = item.schedules.map(s => `${s.day}, ${s.time}`).join(' | ');

          return (
            <motion.div
              key={item.id}
              whileTap={{ scale: 0.99 }}
              className="p-5 rounded-[28px] bg-gradient-to-br from-white via-[#FAF7FF] to-[#F1EAFF] border-2 border-white/90 shadow-[0_12px_28px_rgba(139,92,246,0.1),inset_0_2px_4px_rgba(255,255,255,0.9)] flex flex-col justify-between relative overflow-hidden"
            >
              {/* Top Accent Strip */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md text-xl"
                    style={{
                      background: `linear-gradient(135deg, ${item.accent}, #6D28D9)`,
                      boxShadow: `0 8px 16px ${item.accent}40`,
                    }}
                  >
                    ⛪
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-800">{item.name}</h3>
                    <p className="text-xs text-violet-600 font-semibold">{item.label}</p>
                  </div>
                </div>

                {/* Reminder Pill Button */}
                <button
                  onClick={() => toggleReminder(item.id, item.name, scheduleStr)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                    isReminded
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-[0_4px_12px_rgba(245,158,11,0.3)]'
                      : 'bg-violet-100/70 hover:bg-violet-200 text-violet-700'
                  }`}
                >
                  <Bell size={13} className={isReminded ? 'fill-white' : ''} />
                  <span>{isReminded ? 'Aktif' : 'Ingatkan'}</span>
                </button>
              </div>

              {/* Time & Location Pill Info */}
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/80 border border-violet-100 text-slate-700 font-semibold shadow-2xs">
                  <Clock size={13} className="text-violet-600" />
                  {scheduleStr}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/80 border border-violet-100 text-slate-700 font-semibold shadow-2xs">
                  <MapPin size={13} className="text-rose-500" />
                  {item.location}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-violet-100/80 flex items-center justify-between">
                <p className="text-[11px] text-slate-500 line-clamp-1 flex-1 pr-2">
                  {item.description}
                </p>
                <button
                  onClick={() => handleAddToCalendar(item.name, scheduleStr, item.location)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-violet-50 border border-violet-200 text-[11px] font-bold text-violet-700 flex items-center gap-1 shadow-2xs transition-colors shrink-0"
                  title="Simpan ke Google Calendar di HP"
                >
                  <CalendarIcon size={12} />
                  <span>+ Kalender</span>
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
