import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const developmentOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function parseClientOrigins(value, nodeEnv) {
  if (!value?.trim()) {
    if (nodeEnv === 'production') {
      throw new Error('CLIENT_ORIGIN must list the deployed frontend origin in production.');
    }
    return developmentOrigins;
  }

  const origins = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  const normalizedOrigins = origins.map((origin) => {
    try {
      const url = new URL(origin);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.origin === 'null' ||
        url.username ||
        url.password ||
        (url.pathname !== '/' && url.pathname !== '') ||
        url.search ||
        url.hash
      ) {
        throw new Error();
      }
      return url.origin;
    } catch {
      throw new Error('CLIENT_ORIGIN must contain only comma-separated HTTP(S) origins.');
    }
  });

  return [...new Set(normalizedOrigins)];
}

export function parseEnv(source = process.env) {
  const nodeEnv = source.NODE_ENV?.trim() || 'development';
  const port = Number(source.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const configuredHost = source.HOST?.trim();
  if (nodeEnv === 'production' && configuredHost && configuredHost !== '0.0.0.0') {
    throw new Error('HOST must be 0.0.0.0 in production.');
  }

  return {
    nodeEnv,
    host: nodeEnv === 'production' ? '0.0.0.0' : configuredHost || '127.0.0.1',
    port,
    clientOrigins: parseClientOrigins(source.CLIENT_ORIGIN, nodeEnv),
    trustProxy: nodeEnv === 'production' ? 1 : false,
    mongodbUri: source.MONGODB_URI?.trim() || '',
    jwtSecret: source.JWT_SECRET?.trim() || '',
    jwtExpiresIn: source.JWT_EXPIRES_IN?.trim() || '1d',
  };
}

export const env = parseEnv();
