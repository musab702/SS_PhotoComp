import express from 'express';
import type { Express } from 'express';
import { healthRouter } from './routes/health';

/**
 * Builds the Express app. Kept separate from `index.ts` so the app can be
 * imported by tests without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  // All API routes live under /api, which is what the Angular dev proxy forwards.
  app.use('/api', healthRouter);

  return app;
}
