import { api } from './api';

export const EdgeKV = {
  from(tableName: string) {
    return {
      select(columns: string) {
        return {
          like: async (col: string, prefix: string) => {
            try {
              const res = await api.get(`/api/kv?pattern=${encodeURIComponent(prefix)}`);
              return { data: res.data, error: null };
            } catch (error: any) {
              return { data: null, error };
            }
          },
          // Sync on purpose: callers chain .eq(...).maybeSingle() without awaiting in between.
          eq: (col: string, key: string) => {
            const fetchSingle = async () => {
              try {
                const value = await api.get(`/api/kv/${encodeURIComponent(key)}`);
                // If the key doesn't exist, our API might return null or 404
                if (value === null || value === undefined) {
                  return { data: null, error: null };
                }
                return { data: { key, value }, error: null };
              } catch (error: any) {
                // Return null data on error (e.g. 404 not found)
                return { data: null, error: null };
              }
            };
            return {
              maybeSingle: fetchSingle,
              single: fetchSingle
            };
          }
        };
      },
      update: (payload: { value: any }) => {
        return {
          eq: async (col: string, key: string) => {
            try {
              await api.put(`/api/kv/${encodeURIComponent(key)}`, payload.value);
              return { error: null };
            } catch (error: any) {
              return { error };
            }
          }
        };
      },
      insert: async (payload: { key: string, value: any }) => {
        try {
          await api.put(`/api/kv/${encodeURIComponent(payload.key)}`, payload.value);
          return { error: null };
        } catch (error: any) {
          return { error };
        }
      },
      upsert: async (payload: { key: string, value: any }) => {
        try {
          await api.put(`/api/kv/${encodeURIComponent(payload.key)}`, payload.value);
          return { error: null };
        } catch (error: any) {
          return { error };
        }
      },
      delete: () => {
        return {
          eq: async (col: string, key: string) => {
            try {
              await api.del(`/api/kv/${encodeURIComponent(key)}`);
              return { error: null };
            } catch (error: any) {
              return { error };
            }
          }
        };
      }
    };
  }
};