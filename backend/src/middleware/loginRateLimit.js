const windowMs = 15 * 60 * 1000;
const maximumAttempts = 10;
const maximumTrackedAddresses = 10000;
const attemptsByAddress = new Map();

export function loginRateLimit(req, res, next) {
  const now = Date.now();
  const address = req.ip || req.socket.remoteAddress || 'unknown';
  let entry = attemptsByAddress.get(address);
  if (entry?.resetAt <= now) {
    attemptsByAddress.delete(address);
    entry = undefined;
  }
  if (!entry) {
    if (attemptsByAddress.size >= maximumTrackedAddresses) {
      for (const [trackedAddress, trackedEntry] of attemptsByAddress) {
        if (trackedEntry.resetAt <= now) attemptsByAddress.delete(trackedAddress);
      }
    }
    if (attemptsByAddress.size >= maximumTrackedAddresses) {
      return res.status(429).json({ message: 'Too many login attempts. Try again later.' });
    }
    entry = { count: 0, resetAt: now + windowMs };
    attemptsByAddress.set(address, entry);
  }
  if (entry.count >= maximumAttempts) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ message: 'Too many login attempts. Try again later.' });
  }
  entry.count += 1;
  return next();
}
