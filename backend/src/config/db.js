import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  if (!env.mongodbUri) {
    console.info('MongoDB is not configured; running the health-check-only setup.');
    return;
  }

  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 5000 });
  console.info('MongoDB connected.');
}

export function getDatabaseStatus() {
  if (!env.mongodbUri) return 'not_configured';
  return ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
}
