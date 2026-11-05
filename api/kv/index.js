import sql from '../_lib/db.js';
import { requireUser } from '../_lib/guard.js';
import { sendJson, sendError } from '../_lib/http.js';

export default async function handler(req, res) {
  const { prefix, pattern } = req.query;
  const isPublicPattern =
    (pattern && String(pattern).startsWith('custom_form:')) ||
    (prefix && String(prefix).startsWith('custom_form:'));

  if (!isPublicPattern && !(await requireUser(req, res))) return;

  if (req.method === 'GET') {
    // `pattern` is a full SQL LIKE pattern (wildcards allowed anywhere); `prefix` is the legacy form.
    const { prefix, pattern } = req.query;
    if (!prefix && !pattern) return sendError(res, 400, 'Prefix required');
    const like = pattern ? String(pattern) : prefix + '%';

    const records = await sql`
      SELECT key, value
      FROM app_kv
      WHERE key LIKE ${like}
    `;
    return sendJson(res, 200, { data: records });
  }

  res.setHeader('Allow', 'GET');
  return sendError(res, 405, 'Method not allowed');
}
