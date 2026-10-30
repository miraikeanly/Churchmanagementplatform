import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

import {
  ALLOWED_MODERATOR_NUMBER,
  isAuthorizedModerator,
  isSelfChatOrBotChannel,
  normalizePhone
} from './config.js';
import {
  getDailySummary,
  getRecentGeneralSessions,
  getGeneralAttendanceDetail,
  getRecentKomisiSessions,
  getRecentAuditLogs,
  getSystemHealth,
  getNewAlerts
} from './db-queries.js';
import {
  formatMainMenu,
  formatDailySummary,
  formatGeneralSessions,
  formatGeneralDetail,
  formatKomisiSessions,
  formatAuditLogs,
  formatSystemHealth,
  formatAlertNotification
} from './message-formatter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auth folder to store WhatsApp session keys
const AUTH_DIR = path.resolve(__dirname, 'auth_info');
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// State
let sock = null;
let lastSeenAlertId = 0n;
let isPushAlertEnabled = true;
const botSentMsgIds = new Set();

async function sendBotMessage(jid, content) {
  if (!sock) return;
  const sent = await sock.sendMessage(jid, content);
  if (sent?.key?.id) {
    botSentMsgIds.add(sent.key.id);
    if (botSentMsgIds.size > 300) {
      const first = botSentMsgIds.values().next().value;
      botSentMsgIds.delete(first);
    }
  }
  return sent;
}

import { restoreAuthFromDb, syncAuthToDb } from './auth-sync.js';

let syncTimeout = null;
function debouncedSyncAuth() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncAuthToDb().catch(console.error);
  }, 10000);
}

/**
 * Start WhatsApp Socket Connection
 */
async function startBot() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 GBI JELAMBAR TIMUR - WHATSAPP MODERATOR BOT');
  console.log(`🔒 Moderator Resmi: +${ALLOWED_MODERATOR_NUMBER}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Pulihkan auth dari Neon DB jika di server cloud (Railway / Render)
  await restoreAuthFromDb();

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['GBI Jelambar Timur Bot', 'Safari', '3.0']
  });

  sock.ev.on('creds.update', async () => {
    await saveCreds();
    debouncedSyncAuth();
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📲 SILAKAN SCAN QR CODE INI DI WHATSAPP ANDA:');
      console.log('Buka WhatsApp di HP > Perangkat Tertaut > Tautkan Perangkat:\n');
      qrcode.generate(qr, { small: true });
      console.log('\nMenunggu scan...\n');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Koneksi terputus (status code:', statusCode, '). Error:', lastDisconnect?.error?.message || lastDisconnect?.error);
      if (shouldReconnect) {
        setTimeout(startBot, 4000);
      } else {
        console.log('❌ Sesi WhatsApp telah keluar (Logged out). Silakan restart bot untuk scan QR baru.');
      }
    } else if (connection === 'open') {
      console.log('✅ BERHASIL TERHUBUNG KE WHATSAPP!');
      console.log(`🚀 Bot siap melayani Moderator (+${ALLOWED_MODERATOR_NUMBER})\n`);

      // Inisialisasi checkpoint alert ID awal agar tidak membombardir log lama
      try {
        const init = await getNewAlerts(null);
        lastSeenAlertId = init.latestId;
        console.log(`📌 Checkpoint audit log dimulai dari ID #${lastSeenAlertId}`);
      } catch (e) {
        console.error('Gagal mengambil initial audit ID:', e);
      }

      // Mulai loop pengecekan notifikasi perubahan data otomatis (Push Alert)
      startRealtimeAlertWatcher();
    }
  });

  // ── Penanganan Pesan Masuk ──
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;

      // Abaikan jika pesan ini adalah pesan balasan yang dikirim oleh bot sendiri
      if (msg.key?.id && botSentMsgIds.has(msg.key.id)) continue;

      const remoteJid = msg.key?.remoteJid;
      if (!remoteJid || remoteJid.includes('@g.us')) continue; // Abaikan pesan grup (hanya japri)

      // ── FILTER KETAT: Bot HANYA aktif di ruang chat "Message yourself" (Diri Sendiri) ──
      // Jika Anda sedang chat dengan teman, keluarga, jemaat, atau orang lain chat ke Anda:
      // BOT HARUS DIAM DAN LEWATI 100%! JANGAN PERNAH BALAS ATAU GANGGU CHAT PRIBADI!
      if (!isSelfChatOrBotChannel(remoteJid, sock)) {
        continue;
      }

      // Ambil teks pesan
      const body =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        '';

      const trimmed = body.trim().toLowerCase();
      if (!trimmed) continue;

      // Abaikan jika pesan ini berawalan format khas pesan bot agar tidak looping
      if (
        body.startsWith('🏛️') ||
        body.startsWith('📊') ||
        body.startsWith('⛪') ||
        body.startsWith('👥') ||
        body.startsWith('📝') ||
        body.startsWith('⚠️') ||
        body.startsWith('🔔') ||
        body.startsWith('🚨') ||
        body.startsWith('⏳') ||
        body.startsWith('❓')
      ) {
        continue;
      }

      console.log(`📥 [MODERATOR] Menerima perintah: "${body}" dari ${remoteJid}`);

      try {
        await handleModeratorCommand(remoteJid, trimmed, body);
      } catch (err) {
        console.error('Error saat memproses perintah:', err);
        await sendBotMessage(remoteJid, {
          text: `❌ Terjadi kesalahan saat memproses data:\n_${err.message}_`
        });
      }
    }
  });
}

/**
 * Router Perintah Moderator
 */
async function handleModeratorCommand(remoteJid, trimmed, originalBody) {
  // 1. Menu Utama
  if (['menu', 'help', 'bantuan', 'halo', 'hi', 'start', 'p'].includes(trimmed)) {
    const text = formatMainMenu();
    await sendBotMessage(remoteJid, { text });
    return;
  }

  // 2. Ringkasan Hari Ini
  if (trimmed === '1' || trimmed.startsWith('ringkasan') || trimmed === 'today') {
    await sendBotMessage(remoteJid, { text: '⏳ _Mengambil ringkasan data hari ini..._' });
    const data = await getDailySummary();
    const text = formatDailySummary(data);
    await sendBotMessage(remoteJid, { text });
    return;
  }

  // 3. Absensi Ibadah Umum
  if (trimmed === '2' || trimmed === 'absen umum' || trimmed === 'ibadah umum') {
    await sendBotMessage(remoteJid, { text: '⏳ _Mengambil riwayat absensi ibadah umum..._' });
    const sessions = await getRecentGeneralSessions();
    const text = formatGeneralSessions(sessions);
    await sendBotMessage(remoteJid, { text });
    return;
  }

  // 4. Detail Absensi Tanggal Tertentu (Format: "absen YYYY-MM-DD" atau langsung "YYYY-MM-DD")
  const dateMatch = originalBody.match(/(\d{4}-\d{2}-\d{2})/);
  if (trimmed.startsWith('absen ') || (dateMatch && !trimmed.startsWith('komisi'))) {
    const targetDate = dateMatch ? dateMatch[1] : trimmed.replace('absen', '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      await sendBotMessage(remoteJid, { text: `⏳ _Mencari data kehadiran ibadah tanggal ${targetDate}..._` });
      const detail = await getGeneralAttendanceDetail(targetDate);
      const text = formatGeneralDetail(detail);
      await sendBotMessage(remoteJid, { text });
      return;
    }
  }

  // 5. Absensi Komisi
  if (trimmed === '3' || trimmed === 'absen komisi' || trimmed === 'komisi') {
    await sendBotMessage(remoteJid, { text: '⏳ _Mengambil data absensi komisi..._' });
    const sessions = await getRecentKomisiSessions();
    const text = formatKomisiSessions(sessions);
    await sendBotMessage(remoteJid, { text });
    return;
  }

  // 6. Log Perubahan Data (Audit Trail)
  if (trimmed === '4' || trimmed === 'log' || trimmed === 'perubahan' || trimmed === 'audit') {
    await sendBotMessage(remoteJid, { text: '⏳ _Mengambil catatan riwayat perubahan data terbaru..._' });
    const logs = await getRecentAuditLogs(8);
    const text = formatAuditLogs(logs);
    await sendBotMessage(remoteJid, { text });
    return;
  }

  // 7. Kesehatan & Error Sistem
  if (trimmed === '5' || trimmed === 'error' || trimmed === 'bug' || trimmed === 'sistem' || trimmed === 'health') {
    await sendBotMessage(remoteJid, { text: '⏳ _Memeriksa kesehatan sistem & log kendala teknis..._' });
    const health = await getSystemHealth();
    const text = formatSystemHealth(health);
    await sendBotMessage(remoteJid, { text });
    return;
  }

  // 8. Pengaturan Push Alert
  if (trimmed === '6' || trimmed.startsWith('notif') || trimmed.startsWith('alert')) {
    if (trimmed.includes('off') || trimmed.includes('mati')) {
      isPushAlertEnabled = false;
    } else if (trimmed.includes('on') || trimmed.includes('aktif') || trimmed.includes('hidup')) {
      isPushAlertEnabled = true;
    } else {
      // Toggle
      isPushAlertEnabled = !isPushAlertEnabled;
    }

    const statusText = isPushAlertEnabled ? '🟢 *AKTIF*' : '🔴 *NON-AKTIF*';
    const text =
      `🔔 *PENGATURAN NOTIFIKASI OTOMATIS*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `Status Push Alert Realtime: ${statusText}\n\n` +
      `Saat status AKTIF, bot akan otomatis mengirim chat peringatan jika ada admin lain yang mengubah nama/data jemaat atau terjadi error sistem.\n\n` +
      `💡 _Ketik \`notif on\` untuk menyalakan atau \`notif off\` untuk mematikan._\n` +
      `_Ketik *menu* untuk kembali._`;

    await sendBotMessage(remoteJid, { text });
    return;
  }

  // Perintah Tidak Dikenal
  await sendBotMessage(remoteJid, {
    text:
      `❓ *Perintah Tidak Dikenali*\n` +
      `Ketik *menu* untuk melihat daftar opsi angka pemantauan yang tersedia.`
  });
}

/**
 * Loop background untuk mengirimkan notifikasi perubahan data secara realtime
 */
function startRealtimeAlertWatcher() {
  const CHECK_INTERVAL_MS = 45000; // Cek setiap 45 detik

  setInterval(async () => {
    if (!sock || !isPushAlertEnabled || !lastSeenAlertId) return;

    try {
      const res = await getNewAlerts(lastSeenAlertId);
      if (res.alerts && res.alerts.length > 0) {
        lastSeenAlertId = res.latestId;

        const moderatorJid = `${ALLOWED_MODERATOR_NUMBER}@s.whatsapp.net`;
        for (const alert of res.alerts) {
          console.log(`🚨 [ALERT PUSH] Mengirim notifikasi perubahan data ID #${alert.id} ke Moderator...`);
          const text = formatAlertNotification(alert);
          await sendBotMessage(moderatorJid, { text });
          // Jeda sedikit agar tidak spam
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    } catch (err) {
      console.error('Error saat memeriksa alert realtime:', err.message);
    }
  }, CHECK_INTERVAL_MS);
}

// Start bot
startBot().catch(console.error);
