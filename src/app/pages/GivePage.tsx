import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  Copy,
  Check,
  QrCode,
  CreditCard,
  Wallet,
  ShieldCheck,
  Send,
  Sparkles,
  ArrowRight,
  Info,
  UserCheck,
  LogIn,
  CheckCircle2,
  DollarSign,
  ChevronDown
} from 'lucide-react';
import PublicNavbar from '../components/public/PublicNavbar';
import PublicFooter from '../components/public/PublicFooter';
import { useAuth } from '../contexts/AuthContext';
import { apiBase } from '../../lib/api';

interface GivingCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
}

const DEFAULT_CATEGORIES: GivingCategory[] = [
  {
    id: 'tithes',
    code: 'TITHES',
    name: 'Persembahan Persepuluhan',
    description: 'Bawalah seluruh persembahan persepuluhan ke dalam rumah perbendaharaan... (Maleakhi 3:10)'
  },
  {
    id: 'offering',
    code: 'OFFERING',
    name: 'Persembahan Umum',
    description: 'Persembahan ibadah mingguan untuk mendukung pekerjaan dan operasional pelayanan Tuhan.'
  },
  {
    id: 'thanksgiving',
    code: 'THANKSGIVING OFFERING',
    name: 'Persembahan Syukur',
    description: 'Ungkapan syukur atas berkat, kesehatan, pemulihan, dan kebaikan Tuhan dalam hidup.'
  },
  {
    id: 'christmas',
    code: 'CHRISTMAS OFFERING',
    name: 'Persembahan Natal',
    description: 'Persembahan khusus sukacita Natal untuk pelayanan kasih, misi, dan perayaan kelahiran Kristus.'
  }
];

const PRESET_AMOUNTS = [50000, 100000, 250000, 500000, 1000000, 2500000];

export default function GivePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<GivingCategory[]>(DEFAULT_CATEGORIES);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<string>('TITHES');
  const [amount, setAmount] = useState<number | ''>(100000);
  const [customAmountStr, setCustomAmountStr] = useState<string>('100.000');
  const [memo, setMemo] = useState<string>('');

  // Sender details
  const [senderName, setSenderName] = useState<string>(user?.name || '');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [senderEmail, setSenderEmail] = useState<string>(user?.email || '');

  // UI state
  const [copiedBca, setCopiedBca] = useState(false);
  const [activeTab, setActiveTab] = useState<'bca' | 'qris' | 'emoney'>('bca');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showQrisModal, setShowQrisModal] = useState(false);

  // Sync user data when user changes
  useEffect(() => {
    if (user) {
      if (!senderName) setSenderName(user.name || '');
      if (!senderEmail) setSenderEmail(user.email || '');
    }
  }, [user]);

  // Fetch categories from API
  useEffect(() => {
    fetch(`${apiBase()}/api/content/giving/categories`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
          if (!data.categories.some((c: GivingCategory) => c.code === selectedCategoryCode)) {
            setSelectedCategoryCode(data.categories[0].code);
          }
        }
      })
      .catch((err) => console.warn('Could not load categories:', err));
  }, []);

  const handleCopyBca = () => {
    navigator.clipboard.writeText('7020908500');
    setCopiedBca(true);
    setTimeout(() => setCopiedBca(false), 2500);
  };

  const handleSelectPreset = (val: number) => {
    setAmount(val);
    setCustomAmountStr(new Intl.NumberFormat('id-ID').format(val));
  };

  const handleAmountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setAmount('');
      setCustomAmountStr('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setAmount(num);
    setCustomAmountStr(new Intl.NumberFormat('id-ID').format(num));
  };

  const currentCategory = categories.find((c) => c.code === selectedCategoryCode) || categories[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!user) {
      setErrorMessage('Anda wajib mendaftar atau masuk ke akun jemaat terlebih dahulu sebelum mengonfirmasi persembahan.');
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setErrorMessage('Silakan tentukan nominal persembahan Anda.');
      return;
    }

    if (!senderName.trim()) {
      setErrorMessage('Silakan isi nama pengirim.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiBase()}/api/content/giving/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryCode: currentCategory.code,
          categoryName: currentCategory.name,
          amount: Number(amount),
          senderName: senderName.trim(),
          senderPhone: senderPhone.trim(),
          senderEmail: senderEmail.trim() || user.email,
          memo: memo.trim(),
          paymentMethod: activeTab === 'bca' ? 'BCA Transfer' : 'QRIS',
          userId: user.id
        })
      });

      const resData = await response.json();
      if (resData.success) {
        setIsSuccess(true);
        window.scrollTo({ top: 300, behavior: 'smooth' });
      } else {
        setErrorMessage(resData.error || 'Terjadi kesalahan saat mengirim konfirmasi.');
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      setErrorMessage('Gagal mengirim konfirmasi persembahan. Silakan periksa koneksi internet Anda.');
    } finally {
      setIsSubmitting(false);
    }
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

        {/* Auth Check Warning / Encouragement Card */}
        {!user && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-md shadow-xl"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 flex-shrink-0 mt-0.5 sm:mt-0">
                <LogIn size={20} />
              </div>
              <div>
                <p className="font-semibold text-white text-sm sm:text-base">Daftar / Masuk Akun Jemaat Terlebih Dahulu</p>
                <p className="text-xs sm:text-sm text-amber-200/80 mt-0.5">
                  Untuk kerapian pencatatan persembahan dan agar terdata resmi di sistem gereja, Anda diwajibkan memiliki akun jemaat.
                </p>
              </div>
            </div>
            <Link
              to="/akun"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 whitespace-nowrap self-stretch sm:self-auto justify-center"
            >
              <span>Masuk / Daftar Akun</span>
              <ArrowRight size={15} />
            </Link>
          </motion.div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Rekening BCA & QRIS Payment Info (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Payment Method Switcher Tabs */}
            <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-1.5 border border-slate-800 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('bca')}
                className={`flex-1 py-3 px-2 sm:px-3 min-h-[46px] rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-[0.98] ${
                  activeTab === 'bca'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <CreditCard size={16} className="shrink-0" />
                <span className="truncate">BCA Transfer</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('qris')}
                className={`flex-1 py-3 px-2 sm:px-3 min-h-[46px] rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-[0.98] ${
                  activeTab === 'qris'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <QrCode size={16} className="shrink-0" />
                <span className="truncate">QRIS</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('emoney')}
                className={`flex-1 py-3 px-2 sm:px-3 min-h-[46px] rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-[0.98] ${
                  activeTab === 'emoney'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Wallet size={16} className="shrink-0" />
                <span className="truncate">E-Money</span>
              </button>
            </div>

            {/* TAB 1: BCA TRANSFER */}
            {activeTab === 'bca' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-br from-slate-900/90 via-slate-900/90 to-blue-950/60 backdrop-blur-xl border border-blue-500/20 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden group"
              >
                {/* Visual card header styling */}
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all pointer-events-none" />

                <div className="flex items-center justify-between pb-6 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-lg">
                      BCA
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">Bank Central Asia (BCA)</h3>
                      <p className="text-xs text-slate-400">Rekening Resmi Gereja</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                    <ShieldCheck size={12} />
                    Terverifikasi
                  </span>
                </div>

                {/* Account Details Box */}
                <div className="mt-6 space-y-4">
                  <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80">
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Nomor Rekening</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-wider">
                        7020 908 500
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyBca}
                        className={`p-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
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

                  <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80">
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Atas Nama Rekening</p>
                    <p className="text-base sm:text-lg font-bold text-slate-100 tracking-wide mt-1">
                      GEREJA BETHEL INDONESIA
                    </p>
                  </div>
                </div>

                {/* Info Note */}
                <div className="mt-6 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/15 text-xs text-slate-400 flex items-start gap-2.5 leading-relaxed">
                  <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Pastikan nama penerima transfer yang muncul pada mobile banking/ATM adalah <strong>GEREJA BETHEL INDONESIA</strong>. Cantumkan kode persembahan pada berita transfer jika memungkinkan.
                  </span>
                </div>
              </motion.div>
            )}

            {/* TAB 2: QRIS */}
            {activeTab === 'qris' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-br from-slate-900/90 to-slate-950/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl text-center relative"
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="text-left">
                    <h3 className="font-bold text-white text-base">QRIS GBI Jelambar Timur</h3>
                    <p className="text-xs text-slate-400">Scan via m-BCA, Livin, BRImo, Gopay, OVO, ShopeePay</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    NMID Valid
                  </span>
                </div>

                {/* QR Display */}
                <div className="mt-6 p-4 bg-white rounded-2xl inline-block shadow-xl relative group">
                  <img
                    src="/qris-gbi.png"
                    alt="QRIS GBI Jelambar Timur"
                    className="w-56 h-auto sm:w-64 max-w-full rounded-lg object-contain cursor-pointer transition-transform group-hover:scale-[1.02]"
                    onClick={() => setShowQrisModal(true)}
                  />
                  <div
                    onClick={() => setShowQrisModal(true)}
                    className="absolute inset-0 bg-slate-950/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white text-xs font-semibold"
                  >
                    Klik untuk memperbesar
                  </div>
                </div>

                <p className="mt-4 text-xs text-slate-400">
                  A.N. <strong className="text-white">GEREJA BETHEL INDONESIA</strong>
                </p>

                <div className="mt-5 flex gap-2 justify-center">
                  <a
                    href="/qris-gbi.png"
                    download="QRIS-GBI-Jelambar-Timur.png"
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all inline-flex items-center gap-1.5"
                  >
                    <span>Unduh Gambar QRIS</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowQrisModal(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-xs font-semibold text-blue-300 border border-blue-500/30 transition-all"
                  >
                    Perbesar
                  </button>
                </div>
              </motion.div>
            )}

            {/* TAB 3: E-MONEY (COMING SOON) */}
            {activeTab === 'emoney' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 text-center shadow-2xl"
              >
                <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4">
                  <Wallet size={28} />
                </div>
                <h3 className="text-lg font-bold text-white">E-Wallet Direct Payment</h3>
                <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                  Integrasi instan OVO, DANA, dan GoPay sedang dalam proses pengesahan merchant resmi.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                  <Sparkles size={13} />
                  <span>Segera Hadir / Coming Soon</span>
                </div>
                <p className="text-xs text-slate-500 mt-4">
                  Untuk saat ini, Anda dapat melakukan pembayaran via OVO / GoPay / DANA melalui scan menu <strong>QRIS</strong> di atas.
                </p>
              </motion.div>
            )}

            {/* Prayer & Scripture Affirmation */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 space-y-2">
              <p className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                <Sparkles size={15} className="text-amber-400" />
                Doa Berkat atas Persembahan
              </p>
              <p className="leading-relaxed">
                Tuhan memberkati setiap tangan yang memberi dan setiap hati yang rindu melayani pekerjaan Kerajaan Allah. Diberkatilah keluar masukmu, keluarga, dan pekerjaanmu melimpah dengan damai sejahtera.
              </p>
            </div>
          </div>

          {/* Right Column: Giving Form & Confirmation (7 Cols) */}
          <div className="lg:col-span-7">
            <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
              
              {isSuccess ? (
                /* Success Screen */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-8 text-center space-y-5"
                >
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={44} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Konfirmasi Persembahan Diterima!</h2>
                    <p className="text-slate-300 text-sm mt-2 max-w-md mx-auto">
                      Terima kasih atas persembahan Anda, Saudara/i <strong>{senderName}</strong>. Data telah tercatat pada pembukuan Keuangan GBI Jelambar Timur.
                    </p>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 max-w-md mx-auto text-left space-y-2.5 text-xs">
                    <div className="flex justify-between pb-2 border-b border-slate-800">
                      <span className="text-slate-400">Jenis Persembahan</span>
                      <span className="font-semibold text-white">{currentCategory.name}</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-slate-800">
                      <span className="text-slate-400">Nominal</span>
                      <span className="font-bold text-emerald-400 text-sm">
                        Rp {new Intl.NumberFormat('id-ID').format(Number(amount))}
                      </span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-slate-800">
                      <span className="text-slate-400">Metode</span>
                      <span className="text-slate-200">{activeTab === 'bca' ? 'BCA Transfer' : 'QRIS'}</span>
                    </div>
                    {memo && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Memo / Doa</span>
                        <span className="text-slate-200 italic max-w-[200px] text-right truncate">{memo}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSuccess(false);
                        setMemo('');
                      }}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg transition-all"
                    >
                      Beri Persembahan Lain
                    </button>
                    <Link
                      to="/jemaat"
                      className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
                    >
                      Kembali ke Beranda
                    </Link>
                  </div>
                </motion.div>
              ) : (
                /* Main Giving Form */
                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  {/* Category Selection Header */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-bold text-slate-300 mb-2.5">
                      1. Pilih Jenis Persembahan <span className="text-rose-400">*</span>
                    </label>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {categories.map((cat) => {
                        const isSelected = cat.code === selectedCategoryCode;
                        return (
                          <div
                            key={cat.id || cat.code}
                            onClick={() => setSelectedCategoryCode(cat.code)}
                            className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-600/10'
                                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold tracking-wider text-blue-400 uppercase">
                                {cat.code}
                              </span>
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected ? 'border-blue-400 bg-blue-500' : 'border-slate-600'
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </div>
                            </div>
                            <p className="font-semibold text-sm text-slate-100 mt-1">{cat.name}</p>
                          </div>
                        );
                      })}
                    </div>

                    {currentCategory.description && (
                      <p className="text-[11px] text-slate-400 italic mt-2.5 pl-1 border-l-2 border-blue-500/40">
                        {currentCategory.description}
                      </p>
                    )}
                  </div>

                  {/* Nominal Selection */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-bold text-slate-300 mb-2.5">
                      2. Tentukan Jumlah Nominal <span className="text-rose-400">*</span>
                    </label>

                    {/* Quick chips */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-2.5 mb-3">
                      {PRESET_AMOUNTS.map((val) => {
                        const isSelected = amount === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleSelectPreset(val)}
                            className={`py-3 px-2 min-h-[44px] flex items-center justify-center text-center rounded-xl text-xs sm:text-sm font-semibold border transition-all active:scale-95 cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300 active:bg-slate-800'
                            }`}
                          >
                            {val >= 1000000 ? `${val / 1000000} Jt` : `${val / 1000} Rb`}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom input */}
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                        Rp
                      </div>
                      <input
                        type="text"
                        value={customAmountStr}
                        onChange={handleAmountInputChange}
                        placeholder="0"
                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-950/90 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white font-mono text-xl font-bold placeholder-slate-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Memo / Pokok Doa (Optional) */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-bold text-slate-300 mb-2">
                      3. Note / Memo / Pokok Doa <span className="text-slate-500 font-normal lowercase">(opsional)</span>
                    </label>
                    <textarea
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      rows={2}
                      placeholder="Contoh: Persepuluhan bulan Oktober / Syukur kelulusan anak / Pokok doa pemulihan..."
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-950/90 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white text-xs sm:text-sm placeholder-slate-600 outline-none transition-all resize-none"
                    />
                  </div>

                  {/* Sender Details (Nama, No HP, Email) */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <span className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5">
                        <UserCheck size={14} className="text-emerald-400" />
                        4. Data Diri Jemaat
                      </span>
                      {user ? (
                        <span className="text-[11px] text-emerald-400 font-medium">
                          Terhubung Akun: {user.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-400 font-medium">
                          Belum Masuk Akun
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Nama Pengirim <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          placeholder="Nama lengkap Anda"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-600 focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          No. Handphone / WhatsApp
                        </label>
                        <input
                          type="tel"
                          value={senderPhone}
                          onChange={(e) => setSenderPhone(e.target.value)}
                          placeholder="0812xxxxxxx"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-600 focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Email Jemaat
                        </label>
                        <input
                          type="email"
                          value={senderEmail}
                          onChange={(e) => setSenderEmail(e.target.value)}
                          placeholder="email@example.com"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-600 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Error Notification */}
                  {errorMessage && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                      <Info size={15} className="mt-0.5 flex-shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  {user ? (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 min-h-[52px] rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm sm:text-base shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 disabled:opacity-50 transition-all active:scale-[0.985] flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      {isSubmitting ? (
                        <span>Mengirim Konfirmasi...</span>
                      ) : (
                        <>
                          <Send size={18} className="group-hover:translate-x-1 transition-transform shrink-0" />
                          <span className="sm:hidden">Konfirmasi Transfer</span>
                          <span className="hidden sm:inline">Konfirmasi Telah Ditransfer</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <Link
                      to="/akun"
                      className="w-full py-4 min-h-[52px] rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm sm:text-base shadow-xl shadow-amber-500/20 transition-all active:scale-[0.985] flex items-center justify-center gap-2 text-center"
                    >
                      <LogIn size={18} className="shrink-0" />
                      <span className="sm:hidden">Masuk Akun Jemaat</span>
                      <span className="hidden sm:inline">Daftar / Masuk Akun Jemaat untuk Mengonfirmasi</span>
                    </Link>
                  )}

                  <p className="text-[11px] text-slate-400 text-center leading-normal">
                    Setelah Anda melakukan transfer ke BCA atau Scan QRIS di samping, tekan tombol konfirmasi di atas agar persembahan Anda langsung tervalidasi oleh tim Keuangan gereja.
                  </p>
                </form>
              )}
            </div>
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
