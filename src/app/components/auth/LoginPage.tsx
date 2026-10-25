import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Clock, Eye, EyeOff } from 'lucide-react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import AdminAuthShell from './AdminAuthShell';
import { safeLocalStorage } from '../../../lib/storage';

interface NativeGoogleAuthPlugin {
  signIn(options?: { clientId?: string }): Promise<{ credential: string; email?: string; name?: string }>;
}

let NativeGoogleAuth: NativeGoogleAuthPlugin | null = null;
try {
  NativeGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>('NativeGoogleAuth');
} catch (e) {
  // Plugin not available or running on web
}

export default function LoginPage({ onSwitchToSignup }: { onSwitchToSignup?: () => void }) {
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
  const { signIn, signInWithGoogle } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const isNative = typeof window !== 'undefined' && (
    (window as any).Capacitor?.isNativePlatform?.() ||
    window.location.origin.includes('localhost') ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:'
  );

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '647511928995-cp3lvq3pap1pg1am24qfouenodnuh1ne.apps.googleusercontent.com';

  useEffect(() => {
    // Only load web GIS script if running on browser (not in native app)
    if (isNative) return;

    let isMounted = true;

    const initGoogleButton = () => {
      try {
        // @ts-ignore
        if (window.google?.accounts?.id && googleButtonRef.current && isMounted) {
          // @ts-ignore
          window.google.accounts.id.initialize({
            // @ts-ignore
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse
          });
          // @ts-ignore
          window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: 'signin_with',
            shape: 'rectangular',
          });
        }
      } catch (err) {
        console.warn('Google Identity Services button init error:', err);
      }
    };

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
      console.warn('Failed to load Google Identity Services script');
    };
    document.body.appendChild(script);
    return () => {
      isMounted = false;
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [isNative]);

  const handleNativeGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await NativeGoogleAuth.signIn({
        clientId: GOOGLE_CLIENT_ID
      });
      if (res && res.credential) {
        await handleGoogleCredentialResponse({ credential: res.credential });
      } else {
        setError('Google Sign-In tidak mengembalikan kredensial.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Native Google Sign-In error:', err);
      const errMsg = err.message || 'Gagal login dengan Google';
      setError(errMsg);
      setLoading(false);
    }
  };

  const handleGoogleCredentialResponse = async (response: any) => {
    setError('');
    setLoading(true);
    const result = await signInWithGoogle(response.credential);
    if (!result.success) {
      if (result.status === 'pending') {
        setPendingStatus(true);
      } else {
        const errMsg = result.error || 'Failed to sign in with Google';
        setError(errMsg);
      }
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setPendingStatus(false);

    if (rememberMe) {
      safeLocalStorage.setItem('gjt_admin_remember_email', email);
    } else {
      safeLocalStorage.removeItem('gjt_admin_remember_email');
    }

    const result = await signIn(email, password);
    if (!result.success) {
      if (result.status === 'pending') {
        setPendingStatus(true);
      } else {
        setError(result.error || 'Failed to sign in');
      }
    }
    setLoading(false);
  };

  if (pendingStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
            <Clock className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Akun Menunggu Persetujuan</h2>
            <p className="text-gray-600 mb-6">
              Akun Anda telah berhasil dibuat namun masih menunggu persetujuan dari Super Admin.
              Silakan hubungi administrator sistem untuk mengaktifkan akun Anda.
            </p>
            <button
              onClick={() => { setPendingStatus(false); setEmail(''); setPassword(''); }}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
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
      title="Masuk ke Dashboard"
      subtitle="Kelola jemaat, komsel, absensi, dan lainnya"
      footer={<>Belum punya akun admin?{' '}<button onClick={onSwitchToSignup} className="font-semibold text-white underline underline-offset-2">Daftar akun baru</button></>}
    >
        <div>
          <div className="mb-6">
            {isNative ? (
              <button
                type="button"
                onClick={handleNativeGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-white hover:bg-gray-50 active:bg-gray-100 text-sm font-medium text-gray-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>{loading ? 'Menghubungkan ke Google...' : 'Sign in with Google'}</span>
              </button>
            ) : (
              <div ref={googleButtonRef} className="w-full flex justify-center"></div>
            )}
          </div>
          
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Atau masuk dengan email</span>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

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
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 hover:bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400 text-sm rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                  placeholder="nama@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 bg-gray-50/70 hover:bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400 text-sm rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                  placeholder="Masukkan password"
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

            <div className="flex items-center justify-between">
              <label className="flex items-center text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2">Ingat email & kredensial saya</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 rounded-xl shadow-lg shadow-blue-600/25 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition"
            >
              {loading ? 'Masuk...' : 'Masuk'}
            </button>
          </form>
        </div>
    </AdminAuthShell>
  );
}
