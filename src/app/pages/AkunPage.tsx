import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Loader2, LogOut, LayoutDashboard } from 'lucide-react';
import PublicNavbar from '../components/public/PublicNavbar';
import PublicFooter from '../components/public/PublicFooter';
import { useAuth } from '../contexts/AuthContext';
import AdminPinModal from '../components/auth/AdminPinModal';

export default function AkunPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [showPinModal, setShowPinModal] = useState(false);

  useEffect(() => {
    // If not logged in and unlocked, auto redirect to admin portal
    const isUnlocked = typeof window !== 'undefined' && sessionStorage.getItem('gjt_admin_portal_unlocked') === 'true';
    if (!loading && !user && isUnlocked) {
      navigate('/admin', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleOpenAdmin = () => {
    const isUnlocked = typeof window !== 'undefined' && sessionStorage.getItem('gjt_admin_portal_unlocked') === 'true';
    if (isUnlocked) {
      navigate('/admin');
    } else {
      setShowPinModal(true);
    }
  };

  const isAdmin = user && user.role !== 'jemaat';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 relative overflow-hidden flex flex-col justify-between">
      <PublicNavbar />
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue-200/40 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -left-24 w-72 h-72 rounded-full bg-indigo-200/40 blur-3xl pointer-events-none" />

      <main className="relative max-w-md w-full mx-auto px-4 pt-32 pb-16">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : user ? (
          <div className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100 p-6 sm:p-8 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-3xl font-bold flex items-center justify-center shadow-lg">
              {user.name?.[0]?.toUpperCase()}
            </div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">Halo, {user.name}</h1>
            <p className="text-sm text-gray-500 break-all">{user.email}</p>

            <div className="mt-6 space-y-3">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-700 text-white text-sm font-semibold shadow-lg shadow-blue-700/20 hover:bg-blue-800 transition-all cursor-pointer"
                >
                  <LayoutDashboard size={18} /> Buka Dashboard Admin
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenAdmin}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-700 text-white text-sm font-semibold shadow-lg shadow-blue-700/20 hover:bg-blue-800 transition-all cursor-pointer"
                >
                  <ShieldCheck size={18} /> Masuk ke Portal Admin
                </button>
              )}
              <button
                type="button"
                onClick={signOut}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <LogOut size={16} /> Keluar
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100 p-6 sm:p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Portal Admin & Pelayan</h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Website ini merupakan media informasi publik untuk jemaat. Akses masuk dan pendaftaran akun dikhususkan bagi Pengurus dan Tim Pelayan Gereja.
            </p>

            <button
              type="button"
              onClick={handleOpenAdmin}
              className="mt-6 w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Masuk ke Portal Admin</span>
              <ArrowRight size={17} />
            </button>
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
