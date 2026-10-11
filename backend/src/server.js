import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { validateJwtConfig } from './middleware/adminAuth.js';

try {
  validateJwtConfig();
  await connectDatabase();
  const server = app.listen(env.port, env.host, () => {
    console.info(`Manglam Furniture API listening on ${env.host}:${env.port}`);
  });

  server.on('error', (error) => {
    console.error(`Server failed to listen (${error.code || 'unknown error'}). Check HOST and PORT.`);
    process.exit(1);
  });

  let shuttingDown = false;
  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
      try {
        await mongoose.disconnect();
        process.exit(0);
      } catch {
        process.exit(1);
      }
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  if (error.message.startsWith('JWT_')) {
    console.error(`Startup failed: ${error.message}`);
  } else {
    console.error('Startup failed. Check MONGODB_URI and make sure MongoDB is reachable.');
  }
  process.exit(1);
}
