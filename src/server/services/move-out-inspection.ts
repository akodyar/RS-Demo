import { db } from '../../db/index.js';
import {
  leases,
  moveOutRequests,
  ownershipRecords,
  managementAgreements,
  organizationMembers,
  leaseMoveOutInspections,
  leaseMoveOutInspectionItems,
  leaseTenants,
  users,
} from '../../db/schema.js';
import { eq, and, or, sql, desc } from 'drizzle-orm';
import { auditService } from './audit.js';
import {
  UserRole,
  Permission,
  MoveOutInspectionStatus,
  MoveOutInspectionItemCondition,
  LeaseMoveOutInspection,
  LeaseMoveOutInspectionItem,
} from '../../types/index.js';

export interface InspectionActor {
  id: string;
  role?: string;
  roles?: string[];
  organizationId?: string;
}

export interface CreateInspectionInput {
  leaseId: string;
  moveOutRequestId?: string | null;
  propertyId: string;
  hasMoveInBaseline: boolean;
  moveInBaselineReference?: string | null;
  generalNotes?: string | null;
  tenantPresent?: boolean;
  tenantSignatureRef?: string | null;
  metadata?: Record<string, any> | null;
}

export interface AddInspectionItemInput {
  area: string;
  component: string;
  condition: MoveOutInspectionItemCondition;
  damageDescription?: string | null;
  isTenantCaused?: boolean;
  estimatedRepairCost?: number | string;
  currency?: string;
  evidenceRefs?: string[] | null;
}

export interface UpdateInspectionItemInput {
  area?: string;
  component?: string;
  condition?: MoveOutInspectionItemCondition;
  damageDescription?: string | null;
  isTenantCaused?: boolean;
  estimatedRepairCost?: number | string;
  currency?: string;
  evidenceRefs?: string[] | null;
}

export interface CompleteInspectionInput {
  generalNotes?: string | null;
  tenantPresent?: boolean;
  tenantSignatureRef?: string | null;
  metadata?: Record<string, any> | null;
}

export const VALID_ITEM_CONDITIONS: MoveOutInspectionItemCondition[] = [
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'DAMAGED',
  'MISSING',
  'DIRTY',
];

export const VALID_INSPECTION_STATUSES: MoveOutInspectionStatus[] = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export const VALID_CURRENCIES = ['IQD', 'USD'];

export class MoveOutInspectionService {
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
   * Authoritative object-level authorization check.
   * Verified Owner via ownership_records or Authorized Company via active management_agreements.
   * Fail closed.
   */
  async verifyPropertyInspectionAuthority(propertyId: string, actor: InspectionActor): Promise<boolean> {
    if (!actor || !actor.id) return false;

    const roles = actor.roles || (actor.role ? [actor.role] : []);
    const isPlatformAdmin = roles.includes(UserRole.PLATFORM_ADMIN) || roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    if (isPlatformAdmin) return true;

    // 1. Direct verified owner check
    if (roles.includes(UserRole.PROPERTY_OWNER) || roles.includes('PROPERTY_OWNER')) {
      const ownerRecord = await db.select().from(ownershipRecords).where(and(
        eq(ownershipRecords.ownerId, actor.id),
        eq(ownershipRecords.propertyId, propertyId),
        eq(ownershipRecords.status, 'VERIFIED')
      )).limit(1);

      if (ownerRecord.length > 0) return true;
    }

    // 2. Company manager / member check
    const isCompanyUser = roles.includes(UserRole.COMPANY) || roles.includes(UserRole.COMPANY_MEMBER) || roles.includes('COMPANY') || roles.includes('COMPANY_MEMBER') || roles.includes('PROPERTY_MANAGER');
    if (isCompanyUser && actor.organizationId) {
      // Validate active organization membership
      const membership = await db.select().from(organizationMembers).where(and(
        eq(organizationMembers.userId, actor.id),
        eq(organizationMembers.organizationId, actor.organizationId),
        eq(organizationMembers.status, 'ACTIVE')
      )).limit(1);

      if (membership.length === 0 && !roles.includes(UserRole.COMPANY) && !roles.includes('COMPANY')) {
        return false;
      }

      // Check active management agreement for this property
      const agreement = await db.select().from(managementAgreements).where(and(
        eq(managementAgreements.companyId, actor.organizationId),
        eq(managementAgreements.propertyId, propertyId),
        eq(managementAgreements.status, 'ACTIVE')
      )).limit(1);

      if (agreement.length > 0) {
        // Expiration check
        if (agreement[0].endDate && new Date(agreement[0].endDate).getTime() < Date.now()) {
          return false;
        }

        const perms = (agreement[0].grantedPermissions as string[]) || [];
        const hasManagementPerm = perms.includes(Permission.MANAGE_LEASES) ||
          perms.includes(Permission.VIEW_PROPERTY) ||
          perms.includes(Permission.MANAGE_MAINTENANCE) ||
          perms.includes('MANAGE_LEASES') ||
          perms.includes('VIEW_PROPERTY');

        if (hasManagementPerm) return true;
      }
    }

    return false;
  }

  /**
   * Creates a move-out inspection row under atomic transaction and audit logging.
   */
  async createInspection(input: CreateInspectionInput, actor: InspectionActor): Promise<any> {
    const isAuthorized = await this.verifyPropertyInspectionAuthority(input.propertyId, actor);
    if (!isAuthorized) {
      throw new Error(`AUTHORIZATION_DENIED: Actor ${actor.id} lacks management authority for property ${input.propertyId}`);
    }

    return await db.transaction(async (tx) => {
      // 1. Validate lease exists and belongs to target property
      const [lease] = await tx.select().from(leases).where(eq(leases.id, input.leaseId)).limit(1);
      if (!lease) {
        throw new Error(`LEASE_NOT_FOUND: Lease ${input.leaseId} does not exist.`);
      }

      if (lease.propertyId !== input.propertyId) {
        throw new Error(`PROPERTY_LEASE_MISMATCH: Lease ${input.leaseId} belongs to property ${lease.propertyId}, not ${input.propertyId}.`);
      }

      // 2. Validate move-out request if provided
      if (input.moveOutRequestId) {
        const [mor] = await tx.select().from(moveOutRequests).where(eq(moveOutRequests.id, input.moveOutRequestId)).limit(1);
        if (!mor) {
          throw new Error(`MOVE_OUT_REQUEST_NOT_FOUND: Move-out request ${input.moveOutRequestId} does not exist.`);
        }

        if (mor.leaseId !== input.leaseId) {
          throw new Error(`MOVE_OUT_REQUEST_LEASE_MISMATCH: Move-out request ${input.moveOutRequestId} belongs to lease ${mor.leaseId}, not ${input.leaseId}.`);
        }

        if (mor.propertyId !== input.propertyId) {
          throw new Error(`MOVE_OUT_REQUEST_PROPERTY_MISMATCH: Move-out request ${input.moveOutRequestId} belongs to property ${mor.propertyId}, not ${input.propertyId}.`);
        }
      }

      // 3. Move-in baseline validation
      let baselineRef: string | null = null;
      if (input.hasMoveInBaseline) {
        if (!input.moveInBaselineReference || typeof input.moveInBaselineReference !== 'string' || !input.moveInBaselineReference.trim()) {
          throw new Error('MISSING_BASELINE_REFERENCE: A valid moveInBaselineReference must be provided when hasMoveInBaseline is true.');
        }
        baselineRef = input.moveInBaselineReference.trim();
        this.validateEvidenceReference(baselineRef);
      } else {
        if (input.moveInBaselineReference) {
          throw new Error('SPURIOUS_BASELINE_REFERENCE: moveInBaselineReference must be null when hasMoveInBaseline is false.');
        }
        baselineRef = null;
      }

      // Validate tenant signature ref if supplied
      if (input.tenantSignatureRef) {
        this.validateEvidenceReference(input.tenantSignatureRef);
      }

      // 4. Insert inspection record
      const [inspection] = await tx.insert(leaseMoveOutInspections).values({
        leaseId: input.leaseId,
        moveOutRequestId: input.moveOutRequestId || null,
        propertyId: input.propertyId,
        inspectorId: actor.id,
        status: 'SCHEDULED',
        hasMoveInBaseline: input.hasMoveInBaseline,
        moveInBaselineReference: baselineRef,
        generalNotes: input.generalNotes || null,
        tenantPresent: Boolean(input.tenantPresent),
        tenantSignatureRef: input.tenantSignatureRef || null,
        metadata: input.metadata || null,
      }).returning();

      // 5. Audit log
      const actorRole = actor.role || actor.roles?.[0] || 'PROPERTY_MANAGER';
      await auditService.logAction({
        actorUserId: actor.id,
        actorRole,
        action: 'MOVE_OUT_INSPECTION_CREATED',
        resourceType: 'LeaseMoveOutInspection',
        resourceId: inspection.id,
        changes: {
          leaseId: inspection.leaseId,
          propertyId: inspection.propertyId,
          moveOutRequestId: inspection.moveOutRequestId,
          hasMoveInBaseline: inspection.hasMoveInBaseline,
          status: inspection.status,
        },
        tx,
      });

      return inspection;
    });
  }

  /**
   * Adds an inspection item to an active inspection.
   */
  async addInspectionItem(inspectionId: string, input: AddInspectionItemInput, actor: InspectionActor): Promise<any> {
    return await db.transaction(async (tx) => {
      // 1. Fetch parent inspection
      const [inspection] = await tx.select().from(leaseMoveOutInspections).where(eq(leaseMoveOutInspections.id, inspectionId)).limit(1);
      if (!inspection) {
        throw new Error(`INSPECTION_NOT_FOUND: Inspection ${inspectionId} does not exist.`);
      }

      // Immutability check on terminal states
      if (inspection.status === 'COMPLETED' || inspection.status === 'CANCELLED') {
        throw new Error(`INSPECTION_IMMUTABLE: Cannot add items to an inspection in terminal status '${inspection.status}'.`);
      }

      // Authorization check
      const isAuthorized = await this.verifyPropertyInspectionAuthority(inspection.propertyId, actor);
      if (!isAuthorized) {
        throw new Error(`AUTHORIZATION_DENIED: Actor ${actor.id} lacks management authority for inspection ${inspectionId}`);
      }

      // 2. Validate input fields
      if (!input.area || !input.area.trim()) {
        throw new Error('INVALID_ITEM_AREA: Area must be a non-empty string.');
      }
      if (!input.component || !input.component.trim()) {
        throw new Error('INVALID_ITEM_COMPONENT: Component must be a non-empty string.');
      }
      if (!VALID_ITEM_CONDITIONS.includes(input.condition)) {
        throw new Error(`INVALID_ITEM_CONDITION: Condition '${input.condition}' is not supported. Supported: ${VALID_ITEM_CONDITIONS.join(', ')}`);
      }

      const repairCostNum = Number(input.estimatedRepairCost ?? 0);
      if (isNaN(repairCostNum) || repairCostNum < 0) {
        throw new Error('INVALID_REPAIR_COST: Estimated repair cost must be a non-negative number.');
      }

      const currency = input.currency ? input.currency.toUpperCase() : 'IQD';
      if (!VALID_CURRENCIES.includes(currency)) {
        throw new Error(`INVALID_CURRENCY: Currency '${currency}' is not supported. Supported: ${VALID_CURRENCIES.join(', ')}`);
      }

      // 3. Validate evidence references
      const validatedEvidenceRefs: string[] = [];
      if (input.evidenceRefs && Array.isArray(input.evidenceRefs)) {
        for (const ref of input.evidenceRefs) {
          this.validateEvidenceReference(ref);
          validatedEvidenceRefs.push(ref.trim());
        }
      }

      // 4. Insert item
      const [item] = await tx.insert(leaseMoveOutInspectionItems).values({
        inspectionId,
        area: input.area.trim(),
        component: input.component.trim(),
        condition: input.condition,
        damageDescription: input.damageDescription || null,
        isTenantCaused: Boolean(input.isTenantCaused),
        estimatedRepairCost: repairCostNum.toString(),
        currency,
        evidenceRefs: validatedEvidenceRefs.length > 0 ? validatedEvidenceRefs : null,
      }).returning();

      // 5. Transition inspection to IN_PROGRESS if SCHEDULED
      if (inspection.status === 'SCHEDULED') {
        await tx.update(leaseMoveOutInspections)
          .set({ status: 'IN_PROGRESS', updatedAt: new Date() })
          .where(eq(leaseMoveOutInspections.id, inspectionId));
      }

      // 6. Audit log
      const actorRole = actor.role || actor.roles?.[0] || 'PROPERTY_MANAGER';
      await auditService.logAction({
        actorUserId: actor.id,
        actorRole,
        action: 'INSPECTION_ITEM_ADDED',
        resourceType: 'LeaseMoveOutInspectionItem',
        resourceId: item.id,
        changes: {
          inspectionId,
          area: item.area,
          component: item.component,
          condition: item.condition,
          isTenantCaused: item.isTenantCaused,
          estimatedRepairCost: item.estimatedRepairCost,
        },
        tx,
      });

      return item;
    });
  }

  /**
   * Updates an existing inspection item on an active inspection.
   */
  async updateInspectionItem(itemId: string, input: UpdateInspectionItemInput, actor: InspectionActor): Promise<any> {
    return await db.transaction(async (tx) => {
      // 1. Fetch item and parent inspection
      const [item] = await tx.select().from(leaseMoveOutInspectionItems).where(eq(leaseMoveOutInspectionItems.id, itemId)).limit(1);
      if (!item) {
        throw new Error(`INSPECTION_ITEM_NOT_FOUND: Inspection item ${itemId} does not exist.`);
      }

      const [inspection] = await tx.select().from(leaseMoveOutInspections).where(eq(leaseMoveOutInspections.id, item.inspectionId)).limit(1);
      if (!inspection) {
        throw new Error(`INSPECTION_NOT_FOUND: Parent inspection ${item.inspectionId} does not exist.`);
      }

      // Immutability check
      if (inspection.status === 'COMPLETED' || inspection.status === 'CANCELLED') {
        throw new Error(`INSPECTION_IMMUTABLE: Cannot modify items on an inspection in status '${inspection.status}'.`);
      }

      // Authorization check
      const isAuthorized = await this.verifyPropertyInspectionAuthority(inspection.propertyId, actor);
      if (!isAuthorized) {
        throw new Error(`AUTHORIZATION_DENIED: Actor ${actor.id} lacks management authority.`);
      }

      // 2. Validate updates
      const updateData: any = { updatedAt: new Date() };

      if (input.area !== undefined) {
        if (!input.area || !input.area.trim()) throw new Error('INVALID_ITEM_AREA: Area cannot be empty.');
        updateData.area = input.area.trim();
      }

      if (input.component !== undefined) {
        if (!input.component || !input.component.trim()) throw new Error('INVALID_ITEM_COMPONENT: Component cannot be empty.');
        updateData.component = input.component.trim();
      }

      if (input.condition !== undefined) {
        if (!VALID_ITEM_CONDITIONS.includes(input.condition)) {
          throw new Error(`INVALID_ITEM_CONDITION: Condition '${input.condition}' is not supported.`);
        }
        updateData.condition = input.condition;
      }

      if (input.damageDescription !== undefined) {
        updateData.damageDescription = input.damageDescription || null;
      }

      if (input.isTenantCaused !== undefined) {
        updateData.isTenantCaused = Boolean(input.isTenantCaused);
      }

      if (input.estimatedRepairCost !== undefined) {
        const costNum = Number(input.estimatedRepairCost);
        if (isNaN(costNum) || costNum < 0) {
          throw new Error('INVALID_REPAIR_COST: Estimated repair cost must be non-negative.');
        }
        updateData.estimatedRepairCost = costNum.toString();
      }

      if (input.currency !== undefined) {
        const curr = input.currency.toUpperCase();
        if (!VALID_CURRENCIES.includes(curr)) {
          throw new Error(`INVALID_CURRENCY: Currency '${curr}' is not supported.`);
        }
        updateData.currency = curr;
      }

      if (input.evidenceRefs !== undefined) {
        if (input.evidenceRefs === null) {
          updateData.evidenceRefs = null;
        } else if (Array.isArray(input.evidenceRefs)) {
          for (const ref of input.evidenceRefs) {
            this.validateEvidenceReference(ref);
          }
          updateData.evidenceRefs = input.evidenceRefs.map(r => r.trim());
        }
      }

      const [updatedItem] = await tx.update(leaseMoveOutInspectionItems)
        .set(updateData)
        .where(eq(leaseMoveOutInspectionItems.id, itemId))
        .returning();

      // 3. Audit log
      const actorRole = actor.role || actor.roles?.[0] || 'PROPERTY_MANAGER';
      await auditService.logAction({
        actorUserId: actor.id,
        actorRole,
        action: 'INSPECTION_ITEM_UPDATED',
        resourceType: 'LeaseMoveOutInspectionItem',
        resourceId: itemId,
        changes: updateData,
        tx,
      });

      return updatedItem;
    });
  }

  /**
   * Completes an inspection after verifying preconditions (items recorded, active status, valid signature).
   * Completed inspections are terminal and cannot be rewritten.
   */
  async completeInspection(inspectionId: string, input: CompleteInspectionInput, actor: InspectionActor): Promise<any> {
    return await db.transaction(async (tx) => {
      // 1. Fetch inspection
      const [inspection] = await tx.select().from(leaseMoveOutInspections).where(eq(leaseMoveOutInspections.id, inspectionId)).limit(1);
      if (!inspection) {
        throw new Error(`INSPECTION_NOT_FOUND: Inspection ${inspectionId} does not exist.`);
      }

      // Lifecycle status checks
      if (inspection.status === 'COMPLETED') {
        throw new Error('INSPECTION_ALREADY_COMPLETED: Inspection is already completed and immutable.');
      }
      if (inspection.status === 'CANCELLED') {
        throw new Error('INSPECTION_CANCELLED: Cannot complete a cancelled inspection.');
      }

      // Authorization check
      const isAuthorized = await this.verifyPropertyInspectionAuthority(inspection.propertyId, actor);
      if (!isAuthorized) {
        throw new Error(`AUTHORIZATION_DENIED: Actor ${actor.id} lacks management authority.`);
      }

      // 2. Precondition: At least one inspection item must be recorded
      const items = await tx.select().from(leaseMoveOutInspectionItems).where(eq(leaseMoveOutInspectionItems.inspectionId, inspectionId));
      if (items.length === 0) {
        throw new Error('INSPECTION_ITEMS_REQUIRED: Cannot complete an inspection without at least one recorded item.');
      }

      // 3. Validate tenant signature ref if provided
      if (input.tenantSignatureRef) {
        this.validateEvidenceReference(input.tenantSignatureRef);
      }

      // 4. Update inspection status to COMPLETED
      const [completedInspection] = await tx.update(leaseMoveOutInspections)
        .set({
          status: 'COMPLETED',
          completedAt: new Date(),
          generalNotes: input.generalNotes !== undefined ? input.generalNotes : inspection.generalNotes,
          tenantPresent: input.tenantPresent !== undefined ? Boolean(input.tenantPresent) : inspection.tenantPresent,
          tenantSignatureRef: input.tenantSignatureRef !== undefined ? input.tenantSignatureRef : inspection.tenantSignatureRef,
          metadata: input.metadata !== undefined ? input.metadata : inspection.metadata,
          updatedAt: new Date(),
        })
        .where(eq(leaseMoveOutInspections.id, inspectionId))
        .returning();

      // 5. Audit log
      const actorRole = actor.role || actor.roles?.[0] || 'PROPERTY_MANAGER';
      await auditService.logAction({
        actorUserId: actor.id,
        actorRole,
        action: 'MOVE_OUT_INSPECTION_COMPLETED',
        resourceType: 'LeaseMoveOutInspection',
        resourceId: completedInspection.id,
        changes: {
          status: 'COMPLETED',
          completedAt: completedInspection.completedAt,
          totalItems: items.length,
          tenantPresent: completedInspection.tenantPresent,
        },
        tx,
      });

      return completedInspection;
    });
  }

  /**
   * Fetches an inspection with all its items, enforcing tenant or management access.
   */
  async getInspectionWithItems(inspectionId: string, actor: InspectionActor): Promise<any> {
    const [inspection] = await db.select().from(leaseMoveOutInspections).where(eq(leaseMoveOutInspections.id, inspectionId)).limit(1);
    if (!inspection) {
      throw new Error(`INSPECTION_NOT_FOUND: Inspection ${inspectionId} does not exist.`);
    }

    // Check authority: Manager/Owner OR Tenant on the lease
    const isManagerAuthorized = await this.verifyPropertyInspectionAuthority(inspection.propertyId, actor);
    if (!isManagerAuthorized) {
      // Check if actor is an authorized tenant on this lease
      const tenantMatch = await db.select().from(leaseTenants).where(and(
        eq(leaseTenants.leaseId, inspection.leaseId),
        eq(leaseTenants.tenantId, actor.id)
      )).limit(1);

      if (tenantMatch.length === 0) {
        throw new Error('ACCESS_DENIED: You do not have permission to view this inspection.');
      }
    }

    const items = await db.select().from(leaseMoveOutInspectionItems).where(eq(leaseMoveOutInspectionItems.inspectionId, inspectionId));

    return {
      ...inspection,
      items,
    };
  }

  /**
   * Cancels a scheduled or in-progress inspection. Terminal COMPLETED inspections cannot be cancelled.
   */
  async cancelInspection(inspectionId: string, reason: string, actor: InspectionActor): Promise<any> {
    return await db.transaction(async (tx) => {
      const [inspection] = await tx.select().from(leaseMoveOutInspections).where(eq(leaseMoveOutInspections.id, inspectionId)).limit(1);
      if (!inspection) {
        throw new Error(`INSPECTION_NOT_FOUND: Inspection ${inspectionId} does not exist.`);
      }

      if (inspection.status === 'COMPLETED') {
        throw new Error('INSPECTION_IMMUTABLE: Cannot cancel a completed inspection.');
      }
      if (inspection.status === 'CANCELLED') {
        return inspection;
      }

      const isAuthorized = await this.verifyPropertyInspectionAuthority(inspection.propertyId, actor);
      if (!isAuthorized) {
        throw new Error('AUTHORIZATION_DENIED: Lacks authority to cancel inspection.');
      }

      const [cancelled] = await tx.update(leaseMoveOutInspections)
        .set({
          status: 'CANCELLED',
          generalNotes: inspection.generalNotes ? `${inspection.generalNotes}\n[CANCELLED]: ${reason}` : `[CANCELLED]: ${reason}`,
          updatedAt: new Date(),
        })
        .where(eq(leaseMoveOutInspections.id, inspectionId))
        .returning();

      const actorRole = actor.role || actor.roles?.[0] || 'PROPERTY_MANAGER';
      await auditService.logAction({
        actorUserId: actor.id,
        actorRole,
        action: 'MOVE_OUT_INSPECTION_CANCELLED',
        resourceType: 'LeaseMoveOutInspection',
        resourceId: inspectionId,
        changes: { status: 'CANCELLED', reason },
        tx,
      });

      return cancelled;
    });
  }

  /**
   * Fetches all inspections for a given lease, including items.
   * Verifies management authority or tenant lease membership.
   */
  async getInspectionsForLease(leaseId: string, actor: InspectionActor): Promise<any[]> {
    if (!leaseId) throw new Error('VALIDATION_ERROR: Lease ID is required.');

    const [lease] = await db.select().from(leases).where(eq(leases.id, leaseId)).limit(1);
    if (!lease) {
      throw new Error('INSPECTION_NOT_FOUND: Lease not found.');
    }

    // Verify authority: Manager/Owner OR Tenant on lease
    const isManagerAuthorized = await this.verifyPropertyInspectionAuthority(lease.propertyId, actor);
    if (!isManagerAuthorized) {
      const tenantMatch = await db.select().from(leaseTenants).where(and(
        eq(leaseTenants.leaseId, leaseId),
        eq(leaseTenants.tenantId, actor.id)
      )).limit(1);

      if (tenantMatch.length === 0) {
        throw new Error('ACCESS_DENIED: You do not have permission to view inspections for this lease.');
      }
    }

    const list = await db.select().from(leaseMoveOutInspections)
      .where(eq(leaseMoveOutInspections.leaseId, leaseId))
      .orderBy(desc(leaseMoveOutInspections.createdAt));

    const enriched = await Promise.all(list.map(async (insp) => {
      const items = await db.select().from(leaseMoveOutInspectionItems)
        .where(eq(leaseMoveOutInspectionItems.inspectionId, insp.id));
      return {
        ...insp,
        items,
      };
    }));

    return enriched;
  }
}

export const moveOutInspectionService = new MoveOutInspectionService();
