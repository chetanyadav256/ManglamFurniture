import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import Admin from '../models/Admin.js';
import { createAdminToken } from '../middleware/adminAuth.js';

const dummyPasswordHash = bcrypt.hashSync(randomBytes(32).toString('hex'), 12);

function publicAdmin(admin) {
  return {
    id: String(admin._id),
    name: admin.name,
    email: admin.email,
    role: admin.role,
  };
}

function validEmail(value) {
  return typeof value === 'string'
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function loginAdmin(req, res) {
  const { email, password } = req.body ?? {};
  if (!validEmail(email) || typeof password !== 'string' || password.length < 1 || password.length > 1024) {
    return res.status(400).json({ message: 'A valid email and password are required.' });
  }

  const normalizedEmail = email.normalize('NFKC').trim().toLowerCase();
  const admin = await Admin.findOne({ email: normalizedEmail }).select('+passwordHash').lean();
  const passwordMatches = await bcrypt.compare(password, admin?.passwordHash ?? dummyPasswordHash);
  if (!admin || !admin.isActive || !passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = createAdminToken(admin);
  return res.set('Cache-Control', 'no-store').json({ token, admin: publicAdmin(admin) });
}

export function getCurrentAdmin(req, res) {
  res.set('Cache-Control', 'no-store').json({ admin: publicAdmin(req.admin) });
}
