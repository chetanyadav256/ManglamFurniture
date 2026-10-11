// Per-account limits apply across IP addresses, before any bcrypt work.
// Like the existing login limiter, this is local to one server process.
const attempts = new Map();
const windowMs = 15 * 60 * 1000;
const maximumAttempts = 5;
const maximumAccounts = 10000;

export function passwordRateLimit(req, res, next) {
  const now = Date.now();
  const key = String(req.admin._id);
  for (const [id, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(id);
  }
  let entry = attempts.get(key);
  if (!entry && attempts.size < maximumAccounts) {
    entry = { count: 0, resetAt: now + windowMs };
    attempts.set(key, entry);
  }
  if (!entry || entry.count >= maximumAttempts) {
    res.set('Retry-After', String(Math.ceil(((entry?.resetAt ?? now + windowMs) - now) / 1000)));
    return res.status(429).json({ message: 'Too many password-change attempts. Try again later.' });
  }
  entry.count++;
  return next();
}
