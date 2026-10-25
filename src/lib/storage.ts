/**
 * Safe wrapper for localStorage and sessionStorage to prevent crashes on mobile browsers
 * (e.g. iOS Safari private mode, restricted webviews, or cookies disabled)
 * where accessing storage directly throws a DOMException: SecurityError.
 */

const memoryStorage = new Map<string, string>();

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      // Fallback to in-memory store
    }
    return memoryStorage.get(`local:${key}`) ?? null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      // Fallback
    }
    memoryStorage.set(`local:${key}`, value);
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      // Fallback
    }
    memoryStorage.delete(`local:${key}`);
  }
};

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(key);
      }
    } catch (e) {
      // Fallback to in-memory store
    }
    return memoryStorage.get(`session:${key}`) ?? null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      // Fallback
    }
    memoryStorage.set(`session:${key}`, value);
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch (e) {
      // Fallback
    }
    memoryStorage.delete(`session:${key}`);
  }
};
