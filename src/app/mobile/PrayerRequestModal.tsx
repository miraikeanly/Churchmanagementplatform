import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Send, CheckCircle2, X, Lock, Users, Sparkles, MessageCircle } from 'lucide-react';
import { trackActivity } from '../../lib/auditLogger';
import { publicGet } from '../../lib/api';

interface PrayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

export default function PrayerRequestModal({ isOpen, onClose, userName = '' }: PrayerModalProps) {
  const [name, setName] = useState(userName);
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('Kesehatan');
  const [request, setRequest] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request.trim()) return;

    setSubmitting(true);
    try {
      // Kirim audit log dan simpan request doa
      await trackActivity(
        'PRAYER_REQUEST',
        'Pokok Doa',
        `Permohonan doa dari ${name || 'Jemaat Anonim'} [Kategori: ${category}]: "${request.slice(0, 60)}..."`
      );

      // WhatsApp link fallback ke Hamba Tuhan / Tim Doa jika ingin kirim langsung
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendViaWhatsApp = () => {
    const text = encodeURIComponent(
      `Shalom Tim Doa GBI Jelambar Timur,\n\nSaya ${name || 'Jemaat'} ingin memohon dukungan doa:\n*Kategori:* ${category}\n*Pokok Doa:* ${request}\n\nTerima kasih. Tuhan Yesus memberkati.`
    );
    window.open(`https://wa.me/6285775094388?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="w-full max-w-lg bg-gradient-to-b from-[#FAF8FF] to-[#F1ECFD] rounded-t-[36px] sm:rounded-[36px] p-6 shadow-2xl border border-white/80 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-violet-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white shadow-[0_8px_16px_rgba(244,63,94,0.3),inset_0_2px_4px_rgba(255,255,255,0.7)]">
              <Heart size={22} className="fill-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Pokok Doa Jemaat</h3>
              <p className="text-xs text-violet-600 font-medium">Tim Pastoral & Pendoa siap berdoa bagi Anda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-violet-100/70 hover:bg-violet-200 text-violet-700 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white mb-4 shadow-[0_12px_24px_rgba(16,185,129,0.35)]">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="text-xl font-bold text-slate-800">Pokok Doa Diterima</h4>
            <p className="text-sm text-slate-600 mt-2 max-w-xs">
              "Sebab di mana dua atau tiga orang berkumpul dalam Nama-Ku, di situ Aku ada di tengah-tengah mereka." — Mat 18:20
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full">
              <button
                onClick={handleSendViaWhatsApp}
                className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-[0_8px_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
              >
                <MessageCircle size={18} /> Chat Tim Doa via WA
              </button>
              <button
                onClick={() => { setSubmitted(false); setRequest(''); onClose(); }}
                className="py-3 px-5 rounded-2xl bg-violet-100 hover:bg-violet-200 text-violet-800 font-bold text-sm"
              >
                Selesai
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nama Pemohon (Opsional)</label>
              <input
                type="text"
                placeholder="Bisa dikosongkan jika anonim"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white border border-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Kategori Doa</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['Kesehatan', 'Keluarga', 'Pekerjaan', 'Rohani'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                      category === cat
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-[0_4px_12px_rgba(124,58,237,0.3)]'
                        : 'bg-white text-slate-600 border-violet-100 hover:bg-violet-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Isi Pokok Doa *</label>
              <textarea
                rows={4}
                required
                placeholder="Ceritakan beban atau pergumulan yang ingin kami doakan bersama..."
                value={request}
                onChange={e => setRequest(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white border border-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm shadow-xs resize-none"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-violet-100/60 border border-violet-200/80">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-violet-700" />
                <span className="text-xs font-medium text-slate-700">Kerahasiaan Terjamin Khusus Pendoa</span>
              </div>
              <span className="text-[11px] font-bold text-violet-800 bg-white px-2 py-0.5 rounded-full shadow-2xs">Rahasia</span>
            </div>

            <button
              type="submit"
              disabled={submitting || !request.trim()}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-indigo-700 text-white font-extrabold text-sm shadow-[0_12px_24px_rgba(109,74,219,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send size={16} />
              {submitting ? 'Mengirimkan...' : 'Kirim Pokok Doa'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
