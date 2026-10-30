import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';
import { DATABASE_URL } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.resolve(__dirname, 'auth_info');

const sql = neon(DATABASE_URL);
const KV_KEY = 'system:wa_bot_session';

/**
 * Menyimpan seluruh file session auth_info ke Neon PostgreSQL (app_kv)
 */
export async function syncAuthToDb() {
  try {
    if (!fs.existsSync(AUTH_DIR)) return;

    const files = fs.readdirSync(AUTH_DIR);
    if (!files.includes('creds.json')) return;

    const bundle = {};
    for (const f of files) {
      const fullPath = path.join(AUTH_DIR, f);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        bundle[f] = fs.readFileSync(fullPath).toString('base64');
      }
    }

    const payload = JSON.stringify({
      savedAt: new Date().toISOString(),
      fileCount: Object.keys(bundle).length,
      files: bundle
    });

    await sql`
      INSERT INTO app_kv (key, value, updated_at)
      VALUES (${KV_KEY}, ${payload}::jsonb, now())
      ON CONFLICT (key) DO UPDATE 
      SET value = EXCLUDED.value, updated_at = now()
    `;

    console.log(`☁️ [CLOUD SYNC] Sesi WhatsApp (${Object.keys(bundle).length} keys) berhasil disimpan ke Database Neon.`);
  } catch (err) {
    console.error('Gagal menyinkronkan sesi ke database:', err.message);
  }
}

/**
 * Mengambil session auth dari Neon PostgreSQL jika auth_info kosong (misal di Railway/Cloud)
 */
export async function restoreAuthFromDb() {
  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const hasCreds = fs.existsSync(path.join(AUTH_DIR, 'creds.json'));
    if (hasCreds) {
      console.log('📁 [LOCAL AUTH] File sesi lokal ditemukan di auth_info.');
      return true;
    }

    console.log('🔍 [CLOUD SYNC] auth_info lokal kosong, memeriksa sesi di Database Neon...');
    const rows = await sql`
      SELECT value FROM app_kv WHERE key = ${KV_KEY} LIMIT 1
    `;

    if (!rows || rows.length === 0 || !rows[0].value?.files) {
      console.log('ℹ️ Belum ada sesi WhatsApp tersimpan di database Neon. QR Code akan digenerate.');
      return false;
    }

    const bundle = rows[0].value.files;
    let restoredCount = 0;
    for (const [filename, base64Str] of Object.entries(bundle)) {
      const destPath = path.join(AUTH_DIR, filename);
      fs.writeFileSync(destPath, Buffer.from(base64Str, 'base64'));
      restoredCount++;
    }

    console.log(`✅ [CLOUD SYNC] Berhasil memulihkan ${restoredCount} file sesi WhatsApp dari Database Neon! Tidak perlu scan QR ulang.`);
    return true;
  } catch (err) {
    console.error('Gagal memulihkan sesi dari database:', err.message);
    return false;
  }
}
