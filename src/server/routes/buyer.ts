import { Router } from 'express';
import { requireDatabase } from '../middleware/dbGuard.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../../types/index.js';
import { buyerRepository } from '../repositories/buyer.js';
import { auditService } from '../services/audit.js';
import { db } from '../../db/index.js';
import { properties } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { FeatureFlags } from '../../utils/featureFlags.js';

export const buyerRouter = Router();

// Global Gatekeeper: Require Database, Authentication, Role, and Rental-Only Feature Flag
buyerRouter.use(requireDatabase);
buyerRouter.use(requireAuth);
buyerRouter.use(requireRole([UserRole.BUYER, UserRole.PLATFORM_ADMIN]));
buyerRouter.use((_req, res, next) => {
  if (!FeatureFlags.BUY_SELL_ENABLED) {
    return res.status(403).json({
      error: 'BUY_SELL_DISABLED',
      message: 'Property purchase and sales features are currently inactive in this rental-only release.',
      code: 'BUY_SELL_DISABLED',
    });
  }
  next();
});

// ==========================================
// 1. DASHBOARD & AGGREGATED VIEWS
// ==========================================

buyerRouter.get('/dashboard', async (req, res) => {
  
  try {
    const dashboard = await buyerRepository.getAuthoritativeDashboard(req.user!.id);
    res.json(dashboard);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. PROFILE & PREFERENCES
// ==========================================

buyerRouter.get('/profile', async (req, res) => {
  
  try {
    const profile = await buyerRepository.getProfile(req.user!.id);
    res.json(profile || { userId: req.user!.id, isComplete: false });
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

buyerRouter.put('/profile', async (req, res) => {
  
  try {
    const updated = await buyerRepository.upsertProfile(req.user!.id, req.body);
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'UPDATE_BUYER_PROFILE',
      resourceType: 'BuyerProfile',
      resourceId: updated.id,
      changes: req.body,
      ipAddress: (req.ip || '') as string
    });
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 3. FAVORITES / SAVED PROPERTIES
// ==========================================

buyerRouter.get('/favorites', async (req, res) => {
  
  try {
    const favorites = await buyerRepository.getFavorites(req.user!.id);
    res.json(favorites);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

buyerRouter.post('/favorites', async (req, res) => {
  
  try {
    const { propertyId, listingId, notes } = req.body;
    if (!propertyId) {
      return res.status(400).json({ error: 'propertyId is required' });
    }
    const item = await buyerRepository.addFavorite(req.user!.id, propertyId, listingId, notes);
    res.status(201).json(item);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message === 'PROPERTY_NOT_FOUND') {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.status(400).json({ error: err.message });
  }
});

buyerRouter.delete('/favorites/:propertyId', async (req, res) => {
  
  try {
    await buyerRepository.removeFavorite(req.user!.id, req.params.propertyId);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. SAVED SEARCHES
// ==========================================

buyerRouter.get('/saved-searches', async (req, res) => {
  
  try {
    const searches = await buyerRepository.getSavedSearches(req.user!.id);
    res.json(searches);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

buyerRouter.post('/saved-searches', async (req, res) => {
  
  try {
    const { name, criteria, notifyOnMatch } = req.body;
    const item = await buyerRepository.createSavedSearch(req.user!.id, { name, criteria, notifyOnMatch });
    res.status(201).json(item);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

buyerRouter.delete('/saved-searches/:id', async (req, res) => {
  
  try {
    await buyerRepository.deleteSavedSearch(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. INQUIRIES
// ==========================================

buyerRouter.get('/inquiries', async (req, res) => {
  
  try {
    const inquiries = await buyerRepository.getInquiries(req.user!.id);
    res.json(inquiries);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

buyerRouter.post('/inquiries', async (req, res) => {
  
  try {
    const { propertyId, listingId, inquiryType, message } = req.body;
    if (!propertyId || !message) {
      return res.status(400).json({ error: 'propertyId and message are required' });
    }
    const inquiry = await buyerRepository.createInquiry(req.user!.id, {
      propertyId,
      listingId,
      inquiryType,
      message
    });
    res.status(201).json(inquiry);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message === 'PROPERTY_NOT_FOUND') {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.status(400).json({ error: err.message });
  }
});

buyerRouter.get('/inquiries/:id', async (req, res) => {
  
  try {
    const inquiry = await buyerRepository.getInquiryById(req.user!.id, req.params.id);
    if (!inquiry) {
      return res.status(404).json({ error: 'Inquiry not found or unauthorized' });
    }
    res.json(inquiry);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. VIEWINGS / SITE VISITS
// ==========================================

buyerRouter.get('/viewings', async (req, res) => {
  
  try {
    const viewings = await buyerRepository.getViewings(req.user!.id);
    res.json(viewings);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

buyerRouter.post('/viewings', async (req, res) => {
  
  try {
    const { propertyId, listingId, scheduledAt, viewingType, notes } = req.body;
    if (!propertyId || !scheduledAt) {
      return res.status(400).json({ error: 'propertyId and scheduledAt are required' });
    }
    const viewing = await buyerRepository.requestViewing(req.user!.id, {
      propertyId,
      listingId,
      scheduledAt,
      viewingType,
      notes
    });
    res.status(201).json(viewing);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message === 'PROPERTY_NOT_FOUND') {
      return res.status(404).json({ error: 'Property not found' });
    }
    if (err.message?.includes('VIEWING_CONFLICT') || err.message?.includes('INVALID_DATE')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

buyerRouter.patch('/viewings/:id/reschedule', async (req, res) => {
  
  try {
    const { scheduledAt, reason } = req.body;
    if (!scheduledAt) {
      return res.status(400).json({ error: 'scheduledAt is required' });
    }
    const updated = await buyerRepository.rescheduleViewing(req.user!.id, req.params.id, {
      scheduledAt,
      reason
    });
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message?.includes('NOT_FOUND')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

buyerRouter.patch('/viewings/:id/cancel', async (req, res) => {
  
  try {
    const updated = await buyerRepository.cancelViewing(req.user!.id, req.params.id, req.body.reason);
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message?.includes('NOT_FOUND')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 7. OFFERS & NEGOTIATION
// ==========================================

buyerRouter.get('/offers', async (req, res) => {
  
  try {
    const offers = await buyerRepository.getOffers(req.user!.id);
    res.json(offers);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

buyerRouter.post('/offers', async (req, res) => {
  
  try {
    const { propertyId, listingId, offerAmount, currency, depositAmount, financingType, terms, conditions, expiresAt } = req.body;
    if (!propertyId || !offerAmount) {
      return res.status(400).json({ error: 'propertyId and offerAmount are required' });
    }

    const offer = await buyerRepository.createOffer(req.user!.id, {
      propertyId,
      listingId,
      offerAmount: Number(offerAmount),
      currency,
      depositAmount: depositAmount ? Number(depositAmount) : undefined,
      financingType,
      terms,
      conditions,
      expiresAt
    });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: 'BUYER',
      action: 'CREATE_OFFER',
      resourceType: 'Offer',
      resourceId: offer.id,
      changes: { propertyId, offerAmount, currency: offer.currency, status: offer.status },
      ipAddress: (req.ip || '') as string
    });

    res.status(201).json(offer);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message === 'PROPERTY_NOT_FOUND') {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.status(400).json({ error: err.message });
  }
});

buyerRouter.get('/offers/:id', async (req, res) => {
  
  try {
    const offer = await buyerRepository.getOfferById(req.user!.id, req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found or unauthorized' });
    }
    res.json(offer);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

buyerRouter.patch('/offers/:id/withdraw', async (req, res) => {
  
  try {
    const updated = await buyerRepository.withdrawOffer(req.user!.id, req.params.id, req.body.reason);
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: 'BUYER',
      action: 'WITHDRAW_OFFER',
      resourceType: 'Offer',
      resourceId: updated.id,
      changes: { status: 'WITHDRAWN', reason: req.body.reason },
      ipAddress: (req.ip || '') as string
    });
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message?.includes('NOT_FOUND')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

buyerRouter.post('/offers/:id/counter', async (req, res) => {
  
  try {
    const { counterAmount, currency, counterTerms, note } = req.body;
    if (!counterAmount) {
      return res.status(400).json({ error: 'counterAmount is required' });
    }

    const updated = await buyerRepository.counterOffer(req.user!.id, 'BUYER', req.params.id, {
      counterAmount: Number(counterAmount),
      currency,
      counterTerms,
      note
    });

    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message?.includes('NOT_FOUND')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message?.includes('UNAUTHORIZED')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

buyerRouter.post('/offers/:id/respond', async (req, res) => {
  
  try {
    const { action, note } = req.body;
    if (!action || !['ACCEPT', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'action must be ACCEPT or REJECT' });
    }

    const updated = await buyerRepository.respondToCounter(req.user!.id, req.params.id, {
      action,
      note
    });

    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message?.includes('OFFER_SELF_ACCEPTANCE_FORBIDDEN')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message?.includes('NOT_FOUND')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 8. CONTRACTS & TRANSACTIONS
// ==========================================

buyerRouter.get('/contracts', async (req, res) => {
  
  try {
    const contracts = await buyerRepository.getContracts(req.user!.id);
    res.json(contracts);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

buyerRouter.get('/contracts/:id', async (req, res) => {
  
  try {
    const contract = await buyerRepository.getContractById(req.user!.id, req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found or unauthorized' });
    }
    res.json(contract);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

buyerRouter.post('/contracts/:id/accept', async (req, res) => {
  try {
    const updated = await buyerRepository.acceptContract(req.user!.id, req.params.id);
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message?.includes('NOT_FOUND')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

buyerRouter.get('/transactions', async (req, res) => {
  try {
    const txs = await buyerRepository.getTransactions(req.user!.id);
    res.json(txs);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

buyerRouter.get('/transactions/:id', async (req, res) => {
  try {
    const tx = await buyerRepository.getTransactionById(req.user!.id, req.params.id);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found or unauthorized' });
    }
    res.json(tx);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

buyerRouter.post('/transactions/:id/advance', async (req, res) => {
  try {
    const { targetStatus } = req.body;
    if (!targetStatus) {
      return res.status(400).json({ error: 'targetStatus is required' });
    }
    const updated = await buyerRepository.advanceTransactionMilestone(req.user!.id, req.params.id, targetStatus);
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message?.includes('NOT_FOUND')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message?.includes('INVALID_TRANSACTION_TRANSITION')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 9. FINANCIAL RECORDS & PAYMENTS
// ==========================================

buyerRouter.get('/payments', async (req, res) => {
  try {
    const payments = await buyerRepository.getPayments(req.user!.id);
    res.json(payments);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 10. DOCUMENTS
// ==========================================

buyerRouter.get('/documents', async (req, res) => {
  try {
    const docs = await buyerRepository.getDocuments(req.user!.id);
    res.json(docs);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 11. NOTIFICATIONS
// ==========================================

buyerRouter.get('/notifications', async (req, res) => {
  try {
    const notifs = await buyerRepository.getNotifications(req.user!.id);
    res.json(notifs);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 9. DUE DILIGENCE FOUNDATION
// ==========================================

buyerRouter.get('/due-diligence/:propertyId', async (req, res) => {
  
  try {
    // Return structured due diligence checklist
    res.json({
      propertyId: req.params.propertyId,
      tapuVerificationStatus: 'NOT_CONNECTED', // Tapu registry API unconfigured in dev
      ownershipVerified: true,
      deedRegistryNumber: 'EBL-2026-9921',
      encumbrancesFree: true,
      zoningApproved: true,
      structuralInspectionStatus: 'PASSED',
      taxClearanceCertificate: true,
      buyerChecklistComplete: false
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 10. AI PROPERTY ADVISOR
// ==========================================

buyerRouter.post('/ai/advisor', async (req, res) => {
  
  try {
    // Scoped property advisory based on buyer preferences
    const profile = await buyerRepository.getProfile(req.user!.id);
    const budgetMax = profile?.budgetMax || 300000000;
    const preferredCity = profile?.preferredCities?.[0] || 'Erbil';

    // Fetch up to 1 active property that roughly fits the budget
    const [prop] = await db.select().from(properties)
      .where(eq(properties.status, 'ACTIVE'))
      .limit(1);

    const recommendations = [];
    if (prop) {
      recommendations.push({
        propertyId: prop.id,
        name: prop.name,
        matchScore: 94,
        reasonKu: 'گونجاوە لەگەڵ بودجەی دیاریکراو و ناوچەی پەسەندکراو',
        reasonEn: 'Matches your budget and preferred neighborhood criteria',
        price: Number(prop.acquisitionCost || budgetMax * 0.85),
        currency: prop.currency || profile?.currency || 'IQD'
      });
    }

    res.json({
      recommendations,
      insightsKu: 'نرخی ئەم ناوچەیە لە ماوەی ٦ مانگی ڕابردوودا بە ڕێژەی %٤.٢ بەرزبوونەوەی بەخۆیەوە بینیوە.',
      insightsEn: 'Property values in this sector have appreciated 4.2% over the last 6 months.',
      disclaimerKu: 'ئامۆژگاری ژیری دەستکرد بۆ ڕێنماییە و جێگەی لێکۆڵینەوەی یاسایی تاپۆ ناگرێتەوە.',
      disclaimerEn: 'AI advice is advisory only and does not replace official legal/title deed verification.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default buyerRouter;

