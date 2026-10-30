import fs from 'fs';
import path from 'path';

// Load .env if present and not already loaded
if (!process.env.DATABASE_URL) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(path.resolve(process.cwd(), '.env'));
    } else {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const l of lines) {
          const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
          if (m && !process.env[m[1]]) {
            let val = (m[2] || '').trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            process.env[m[1]] = val;
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
}

// Allowed Moderator WhatsApp Number (Normalized to 628...)
export const ALLOWED_MODERATOR_NUMBER = '6287877661161';

// Komisi friendly names
export const KOMISI_MAP = {
  'sekolah-minggu': 'Sekolah Minggu',
  'teens': 'Komisi Remaja (Teens)',
  'vessel': 'Komisi Pemuda (Vessel/Youth)',
  'wbi': 'Komisi Wanita (WBI)',
  'kompas': 'Komisi Pria (Kompas)',
  'kowari': 'Komisi Dewasa Muda (Kowari)',
  'koemas': 'Komisi Lansia (Koemas)'
};

export const DATABASE_URL = process.env.DATABASE_URL;

// Function to normalize any incoming phone number to international 62 format
export function normalizePhone(raw) {
  if (!raw) return '';
  let cleaned = String(raw).replace(/@s\.whatsapp\.net/g, '').replace(/@c\.us/g, '').replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  return cleaned;
}

export function isAuthorizedModerator(senderJid) {
  const norm = normalizePhone(senderJid);
  return norm === ALLOWED_MODERATOR_NUMBER;
}
