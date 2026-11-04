import { db } from '../../db/index.js';
import { 
  companyInvitations, 
  managementAgreements, 
  organizations,
  ownershipRecords
} from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { auditService } from '../services/audit.js';

export const managementRepository = {
  /**
   * Invite a company to manage properties
   */
  async inviteCompany(ownerId: string, companyId: string, propertyIds: string[], role: string = 'PROPERTY_MANAGER') {
    // Basic auth check: does the owner own these properties?
    for (const pid of propertyIds) {
      const isOwner = await db.query.ownershipRecords.findFirst({
        where: and(
          eq(ownershipRecords.propertyId, pid),
          eq(ownershipRecords.ownerId, ownerId),
          eq(ownershipRecords.status, 'VERIFIED')
        )
      });
      if (!isOwner) throw new Error(`Unauthorized: Not the verified owner of property ${pid}`);
    }

    // Check existing pending invitation
    const existing = await db.query.companyInvitations.findFirst({
      where: and(
        eq(companyInvitations.companyId, companyId),
        eq(companyInvitations.invitedByUserId, ownerId),
        eq(companyInvitations.status, 'PENDING')
      )
    });

    if (existing) {
      throw new Error("A pending invitation already exists for this company.");
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const newInvite = await db.transaction(async (tx) => {
      const [invite] = await tx.insert(companyInvitations).values({
        companyId,
        invitedByUserId: ownerId,
        email: 'company@example.com', // Would normally be fetched from org
        role,
        assignedPropertyIds: propertyIds,
        status: 'PENDING',
        expiresAt: expiresAt.toISOString()
      }).returning();

      await auditService.logAction({
        actorUserId: ownerId,
        actorRole: 'OWNER',
        action: 'COMPANY_INVITED',
        resourceType: 'CompanyInvitation',
        resourceId: invite.id,
        changes: { companyId, propertyIds }
      });

      return invite;
    });

    return newInvite;
  },

  /**
   * Company accepts the invitation
   */
  async acceptInvitation(companyUser: any, invitationId: string) {
    const invitation = await db.query.companyInvitations.findFirst({
      where: eq(companyInvitations.id, invitationId)
    });

    if (!invitation || invitation.status !== 'PENDING') {
      throw new Error("Invitation is invalid or not pending.");
    }

    const isPlatformAdmin = companyUser?.roles?.some((r: any) => ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(r));
    if (!isPlatformAdmin && companyUser.organizationId !== invitation.companyId) {
      throw new Error("Unauthorized: User does not belong to the invited company.");
    }
    
    const result = await db.transaction(async (tx) => {
      await tx.update(companyInvitations)
        .set({ status: 'ACCEPTED', updatedAt: new Date() })
        .where(eq(companyInvitations.id, invitationId));

      const agreements = [];
      const defaultPermissions = [
        'PROPERTY_VIEW',
        'LISTING_MANAGE',
        'TENANT_MANAGE',
        'LEASE_MANAGE',
        'MAINTENANCE_MANAGE'
      ];

      for (const pid of invitation.assignedPropertyIds || []) {
        const [agreement] = await tx.insert(managementAgreements).values({
          propertyId: pid,
          companyId: invitation.companyId,
          ownerId: invitation.invitedByUserId,
          status: 'ACTIVE',
          startDate: new Date().toISOString(),
          grantedPermissions: defaultPermissions,
          spendingLimit: '500.00', // Default
        }).returning();

        agreements.push(agreement);

        await auditService.logAction({
          actorUserId: companyUser.id,
          actorRole: 'AGENT',
          action: 'MANAGEMENT_AGREEMENT_ACTIVATED',
          resourceType: 'ManagementAgreement',
          resourceId: agreement.id,
          changes: { propertyId: pid }
        });
      }

      return agreements;
    });

    return result;
  },

  /**
   * Update management agreement (e.g. spending limits)
   */
  async updateAgreement(user: any, agreementId: string, spendingLimit: number, permissions?: string[]) {
    const agreement = await db.query.managementAgreements.findFirst({
      where: eq(managementAgreements.id, agreementId)
    });

    if (!agreement) throw new Error("Agreement not found.");
    
    const isPlatformAdmin = user?.roles?.some((r: any) => ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(r));
    if (!isPlatformAdmin && agreement.ownerId !== user.id) {
      throw new Error("Unauthorized: Only the property owner or platform admin can update the agreement.");
    }

    const updated = await db.transaction(async (tx) => {
      const payload: any = { spendingLimit: spendingLimit.toString(), updatedAt: new Date() };
      if (permissions) payload.grantedPermissions = permissions;

      const [updatedAgreement] = await tx.update(managementAgreements)
        .set(payload)
        .where(eq(managementAgreements.id, agreementId))
        .returning();

      await auditService.logAction({
        actorUserId: user.id,
        actorRole: 'OWNER',
        action: 'MANAGEMENT_AGREEMENT_UPDATED',
        resourceType: 'ManagementAgreement',
        resourceId: agreementId,
        changes: { spendingLimit, permissions }
      });

      return updatedAgreement;
    });

    return updated;
  },

  /**
   * Revoke agreement
   */
  async revokeAgreement(user: any, agreementId: string) {
    const agreement = await db.query.managementAgreements.findFirst({
      where: eq(managementAgreements.id, agreementId)
    });

    if (!agreement) throw new Error("Agreement not found.");

    const isPlatformAdmin = user?.roles?.some((r: any) => ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(r));
    const isOwner = agreement.ownerId === user.id;
    const isCompany = agreement.companyId && user.organizationId === agreement.companyId;

    if (!isPlatformAdmin && !isOwner && !isCompany) {
      throw new Error("Unauthorized: Only verified owner, managing company, or platform admin can revoke agreement.");
    }

    const updated = await db.transaction(async (tx) => {
      const [revoked] = await tx.update(managementAgreements)
        .set({ status: 'REVOKED', endDate: new Date().toISOString(), updatedAt: new Date() })
        .where(eq(managementAgreements.id, agreementId))
        .returning();

      await auditService.logAction({
        actorUserId: user.id,
        actorRole: isOwner ? 'OWNER' : 'COMPANY',
        action: 'MANAGEMENT_AGREEMENT_REVOKED',
        resourceType: 'ManagementAgreement',
        resourceId: agreementId,
        changes: {}
      });

      return revoked;
    });

    return updated;
  },

  /**
   * Active Authorization Check for Management Actions
   */
  async checkManagementAuthorization(companyId: string, propertyId: string, requiredPermission: string, expectedAmount?: number) {
    const agreement = await db.query.managementAgreements.findFirst({
      where: and(
        eq(managementAgreements.propertyId, propertyId),
        eq(managementAgreements.companyId, companyId),
        eq(managementAgreements.status, 'ACTIVE')
      )
    });

    if (!agreement) {
      return { authorized: false, reason: "No active management agreement found." };
    }

    const perms = agreement.grantedPermissions || [];
    if (!perms.includes(requiredPermission)) {
      return { authorized: false, reason: `Missing required permission: ${requiredPermission}` };
    }

    if (expectedAmount !== undefined && agreement.spendingLimit) {
      const limit = parseFloat(agreement.spendingLimit);
      if (expectedAmount > limit) {
        return { authorized: false, reason: `Amount exceeds spending limit of ${limit}` };
      }
    }

    return { authorized: true, agreementId: agreement.id };
  }
};
