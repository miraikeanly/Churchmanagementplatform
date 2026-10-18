import sql from './_lib/db.js';
import { requireUser } from './_lib/guard.js';
import { sendJson, sendError, getBody } from './_lib/http.js';

// One function for CMS-style content (public reads + admin writes), all stored in app_kv.
// Routed via vercel.json: /api/content/<path> -> /api/content?path=<path>

const uid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const now = () => new Date().toISOString();

const byPrefix = async (prefix) => {
  try {
    const rows = await sql`SELECT value FROM app_kv WHERE key LIKE ${prefix + '%'}`;
    return rows.map((r) => r.value).filter(Boolean);
  } catch (err) {
    console.warn(`content byPrefix error for ${prefix}:`, err?.message);
    return [];
  }
};
const get = async (key) => {
  try {
    const rows = await sql`SELECT value FROM app_kv WHERE key = ${key}`;
    return rows[0]?.value ?? null;
  } catch (err) {
    console.warn(`content get error for ${key}:`, err?.message);
    return null;
  }
};
const set = (key, value) => {
  const json = JSON.stringify(value);
  return sql`
    INSERT INTO app_kv (key, value) VALUES (${key}, ${json}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = ${json}::jsonb, updated_at = now()`;
};
const del = (key) => sql`DELETE FROM app_kv WHERE key = ${key}`;

const TIER_ORDER = { gembala_sidang: 0, penerus_gembala: 1, wakil_gembala: 2, pastoral: 3, koordinator: 4 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const parts = String(req.query.path || '').split('/').filter(Boolean);
  const [resource, a, b, c, d] = parts;
  const m = req.method;

  try {
    // ── Image serving (public) ──
    if (resource === 'img' && a && m === 'GET') {
      const img = await get(`img:${a}`);
      if (!img) return sendError(res, 404, 'Not found');
      res.setHeader('Content-Type', img.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).send(Buffer.from(img.data, 'base64'));
    }

    // ── Public reads ──
    if (m === 'GET' && resource === 'announcements') {
      const items = (await byPrefix('announcement:')).filter((x) => x.id)
        .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
      return sendJson(res, 200, { success: true, announcements: items });
    }
    if (m === 'GET' && resource === 'gallery' && a === 'albums' && !b) {
      const albums = (await byPrefix('gallery:album:')).filter((x) => x.id).sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
      const out = await Promise.all(albums.map(async (al) => {
        const photos = (await byPrefix(`gallery:photo:${al.id}:`)).filter((p) => p.id);
        const cover = photos.find((p) => p.id === al.coverPhotoId) || photos[0];
        return { ...al, photoCount: photos.length, coverUrl: al.coverUrl || cover?.imageUrl || null };
      }));
      return sendJson(res, 200, { success: true, albums: out });
    }
    if (m === 'GET' && resource === 'gallery' && a === 'albums' && b && c === 'photos') {
      const photos = (await byPrefix(`gallery:photo:${b}:`)).filter((p) => p.id)
        .sort((x, y) => new Date(x.createdAt) - new Date(y.createdAt));
      return sendJson(res, 200, { success: true, photos });
    }
    if (m === 'GET' && resource === 'team') {
      const members = (await byPrefix('team:member:')).filter((x) => x.id).sort((x, y) => {
        const diff = (TIER_ORDER[x.tier] ?? 99) - (TIER_ORDER[y.tier] ?? 99);
        return diff !== 0 ? diff : (x.order ?? 0) - (y.order ?? 0);
      });
      return sendJson(res, 200, { success: true, members });
    }
    // Public aggregate numbers for the website (no personal data)
    if (m === 'GET' && resource === 'stats') {
      const rows = await sql`SELECT key, value FROM app_kv WHERE key LIKE 'congregation:member:%' OR key LIKE 'member:%' OR key LIKE 'komsel:%' OR key = 'config:pks-names'`;
      const norm = (n) => String(n || '').toUpperCase().replace(/^PKS\s*/i, '').replace(/\s+/g, ' ').trim();
      const people = new Set(); const pks = new Set();
      for (const r of rows) {
        const v = r.value;
        if (r.key === 'config:pks-names') { (Array.isArray(v) ? v : []).forEach((n) => { const k = norm(n); if (k) pks.add(k); }); continue; }
        if (r.key.startsWith('komsel:')) { const k = norm(v?.pksName || v?.name); if (k) pks.add(k); continue; }
        if (!v?.name || v.status === 'inactive') continue;
        people.add(v.id || r.key);
        const k = norm(v.pksName); if (k) pks.add(k);
      }
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return sendJson(res, 200, { success: true, members: people.size, komsel: pks.size });
    }
    // Public: submit a registration form
    if (m === 'POST' && resource === 'registrations') {
      const { type, title, data } = getBody(req);
      if (!type || !data) return sendError(res, 400, 'Missing fields');
      const id = crypto.randomUUID();
      await set(`registration:${type}:${id}`, { id, type, title, data, submittedAt: now(), status: 'baru' });
      return sendJson(res, 200, { success: true, id });
    }

    // Public: get giving categories
    if (m === 'GET' && resource === 'giving' && a === 'categories') {
      const defaultCategories = [
        { id: 'tithes', code: 'TITHES', name: 'Persembahan Persepuluhan', description: 'Membawa seluruh persembahan persepuluhan ke dalam rumah perbendaharaan (Maleakhi 3:10)' },
        { id: 'offering', code: 'OFFERING', name: 'Persembahan Umum', description: 'Persembahan ibadah mingguan dan pelayanan umum gereja' },
        { id: 'thanksgiving', code: 'THANKSGIVING OFFERING', name: 'Persembahan Syukur', description: 'Ungkapan syukur atas berkat, kesehatan, dan penyertaan Tuhan' },
        { id: 'christmas', code: 'CHRISTMAS OFFERING', name: 'Persembahan Natal', description: 'Persembahan khusus sukacita Natal dan bakti kasih' }
      ];
      const saved = await get('settings:giving_categories');
      return sendJson(res, 200, { success: true, categories: saved && Array.isArray(saved) && saved.length > 0 ? saved : defaultCategories });
    }

    // Public / Jemaat: submit persembahan (giving confirmation)
    if (m === 'POST' && resource === 'giving' && a === 'submissions') {
      const body = getBody(req);
      const { categoryCode, categoryName, amount, senderName, senderPhone, senderEmail, memo, paymentMethod, userId } = body;
      if (!categoryCode || !amount || !senderName) {
        return sendError(res, 400, 'Mohon lengkapi jenis persembahan, nominal, dan nama Anda.');
      }
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return sendError(res, 400, 'Nominal persembahan tidak valid.');
      }

      const id = uid('give');
      const record = {
        id,
        categoryCode,
        categoryName: categoryName || categoryCode,
        amount: numAmount,
        senderName: String(senderName).trim(),
        senderPhone: senderPhone ? String(senderPhone).trim() : '',
        senderEmail: senderEmail ? String(senderEmail).trim() : '',
        memo: memo ? String(memo).trim() : '',
        paymentMethod: paymentMethod || 'BCA Transfer',
        userId: userId || null,
        status: 'pending', // pending | verified | rejected
        submittedAt: now(),
        createdAt: now()
      };

      await set(`giving:submission:${id}`, record);

      // Otomatis masukkan ke transaksi keuangan dengan deskripsi persembahan
      const txId = uid('tx_give');
      const txDesc = `Persembahan ${record.categoryName} - ${record.senderName}${record.memo ? ` (${record.memo})` : ''}`;
      const transaction = {
        id: txId,
        type: 'income',
        category: record.categoryName,
        amount: numAmount,
        description: txDesc,
        date: new Date().toISOString().split('T')[0],
        givingSubmissionId: id,
        createdBy: userId || 'online_giving',
        createdAt: now()
      };
      await set(`transaction:${txId}`, transaction);

      return sendJson(res, 200, { success: true, submission: record, transactionId: txId });
    }

    // ── Everything below needs a logged-in admin ──
    const user = await requireUser(req, res);
    if (!user) return;
    const body = ['POST', 'PUT'].includes(m) ? getBody(req) : {};

    if (resource === 'announcements') {
      if (m === 'POST') {
        if (!body.title) return sendError(res, 400, 'Title is required');
        const id = uid('ann');
        const item = { id, title: body.title, description: body.description || '', imageUrl: body.imageUrl || null,
          active: body.active !== false, createdAt: now(), updatedAt: now(), createdBy: user.id };
        await set(`announcement:${id}`, item);
        return sendJson(res, 200, { success: true, announcement: item });
      }
      if (m === 'PUT' && a) {
        const ex = await get(`announcement:${a}`);
        if (!ex) return sendError(res, 404, 'Not found');
        const item = { ...ex, ...body, id: a, updatedAt: now(), updatedBy: user.id };
        await set(`announcement:${a}`, item);
        return sendJson(res, 200, { success: true, announcement: item });
      }
      if (m === 'DELETE' && a) { await del(`announcement:${a}`); return sendJson(res, 200, { success: true }); }
    }

    if (resource === 'gallery' && a === 'albums') {
      if (m === 'POST' && !b) {
        if (!body.name) return sendError(res, 400, 'Name is required');
        const id = uid('alb');
        const count = (await byPrefix('gallery:album:')).length;
        const album = { id, name: body.name, description: body.description || '', coverPhotoId: null, order: count, createdAt: now(), updatedAt: now() };
        await set(`gallery:album:${id}`, album);
        return sendJson(res, 200, { success: true, album });
      }
      if (m === 'PUT' && b && !c) {
        const ex = await get(`gallery:album:${b}`);
        if (!ex) return sendError(res, 404, 'Album not found');
        const album = { ...ex, ...body, id: b, updatedAt: now() };
        await set(`gallery:album:${b}`, album);
        return sendJson(res, 200, { success: true, album });
      }
      if (m === 'DELETE' && b && !c) {
        const photos = await byPrefix(`gallery:photo:${b}:`);
        for (const p of photos) if (p.id) await del(`gallery:photo:${b}:${p.id}`);
        await del(`gallery:album:${b}`);
        return sendJson(res, 200, { success: true });
      }
      if (m === 'POST' && b && c === 'photos') {
        const album = await get(`gallery:album:${b}`);
        if (!album) return sendError(res, 404, 'Album not found');
        if (!body.imageUrl) return sendError(res, 400, 'Image is required');
        const id = uid('ph');
        const photo = { id, albumId: b, imageUrl: body.imageUrl, caption: body.caption || '', createdAt: now() };
        await set(`gallery:photo:${b}:${id}`, photo);
        if (!album.coverPhotoId) await set(`gallery:album:${b}`, { ...album, coverPhotoId: id, updatedAt: now() });
        return sendJson(res, 200, { success: true, photo });
      }
      if (m === 'DELETE' && b && c === 'photos' && d) {
        await del(`gallery:photo:${b}:${d}`);
        const album = await get(`gallery:album:${b}`);
        if (album?.coverPhotoId === d) {
          const next = (await byPrefix(`gallery:photo:${b}:`)).find((p) => p.id && p.id !== d);
          await set(`gallery:album:${b}`, { ...album, coverPhotoId: next?.id || null, updatedAt: now() });
        }
        return sendJson(res, 200, { success: true });
      }
    }

    if (resource === 'team') {
      if (m === 'POST') {
        if (!body.name || !body.tier) return sendError(res, 400, 'Name and tier are required');
        const id = body.id || crypto.randomUUID();
        const member = { id, name: body.name, role: body.role || '', tier: body.tier, spouseName: body.spouseName || '',
          spouseRole: body.spouseRole || '', order: body.order ?? 0, photoUrl: body.photoUrl || null, createdAt: now(), updatedAt: now() };
        await set(`team:member:${id}`, member);
        return sendJson(res, 200, { success: true, member });
      }
      if (m === 'PUT' && a) {
        const ex = await get(`team:member:${a}`);
        if (!ex) return sendError(res, 404, 'Member not found');
        const member = { ...ex, ...body, id: a, updatedAt: now() };
        await set(`team:member:${a}`, member);
        return sendJson(res, 200, { success: true, member });
      }
      if (m === 'DELETE' && a) { await del(`team:member:${a}`); return sendJson(res, 200, { success: true }); }
    }

    if (resource === 'registrations') {
      if (m === 'GET') {
        const { type } = req.query;
        const all = (await byPrefix(type ? `registration:${type}:` : 'registration:'))
          .sort((x, y) => new Date(y.submittedAt) - new Date(x.submittedAt));
        return sendJson(res, 200, { success: true, registrations: all });
      }
      if (m === 'PUT' && a) {
        const rec = await get(`registration:${body.type}:${a}`);
        if (!rec) return sendError(res, 404, 'Not found');
        await set(`registration:${body.type}:${a}`, { ...rec, status: body.status });
        return sendJson(res, 200, { success: true });
      }
      if (m === 'DELETE' && a) { await del(`registration:${req.query.type}:${a}`); return sendJson(res, 200, { success: true }); }
    }

    if (resource === 'finance' && a === 'transactions') {
      if (m === 'GET') {
        const transactions = await byPrefix('transaction:');
        let income = 0, expense = 0;
        transactions.forEach((t) => { if (t.type === 'income') income += t.amount; else expense += t.amount; });
        return sendJson(res, 200, { success: true, transactions, summary: { income, expense, balance: income - expense } });
      }
      if (m === 'POST') {
        const id = uid('transaction');
        const transaction = { id, ...body, createdBy: user.id, createdAt: now() };
        await set(`transaction:${id}`, transaction);
        return sendJson(res, 200, { success: true, transaction });
      }
    }

    // Admin: Manage Giving Categories
    if (resource === 'giving' && a === 'categories') {
      if (m === 'POST' || m === 'PUT') {
        const { categories } = body;
        if (!categories || !Array.isArray(categories)) {
          return sendError(res, 400, 'Format categories harus array');
        }
        await set('settings:giving_categories', categories);
        return sendJson(res, 200, { success: true, categories });
      }
    }

    // Admin: Manage / View Giving Submissions
    if (resource === 'giving' && a === 'submissions') {
      if (m === 'GET') {
        const items = (await byPrefix('giving:submission:')).filter((x) => x.id)
          .sort((x, y) => new Date(y.submittedAt || y.createdAt) - new Date(x.submittedAt || x.createdAt));
        return sendJson(res, 200, { success: true, submissions: items });
      }
      if (m === 'PUT' && b) {
        // update status submission (verified / rejected)
        const sub = await get(`giving:submission:${b}`);
        if (!sub) return sendError(res, 404, 'Data konfirmasi persembahan tidak ditemukan');
        const updated = { ...sub, ...body, id: b, updatedAt: now(), updatedBy: user.id };
        await set(`giving:submission:${b}`, updated);
        return sendJson(res, 200, { success: true, submission: updated });
      }
      if (m === 'DELETE' && b) {
        await del(`giving:submission:${b}`);
        return sendJson(res, 200, { success: true });
      }
    }

    return sendError(res, 404, 'Route not found');
  } catch (error) {
    console.error('content error:', error);
    return sendError(res, 500, error.message || 'Server error');
  }
}
