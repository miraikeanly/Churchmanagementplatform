import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Phone, Lock, ExternalLink } from 'lucide-react';
import { CHURCH } from '../../../lib/church';
import AdminPinModal from '../auth/AdminPinModal';
import { safeSessionStorage } from '../../../lib/storage';

const LINKS = [
  { to: '/', label: 'Beranda' },
  { to: '/tentang', label: 'Tentang' },
  { to: '/galeri', label: 'Galeri' },
  { to: '/lokasi', label: 'Lokasi' },
  { to: '/service', label: 'Program Ibadah' },
  { to: '/give', label: 'Persembahan' },
];

/** Shared footer for every public page. */
export default function PublicFooter() {
  const [showPinModal, setShowPinModal] = useState(false);
  const navigate = useNavigate();

  const handleOpenAdmin = () => {
    const isUnlocked = safeSessionStorage.getItem('gjt_admin_portal_unlocked') === 'true';
    if (isUnlocked) {
      navigate('/admin');
    } else {
      setShowPinModal(true);
    }
  };

  return (
    <footer className="bg-slate-950 text-slate-400 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 pb-8 border-b border-slate-800/60">
          {/* Church info */}
          <div>
            <div className="text-white font-bold text-sm mb-1">{CHURCH.name}</div>
            <div className="text-slate-500 text-xs">{CHURCH.city}, Indonesia</div>
            <div className="text-slate-600 text-xs mt-1 max-w-xs leading-relaxed">{CHURCH.address}</div>
            <div className="mt-4 flex flex-col gap-1.5 text-xs">
              <a href={`https://wa.me/${CHURCH.whatsappNumber}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors">
                <span className="text-slate-600">WhatsApp:</span> {CHURCH.whatsappDisplay}
              </a>
              <a href={`tel:${CHURCH.phoneRaw}`}
                className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors">
                <span className="text-slate-600">No Telp:</span> {CHURCH.phoneDisplay}
              </a>
            </div>
          </div>

          {/* Nav links */}
          <div className="grid grid-cols-2 gap-x-12 gap-y-1 text-sm">
            {LINKS.map(l => (
              <Link key={l.to} to={l.to} className="text-slate-400 hover:text-white transition-colors py-1">{l.label}</Link>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <p>© {new Date().getFullYear()} {CHURCH.name}. All rights reserved.</p>
            {/* Very discreet admin lock trigger */}
            <button
              type="button"
              onClick={handleOpenAdmin}
              className="text-slate-800 hover:text-slate-600 transition-colors p-1 rounded cursor-pointer opacity-60 hover:opacity-100"
              title=""
              aria-label="System"
            >
              <Lock size={12} />
            </button>
          </div>

          {/* Social icon buttons — simple, monochrome style */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* WhatsApp */}
            <a
              href={`https://wa.me/${CHURCH.whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp"
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all duration-200"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </a>

            {/* Phone */}
            <a
              href={`tel:${CHURCH.phoneRaw}`}
              title="Telepon"
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all duration-200"
            >
              <Phone size={14} />
            </a>

            {/* Instagram */}
            <a
              href={CHURCH.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={CHURCH.instagramHandle}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all duration-200"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>

            {/* YouTube */}
            <a
              href={CHURCH.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="YouTube"
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all duration-200"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>

            {/* Google Maps */}
            <a
              href={CHURCH.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Google Maps"
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all duration-200"
            >
              <MapPin size={14} />
            </a>
          </div>
        </div>
      </div>
      <AdminPinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => navigate('/admin')}
      />
    </footer>
  );
}
