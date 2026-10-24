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
  text: string;
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
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

  const getBotResponse = (query: string): { text: string; actions: ActionLink[] } => {
    const q = query.toLowerCase();

    // 1. PERSEMBAHAN & REKENING
    if (q.includes('rekening') || q.includes('persembahan') || q.includes('transfer') || q.includes('qris') || q.includes('bca') || q.includes('donasi') || q.includes('perpuluhan') || q.includes('syukur') || q.includes('uang')) {
      return {
        text: 'Terima kasih atas kemurahan hati Anda dalam mendukung pelayanan pekerjaan Tuhan di GBI Jelambar Timur.\n\n💳 Bank Central Asia (BCA):\n• No. Rekening: 7020 908 500\n• Atas Nama: GEREJA BETHEL INDONESIA\n\n📱 QRIS Resmi:\nMendukung m-BCA, Livin Mandiri, BRImo, GoPay, OVO, ShopeePay, dan seluruh e-wallet.\n\nSetelah transfer, Anda dapat mengonfirmasi persembahan pada halaman Persembahan agar langsung tervalidasi oleh tim Keuangan.',
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
        text: 'Berikut jadwal ibadah rutin di GBI Jelambar Timur:\n\n• Ibadah Raya Umum: Setiap Minggu pukul 08.00 WIB (Gedung Utama Lantai 3)\n• Sekolah Minggu (Kids): Setiap Minggu pukul 10.00 WIB (Ruang Anak Lantai 2)\n• Teens (Remaja): Setiap Minggu pukul 12.30 WIB (Ruang Teens Lantai 2)\n• Vessel (Pemuda): Setiap Sabtu pertama pukul 18.30 WIB (Ruang Vessel Lantai 2)\n\nMari ajak keluarga dan kerabat untuk beribadah dan mengalami hadirat Tuhan!',
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
        text: 'Kami di GBI Jelambar Timur ada untuk mendukung Anda dalam doa. Firman Tuhan berjanji:\n"Berserulah kepada-Ku, maka Aku akan menjawab engkau." (Yeremia 33:3)\n\nTim pendoa syafaat dan hamba Tuhan kami siap mendoakan dan mendampingi Anda dengan kerahasiaan penuh.\n\nSilakan klik tombol di bawah untuk menuliskan pokok doa atau berbicara langsung via WhatsApp.',
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
        text: `Gedung GBI Jelambar Timur beralamat di:\n\n📍 ${CHURCH.address}\n\nPatokan: Kawasan Pejagalan / Jembatan Dua, Jakarta Utara. Gedung gereja dilengkapi ruang ibadah sejuk ber-AC, ruang ibadah anak, dan area parkir kendaraan.`,
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
        text: 'Kegiatan rohani aktif di GBI Jelambar Timur antara lain:\n\n• Ibadah Raya & Perjamuan Kudus (Setiap awal bulan)\n• Komunitas Sel (PKS/Komsel) di wilayah pemukiman jemaat\n• Komunitas Pemuda (Vessel) & Remaja (Teens)\n• Ibadah Sekolah Minggu & Kelas Rohani Anak\n• Doa Fajar dan Menara Doa Syafaat\n\nUntuk pengumuman event dan dokumentasi lengkap, silakan jelajahi halaman di bawah.',
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
        text: 'Layanan Sakramen & Khusus di GBI Jelambar Timur:\n\n🌊 Baptisan Air (Selam): Bagi setiap orang yang telah percaya dan menerima Kristus sebagai Tuhan dan Juruselamat.\n👶 Penyerahan Anak: Penyerahan dan doa berkat anak di hadapan jemaat Tuhan.\n💍 Pemberkatan Nikah: Bimbingan pranikah dan ibadah pemberkatan kudus.\n\nAnda dapat mengisi formulir pendaftaran langsung secara online melalui web kami.',
        actions: [
          { label: 'Daftar Layanan Baptisan Online', to: '/service?tab=layanan', icon: Droplets, variant: 'primary' },
          { label: 'Konsultasi via WhatsApp', href: `https://wa.me/${CHURCH.whatsappNumber}?text=${encodeURIComponent('Shalom Admin, saya ingin berkonsultasi mengenai pendaftaran Baptisan Air / Penyerahan Anak...')}`, isExternal: true, icon: MessageSquare, variant: 'emerald' },
        ],
      };
    }

    // 7. YOUTUBE / STREAMING
    if (q.includes('youtube') || q.includes('live') || q.includes('streaming') || q.includes('khotbah') || q.includes('online')) {
      return {
        text: 'Anda dapat menyaksikan tayangan ibadah, lagu pujian, dan khotbah GBI Jelambar Timur secara online melalui channel YouTube resmi kami.',
        actions: [
          { label: 'Buka YouTube GBI Jelambar Timur', href: CHURCH.youtubeUrl, isExternal: true, icon: ExternalLink, variant: 'primary' },
          { label: 'Instagram @gbi_jeltim', href: CHURCH.instagramUrl, isExternal: true, icon: ExternalLink, variant: 'secondary' },
        ],
      };
    }

    // DEFAULT FALLBACK
    return {
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
      <div className="fixed bottom-36 right-5 z-40 flex items-center gap-2">
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-2.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white pl-3.5 pr-4 py-2.5 rounded-full shadow-2xl border border-white/20 hover:border-blue-400/60 cursor-pointer backdrop-blur-md transition-all"
            aria-label="Buka Chat Asisten Jemaat"
          >
            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-white/10 p-1 flex items-center justify-center border border-white/20 group-hover:scale-105 transition-transform">
              <img src={gbiLogo} alt="GBI Logo" className="w-full h-full object-contain" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">Tanya Asisten</p>
              <p className="text-[10px] text-blue-200/80">Siap melayani 24/7</p>
            </div>
            <span className="sm:hidden text-xs font-bold text-white pr-1">Tanya Asisten</span>
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
            className="fixed bottom-4 sm:bottom-20 right-2 sm:right-6 z-50 w-[94vw] sm:w-[410px] max-w-[430px] h-[86vh] sm:h-[620px] max-h-[640px] bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden safe-bottom"
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70">
              {/* Quick Pills Carousel (Always accessible at top) */}
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

              {/* Chat Dialogue Bubbles */}
              {messages.map((m) => {
                const isBot = m.sender === 'bot';
                return (
                  <div key={m.id} className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}>
                    <div
                      className={`max-w-[88%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                        isBot
                          ? 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-tl-sm'
                          : 'bg-blue-600 text-white rounded-tr-sm shadow-md'
                      }`}
                    >
                      <p className="whitespace-pre-line">{m.text}</p>
                    </div>

                    <span className="text-[10px] text-slate-400 mt-1 px-1">{m.time}</span>

                    {/* Relatable Actions Card below bot message */}
                    {isBot && m.actions && m.actions.length > 0 && (
                      <div className="mt-2 w-full max-w-[92%] space-y-1.5 animate-in fade-in slide-in-from-top-1">
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
                                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] ${btnStyle}`}
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
                              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] ${btnStyle}`}
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
