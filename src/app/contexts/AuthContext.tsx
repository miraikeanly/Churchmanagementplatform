import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { safeLocalStorage } from '../../lib/storage';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions?: any;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; status?: string }>;
  signInWithGoogle: (credential: string) => Promise<{ success: boolean; error?: string; status?: string }>;
  signUp: (data: { email: string; password: string; name: string; accountType?: 'jemaat' }) => Promise<{ success: boolean; error?: string; message?: string; status?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_USER_KEY = 'gjt_auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = safeLocalStorage.getItem(AUTH_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  // If user was recovered from cache, don't show full-page loading blocker
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      return !safeLocalStorage.getItem(AUTH_USER_KEY);
    } catch {
      return true;
    }
  });

  const refreshSession = async () => {
    try {
      const res = await api.get('/api/auth/me');
      if (res.success && res.user) {
        safeLocalStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
        setUser(prev => {
          if (!prev) return res.user;
          // Shallow/json check to prevent changing object reference when data is identical
          if (JSON.stringify(prev) === JSON.stringify(res.user)) {
            return prev;
          }
          return res.user;
        });
      } else if (res.status === 401 || res.status === 403 || res.error === 'Unauthorized') {
        safeLocalStorage.removeItem(AUTH_USER_KEY);
        safeLocalStorage.removeItem('gjt_session_token');
        setUser(null);
      }
    } catch (e) {
      // Network hiccup should not log out user immediately if offline/slow
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await api.post('/api/auth/login', { email, password });
      if (res.success) {
        if (res.token) safeLocalStorage.setItem('gjt_session_token', res.token);
        if (res.user) safeLocalStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
        setUser(res.user);
        return { success: true };
      }
      return { success: false, error: res.message || 'Login failed', status: res.status };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const signInWithGoogle = async (credential: string) => {
    try {
      const res = await api.post('/api/auth/google', { credential });
      if (res.success) {
        if (res.token) safeLocalStorage.setItem('gjt_session_token', res.token);
        if (res.user) safeLocalStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
        setUser(res.user);
        return { success: true };
      }
      return { success: false, error: res.message || 'Google login failed', status: res.status };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const signUp = async (data: { email: string; password: string; name: string; accountType?: 'jemaat'; pin?: string }) => {
    try {
      const res = await api.post('/api/auth/register', data);
      if (res.success) {
        if (res.user.status === 'approved') {
          // Approved instantly (allowlist / website account): registering issues no session, so sign in now.
          await signIn(data.email, data.password);
        }
        return { success: true, status: res.user.status };
      }
      return { success: false, error: res.message };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (e) {}
    safeLocalStorage.removeItem('gjt_session_token');
    safeLocalStorage.removeItem(AUTH_USER_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken: safeLocalStorage.getItem('gjt_session_token'), loading, signIn, signInWithGoogle, signUp, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
