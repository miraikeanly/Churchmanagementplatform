import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Church, Calendar, Heart, Bell, MapPin, Sparkles, User, ShieldCheck,
  ChevronRight, Compass, Gift, Phone, ExternalLink, Bookmark, Share2, LogIn,
  MessageCircle, Info, CheckCircle2, Flame, Award, BookOpen
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CHURCH } from '../../lib/church';
import { ADULT } from '../../lib/ministries';
import ClaySplash from './ClaySplash';
import PrayerRequestModal from './PrayerRequestModal';
import ScheduleReminderView from './ScheduleReminderView';
import AdminPinModal from '../components/auth/AdminPinModal';

export default function JemaatMobileApp() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [showSplash, setShowSplash] = useState(() => {
    // Show splash once per session or default true
    if (typeof window === 'undefined') return false;
    return !sessionStorage.getItem('gjt_mobile_splash_shown');
  });

  const [activeTab, setActiveTab] = useState<'home' | 'schedule' | 'prayer' | 'profile'>('home');
  const [prayerModalOpen, setPrayerModalOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [verseCopied, setVerseCopied] = useState(false);

  const handleFinishSplash = () => {
    sessionStorage.setItem('gjt_mobile_splash_shown', 'true');
    setShowSplash(false);
  };

  const handleCopyVerse = () => {
    navigator.clipboard?.writeText(
      '"Kiranya TUHAN memberkati engkau dan melindungi engkau; TUHAN menyinari engkau dengan wajah-Nya dan memberi engkau kasih karunia." (Bilangan 6:24-25)'
    );
    setVerseCopied(true);
    setTimeout(() => setVerseCopied(false), 2500);
  };

  if (showSplash) {
    return <ClaySplash onFinish={handleFinishSplash} appName={CHURCH.name} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F2EDFD] via-[#FAF7FF] to-[#EDE7FB] text-slate-800 pb-24 font-sans select-none overflow-x-hidden">
      {/* ── Fixed Top Header Bar ── */}
      <header className="sticky top-0 z-40 bg-[#F2EDFD]/85 backdrop-blur-md px-5 pt-4 pb-3 flex items-center justify-between border-b border-violet-100/60 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white shadow-[0_6px_14px_rgba(109,74,219,0.3),inset_0_2px_4px_rgba(255,255,255,0.7)] border border-violet-300">
            <Church size={20} />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-800 tracking-tight leading-tight">
              {CHURCH.name}
            </h1>
            <p className="text-[11px] font-semibold text-violet-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Ibadah & Komunitas Jemaat
            </p>
          </div>
        </div>

        {/* Admin Portal Gateway Button */}
        <button
          onClick={() => setPinModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white hover:bg-violet-50 border border-violet-200 text-violet-800 text-xs font-bold shadow-[0_4px_12px_rgba(139,92,246,0.12)] active:scale-95 transition-all"
          title="Buka Portal Admin"
        >
          <ShieldCheck size={15} className="text-violet-600" />
          <span>Admin</span>
        </button>
      </header>

      {/* ── Main Content Area ── */}
      <main className="max-w-md mx-auto px-5 pt-4">
        {activeTab === 'home' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Daily Scripture Card - 3D Clay Aesthetic */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-5 rounded-[32px] bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 text-white shadow-[0_16px_32px_rgba(109,74,219,0.32),inset_0_3px_6px_rgba(255,255,255,0.4)] relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-extrabold uppercase tracking-wider text-violet-100">
                  <Sparkles size={12} className="text-amber-300" /> Ayat Hari Ini
                </span>
                <button
                  onClick={handleCopyVerse}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  title="Salin Ayat"
                >
                  <Share2 size={14} className="text-white" />
                </button>
              </div>

              <blockquote className="text-sm sm:text-base font-semibold leading-relaxed mt-2 text-violet-50 italic">
                "Kiranya TUHAN memberkati engkau dan melindungi engkau; TUHAN menyinari engkau dengan wajah-Nya dan memberi engkau kasih karunia."
              </blockquote>
              <p className="text-xs font-bold text-amber-300 mt-2 text-right tracking-wide">
                — Bilangan 6:24-25
              </p>

              {verseCopied && (
                <div className="mt-2 text-[11px] font-bold text-emerald-300 bg-emerald-950/40 px-3 py-1 rounded-full text-center">
                  Ayat berhasil disalin!
                </div>
              )}
            </motion.div>

            {/* 3D Clay Quick Action Grid (Sesuai Referensi Gambar) */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Menu Utama
                </h3>
                <span className="text-[11px] text-violet-600 font-semibold">GBI Mobile</span>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {/* 1. Komunitas / Jemaat */}
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => navigate('/jemaat')}
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-[#E0D7FA] to-[#C8B8F8] flex items-center justify-center text-violet-700 shadow-[0_8px_18px_rgba(139,92,246,0.22),inset_0_3px_5px_rgba(255,255,255,0.9),inset_0_-4px_8px_rgba(109,74,219,0.2)] border border-white/80 transition-transform group-hover:scale-105">
                    <User size={26} className="text-violet-700" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center">Jemaat</span>
                </motion.button>

                {/* 2. Jadwal & Kalender */}
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setActiveTab('schedule')}
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-[#FFE7D1] to-[#FDBA74] flex items-center justify-center text-amber-700 shadow-[0_8px_18px_rgba(249,115,22,0.22),inset_0_3px_5px_rgba(255,255,255,0.9),inset_0_-4px_8px_rgba(234,88,12,0.2)] border border-white/80 transition-transform group-hover:scale-105">
                    <Calendar size={26} className="text-orange-600" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center">Jadwal</span>
                </motion.button>

                {/* 3. Doa & Pelayanan */}
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setPrayerModalOpen(true)}
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-[#D1FAE5] to-[#6EE7B7] flex items-center justify-center text-emerald-700 shadow-[0_8px_18px_rgba(16,185,129,0.22),inset_0_3px_5px_rgba(255,255,255,0.9),inset_0_-4px_8px_rgba(5,150,105,0.2)] border border-white/80 transition-transform group-hover:scale-105">
                    <Heart size={26} className="text-emerald-700 fill-emerald-600/30" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center">Doa</span>
                </motion.button>

                {/* 4. Persembahan / Give */}
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => navigate('/give')}
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-[#FEE2E2] to-[#FCA5A5] flex items-center justify-center text-rose-700 shadow-[0_8px_18px_rgba(244,63,94,0.22),inset_0_3px_5px_rgba(255,255,255,0.9),inset_0_-4px_8px_rgba(225,29,72,0.2)] border border-white/80 transition-transform group-hover:scale-105">
                    <Gift size={26} className="text-rose-600" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center">Give</span>
                </motion.button>
              </div>
            </div>

            {/* Upcoming Sunday Service Spotlight */}
            <div className="p-5 rounded-[28px] bg-gradient-to-br from-white via-[#FAF8FF] to-[#F2ECFF] border-2 border-white shadow-[0_12px_28px_rgba(139,92,246,0.1),inset_0_2px_4px_rgba(255,255,255,0.9)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-violet-700 bg-violet-100/70 px-3 py-1 rounded-full">
                  Ibadah Minggu Terdekat
                </span>
                <span className="text-xs font-bold text-slate-500">Pukul 08.00 WIB</span>
              </div>
              <h4 className="text-lg font-extrabold text-slate-800">Ibadah Umum GBI Jelambar Timur</h4>
              <p className="text-xs text-slate-600 mt-1">
                Gedung Utama Lt. 1 • Terbuka untuk seluruh jemaat dan keluarga. Mari bersekutu memuji nama Tuhan!
              </p>

              <div className="mt-4 flex items-center gap-2.5">
                <button
                  onClick={() => setActiveTab('schedule')}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-[0_6px_16px_rgba(109,74,219,0.3)] text-center transition-all"
                >
                  Lihat Jadwal Lengkap
                </button>
                <a
                  href={CHURCH.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-white hover:bg-violet-50 text-violet-700 border border-violet-200 transition-colors shadow-2xs"
                  title="Buka Petunjuk Arah Google Maps"
                >
                  <MapPin size={18} />
                </a>
              </div>
            </div>

            {/* Quick Contact & WhatsApp Pill */}
            <div className="p-4 rounded-2xl bg-white/80 border border-violet-100 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Sekretariat Gereja</p>
                  <p className="text-[11px] text-slate-500">{CHURCH.whatsappDisplay}</p>
                </div>
              </div>
              <a
                href={`https://wa.me/${CHURCH.whatsappNumber}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <MessageCircle size={14} /> Chat WA
              </a>
            </div>
          </div>
        )}

        {/* ── Tab: Schedule & Reminder ── */}
        {activeTab === 'schedule' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-2 border-b border-violet-100">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">Jadwal & Pengingat</h2>
                <p className="text-xs text-violet-600 font-medium">Pasang pengingat ibadah langsung di HP Anda</p>
              </div>
            </div>
            <ScheduleReminderView />
          </div>
        )}

        {/* ── Tab: Profile / Jemaat Akun ── */}
        {activeTab === 'profile' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="p-6 rounded-[32px] bg-gradient-to-br from-white via-[#FAF8FF] to-[#F2ECFF] border-2 border-white shadow-lg text-center flex flex-col items-center">
              <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-violet-600 to-indigo-700 text-white flex items-center justify-center text-3xl font-extrabold mb-3 shadow-[0_12px_24px_rgba(109,74,219,0.3)]">
                {user?.name?.[0]?.toUpperCase() || 'J'}
              </div>
              <h3 className="text-lg font-extrabold text-slate-800">{user?.name || 'Jemaat GBI'}</h3>
              <p className="text-xs font-semibold text-violet-600">{user?.email || 'Aplikasi Mobile GBI Jeltim'}</p>
              <span className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-violet-100 text-violet-800 text-[11px] font-bold">
                Role: {user?.role || 'Jemaat Terdaftar'}
              </span>
            </div>

            {/* Admin Portal Entry */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-900 to-indigo-950 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <ShieldCheck size={24} className="text-amber-400" />
                <div>
                  <h4 className="text-sm font-bold">Dashboard Admin Web</h4>
                  <p className="text-[11px] text-violet-200">Akses khusus pengurus & Super Admin</p>
                </div>
              </div>
              <button
                onClick={() => setPinModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-extrabold transition-colors"
              >
                Masuk
              </button>
            </div>

            {/* Logout / Switch */}
            {user ? (
              <button
                onClick={() => signOut()}
                className="w-full py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors"
              >
                Keluar dari Akun
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-md transition-colors"
              >
                Login Akun Jemaat / Admin
              </button>
            )}
          </div>
        )}
      </main>

      {/* ── 3D Clay Bottom Navigation Bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-t border-violet-100 px-6 py-2.5 shadow-[0_-8px_20px_rgba(139,92,246,0.08)]">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {/* Home */}
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === 'home' ? 'text-violet-700 scale-105' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                activeTab === 'home' ? 'bg-violet-100 text-violet-700 shadow-2xs' : ''
              }`}
            >
              <Church size={20} />
            </div>
            <span className="text-[10px] font-bold">Home</span>
          </button>

          {/* Jadwal */}
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === 'schedule' ? 'text-violet-700 scale-105' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                activeTab === 'schedule' ? 'bg-violet-100 text-violet-700 shadow-2xs' : ''
              }`}
            >
              <Calendar size={20} />
            </div>
            <span className="text-[10px] font-bold">Jadwal</span>
          </button>

          {/* Doa */}
          <button
            onClick={() => setPrayerModalOpen(true)}
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-violet-600 transition-all"
          >
            <div className="p-1.5 rounded-xl">
              <Heart size={20} />
            </div>
            <span className="text-[10px] font-bold">Doa</span>
          </button>

          {/* Profil / Admin */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === 'profile' ? 'text-violet-700 scale-105' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                activeTab === 'profile' ? 'bg-violet-100 text-violet-700 shadow-2xs' : ''
              }`}
            >
              <User size={20} />
            </div>
            <span className="text-[10px] font-bold">Akun</span>
          </button>
        </div>
      </nav>

      {/* Prayer Request Modal */}
      <PrayerRequestModal
        isOpen={prayerModalOpen}
        onClose={() => setPrayerModalOpen(false)}
        userName={user?.name}
      />

      {/* Admin PIN Gate Modal */}
      <AdminPinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSuccess={() => {
          setPinModalOpen(false);
          navigate('/admin');
        }}
      />
    </div>
  );
}
