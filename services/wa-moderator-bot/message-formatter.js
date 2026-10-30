/**
 * Helper untuk format pesan WhatsApp yang rapi, elegan & profesional
 */

export function formatMainMenu() {
  return (
    `🏛️ *BOT PEMANTAU MODERATOR*\n` +
    `*GBI Jelambar Timur*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `Halo Moderator! Bot ini terhubung langsung ke database admin dashboard untuk pemantauan sistem 24/7.\n\n` +
    `Silakan pilih menu informasi:\n\n` +
    `1️⃣ 📊 *Ringkasan Hari Ini*\n` +
    `    _Total kehadiran ibadah, komisi & statistik jemaat._\n\n` +
    `2️⃣ ⛪ *Absensi Ibadah Umum*\n` +
    `    _Daftar sesi ibadah minggu & jumlah hadir._\n\n` +
    `3️⃣ 👥 *Absensi Komisi & Komsel*\n` +
    `    _Kehadiran Youth, WBI, Kompas, Teens, Anak, dll._\n\n` +
    `4️⃣ 📝 *Log Perubahan Data (Audit Trail)*\n` +
    `    _Pantau perubahan data (contoh: edit nama jemaat dll)._\n\n` +
    `5️⃣ ⚠️ *Status Kesehatan & Error Sistem*\n` +
    `    _Laporan latency database & kendala teknis._\n\n` +
    `6️⃣ 🔔 *Status Alert Notifikasi Otomatis*\n` +
    `    _Pengaturan push-notification otomatis saat ada update._\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 *Tips Cepat:*\n` +
    `• Balas *1* s/d *6* untuk memilih menu.\n` +
    `• Atau ketik format tanggal: misal \`absen 2026-10-27\`\n` +
    `• Ketik *menu* kapan saja untuk kembali ke sini.`
  );
}

export function formatDailySummary(d) {
  let sessionsText = '';
  if (d.sessionsFound.length > 0) {
    sessionsText = d.sessionsFound
      .map(s => `  • ${s.serviceType}: *${s.presentCount}* hadir`)
      .join('\n');
  } else {
    sessionsText = '  • _Belum ada sesi ibadah umum tersimpan hari ini._';
  }

  let komisiText = '';
  if (d.komisiSessionsFound.length > 0) {
    komisiText = d.komisiSessionsFound
      .map(k => `  • ${k.komisiName}: *${k.presentCount}* hadir`)
      .join('\n');
  } else {
    komisiText = '  • _Belum ada absensi komisi hari ini._';
  }

  return (
    `📊 *RINGKASAN HARIAN SISTEM*\n` +
    `📅 *Tanggal:* ${d.date}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👥 *Total Jemaat Terdaftar:* *${d.totalJemaat}* orang\n` +
    `✅ *Total Hadir Hari Ini:* *${d.totalToday}* orang\n\n` +
    `⛪ *Ibadah Umum:* *${d.generalPresent}* hadir\n` +
    `${sessionsText}\n\n` +
    `👥 *Komisi:* *${d.komisiPresent}* hadir\n` +
    `${komisiText}\n\n` +
    `📝 *Aktivitas / Edit Data 24 Jam:* *${d.recentLogs.length}* aktivitas\n` +
    `⚠️ *Error Sistem 24 Jam:* *${d.errorCount}* terdeteksi\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `_Ketik *4* untuk melihat detail perubahan data atau *menu* untuk opsi lain._`
  );
}

export function formatGeneralSessions(sessions) {
  if (!sessions || sessions.length === 0) {
    return (
      `⛪ *ABSENSI IBADAH UMUM*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `Belum ditemukan riwayat sesi ibadah umum di sistem.\n\n` +
      `_Ketik *menu* untuk kembali._`
    );
  }

  let listStr = sessions
    .map((s, idx) => {
      return (
        `*${idx + 1}.* 📅 *${s.date}* (${s.serviceType})\n` +
        `    👥 Hadir: *${s.presentCount}* jemaat\n` +
        `    👉 _Ketik: \`absen ${s.date}\` untuk lihat rincian._`
      );
    })
    .join('\n\n');

  return (
    `⛪ *DAFTAR SESI IBADAH UMUM TERAKHIR*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${listStr}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 Anda bisa ketik \`absen YYYY-MM-DD\` (contoh: \`absen ${sessions[0].date}\`) untuk melihat detail nama yang hadir.`
  );
}

export function formatGeneralDetail(details) {
  if (!details || details.length === 0) {
    return (
      `❌ *Data Tidak Ditemukan*\n` +
      `Tidak ditemukan absensi ibadah umum pada tanggal tersebut.\n` +
      `Ketik *2* untuk melihat daftar tanggal yang tersedia.`
    );
  }

  let text = `⛪ *DETAIL ABSENSI IBADAH UMUM*\n`;
  text += `📅 *Tanggal:* ${details[0].date}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (const s of details) {
    text += `🔹 *${s.serviceType}*\n`;
    text += `👥 *Total Hadir:* *${s.presentCount}* jemaat\n`;
    if (s.sampleNames && s.sampleNames.length > 0) {
      text += `📋 *Beberapa yang hadir:*\n`;
      text += s.sampleNames.map(n => `  ✓ ${n}`).join('\n') + '\n';
      if (s.remainingCount > 0) {
        text += `  _...dan ${s.remainingCount} jemaat lainnya._\n`;
      }
    }
    text += `\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `_Ketik *menu* untuk kembali ke menu utama._`;
  return text;
}

export function formatKomisiSessions(sessions) {
  if (!sessions || sessions.length === 0) {
    return (
      `👥 *ABSENSI KOMISI & KOMSEL*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `Belum ada sesi absensi komisi yang tersimpan.\n\n` +
      `_Ketik *menu* untuk kembali._`
    );
  }

  let listStr = sessions
    .map((s, idx) => {
      return (
        `*${idx + 1}.* 📅 *${s.date}* - *${s.komisiName}*\n` +
        `    🏷️ "${s.title}"\n` +
        `    ✅ Hadir: *${s.presentCount}* | ❌ Tidak Hadir: *${s.absentCount}*`
      );
    })
    .join('\n\n');

  return (
    `👥 *RIWAYAT ABSENSI KOMISI TERAKHIR*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${listStr}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `_Ketik *menu* untuk kembali ke menu utama._`
  );
}

export function formatAuditLogs(logs) {
  if (!logs || logs.length === 0) {
    return (
      `📝 *LOG PERUBAHAN DATA (AUDIT TRAIL)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `Belum ada catatan perubahan data jemaat/admin yang terekam.\n\n` +
      `_Ketik *menu* untuk kembali._`
    );
  }

  let listStr = logs
    .map((l, idx) => {
      const emoji = l.action === 'UPDATE' ? '✏️' : l.action === 'DELETE' ? '🗑️' : l.action === 'CREATE' ? '➕' : '📌';
      return (
        `*${idx + 1}.* ${emoji} *[${l.action}]* ${l.target}\n` +
        `    ⏰ _${l.timeFormatted}_\n` +
        `    👤 *Oleh:* ${l.actor}\n` +
        `    📝 *Rincian:* ${l.summary}`
      );
    })
    .join('\n\n');

  return (
    `📝 *CATATAN PERUBAHAN DATA TERBARU*\n` +
    `*GBI Jelambar Timur*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${listStr}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 _Setiap perubahan nama, status, atau absensi oleh admin lain akan otomatis tercatat di sini dan bisa dikirimkan langsung ke nomor WA Anda._\n\n` +
    `_Ketik *menu* untuk kembali._`
  );
}

export function formatSystemHealth(h) {
  const isHealthy = h.database.status === 'OK';
  const statusEmoji = isHealthy ? '🟢 NORMAL / SEHAT' : '🔴 MENGALAMI KENDALA';

  let errorsText = '';
  if (h.recentErrors.length > 0) {
    errorsText = h.recentErrors
      .map((e, idx) => `  *${idx + 1}.* [${e.at.toISOString().slice(0, 10)}] ${e.action} di ${e.target}: ${e.detail?.error || e.detail?.message || 'Error'}`)
      .join('\n');
  } else {
    errorsText = '  _Tidak ada laporan error sistem dalam 7 hari terakhir. Semua berjalan lancar!_';
  }

  return (
    `⚠️ *KESEHATAN & MONITORING SISTEM*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🖥️ *Status Database (Neon PostgreSQL):*\n` +
    `    Status: ${statusEmoji}\n` +
    `    Respon: *${h.database.latencyMs} ms*\n\n` +
    `🐞 *Laporan Error / Bug (7 Hari Terakhir):*\n` +
    `    Total Error: *${h.errorCount7Days}*\n` +
    `${errorsText}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `_Ketik *menu* untuk kembali._`
  );
}

export function formatAlertNotification(alert) {
  const timeFormatted = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(alert.at));

  return (
    `🚨 *[ALERT PERUBAHAN DATA GEREJA]*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `Ada aktivitas/perubahan baru di website admin:\n\n` +
    `👤 *Admin Pelaku:* ${alert.actor}\n` +
    `🎯 *Bagian:* ${alert.target}\n` +
    `⚡ *Tindakan:* ${alert.action}\n` +
    `📝 *Perubahan:* ${alert.summary}\n` +
    `⏰ *Waktu:* ${timeFormatted}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `_Notifikasi Otomatis Bot Moderator GBI Jelambar Timur_`
  );
}
