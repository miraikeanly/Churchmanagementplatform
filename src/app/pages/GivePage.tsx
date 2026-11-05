import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Info
} from 'lucide-react';
import PublicNavbar from '../components/public/PublicNavbar';
import PublicFooter from '../components/public/PublicFooter';

export default function GivePage() {
  const [copiedBca, setCopiedBca] = useState(false);

  const handleCopyBca = () => {
    navigator.clipboard.writeText('7020908500');
    setCopiedBca(true);
    setTimeout(() => setCopiedBca(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-x-hidden">
      <PublicNavbar />

      {/* Background Glows & Accent Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[130px]" />
        <div className="absolute top-20 right-1/4 w-[450px] h-[450px] bg-indigo-600/15 rounded-full blur-[130px]" />
        <div className="absolute top-96 left-1/3 w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8">
        
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto">
          <p
            className="font-cursive text-3xl sm:text-4xl text-blue-300 font-normal mb-1 drop-shadow-sm px-2 inline-block"
            style={{ fontFamily: 'Caveat, cursive' }}
          >
            Persembahan Jemaat &bull; Online Giving
          </p>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight sm:leading-tight">
            Memberi dengan <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-200 to-sky-300">Sukacita & Kerelaan Hati</span>
          </h1>

          <p className="mt-4 text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
            &ldquo;Hendaklah masing-masing memberikan menurut kerelaan hatinya, jangan dengan sedih hati atau karena paksaan, sebab Allah mengasihi orang yang memberi dengan sukacita.&rdquo;
            <span className="block mt-1 font-semibold text-blue-400 text-xs sm:text-sm">— 2 Korintus 9:7</span>
          </p>
        </div>

        {/* Main Card: Rekening BCA Transfer */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-9 shadow-2xl relative overflow-hidden space-y-6"
        >
          {/* Subtle Ambient Light */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header BCA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-center gap-4">
              <div className="h-12 w-auto max-w-[130px] rounded-xl bg-white p-2 flex items-center justify-center shrink-0 shadow-sm">
                <img
                  src="/bca-logo.png"
                  alt="Bank Central Asia (BCA)"
                  className="h-full w-auto object-contain"
                />
              </div>
              <div>
                <h2 className="font-extrabold text-white text-lg sm:text-xl tracking-tight">Bank Central Asia (BCA)</h2>
                <p className="text-xs sm:text-sm text-slate-400">Rekening Resmi Persembahan & Persepuluhan</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
              <span>Resmi Terverifikasi Gereja</span>
            </div>
          </div>

          {/* Account Details Box */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-7 bg-slate-950/80 rounded-2xl p-5 border border-white/10 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Nomor Rekening BCA</span>
              <div className="flex items-center justify-between mt-3 gap-3 flex-nowrap">
                <span className="text-2xl sm:text-3xl font-mono font-black text-white tracking-wider whitespace-nowrap">
                  7020 908 500
                </span>
                <button
                  type="button"
                  onClick={handleCopyBca}
                  className={`px-4 py-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold active:scale-95 cursor-pointer shrink-0 shadow-xs ${
                    copiedBca
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 border-blue-500 text-white'
                  }`}
                  title="Salin Nomor Rekening"
                >
                  {copiedBca ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedBca ? 'Tersalin!' : 'Salin Rekening'}</span>
                </button>
              </div>
            </div>

            <div className="md:col-span-5 bg-slate-950/80 rounded-2xl p-5 border border-white/10 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Atas Nama Rekening</span>
              <div className="flex items-center mt-3 min-h-[38px]">
                <p className="text-base sm:text-lg font-extrabold text-white tracking-wide break-words">
                  GEREJA BETHEL INDONESIA
                </p>
              </div>
            </div>
          </div>

          {/* Petunjuk Transfer & Format Berita */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Info size={17} className="text-blue-400 shrink-0" />
              <span>Petunjuk Transfer & Pengisian Kolom Berita</span>
            </div>
            
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Mohon pastikan nama penerima yang muncul pada layar ATM atau Mobile Banking Anda adalah <strong>GEREJA BETHEL INDONESIA</strong>.
            </p>

            <div className="pt-3 border-t border-white/10">
              <p className="text-xs text-slate-400 mb-3">
                Untuk ketertiban administrasi dan pembukuan keuangan gereja, mohon cantumkan peruntukan persembahan pada kolom <em>Berita / Keterangan Transfer</em>:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/90 p-3.5 rounded-xl border border-white/10">
                  <p className="font-bold text-white text-xs">&bull; Persepuluhan</p>
                  <p className="text-slate-400 text-[11px] mt-1">Tulis: <span className="text-sky-300 font-medium">Persepuluhan - [Nama Jemaat]</span></p>
                </div>
                <div className="bg-slate-950/90 p-3.5 rounded-xl border border-white/10">
                  <p className="font-bold text-white text-xs">&bull; Persembahan Umum</p>
                  <p className="text-slate-400 text-[11px] mt-1">Tulis: <span className="text-sky-300 font-medium">Persembahan Umum</span></p>
                </div>
                <div className="bg-slate-950/90 p-3.5 rounded-xl border border-white/10">
                  <p className="font-bold text-white text-xs">&bull; Persembahan Syukur</p>
                  <p className="text-slate-400 text-[11px] mt-1">Tulis: <span className="text-sky-300 font-medium">Syukur - [Nama/Keperluan]</span></p>
                </div>
                <div className="bg-slate-950/90 p-3.5 rounded-xl border border-white/10">
                  <p className="font-bold text-white text-xs">&bull; Misi & Pelayanan Kasih</p>
                  <p className="text-slate-400 text-[11px] mt-1">Tulis: <span className="text-sky-300 font-medium">Misi / Diakonia</span></p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Doa Berkat Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="p-6 sm:p-7 rounded-3xl bg-slate-900/60 border border-white/10 text-xs sm:text-sm text-slate-300 space-y-2 text-center max-w-3xl mx-auto shadow-xl"
        >
          <p className="font-bold text-white text-sm sm:text-base flex items-center justify-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <span>Doa Berkat atas Persembahan</span>
          </p>
          <p className="leading-relaxed font-normal text-slate-300 max-w-2xl mx-auto">
            Tuhan memberkati setiap tangan yang memberi dan setiap hati yang rindu melayani pekerjaan Kerajaan Allah. Diberkatilah keluar masukmu, keluarga, dan pekerjaanmu senantiasa melimpah dengan damai sejahtera.
          </p>
        </motion.div>

      </main>

      <PublicFooter />
    </div>
  );
}
