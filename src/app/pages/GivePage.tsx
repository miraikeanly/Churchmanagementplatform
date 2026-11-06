import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  Copy,
  Check,
  ShieldCheck,
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
    <div className="min-h-screen bg-white text-slate-900">
      <PublicNavbar />

      {/* Hero Section — dark top strip */}
      <section className="bg-slate-950 pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <p
            className="font-cursive text-3xl sm:text-4xl text-blue-400 font-normal mb-1 drop-shadow-sm px-2 inline-block"
            style={{ fontFamily: 'Caveat, cursive' }}
          >
            Persembahan Jemaat · Online Giving
          </p>

          <h1 className="text-3xl sm:text-5xl font-display font-bold text-white tracking-tight leading-tight sm:leading-tight mt-2">
            Memberi dengan Sukacita &amp; Kerelaan Hati
          </h1>

          <blockquote className="mt-6 border-l-2 border-blue-500 pl-4 text-left max-w-lg mx-auto">
            <p className="text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
              &ldquo;Hendaklah masing-masing memberikan menurut kerelaan hatinya, jangan dengan sedih hati atau karena paksaan, sebab Allah mengasihi orang yang memberi dengan sukacita.&rdquo;
            </p>
            <footer className="mt-2 text-xs font-semibold text-blue-400">— 2 Korintus 9:7</footer>
          </blockquote>
        </div>
      </section>

      {/* Content — white background */}
      <main className="pt-12 pb-24 px-4 sm:px-6 max-w-4xl mx-auto space-y-6">

        {/* Main Card: Rekening BCA Transfer */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-9 shadow-sm space-y-6"
        >
          {/* Header BCA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
            <div className="flex items-center gap-4">
              <div className="h-12 w-auto max-w-[130px] rounded-xl bg-white border border-slate-200 p-2 flex items-center justify-center shrink-0 shadow-sm">
                <img
                  src="/bca-logo.png"
                  alt="Bank Central Asia (BCA)"
                  className="h-full w-auto object-contain"
                />
              </div>
              <div>
                <h2 className="font-display font-bold text-slate-900 text-lg sm:text-xl tracking-tight">Bank Central Asia (BCA)</h2>
                <p className="text-xs sm:text-sm text-slate-500">Rekening Resmi Persembahan &amp; Persepuluhan</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
              <ShieldCheck size={16} className="shrink-0" />
              <span>Resmi Terverifikasi Gereja</span>
            </div>
          </div>

          {/* Account Details Box */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-7 bg-slate-50 rounded-2xl p-5 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Nomor Rekening BCA</span>
              <div className="flex items-center justify-between mt-3 gap-3 flex-nowrap">
                <span className="text-2xl sm:text-3xl font-mono font-black text-slate-900 tracking-wider whitespace-nowrap">
                  7020 908 500
                </span>
                <button
                  type="button"
                  onClick={handleCopyBca}
                  className={`px-4 py-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold active:scale-95 cursor-pointer shrink-0 ${
                    copiedBca
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-900 text-white'
                  }`}
                  title="Salin Nomor Rekening"
                >
                  {copiedBca ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedBca ? 'Tersalin!' : 'Salin Rekening'}</span>
                </button>
              </div>
            </div>

            <div className="md:col-span-5 bg-slate-50 rounded-2xl p-5 border border-slate-200/80 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Atas Nama Rekening</span>
              <div className="flex items-center mt-3 min-h-[38px]">
                <p className="text-base sm:text-lg font-bold text-slate-900 tracking-wide break-words">
                  GEREJA BETHEL INDONESIA
                </p>
              </div>
            </div>
          </div>

          {/* Petunjuk Transfer & Format Berita */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Info size={17} className="text-blue-600 shrink-0" />
              <span>Petunjuk Transfer &amp; Pengisian Kolom Berita</span>
            </div>

            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Mohon pastikan nama penerima yang muncul pada layar ATM atau Mobile Banking Anda adalah <strong className="text-slate-900">GEREJA BETHEL INDONESIA</strong>.
            </p>

            <div className="pt-3 border-t border-slate-200/80">
              <p className="text-xs text-slate-500 mb-3">
                Untuk ketertiban administrasi dan pembukuan keuangan gereja, mohon cantumkan peruntukan persembahan pada kolom <em>Berita / Keterangan Transfer</em>:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
                  <p className="font-bold text-slate-900 text-xs">&bull; Persepuluhan</p>
                  <p className="text-slate-400 text-[11px] mt-1">Tulis: <span className="text-blue-600 font-medium">Persepuluhan - [Nama Jemaat]</span></p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
                  <p className="font-bold text-slate-900 text-xs">&bull; Persembahan Umum</p>
                  <p className="text-slate-400 text-[11px] mt-1">Tulis: <span className="text-blue-600 font-medium">Persembahan Umum</span></p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
                  <p className="font-bold text-slate-900 text-xs">&bull; Persembahan Syukur</p>
                  <p className="text-slate-400 text-[11px] mt-1">Tulis: <span className="text-blue-600 font-medium">Syukur - [Nama/Keperluan]</span></p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
                  <p className="font-bold text-slate-900 text-xs">&bull; Misi &amp; Pelayanan Kasih</p>
                  <p className="text-slate-400 text-[11px] mt-1">Tulis: <span className="text-blue-600 font-medium">Misi / Diakonia</span></p>
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
          className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2 text-center max-w-3xl mx-auto"
        >
          <p className="font-bold text-slate-900 text-sm sm:text-base flex items-center justify-center gap-2">
            <Heart size={16} className="text-blue-600" />
            <span>Doa Berkat atas Persembahan</span>
          </p>
          <p className="leading-relaxed font-normal text-slate-500 max-w-2xl mx-auto text-sm sm:text-base">
            Tuhan memberkati setiap tangan yang memberi dan setiap hati yang rindu melayani pekerjaan Kerajaan Allah. Diberkatilah keluar masukmu, keluarga, dan pekerjaanmu senantiasa melimpah dengan damai sejahtera.
          </p>
        </motion.div>

      </main>

      <PublicFooter />
    </div>
  );
}
