import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { analyticsService } from '../services/analytics.js';
import { valuationService } from '../services/valuation.js';
import { auditService } from '../services/audit.js';
import { UserRole, AIRecommendationStatus } from '../../types/index.js';

const router = Router();

export const ALLOWED_ANALYTICS_ROLES = [
  UserRole.PROPERTY_OWNER,
  'PROPERTY_OWNER',
  'OWNER',
  UserRole.COMPANY,
  'COMPANY_ADMIN',
  'COMPANY_MEMBER',
  'ACCOUNTANT',
  UserRole.PLATFORM_ADMIN,
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'FINANCE_ADMIN',
];

export const isAuthorizedForAnalytics = (user: any): boolean => {
  if (!user || !user.roles) return false;
  return user.roles.some((r: any) => ALLOWED_ANALYTICS_ROLES.includes(r));
};

export const handleAnalyticsError = (arg1: any, arg2: any) => {
  const res: Response = (arg1 && typeof arg1.status === 'function') ? arg1 : arg2;
  const error: any = (arg1 && typeof arg1.status === 'function') ? arg2 : arg1;

  console.error('Analytics Route Error:', error);

  if (!res || typeof res.status !== 'function') {
    console.error('handleAnalyticsError: No valid response object provided');
    return;
  }

  if (error?.status === 403 || error?.message?.includes('AUTHORITY_REQUIRED') || error?.message?.includes('FORBIDDEN')) {
    return res.status(403).json({ error: 'Forbidden: Insufficient authority for requested analytical scope' });
  }

  if (error?.status === 404 || error?.message?.includes('NOT_FOUND')) {
    return res.status(404).json({ error: error?.message || 'Resource not found' });
  }

  if (error?.status === 400 || error?.message?.includes('VALIDATION_ERROR')) {
    return res.status(400).json({ error: error?.message });
  }

  return res.status(500).json({ error: error?.message || 'Internal Server Error' });
};

// Middleware: Role gatekeeper
const requireAnalyticsRole = (req: Request, res: Response, next: any) => {
  if (!isAuthorizedForAnalytics(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges to access property or portfolio analytics' });
  }
  next();
};

import { requireDatabase } from '../middleware/dbGuard.js';

const checkDbConfig = requireDatabase;

// ==========================================
// 1. PORTFOLIO ANALYTICS
// ==========================================

/**
 * GET /api/analytics/portfolio
 * Rollup overview of the caller's server-authorized portfolio.
 */
router.get('/portfolio', requireAuth, requireDatabase, requireAnalyticsRole, checkDbConfig, async (req: Request, res: Response) => {
  try {
    const currency = (req.query.currency as string) || 'USD';
    const overview = await analyticsService.getPortfolioOverview(req.user!, currency);
    res.json(overview);
  } catch (error: any) {
    handleAnalyticsError(res, error);
  }
});

/**
 * GET /api/analytics/portfolio/properties
 * Comparative listing of individual properties in caller's portfolio.
 */
router.get('/portfolio/properties', requireAuth, requireDatabase, requireAnalyticsRole, checkDbConfig, async (req: Request, res: Response) => {
  try {
    const currency = (req.query.currency as string) || 'USD';
    const propertiesList = await analyticsService.getPortfolioPropertiesComparison(req.user!, currency);
    res.json(propertiesList);
  } catch (error: any) {
    handleAnalyticsError(res, error);
  }
});

/**
 * GET /api/analytics/portfolio/distributions
 * Asset type, geographic, revenue, and occupancy distributions for caller's portfolio.
 */
router.get('/portfolio/distributions', requireAuth, requireDatabase, requireAnalyticsRole, checkDbConfig, async (req: Request, res: Response) => {
  try {
    const currency = (req.query.currency as string) || 'USD';
    const distributions = await analyticsService.getPortfolioDistributions(req.user!, currency);
    res.json(distributions);
  } catch (error: any) {
    handleAnalyticsError(res, error);
  }
});

/**
 * GET /api/analytics/portfolio/snapshots
 * Query historical portfolio snapshots.
 */
router.get('/portfolio/snapshots', requireAuth, requireDatabase, requireAnalyticsRole, checkDbConfig, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const snapshots = await analyticsService.getPortfolioSnapshots(req.user!, startDate, endDate);
    res.json(snapshots);
  } catch (error: any) {
    handleAnalyticsError(res, error);
  }
});

/**
 * POST /api/analytics/portfolio/snapshots
 * Capture a new immutable snapshot of caller's current authorized portfolio.
 */
router.post('/portfolio/snapshots', requireAuth, requireDatabase, requireAnalyticsRole, checkDbConfig, async (req: Request, res: Response) => {
  try {
    const currency = (req.body.currency as string) || 'USD';
    const snapshot = await analyticsService.capturePortfolioSnapshot(req.user!, currency);
    
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'CAPTURE_PORTFOLIO_SNAPSHOT',
      resourceType: 'PortfolioSnapshot',
      resourceId: snapshot.id,
      changes: { snapshotDate: snapshot.snapshotDate, totalProperties: snapshot.totalProperties },
      ipAddress: (req.ip || '127.0.0.1') as string,
    });

    res.status(201).json(snapshot);
  } catch (error: any) {
    handleAnalyticsError(res, error);
  }
});

// ==========================================
// 2. PROPERTY PERFORMANCE & VALUATIONS
// ==========================================

/**
 * GET /api/analytics/properties/:id
 * Deep performance, revenue, arrears, and investment metrics for an authorized property.
 */
router.get('/properties/:id', requireAuth, requireDatabase, requireAnalyticsRole, checkDbConfig, async (req: Request, res: Response) => {
  try {
    const propertyId = req.params.id as string;
    const currency = (req.query.currency as string) || 'USD';
    const metrics = await analyticsService.getPropertyAnalytics(req.user!, propertyId, currency);
    res.json(metrics);
  } catch (error: any) {
    handleAnalyticsError(res, error);
  }
});

/**
 * GET /api/analytics/properties/:id/valuations
 * Valuation history for an authorized property.
 */
router.get('/properties/:id/valuations', requireAuth, requireDatabase, requireAnalyticsRole, checkDbConfig, async (req: Request, res: Response) => {
  try {
    const propertyId = req.params.id as string;
    const history = await valuationService.getValuationHistory(req.user!, propertyId);
    res.json(history);
  } catch (error: any) {
    handleAnalyticsError(res, error);
  }
});

/**
 * POST /api/analytics/properties/:id/valuations
 * Record a new valuation for an authorized property.
 */
router.post('/properties/:id/valuations', requireAuth, requireDatabase, requireAnalyticsRole, checkDbConfig, async (req: Request, res: Response) => {
  try {
    const propertyId = req.params.id as string;
    const { valuationDate, estimatedValue, currency, method, source, confidenceIndicator, documentUrl, notes } = req.body;

    const valuation = await valuationService.createValuation(req.user!, {
      propertyId,
      valuationDate,
      estimatedValue: Number(estimatedValue),
      currency,
      method,
      source,
      confidenceIndicator,
      documentUrl,
      notes,
    });

    res.status(201).json(valuation);
  } catch (error: any) {
    handleAnalyticsError(res, error);
  }
});

// ==========================================
// 3. INTERNAL MARKET INTELLIGENCE
// ==========================================

/**
 * GET /api/analytics/internal-market
 * Market benchmarks derived exclusively from internal HomeHub transactional data.
 */
router.get('/internal-market', requireAuth, requireDatabase, checkDbConfig, async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || 'Erbil';
    const benchmarks = await analyticsService.getInternalMarketBenchmarks(city);
    res.json(benchmarks);
  } catch (error: any) {
    handleAnalyticsError(res, error);
  }
});

// ==========================================
// 4. ADVISORY AI INSIGHTS
// ==========================================

/**
 * GET /api/analytics/ai/insights
 * Advisory AI explanations and recommendations based on caller's authorized portfolio.
 */
router.get('/ai/insights', requireAuth, requireDatabase, requireAnalyticsRole, checkDbConfig, async (req: Request, res: Response) => {
  try {
    const currency = (req.query.currency as string) || 'USD';
    const insights = await analyticsService.generateAdvisoryInsights(req.user!, currency);
    res.json({
      insights,
      disclaimer: 'AI recommendations are advisory and require human review. AI does not execute transactions.',
    });
  } catch (error: any) {
    handleAnalyticsError(res, error);
  }
});

/**
 * POST /api/analytics/recommendations/:id/acknowledge
 * Acknowledge or dismiss an advisory AI recommendation.
 */
router.post('/recommendations/:id/acknowledge', requireAuth, requireDatabase, requireAnalyticsRole, async (req: Request, res: Response) => {
  const recId = req.params.id;
  const { responseAction } = req.body; // 'ACCEPTED' | 'DISMISSED'
  const status = responseAction === 'ACCEPTED' ? AIRecommendationStatus.ACCEPTED : AIRecommendationStatus.DISMISSED;

  await auditService.logAction({
    actorUserId: req.user!.id,
    actorRole: req.user!.roles[0] as string,
    action: 'ACKNOWLEDGE_AI_RECOMMENDATION',
    resourceType: 'AIRecommendation',
    resourceId: recId as string,
    changes: { status },
    ipAddress: (req.ip || '127.0.0.1') as string,
  });

  res.json({ success: true, id: recId, status });
});

export default router;
