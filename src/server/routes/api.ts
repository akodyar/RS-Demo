import { Router, Request, Response, NextFunction } from 'express';

import rateLimit from 'express-rate-limit';

import authRouter from './auth.js';
import { requireDatabase } from '../middleware/dbGuard.js';
import { requireAuth } from '../middleware/auth.js';
import propertiesRouter from './properties.js';
import leasesRouter from './leases';
import marketplaceRouter from './marketplace';
import financialsRouter from './financials';
import maintenanceRouter from './maintenance';
import analyticsRouter from './analytics';
import trustRouter from './trust';
import crmRouter from './crm';
import communicationsRouter from './communications';
import documentsRouter from './documents';
import contractsRouter from './contracts';
import passportRouter from './passport';
import adminRouter from './admin';
import ownerRouter from './owner';
import companyRouter from './company';
import tenantRouter from './tenant';
import buyerRouter from './buyer.js';
import { agentRouter } from './agent.js';
import { vendorRouter } from './vendor.js';
import integrationsRouter from './integrations';
import webhooksRouter from './webhooks';
import intelligenceRouter from './intelligence';
import storageRouter from './storage.js';
import { rentalAcquisitionRouter } from './rental-acquisition.js';
import { salesRouter } from './sales.js';
import { managementRouter } from './management.js';
import { settlementRouter } from './settlements.js';
import reviewsRouter from './reviews.js';
import pointsRouter from './points.js';
import promotionsRouter from './promotions.js';

import { sendSafeError } from '../utils/errorSanitizer.js';
import { FeatureFlags } from '../../utils/featureFlags.js';

const apiRouter = Router();

// ==========================================
// STAGE 17: PRODUCTION API SECURITY HARDENING
// ==========================================

// Helmet and CORS are configured at the app level in server.ts

// 3. API Rate Limiting (Tiered Abuse Protection)
const isProduction = process.env.NODE_ENV === 'production';

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || (isProduction ? '500' : '5000'), 10),
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { 
    xForwardedForHeader: false,
    default: true
  },
});

// Stricter rate limiter for sensitive authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || (isProduction ? '30' : '300'), 10),
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { 
    xForwardedForHeader: false,
    default: true
  },
});

// Stricter rate limiter for resource-intensive AI endpoints
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AI_RATE_LIMIT_MAX || (isProduction ? '50' : '500'), 10),
  message: { error: 'TOO_MANY_REQUESTS', message: 'AI generation limit reached. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { 
    xForwardedForHeader: false,
    default: true
  },
});

apiRouter.use(apiLimiter);

// Top-level API Health Check
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'homehub-api' });
});

// 4. Global DB Fail-Closed Guard
apiRouter.use(requireDatabase);

// Feature Flag Guards
const requireBuySellEnabled = (req: Request, res: Response, next: NextFunction) => {
  if (!FeatureFlags.BUY_SELL_ENABLED) {
    return res.status(403).json({ error: 'BUY_SELL_DISABLED', message: 'Buying and selling functionality is currently disabled.' });
  }
  next();
};

// Mount Domain Routers with appropriate tiered rate limiters
apiRouter.use('/auth', authLimiter, authRouter);
apiRouter.use('/properties', propertiesRouter);
apiRouter.use('/leases', leasesRouter);
apiRouter.use('/marketplace', marketplaceRouter);
apiRouter.use('/financials', financialsRouter);
apiRouter.use('/maintenance', maintenanceRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/trust', trustRouter);
apiRouter.use('/crm', crmRouter);
apiRouter.use('/communications', communicationsRouter);
apiRouter.use('/documents', documentsRouter);
apiRouter.use('/contracts', contractsRouter);
apiRouter.use('/passport', passportRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/owner', ownerRouter);
apiRouter.use('/company', companyRouter);
apiRouter.use('/tenant', tenantRouter);
apiRouter.use('/buyer', requireAuth, requireBuySellEnabled, buyerRouter);
apiRouter.use('/agent', agentRouter);
apiRouter.use('/vendor', vendorRouter);
apiRouter.use('/integrations', integrationsRouter);
apiRouter.use('/webhooks', webhooksRouter);
apiRouter.use('/intelligence', aiLimiter, intelligenceRouter);
apiRouter.use('/storage', storageRouter);
apiRouter.use('/rental-acquisition', rentalAcquisitionRouter);
apiRouter.use('/rental-acquisitions', rentalAcquisitionRouter);
apiRouter.use('/sales', requireAuth, requireBuySellEnabled, salesRouter);
apiRouter.use('/management', managementRouter);
apiRouter.use('/settlements', settlementRouter);
apiRouter.use('/reviews', reviewsRouter);
apiRouter.use('/points', pointsRouter);
apiRouter.use('/promotions', promotionsRouter);

// 404 handler for unmatched API routes (prevents falling through to SPA HTML fallback)
apiRouter.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `API endpoint '${req.method} ${req.originalUrl}' not found.` });
});

// ==========================================
// GLOBAL SAFE ERROR HANDLER (Output Security)
// ==========================================
apiRouter.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[API Error]: ${err.message}`);
  sendSafeError(res, err, 500, 'An unexpected error occurred. See server logs for details.');
});

export default apiRouter;
