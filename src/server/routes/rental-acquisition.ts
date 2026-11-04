import { Router } from 'express';
import { rentalAcquisitionRepository } from '../repositories/rental-acquisition.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../../types/index.js';
import { sendSafeError } from '../utils/errorSanitizer.js';

export const rentalAcquisitionRouter = Router();

rentalAcquisitionRouter.post('/listings', requireAuth, requireRole([UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const listing = await rentalAcquisitionRepository.createListing(req.user, req.body);
    res.status(201).json(listing);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});

rentalAcquisitionRouter.patch('/listings/:id/status', requireAuth, requireRole([UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const listing = await rentalAcquisitionRepository.updateListingStatus(req.user.id, req.params.id, req.body.status);
    res.json(listing);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});

rentalAcquisitionRouter.post('/listings/:id/inquiries', requireAuth, requireRole([UserRole.TENANT, UserRole.BUYER, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const inquiry = await rentalAcquisitionRepository.createInquiry(req.user.id, req.params.id, req.body.message);
    res.status(201).json(inquiry);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});

rentalAcquisitionRouter.post('/listings/:id/viewings', requireAuth, requireRole([UserRole.TENANT, UserRole.BUYER, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const viewing = await rentalAcquisitionRepository.scheduleViewing(req.user.id, req.params.id, new Date(req.body.scheduledAt));
    res.status(201).json(viewing);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});

rentalAcquisitionRouter.post('/listings/:id/applications', requireAuth, requireRole([UserRole.TENANT, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const { monthlyIncome, notes, preferredMoveInDate, employmentStatus } = req.body;
    
    if (monthlyIncome !== undefined) {
      if (typeof monthlyIncome !== 'number') {
        return res.status(400).json({ error: 'monthlyIncome must be a number' });
      }
      if (monthlyIncome < 0) {
        return res.status(400).json({ error: 'monthlyIncome cannot be negative' });
      }
    }
    if (notes !== undefined && typeof notes !== 'string') {
      return res.status(400).json({ error: 'notes must be a string' });
    }
    if (preferredMoveInDate !== undefined && typeof preferredMoveInDate !== 'string') {
      return res.status(400).json({ error: 'preferredMoveInDate must be a string' });
    }
    if (employmentStatus !== undefined && typeof employmentStatus !== 'string') {
      return res.status(400).json({ error: 'employmentStatus must be a string' });
    }
    
    const application = await rentalAcquisitionRepository.submitApplication(req.user.id, req.params.id, {
      monthlyIncome,
      notes,
      preferredMoveInDate,
      employmentStatus
    });
    res.status(201).json(application);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});

rentalAcquisitionRouter.patch('/applications/:id/review', requireAuth, requireRole([UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const application = await rentalAcquisitionRepository.reviewApplication(req.user, req.params.id, req.body.decision);
    res.json(application);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});
