import { motion } from 'motion/react';
import { MapPin, ArrowRight, Navigation, Phone } from 'lucide-react';
import PublicNavbar from '../components/public/PublicNavbar';
import { CHURCH } from '../../lib/church';
import PublicFooter from '../components/public/PublicFooter';

export default function LokasiPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <PublicNavbar />

      {/* Hero — minimal */}
      <section className="pt-28 pb-8 px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3"
        >
          Temukan Kami
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="text-3xl md:text-4xl font-bold text-gray-900 mb-2"
        >
          GBI Jelambar Timur
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-gray-500 text-base"
        >
          {CHURCH.address}
        </motion.p>
      </section>

      {/* Map — full width, tall */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        className="w-full relative group"
        style={{ height: '60vh', minHeight: 340, maxHeight: 560 }}
      >
        <iframe
          title="Lokasi GBI Jelambar Timur"
          src="https://maps.google.com/maps?q=Jl.+I+No.52,+RT.8/RW.6,+Pejagalan,+Kecamatan+Penjaringan,+Jkt+Utara&z=17&output=embed"
          width="100%"
          height="100%"
          style={{ border: 0, display: 'block' }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />

        {/* Floating open-in-maps CTA button */}
        <a
          href={CHURCH.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 sm:gap-2.5 bg-white/95 hover:bg-white text-gray-900 font-bold text-xs sm:text-base px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-2xl sm:rounded-full shadow-xl border border-gray-200/80 hover:shadow-blue-500/25 hover:border-blue-500/50 transition-all duration-300 hover:scale-105 active:scale-95 group/btn cursor-pointer backdrop-blur-md whitespace-nowrap max-w-[92%]"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl sm:rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover/btn:bg-blue-600 group-hover/btn:text-white transition-colors duration-300 shrink-0">
            <Navigation size={15} />
          </div>
          <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent group-hover/btn:from-blue-600 group-hover/btn:to-indigo-600 transition-all sm:hidden">
            Google Maps
          </span>
          <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent group-hover/btn:from-blue-600 group-hover/btn:to-indigo-600 transition-all hidden sm:inline">
            Buka di Google Maps
          </span>
          <ArrowRight size={14} className="text-gray-400 group-hover/btn:text-blue-600 group-hover/btn:translate-x-1 transition-all shrink-0" />
        </a>
      </motion.section>

      {/* Info below map */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        {/* Alamat */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-gray-50 rounded-2xl p-5 sm:p-6 border border-gray-100 mb-4"
        >
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900">Alamat</h3>
              <p className="text-gray-600 text-sm break-words leading-relaxed">{CHURCH.address}</p>
            </div>
            <ArrowRight size={18} className="text-gray-300 ml-auto shrink-0 mt-1 hidden sm:block" />
          </div>
        </motion.div>

        {/* Social / contact link cards */}
        <div className="space-y-3">

          {/* WhatsApp */}
          <motion.a
            href={`https://wa.me/${CHURCH.whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="group flex items-center gap-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl p-5 border border-emerald-100 hover:shadow-md transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{CHURCH.whatsappDisplay}</h3>
              <p className="text-gray-500 text-sm">Nomor WhatsApp yang bisa dihubungi • Chat langsung tim gereja</p>
            </div>
            <ArrowRight size={18} className="text-emerald-500 ml-auto group-hover:translate-x-1 transition-transform" />
          </motion.a>

          {/* Telepon */}
          <motion.a
            href={`tel:${CHURCH.phoneRaw}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.39 }}
            className="group flex items-center gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 hover:shadow-md transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
              <Phone size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">No Telp: {CHURCH.phoneDisplay}</h3>
              <p className="text-gray-500 text-sm">Telepon sekretariat & layanan jemaat GBI Jelambar Timur</p>
            </div>
            <ArrowRight size={18} className="text-blue-500 ml-auto group-hover:translate-x-1 transition-transform" />
          </motion.a>

          {/* YouTube */}
          <motion.a
            href={CHURCH.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.42 }}
            className="group flex items-center gap-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl p-5 border border-red-100 hover:shadow-md transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900">YouTube GBI Jeltim</h3>
              <p className="text-gray-500 text-sm">Tonton ibadah & khotbah terbaru kapan aja dan di mana aja</p>
            </div>
            <ArrowRight size={18} className="text-red-400 ml-auto group-hover:translate-x-1 transition-transform" />
          </motion.a>

          {/* Instagram */}
          <motion.a
            href={CHURCH.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.48 }}
            className="group flex items-center gap-4 bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl p-5 border border-pink-100 hover:shadow-md transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{CHURCH.instagramHandle}</h3>
              <p className="text-gray-500 text-sm">Follow Instagram kami untuk update ibadah, kegiatan, dan info terbaru</p>
            </div>
            <ArrowRight size={18} className="text-pink-400 ml-auto group-hover:translate-x-1 transition-transform" />
          </motion.a>

        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
