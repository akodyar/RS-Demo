import express from 'express';
import path from 'path';
import crypto from 'node:crypto';
import helmet from 'helmet';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { loadServerConfig } from './src/server/config/env.js';
import { queueService } from './src/server/services/queue-service.js';
import { storageService } from './src/server/services/storage-service.js';
import { cronService } from './src/server/services/cron.js';

// API Routers
import apiRouter from './src/server/routes/api.js';
import { pool, closePool } from './src/db/index.js';

const config = loadServerConfig();

export async function createApp() {
  const app = express();

  // Trust the first proxy hop (e.g. Google Cloud Run load balancer / NGINX / Cloudflare)
  app.set('trust proxy', 1);

  // 1. Request Correlation ID
  app.use((req, res, next) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  });

  // 2. Global Security Headers (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: config.nodeEnv === 'production' ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", ...config.allowedOrigins, 'https://identitytoolkit.googleapis.com'],
        },
      } : false, // In development Vite uses inline scripts / websockets
      crossOriginEmbedderPolicy: false,
    })
  );

  // 3. Strict CORS Policy
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (config.allowedOrigins.includes(origin) || config.nodeEnv !== 'production') {
          return callback(null, true);
        }
        return callback(new Error('Blocked by CORS policy'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'x-platform-tenant'],
    })
  );

  // 4. Request Body Size Limits (Protection against payload DoS)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // ==========================================
  // TOP-LEVEL HEALTH, READINESS & LIVENESS PROBES
  // ==========================================

  // Liveness probe: Is process alive and responsive?
  app.get('/liveness', (req, res) => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // Health endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'homehub-platform',
      version: '1.0.0',
      nodeEnv: config.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness probe: Are all critical dependencies ready to serve traffic?
  app.get('/readiness', async (req, res) => {
    let dbStatus = 'UNAVAILABLE';
    let isDbHealthy = false;

    // Check PostgreSQL
    try {
      await pool.query('SELECT 1');
      dbStatus = 'CONNECTED';
      isDbHealthy = true;
    } catch (err: any) {
      dbStatus = 'FAILED';
      console.error('[READINESS] DB check failed:', err.message);
    }

    // Check Queue
    const queueHealth = await queueService.checkQueueHealth();

    const isReady = isDbHealthy;
    const statusCode = isReady ? 200 : 503;

    res.status(statusCode).json({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbStatus,
          critical: true,
          healthy: isDbHealthy,
        },
        queue: {
          engine: queueHealth.engine,
          status: queueHealth.status,
          critical: false,
          healthy: queueHealth.status !== 'UNAVAILABLE',
        },
      },
    });
  });

  // Legacy /api/health endpoint
  app.get('/api/health', async (req, res) => {
    let dbStatus = 'DATABASE_UNAVAILABLE';
    const hasConfig = Boolean(process.env.DATABASE_URL || (process.env.SQL_HOST && process.env.SQL_DB_NAME));
    if (!hasConfig) {
      dbStatus = 'DATABASE_NOT_CONFIGURED';
    } else {
      try {
        await pool.query('SELECT 1');
        dbStatus = 'DATABASE_CONNECTED';
      } catch (e: any) {
        dbStatus = 'DATABASE_CONFIGURATION_ERROR';
      }
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    });
  });

  // --- API Routes (Server-Side Authorization Enforced Here) ---
  app.use('/api', apiRouter);

  // Direct static download endpoint for prompt files & archives
  app.use('/prompts', express.static(path.join(process.cwd(), 'public/prompts')));

  // Static build serving (production or explicit SERVE_STATIC) vs Vite middleware
  const serveStatic = process.env.SERVE_STATIC === 'true' || config.nodeEnv === 'production';
  if (serveStatic) {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    let cachedHtml: string | null = null;
    app.get('*', async (req, res, next) => {
      try {
        if (!cachedHtml) {
          const fs = await import('fs');
          const raw = await fs.promises.readFile(path.resolve(process.cwd(), 'index.html'), 'utf-8');
          cachedHtml = await vite.transformIndexHtml('/', raw);
        }
        res.status(200).set({ 'Content-Type': 'text/html' }).end(cachedHtml);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  return app;
}

export async function startServer() {
  // Pre-flight check: Ensure 100% credential validity across all active users
  try {
    const unhashed = await pool.query(`SELECT count(*) as count FROM users WHERE password_hash IS NULL`);
    const count = parseInt(unhashed.rows[0]?.count || '0', 10);
    if (count > 0) {
      console.warn(`[HOMEHUB-SECURITY] Self-healing ${count} unhashed user account(s)...`);
      const { ensureAllUsersHashed } = await import('./scripts/ensure-all-users-hashed.js');
      await ensureAllUsersHashed();
    }
  } catch (err: any) {
    console.warn('[HOMEHUB-SECURITY] Credential invariant check warning:', err.message);
  }

  const app = await createApp();
  const PORT = config.port;

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HOMEHUB] Production server running on http://0.0.0.0:${PORT} in [${config.nodeEnv}] mode`);
    cronService.start();
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[HOMEHUB] Received ${signal}. Starting graceful shutdown...`);

    // 1. Stop accepting new connections
    server.close(async () => {
      console.log('[HOMEHUB] HTTP server closed.');

      // 2. Shut down background workers
      await queueService.shutdown();
      cronService.stop();

      // 3. Drain and close database pool
      try {
        await closePool();
        console.log('[HOMEHUB] Database pool drained.');
      } catch (err: any) {
        console.error('[HOMEHUB] Error closing DB pool:', err.message);
      }

      console.log('[HOMEHUB] Graceful shutdown completed cleanly.');
      process.exit(0);
    });

    // Force exit if shutdown hangs beyond 10 seconds
    setTimeout(() => {
      console.error('[HOMEHUB] Forcing shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

// Support direct execution in both ESM and CJS bundle formats
const isDirectExecution = 
  (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) ||
  (typeof process !== 'undefined' && process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.cjs')));

if (isDirectExecution) {
  const args = process.argv.slice(2);

  if (args.includes('--migrate')) {
    import('./scripts/migrate.js')
      .then(({ runMigrations }) => runMigrations())
      .then((res) => {
        console.log('[HOMEHUB] Migration completed successfully:', res);
        process.exit(0);
      })
      .catch((err) => {
        console.error('[HOMEHUB] Migration failed:', err);
        process.exit(1);
      });
  } else if (args.includes('--bootstrap-roles')) {
    import('./scripts/bootstrap-roles.js')
      .then(({ bootstrapDatabaseRoles }) => bootstrapDatabaseRoles())
      .then((res) => {
        console.log('[HOMEHUB] Database role bootstrap completed successfully:', res);
        process.exit(0);
      })
      .catch((err) => {
        console.error('[HOMEHUB] Database role bootstrap failed:', err);
        process.exit(1);
      });
  } else if (args.includes('--backup')) {
    import('./scripts/backup.js')
      .then(({ createDatabaseBackup }) => createDatabaseBackup())
      .then((res) => {
        console.log('[HOMEHUB] Backup completed successfully. Checksum:', res.manifest.sha256Checksum);
        process.exit(0);
      })
      .catch((err) => {
        console.error('[HOMEHUB] Backup failed:', err);
        process.exit(1);
      });
  } else if (args.includes('--worker-mode')) {
    console.log('[HOMEHUB] Starting dedicated background worker service...');
    cronService.start();
    const shutdownWorker = async (signal: string) => {
      console.log(`[HOMEHUB-WORKER] Received ${signal}. Draining queue and shutting down...`);
      await queueService.shutdown();
      cronService.stop();
      process.exit(0);
    };
    process.on('SIGTERM', () => shutdownWorker('SIGTERM'));
    process.on('SIGINT', () => shutdownWorker('SIGINT'));
    console.log('[HOMEHUB-WORKER] Continuous worker processing loop active.');
  } else {
    startServer().catch((err) => {
      console.error('[HOMEHUB] Fatal error during startup:', err);
      process.exit(1);
    });
  }
}
