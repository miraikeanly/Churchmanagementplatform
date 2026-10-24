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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <Heart size={13} className="text-rose-400 fill-rose-400/30" />
            <span>Persembahan Jemaat &bull; Online Giving</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight sm:leading-tight">
            Memberi dengan <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-300">Sukacita & Kerelaan Hati</span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-300 font-light leading-relaxed">
            &ldquo;Hendaklah masing-masing memberikan menurut kerelaan hatinya, jangan dengan sedih hati atau karena paksaan, sebab Allah mengasihi orang yang memberi dengan sukacita.&rdquo;
            <span className="block mt-1 font-semibold text-blue-400 text-sm">— 2 Korintus 9:7</span>
          </p>
        </div>

        {/* Main Card: Rekening BCA Transfer */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-blue-950/60 backdrop-blur-xl border border-blue-500/20 rounded-3xl p-6 sm:p-9 shadow-2xl relative overflow-hidden space-y-6"
        >
          <div className="absolute -right-16 -top-16 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header BCA */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-800/80">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-xl tracking-tight">
                BCA
              </div>
              <div>
                <h2 className="font-bold text-white text-lg sm:text-xl">Bank Central Asia (BCA)</h2>
                <p className="text-xs sm:text-sm text-slate-400">Rekening Resmi Persembahan & Persepuluhan</p>
              </div>
            </div>
            <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5 shrink-0">
              <ShieldCheck size={14} />
              Resmi Terverifikasi
            </span>
          </div>

          {/* Account Details Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950/70 rounded-2xl p-5 border border-slate-800/80 flex flex-col justify-between">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Nomor Rekening BCA</p>
              <div className="flex items-center justify-between mt-2.5 gap-2">
                <span className="text-2xl sm:text-3xl font-mono font-black text-white tracking-wider">
                  7020 908 500
                </span>
                <button
                  type="button"
                  onClick={handleCopyBca}
                  className={`px-4 py-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold active:scale-95 cursor-pointer shrink-0 ${
                    copiedBca
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600 hover:text-white'
                  }`}
                  title="Salin Nomor Rekening"
                >
                  {copiedBca ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedBca ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-950/70 rounded-2xl p-5 border border-slate-800/80 flex flex-col justify-between">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Atas Nama Rekening</p>
              <p className="text-lg sm:text-xl font-bold text-slate-100 tracking-wide mt-2.5">
                GEREJA BETHEL INDONESIA
              </p>
            </div>
          </div>

          {/* Petunjuk Transfer & Format Berita */}
          <div className="p-5 sm:p-6 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-3">
            <div className="flex items-center gap-2 text-blue-300 font-bold text-sm">
              <Info size={18} className="text-blue-400 shrink-0" />
              <span>Petunjuk Transfer & Pengisian Kolom Berita:</span>
            </div>
            
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Mohon pastikan nama penerima yang muncul pada layar ATM atau Mobile Banking Anda adalah <strong>GEREJA BETHEL INDONESIA</strong>.
            </p>

            <div className="pt-2 border-t border-blue-500/15">
              <p className="text-xs text-slate-400 mb-2.5">
                Untuk ketertiban administrasi dan pembukuan keuangan gereja, mohon cantumkan peruntukan persembahan pada kolom <em>Berita / Keterangan Transfer</em>:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="font-semibold text-white">&bull; Persepuluhan</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Tulis: <span className="text-blue-300 font-medium">Persepuluhan - [Nama Jemaat]</span></p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="font-semibold text-white">&bull; Persembahan Umum</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Tulis: <span className="text-blue-300 font-medium">Persembahan Umum</span></p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="font-semibold text-white">&bull; Persembahan Syukur</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Tulis: <span className="text-blue-300 font-medium">Syukur - [Nama/Keperluan]</span></p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <p className="font-semibold text-white">&bull; Misi & Pelayanan Kasih</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Tulis: <span className="text-blue-300 font-medium">Misi / Diakonia</span></p>
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
          className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 text-xs sm:text-sm text-slate-400 space-y-2 text-center max-w-3xl mx-auto"
        >
          <p className="font-semibold text-slate-200 text-sm sm:text-base flex items-center justify-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            Doa Berkat atas Persembahan
          </p>
          <p className="leading-relaxed font-light text-slate-300">
            Tuhan memberkati setiap tangan yang memberi dan setiap hati yang rindu melayani pekerjaan Kerajaan Allah. Diberkatilah keluar masukmu, keluarga, dan pekerjaanmu senantiasa melimpah dengan damai sejahtera.
          </p>
        </motion.div>

      </main>

      <PublicFooter />
    </div>
  );
}
