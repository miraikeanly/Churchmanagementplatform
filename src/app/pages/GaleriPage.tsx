import { useState, useEffect } from 'react';
import { apiBase } from '../../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { FolderOpen, ImageIcon, ChevronLeft, ChevronRight, X, ZoomIn, Images } from 'lucide-react';
import PublicNavbar from '../components/public/PublicNavbar';
import PublicFooter from '../components/public/PublicFooter';

const API_URL = `${apiBase()}/api/content`;

interface Album {
  id: string;
  name: string;
  description: string;
  coverUrl: string | null;
  photoCount: number;
}

interface Photo {
  id: string;
  imageUrl: string | null;
  caption: string;
}

function Lightbox({ photos, index, onClose }: { photos: Photo[]; index: number; onClose: () => void }) {
  const [cur, setCur] = useState(index);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCur(c => (c + 1) % photos.length);
      if (e.key === 'ArrowLeft') setCur(c => (c - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [photos.length, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center touch-pan-y" onClick={onClose}
      onTouchStart={e => { (e.currentTarget as any)._x = e.touches[0].clientX; }}
      onTouchEnd={e => {
        const dx = e.changedTouches[0].clientX - ((e.currentTarget as any)._x ?? 0);
        if (Math.abs(dx) > 50) setCur(c => (dx < 0 ? (c + 1) % photos.length : (c - 1 + photos.length) % photos.length));
      }}>
      <button onClick={onClose} className="absolute top-5 right-5 text-white/70 hover:text-white z-10"><X size={30} /></button>
      {photos.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); setCur(c => (c - 1 + photos.length) % photos.length); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10">
            <ChevronLeft size={24} />
          </button>
          <button onClick={e => { e.stopPropagation(); setCur(c => (c + 1) % photos.length); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10">
            <ChevronRight size={24} />
          </button>
        </>
      )}
      <img src={photos[cur].imageUrl || ''} alt={photos[cur].caption} className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
      {photos[cur].caption && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white text-sm px-5 py-2 rounded-full max-w-xs text-center">{photos[cur].caption}</div>
      )}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/50 text-sm">{cur + 1} / {photos.length}</div>
    </div>
  );
}

export default function GaleriPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/gallery/albums`)
      .then(r => r.json())
      .then(d => { if (d.albums) setAlbums(d.albums); else setLoadError(true); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const openFolder = async (album: Album) => {
    setOpenAlbum(album);
    setPhotosLoading(true);
    try {
      const res = await fetch(`${API_URL}/gallery/albums/${album.id}/photos`);
      const d = await res.json();
      setPhotos(d.photos || []);
    } catch {}
    setPhotosLoading(false);
  };

  const closeFolder = () => { setOpenAlbum(null); setPhotos([]); setLightboxIdx(null); };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PublicNavbar />

      {/* Hero — clean, light */}
      <section className="pt-28 pb-10 px-4 sm:px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-cursive text-3xl sm:text-4xl text-blue-600 font-normal mb-1 drop-shadow-sm px-2 inline-block"
          style={{ fontFamily: 'Caveat, cursive' }}
        >
          Momen Bersama
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="text-3xl md:text-4xl font-display font-bold text-slate-900 tracking-tight mb-3"
        >
          Galeri Foto
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-slate-500 text-base max-w-md mx-auto"
        >
          Kenangan indah bersama keluarga besar GBI Jelambar Timur
        </motion.p>
      </section>

      {/* Content */}
      <section className="py-8 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">

          {/* Breadcrumb */}
          {openAlbum && (
            <div className="flex items-center gap-2 mb-8">
              <button onClick={closeFolder} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors">
                <ChevronLeft size={16} />Semua Album
              </button>
              <span className="text-slate-300">/</span>
              <span className="font-bold text-slate-900">{openAlbum.name}</span>
              {openAlbum.description && <span className="text-slate-500 text-sm">— {openAlbum.description}</span>}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 animate-pulse">
                  <div className="aspect-square bg-slate-100" />
                  <div className="p-3.5 space-y-2">
                    <div className="h-3.5 bg-slate-100 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-50 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && !openAlbum && loadError && (
            <div className="text-center py-16 text-slate-500">
              <p className="font-medium">Galeri belum bisa dimuat.</p>
              <button onClick={() => location.reload()} className="mt-3 text-blue-600 font-semibold text-sm">Coba lagi</button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !openAlbum && !loadError && albums.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <Images size={28} className="text-slate-400" />
              </div>
              <p className="font-medium text-lg text-slate-500">Belum ada album galeri</p>
              <p className="text-sm mt-1 text-slate-400">Foto-foto kegiatan akan segera hadir</p>
            </div>
          )}

          {/* Albums grid */}
          {!loading && !openAlbum && !loadError && albums.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {albums.map((album, i) => (
                <motion.div
                  key={album.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                  onClick={() => openFolder(album)}
                  className="group cursor-pointer bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className="aspect-square relative overflow-hidden bg-slate-100">
                    {album.coverUrl ? (
                      <img src={album.coverUrl} alt={album.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FolderOpen size={36} className="text-slate-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-300 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-center">
                        <ZoomIn size={24} className="mx-auto mb-1" />
                        <span className="text-xs font-semibold">Buka Album</span>
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ImageIcon size={10} />{album.photoCount} foto
                    </div>
                  </div>
                  <div className="p-3.5">
                    <p className="font-semibold text-slate-900 text-sm truncate">{album.name}</p>
                    {album.description && <p className="text-xs text-slate-400 truncate mt-0.5">{album.description}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Photos grid */}
          {!loading && openAlbum && (
            photosLoading ? (
              <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="break-inside-avoid rounded-xl overflow-hidden bg-slate-100 animate-pulse" style={{ height: `${160 + (i % 3) * 60}px` }} />
                ))}
              </div>
            ) : photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                  <ImageIcon size={24} className="text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">Belum ada foto di album ini</p>
              </div>
            ) : (
              <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
                {photos.map((photo, idx) => (
                  <motion.div
                    key={photo.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: idx * 0.04 }}
                    onClick={() => setLightboxIdx(idx)}
                    className="group relative break-inside-avoid rounded-xl overflow-hidden cursor-zoom-in bg-slate-100 border border-slate-200/80 shadow-sm hover:shadow-md transition-all"
                  >
                    {photo.imageUrl ? (
                      <img
                        src={photo.imageUrl}
                        alt={photo.caption || 'foto'}
                        loading={idx < 6 ? 'eager' : 'lazy'}
                        decoding="async"
                        fetchPriority={idx === 0 ? 'high' : 'auto'}
                        className="w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="aspect-square flex items-center justify-center text-slate-300"><ImageIcon size={24} /></div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                      <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {photo.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs">{photo.caption}</p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )
          )}
        </div>
      </section>

      {lightboxIdx !== null && photos.length > 0 && (
        <Lightbox photos={photos} index={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}

      <PublicFooter />
    </div>
  );
}
