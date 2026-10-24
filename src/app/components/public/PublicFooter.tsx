import { Link } from 'react-router-dom';
import { MapPin, Phone } from 'lucide-react';
import { CHURCH } from '../../../lib/church';

const LINKS = [
  { to: '/', label: 'Beranda' },
  { to: '/tentang', label: 'Tentang' },
  { to: '/galeri', label: 'Galeri' },
  { to: '/lokasi', label: 'Lokasi' },
  { to: '/service', label: 'Program Ibadah' },
  { to: '/give', label: 'Persembahan' },
  { to: '/admin', label: 'Portal Admin' },
];

/** Shared footer for every public page. */
export default function PublicFooter() {
  return (
    <footer className="bg-gray-950 text-gray-400 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 pb-8 border-b border-gray-800">
          <div>
            <div className="text-white font-bold mb-1">{CHURCH.name}</div>
            <div className="text-gray-500 text-sm">{CHURCH.city}, Indonesia</div>
            <div className="text-gray-600 text-xs mt-1 max-w-xs">{CHURCH.address}</div>
            <div className="mt-3 flex flex-col gap-1 text-xs text-gray-400">
              <a href={`https://wa.me/${CHURCH.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
                <span className="text-gray-500">WhatsApp:</span> {CHURCH.whatsappDisplay}
              </a>
              <a href={`tel:${CHURCH.phoneRaw}`} className="hover:text-blue-400 transition-colors">
                <span className="text-gray-500">No Telp:</span> {CHURCH.phoneDisplay}
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-1 text-sm">
            {LINKS.map(l => (
              <Link key={l.to} to={l.to} className="hover:text-white transition-colors py-1">{l.label}</Link>
            ))}
          </div>
        </div>
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <p>© {new Date().getFullYear()} {CHURCH.name}. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {/* WhatsApp */}
            <a
              href={`https://wa.me/${CHURCH.whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2 rounded-full hover:scale-105 transition-all shadow-sm"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span>{CHURCH.whatsappDisplay}</span>
            </a>

            {/* Telp */}
            <a
              href={`tel:${CHURCH.phoneRaw}`}
              className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold px-3.5 py-2 rounded-full hover:scale-105 transition-all shadow-sm"
            >
              <Phone size={12} />
              <span>Telp: {CHURCH.phoneDisplay}</span>
            </a>

            {/* Instagram */}
            <a href={CHURCH.instagramUrl} target="_blank" rel="noopener noreferrer"
              className="bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 text-white text-xs font-semibold px-4 py-2 rounded-full hover:opacity-90 hover:scale-105 transition-all">
              {CHURCH.instagramHandle}
            </a>
            <a href={CHURCH.youtubeUrl} target="_blank" rel="noopener noreferrer"
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-full hover:scale-105 transition-all">
              YouTube
            </a>
            <a href={CHURCH.mapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold px-4 py-2 rounded-full transition-all">
              <MapPin size={12} />Google Maps
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
