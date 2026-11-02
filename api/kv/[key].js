import sql from '../_lib/db.js';
import { requireUser } from '../_lib/guard.js';
import { sendJson, sendError, getBody } from '../_lib/http.js';
import { logActivity } from '../_lib/audit.js';

function getTargetFromKey(key) {
  if (
    key === 'admin_chat:presence' ||
    key.startsWith('presence:') ||
    key.startsWith('backup:') ||
    key.startsWith('temp:') ||
    key.startsWith('cache:')
  ) {
    return null;
  }
  if (key.startsWith('attendance_session:')) return 'Absensi';
  if (key.startsWith('congregation:member:') || key.startsWith('member:')) return 'Data Jemaat';
  if (key.startsWith('komsel:') || key.startsWith('config:pks')) return 'Komsel';
  if (key.startsWith('finance:') || key.startsWith('keuangan:')) return 'Keuangan';
  if (key.startsWith('inventory:') || key.startsWith('inventaris:')) return 'Inventaris';
  if (key.startsWith('announcement:')) return 'Pengumuman';
  if (key.startsWith('gallery:')) return 'Galeri Foto';
  if (key.startsWith('team:')) return 'Tim Pelayanan';
  if (key.startsWith('registration:') || key.startsWith('registrasi:')) return 'Pendaftaran';
  return `KV (${key.split(':')[0] || 'Umum'})`;
}

const FIELD_LABEL_MAP = {
  name: 'Nama',
  phone: 'Nomor Telepon',
  phones: 'Nomor Telepon',
  address: 'Alamat',
  birthDate: 'Tanggal Lahir',
  gender: 'Jenis Kelamin',
  status: 'Status',
  serviceType: 'Ibadah',
  date: 'Tanggal',
  notes: 'Catatan',
  note: 'Catatan',
  spouseName: 'Nama Pasangan',
  parentName: 'Nama Orang Tua',
  category: 'Kategori',
  amount: 'Nominal',
  presentIds: 'Daftar Hadir',
};

function formatFieldLabel(key) {
  return FIELD_LABEL_MAP[key] || key;
}

function formatValueForLog(v, fieldKey = '') {
  if (v === null || v === undefined || v === '') return 'kosong';
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak';
  if (Array.isArray(v)) {
    if (v.length === 0) return 'kosong (0)';
    if (fieldKey === 'presentIds') {
      return `${v.length} orang jemaat hadir`;
    }
    if (v.length <= 3 && typeof v[0] === 'string' && v[0].length < 30) {
      return v.join(', ');
    }
    return `${v.length} item`;
  }
  if (typeof v === 'object') return 'data tersimpan';
  const str = String(v);
  if (str.length > 50) return str.slice(0, 47) + '...';
  return str;
}

function computeDiff(oldVal, newVal) {
  const diffs = [];
  const allKeys = Array.from(new Set([...Object.keys(oldVal || {}), ...Object.keys(newVal || {})]));
  // Ignore internal metadata keys from diff
  const ignoredKeys = new Set(['updatedAt', 'updated_at', 'createdAt', 'created_at', '_storeKey', 'id', 'savedAt']);

  for (const k of allKeys) {
    if (ignoredKeys.has(k)) continue;
    const o = oldVal ? oldVal[k] : undefined;
    const n = newVal ? newVal[k] : undefined;
    const oJson = JSON.stringify(o);
    const nJson = JSON.stringify(n);
    if (oJson !== nJson) {
      // Special friendly diff for attendance presentIds
      if (k === 'presentIds' && Array.isArray(o) && Array.isArray(n)) {
        const added = n.filter(id => !o.includes(id));
        const removed = o.filter(id => !n.includes(id));
        let diffDesc = '';
        if (added.length > 0 && removed.length === 0) {
          diffDesc = `+${added.length} jemaat dicentang hadir (total ${n.length})`;
        } else if (removed.length > 0 && added.length === 0) {
          diffDesc = `-${removed.length} centang jemaat dibatalkan (total ${n.length})`;
        } else {
          diffDesc = `${n.length} jemaat hadir (+${added.length}, -${removed.length})`;
        }
        diffs.push({
          field: 'presentIds',
          fieldLabel: 'Daftar Hadir',
          oldText: `${o.length} hadir`,
          newText: diffDesc,
          addedCount: added.length,
          removedCount: removed.length,
          addedIds: added.slice(0, 5),
          removedIds: removed.slice(0, 5),
        });
        continue;
      }

      diffs.push({
        field: k,
        fieldLabel: formatFieldLabel(k),
        old: o !== undefined ? o : null,
        new: n !== undefined ? n : null,
        oldText: formatValueForLog(o, k),
        newText: formatValueForLog(n, k),
      });
    }
  }
  return diffs;
}

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const { key } = req.query;
  if (!key) return sendError(res, 400, 'Key required');

  if (req.method === 'GET') {
    const records = await sql`SELECT value FROM app_kv WHERE key = ${key}`;
    return sendJson(res, 200, records.length > 0 ? records[0].value : null);
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const value = getBody(req);
    const valueJson = typeof value === 'string' ? value : JSON.stringify(value);

    // Fetch existing record to compute accurate diff and entity label
    const existingRows = await sql`SELECT value FROM app_kv WHERE key = ${key}`;
    const existing = existingRows.length > 0 ? existingRows[0].value : null;

    await sql`
      INSERT INTO app_kv (key, value) VALUES (${key}, ${valueJson}::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = ${valueJson}::jsonb, updated_at = now()
    `;

    const target = getTargetFromKey(key);
    if (!target) {
      return sendJson(res, 200, { success: true });
    }

    const isNew = !existing;
    const action = isNew ? 'CREATE' : 'UPDATE';

    const newValObj = typeof value === 'object' && value !== null ? value : {};
    const oldValObj = typeof existing === 'object' && existing !== null ? existing : {};

    let entityName =
      newValObj.name ||
      oldValObj.name ||
      newValObj.title ||
      oldValObj.title;

    if (!entityName) {
      if (key.startsWith('attendance_session:')) {
        const sessDate = newValObj.date || oldValObj.date || key.replace('attendance_session:', '');
        const sessService = newValObj.serviceType || oldValObj.serviceType || 'Ibadah';
        entityName = `Absensi ${sessService} (${sessDate})`;
      } else {
        entityName = key.split(':').slice(1).join(':') || 'Data';
      }
    }

    let summary = '';
    let changes = [];

    if (isNew) {
      if (key.startsWith('attendance_session:')) {
        const total = Array.isArray(newValObj.presentIds) ? newValObj.presentIds.length : 0;
        summary = `Membuat sesi absensi "${entityName}" (${total} jemaat hadir)`;
      } else {
        summary = `Menambahkan data baru "${entityName}" pada ${target}`;
      }
    } else {
      changes = computeDiff(oldValObj, newValObj);
      if (key.startsWith('attendance_session:')) {
        const attDiff = changes.find(c => c.field === 'presentIds');
        if (attDiff && attDiff.newText) {
          summary = `Menyimpan ${entityName}: ${attDiff.newText}`;
        } else {
          summary = `Menyimpan data ${entityName}`;
        }
      } else if (changes.length > 0) {
        const changeHighlights = changes
          .slice(0, 3)
          .map(c => `mengubah ${c.fieldLabel || c.field}: "${c.oldText}" → "${c.newText}"`)
          .join(', ');
        const extraCount = changes.length > 3 ? ` (+${changes.length - 3} perubahan lainnya)` : '';
        summary = `Mengubah data "${entityName}" (${changeHighlights}${extraCount})`;
      } else {
        summary = `Memperbarui data "${entityName}" pada ${target}`;
      }
    }

    await logActivity({
      userId: user.id,
      action,
      target,
      detail: {
        key,
        entityName,
        summary,
        changes,
        isNew,
      },
    });

    return sendJson(res, 200, { success: true });
  }
  
  if (req.method === 'DELETE') {
    const existingRows = await sql`SELECT value FROM app_kv WHERE key = ${key}`;
    const existing = existingRows.length > 0 ? existingRows[0].value : null;

    await sql`DELETE FROM app_kv WHERE key = ${key}`;

    const target = getTargetFromKey(key);
    const entityName =
      (existing && typeof existing === 'object' && (existing.name || existing.title)) ||
      key.split(':').slice(1).join(':');

    const summary = `Menghapus data "${entityName}" dari ${target}`;

    await logActivity({
      userId: user.id,
      action: 'DELETE',
      target,
      detail: {
        key,
        entityName,
        summary,
        deletedData: existing,
      },
    });

    return sendJson(res, 200, { success: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return sendError(res, 405, 'Method not allowed');
}

