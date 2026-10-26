import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface ClaySplashProps {
  onFinish: () => void;
  appName?: string;
}

export default function ClaySplash({ onFinish, appName = 'GBI Jelambar Timur' }: ClaySplashProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onFinish, 400);
          return 100;
        }
        return prev + 5;
      });
    }, 60);

    return () => clearInterval(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-[#F2EDFD] via-[#ECE5FC] to-[#DFD4F9] p-8 select-none overflow-hidden">
      {/* Background Soft Blobs */}
      <div className="absolute top-12 left-8 w-48 h-48 rounded-full bg-purple-200/50 blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-8 w-60 h-60 rounded-full bg-indigo-200/60 blur-3xl pointer-events-none" />

      {/* Top Badge */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="pt-6 flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur-md shadow-[0_4px_16px_rgba(139,92,246,0.12)] border border-white/80"
      >
        <Sparkles size={14} className="text-violet-600 animate-spin" style={{ animationDuration: '4s' }} />
        <span className="text-xs font-bold tracking-wide uppercase text-violet-800">GBI Mobile Community</span>
      </motion.div>

      {/* Center 3D Clay Illustration & Mascot */}
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0, rotate: -6 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 14, stiffness: 100 }}
          className="relative mb-6"
        >
          {/* 3D Clay Church Container */}
          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-[36px] bg-gradient-to-br from-white via-[#F7F3FF] to-[#E3D9FD] p-4 flex items-center justify-center relative shadow-[0_20px_40px_rgba(109,74,219,0.22),inset_0_4px_8px_rgba(255,255,255,0.9),inset_0_-8px_16px_rgba(139,92,246,0.2)] border-2 border-white/80">
            {/* SVG 3D Clay Church Illustration */}
            <svg viewBox="0 0 120 120" className="w-28 h-28 drop-shadow-[0_8px_12px_rgba(124,58,237,0.25)]">
              {/* Church Base */}
              <rect x="25" y="52" width="70" height="52" rx="12" fill="#8B5CF6" />
              <rect x="28" y="55" width="64" height="46" rx="10" fill="#9D71F9" />

              {/* Roof */}
              <path d="M15 54 L60 22 L105 54 Z" fill="#6D28D9" />
              <path d="M22 51 L60 24 L98 51 Z" fill="#7C3AED" />

              {/* Steeple / Tower */}
              <rect x="48" y="16" width="24" height="34" rx="6" fill="#EDE9FE" />
              {/* Cross on top */}
              <path d="M57 6 L63 6 L63 20 L57 20 Z M52 10 L68 10 L68 14 L52 14 Z" fill="#F59E0B" />

              {/* Main Door */}
              <path d="M48 104 L48 76 C48 70 54 66 60 66 C66 66 72 70 72 76 L72 104 Z" fill="#4C1D95" />
              <circle cx="53" cy="88" r="2.5" fill="#FDE047" />

              {/* Windows */}
              <rect x="34" y="66" width="10" height="14" rx="5" fill="#DDD6FE" opacity="0.9" />
              <rect x="76" y="66" width="10" height="14" rx="5" fill="#DDD6FE" opacity="0.9" />
            </svg>

            {/* Orbiting Clay Pill with Bell */}
            <motion.div
              animate={{ y: [-4, 4, -4] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
              className="absolute -top-3 -right-3 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FEF08A] to-[#F59E0B] flex items-center justify-center text-white shadow-[0_8px_16px_rgba(245,158,11,0.35),inset_0_2px_4px_rgba(255,255,255,0.8)] border border-amber-200"
            >
              <span className="text-xl">🔔</span>
            </motion.div>

            {/* Orbiting Clay Pill with Heart */}
            <motion.div
              animate={{ y: [4, -4, 4] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="absolute -bottom-2 -left-2 w-11 h-11 rounded-2xl bg-gradient-to-br from-[#A7F3D0] to-[#10B981] flex items-center justify-center text-white shadow-[0_8px_16px_rgba(16,185,129,0.3),inset_0_2px_4px_rgba(255,255,255,0.8)] border border-emerald-200"
            >
              <span className="text-lg">💚</span>
            </motion.div>
          </div>
        </motion.div>

        {/* Title & Slogan */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight"
        >
          {appName}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-violet-700/80 font-medium mt-1 max-w-xs"
        >
          Gereja yang Hidup, Melayani & Bertumbuh Bersama dalam Kasih Kristus
        </motion.p>
      </div>

      {/* Bottom Progress Indicator */}
      <div className="w-full max-w-xs flex flex-col items-center gap-2.5 pb-4">
        <div className="w-full h-3 rounded-full bg-violet-200/60 p-0.5 shadow-inner">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-500 shadow-[0_0_12px_rgba(124,58,237,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs font-semibold text-violet-700">
          {progress < 100 ? `Menyiapkan ruang ibadah... ${progress}%` : 'Selamat Datang!'}
        </p>
      </div>
    </div>
  );
}
