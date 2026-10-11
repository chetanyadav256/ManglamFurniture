import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  if (!env.mongodbUri) {
    throw new Error('MONGODB_URI must be configured before starting the API.');
  }

  // Startup awaits this connection; never log the URI or raw driver errors.
  await mongoose.connect(env.mongodbUri, {
    serverSelectionTimeoutMS: 30000,
    // Public API startup must not create collections or indexes.
    autoCreate: false,
    autoIndex: false,
  });
  console.info('MongoDB connected.');
}

export function getDatabaseStatus() {
  if (!env.mongodbUri) return 'not_configured';
  return ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
}
