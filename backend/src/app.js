import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import healthRoutes from './routes/healthRoutes.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: env.clientOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/health', healthRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
