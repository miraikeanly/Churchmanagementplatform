import sql from '../_lib/db.js';
import { requireUser } from '../_lib/guard.js';
import { sendJson, sendError } from '../_lib/http.js';

// The UI (Data Jemaat, Komisi, Komsel) stores its records in app_kv, so the
// dashboard must count from there or it will always show zeros.
const KOMISI_NAMES = {
  'sekolah-minggu': 'Sekolah Minggu',
  teens: 'Teens',
  vessel: 'Vessel',
  wbi: 'WBI',
  kompas: 'Kompas',
  kowari: 'Kowari',
  koemas: 'Koemas',
};

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;

  if (req.method === 'GET') {
    const [members, komisiRows, komselRows, pksConfig, absenRows, pendingUsers] = await Promise.all([
      sql`SELECT key, value FROM app_kv WHERE key LIKE 'congregation:member:%' OR key LIKE 'member:%'`,
      sql`SELECT value FROM app_kv WHERE key LIKE 'komisi:%:member:%'`,
      sql`SELECT value FROM app_kv WHERE key LIKE 'komsel:%'`,
      sql`SELECT value FROM app_kv WHERE key = 'config:pks-names'`,
      sql`SELECT key, value FROM app_kv WHERE key LIKE 'komisi:%:absen:%' OR key LIKE 'attendance_session:%'`,
      sql`SELECT count(*) AS c FROM users WHERE status = 'pending' AND role <> 'jemaat'`,
    ]);

    // A komsel is a PKS: count distinct PKS names from saved komsel, the configured list and members.
    const normPks = (n) => String(n || '').toUpperCase().replace(/^PKS\s*/i, '').replace(/\s+/g, ' ').trim();
    const pksSet = new Set();
    for (const r of komselRows) { const n = normPks(r.value?.pksName || r.value?.name); if (n) pksSet.add(n); }
    for (const n of Array.isArray(pksConfig[0]?.value) ? pksConfig[0].value : []) { const k = normPks(n); if (k) pksSet.add(k); }

    // Today's attendance (Jakarta date)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    let todayAttendance = 0; // Ibadah Umum
    let todayKomisiAttendance = 0; // Komisi sessions
    for (const r of absenRows) {
      if (r.value?.date === today && Array.isArray(r.value.presentIds)) {
        const count = r.value.presentIds.length;
        if (r.key.startsWith('attendance_session:')) {
          todayAttendance += count;
        } else if (r.key.startsWith('komisi:')) {
          todayKomisiAttendance += count;
        }
      }
    }
    const totalTodayAttendance = todayAttendance + todayKomisiAttendance;

    // Same member may exist under both key formats; count each id once.
    const byId = new Map();
    for (const r of members) {
      if (!r.value?.name) continue;
      byId.set(r.value.id || r.key, r.value);
      const k = normPks(r.value.pksName); if (k) pksSet.add(k);
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    let newRegistrations = 0;
    for (const m of byId.values()) {
      const created = new Date(m.createdAt || m.created_at || 0);
      if (created >= monthStart) newRegistrations++;
    }

    // Count distinct people per komisi (a person can only be in a komisi once).
    const perKomisi = new Map();
    for (const r of komisiRows) {
      const { komisiId, jemaatId, id } = r.value || {};
      if (!komisiId) continue;
      if (!perKomisi.has(komisiId)) perKomisi.set(komisiId, new Set());
      perKomisi.get(komisiId).add(jemaatId || id);
    }

    return sendJson(res, 200, {
      success: true,
      stats: {
        totalMembers: byId.size,
        newRegistrations,
        totalKomsel: pksSet.size,
        pendingApprovals: parseInt(pendingUsers[0]?.c || 0),
        todayAttendance, // Ibadah Umum (matches 193 in user screenshot)
        todayKomisiAttendance, // Komisi (matches 38)
        totalTodayAttendance, // 231 (total across both)
        attendanceTrends: [],
        komisiDemographics: [...perKomisi.entries()].map(([id, set]) => ({
          name: KOMISI_NAMES[id] || id,
          value: set.size,
        })),
      },
    });
  }

  res.setHeader('Allow', 'GET');
  return sendError(res, 405, 'Method not allowed');
}
