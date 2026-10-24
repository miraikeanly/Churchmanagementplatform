import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircle,
  X,
  Send,
  Calendar,
  MapPin,
  Heart,
  Flame,
  Rocket,
  HandHeart,
  Droplets,
  CreditCard,
  Phone,
  MessageSquare,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Copy,
  Check,
  QrCode,
  Crown,
} from 'lucide-react';
import { CHURCH } from '../../../lib/church';
import gbiLogo from '../../../imports/pngegg__1_-1.png';

interface ActionLink {
  label: string;
  to?: string;
  href?: string;
  isExternal?: boolean;
  icon?: any;
  variant?: 'primary' | 'secondary' | 'emerald';
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text?: string;
  cardType?: 'welcome' | 'schedule' | 'giving' | 'location' | 'prayer' | 'events' | 'baptism' | 'streaming' | 'default';
  time: string;
  actions?: ActionLink[];
}

const QUICK_PROMPTS = [
  { id: 'jadwal', label: 'Jadwal ibadah', icon: Calendar },
  { id: 'lokasi', label: 'Lokasi gereja', icon: MapPin },
  { id: 'persembahan', label: 'Nomor rekening persembahan', icon: CreditCard },
  { id: 'doa', label: 'Saya butuh didoakan', icon: HandHeart },
  { id: 'kegiatan', label: 'Kegiatan yang sedang berjalan', icon: Sparkles },
  { id: 'baptis', label: 'Cara daftar baptisan', icon: Droplets },
];

function getTimeString() {
  const now = new Date();
  return now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function JemaatChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [copiedBca, setCopiedBca] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      cardType: 'welcome',
      text: 'Shalom! Selamat datang di GBI Jelambar Timur. Saya Asisten Virtual jemaat. Ada yang bisa saya bantu hari ini?\n\nSilakan pilih topik cepat di bawah atau ketik pertanyaan Anda.',
      time: getTimeString(),
      actions: [
        { label: 'Jadwal Ibadah', to: '/service', icon: Calendar, variant: 'primary' },
        { label: 'Persembahan', to: '/give', icon: CreditCard, variant: 'secondary' },
        { label: 'Lokasi & Rute', to: '/lokasi', icon: MapPin, variant: 'secondary' },
      ],
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const handleCopyBca = () => {
    navigator.clipboard.writeText('7020908500');
    setCopiedBca(true);
    setTimeout(() => setCopiedBca(false), 2000);
  };

  // Hide assistant on admin/dashboard or login paths
  const isDashboard = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/admin') || location.pathname.startsWith('/login');

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (isDashboard) {
    return null;
  }

  const getBotResponse = (query: string): { cardType: ChatMessage['cardType']; text?: string; actions: ActionLink[] } => {
    const q = query.toLowerCase();

    // 1. PERSEMBAHAN & REKENING
    if (q.includes('rekening') || q.includes('persembahan') || q.includes('transfer') || q.includes('qris') || q.includes('bca') || q.includes('donasi') || q.includes('perpuluhan') || q.includes('syukur') || q.includes('uang')) {
      return {
        cardType: 'giving',
        actions: [
          { label: 'Buka Halaman Persembahan', to: '/give', icon: CreditCard, variant: 'primary' },
          { label: 'Konfirmasi via WhatsApp', href: `https://wa.me/${CHURCH.whatsappNumber}?text=${encodeURIComponent('Shalom Admin, saya ingin mengonfirmasi persembahan yang sudah saya transfer ke rekening BCA GBI Jelambar Timur...')}`, isExternal: true, icon: MessageSquare, variant: 'emerald' },
          { label: 'Hubungi Keuangan: 021-66604730', href: `tel:${CHURCH.phoneRaw}`, isExternal: true, icon: Phone, variant: 'secondary' },
        ],
      };
    }

    // 2. JADWAL IBADAH
    if (q.includes('jadwal') || q.includes('jam') || q.includes('ibadah') || q.includes('kebaktian') || q.includes('minggu') || q.includes('sabtu') || q.includes('vessel') || q.includes('teens') || q.includes('kids') || q.includes('anak')) {
      return {
        cardType: 'schedule',
        actions: [
          { label: 'Lihat Semua Program Ibadah', to: '/service', icon: Calendar, variant: 'primary' },
          { label: 'Petunjuk Arah ke Gereja', to: '/lokasi', icon: MapPin, variant: 'secondary' },
          { label: 'Tanya Tim Penyambutan WA', href: `https://wa.me/${CHURCH.whatsappNumber}?text=${encodeURIComponent('Shalom Tim Penyambutan GBI Jelambar Timur, saya ingin bertanya seputar jadwal ibadah...')}`, isExternal: true, icon: MessageSquare, variant: 'emerald' },
        ],
      };
    }

    // 3. DOA & KONSELING
    if (q.includes('doa') || q.includes('didoakan') || q.includes('konseling') || q.includes('beban') || q.includes('pergumulan') || q.includes('masalah') || q.includes('sakit')) {
      return {
        cardType: 'prayer',
        actions: [
          { label: 'Chat Tim Doa via WhatsApp', href: `https://wa.me/${CHURCH.whatsappNumber}?text=${encodeURIComponent('Shalom Hamba Tuhan, saya membutuhkan dukungan doa dan konseling mengenai...')}`, isExternal: true, icon: MessageSquare, variant: 'emerald' },
          { label: 'Formulir Layanan Doa', to: '/service?tab=layanan', icon: HandHeart, variant: 'primary' },
          { label: 'Telepon Sekretariat: 021-66604730', href: `tel:${CHURCH.phoneRaw}`, isExternal: true, icon: Phone, variant: 'secondary' },
        ],
      };
    }

    // 4. LOKASI GEREJA
    if (q.includes('lokasi') || q.includes('alamat') || q.includes('dimana') || q.includes('maps') || q.includes('tempat') || q.includes('rute') || q.includes('jalan')) {
      return {
        cardType: 'location',
        actions: [
          { label: 'Buka di Google Maps', href: CHURCH.mapsUrl, isExternal: true, icon: MapPin, variant: 'primary' },
          { label: 'Halaman Detail Lokasi & Kontak', to: '/lokasi', icon: ArrowRight, variant: 'secondary' },
          { label: 'Telepon Petugas Gereja', href: `tel:${CHURCH.phoneRaw}`, isExternal: true, icon: Phone, variant: 'secondary' },
        ],
      };
    }

    // 5. KEGIATAN & PENGUMUMAN
    if (q.includes('kegiatan') || q.includes('acara') || q.includes('event') || q.includes('pengumuman') || q.includes('berjalan') || q.includes('info') || q.includes('komsel') || q.includes('pks')) {
      return {
        cardType: 'events',
        actions: [
          { label: 'Cek Pengumuman di Beranda', to: '/jemaat#pengumuman', icon: Sparkles, variant: 'primary' },
          { label: 'Lihat Galeri Foto & Event', to: '/galeri', icon: ArrowRight, variant: 'secondary' },
          { label: 'Tanya Kegiatan via WhatsApp', href: `https://wa.me/${CHURCH.whatsappNumber}?text=${encodeURIComponent('Shalom Admin, saya ingin menanyakan kegiatan dan jadwal komsel di GBI Jelambar Timur...')}`, isExternal: true, icon: MessageSquare, variant: 'emerald' },
        ],
      };
    }

    // 6. BAPTISAN & PENYERAHAN ANAK
    if (q.includes('baptis') || q.includes('baptisan') || q.includes('selam') || q.includes('penyerahan') || q.includes('nikah') || q.includes('pernikahan') || q.includes('sakramen')) {
      return {
        cardType: 'baptism',
        actions: [
          { label: 'Daftar Layanan Baptisan Online', to: '/service?tab=layanan', icon: Droplets, variant: 'primary' },
          { label: 'Konsultasi via WhatsApp', href: `https://wa.me/${CHURCH.whatsappNumber}?text=${encodeURIComponent('Shalom Admin, saya ingin berkonsultasi mengenai pendaftaran Baptisan Air / Penyerahan Anak...')}`, isExternal: true, icon: MessageSquare, variant: 'emerald' },
        ],
      };
    }

    // 7. YOUTUBE / STREAMING
    if (q.includes('youtube') || q.includes('live') || q.includes('streaming') || q.includes('khotbah') || q.includes('online')) {
      return {
        cardType: 'streaming',
        actions: [
          { label: 'Buka YouTube GBI Jelambar Timur', href: CHURCH.youtubeUrl, isExternal: true, icon: ExternalLink, variant: 'primary' },
          { label: 'Instagram @gbi_jeltim', href: CHURCH.instagramUrl, isExternal: true, icon: ExternalLink, variant: 'secondary' },
        ],
      };
    }

    // DEFAULT FALLBACK
    return {
      cardType: 'default',
      text: 'Terima kasih atas pesan Anda! Untuk pertanyaan spesifik atau bantuan hamba Tuhan, kami sarankan untuk terhubung langsung dengan tim sekretariat kami melalui WhatsApp atau telepon.',
      actions: [
        { label: 'Chat Langsung via WhatsApp', href: `https://wa.me/${CHURCH.whatsappNumber}?text=${encodeURIComponent(`Shalom Admin, saya ingin bertanya: ${query}`)}`, isExternal: true, icon: MessageSquare, variant: 'emerald' },
        { label: 'Telepon Kantor: 021-66604730', href: `tel:${CHURCH.phoneRaw}`, isExternal: true, icon: Phone, variant: 'secondary' },
        { label: 'Halaman Beranda Jemaat', to: '/jemaat', icon: ArrowRight, variant: 'primary' },
      ],
    };
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      time: getTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');

    // Simulate natural bot reply delay
    setTimeout(() => {
      const response = getBotResponse(text);
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        cardType: response.cardType,
        text: response.text,
        time: getTimeString(),
        actions: response.actions,
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 450);
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'bot',
        cardType: 'welcome',
        text: 'Percakapan telah direset. Ada hal lain yang bisa kami bantu seputar ibadah dan pelayanan di GBI Jelambar Timur?',
        time: getTimeString(),
        actions: [
          { label: 'Jadwal Ibadah', to: '/service', icon: Calendar, variant: 'primary' },
          { label: 'Persembahan', to: '/give', icon: CreditCard, variant: 'secondary' },
          { label: 'Lokasi & Rute', to: '/lokasi', icon: MapPin, variant: 'secondary' },
        ],
      },
    ]);
  };

  return (
    <>
      {/* ── Floating Chat Bot Trigger Button ── */}
      <div className="fixed bottom-36 right-5 z-40 flex items-center">
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-2.5 rounded-full shadow-2xl border border-white/20 hover:border-blue-400/60 cursor-pointer backdrop-blur-md transition-all duration-300 ease-out hover:pr-4.5 hover:shadow-blue-900/30 hover:shadow-xl"
            aria-label="Buka Chat Asisten Jemaat"
            title="Tanya Asisten GBI Jelambar Timur"
          >
            {/* Avatar & Online / Chat Badge */}
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-white/10 p-1 flex items-center justify-center border border-white/20 shrink-0 group-hover:scale-105 transition-transform duration-300">
              <img src={gbiLogo} alt="GBI Logo" className="w-full h-full object-contain" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 rounded-full border border-slate-900 flex items-center justify-center text-white shadow-xs">
                <MessageSquare size={9} />
              </span>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>

            {/* Expandable Text: Hidden by default, smoothly expands on hover */}
            <div className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out group-hover:max-w-[220px] group-hover:opacity-100 group-hover:ml-2.5 flex flex-col text-left pointer-events-none group-hover:pointer-events-auto">
              <p className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors leading-tight">
                Tanya Asisten
              </p>
              <p className="text-[10px] text-blue-200/80 leading-tight mt-0.5">
                Siap melayani 24/7
              </p>
            </div>
          </motion.button>
        )}
      </div>

      {/* ── Chat Modal Window ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 25, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.94 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-4 sm:bottom-20 right-2 sm:right-6 z-50 w-[94vw] sm:w-[420px] max-w-[430px] h-[86vh] sm:h-[620px] max-h-[640px] bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden safe-bottom"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-3.5 flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-full bg-white/10 p-1 flex items-center justify-center border border-white/20">
                  <img src={gbiLogo} alt="GBI Logo" className="w-full h-full object-contain" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-1.5 leading-tight">
                    <span>Asisten GBI Jelambar Timur</span>
                  </h3>
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Siap melayani
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleResetChat}
                  title="Reset Percakapan"
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Tutup Asisten"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4 bg-slate-50/70">
              {/* Quick Pills Carousel */}
              <div className="pb-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Topik Populer Jemaat:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((p) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSendMessage(p.label)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/90 text-xs font-semibold shadow-2xs hover:border-blue-300 active:scale-95 transition-all cursor-pointer"
                      >
                        <Icon size={13} className="text-blue-600 shrink-0" />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chat Dialogue Bubbles & Structured Response Cards */}
              {messages.map((m) => {
                const isBot = m.sender === 'bot';

                if (!isBot) {
                  // User Message Bubble
                  return (
                    <div key={m.id} className="flex flex-col items-end">
                      <div className="max-w-[85%] rounded-2xl p-3 bg-blue-600 text-white rounded-tr-sm shadow-md text-xs sm:text-sm leading-relaxed">
                        <p>{m.text}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 px-1">{m.time}</span>
                    </div>
                  );
                }

                // Bot Response: Structured Rich Card Layout
                return (
                  <div key={m.id} className="flex flex-col items-start w-full">
                    {/* 1. SCHEDULE STRUCTURED CARD */}
                    {m.cardType === 'schedule' && (
                      <div className="w-full bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm border border-slate-200/90 space-y-3">
                        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Calendar size={17} />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Jadwal Ibadah Rutin</h4>
                            <p className="text-[10px] text-slate-400 leading-tight">GBI Jelambar Timur</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {/* Ibadah Raya */}
                          <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5 truncate">
                                <Crown size={14} className="text-blue-600 shrink-0" /> Ibadah Raya Umum
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                                <MapPin size={11} className="shrink-0 text-slate-400" /> Gedung Utama Lantai 3
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-lg">
                              Minggu 08.00
                            </span>
                          </div>

                          {/* Sekolah Minggu */}
                          <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5 truncate">
                                <Rocket size={14} className="text-amber-500 shrink-0" /> Sekolah Minggu (Kids)
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                                <MapPin size={11} className="shrink-0 text-slate-400" /> Ruang Anak Lantai 2
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg">
                              Minggu 10.00
                            </span>
                          </div>

                          {/* Teens */}
                          <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5 truncate">
                                <Flame size={14} className="text-purple-600 shrink-0" /> Teens (Remaja)
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                                <MapPin size={11} className="shrink-0 text-slate-400" /> Ruang Teens Lantai 2
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] font-bold bg-purple-100 text-purple-800 px-2.5 py-1 rounded-lg">
                              Minggu 12.30
                            </span>
                          </div>

                          {/* Vessel */}
                          <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5 truncate">
                                <Flame size={14} className="text-rose-600 shrink-0" /> Vessel (Pemuda)
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                                <MapPin size={11} className="shrink-0 text-slate-400" /> Ruang Vessel Lantai 2
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] font-bold bg-rose-100 text-rose-800 px-2.5 py-1 rounded-lg">
                              Sabtu 18.30 (Mg I)
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 text-center italic pt-0.5">
                          Mari ajak keluarga dan sahabat beribadah bersama!
                        </p>
                      </div>
                    )}

                    {/* 2. GIVING & REKENING STRUCTURED CARD */}
                    {m.cardType === 'giving' && (
                      <div className="w-full bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm border border-slate-200/90 space-y-3">
                        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <CreditCard size={17} />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Rekening Persembahan Resmi</h4>
                            <p className="text-[10px] text-slate-400 leading-tight">GBI Jelambar Timur</p>
                          </div>
                        </div>

                        {/* BCA Card */}
                        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-sm relative overflow-hidden">
                          <div className="flex items-center justify-between pb-2 border-b border-white/10">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-black">BCA</span>
                              <span className="text-xs font-bold text-white">Bank Central Asia</span>
                            </div>
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                              Terverifikasi
                            </span>
                          </div>

                          <div className="mt-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Nomor Rekening</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="font-mono font-bold text-base sm:text-lg text-white tracking-wider">
                                7020 908 500
                              </span>
                              <button
                                type="button"
                                onClick={handleCopyBca}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                                  copiedBca
                                    ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                                    : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                                }`}
                              >
                                {copiedBca ? <Check size={13} /> : <Copy size={13} />}
                                <span>{copiedBca ? 'Tersalin' : 'Salin'}</span>
                              </button>
                            </div>
                            <p className="text-[11px] text-blue-200 font-medium mt-1">
                              a.n. GEREJA BETHEL INDONESIA
                            </p>
                          </div>
                        </div>

                        {/* QRIS support */}
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <QrCode size={15} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">Mendukung Scan QRIS Resmi</p>
                            <p className="text-[10px] text-slate-500 truncate">m-BCA, Livin, BRImo, GoPay, OVO, ShopeePay</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. LOCATION STRUCTURED CARD */}
                    {m.cardType === 'location' && (
                      <div className="w-full bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm border border-slate-200/90 space-y-3">
                        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                            <MapPin size={17} />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Lokasi Gedung Gereja</h4>
                            <p className="text-[10px] text-slate-400 leading-tight">GBI Jelambar Timur</p>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                          <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                            📍 Jl. I No.52, RT.8/RW.6, Pejagalan, Kec. Penjaringan, Jakarta Utara, DKI Jakarta 14450
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-600 font-medium">
                              Patokan: Dekat Jl. Fajar Aladin / Jembatan Dua
                            </span>
                            <span className="text-[10px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-emerald-700 font-medium">
                              Ruang AC &amp; Parkir Tersedia
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. PRAYER STRUCTURED CARD */}
                    {m.cardType === 'prayer' && (
                      <div className="w-full bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm border border-slate-200/90 space-y-3">
                        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                          <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                            <HandHeart size={17} />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Dukungan Doa &amp; Konseling</h4>
                            <p className="text-[10px] text-slate-400 leading-tight">Tim Pastoral GBI Jelambar Timur</p>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 space-y-1">
                          <p className="text-xs italic text-blue-950 leading-relaxed font-serif">
                            &ldquo;Berserulah kepada-Ku, maka Aku akan menjawab engkau dan akan memberitahukan kepadamu hal-hal yang besar.&rdquo;
                          </p>
                          <p className="text-[10px] text-blue-600 font-bold text-right">— Yeremia 33:3</p>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          Hamba Tuhan dan tim pendoa kami siap mendoakan pergumulan, pemulihan, dan keluarga Anda dengan kerahasiaan penuh.
                        </p>
                      </div>
                    )}

                    {/* 5. EVENTS STRUCTURED CARD */}
                    {m.cardType === 'events' && (
                      <div className="w-full bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm border border-slate-200/90 space-y-3">
                        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                            <Sparkles size={17} />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Kegiatan &amp; Komunitas Aktif</h4>
                            <p className="text-[10px] text-slate-400 leading-tight">GBI Jelambar Timur</p>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                            <div>
                              <span className="font-bold text-slate-900">Ibadah Raya &amp; Perjamuan Kudus</span>
                              <p className="text-[10px] text-slate-500">Ibadah bersama setiap Minggu &amp; awal bulan</p>
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <div>
                              <span className="font-bold text-slate-900">Komunitas Sel (PKS / Komsel)</span>
                              <p className="text-[10px] text-slate-500">Persekutuan &amp; bertumbuh bersama per wilayah</p>
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                            <div>
                              <span className="font-bold text-slate-900">Menara Doa &amp; Doa Fajar</span>
                              <p className="text-[10px] text-slate-500">Mendukung jemaat dan keluarga dalam doa</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 6. BAPTISM STRUCTURED CARD */}
                    {m.cardType === 'baptism' && (
                      <div className="w-full bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm border border-slate-200/90 space-y-3">
                        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                          <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                            <Droplets size={17} />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Layanan Sakramen &amp; Khusus</h4>
                            <p className="text-[10px] text-slate-400 leading-tight">GBI Jelambar Timur</p>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="font-bold text-slate-900 flex items-center gap-1.5">
                              🌊 Baptisan Air (Selam)
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Bagi jemaat yang telah menerima Kristus sebagai Tuhan &amp; Juruselamat.
                            </p>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="font-bold text-slate-900 flex items-center gap-1.5">
                              👶 Penyerahan Anak
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Pemberkatan dan komitmen keluarga mendidik anak di dalam Tuhan.
                            </p>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="font-bold text-slate-900 flex items-center gap-1.5">
                              💍 Pemberkatan Nikah
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Konseling pranikah dan ibadah pemberkatan kudus.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 7. STREAMING STRUCTURED CARD */}
                    {m.cardType === 'streaming' && (
                      <div className="w-full bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm border border-slate-200/90 space-y-2.5">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                            <ExternalLink size={16} />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">Tayangan Ibadah Online</h4>
                            <p className="text-[10px] text-slate-400 leading-tight">YouTube &amp; Media Sosial</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          Saksikan siaran ibadah, pujian penyembahan, dan khotbah firman Tuhan melalui channel YouTube resmi GBI Jelambar Timur.
                        </p>
                      </div>
                    )}

                    {/* 8. STANDARD TEXT MESSAGE (WELCOME / FALLBACK) */}
                    {(m.cardType === 'welcome' || m.cardType === 'default' || (!m.cardType && m.text)) && (
                      <div className="w-full bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm border border-slate-200/90 text-xs sm:text-sm leading-relaxed text-slate-800">
                        <p className="whitespace-pre-line">{m.text}</p>
                      </div>
                    )}

                    <span className="text-[10px] text-slate-400 mt-1 px-1">{m.time}</span>

                    {/* Relatable Actions Card below bot message */}
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-2 w-full space-y-1.5 animate-in fade-in slide-in-from-top-1">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 pl-1">
                          Halaman &amp; Kontak Terkait:
                        </p>
                        {m.actions.map((act, idx) => {
                          const Icon = act.icon || ArrowRight;
                          const btnStyle =
                            act.variant === 'primary'
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent hover:from-blue-500 hover:to-indigo-500 shadow-xs'
                              : act.variant === 'emerald'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';

                          if (act.isExternal && act.href) {
                            return (
                              <a
                                key={idx}
                                href={act.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] ${btnStyle}`}
                              >
                                <span className="flex items-center gap-2 truncate">
                                  <Icon size={14} className="shrink-0" />
                                  <span className="truncate">{act.label}</span>
                                </span>
                                <ExternalLink size={12} className="shrink-0 opacity-70" />
                              </a>
                            );
                          }

                          return (
                            <Link
                              key={idx}
                              to={act.to || '/jemaat'}
                              onClick={() => {
                                setIsOpen(false);
                                window.scrollTo({ top: 0, behavior: 'instant' });
                              }}
                              className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] ${btnStyle}`}
                            >
                              <span className="flex items-center gap-2 truncate">
                                <Icon size={14} className="shrink-0" />
                                <span className="truncate">{act.label}</span>
                              </span>
                              <ChevronRight size={14} className="shrink-0 opacity-70" />
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* Direct WhatsApp Callout Banner */}
            <div className="px-4 py-2 bg-gradient-to-r from-emerald-50 to-green-50 border-t border-emerald-100 shrink-0">
              <a
                href={`https://wa.me/${CHURCH.whatsappNumber}?text=${encodeURIComponent('Shalom Admin GBI Jelambar Timur, saya membutuhkan informasi seputar gereja...')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/90 border border-emerald-200/80 hover:bg-white text-emerald-950 transition-all shadow-2xs group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <MessageSquare size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 truncate leading-tight">
                      Chat langsung via WhatsApp
                    </p>
                    <p className="text-[10px] text-slate-500 truncate leading-tight">
                      Terhubung dengan tim admin gereja
                    </p>
                  </div>
                </div>
                <ExternalLink size={13} className="text-emerald-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>

            {/* Input Form Area */}
            <div className="p-3 bg-white border-t border-slate-100 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Tulis pertanyaan..."
                  className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-100 border border-slate-200/80 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-md transition-all active:scale-95 cursor-pointer"
                  title="Kirim Pesan"
                >
                  <Send size={15} />
                </button>
              </form>

              <p className="text-[10px] text-slate-400 text-center mt-2 leading-tight">
                Jawaban diambil dari data resmi GBI Jelambar Timur. Untuk hal mendesak, hubungi sekretariat.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
