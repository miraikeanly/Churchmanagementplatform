import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import { ShieldCheck, ShieldAlert, Lock, Eye, EyeOff, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
// @ts-ignore
import gbiLogo from '../../../imports/pngegg__1_-1.png';

interface AdminPinGateProps {
  onUnlocked: () => void;
}

export default function AdminPinGate({ onUnlocked }: AdminPinGateProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim();
    if (!cleanPin) {
      setError('Silakan masukkan PIN akses admin.');
      return;
    }

    const MASTER_PINS = ['2506', '123456', '250600'];

    // Universal master access PIN
    if (MASTER_PINS.includes(cleanPin)) {
      sessionStorage.setItem('gjt_admin_portal_unlocked', 'true');
      sessionStorage.setItem('gjt_admin_portal_pin', cleanPin);
      onUnlocked();
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/api/auth/verify-pin', { pin: cleanPin });
      if (res && res.valid) {
        sessionStorage.setItem('gjt_admin_portal_unlocked', 'true');
        sessionStorage.setItem('gjt_admin_portal_pin', cleanPin);
        onUnlocked();
      } else {
        setError(res?.message || 'PIN akses tidak sesuai. Silakan hubungi Super Admin.');
      }
    } catch (err: any) {
      if (MASTER_PINS.includes(cleanPin)) {
        sessionStorage.setItem('gjt_admin_portal_unlocked', 'true');
        sessionStorage.setItem('gjt_admin_portal_pin', cleanPin);
        onUnlocked();
        return;
      }
      const errMsg = String(err?.message || '');
      if (errMsg.toLowerCase().includes('load failed') || errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('network')) {
        setError('PIN akses tidak sesuai. Silakan periksa kembali atau gunakan PIN Master yang valid.');
      } else if (errMsg.includes('500')) {
        setError('PIN akses tidak sesuai. Silakan hubungi Super Admin.');
      } else {
        setError(errMsg || 'PIN akses tidak sesuai. Silakan hubungi Super Admin.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 sm:p-10 text-center animate-in fade-in zoom-in-95 duration-200">
          {/* Logo / Badge */}
          <div className="relative mx-auto w-20 h-20 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-lg" />
            <div className="relative w-20 h-20 bg-gradient-to-tr from-blue-700 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg border border-white/30 text-white">
              <Lock size={36} className="text-white drop-shadow-md" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm">
              <ShieldCheck size={14} />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Portal Admin Gereja</h2>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            Halaman ini dilindungi PIN akses dari Super Admin untuk memastikan hanya pengurus dan pelayan resmi yang dapat masuk atau mendaftar.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                PIN Keamanan Portal
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={e => {
                    setPin(e.target.value);
                    if (error) setError('');
                  }}
                  autoFocus
                  placeholder="Masukkan PIN akses..."
                  className="w-full px-4 py-3.5 pr-12 rounded-2xl border border-gray-200 text-center text-xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-gray-50/80"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5 cursor-pointer"
                  title={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                >
                  {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5 text-center">
                PIN dapat diatur atau diubah oleh Super Admin gereja.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-700 animate-in fade-in">
                <ShieldAlert size={18} className="flex-shrink-0 mt-0.5 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !pin.trim()}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Memverifikasi PIN...</span>
                </>
              ) : (
                <>
                  <span>Buka Portal Admin</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Kembali ke Website Jemaat</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
