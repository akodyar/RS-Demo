import { Router } from 'express';
import { managementRepository } from '../repositories/management.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../../types/index.js';
import { sendSafeError } from '../utils/errorSanitizer.js';

export const managementRouter = Router();

managementRouter.post('/invitations', requireAuth, requireRole([UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const invitation = await managementRepository.inviteCompany(req.user.id, req.body.companyId, req.body.propertyIds, req.body.role);
    res.status(201).json(invitation);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});

managementRouter.post('/invitations/:id/accept', requireAuth, requireRole([UserRole.COMPANY, UserRole.COMPANY_MEMBER, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const agreements = await managementRepository.acceptInvitation(req.user, req.params.id);
    res.json(agreements);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});

managementRouter.patch('/agreements/:id', requireAuth, requireRole([UserRole.PROPERTY_OWNER, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const agreement = await managementRepository.updateAgreement(req.user, req.params.id, req.body.spendingLimit, req.body.permissions);
    res.json(agreement);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});

managementRouter.post('/agreements/:id/revoke', requireAuth, requireRole([UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.PLATFORM_ADMIN]), async (req: any, res: any) => {
  try {
    const agreement = await managementRepository.revokeAgreement(req.user, req.params.id);
    res.json(agreement);
  } catch (error: any) {
    sendSafeError(res, error, 400);
  }
});
