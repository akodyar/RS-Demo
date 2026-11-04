import { Request, Response, NextFunction } from 'express';
import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';

let isDbHealthy = false;
let lastCheckTime = 0;

export const resetDbHealthCache = () => {
  isDbHealthy = false;
  lastCheckTime = 0;
};

export const requireDatabase = async (req: Request, res: Response, next: NextFunction) => {
  // Always check environment variables first
  const isEnvConfigured = Boolean(process.env.SQL_HOST || process.env.DATABASE_URL);
  
  if (!isEnvConfigured) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      code: 'DATABASE_NOT_CONFIGURED',
      message: 'DATABASE_NOT_CONFIGURED',
    });
  }

  // Active connection check (cached for 10 seconds to avoid overhead)
  const now = Date.now();
  if (now - lastCheckTime > 10000) {
    try {
      await db.execute(sql`SELECT 1`);
      isDbHealthy = true;
      lastCheckTime = now;
    } catch (err: any) {
      isDbHealthy = false;
      lastCheckTime = now;
    }
  }

  if (!isDbHealthy) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      code: 'DATABASE_NOT_CONFIGURED',
      message: 'The authoritative relational storage service is unreachable. Fail-closed enforced.',
    });
  }

  next();
};
