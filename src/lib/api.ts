import { safeLocalStorage } from './storage';

// Unified frontend API client for Vercel/Neon backend

export function apiBase(): string {
  if (typeof window === 'undefined') return '';
  const isLocalOrNative =
    (window as any).Capacitor?.isNativePlatform?.() ||
    window.location.origin.includes('localhost') ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:';
  return isLocalOrNative ? 'https://www.gbijelambartimur.com' : '';
}

/** Unauthenticated JSON fetch for the public website. */
export async function publicGet(url: string) {
  const res = await fetch(`${apiBase()}${url}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
  return data;
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const isDev = import.meta.env.DEV;
  // In dev, assuming Vite proxies /api to the API server or we just hit it relatively
  // When running locally, Vite's proxy or direct `/api` is used.
  
  const token = safeLocalStorage.getItem('gjt_session_token');
  const isLocalOrNative = typeof window !== 'undefined' && (
    (window as any).Capacitor?.isNativePlatform?.() ||
    window.location.origin.includes('localhost') ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:'
  );
  const BASE_URL = isLocalOrNative ? 'https://www.gbijelambartimur.com' : '';
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (options.body instanceof FormData) {
    // Let the browser set Content-Type for FormData (multipart/form-data with boundary)
    delete (headers as any)['Content-Type'];
  }

  const response = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: isLocalOrNative ? 'include' : 'same-origin',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      // Unauthorized - session might be expired
      // AuthContext will handle state, but we could trigger an event here
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data;
}

export const api = {
  get: (url: string) => fetchWithAuth(url, { method: 'GET' }),
  post: (url: string, body?: any) => fetchWithAuth(url, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body)
  }),
  put: (url: string, body?: any) => fetchWithAuth(url, {
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body)
  }),
  del: (url: string) => fetchWithAuth(url, { method: 'DELETE' })
};
