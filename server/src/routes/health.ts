import { Router } from 'express';

/** Shape returned by `GET /api/health`. */
export interface HealthResponse {
  status: 'ok';
}

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const body: HealthResponse = { status: 'ok' };
  res.json(body);
});
