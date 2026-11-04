import { db } from '../../db/index.js';
import {
  leases,
  securityDeposits,
  securityDepositDeductions,
  leaseMoveOutInspections,
  leaseMoveOutInspectionItems,
  ownershipRecords,
  managementAgreements,
  organizationMembers,
  leaseTenants,
  users,
  notifications,
  notificationDeliveries,
} from '../../db/schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { auditService } from './audit.js';
import { notificationEngine } from './notification-engine.js';
import { communicationsCrmRepository } from '../repositories/communications-crm.js';
import {
  NotificationChannel,
  NotificationCategory,
  DeliveryStatus,
} from '../../types/communications-crm.js';
import {
  UserRole,
  Permission,
  DepositDeductionCategory,
  DepositDeductionStatus,
  SecurityDepositDeduction,
} from '../../types/index.js';

export interface DeductionActor {
  id: string;
  role?: string;
  roles?: string[];
  organizationId?: string;
  simulateAuditFailure?: boolean;
}

export interface ProposeDeductionInput {
  depositId: string;
  leaseId: string;
  inspectionItemId?: string | null;
  amount: number | string;
  currency?: string;
  category: DepositDeductionCategory;
  description: string;
  evidenceRefs?: string[] | null;
  notifyTenant?: boolean;
  noticeChannels?: NotificationChannel[];
}

export interface DisputeDeductionInput {
  deductionId: string;
  disputeReason: string;
  evidenceRefs?: string[] | null;
}

export const VALID_DEDUCTION_CATEGORIES: DepositDeductionCategory[] = [
  'DAMAGE',
  'CLEANING',
  'KEY_REPLACEMENT',
  'UNPAID_UTILITIES',
  'OTHER',
];

export const VALID_DEDUCTION_CURRENCIES = ['IQD', 'USD'];

export class SecurityDepositDeductionService {
  /**
   * Validates safe evidence reference according to HomeHub storage conventions.
   * Prohibits path traversal, absolute paths, URL schemes, executable extensions, and control characters.
   */
  validateEvidenceReference(ref: string): void {
    if (!ref || typeof ref !== 'string') {
      throw new Error('INVALID_EVIDENCE_REFERENCE: Evidence reference must be a non-empty string.');
    }

    const trimmed = ref.trim();
    if (trimmed.length > 500) {
      throw new Error('INVALID_EVIDENCE_REFERENCE: Reference exceeds maximum length of 500 characters.');
    }

    // Traversal and absolute path rejection
    if (trimmed.includes('..') || trimmed.startsWith('/') || trimmed.startsWith('\\') || /^[a-zA-Z]:/.test(trimmed)) {
      throw new Error('INVALID_EVIDENCE_REFERENCE: Path traversal, drive letters, and absolute paths are prohibited.');
    }

    // URL scheme rejection
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
      throw new Error('INVALID_EVIDENCE_REFERENCE: External URL schemes (http, https, data, javascript) are prohibited.');
    }

    // Character set: only alphanumeric, underscores, hyphens, periods, and forward slashes
    if (!/^[a-zA-Z0-9_\-\./]+$/.test(trimmed) || trimmed.includes('//')) {
      throw new Error('INVALID_EVIDENCE_REFERENCE: Evidence reference contains illegal characters or double slashes.');
    }

    // Extension check: must be a supported safe media format
    const lower = trimmed.toLowerCase();
    const hasValidExt = lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.pdf');
    if (!hasValidExt) {
      throw new Error('INVALID_EVIDENCE_REFERENCE: Unsupported file extension. Allowed extensions: .jpg, .jpeg, .png, .webp, .pdf');
    }
  }

  /**
   * Verifies that the actor has authority to propose a deduction for the property.
   * Allowed: Platform Admin, Verified Property Owner, or Company Manager with active agreement.
   * Tenants are explicitly forbidden. Fail closed.
   */
  async verifyDeductionProposalAuthority(propertyId: string, actor: DeductionActor, tx?: any): Promise<boolean> {
    if (!actor || !actor.id) return false;

    const dbHandle = tx || db;
    const roles = actor.roles || (actor.role ? [actor.role] : []);
    const isPlatformAdmin = roles.includes(UserRole.PLATFORM_ADMIN) || roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    if (isPlatformAdmin) return true;

    // 1. Direct verified owner check
    if (roles.includes(UserRole.PROPERTY_OWNER) || roles.includes('PROPERTY_OWNER')) {
      const ownerRecord = await dbHandle.select().from(ownershipRecords).where(and(
        eq(ownershipRecords.ownerId, actor.id),
        eq(ownershipRecords.propertyId, propertyId),
        eq(ownershipRecords.status, 'VERIFIED')
      )).limit(1);

      if (ownerRecord.length > 0) return true;
    }

    // 2. Company manager / member check
    const isCompanyUser = roles.includes(UserRole.COMPANY) || roles.includes(UserRole.COMPANY_MEMBER) || roles.includes('COMPANY') || roles.includes('COMPANY_MEMBER') || roles.includes('PROPERTY_MANAGER');
    if (isCompanyUser && actor.organizationId) {
      const membership = await dbHandle.select().from(organizationMembers).where(and(
        eq(organizationMembers.userId, actor.id),
        eq(organizationMembers.organizationId, actor.organizationId),
        eq(organizationMembers.status, 'ACTIVE')
      )).limit(1);

      if (membership.length === 0 && !roles.includes(UserRole.COMPANY) && !roles.includes('COMPANY')) {
        return false;
      }

      const agreement = await dbHandle.select().from(managementAgreements).where(and(
        eq(managementAgreements.companyId, actor.organizationId),
        eq(managementAgreements.propertyId, propertyId),
        eq(managementAgreements.status, 'ACTIVE')
      )).limit(1);

      if (agreement.length > 0) {
        if (agreement[0].endDate && new Date(agreement[0].endDate).getTime() < Date.now()) {
          return false;
        }

        const perms = (agreement[0].grantedPermissions as string[]) || [];
        const hasManagementPerm = perms.includes(Permission.MANAGE_LEASES) ||
          perms.includes(Permission.VIEW_PROPERTY) ||
          perms.includes(Permission.MANAGE_MAINTENANCE) ||
          perms.includes(Permission.MANAGE_FINANCIALS);

        if (hasManagementPerm) return true;
      }
    }

    return false;
  }

  /**
   * Decision P02: Deduction Approval Authority.
   * Only Platform Admin or Verified Property Owner may approve or reject deposit deductions.
   * Management companies lack explicit deduction approval delegation in the current schema
   * and must fail closed.
   */
  async verifyDeductionApprovalAuthority(propertyId: string, actor: DeductionActor, tx?: any): Promise<boolean> {
    if (!actor || !actor.id) return false;

    const dbHandle = tx || db;
    const roles = actor.roles || (actor.role ? [actor.role] : []);
    const isPlatformAdmin = roles.includes(UserRole.PLATFORM_ADMIN) || roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    if (isPlatformAdmin) return true;

    // Direct verified owner check
    if (roles.includes(UserRole.PROPERTY_OWNER) || roles.includes('PROPERTY_OWNER')) {
      const ownerRecord = await dbHandle.select().from(ownershipRecords).where(and(
        eq(ownershipRecords.ownerId, actor.id),
        eq(ownershipRecords.propertyId, propertyId),
        eq(ownershipRecords.status, 'VERIFIED')
      )).limit(1);

      if (ownerRecord.length > 0) return true;
    }

    // Management company approval delegation gap (Decision P02):
    // management_agreements lacks an explicit column/permission for deduction approval.
    // Strictly fail closed.
    return false;
  }

  /**
   * Verifies read authority for deductions of a specific lease.
   * Allowed: Admin, Verified Property Owner, Authorized Manager, or the Tenant on the lease.
   */
  async verifyDeductionReadAuthority(leaseId: string, propertyId: string, tenantId?: string | null, actor?: DeductionActor): Promise<boolean> {
    if (!actor || !actor.id) return false;

    const roles = actor.roles || (actor.role ? [actor.role] : []);
    const isPlatformAdmin = roles.includes(UserRole.PLATFORM_ADMIN) || roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    if (isPlatformAdmin) return true;

    // Tenant check against explicit tenantId
    if (tenantId && actor.id === tenantId) return true;

    // Also check leaseTenants link
    const tenantLinks = await db.select().from(leaseTenants).where(and(
      eq(leaseTenants.leaseId, leaseId),
      eq(leaseTenants.tenantId, actor.id)
    )).limit(1);
    if (tenantLinks.length > 0) return true;

    // Owner check
    const ownerRecord = await db.select().from(ownershipRecords).where(and(
      eq(ownershipRecords.ownerId, actor.id),
      eq(ownershipRecords.propertyId, propertyId),
      eq(ownershipRecords.status, 'VERIFIED')
    )).limit(1);
    if (ownerRecord.length > 0) return true;

    // Manager check
    if (actor.organizationId) {
      const agreement = await db.select().from(managementAgreements).where(and(
        eq(managementAgreements.companyId, actor.organizationId),
        eq(managementAgreements.propertyId, propertyId),
        eq(managementAgreements.status, 'ACTIVE')
      )).limit(1);

      if (agreement.length > 0) {
        if (!agreement[0].endDate || new Date(agreement[0].endDate).getTime() >= Date.now()) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Proposes a security deposit deduction against a held custodial deposit.
   * Enforces object authority, eligible held deposit status, inspection item linkage,
   * category/currency validation, evidence-reference validation, and ceiling reservation under row lock.
   */
  async proposeDeduction(input: ProposeDeductionInput, actor: DeductionActor): Promise<SecurityDepositDeduction> {
    if (!input) throw new Error('VALIDATION_ERROR: Input payload is required.');
    if (!input.depositId) throw new Error('VALIDATION_ERROR: Deposit ID is required.');
    if (!input.leaseId) throw new Error('VALIDATION_ERROR: Lease ID is required.');

    // 1. Validate Category
    if (!VALID_DEDUCTION_CATEGORIES.includes(input.category)) {
      throw new Error(`VALIDATION_ERROR: Invalid deduction category '${input.category}'. Allowed categories: ${VALID_DEDUCTION_CATEGORIES.join(', ')}.`);
    }

    // 2. Validate Amount
    const deductionAmount = typeof input.amount === 'number' ? input.amount : parseFloat(input.amount);
    if (!Number.isFinite(deductionAmount) || deductionAmount <= 0) {
      throw new Error('VALIDATION_ERROR: Deduction amount must be a positive finite number.');
    }

    // 3. Validate Description
    if (!input.description || !input.description.trim()) {
      throw new Error('VALIDATION_ERROR: Deduction description is required.');
    }

    // 4. Validate Evidence References
    if (input.evidenceRefs && Array.isArray(input.evidenceRefs)) {
      for (const ref of input.evidenceRefs) {
        this.validateEvidenceReference(ref);
      }
    }

    const createdDeduction = await db.transaction(async (tx) => {
      // 5. Fetch and lock target security deposit
      const [deposit] = await tx.select().from(securityDeposits)
        .where(eq(securityDeposits.id, input.depositId))
        .limit(1)
        .for('update');

      if (!deposit) {
        throw new Error('NOT_FOUND: Target security deposit not found.');
      }

      // 6. Authorization check (Finding E-01: verify authority before relationship validation)
      const hasProposalAuth = await this.verifyDeductionProposalAuthority(deposit.propertyId, actor, tx);
      if (!hasProposalAuth) {
        throw new Error('FORBIDDEN: You are not authorized to propose security deposit deductions for this property.');
      }

      // 7. Verify deposit-lease relationship (safe for authorized callers)
      if (deposit.leaseId !== input.leaseId) {
        throw new Error(`VALIDATION_ERROR: Security deposit '${deposit.id}' belongs to lease '${deposit.leaseId}', not requested lease '${input.leaseId}'.`);
      }

      // 8. Verify eligible custodial held deposit state
      const recordedAmount = parseFloat(deposit.recordedAmount || '0');
      const releasedAmount = parseFloat(deposit.releasedAmount || '0');
      const heldBalance = recordedAmount - releasedAmount;

      if (heldBalance <= 0 || (deposit.status !== 'HELD' && deposit.status !== 'PARTIALLY_REFUNDED')) {
        throw new Error(`INVALID_STATE: Security deposit is not in an eligible held custodial state (status: '${deposit.status}', held balance: ${heldBalance}). Deductions can only be proposed against deposits with active custodial held balances.`);
      }

      // 9. Currency Validation & Match
      const effectiveCurrency = input.currency || deposit.currency || 'IQD';
      if (!VALID_DEDUCTION_CURRENCIES.includes(effectiveCurrency)) {
        throw new Error(`VALIDATION_ERROR: Invalid currency '${effectiveCurrency}'. Allowed currencies: ${VALID_DEDUCTION_CURRENCIES.join(', ')}.`);
      }
      if (deposit.currency && effectiveCurrency !== deposit.currency) {
        throw new Error(`CURRENCY_MISMATCH: Proposed deduction currency '${effectiveCurrency}' does not match deposit currency '${deposit.currency}'.`);
      }

      // 10. Inspection Item Validation (if provided)
      if (input.inspectionItemId) {
        const [inspectionItem] = await tx.select().from(leaseMoveOutInspectionItems)
          .where(eq(leaseMoveOutInspectionItems.id, input.inspectionItemId))
          .limit(1);

        if (!inspectionItem) {
          throw new Error('NOT_FOUND: Linked inspection item not found.');
        }

        const [parentInspection] = await tx.select().from(leaseMoveOutInspections)
          .where(eq(leaseMoveOutInspections.id, inspectionItem.inspectionId))
          .limit(1);

        if (!parentInspection) {
          throw new Error('NOT_FOUND: Parent move-out inspection not found for linked inspection item.');
        }

        if (parentInspection.leaseId !== input.leaseId) {
          throw new Error(`VALIDATION_ERROR: Linked inspection item belongs to lease '${parentInspection.leaseId}', not target lease '${input.leaseId}'.`);
        }

        if (parentInspection.status !== 'COMPLETED') {
          throw new Error(`INVALID_STATE: Deductions can only be linked to items from COMPLETED inspections. Inspection '${parentInspection.id}' has status '${parentInspection.status}'.`);
        }

        if (inspectionItem.currency && inspectionItem.currency !== effectiveCurrency) {
          throw new Error(`CURRENCY_MISMATCH: Linked inspection item currency '${inspectionItem.currency}' does not match deduction currency '${effectiveCurrency}'.`);
        }
      }

      // 11. Deduction Ceiling & Reservation Enforcement under Lock
      const existingDeductions = await tx.select().from(securityDepositDeductions)
        .where(eq(securityDepositDeductions.depositId, deposit.id));

      const activeReservations = existingDeductions.filter((d: any) =>
        ['PROPOSED', 'OWNER_APPROVED', 'DISPUTED', 'SETTLED'].includes(d.status)
      );

      const totalReserved = activeReservations.reduce((sum: number, d: any) => sum + parseFloat(d.amount || '0'), 0);
      const remainingAvailable = heldBalance - totalReserved;

      if (deductionAmount > remainingAvailable) {
        throw new Error(`DEDUCTION_EXCEEDS_AVAILABLE_BALANCE: Proposed deduction amount (${deductionAmount}) exceeds remaining available held deposit balance (${remainingAvailable}). Total held: ${heldBalance}, already reserved: ${totalReserved}.`);
      }

      // 12. Insert deduction row without premature dispute deadline
      // The tenant's 30-day dispute window ONLY starts upon confirmed notice delivery
      const [newDeduction] = await tx.insert(securityDepositDeductions).values({
        depositId: deposit.id,
        leaseId: deposit.leaseId,
        inspectionItemId: input.inspectionItemId || null,
        amount: deductionAmount.toString(),
        currency: effectiveCurrency,
        category: input.category,
        description: input.description.trim(),
        evidenceRefs: input.evidenceRefs && input.evidenceRefs.length > 0 ? input.evidenceRefs : null,
        proposedById: actor.id,
        proposedAt: new Date(),
        status: 'PROPOSED',
        disputeDeadline: null,
        tenantNotifiedAt: null,
        noticeNotificationId: null,
        noticeDeliveryId: null,
        noticeDeliveryStatus: 'NOT_SENT',
      }).returning();

      // Simulated failure hook for transactional rollback testing
      if (actor.simulateAuditFailure) {
        throw new Error('SIMULATED_AUDIT_FAILURE: Testing atomic rollback on proposal');
      }

      // 13. Audit Log inside transaction
      await auditService.logAction({
        actorUserId: actor.id,
        actorRole: actor.roles?.[0] || actor.role || 'USER',
        action: 'PROPOSE_SECURITY_DEPOSIT_DEDUCTION',
        resourceType: 'SecurityDepositDeduction',
        resourceId: newDeduction.id,
        changes: {
          depositId: newDeduction.depositId,
          leaseId: newDeduction.leaseId,
          inspectionItemId: newDeduction.inspectionItemId,
          amount: newDeduction.amount,
          currency: newDeduction.currency,
          category: newDeduction.category,
          status: newDeduction.status,
          disputeDeadline: null,
          tenantNotifiedAt: null,
          noticeDeliveryStatus: 'NOT_SENT',
        },
        tx,
      });

      return newDeduction as unknown as SecurityDepositDeduction;
    });

    // If requested, dispatch tenant notice outside the proposal transaction
    if (input.notifyTenant) {
      return await this.dispatchDeductionNotice(createdDeduction.id, actor, {
        channels: input.noticeChannels,
      });
    }

    return createdDeduction;
  }

  /**
   * Approves a proposed security deposit deduction.
   * Strictly enforces Decision P02: only verified property owners or platform admins may approve.
   * Rejects invalid or duplicate lifecycle state transitions.
   * Does NOT mutate deposit balances or post journal entries.
   */
  async approveDeduction(deductionId: string, actor: DeductionActor): Promise<SecurityDepositDeduction> {
    if (!deductionId) throw new Error('VALIDATION_ERROR: Deduction ID is required.');

    return await db.transaction(async (tx) => {
      // 1. Fetch deduction under lock
      const [deduction] = await tx.select().from(securityDepositDeductions)
        .where(eq(securityDepositDeductions.id, deductionId))
        .limit(1)
        .for('update');

      if (!deduction) {
        throw new Error('NOT_FOUND: Security deposit deduction not found.');
      }

      // 2. Validate state transition
      if (deduction.status !== 'PROPOSED') {
        throw new Error(`INVALID_STATE: Cannot approve deduction with status '${deduction.status}'. Only 'PROPOSED' deductions can be approved.`);
      }

      // 3. Fetch deposit to obtain propertyId
      const [deposit] = await tx.select().from(securityDeposits)
        .where(eq(securityDeposits.id, deduction.depositId))
        .limit(1);

      if (!deposit) {
        throw new Error('NOT_FOUND: Associated security deposit not found.');
      }

      // 4. Decision P02 Authorization Check
      const hasApprovalAuth = await this.verifyDeductionApprovalAuthority(deposit.propertyId, actor, tx);
      if (!hasApprovalAuth) {
        throw new Error('FORBIDDEN: You are not authorized to approve security deposit deductions for this property.');
      }

      // 5. Update deduction state to OWNER_APPROVED
      const [updatedDeduction] = await tx.update(securityDepositDeductions)
        .set({
          status: 'OWNER_APPROVED',
          approvedById: actor.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(securityDepositDeductions.id, deduction.id))
        .returning();

      // Simulated failure hook for transactional rollback testing
      if (actor.simulateAuditFailure) {
        throw new Error('SIMULATED_AUDIT_FAILURE: Testing atomic rollback on approval');
      }

      // 6. Audit Log inside transaction
      await auditService.logAction({
        actorUserId: actor.id,
        actorRole: actor.roles?.[0] || actor.role || 'USER',
        action: 'APPROVE_SECURITY_DEPOSIT_DEDUCTION',
        resourceType: 'SecurityDepositDeduction',
        resourceId: updatedDeduction.id,
        changes: {
          previousStatus: deduction.status,
          newStatus: updatedDeduction.status,
          approvedById: updatedDeduction.approvedById,
          approvedAt: updatedDeduction.approvedAt,
          amount: updatedDeduction.amount,
        },
        tx,
      });

      return updatedDeduction as unknown as SecurityDepositDeduction;
    });
  }

  /**
   * Rejects a proposed security deposit deduction.
   * Requires a non-empty rejection reason.
   * Enforces Decision P02 authorization (verified property owner or admin).
   * Rejects invalid or duplicate lifecycle transitions.
   */
  async rejectDeduction(deductionId: string, rejectionReason: string, actor: DeductionActor): Promise<SecurityDepositDeduction> {
    if (!deductionId) throw new Error('VALIDATION_ERROR: Deduction ID is required.');
    if (!rejectionReason || !rejectionReason.trim()) {
      throw new Error('VALIDATION_ERROR: Rejection reason is required.');
    }

    return await db.transaction(async (tx) => {
      // 1. Fetch deduction under lock
      const [deduction] = await tx.select().from(securityDepositDeductions)
        .where(eq(securityDepositDeductions.id, deductionId))
        .limit(1)
        .for('update');

      if (!deduction) {
        throw new Error('NOT_FOUND: Security deposit deduction not found.');
      }

      // 2. Validate state transition (PROPOSED or DISPUTED can be rejected)
      if (deduction.status !== 'PROPOSED' && deduction.status !== 'DISPUTED') {
        throw new Error(`INVALID_STATE: Cannot reject deduction with status '${deduction.status}'. Only 'PROPOSED' or 'DISPUTED' deductions can be rejected.`);
      }

      // 3. Fetch deposit to obtain propertyId
      const [deposit] = await tx.select().from(securityDeposits)
        .where(eq(securityDeposits.id, deduction.depositId))
        .limit(1);

      if (!deposit) {
        throw new Error('NOT_FOUND: Associated security deposit not found.');
      }

      // 4. Decision P02 Authorization Check
      const hasApprovalAuth = await this.verifyDeductionApprovalAuthority(deposit.propertyId, actor, tx);
      if (!hasApprovalAuth) {
        throw new Error('FORBIDDEN: You are not authorized to reject security deposit deductions for this property.');
      }

      // 5. Update deduction state to REJECTED
      const [updatedDeduction] = await tx.update(securityDepositDeductions)
        .set({
          status: 'REJECTED',
          rejectionReason: rejectionReason.trim(),
          updatedAt: new Date(),
        })
        .where(eq(securityDepositDeductions.id, deduction.id))
        .returning();

      // Simulated failure hook for transactional rollback testing
      if (actor.simulateAuditFailure) {
        throw new Error('SIMULATED_AUDIT_FAILURE: Testing atomic rollback on rejection');
      }

      // 6. Audit Log inside transaction
      await auditService.logAction({
        actorUserId: actor.id,
        actorRole: actor.roles?.[0] || actor.role || 'USER',
        action: 'REJECT_SECURITY_DEPOSIT_DEDUCTION',
        resourceType: 'SecurityDepositDeduction',
        resourceId: updatedDeduction.id,
        changes: {
          previousStatus: deduction.status,
          newStatus: updatedDeduction.status,
          rejectionReason: updatedDeduction.rejectionReason,
          amount: updatedDeduction.amount,
        },
        tx,
      });

      return updatedDeduction as unknown as SecurityDepositDeduction;
    });
  }

  /**
   * Authoritative read endpoint returning deductions for a given lease.
   * Enforces object-level authorization (Owner, Authorized Manager, or Lease Tenant).
   * Isolation: Tenant access is strictly read-only and cross-lease/property access is rejected.
   */
  async getDeductionsForLease(leaseId: string, actor: DeductionActor): Promise<SecurityDepositDeduction[]> {
    if (!leaseId) throw new Error('VALIDATION_ERROR: Lease ID is required.');

    const [lease] = await db.select().from(leases).where(eq(leases.id, leaseId)).limit(1);
    if (!lease) {
      throw new Error('NOT_FOUND: Target lease not found.');
    }

    const [deposit] = await db.select().from(securityDeposits).where(eq(securityDeposits.leaseId, lease.id)).limit(1);

    const hasReadAuth = await this.verifyDeductionReadAuthority(
      lease.id,
      lease.propertyId,
      deposit?.tenantId,
      actor
    );

    if (!hasReadAuth) {
      throw new Error('FORBIDDEN: You do not have permission to view deductions for this lease.');
    }

    const deductions = await db.select().from(securityDepositDeductions)
      .where(eq(securityDepositDeductions.leaseId, lease.id))
      .orderBy(desc(securityDepositDeductions.createdAt));

    return deductions as unknown as SecurityDepositDeduction[];
  }

  /**
   * Fetches a single deduction by ID with authorization.
   */
  async getDeductionById(deductionId: string, actor: DeductionActor): Promise<SecurityDepositDeduction> {
    if (!deductionId) throw new Error('VALIDATION_ERROR: Deduction ID is required.');

    const [deduction] = await db.select().from(securityDepositDeductions)
      .where(eq(securityDepositDeductions.id, deductionId))
      .limit(1);

    if (!deduction) {
      throw new Error('NOT_FOUND: Security deposit deduction not found.');
    }

    const [lease] = await db.select().from(leases).where(eq(leases.id, deduction.leaseId)).limit(1);
    if (!lease) {
      throw new Error('NOT_FOUND: Associated lease not found.');
    }

    const [deposit] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, deduction.depositId)).limit(1);

    const hasReadAuth = await this.verifyDeductionReadAuthority(
      lease.id,
      lease.propertyId,
      deposit?.tenantId,
      actor
    );

    if (!hasReadAuth) {
      throw new Error('FORBIDDEN: You do not have permission to view this deduction.');
    }

    return deduction as unknown as SecurityDepositDeduction;
  }

  /**
   * Verifiably dispatches a formal tenant notice regarding a proposed deduction.
   * Distinctly tracks delivery states:
   * - Confirmed delivery (DELIVERED / DELIVERY_CONFIRMED) anchors the 30-day dispute deadline (deliveredAt + 30 days).
   * - Queued/dispatched/pending (SENT / QUEUED) does NOT start the dispute window (disputeDeadline remains null).
   * - Failed notice does NOT mark tenant as notified.
   * External notifications are performed outside of the database transaction to prevent misleading delivery claims.
   * State updates and audit records are persisted atomically.
   */
  async dispatchDeductionNotice(
    deductionId: string,
    actor: DeductionActor,
    options?: {
      channels?: NotificationChannel[];
      recipientUserId?: string;
      idempotencyKey?: string;
      simulateAuditFailure?: boolean;
    }
  ): Promise<SecurityDepositDeduction> {
    if (!deductionId) throw new Error('VALIDATION_ERROR: Deduction ID is required.');

    // 1. Fetch deduction
    const [deduction] = await db.select().from(securityDepositDeductions)
      .where(eq(securityDepositDeductions.id, deductionId))
      .limit(1);

    if (!deduction) {
      throw new Error(`NOT_FOUND: Security deposit deduction '${deductionId}' not found.`);
    }

    // 2. Fetch deposit to verify property proposal/management authority
    const [deposit] = await db.select().from(securityDeposits)
      .where(eq(securityDeposits.id, deduction.depositId))
      .limit(1);

    if (!deposit) {
      throw new Error(`NOT_FOUND: Associated deposit for deduction '${deductionId}' not found.`);
    }

    const hasAuth = await this.verifyDeductionProposalAuthority(deposit.propertyId, actor);
    if (!hasAuth) {
      throw new Error('FORBIDDEN: You are not authorized to dispatch notices for this deduction.');
    }

    // 3. Idempotency: If already verifiably delivered, do not reset or re-deliver
    if (deduction.tenantNotifiedAt && deduction.noticeDeliveryStatus === 'DELIVERED') {
      return deduction as unknown as SecurityDepositDeduction;
    }

    // 4. Resolve recipient tenant
    let recipientUserId = options?.recipientUserId;
    if (!recipientUserId) {
      const tenants = await db.select().from(leaseTenants)
        .where(eq(leaseTenants.leaseId, deduction.leaseId));
      const primary = tenants.find(t => t.isPrimary) || tenants[0];
      recipientUserId = primary?.tenantId || deposit.tenantId || undefined;
    }

    if (!recipientUserId) {
      throw new Error(`VALIDATION_ERROR: No tenant found to notify for lease '${deduction.leaseId}'.`);
    }

    const channels: NotificationChannel[] = (options?.channels && options.channels.length > 0 ? options.channels : ['IN_APP']) as NotificationChannel[];
    const idempotencyKey = options?.idempotencyKey || `sec_dep_notice_${deduction.id}_${Date.now()}`;

    const sendResult = await notificationEngine.sendNotification({
      recipientUserId,
      category: 'DISPUTE',
      priority: 'HIGH',
      sensitivity: 'SENSITIVE',
      title: `Security Deposit Deduction Notice: ${deduction.category}`,
      message: `A security deposit deduction of ${deduction.amount} ${deduction.currency} has been proposed. Description: ${deduction.description}`,
      channels,
      sourceDomain: 'SECURITY_DEPOSIT',
      sourceEntityId: deduction.id,
      idempotencyKey,
    }, {
      actorUserId: actor.id,
      actorRole: actor.roles?.[0] || actor.role || 'USER',
    });

    // 6. Inspect delivery status
    const deliveredAttempt = sendResult.deliveries.find(d =>
      d.status === DeliveryStatus.DELIVERED || d.status === DeliveryStatus.DELIVERY_CONFIRMED
    );
    const sentAttempt = sendResult.deliveries.find(d => d.status === DeliveryStatus.SENT);
    const failedAttempt = sendResult.deliveries.find(d => d.status === DeliveryStatus.FAILED);

    const isConfirmedDelivered = !!deliveredAttempt;
    const confirmedAt = deliveredAttempt?.deliveredAt ? new Date(deliveredAttempt.deliveredAt) : (isConfirmedDelivered ? new Date() : null);

    // Only establish dispute deadline upon confirmed delivery!
    const disputeDeadline = confirmedAt ? new Date(confirmedAt.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
    const noticeDeliveryId = deliveredAttempt?.id || sentAttempt?.id || failedAttempt?.id || null;
    const noticeDeliveryStatus = deliveredAttempt ? DeliveryStatus.DELIVERED : (sentAttempt ? DeliveryStatus.SENT : (failedAttempt ? DeliveryStatus.FAILED : 'NOT_SENT'));

    // 7. Atomically persist deduction state and audit log
    const shouldSimulateFailure = options?.simulateAuditFailure || actor.simulateAuditFailure;

    return await db.transaction(async (tx) => {
      const [updated] = await tx.update(securityDepositDeductions)
        .set({
          tenantNotifiedAt: confirmedAt,
          disputeDeadline,
          noticeNotificationId: sendResult.notification.id,
          noticeDeliveryId,
          noticeDeliveryStatus,
          updatedAt: new Date(),
        })
        .where(eq(securityDepositDeductions.id, deduction.id))
        .returning();

      if (shouldSimulateFailure) {
        throw new Error('SIMULATED_AUDIT_FAILURE: Testing atomic rollback on notice delivery');
      }

      await auditService.logAction({
        actorUserId: actor.id,
        actorRole: actor.roles?.[0] || actor.role || 'USER',
        action: isConfirmedDelivered
          ? 'TENANT_DEDUCTION_NOTICE_DELIVERED'
          : (noticeDeliveryStatus === DeliveryStatus.SENT ? 'TENANT_DEDUCTION_NOTICE_DISPATCHED' : 'TENANT_DEDUCTION_NOTICE_FAILED'),
        resourceType: 'SecurityDepositDeduction',
        resourceId: deduction.id,
        changes: {
          notificationId: sendResult.notification.id,
          deliveryId: noticeDeliveryId,
          deliveryStatus: noticeDeliveryStatus,
          tenantNotifiedAt: confirmedAt,
          disputeDeadline,
        },
        tx,
      });

      return updated as unknown as SecurityDepositDeduction;
    });
  }

  /**
   * Idempotently handles asynchronous provider delivery status callbacks (e.g. email/SMS webhooks).
   * - Confirmed delivery transitions set deliveredAt and anchor the 30-day dispute deadline.
   * - Repeated or late delivery callbacks for already notified deductions are strictly idempotent
   *   and cannot extend or reset the 30-day deadline.
   * - Non-delivered or failure callbacks update status without falsely starting the dispute clock.
   */
  async handleNoticeDeliveryCallback(
    deliveryId: string,
    status: DeliveryStatus,
    options?: {
      deliveredAt?: Date | string;
      failureReason?: string;
      providerMessageId?: string;
    }
  ): Promise<SecurityDepositDeduction> {
    if (!deliveryId) throw new Error('VALIDATION_ERROR: Delivery ID is required.');

    return await db.transaction(async (tx) => {
      let [deduction] = await tx.select().from(securityDepositDeductions)
        .where(eq(securityDepositDeductions.noticeDeliveryId, deliveryId))
        .limit(1)
        .for('update');

      if (!deduction) {
        const [delivery] = await tx.select().from(notificationDeliveries)
          .where(eq(notificationDeliveries.id, deliveryId))
          .limit(1);

        if (delivery) {
          const [byNotif] = await tx.select().from(securityDepositDeductions)
            .where(eq(securityDepositDeductions.noticeNotificationId, delivery.notificationId))
            .limit(1)
            .for('update');
          if (byNotif) deduction = byNotif;
        }
      }

      if (!deduction) {
        throw new Error(`NOT_FOUND: No security deposit deduction linked to delivery '${deliveryId}'.`);
      }

      // Idempotency: If deadline is already anchored, do NOT reset or extend it!
      if (deduction.tenantNotifiedAt && deduction.disputeDeadline) {
        return deduction as unknown as SecurityDepositDeduction;
      }

      const isDelivered = status === DeliveryStatus.DELIVERED || status === DeliveryStatus.DELIVERY_CONFIRMED;

      if (isDelivered) {
        const deliveredAt = options?.deliveredAt ? new Date(options.deliveredAt) : new Date();
        const disputeDeadline = new Date(deliveredAt.getTime() + 30 * 24 * 60 * 60 * 1000);

        const [updated] = await tx.update(securityDepositDeductions)
          .set({
            tenantNotifiedAt: deliveredAt,
            disputeDeadline,
            noticeDeliveryId: deliveryId,
            noticeDeliveryStatus: DeliveryStatus.DELIVERED,
            updatedAt: new Date(),
          })
          .where(eq(securityDepositDeductions.id, deduction.id))
          .returning();

        await auditService.logAction({
          actorUserId: 'SYSTEM',
          actorRole: 'SYSTEM',
          action: 'TENANT_DEDUCTION_NOTICE_DELIVERY_CONFIRMED',
          resourceType: 'SecurityDepositDeduction',
          resourceId: deduction.id,
          changes: {
            deliveryId,
            previousStatus: deduction.noticeDeliveryStatus,
            newStatus: DeliveryStatus.DELIVERED,
            tenantNotifiedAt: deliveredAt,
            disputeDeadline,
          },
          tx,
        });

        return updated as unknown as SecurityDepositDeduction;
      } else {
        const [updated] = await tx.update(securityDepositDeductions)
          .set({
            noticeDeliveryId: deliveryId,
            noticeDeliveryStatus: status,
            updatedAt: new Date(),
          })
          .where(eq(securityDepositDeductions.id, deduction.id))
          .returning();

        await auditService.logAction({
          actorUserId: 'SYSTEM',
          actorRole: 'SYSTEM',
          action: 'TENANT_DEDUCTION_NOTICE_DELIVERY_FAILED',
          resourceType: 'SecurityDepositDeduction',
          resourceId: deduction.id,
          changes: {
            deliveryId,
            previousStatus: deduction.noticeDeliveryStatus,
            newStatus: status,
            failureReason: options?.failureReason,
          },
          tx,
        });

        return updated as unknown as SecurityDepositDeduction;
      }
    });
  }

  /**
   * Controlled idempotent retry for failed tenant notice deliveries.
   * If a previous delivery attempt failed, attempts controlled re-dispatch.
   * If already delivered, returns unchanged state without duplicate dispatch or deadline mutation.
   */
  async retryNoticeDelivery(
    deductionId: string,
    actor: DeductionActor,
    options?: {
      channel?: NotificationChannel;
    }
  ): Promise<SecurityDepositDeduction> {
    if (!deductionId) throw new Error('VALIDATION_ERROR: Deduction ID is required.');

    const [deduction] = await db.select().from(securityDepositDeductions)
      .where(eq(securityDepositDeductions.id, deductionId))
      .limit(1);

    if (!deduction) {
      throw new Error(`NOT_FOUND: Security deposit deduction '${deductionId}' not found.`);
    }

    const [deposit] = await db.select().from(securityDeposits)
      .where(eq(securityDeposits.id, deduction.depositId))
      .limit(1);

    if (!deposit) {
      throw new Error(`NOT_FOUND: Associated deposit for deduction '${deductionId}' not found.`);
    }

    const hasAuth = await this.verifyDeductionProposalAuthority(deposit.propertyId, actor);
    if (!hasAuth) {
      throw new Error('FORBIDDEN: You are not authorized to retry notice delivery for this deduction.');
    }

    // Idempotency: If already delivered, return existing state
    if (deduction.tenantNotifiedAt && deduction.noticeDeliveryStatus === 'DELIVERED') {
      return deduction as unknown as SecurityDepositDeduction;
    }

    if (deduction.noticeDeliveryId) {
      const retriedDelivery = await notificationEngine.retryDelivery(deduction.noticeDeliveryId, {
        actorUserId: actor.id,
        actorRole: actor.roles?.[0] || actor.role || 'USER',
      });

      if (retriedDelivery.status === DeliveryStatus.DELIVERED || retriedDelivery.status === DeliveryStatus.DELIVERY_CONFIRMED) {
        const deliveredAt = retriedDelivery.deliveredAt ? new Date(retriedDelivery.deliveredAt) : new Date();
        const disputeDeadline = new Date(deliveredAt.getTime() + 30 * 24 * 60 * 60 * 1000);

        return await db.transaction(async (tx) => {
          const [updated] = await tx.update(securityDepositDeductions)
            .set({
              tenantNotifiedAt: deliveredAt,
              disputeDeadline,
              noticeDeliveryStatus: DeliveryStatus.DELIVERED,
              updatedAt: new Date(),
            })
            .where(eq(securityDepositDeductions.id, deduction.id))
            .returning();

          await auditService.logAction({
            actorUserId: actor.id,
            actorRole: actor.roles?.[0] || actor.role || 'USER',
            action: 'TENANT_DEDUCTION_NOTICE_DELIVERY_CONFIRMED',
            resourceType: 'SecurityDepositDeduction',
            resourceId: deduction.id,
            changes: {
              deliveryId: deduction.noticeDeliveryId,
              previousStatus: deduction.noticeDeliveryStatus,
              newStatus: DeliveryStatus.DELIVERED,
              tenantNotifiedAt: deliveredAt,
              disputeDeadline,
            },
            tx,
          });

          return updated as unknown as SecurityDepositDeduction;
        });
      } else {
        const [updated] = await db.update(securityDepositDeductions)
          .set({
            noticeDeliveryStatus: retriedDelivery.status,
            updatedAt: new Date(),
          })
          .where(eq(securityDepositDeductions.id, deduction.id))
          .returning();

        return updated as unknown as SecurityDepositDeduction;
      }
    } else {
      return await this.dispatchDeductionNotice(deduction.id, actor, {
        channels: options?.channel ? [options.channel] : undefined,
      });
    }
  }

  /**
   * Disputes a proposed or owner-approved security deposit deduction.
   * Actor must be the tenant on the associated lease or platform admin.
   * Requires non-empty disputeReason and valid evidence references if provided.
   * Enforces 30-day dispute window if disputeDeadline is set.
   * Transitions status to DISPUTED and records disputedAt and disputeReason.
   */
  async disputeDeduction(input: DisputeDeductionInput, actor: DeductionActor): Promise<SecurityDepositDeduction> {
    if (!input) throw new Error('VALIDATION_ERROR: Input payload is required.');
    if (!input.deductionId) throw new Error('VALIDATION_ERROR: Deduction ID is required.');
    if (!input.disputeReason || !input.disputeReason.trim()) {
      throw new Error('VALIDATION_ERROR: Dispute reason is required.');
    }

    if (input.evidenceRefs && Array.isArray(input.evidenceRefs)) {
      for (const ref of input.evidenceRefs) {
        this.validateEvidenceReference(ref);
      }
    }

    return await db.transaction(async (tx) => {
      const [deduction] = await tx.select().from(securityDepositDeductions)
        .where(eq(securityDepositDeductions.id, input.deductionId))
        .limit(1)
        .for('update');

      if (!deduction) {
        throw new Error('NOT_FOUND: Security deposit deduction not found.');
      }

      // Authorization check: Actor must be a tenant on this lease or platform admin
      const roles = actor.roles || (actor.role ? [actor.role] : []);
      const isPlatformAdmin = roles.includes(UserRole.PLATFORM_ADMIN) || roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');

      if (!isPlatformAdmin) {
        const tenantLinks = await tx.select().from(leaseTenants).where(and(
          eq(leaseTenants.leaseId, deduction.leaseId),
          eq(leaseTenants.tenantId, actor.id)
        )).limit(1);

        if (tenantLinks.length === 0) {
          throw new Error('FORBIDDEN: Only the tenant on this lease may dispute this deduction.');
        }
      }

      // State check: Only PROPOSED or OWNER_APPROVED deductions can be disputed
      if (deduction.status === 'DISPUTED') {
        throw new Error('INVALID_STATE: Deduction is already in DISPUTED status.');
      }
      if (deduction.status !== 'PROPOSED' && deduction.status !== 'OWNER_APPROVED') {
        throw new Error(`INVALID_STATE: Cannot dispute deduction with status '${deduction.status}'. Only 'PROPOSED' or 'OWNER_APPROVED' deductions can be disputed.`);
      }

      // Dispute window check: 30 days from confirmed delivery
      if (deduction.disputeDeadline && new Date() > new Date(deduction.disputeDeadline)) {
        throw new Error('DISPUTE_WINDOW_EXPIRED: The 30-day dispute window for this deduction has expired.');
      }

      const combinedEvidence = input.evidenceRefs && input.evidenceRefs.length > 0
        ? [...((deduction.evidenceRefs as string[]) || []), ...input.evidenceRefs]
        : deduction.evidenceRefs;

      const [updatedDeduction] = await tx.update(securityDepositDeductions)
        .set({
          status: 'DISPUTED',
          disputedAt: new Date(),
          disputeReason: input.disputeReason.trim(),
          evidenceRefs: combinedEvidence,
          updatedAt: new Date(),
        })
        .where(eq(securityDepositDeductions.id, deduction.id))
        .returning();

      if (actor.simulateAuditFailure) {
        throw new Error('SIMULATED_AUDIT_FAILURE: Testing atomic rollback on dispute');
      }

      await auditService.logAction({
        actorUserId: actor.id,
        actorRole: actor.roles?.[0] || actor.role || 'TENANT',
        action: 'DISPUTE_SECURITY_DEPOSIT_DEDUCTION',
        resourceType: 'SecurityDepositDeduction',
        resourceId: updatedDeduction.id,
        changes: {
          previousStatus: deduction.status,
          newStatus: 'DISPUTED',
          disputeReason: updatedDeduction.disputeReason,
          disputedAt: updatedDeduction.disputedAt,
        },
        tx,
      });

      return updatedDeduction as unknown as SecurityDepositDeduction;
    });
  }
}

export const securityDepositDeductionService = new SecurityDepositDeductionService();
