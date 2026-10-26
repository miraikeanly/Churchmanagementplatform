import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginPage from "./components/auth/LoginPage";
import SignupPage from "./components/auth/SignupPage";
import SuperAdminDashboard from "./components/dashboard/SuperAdminDashboard";
import JemaatPage from "./pages/JemaatPage";
import TentangPage from "./pages/TentangPage";
import GaleriPage from "./pages/GaleriPage";
import LokasiPage from "./pages/LokasiPage";
import ServicePage from "./pages/ServicePage";
import AkunPage from "./pages/AkunPage";
import GivePage from "./pages/GivePage";
import NativeBackHandler from "./components/common/NativeBackHandler";
import AdminPinGate from "./components/auth/AdminPinGate";
import ScrollNavigation from "./components/common/ScrollNavigation";
import ScrollToTop from "./components/common/ScrollToTop";
import JemaatChatBot from "./components/public/JemaatChatBot";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { safeSessionStorage } from "../lib/storage";

// Protected Route — redirects to /login if not authenticated
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'jemaat') {
    return <Navigate to="/akun" replace />;
  }

  return <>{children}</>;
}

// Login/Signup route — redirects to /dashboard if already logged in, protected by PIN gate
function AdminRoute() {
  const { user } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return safeSessionStorage.getItem('gjt_admin_portal_unlocked') === 'true';
  });

  if (user) {
    return <Navigate to={user.role === 'jemaat' ? '/akun' : '/dashboard'} replace />;
  }

  if (!isUnlocked) {
    return <AdminPinGate onUnlocked={() => setIsUnlocked(true)} />;
  }

  return showSignup ? (
    <SignupPage onSwitchToLogin={() => setShowSignup(false)} />
  ) : (
    <LoginPage onSwitchToSignup={() => setShowSignup(true)} />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />
        <NativeBackHandler />
        <ScrollNavigation />
        <JemaatChatBot />
        <AuthProvider>
          <Routes>
            {/* Login */}
            <Route path="/login" element={<AdminRoute />} />
            <Route path="/admin" element={<AdminRoute />} />

            {/* Protected Admin / SuperAdmin Dashboard */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Public church website (jemaat) */}
            <Route path="/" element={<JemaatPage />} />
            <Route path="/jemaat" element={<JemaatPage />} />
            <Route path="/tentang" element={<TentangPage />} />
            <Route path="/galeri" element={<GaleriPage />} />
            <Route path="/lokasi" element={<LokasiPage />} />
            <Route path="/service" element={<ServicePage />} />
            <Route path="/give" element={<GivePage />} />
            <Route path="/persembahan" element={<GivePage />} />
            <Route path="/akun" element={<AkunPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}