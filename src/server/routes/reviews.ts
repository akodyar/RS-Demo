import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/dbGuard.js';
import { reviewsRepository } from '../repositories/reviews.js';
import { auditService } from '../services/audit.js';

export const reviewsRouter = Router();

// Fail-closed guard for database
reviewsRouter.use(requireDatabase);

// Helper for structured error responses
function handleReviewError(res: Response, err: any) {
  const msg = err.message || 'An unexpected error occurred.';

  if (msg === 'DATABASE_NOT_CONFIGURED') {
    return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
  }
  if (msg.startsWith('NOT_QUALIFIED_TO_REVIEW')) {
    return res.status(403).json({ error: 'FORBIDDEN', code: 'NOT_QUALIFIED_TO_REVIEW', message: msg });
  }
  if (msg.startsWith('REVIEW_ALREADY_EXISTS')) {
    return res.status(409).json({ error: 'CONFLICT', code: 'REVIEW_ALREADY_EXISTS', message: msg });
  }
  if (msg.startsWith('FORBIDDEN')) {
    return res.status(403).json({ error: 'FORBIDDEN', code: 'FORBIDDEN', message: msg });
  }
  if (msg.startsWith('REVIEW_NOT_FOUND')) {
    return res.status(404).json({ error: 'NOT_FOUND', code: 'REVIEW_NOT_FOUND', message: msg });
  }
  if (msg.startsWith('WORK_ORDER_NOT_FOUND')) {
    return res.status(404).json({ error: 'NOT_FOUND', code: 'WORK_ORDER_NOT_FOUND', message: msg });
  }
  if (msg.startsWith('WORK_ORDER_NOT_COMPLETED')) {
    return res.status(400).json({ error: 'BAD_REQUEST', code: 'WORK_ORDER_NOT_COMPLETED', message: msg });
  }
  if (
    msg.startsWith('INVALID_') ||
    msg.startsWith('MISSING_') ||
    msg.endsWith('_TOO_LONG')
  ) {
    return res.status(400).json({ error: 'BAD_REQUEST', code: 'VALIDATION_ERROR', message: msg });
  }

  return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: msg });
}

// =========================================================================
// 1. CHECK TENANT ELIGIBILITY FOR PROPERTY REVIEW
// =========================================================================

reviewsRouter.get('/properties/:propertyId/eligibility', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await reviewsRepository.checkEligibility(req.params.propertyId as string, req.user!.id);
    res.json(result);
  } catch (err: any) {
    handleReviewError(res, err);
  }
});

// =========================================================================
// 2. SUBMIT PROPERTY REVIEW
// =========================================================================

reviewsRouter.post('/properties', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      propertyId,
      rating,
      cleanlinessRating,
      maintenanceRating,
      communicationRating,
      locationRating,
      title,
      comment,
    } = req.body;

    const review = await reviewsRepository.createPropertyReview(req.user!.id, {
      propertyId,
      rating: Number(rating),
      cleanlinessRating: cleanlinessRating !== undefined ? Number(cleanlinessRating) : undefined,
      maintenanceRating: maintenanceRating !== undefined ? Number(maintenanceRating) : undefined,
      communicationRating: communicationRating !== undefined ? Number(communicationRating) : undefined,
      locationRating: locationRating !== undefined ? Number(locationRating) : undefined,
      title,
      comment,
    });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] || 'TENANT',
      action: 'SUBMIT_PROPERTY_REVIEW',
      resourceType: 'PropertyReview',
      resourceId: review.id,
      changes: { propertyId, rating: review.rating },
      ipAddress: (req.ip || '') as string,
    });

    res.status(201).json(review);
  } catch (err: any) {
    handleReviewError(res, err);
  }
});

// =========================================================================
// 3. GET PROPERTY REVIEWS (PUBLIC WITH AGGREGATES)
// =========================================================================

reviewsRouter.get('/properties/:propertyId', async (req: Request, res: Response) => {
  try {
    const propertyId = req.params.propertyId as string;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);

    const [reviewsData, aggregate] = await Promise.all([
      reviewsRepository.getPropertyReviews(propertyId, { page, limit }),
      reviewsRepository.getPropertyReviewAggregate(propertyId),
    ]);

    res.json({
      ...reviewsData,
      aggregate,
    });
  } catch (err: any) {
    handleReviewError(res, err);
  }
});

// =========================================================================
// 4. UPDATE PROPERTY REVIEW (AUTHOR ONLY)
// =========================================================================

reviewsRouter.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const reviewId = req.params.id as string;
    const {
      rating,
      cleanlinessRating,
      maintenanceRating,
      communicationRating,
      locationRating,
      title,
      comment,
    } = req.body;

    const updated = await reviewsRepository.updatePropertyReview(reviewId, req.user!.id, {
      rating: rating !== undefined ? Number(rating) : undefined,
      cleanlinessRating: cleanlinessRating !== undefined ? Number(cleanlinessRating) : undefined,
      maintenanceRating: maintenanceRating !== undefined ? Number(maintenanceRating) : undefined,
      communicationRating: communicationRating !== undefined ? Number(communicationRating) : undefined,
      locationRating: locationRating !== undefined ? Number(locationRating) : undefined,
      title,
      comment,
    });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] || 'TENANT',
      action: 'UPDATE_PROPERTY_REVIEW',
      resourceType: 'PropertyReview',
      resourceId: updated.id,
      changes: { rating: updated.rating },
      ipAddress: (req.ip || '') as string,
    });

    res.json(updated);
  } catch (err: any) {
    handleReviewError(res, err);
  }
});

// =========================================================================
// 5. DELETE PROPERTY REVIEW (AUTHOR OR ADMIN)
// =========================================================================

reviewsRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const reviewId = req.params.id as string;

    const result = await reviewsRepository.deletePropertyReview(reviewId, {
      id: req.user!.id,
      roles: req.user!.roles || [],
    });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] || 'USER',
      action: 'DELETE_PROPERTY_REVIEW',
      resourceType: 'PropertyReview',
      resourceId: reviewId,
      ipAddress: (req.ip || '') as string,
    });

    res.json(result);
  } catch (err: any) {
    handleReviewError(res, err);
  }
});

// =========================================================================
// 6. RESPOND TO PROPERTY REVIEW (OWNER OR MANAGING COMPANY)
// =========================================================================

reviewsRouter.post('/:id/respond', requireAuth, async (req: Request, res: Response) => {
  try {
    const reviewId = req.params.id as string;
    const { response } = req.body;

    const updated = await reviewsRepository.respondToPropertyReview(
      reviewId,
      {
        id: req.user!.id,
        roles: req.user!.roles || [],
        organizationId: req.user!.organizationId,
      },
      response
    );

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] || 'PROPERTY_OWNER',
      action: 'RESPOND_TO_PROPERTY_REVIEW',
      resourceType: 'PropertyReview',
      resourceId: updated.id,
      ipAddress: (req.ip || '') as string,
    });

    res.json(updated);
  } catch (err: any) {
    handleReviewError(res, err);
  }
});

// =========================================================================
// 7. MODERATE PROPERTY REVIEW (PLATFORM ADMIN ONLY)
// =========================================================================

reviewsRouter.patch('/:id/moderate', requireAuth, async (req: Request, res: Response) => {
  try {
    const reviewId = req.params.id as string;
    const { status, reason } = req.body;

    const updated = await reviewsRepository.moderatePropertyReview(
      reviewId,
      {
        id: req.user!.id,
        roles: req.user!.roles || [],
      },
      status,
      reason
    );

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] || 'PLATFORM_ADMIN',
      action: 'MODERATE_PROPERTY_REVIEW',
      resourceType: 'PropertyReview',
      resourceId: updated.id,
      changes: { newStatus: status, reason },
      ipAddress: (req.ip || '') as string,
    });

    res.json(updated);
  } catch (err: any) {
    handleReviewError(res, err);
  }
});

// =========================================================================
// 8. FLAG PROPERTY REVIEW (COMMUNITY REPORTING)
// =========================================================================

reviewsRouter.post('/:id/flag', requireAuth, async (req: Request, res: Response) => {
  try {
    const reviewId = req.params.id as string;
    const { reason } = req.body;

    const updated = await reviewsRepository.flagPropertyReview(reviewId, req.user!.id, reason);

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] || 'USER',
      action: 'FLAG_PROPERTY_REVIEW',
      resourceType: 'PropertyReview',
      resourceId: updated.id,
      changes: { reason },
      ipAddress: (req.ip || '') as string,
    });

    res.json(updated);
  } catch (err: any) {
    handleReviewError(res, err);
  }
});

// =========================================================================
// 9. SUBMIT VENDOR REVIEW (CLIENT TO VENDOR UPON COMPLETED WORK ORDER)
// =========================================================================

reviewsRouter.post('/vendors', requireAuth, async (req: Request, res: Response) => {
  try {
    const { workOrderId, rating, comment } = req.body;

    // Determine reviewer role
    let reviewerRole: 'OWNER' | 'TENANT' | 'COMPANY_MANAGER' = 'TENANT';
    const roles = req.user!.roles || [];
    if (roles.includes('PROPERTY_OWNER')) reviewerRole = 'OWNER';
    else if (roles.includes('COMPANY') || roles.includes('COMPANY_MEMBER')) reviewerRole = 'COMPANY_MANAGER';

    const review = await reviewsRepository.createVendorReview(req.user!.id, reviewerRole, {
      workOrderId,
      rating: Number(rating),
      comment,
    });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: reviewerRole,
      action: 'SUBMIT_VENDOR_REVIEW',
      resourceType: 'VendorReview',
      resourceId: review.id,
      changes: { workOrderId, rating: review.rating },
      ipAddress: (req.ip || '') as string,
    });

    res.status(201).json(review);
  } catch (err: any) {
    handleReviewError(res, err);
  }
});

// =========================================================================
// 10. GET VENDOR REVIEWS (PUBLIC VIEW WITH AGGREGATES)
// =========================================================================

reviewsRouter.get('/vendors/:vendorId', async (req: Request, res: Response) => {
  try {
    const vendorId = req.params.vendorId as string;
    const result = await reviewsRepository.getVendorPublicReviews(vendorId);
    res.json(result);
  } catch (err: any) {
    handleReviewError(res, err);
  }
});

export default reviewsRouter;
