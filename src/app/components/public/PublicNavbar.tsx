import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ChevronDown, Crown, Flame, Rocket, HandHeart, ShieldCheck } from 'lucide-react';
import gbiLogo from '../../../imports/pngegg__1_-1.png';
import AdminPinModal from '../auth/AdminPinModal';
import { safeSessionStorage } from '../../../lib/storage';

/* ── Service sub-items ── */
const SERVICE_ITEMS = [
  {
    tab: 'adult',
    to: '/service?tab=adult',
    label: 'Adult',
    sub: 'Dewasa & Pasangan',
    icon: Crown,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  {
    tab: 'nxtgen',
    to: '/service?tab=nxtgen',
    label: 'NXT GEN',
    sub: 'Pemuda & Remaja',
    icon: Flame,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
  },
  {
    tab: 'kids',
    to: '/service?tab=kids',
    label: 'Kids',
    sub: 'Anak-anak',
    icon: Rocket,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
  },
  {
    tab: 'layanan',
    to: '/service?tab=layanan',
    label: 'Layanan',
    sub: 'Baptis, Konseling & Lainnya',
    icon: HandHeart,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
];

const NAV_LINKS = [
  { to: '/jemaat',  label: 'Beranda' },
  { to: '/tentang', label: 'Tentang' },
  { to: '/galeri',  label: 'Galeri' },
  { to: '/lokasi',  label: 'Lokasi' },
  { to: '/give',    label: 'Persembahan' },
];

export default function PublicNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [mobileServiceOpen, setMobileServiceOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleOpenAdmin = () => {
    const isUnlocked = safeSessionStorage.getItem('gjt_admin_portal_unlocked') === 'true';
    if (isUnlocked) {
      navigate('/admin');
    } else {
      setShowPinModal(true);
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    setScrolled(window.scrollY > 40);
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
    setServiceOpen(false);
    setMobileServiceOpen(false);
  }, [location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setServiceOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isHome = location.pathname === '/jemaat' || location.pathname === '/';
  const solid = scrolled || !isHome;
  const isService = location.pathname === '/service';

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        solid
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100/80 py-0'
          : 'bg-transparent py-1'
      }`}
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/jemaat" className="flex items-center gap-3 group flex-shrink-0">
          <div className={`w-10 h-10 rounded-full overflow-hidden shadow-md transition-all ${solid ? 'ring-2 ring-blue-100' : ''}`}>
            <img src={gbiLogo} alt="GBI Logo" className="w-full h-full object-cover" />
          </div>
          <div className="leading-tight">
            <span className={`block text-sm font-bold transition-colors ${solid ? 'text-gray-900' : 'text-white'}`}>GBI Jelambar Timur</span>
            <span className={`block text-xs transition-colors ${solid ? 'text-blue-600' : 'text-blue-200'}`}>Jakarta Barat</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(link => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 lg:px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  active
                    ? solid ? 'bg-blue-50 text-blue-700' : 'bg-white/20 text-white'
                    : solid ? 'text-gray-600 hover:text-blue-700 hover:bg-blue-50' : 'text-white/85 hover:text-white hover:bg-white/15'
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Service dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setServiceOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 lg:px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                isService
                  ? solid ? 'bg-blue-50 text-blue-700' : 'bg-white/20 text-white'
                  : solid ? 'text-gray-600 hover:text-blue-700 hover:bg-blue-50' : 'text-white/85 hover:text-white hover:bg-white/15'
              }`}
            >
              Service
              <motion.span animate={{ rotate: serviceOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={14} />
              </motion.span>
            </button>

            <AnimatePresence>
              {serviceOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
                >
                  <div className="px-4 pt-3 pb-2">
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Program Ibadah</p>
                  </div>
                  {SERVICE_ITEMS.map(item => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.tab}
                        to={item.to}
                        onClick={() => {
                          setServiceOpen(false);
                          window.scrollTo({ top: 0, behavior: 'instant' });
                        }}
                        className="flex items-center gap-3.5 px-4 py-3 hover:bg-gray-50/80 transition-all group"
                      >
                        <div className={`w-9 h-9 rounded-2xl ${item.bg} ${item.border} border flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-2xs ${item.color}`}>
                          <Icon size={17} strokeWidth={2.3} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800 leading-tight">{item.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5 leading-tight">{item.sub}</p>
                        </div>
                      </Link>
                    );
                  })}
                  <div className="px-4 py-3 border-t border-gray-50">
                    <Link
                      to="/service"
                      onClick={() => {
                        setServiceOpen(false);
                        window.scrollTo({ top: 0, behavior: 'instant' });
                      }}
                      className="block text-center text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Lihat semua program →
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* CTA + mobile toggle */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Subtle discreet admin access (no label, looks like clean security badge/icon) */}
          <button
            type="button"
            onClick={handleOpenAdmin}
            aria-label="Akses Internal"
            className={`p-2 rounded-full transition-all cursor-pointer opacity-70 hover:opacity-100 ${
              solid ? 'text-gray-400 hover:text-blue-700 hover:bg-gray-100' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <ShieldCheck size={16} />
          </button>

          <Link
            to="/lokasi"
            className={`hidden lg:inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-2 rounded-full transition-all duration-200 ${
              solid
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                : 'bg-white/20 text-white hover:bg-white/30 border border-white/30 backdrop-blur-sm'
            }`}
          >
            Hubungi Kami
          </Link>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`md:hidden p-2 rounded-xl transition-colors ${solid ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/15'}`}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="md:hidden bg-white border-t border-gray-100 shadow-xl px-4 py-3"
          >
            {NAV_LINKS.map(link => {
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => {
                    setMenuOpen(false);
                    window.scrollTo({ top: 0, behavior: 'instant' });
                  }}
                  className={`flex items-center px-4 py-3 rounded-xl font-medium transition-colors ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* Mobile Service accordion */}
            <button
              onClick={() => setMobileServiceOpen(o => !o)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-colors ${
                isService ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <span>Service</span>
              <motion.span animate={{ rotate: mobileServiceOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={15} />
              </motion.span>
            </button>
            <AnimatePresence>
              {mobileServiceOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden pl-4"
                >
                  {SERVICE_ITEMS.map(item => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.tab}
                        to={item.to}
                        onClick={() => {
                          setMenuOpen(false);
                          setMobileServiceOpen(false);
                          window.scrollTo({ top: 0, behavior: 'instant' });
                        }}
                        className="flex items-center gap-3.5 px-3 py-3 rounded-2xl text-gray-700 hover:bg-blue-50/70 hover:text-blue-700 active:scale-[0.98] transition-all"
                      >
                        <div className={`w-10 h-10 rounded-2xl ${item.bg} ${item.border} border flex items-center justify-center shrink-0 shadow-2xs ${item.color}`}>
                          <Icon size={19} strokeWidth={2.3} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 leading-tight">{item.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-tight">{item.sub}</p>
                        </div>
                      </Link>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            <Link
              to="/lokasi"
              onClick={() => {
                setMenuOpen(false);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              className="flex items-center justify-center mt-3 py-3 min-h-[46px] bg-blue-600 text-white rounded-xl font-semibold text-sm active:scale-[0.98]"
            >
              Hubungi Kami
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <AdminPinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => navigate('/admin')}
      />
    </motion.header>
  );
}
