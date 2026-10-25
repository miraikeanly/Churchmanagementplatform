import bcrypt from 'bcryptjs';
import sql from '../db.js';
import { requireUser } from '../guard.js';
import { sendJson, sendError, getBody } from '../http.js';
import { logActivity } from '../audit.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const user = await requireUser(req, res);
    if (!user) return;

    try {
      const users = await sql`
        SELECT id, name, email, role, status, auth_provider, created_at, permissions
        FROM users
        WHERE role <> 'jemaat'
        ORDER BY created_at DESC
      `;
      return sendJson(res, 200, { success: true, data: users });
    } catch (err) {
      console.warn('users_list DB error:', err?.message);
      return sendJson(res, 200, {
        success: true,
        data: [
          { id: '1', name: 'Maryellen', email: 'maryelleneun@gmail.com', role: 'super_admin', status: 'approved' },
          { id: '2', name: 'Maryellen Eunike', email: 'maryelleneunike25@gmail.com', role: 'super_admin', status: 'approved' }
        ],
        quotaExceeded: true
      });
    }
  }

  // Add a user directly (approved immediately, since a super admin is creating it)
  if (req.method === 'POST') {
    const admin = await requireUser(req, res, { role: 'super_admin' });
    if (!admin) return;
    const { name, email: rawEmail, password, role = 'admin', status = 'approved', permissions } = getBody(req);
    if (!name || !String(name).trim() || !rawEmail || !password) {
      return sendError(res, 400, 'Nama, email, dan password wajib diisi');
    }
    if (String(password).length < 6) return sendError(res, 400, 'Password minimal 6 karakter');
    if (!['admin', 'super_admin'].includes(role)) return sendError(res, 400, 'Role tidak valid');
    if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) return sendError(res, 400, 'Status tidak valid');

    const email = String(rawEmail).trim().toLowerCase();
    if (!email.includes('@')) return sendError(res, 400, 'Email tidak valid');

    try {
      const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (existing.length > 0) return sendError(res, 400, 'Email sudah terdaftar');

      const hash = await bcrypt.hash(String(password), 10);
      const approved = status === 'approved';
      const inserted = await sql`
        INSERT INTO users (email, name, password_hash, auth_provider, status, role, permissions, approved_by, approved_at)
        VALUES (
          ${email}, ${String(name).trim()}, ${hash}, 'email', ${status}, ${role},
          ${JSON.stringify(permissions || {})}::jsonb,
          ${approved ? admin.id : null}, ${approved ? sql`now()` : null}
        )
        RETURNING id, email, name, status, role
      `;

      await logActivity({
        userId: admin.id,
        action: 'CREATE',
        target: 'User Management',
        detail: { message: `Menambah admin/pengguna baru: ${name} (${email}) dengan role ${role}`, email, role, status },
      });

      return sendJson(res, 200, { success: true, user: inserted[0] });
    } catch (err) {
      console.error('create user error:', err);
      return sendError(res, 500, 'Gagal menambah pengguna');
    }
  }


  res.setHeader('Allow', 'GET, POST');
  return sendError(res, 405, 'Method not allowed');
}
