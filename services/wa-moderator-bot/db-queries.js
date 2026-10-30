import { neon } from '@neondatabase/serverless';
import { DATABASE_URL, KOMISI_MAP } from './config.js';

const sql = neon(DATABASE_URL);

/**
 * Mendapatkan ringkasan harian (Quick Summary)
 */
export async function getDailySummary(targetDate) {
  const dateStr = targetDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  // 1. Absensi Ibadah Umum & Komisi dari app_kv
  const absenRows = await sql`
    SELECT key, value FROM app_kv 
    WHERE (key LIKE 'attendance_session:%' OR key LIKE 'komisi:%:absen:%')
  `;

  let generalPresent = 0;
  let komisiPresent = 0;
  const sessionsFound = [];
  const komisiSessionsFound = [];

  for (const r of absenRows) {
    if (r.value?.date === dateStr && Array.isArray(r.value?.presentIds)) {
      const count = r.value.presentIds.length;
      if (r.key.startsWith('attendance_session:')) {
        generalPresent += count;
        sessionsFound.push({
          id: r.value.id,
          serviceType: r.value.serviceType || 'Ibadah Umum',
          presentCount: count
        });
      } else if (r.key.startsWith('komisi:')) {
        komisiPresent += count;
        komisiSessionsFound.push({
          komisiId: r.value.komisiId,
          komisiName: KOMISI_MAP[r.value.komisiId] || r.value.komisiId,
          presentCount: count
        });
      }
    }
  }

  // 2. Total jemaat terdaftar
  const totalJemaatRes = await sql`
    SELECT count(*) as count FROM app_kv 
    WHERE (key LIKE 'congregation:member:%' OR key LIKE 'member:%') 
    AND (value->>'name') IS NOT NULL
  `;
  const totalJemaat = parseInt(totalJemaatRes[0]?.count || '0', 10);

  // 3. Perubahan data dalam 24 jam terakhir (Audit Log)
  const recentLogs = await sql`
    SELECT id, action, target, detail, at 
    FROM audit_log 
    WHERE at >= now() - interval '24 hours'
      AND target NOT LIKE 'KV (admin_chat%'
    ORDER BY at DESC 
    LIMIT 5
  `;

  // 4. Error dalam 24 jam terakhir
  const recentErrors = await sql`
    SELECT count(*) as count 
    FROM audit_log 
    WHERE at >= now() - interval '24 hours' 
      AND (action = 'ERROR' OR detail->>'error' IS NOT NULL)
  `;
  const errorCount = parseInt(recentErrors[0]?.count || '0', 10);

  return {
    date: dateStr,
    generalPresent,
    komisiPresent,
    totalToday: generalPresent + komisiPresent,
    totalJemaat,
    sessionsFound,
    komisiSessionsFound,
    recentLogs,
    errorCount
  };
}

/**
 * Daftar Sesi Ibadah Umum Terbaru (5 Sesi)
 */
export async function getRecentGeneralSessions() {
  const rows = await sql`
    SELECT key, value FROM app_kv 
    WHERE key LIKE 'attendance_session:%'
  `;

  const sessions = [];
  for (const r of rows) {
    if (r.value?.date) {
      sessions.push({
        id: r.value.id,
        date: r.value.date,
        serviceType: r.value.serviceType || 'Ibadah Minggu',
        presentCount: Array.isArray(r.value.presentIds) ? r.value.presentIds.length : 0,
        presentIds: r.value.presentIds || []
      });
    }
  }

  sessions.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  return sessions.slice(0, 7);
}

/**
 * Detail Absensi Ibadah Umum pada Tanggal Tertentu
 */
export async function getGeneralAttendanceDetail(targetDate) {
  const rows = await sql`
    SELECT key, value FROM app_kv 
    WHERE key LIKE 'attendance_session:%'
  `;

  const matches = [];
  for (const r of rows) {
    if (r.value?.date === targetDate) {
      matches.push(r.value);
    }
  }

  if (matches.length === 0) return null;

  // Ambil nama jemaat untuk sample kehadiran
  const allMembers = await sql`
    SELECT key, value FROM app_kv 
    WHERE (key LIKE 'congregation:member:%' OR key LIKE 'member:%') 
    AND (value->>'name') IS NOT NULL
  `;
  const memberMap = new Map();
  for (const m of allMembers) {
    if (m.value?.id) memberMap.set(m.value.id, m.value.name);
  }

  return matches.map(s => {
    const presentIds = s.presentIds || [];
    const sampleNames = presentIds.slice(0, 8).map(id => memberMap.get(id) || 'Jemaat').filter(Boolean);
    return {
      id: s.id,
      date: s.date,
      serviceType: s.serviceType || 'Ibadah Umum',
      presentCount: presentIds.length,
      sampleNames,
      remainingCount: Math.max(0, presentIds.length - sampleNames.length)
    };
  });
}

/**
 * Daftar Sesi Absensi Komisi Terbaru
 */
export async function getRecentKomisiSessions() {
  const rows = await sql`
    SELECT key, value FROM app_kv 
    WHERE key LIKE 'komisi:%:absen:%'
  `;

  const sessions = [];
  for (const r of rows) {
    if (r.value?.date && r.value?.komisiId) {
      sessions.push({
        id: r.value.id,
        date: r.value.date,
        komisiId: r.value.komisiId,
        komisiName: KOMISI_MAP[r.value.komisiId] || r.value.komisiId,
        title: r.value.title || 'Kegiatan Komisi',
        presentCount: Array.isArray(r.value.presentIds) ? r.value.presentIds.length : 0,
        absentCount: Array.isArray(r.value.absentIds) ? r.value.absentIds.length : 0
      });
    }
  }

  sessions.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  return sessions.slice(0, 10);
}

/**
 * Log Perubahan Data Jemaat & Aktivitas Sistem (Audit Trail)
 */
export async function getRecentAuditLogs(limit = 8) {
  const rows = await sql`
    SELECT 
      a.id, 
      a.user_id, 
      a.action, 
      a.target, 
      a.detail, 
      a.at,
      u.name as user_name,
      u.role as user_role
    FROM audit_log a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.target NOT LIKE 'KV (admin_chat%'
    ORDER BY a.at DESC 
    LIMIT ${limit}
  `;

  return rows.map(r => {
    let summaryText = r.detail?.summary || '';
    if (!summaryText && r.detail?.changes && Array.isArray(r.detail.changes)) {
      summaryText = r.detail.changes.map(c => `${c.field}: "${c.oldText || c.old}" ➡️ "${c.newText || c.new}"`).join(', ');
    }
    if (!summaryText && r.detail?.message) {
      summaryText = r.detail.message;
    }
    if (!summaryText) {
      summaryText = `${r.action} pada ${r.target}`;
    }

    return {
      id: r.id,
      at: r.at,
      timeFormatted: new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(r.at)),
      actor: r.user_name ? `${r.user_name} (${r.user_role === 'super_admin' ? 'Super Admin' : 'Admin'})` : 'Sistem / Anonim',
      action: r.action,
      target: r.target,
      summary: summaryText
    };
  });
}

/**
 * Cek Kesehatan Sistem & Error Log
 */
export async function getSystemHealth() {
  const startTime = Date.now();
  let dbStatus = 'OK';
  let latencyMs = 0;

  try {
    await sql`SELECT 1`;
    latencyMs = Date.now() - startTime;
  } catch (err) {
    dbStatus = 'ERROR: ' + err.message;
  }

  // Error records in last 7 days
  const recentErrors = await sql`
    SELECT id, action, target, detail, at 
    FROM audit_log 
    WHERE at >= now() - interval '7 days'
      AND (action = 'ERROR' OR detail->>'error' IS NOT NULL)
    ORDER BY at DESC 
    LIMIT 5
  `;

  return {
    database: {
      status: dbStatus,
      latencyMs
    },
    errorCount7Days: recentErrors.length,
    recentErrors
  };
}

/**
 * Poll log baru untuk notifikasi realtime
 */
export async function getNewAlerts(lastSeenId) {
  if (!lastSeenId) {
    // Ambil id paling mutakhir saat pertama kali start agar tidak spam log lama
    const latest = await sql`SELECT max(id) as max_id FROM audit_log`;
    return {
      latestId: latest[0]?.max_id ? BigInt(latest[0].max_id) : 0n,
      alerts: []
    };
  }

  const rows = await sql`
    SELECT 
      a.id, 
      a.action, 
      a.target, 
      a.detail, 
      a.at,
      u.name as user_name
    FROM audit_log a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.id > ${lastSeenId}
      AND a.target NOT LIKE 'KV (admin_chat%'
    ORDER BY a.id ASC
    LIMIT 10
  `;

  if (rows.length === 0) {
    return { latestId: lastSeenId, alerts: [] };
  }

  const latestId = BigInt(rows[rows.length - 1].id);
  const alerts = rows.map(r => {
    let summary = r.detail?.summary || '';
    if (!summary && r.detail?.changes) {
      summary = r.detail.changes.map(c => `${c.field}: "${c.oldText || c.old}" ➡️ "${c.newText || c.new}"`).join(', ');
    }
    return {
      id: r.id,
      at: r.at,
      actor: r.user_name || 'Admin',
      action: r.action,
      target: r.target,
      summary: summary || `${r.action} ${r.target}`
    };
  });

  return { latestId, alerts };
}
