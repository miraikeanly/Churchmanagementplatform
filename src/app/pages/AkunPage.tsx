import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Loader2, AlertCircle, LogOut, CalendarHeart, Images, Users, LayoutDashboard } from 'lucide-react';
import PublicNavbar from '../components/public/PublicNavbar';
import PublicFooter from '../components/public/PublicFooter';
import { useAuth } from '../contexts/AuthContext';
import AdminPinModal from '../components/auth/AdminPinModal';

type Mode = 'masuk' | 'daftar';

const input = 'w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition';

export default function AkunPage() {
  const { user, loading, signIn, signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('masuk');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'daftar' && password.length < 6) { setError('Password minimal 6 karakter'); return; }
    setBusy(true);
    try {
      if (mode === 'daftar') {
        const r = await signUp({ name: name.trim(), email: email.trim(), password, accountType: 'jemaat' });
        if (!r.success) { setError(r.error || 'Pendaftaran gagal'); return; }
      }
      const r = await signIn(email.trim(), password);
      if (!r.success) setError(r.error || 'Email atau password salah');
    } finally { setBusy(false); }
  };

  const isAdmin = user && user.role !== 'jemaat';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 relative overflow-hidden">
      <PublicNavbar />
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="absolute bottom-0 -left-24 w-72 h-72 rounded-full bg-indigo-200/40 blur-3xl" />

      <main className="relative max-w-md mx-auto px-4 pt-28 pb-16">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : user ? (
          <div className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100 p-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-3xl font-bold flex items-center justify-center shadow-lg">
              {user.name?.[0]?.toUpperCase()}
            </div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">Shalom, {user.name}!</h1>
            <p className="text-sm text-gray-500 break-all">{user.email}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                { to: '/give', label: 'Persembahan', icon: CalendarHeart, color: 'bg-blue-50 text-blue-600' },
                { to: '/service', label: 'Program Ibadah', icon: CalendarHeart, color: 'bg-rose-50 text-rose-600' },
                { to: '/galeri', label: 'Galeri', icon: Images, color: 'bg-amber-50 text-amber-600' },
                { to: '/tentang', label: 'Tim Kami', icon: Users, color: 'bg-emerald-50 text-emerald-600' },
              ].map(i => (
                <Link key={i.to} to={i.to} className="rounded-2xl border border-gray-100 p-3 hover:-translate-y-0.5 hover:shadow-md transition-all">
                  <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center ${i.color}`}><i.icon size={18} /></div>
                  <p className="text-[11px] font-semibold text-gray-700 mt-2 leading-tight">{i.label}</p>
                </Link>
              ))}
            </div>

            {isAdmin && (
              <button onClick={() => navigate('/dashboard')}
                className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-700 text-white text-sm font-semibold">
                <LayoutDashboard size={16} /> Buka Dashboard Admin
              </button>
            )}
            <button onClick={signOut}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">
              <LogOut size={16} /> Keluar
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100 p-6">
            <div className="text-center mb-5">
              <h1 className="text-2xl font-bold text-gray-900">{mode === 'masuk' ? 'Selamat datang kembali' : 'Bergabung bersama kami'}</h1>
              <p className="text-sm text-gray-500 mt-1">Akun jemaat GBI Jelambar Timur</p>
            </div>

            <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-2xl mb-5">
              {(['masuk', 'daftar'] as Mode[]).map(m => (
                <button key={m} type="button" onClick={() => { setMode(m); setError(''); }}
                  className={`py-2 rounded-xl text-sm font-semibold transition-all ${mode === m ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>
                  {m === 'masuk' ? 'Masuk' : 'Daftar'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === 'daftar' && (
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input required value={name} onChange={e => setName(e.target.value)} placeholder="Nama lengkap" className={input} />
                </div>
              )}
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className={input} />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className={input} />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />{error}
                </div>
              )}

              <button disabled={busy} type="submit"
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 hover:shadow-xl disabled:opacity-60 flex items-center justify-center gap-2">
                {busy && <Loader2 size={16} className="animate-spin" />}
                {mode === 'masuk' ? 'Masuk' : 'Buat Akun'}
              </button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-5">
              Admin gereja?{' '}
              <button
                type="button"
                onClick={() => {
                  const isUnlocked = typeof window !== 'undefined' && sessionStorage.getItem('gjt_admin_portal_unlocked') === 'true';
                  if (isUnlocked) {
                    navigate('/admin');
                  } else {
                    setShowPinModal(true);
                  }
                }}
                className="text-blue-600 font-semibold hover:underline cursor-pointer bg-transparent border-0 p-0"
              >
                Masuk ke portal admin
              </button>
            </p>
          </div>
        )}

        <AdminPinModal
          isOpen={showPinModal}
          onClose={() => setShowPinModal(false)}
          onSuccess={() => navigate('/admin')}
        />
      </main>
      <PublicFooter />
    </div>
  );
}
