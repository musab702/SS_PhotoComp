import path from 'node:path';
import express from 'express';
import type { Express } from 'express';
import { healthRouter } from './routes/health';
import { competitionRouter, errorHandler } from './routes/competition';
import { JsonStore } from './store';

export interface AppOptions {
  /** Folder holding `db.json` and `uploads/`. Defaults to `server/data`. */
  dataDir?: string;
  adminPasscode?: string;
}

/**
 * Builds the Express app. Kept separate from `index.ts` so the app can be
 * imported by tests without binding a port.
 */
export function createApp(options: AppOptions = {}): Express {
  const dataDir = options.dataDir ?? path.resolve(__dirname, '..', 'data');
  const app = express();

  app.use(express.json());

  // All API routes live under /api, which is what the Angular dev proxy forwards.
  app.use('/api', healthRouter);
  app.use(
    '/api',
    competitionRouter({
      store: new JsonStore(path.join(dataDir, 'db.json')),
      uploadsDir: path.join(dataDir, 'uploads'),
      adminPasscode: options.adminPasscode ?? 'admin',
    }),
  );
  app.use(errorHandler);

  return app;
}
