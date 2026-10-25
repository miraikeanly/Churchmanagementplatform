import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, Mail, Lock, AlertCircle, Clock, Eye, EyeOff } from 'lucide-react';
import { registerPlugin } from '@capacitor/core';
import AdminAuthShell from './AdminAuthShell';
import { safeLocalStorage, safeSessionStorage } from '../../../lib/storage';

interface NativeGoogleAuthPlugin {
  signIn(options?: { clientId?: string }): Promise<{ credential: string; email?: string; name?: string }>;
}

let NativeGoogleAuth: NativeGoogleAuthPlugin | null = null;
try {
  NativeGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>('NativeGoogleAuth');
} catch (e) {
  // Plugin not available or web
}

export default function SignupPage({ onSwitchToLogin }: { onSwitchToLogin?: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => {
    return safeLocalStorage.getItem('gjt_admin_remember_email') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return !!safeLocalStorage.getItem('gjt_admin_remember_email');
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const isNative = typeof window !== 'undefined' && (
    (window as any).Capacitor?.isNativePlatform?.() ||
    window.location.origin.includes('localhost') ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:'
  );

  useEffect(() => {
    if (isNative) return;

    let isMounted = true;

    const initGoogleButton = () => {
      try {
        // @ts-ignore
        if (window.google?.accounts?.id && googleButtonRef.current && isMounted) {
          // @ts-ignore
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '647511928995-cp3lvq3pap1pg1am24qfouenodnuh1ne.apps.googleusercontent.com',
            callback: handleGoogleCredentialResponse,
          });
          // @ts-ignore
          window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: 'outline',
            size: 'large',
            width: 340,
            text: 'signup_with',
            shape: 'rectangular',
          });
        }
      } catch (err) {
        console.warn('Google GIS button init error in signup:', err);
      }
    };

    const loadGoogleScript = () => {
      if ((window as any).google?.accounts?.id && googleButtonRef.current) {
        initGoogleButton();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initGoogleButton();
      };
      script.onerror = () => {
        console.warn('Failed to load Google GIS script in signup');
      };
      document.body.appendChild(script);
      return () => {
        isMounted = false;
        if (script.parentNode) script.parentNode.removeChild(script);
      };
    };

    return loadGoogleScript();
  }, [isNative]);

  const handleNativeGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await NativeGoogleAuth.signIn({
        clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      });
      if (res && res.credential) {
        await handleGoogleCredentialResponse({ credential: res.credential });
      } else {
        setError('Google Sign-In tidak mengembalikan kredensial.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Native Google Sign-In error:', err);
      setError(err.message || 'Gagal mendaftar dengan Google');
      setLoading(false);
    }
  };

  const handleGoogleCredentialResponse = async (response: any) => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithGoogle(response.credential);
      if (!result.success) {
        if (result.status === 'pending') {
          setPendingStatus(true);
        } else {
          setError(result.error || 'Gagal mendaftar dengan Google');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem saat mendaftar');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (rememberMe) {
      safeLocalStorage.setItem('gjt_admin_remember_email', email);
    } else {
      safeLocalStorage.removeItem('gjt_admin_remember_email');
    }

    const pin = safeSessionStorage.getItem('gjt_admin_portal_pin') || undefined;
    const result = await signUp({ email, password, name, pin });
    if (result.success) {
      if (result.status !== 'approved') {
        setPendingStatus(true);
      }
    } else {
      setError(result.error || 'Gagal mendaftar');
    }
    setLoading(false);
  };

  if (pendingStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-xl rounded-2xl text-center border border-gray-100">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <Clock className="h-8 w-8 text-amber-500 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Pendaftaran Berhasil!</h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold mb-4">
              Menunggu Persetujuan Super Admin
            </div>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              Akun Anda telah dibuat namun masih menunggu persetujuan dari Super Admin.
              Silakan hubungi administrator sistem untuk mengaktifkan akun Anda.
            </p>
            <button
              onClick={onSwitchToLogin}
              className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all cursor-pointer"
            >
              Kembali ke Halaman Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminAuthShell
      title="Daftar Akun Admin"
      subtitle="Akun baru perlu disetujui Super Admin"
      footer={<>Sudah punya akun admin?{' '}<button onClick={onSwitchToLogin} className="font-semibold text-white underline underline-offset-2">Masuk di sini</button></>}
    >
      <div className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-start shadow-xs">
            <AlertCircle className="w-5 h-5 mr-2.5 flex-shrink-0 mt-0.5 text-red-500" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Google Sign-In Button */}
        <div>
          {isNative ? (
            <button
              type="button"
              onClick={handleNativeGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 active:bg-gray-100 text-sm font-semibold text-gray-700 transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{loading ? 'Menghubungkan ke Google...' : 'Daftar dengan Google'}</span>
            </button>
          ) : (
            <div ref={googleButtonRef} className="w-full flex justify-center min-h-[44px]"></div>
          )}
        </div>

        {/* Divider */}
        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider font-medium">
            <span className="px-3 bg-white text-gray-400">Atau daftar dengan email</span>
          </div>
        </div>

        {/* Form Email & Password */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Input Nama Lengkap */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Lengkap</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <User size={16} />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama Lengkap Anda"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 hover:bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400 text-sm rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Input Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Mail size={16} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 hover:bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400 text-sm rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Input Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full pl-10 pr-11 py-2.5 bg-gray-50/70 hover:bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400 text-sm rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 font-medium">Ingat email & kredensial saya</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 px-4 rounded-xl shadow-md text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition cursor-pointer"
          >
            {loading ? 'Mendaftarkan Akun...' : 'Daftar Akun Admin'}
          </button>
        </form>
      </div>
    </AdminAuthShell>
  );
}
