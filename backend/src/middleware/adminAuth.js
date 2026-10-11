import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import { env } from '../config/env.js';

export function validateJwtConfig() {
  const distinctCharacters = new Set(env.jwtSecret).size;
  if (Buffer.byteLength(env.jwtSecret, 'utf8') < 32 || distinctCharacters < 12) {
    throw new Error('JWT_SECRET must contain at least 32 bytes and 12 distinct characters.');
  }
  if (!/^[1-9]\d*[smhd]$/.test(env.jwtExpiresIn)) {
    throw new Error('JWT_EXPIRES_IN must be a positive duration such as 15m, 12h, or 1d.');
  }
}

export function createAdminToken(admin) {
  validateJwtConfig();
  return jwt.sign(
    { sub: String(admin._id) },
    env.jwtSecret,
    { algorithm: 'HS256', expiresIn: env.jwtExpiresIn },
  );
}

export function requireAdminRole(requiredRole = 'admin') {
  return async function authenticateAdmin(req, res, next) {
    const authorization = req.get('authorization');
    const match = typeof authorization === 'string'
      ? /^Bearer ([^\s]+)$/i.exec(authorization)
      : null;
    if (!match) return res.status(401).json({ message: 'Authentication required.' });

    try {
      validateJwtConfig();
      const payload = jwt.verify(match[1], env.jwtSecret, { algorithms: ['HS256'] });
      if (!payload || typeof payload !== 'object' || typeof payload.sub !== 'string') {
        return res.status(401).json({ message: 'Invalid or expired authentication token.' });
      }
      const admin = await Admin.findById(payload.sub).select('name email role isActive').lean();
      if (!admin || !admin.isActive) {
        return res.status(401).json({ message: 'Invalid or expired authentication token.' });
      }
      if (admin.role !== requiredRole && admin.role !== 'superadmin') {
        return res.status(403).json({ message: 'You do not have permission to access this resource.' });
      }
      req.admin = admin;
      return next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ message: 'Invalid or expired authentication token.' });
      }
      return next(error);
    }
  };
}
