import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import Category from '../src/models/Category.js';

try {
  await connectDatabase();
  await Category.collection.createIndex(
    { name: 1 },
    { unique: true, collation: { locale: 'en', strength: 2 } },
  );
  await Category.collection.createIndex({ slug: 1 }, { unique: true });
  console.info('Category unique indexes are ready.');
} catch {
  console.error('Category index setup failed. Check database availability, permissions, and whether duplicate categories exist.');
  process.exitCode = 1;
} finally {
  try {
    await mongoose.disconnect();
  } catch {
    console.error('Could not close the configured MongoDB connection cleanly.');
    process.exitCode = 1;
  }
}
