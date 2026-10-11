import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';

export async function changeAdminPassword(req, res) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== 2 || !Object.hasOwn(body, 'currentPassword')
    || !Object.hasOwn(body, 'newPassword') || Object.keys(req.query).length
    || typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') {
    return res.status(400).json({ message: 'Provide only currentPassword and newPassword as strings.' });
  }
  const { currentPassword, newPassword } = body;
  // Preserve verification of legacy passwords accepted by the existing login flow.
  if (!currentPassword.length || currentPassword.length > 1024) {
    return res.status(400).json({ message: 'A valid current password is required.' });
  }
  if ([...newPassword].length < 12 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json({ message: 'New password must contain at least 12 characters and no more than 72 UTF-8 bytes.' });
  }
  const admin = await Admin.findById(req.admin._id).select('+passwordHash tokenVersion isActive role').lean();
  const version = req.admin.tokenVersion ?? 0;
  if (!admin || !admin.isActive || !['admin', 'superadmin'].includes(admin.role)
    || (admin.tokenVersion ?? 0) !== version) {
    return res.status(401).json({ message: 'Your session is no longer valid. Please sign in again.' });
  }
  if (!await bcrypt.compare(currentPassword, admin.passwordHash)) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }
  if (await bcrypt.compare(newPassword, admin.passwordHash)) {
    return res.status(400).json({ message: 'New password must differ from the current password.' });
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  // Compare-and-swap: only one request using this hash/version can succeed.
  // Missing versions on older records are equivalent to zero; $inc creates the field.
  const result = await Admin.updateOne({
    _id: req.admin._id,
    isActive: true,
    role: { $in: ['admin', 'superadmin'] },
    passwordHash: admin.passwordHash,
    ...(version === 0
      ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] }
      : { tokenVersion: version }),
  }, { $set: { passwordHash }, $inc: { tokenVersion: 1 } }, { runValidators: true });
  if (result.modifiedCount !== 1) {
    return res.status(409).json({ message: 'Account changed during this request. Please sign in again.' });
  }
  return res.set('Cache-Control', 'no-store').json({ message: 'Password changed. Please sign in again.' });
}
