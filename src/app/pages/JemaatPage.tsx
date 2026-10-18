import { useEffect, useRef, useState, useCallback } from 'react';
import { apiBase } from '../../lib/api';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'motion/react';
import {
  Clock, MapPin, Users, Heart, BookOpen, Star,
  ChevronDown, ArrowRight, ChevronLeft, ChevronRight, ImageIcon, Images, CalendarHeart, UserRound,
  Music, Disc3, Play, Church, Sparkles, Baby, Flame
} from 'lucide-react';
import PublicNavbar from '../components/public/PublicNavbar';
import { getMinistry, formatSchedules, ALL_MINISTRIES } from '../../lib/ministries';
import { useChurchStats, yearsServing } from '../../lib/stats';
import PublicFooter from '../components/public/PublicFooter';
import { CHURCH } from '../../lib/church';

const API_URL = `${apiBase()}/api/content`;

interface Announcement {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  active: boolean;
}

// ── Flyer Carousel ──────────────────────────────────────────────────────────
function FlyerCarousel({ items }: { items: Announcement[] }) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef<any>(null);

  const go = useCallback((idx: number, dir: number) => { setDirection(dir); setCurrent(idx); }, []);
  const prev = () => go((current - 1 + items.length) % items.length, -1);
  const next = useCallback(() => go((current + 1) % items.length, 1), [current, items.length, go]);

  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(next, 10000);
    return () => clearInterval(timerRef.current);
  }, [next, items.length]);

  if (items.length === 0) return null;

  const item = items[current];
  const variants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow-2xl bg-gray-900" style={{ aspectRatio: '16/9' }}>
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div key={item.id} custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }} className="absolute inset-0">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-800 to-indigo-900 text-white">
              <ImageIcon size={48} className="opacity-40 mb-4" />
              <p className="text-xl font-bold">{item.title}</p>
              {item.description && <p className="text-sm opacity-70 mt-2 max-w-sm text-center px-4">{item.description}</p>}
            </div>
          )}
          {(item.title || item.description) && item.imageUrl && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
              <p className="text-white font-bold text-lg leading-tight">{item.title}</p>
              {item.description && <p className="text-white/80 text-sm mt-1">{item.description}</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {items.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110"><ChevronLeft size={22} /></button>
          <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110"><ChevronRight size={22} /></button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
            {items.map((_, i) => (
              <button key={i} onClick={() => go(i, i > current ? 1 : -1)} className={`rounded-full transition-all duration-300 ${i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/50 hover:bg-white/80'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FadeInSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

// Highlighted schedules on the home page as requested
const HOME_SCHEDULES = [
  {
    id: 'umum',
    title: 'Ibadah Umum',
    time: 'Minggu 08.00 WIB',
    location: 'Gedung Utama Lantai 3',
    icon: Church,
    color: 'from-blue-500 to-indigo-600',
    tag: 'Ibadah Raya',
  },
  {
    id: 'teens',
    title: 'Teens',
    time: 'Minggu 12:30 WIB',
    location: 'Ruang Teens Lantai 2',
    icon: Sparkles,
    color: 'from-violet-500 to-purple-600',
    tag: 'Remaja',
  },
  {
    id: 'sekolah-minggu',
    title: 'Sekolah Minggu',
    time: 'Minggu 10.00 WIB',
    location: 'Ruang Anak Lantai 2',
    icon: Baby,
    color: 'from-amber-400 to-orange-500',
    tag: 'Anak-anak',
  },
  {
    id: 'vessel',
    title: 'Vessel',
    time: 'Sabtu 18.30 · Setiap minggu pertama',
    location: 'Ruang Vessel Lantai 2',
    icon: Flame,
    color: 'from-rose-500 to-pink-600',
    tag: 'Pemuda',
  },
];

export default function JemaatPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const stats = useChurchStats();
  const musicVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/announcements`)
      .then(r => r.json())
      .then(d => { if (d.announcements) setAnnouncements(d.announcements.filter((a: Announcement) => a.active)); })
      .catch(() => {});
  }, []);

  // Ultra-fast instant autoplay & seamless looping for Lighthouse Music video
  useEffect(() => {
    const video = musicVideoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    const tryPlay = () => {
      const p = video.play();
      if (p !== undefined) {
        p.catch(() => {});
      }
    };

    tryPlay();
    video.addEventListener('loadeddata', tryPlay, { passive: true });
    video.addEventListener('canplay', tryPlay, { passive: true });
    video.addEventListener('canplaythrough', tryPlay, { passive: true });

    // Intersection observer so it never pauses or gets suspended by browser
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            tryPlay();
          }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(video);

    const onVisibility = () => {
      if (!document.hidden) tryPlay();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      observer.disconnect();
      video.removeEventListener('loadeddata', tryPlay);
      video.removeEventListener('canplay', tryPlay);
      video.removeEventListener('canplaythrough', tryPlay);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 800], [0, 220]);
  const heroContentY = useTransform(scrollY, [0, 800], [0, -100]);
  const heroOpacity = useTransform(scrollY, [0, 450], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 700], [1, 0.94]);
  const heroGlowY = useTransform(scrollY, [0, 800], [0, 160]);

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      {/* ── Public Navbar (Fixed / Sticky on Top) ── */}
      <PublicNavbar />

      {/* ── Hero ── */}
      <section
        className="relative min-h-[90vh] sm:min-h-[92vh] md:min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-16 sm:py-24"
        style={{
          background: 'radial-gradient(ellipse 95% 75% at 50% 12%, #1e3a8a 0%, #0f172a 55%, #050814 100%)'
        }}
      >

        {/* Church Building Background Artwork (15% opacity) */}
        <motion.div
          style={{ y: heroY }}
          className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden"
        >
          <img
            src="/gedung-gereja.png"
            alt="Gedung GBI Jelambar Timur"
            className="w-full h-full object-cover object-center opacity-15 mix-blend-luminosity filter contrast-125 brightness-95 scale-105"
          />
          {/* Subtle gradient vignette to blend edges smoothly into the celestial background */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050814] via-transparent to-[#1e3a8a]/40 mix-blend-multiply" />
          <div className="absolute inset-0 bg-radial from-transparent via-[#0f172a]/40 to-[#050814]/90" />
        </motion.div>

        <div className="absolute inset-0 hero-aurora pointer-events-none opacity-60" />

        {/* Ambient celestial lighting layers with Parallax */}
        <motion.div style={{ y: heroGlowY }} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[760px] max-w-full h-[360px] bg-gradient-to-b from-amber-300/15 via-sky-400/15 to-transparent blur-3xl" />
          <div className="absolute top-1/4 left-1/10 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-blue-500/20 blur-3xl animate-pulse duration-1000" />
          <div className="absolute bottom-1/4 right-1/10 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-60 h-60 rounded-full bg-purple-500/15 blur-2xl" />
        </motion.div>

        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />

        {/* Hero Content with Parallax Scale & Offset */}
        <motion.div
          style={{ y: heroContentY, opacity: heroOpacity, scale: heroScale }}
          className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto flex flex-col items-center"
        >
          {/* Main Title */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="mb-4 sm:mb-6 mt-1 sm:mt-2"
          >
            <span className="inline-block text-xs sm:text-sm font-bold tracking-widest uppercase text-sky-300/90 mb-2 sm:mb-3 px-3.5 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
              Gereja Bethel Indonesia
            </span>
            <h1 className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.14]">
              Selamat Datang di <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-sky-200 via-blue-100 to-amber-200 bg-clip-text text-transparent drop-shadow-sm">
                GBI Jelambar Timur
              </span>
            </h1>
          </motion.div>

          {/* Subtitle / Church Mission */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.38 }}
            className="text-xs sm:text-base md:text-lg text-blue-100/90 max-w-2xl mx-auto mb-6 sm:mb-8 leading-relaxed font-normal px-2 drop-shadow-sm"
          >
            Komunitas iman yang hangat dan melayani dengan kasih. Kami menyambut Anda dan keluarga untuk bersekutu, beribadah, dan bertumbuh bersama dalam hadirat Tuhan.
          </motion.p>

          {/* Action CTA Buttons: Single primary button */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.48 }}
            className="flex flex-col items-center justify-center gap-4 w-full sm:w-auto"
          >
            <a
              href="#jadwal"
              className="inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-600 text-white font-bold text-sm sm:text-base px-8 py-3.5 sm:px-10 sm:py-4 rounded-full shadow-xl shadow-blue-600/35 hover:shadow-blue-500/60 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <span>Lihat Jadwal Ibadah</span>
              <ArrowRight size={18} />
            </a>

            {/* Quick Icon Links: YouTube, Instagram, Google Maps, Galeri */}
            <div className="flex items-center justify-center gap-3 sm:gap-3.5 pt-1">
              {/* YouTube */}
              <a
                href={CHURCH.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="YouTube GBI Jelambar Timur"
                aria-label="YouTube"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md flex items-center justify-center text-white shadow-md hover:scale-110 active:scale-95 transition-all duration-200 hover:-translate-y-0.5 group"
              >
                <span className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm group-hover:bg-red-500 transition-colors">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </span>
              </a>

              {/* Instagram */}
              <a
                href={CHURCH.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram GBI Jelambar Timur"
                aria-label="Instagram"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md flex items-center justify-center text-white shadow-md hover:scale-110 active:scale-95 transition-all duration-200 hover:-translate-y-0.5 group"
              >
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-amber-400 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </span>
              </a>

              {/* Google Maps */}
              <a
                href={CHURCH.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Petunjuk Arah Google Maps"
                aria-label="Google Maps"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 backdrop-blur-md flex items-center justify-center text-emerald-300 hover:text-white shadow-md hover:scale-110 active:scale-95 transition-all duration-200 hover:-translate-y-0.5"
              >
                <MapPin size={18} />
              </a>

              {/* Galeri */}
              <Link
                to="/galeri"
                title="Lihat Galeri Foto"
                aria-label="Galeri Foto"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white shadow-md hover:scale-110 active:scale-95 transition-all duration-200 hover:-translate-y-0.5"
              >
                <Images size={18} />
              </Link>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll down indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 pointer-events-none hidden sm:block"
        >
          <ChevronDown size={24} />
        </motion.div>
      </section>

      {/* ── Akses cepat ── */}
      <section className="relative z-20 -mt-6 sm:-mt-8 md:-mt-12 px-3 sm:px-4">
        <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur-xl rounded-3xl shadow-xl shadow-blue-950/10 border border-gray-100 p-2 sm:p-4 grid grid-cols-5 gap-1 sm:gap-2">
          {[
            { href: '#jadwal', label: 'Jadwal', icon: Clock, color: 'from-blue-500 to-indigo-600' },
            { to: '/give', label: 'Persembahan', icon: Heart, color: 'from-emerald-500 to-teal-600' },
            { to: '/lokasi', label: 'Lokasi', icon: MapPin, color: 'from-sky-500 to-blue-600' },
            { to: '/service', label: 'Layanan', icon: CalendarHeart, color: 'from-rose-500 to-orange-500' },
            { to: '/akun', label: 'Akun', icon: UserRound, color: 'from-purple-500 to-pink-600' },
          ].map(item => {
            const inner = (
              <>
                <span className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md group-hover:-translate-y-1 group-hover:scale-105 transition-all duration-300`}>
                  <item.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </span>
                <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-gray-700 mt-1.5 sm:mt-2 group-hover:text-blue-600 transition-colors">{item.label}</span>
              </>
            );
            const cls = 'group flex flex-col items-center py-1.5 sm:py-2 rounded-2xl hover:bg-gray-50/80 transition-colors cursor-pointer';
            return item.to
              ? <Link key={item.label} to={item.to} className={cls}>{inner}</Link>
              : <a key={item.label} href={item.href} className={cls}>{inner}</a>;
          })}
        </div>
      </section>

      {/* ── Stats bar ── */}
      <FadeInSection>
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 mt-8 sm:mt-12 shadow-inner">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center text-white">
            {[
              { n: stats ? String(stats.members) : '–', label: 'Jemaat Terdaftar' },
              { n: String(ALL_MINISTRIES.length), label: 'Komunitas & Ibadah' },
              { n: stats ? String(stats.komsel) : '–', label: 'Kelompok Komsel' },
              { n: `${yearsServing()}+`, label: 'Tahun Melayani' },
            ].map(item => (
              <div key={item.label} className="p-2">
                <div className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">{item.n}</div>
                <div className="text-blue-200 text-xs sm:text-sm font-medium mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </FadeInSection>

      {/* ── Pengumuman / Flyer ── */}
      {announcements.length > 0 && (
        <section id="pengumuman" className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-6">
            <FadeInSection>
              <div className="text-center mb-8">
                <span className="inline-block text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">Pengumuman</span>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">Info & Event Terkini</h2>
              </div>
            </FadeInSection>
            <FadeInSection delay={0.1}><FlyerCarousel items={announcements} /></FadeInSection>
          </div>
        </section>
      )}

      {/* ── Jadwal ── */}
      <section id="jadwal" className="py-20 sm:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <FadeInSection>
            <div className="text-center mb-12 sm:mb-14">
              <span className="inline-block text-blue-600 text-xs sm:text-sm font-semibold uppercase tracking-widest mb-3">Jadwal</span>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Ibadah & Kegiatan</h2>
              <p className="text-gray-500 max-w-xl mx-auto text-xs sm:text-base">Bergabunglah bersama kami dalam berbagai kegiatan ibadah yang tersedia setiap minggu.</p>
            </div>
          </FadeInSection>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {HOME_SCHEDULES.map((s, i) => (
              <FadeInSection key={s.id} delay={i * 0.1}>
                <div className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 flex flex-col justify-between">
                  <div>
                    <div className={`h-2 bg-gradient-to-r ${s.color}`} />
                    <div className="p-6 sm:p-7 flex items-start gap-4 sm:gap-5">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                        <s.icon size={24} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900">{s.title}</h3>
                          <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">{s.tag}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 text-sm font-medium mb-1.5">
                          <Clock size={15} className="text-blue-600 flex-shrink-0" />
                          <span>{s.time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 text-xs sm:text-sm">
                          <MapPin size={15} className="text-gray-400 flex-shrink-0" />
                          <span>{s.location}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Lighthouse Music / Album Promo ── */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white relative overflow-hidden">
        {/* Background Choir Video (22% opacity, fast-start optimized, looped, muted, playsInline) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <video
            ref={musicVideoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="w-full h-full object-cover opacity-[0.22] scale-105 filter contrast-110 brightness-110"
          >
            <source src="/lighthouse-fast.mp4" type="video/mp4" />
            <source src="/lighthouse-bg.mp4" type="video/mp4" />
          </video>
          {/* Subtle gradient overlays to blend edges perfectly into dark container */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-transparent to-slate-900/70" />
          <div className="absolute inset-0 bg-radial from-transparent via-slate-950/20 to-slate-950/70" />
        </div>

        {/* Ambient atmospheric glows */}
        <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <FadeInSection>
            <div className="text-center mb-10 sm:mb-14">
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-400/20 px-3.5 py-1.5 rounded-full mb-3 backdrop-blur-md">
                <Music size={14} className="text-emerald-400" />
                <span>Lighthouse Music</span>
              </span>
              <h2 className="font-display text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                Album Pujian & Penyembahan
              </h2>
              <p className="text-slate-300 max-w-2xl mx-auto text-xs sm:text-base mt-3 leading-relaxed">
                Dengarkan karya pujian dan penyembahan orisinal dari pelayan Tuhan di GBI Jelambar Timur melalui Spotify. Mari masuk dalam hadirat-Nya bersama-sama.
              </p>
            </div>
          </FadeInSection>

          {/* Responsive Layout: Desktop 2-column spotlight, Mobile native widget format */}
          <FadeInSection delay={0.15}>
            <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-4 sm:p-8 lg:p-10 shadow-2xl shadow-black/40">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
                
                {/* Left side: Album presentation & CTAs (on desktop takes 5 cols) */}
                <div className="lg:col-span-5 space-y-4 sm:space-y-6 text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-semibold">
                    <Disc3 size={14} className="text-emerald-400 animate-spin duration-3000" />
                    <span>Official Release</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
                    Lighthouse Music
                  </h3>

                  <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                    Koleksi lagu pujian dan penyembahan yang dipersembahkan untuk memberkati setiap jemaat dan keluarga. Tersedia streaming gratis di Spotify.
                  </p>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                    <a
                      href="https://open.spotify.com/album/46Ujgis1XjXB2tbnLQZAmM?si=ZypdheALS0i_lGcZcq1zxQ&utm_source=copy-link"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs sm:text-sm px-6 py-3.5 rounded-full shadow-lg shadow-[#1DB954]/25 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.495 17.31a.75.75 0 0 1-1.032.247c-2.827-1.728-6.388-2.119-10.58-1.161a.75.75 0 1 1-.334-1.462c4.588-1.047 8.529-.607 11.7 1.332a.75.75 0 0 1 .246 1.044zm1.467-3.266a.937.937 0 0 1-1.29.309c-3.236-1.99-8.17-2.567-11.998-1.405a.937.937 0 1 1-.546-1.792c4.375-1.328 9.805-.688 13.525 1.6a.938.938 0 0 1 .309 1.288zm.125-3.415C15.21 8.334 8.822 8.125 5.132 9.245a1.125 1.125 0 1 1-.652-2.154c4.238-1.287 11.298-1.04 15.656 1.547a1.125 1.125 0 0 1-1.049 1.991z"/>
                      </svg>
                      <span>Buka di Spotify App</span>
                    </a>

                    <span className="text-[11px] text-slate-400">
                      Putar langsung di web atau simpan ke library Anda
                    </span>
                  </div>
                </div>

                {/* Right side: Interactive Spotify Embed (on desktop takes 7 cols, full width on mobile) */}
                <div className="lg:col-span-7">
                  <div className="w-full rounded-2xl overflow-hidden shadow-2xl bg-[#121212] border border-slate-700/60 transition-transform duration-300">
                    <iframe
                      title="Lighthouse Music Spotify Player"
                      style={{ borderRadius: '16px' }}
                      src="https://open.spotify.com/embed/album/46Ujgis1XjXB2tbnLQZAmM?utm_source=generator&theme=0"
                      width="100%"
                      height="380"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="w-full"
                    />
                  </div>
                </div>

              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ── Komsel ── */}
      <section className="py-24 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-indigo-400/10 blur-3xl" />
        </div>
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <FadeInSection>
            <div className="text-center mb-12">
              <span className="inline-block text-blue-300 text-sm font-semibold uppercase tracking-widest mb-3">Komsel</span>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">Kelompok Sel</h2>
              <p className="text-blue-200 max-w-xl mx-auto leading-relaxed">
                Bergabunglah dengan kelompok kecil kami di mana Anda dapat belajar firman Tuhan, berdoa bersama, dan saling mendukung.
              </p>
            </div>
          </FadeInSection>
          <FadeInSection delay={0.1}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {[
                { icon: BookOpen, title: 'Belajar Firman', desc: 'Mendalami Alkitab bersama dalam suasana yang akrab dan hangat' },
                { icon: Heart, title: 'Doa Bersama', desc: 'Saling mendoakan dan menguatkan satu dengan yang lain' },
                { icon: Users, title: 'Komunitas', desc: 'Membangun persahabatan yang tulus dan bermakna dalam iman' },
              ].map(card => (
                <div key={card.title} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-7 text-white">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-5">
                    <card.icon size={22} className="text-blue-200" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{card.title}</h3>
                  <p className="text-blue-200 text-sm leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </FadeInSection>
          <FadeInSection delay={0.2}>
            <div className="text-center">
              <Link to="/lokasi" className="inline-flex items-center gap-2 bg-white text-blue-900 font-bold px-8 py-4 rounded-full hover:shadow-2xl hover:scale-105 transition-all duration-200">
                Daftar Komsel Sekarang <ArrowRight size={18} />
              </Link>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ── Lokasi Kami (Interactive Google Maps Section) ── */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <div className="text-center mb-12">
              <span className="inline-block text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-100">
                Temukan Lokasi
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Kunjungi Kami di GBI Jelambar Timur</h2>
              <p className="text-gray-500 max-w-xl mx-auto text-sm sm:text-base">
                {CHURCH.address}
              </p>
            </div>
          </FadeInSection>

          <FadeInSection delay={0.1}>
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-gray-100 group">
              <div className="h-72 sm:h-96 w-full relative">
                <iframe
                  title="Lokasi GBI Jelambar Timur Home"
                  src="https://maps.google.com/maps?q=Jl.+I+No.52,+RT.8/RW.6,+Pejagalan,+Kecamatan+Penjaringan,+Jkt+Utara&z=17&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0, display: 'block' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />

                {/* Direct Google Maps link overlay button */}
                <a
                  href={CHURCH.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-white/95 hover:bg-white text-gray-900 font-bold text-xs sm:text-sm px-6 py-3 rounded-full shadow-2xl border border-gray-200 hover:shadow-blue-500/25 hover:border-blue-500 transition-all duration-300 hover:scale-105 active:scale-95 group/mapbtn backdrop-blur-md cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover/mapbtn:bg-blue-600 group-hover/mapbtn:text-white transition-colors duration-300">
                    <MapPin size={15} />
                  </div>
                  <span>Buka Petunjuk Arah di Google Maps</span>
                  <ArrowRight size={14} className="text-gray-400 group-hover/mapbtn:text-blue-600 group-hover/mapbtn:translate-x-1 transition-all" />
                </a>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ── Quick links to other pages ── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <FadeInSection>
            <div className="text-center mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Jelajahi Lebih Lanjut</h2>
              <p className="text-gray-500">Kenali kami lebih dekat melalui halaman-halaman berikut</p>
            </div>
          </FadeInSection>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { to: '/tentang', label: 'Tentang Kami', desc: 'Sejarah, visi misi, dan tim pelayanan gereja', color: 'from-blue-500 to-indigo-600', icon: Heart },
              { to: '/galeri', label: 'Galeri Foto', desc: 'Foto-foto kegiatan dan momen bersama jemaat', color: 'from-purple-500 to-pink-600', icon: Images },
              { to: '/lokasi', label: 'Lokasi & Kontak', desc: 'Peta, alamat, jam ibadah, dan cara menghubungi', color: 'from-emerald-500 to-teal-600', icon: MapPin },
            ].map((item, i) => (
              <FadeInSection key={item.to} delay={i * 0.1}>
                <Link to={item.to} className="group block bg-gray-50 hover:bg-white border border-gray-100 hover:border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform`}>
                    <item.icon size={22} className="text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1.5">{item.label}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-blue-600 text-xs font-semibold group-hover:gap-2 transition-all">
                    Selengkapnya <ArrowRight size={12} />
                  </span>
                </Link>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <PublicFooter />
    </div>
  );
}
