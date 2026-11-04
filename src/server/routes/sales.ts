import { Router } from 'express';
import { salesRepository } from '../repositories/sales.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../../types/index.js';
import { sendSafeError } from '../utils/errorSanitizer.js';
import { requireDatabase } from '../middleware/dbGuard.js';
import { FeatureFlags } from '../../utils/featureFlags.js';

export const salesRouter = Router();

// Strict Domain Protection: Buying and selling is disabled in current rental-only release
salesRouter.use(requireDatabase);
salesRouter.use((_req, res, next) => {
  if (!FeatureFlags.BUY_SELL_ENABLED) {
    return res.status(403).json({
      error: 'BUY_SELL_DISABLED',
      code: 'FEATURE_DISABLED',
      message: 'Buying and selling functionality is currently disabled in the rental-only release.',
    });
  }
  next();
});

salesRouter.post('/listings/:listingId/offers', requireAuth, requireRole([UserRole.BUYER, UserRole.TENANT, UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const offer = await salesRepository.submitOffer(req.user.id, req.params.listingId, req.body.amount, req.body.conditions);
    res.status(201).json(offer);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});

salesRouter.post('/offers/:offerId/counter', requireAuth, requireRole([UserRole.BUYER, UserRole.TENANT, UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const counter = await salesRepository.counterOffer(req.user.id, req.body.role, req.params.offerId, req.body.amount);
    res.status(201).json(counter);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});

salesRouter.post('/offers/:offerId/accept', requireAuth, requireRole([UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const accepted = await salesRepository.acceptOffer(req.user.id, req.params.offerId);
    res.json(accepted);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});

salesRouter.post('/offers/:offerId/contract', requireAuth, requireRole([UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const contract = await salesRepository.generateContract(req.user.id, req.params.offerId);
    res.status(201).json(contract);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});

salesRouter.post('/contracts/:contractId/transaction', requireAuth, requireRole([UserRole.BUYER, UserRole.TENANT, UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const tx = await salesRepository.initiateTransaction(req.user.id, req.params.contractId);
    res.status(201).json(tx);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});

salesRouter.post('/transactions/:transactionId/settlement', requireAuth, requireRole([UserRole.BUYER, UserRole.TENANT, UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const tx = await salesRepository.processSettlement(req.user.id, req.params.transactionId);
    res.json(tx);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});

salesRouter.post('/transactions/:transactionId/close', requireAuth, requireRole([UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const tx = await salesRepository.completeClosing(req.user.id, req.params.transactionId);
    res.json(tx);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});
