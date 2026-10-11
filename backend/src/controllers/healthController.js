import { getDatabaseStatus } from '../config/db.js';

// Liveness endpoint: database readiness is reported separately.
export function getHealth(req, res) {
  res.set('Cache-Control', 'no-store').status(200).json({
    status: 'ok',
    service: 'Manglam Furniture API',
    database: getDatabaseStatus(),
  });
}
