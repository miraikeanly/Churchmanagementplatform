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

export const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_MrsRLhB3Zmy5@ep-weathered-math-b48091qo-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

// Function to normalize any incoming phone number to international 62 format
export function normalizePhone(raw) {
  if (!raw) return '';
  let cleaned = String(raw).replace(/@s\.whatsapp\.net/g, '').replace(/@c\.us/g, '').replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  return cleaned;
}

export const ALLOWED_MODERATOR_LID = '114426619383825';

export function isAuthorizedModerator(senderJid) {
  const norm = normalizePhone(senderJid);
  return norm === ALLOWED_MODERATOR_NUMBER;
}

/**
 * Memeriksa apakah pesan ini berada di ruang chat "Message yourself" (Diri Sendiri).
 * Jika pesan datang dari chat teman, keluarga, atau orang lain, fungsi ini return FALSE
 * dan bot WAJIB diam (silent) tanpa membalas apapun.
 */
export function isSelfChatOrBotChannel(remoteJid, sock) {
  if (!remoteJid || remoteJid.includes('@g.us')) return false;

  const cleanRemote = remoteJid.split(':')[0].split('@')[0];
  const myLid = sock?.user?.lid ? sock.user.lid.split(':')[0].split('@')[0] : ALLOWED_MODERATOR_LID;
  const myPhone = sock?.user?.id ? normalizePhone(sock.user.id) : ALLOWED_MODERATOR_NUMBER;

  // Hanya izinkan jika chat tersebut adalah chat ke akun sendiri (LID sendiri atau Nomor sendiri)
  if (cleanRemote === myLid || cleanRemote === ALLOWED_MODERATOR_LID) {
    return true;
  }

  const normRemote = normalizePhone(remoteJid);
  if (normRemote === myPhone || normRemote === ALLOWED_MODERATOR_NUMBER) {
    return true;
  }

  return false;
}
