import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  Sparkles,
  Info
} from 'lucide-react';
import PublicNavbar from '../components/public/PublicNavbar';
import PublicFooter from '../components/public/PublicFooter';

export default function GivePage() {
  const [copiedBca, setCopiedBca] = useState(false);
  const [showQrisModal, setShowQrisModal] = useState(false);

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

      <main className="relative z-10 pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-14">
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

        {/* Flyer Persembahan Card with Integrated Web Theme */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-slate-900/90 shadow-2xl backdrop-blur-xl group"
        >
          <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full max-h-[380px] overflow-hidden">
            <img
              src="/flyer-persembahan.jpg"
              alt="Persembahan dan Persepuluhan BCA GBI Jelambar Timur"
              className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
            />
            {/* Dark glass gradient overlay at bottom for smooth modern transition */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none" />

            {/* Quick action button over image */}
            <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowQrisModal(true)}
                className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl bg-white/95 hover:bg-white text-slate-900 font-bold text-xs sm:text-sm backdrop-blur-md shadow-lg flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <QrCode size={16} className="text-blue-700" />
                <span>Lihat QRIS</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Transfer BCA & QRIS Details Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Main Card: Rekening BCA Transfer (7 Cols) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-7 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-blue-950/50 backdrop-blur-xl border border-blue-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-lg">
                    BCA
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base sm:text-lg">Bank Central Asia (BCA)</h3>
                    <p className="text-xs text-slate-400">Rekening Resmi Persembahan & Persepuluhan</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1 shrink-0">
                  <ShieldCheck size={13} />
                  Resmi Terverifikasi
                </span>
              </div>

              {/* Account Details Box */}
              <div className="mt-6 space-y-4">
                <div className="bg-slate-950/70 rounded-2xl p-4 sm:p-5 border border-slate-800/80">
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Nomor Rekening</p>
                  <div className="flex items-center justify-between mt-2 gap-3">
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

                <div className="bg-slate-950/70 rounded-2xl p-4 sm:p-5 border border-slate-800/80">
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Atas Nama Rekening</p>
                  <p className="text-base sm:text-lg font-bold text-slate-100 tracking-wide mt-1">
                    GEREJA BETHEL INDONESIA
                  </p>
                </div>
              </div>
            </div>

            {/* Panduan Pengisian Berita / Keterangan Transfer */}
            <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-2.5">
              <div className="flex items-center gap-2 text-blue-300 font-semibold text-xs sm:text-sm">
                <Info size={16} className="text-blue-400 shrink-0" />
                <span>Petunjuk Transfer & Pengisian Berita:</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed pl-6">
                Pastikan nama penerima transfer yang muncul pada layar ATM atau Mobile Banking Anda adalah <strong>GEREJA BETHEL INDONESIA</strong>.
              </p>
              <div className="pl-6 pt-1">
                <p className="text-xs text-slate-400 mb-2">
                  Untuk memudahkan pembukuan dan ketertiban administrasi, mohon cantumkan peruntukan persembahan pada kolom <em>Berita / Keterangan</em> transfer:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <p className="font-semibold text-white">&bull; Persepuluhan</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">Tulis: <em>Persepuluhan - [Nama]</em></p>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <p className="font-semibold text-white">&bull; Persembahan Umum</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">Tulis: <em>Persembahan Umum</em></p>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <p className="font-semibold text-white">&bull; Persembahan Syukur</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">Tulis: <em>Syukur - [Nama/Keperluan]</em></p>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <p className="font-semibold text-white">&bull; Misi & Pelayanan Kasih</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">Tulis: <em>Misi / Diakonia</em></p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Side Card: QRIS Scan & Doa Berkat (5 Cols) */}
          <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
            {/* QRIS Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl text-center relative flex flex-col items-center justify-between"
            >
              <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 text-left">
                <div>
                  <h4 className="font-bold text-white text-sm sm:text-base">Scan QRIS Nasional</h4>
                  <p className="text-xs text-slate-400">m-BCA, Livin, BRImo, GoPay, OVO, ShopeePay</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  NMID Valid
                </span>
              </div>

              {/* QR Image with click to zoom */}
              <div
                onClick={() => setShowQrisModal(true)}
                className="mt-4 p-3 bg-white rounded-2xl shadow-xl relative group cursor-pointer"
                title="Klik untuk memperbesar QRIS"
              >
                <img
                  src="/qris-gbi.png"
                  alt="QRIS GBI Jelambar Timur"
                  className="w-44 h-auto sm:w-48 max-w-full rounded-lg object-contain transition-transform group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-slate-950/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                  Klik untuk perbesar
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                A.N. <strong className="text-white">GEREJA BETHEL INDONESIA</strong>
              </p>

              <div className="mt-4 flex gap-2 w-full">
                <a
                  href="/qris-gbi.png"
                  download="QRIS-GBI-Jelambar-Timur.png"
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all text-center"
                >
                  Unduh QRIS
                </a>
                <button
                  type="button"
                  onClick={() => setShowQrisModal(true)}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-xs font-semibold text-blue-300 border border-blue-500/30 transition-all cursor-pointer"
                >
                  Perbesar
                </button>
              </div>
            </motion.div>

            {/* Prayer Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 space-y-2"
            >
              <p className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                <Sparkles size={15} className="text-amber-400" />
                Doa Berkat atas Persembahan
              </p>
              <p className="leading-relaxed">
                Tuhan memberkati setiap tangan yang memberi dan setiap hati yang rindu melayani pekerjaan Kerajaan Allah. Diberkatilah keluar masukmu, keluarga, dan pekerjaanmu senantiasa melimpah dengan damai sejahtera.
              </p>
            </motion.div>
          </div>

        </div>
      </main>

      {/* Modal QRIS Full Size */}
      <AnimatePresence>
        {showQrisModal && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowQrisModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-sm sm:max-w-md w-full shadow-2xl text-center relative"
            >
              <h3 className="text-gray-900 font-bold text-lg mb-2">QRIS GBI Jelambar Timur</h3>
              <p className="text-gray-500 text-xs mb-4">GEREJA BETHEL INDONESIA</p>
              
              <img
                src="/qris-gbi.png"
                alt="QRIS Full"
                className="w-full h-auto rounded-xl object-contain mx-auto"
              />

              <div className="mt-5 flex gap-2 justify-center">
                <a
                  href="/qris-gbi.png"
                  download="QRIS-GBI-Jelambar-Timur.png"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md"
                >
                  Unduh Gambar
                </a>
                <button
                  type="button"
                  onClick={() => setShowQrisModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold text-xs"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PublicFooter />
    </div>
  );
}
