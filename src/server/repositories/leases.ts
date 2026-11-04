import { db } from '../../db/index.js';
import { leases, leaseTenants, rentSchedules, paymentRecords, securityDeposits, units, users } from '../../db/schema.js';
import { eq, or, and, lte, gte, isNull, inArray } from 'drizzle-orm';
import { LeaseStatus } from '../../types/index.js';
import { auditService } from '../services/audit.js';
import { financeService } from '../services/finance.js';
import { convertCurrency } from '../../utils/formatters.js';

export interface RenewalAuditContext {
  actorUserId: string;
  actorRole: string;
  ipAddress?: string;
  simulateAuditFailure?: boolean;
}

/**
 * Robust lease date order validation helper.
 * Rejects missing, invalid format, equal, or inverted dates.
 */
export function validateLeaseDateOrder(startDate: unknown, endDate: unknown): { validStartDate: string; validEndDate: string } {
  if (!startDate || typeof startDate !== 'string' || !startDate.trim()) {
    throw new Error('VALIDATION_ERROR: Lease start date is required and must be a valid date string.');
  }
  if (!endDate || typeof endDate !== 'string' || !endDate.trim()) {
    throw new Error('VALIDATION_ERROR: Lease end date is required and must be a valid date string.');
  }

  const startTrimmed = startDate.trim();
  const endTrimmed = endDate.trim();

  const startParsed = Date.parse(startTrimmed);
  const endParsed = Date.parse(endTrimmed);

  if (isNaN(startParsed)) {
    throw new Error(`VALIDATION_ERROR: Invalid lease start date '${startDate}'.`);
  }
  if (isNaN(endParsed)) {
    throw new Error(`VALIDATION_ERROR: Invalid lease end date '${endDate}'.`);
  }

  if (startParsed >= endParsed) {
    throw new Error('VALIDATION_ERROR: Lease start date must be strictly before end date.');
  }

  return { validStartDate: startTrimmed, validEndDate: endTrimmed };
}

/**
 * Authoritative helper to evaluate deposit reconciliation status under P01.
 * Determines whether a terminal lease is NOT_APPLICABLE, UNRESOLVED, or RECONCILED.
 */
export function computeDepositReconciliationStatus(
  leaseDepositRequired: number,
  leaseDeposits: any[]
): {
  reconciliationStatus: 'NOT_APPLICABLE' | 'UNRESOLVED' | 'RECONCILED';
  unresolvedReason: string | null;
  primaryDeposit: any;
} {
  let reconciliationStatus: 'NOT_APPLICABLE' | 'UNRESOLVED' | 'RECONCILED' = 'NOT_APPLICABLE';
  let unresolvedReason: string | null = null;
  const primaryDeposit: any = leaseDeposits[0] || null;

  if (leaseDeposits.length === 0) {
    if (leaseDepositRequired > 0) {
      // Agreed in lease contract, but deposit record missing / uncollected
      reconciliationStatus = 'UNRESOLVED';
      unresolvedReason = 'DEPOSIT_AGREED_BUT_UNCOLLECTED';
    } else {
      // No security deposit required
      reconciliationStatus = 'NOT_APPLICABLE';
    }
  } else {
    let hasInconsistency = false;
    let hasUnresolved = false;
    let allReconciled = true;

    for (const dep of leaseDeposits) {
      const required = parseFloat(dep.requiredAmount || '0');
      const recorded = parseFloat(dep.recordedAmount || '0');
      const released = parseFloat(dep.releasedAmount || '0');

      if (isNaN(required) || isNaN(recorded) || isNaN(released) || released > recorded) {
        hasInconsistency = true;
        break;
      }

      const held = recorded - released;

      if (dep.status === 'PENDING') {
        hasUnresolved = true;
        allReconciled = false;
        unresolvedReason = 'DEPOSIT_PENDING_COLLECTION';
      } else if (dep.status === 'PARTIALLY_COLLECTED') {
        hasUnresolved = true;
        allReconciled = false;
        unresolvedReason = 'DEPOSIT_PARTIALLY_COLLECTED';
      } else if (held > 0 || dep.status === 'HELD' || dep.status === 'PARTIALLY_REFUNDED') {
        hasUnresolved = true;
        allReconciled = false;
        unresolvedReason = 'DEPOSIT_CUSTODIAL_FUNDS_HELD';
      } else if (dep.status === 'REFUNDED' && recorded > 0 && released >= recorded) {
        // Reconciled
      } else {
        hasUnresolved = true;
        allReconciled = false;
        unresolvedReason = 'DEPOSIT_STATUS_UNRESOLVED';
      }
    }

    if (hasInconsistency) {
      reconciliationStatus = 'UNRESOLVED';
      unresolvedReason = 'DEPOSIT_DATA_INCONSISTENT';
    } else if (hasUnresolved || !allReconciled) {
      reconciliationStatus = 'UNRESOLVED';
    } else {
      reconciliationStatus = 'RECONCILED';
    }
  }

  return { reconciliationStatus, unresolvedReason, primaryDeposit };
}

export class LeaseRepository {
  
  /**
   * Enforces physical-space reservation invariant under a pessimistic parent-property row lock.
   * Serializes all lease operations on the property, validates unit belonging, and rejects
   * any overlapping lease with status ACTIVE, PENDING_APPROVAL, or PENDING_SIGNATURE.
   */
  async assertNoPhysicalSpaceOverlap(
    tx: any,
    params: {
      propertyId: string;
      unitId?: string | null;
      startDate: string;
      endDate: string;
      excludeLeaseId?: string;
      errorMessage?: string;
    }
  ) {
    const { propertyId, unitId, startDate, endDate, excludeLeaseId, errorMessage } = params;

    // Validate lease date order
    validateLeaseDateOrder(startDate, endDate);

    // 0. Lock the parent property to serialize all lease operations for this property
    const { properties } = await import('../../db/schema.js');
    const [propertyRecord] = await tx.select().from(properties).where(eq(properties.id, propertyId)).limit(1).for('update');
    if (!propertyRecord) {
      throw new Error("VALIDATION_ERROR: Property not found.");
    }

    // 1. Verify unit belongs to property if unitId is provided
    if (unitId) {
      const [unitRecord] = await tx.select().from(units).where(eq(units.id, unitId)).limit(1);
      if (!unitRecord || unitRecord.propertyId !== propertyId) {
        throw new Error("VALIDATION_ERROR: The specified unit does not belong to the selected property.");
      }
    }

    // 2. Check for overlapping active, pending approval, or pending signature leases
    const { not } = await import('drizzle-orm');
    const overlapConditions = [
      or(
        eq(leases.status, LeaseStatus.ACTIVE),
        eq(leases.status, LeaseStatus.PENDING_APPROVAL),
        eq(leases.status, LeaseStatus.PENDING_SIGNATURE)
      ),
      lte(leases.startDate, endDate),
      gte(leases.endDate, startDate)
    ];

    if (excludeLeaseId) {
      overlapConditions.push(not(eq(leases.id, excludeLeaseId)));
    }

    if (unitId) {
      overlapConditions.push(
        or(
          eq(leases.unitId, unitId),
          and(eq(leases.propertyId, propertyId), isNull(leases.unitId))
        )
      );
    } else {
      // A property-level lease (unitId IS NULL) claims the whole property.
      // It conflicts with every lease on this property, regardless of unitId.
      overlapConditions.push(eq(leases.propertyId, propertyId));
    }

    const overlaps = await tx.query.leases.findMany({
      where: and(...overlapConditions)
    });

    if (overlaps.length > 0) {
      throw new Error(errorMessage || "VALIDATION_ERROR: Lease period overlaps with an existing active or pending lease for this property/unit.");
    }
  }

  /**
   * Enforces unified tenant and rental application invariants:
   * 1. Dates are validated and non-inverted.
   * 2. All specified tenants exist and have the TENANT role in authoritative PostgreSQL records.
   * 3. The primary tenant (tenantIds[0]) has an APPROVED rental application for this specific property.
   *    Secondary co-tenants do not require separate rental applications under the Primary-Applicant-Only policy.
   * 4. The primary application is not already reserved by an active or pending lease.
   * 5. Prevents duplicate active or pending leases for each tenant on this property during the requested term.
   */
  async assertTenantAndApplicationInvariants(
    tx: any,
    params: {
      propertyId: string;
      unitId?: string | null;
      tenantIds: string[];
      startDate: string;
      endDate: string;
    }
  ) {
    const { propertyId, tenantIds, startDate, endDate } = params;

    validateLeaseDateOrder(startDate, endDate);

    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
      throw new Error("VALIDATION_ERROR: At least one tenant must be specified for the lease.");
    }

    for (const tId of tenantIds) {
      if (!tId || typeof tId !== 'string' || !tId.trim()) {
        throw new Error("VALIDATION_ERROR: Invalid tenant ID specified.");
      }
    }

    // Check for duplicate tenant IDs within the same lease request
    if (new Set(tenantIds).size !== tenantIds.length) {
      throw new Error("VALIDATION_ERROR: Duplicate tenant IDs specified for the lease.");
    }

    // Primary tenant convention: tenantIds[0] is the primary applicant
    const primaryTenantId = tenantIds[0].trim();

    // Enforce tenant role authorization boundary for all assigned tenants
    const tenantUsers = await tx.select().from(users).where(inArray(users.id, tenantIds));
    if (tenantUsers.length !== tenantIds.length) {
      throw new Error("VALIDATION_ERROR: One or more specified tenants do not exist.");
    }

    const { rentalApplications } = await import('../../db/schema.js');

    // 1. Verify existence, TENANT role, and term overlap for EVERY tenant
    for (const user of tenantUsers) {
      const userRoles = (user.roles || []) as string[];
      if (!userRoles.includes('TENANT')) {
        throw new Error(`VALIDATION_ERROR: Assigned user ${user.id} lacks the TENANT role. Cannot fabricate tenancy for non-tenant users.`);
      }

      // Prevent duplicate active or pending leases for this tenant on the same property during the requested term
      const existingTenantLease = await tx.select({
        id: leases.id,
        status: leases.status
      })
      .from(leaseTenants)
      .innerJoin(leases, eq(leaseTenants.leaseId, leases.id))
      .where(and(
        eq(leaseTenants.tenantId, user.id),
        eq(leases.propertyId, propertyId),
        or(
          eq(leases.status, LeaseStatus.ACTIVE),
          eq(leases.status, LeaseStatus.PENDING_APPROVAL),
          eq(leases.status, LeaseStatus.PENDING_SIGNATURE)
        ),
        lte(leases.startDate, endDate),
        gte(leases.endDate, startDate)
      ))
      .limit(1);

      if (existingTenantLease.length > 0) {
        throw new Error(`VALIDATION_ERROR: Tenant ${user.id} already has an active or pending lease (${existingTenantLease[0].status}) for this property during the requested period.`);
      }
    }

    // 2. Primary-Applicant-Only Policy:
    // Only the primary tenant (tenantIds[0]) must have an approved rental application for the property.
    // Secondary co-tenants do not need independent rental applications under current business rules.
    const [approvedApp] = await tx.select().from(rentalApplications).where(
      and(
        eq(rentalApplications.applicantUserId, primaryTenantId),
        eq(rentalApplications.propertyId, propertyId),
        eq(rentalApplications.status, 'APPROVED')
      )
    ).limit(1).for('update');

    if (!approvedApp) {
      throw new Error(`VALIDATION_ERROR: Primary tenant ${primaryTenantId} does not have an APPROVED rental application for this property.`);
    }

    // Verify that this primary application is not already reserved by an active or pending lease
    const [existingReservedLease] = await tx.select({
      id: leases.id,
      status: leases.status
    }).from(leases).where(
      and(
        eq(leases.rentalApplicationId, approvedApp.id),
        or(
          eq(leases.status, LeaseStatus.PENDING_APPROVAL),
          eq(leases.status, LeaseStatus.PENDING_SIGNATURE),
          eq(leases.status, LeaseStatus.ACTIVE)
        )
      )
    ).limit(1);

    if (existingReservedLease) {
      throw new Error(`VALIDATION_ERROR: Rental application ${approvedApp.id} is already reserved by another lease (${existingReservedLease.status}).`);
    }

    return {
      primaryApplicationId: approvedApp.id,
      approvedApplicationIds: [approvedApp.id],
    };
  }

  async createLease(propertyId: string, unitId: string | null, tenantIds: string[], startDate: string, endDate: string, rentAmount: number, currency?: string) {
    validateLeaseDateOrder(startDate, endDate);

    return await db.transaction(async (tx) => {
      // 0. Shared parent-property row lock, unit validation, and physical-space overlap invariant
      await this.assertNoPhysicalSpaceOverlap(tx, {
        propertyId,
        unitId,
        startDate,
        endDate,
      });

      // 1. Unified tenant existence, role authorization, approved application, and duplicate lease check
      const { primaryApplicationId } = await this.assertTenantAndApplicationInvariants(tx, {
        propertyId,
        unitId,
        tenantIds,
        startDate,
        endDate,
      });

      const { properties } = await import('../../db/schema.js');
      const [propertyRecord] = await tx.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
      const effectiveCurrency = currency || propertyRecord?.currency || 'IQD';
      if (!['IQD', 'USD'].includes(effectiveCurrency)) {
        throw new Error(`VALIDATION_ERROR: Unsupported currency '${effectiveCurrency}'. Must be IQD or USD.`);
      }

      // 2. Create the lease
      try {
        const [newLease] = await tx.insert(leases).values({
          propertyId,
          unitId,
          startDate,
          endDate,
          rentAmount: rentAmount.toString(),
          currency: effectiveCurrency,
          status: LeaseStatus.DRAFT,
          rentalApplicationId: primaryApplicationId,
        }).returning();

        // 3. Attach tenants
        const tenantLinks = tenantIds.map((tId, index) => ({
          leaseId: newLease.id,
          tenantId: tId,
          isPrimary: index === 0
        }));
        await tx.insert(leaseTenants).values(tenantLinks);

        return newLease;
      } catch (err: any) {
        const isAppUniqueViolation =
          (err.code === '23505' || err.cause?.code === '23505') &&
          (err.constraint?.includes('leases_rental_application_active_unique') ||
           err.cause?.constraint?.includes('leases_rental_application_active_unique') ||
           err.message?.includes('leases_rental_application_active_unique') ||
           err.cause?.message?.includes('leases_rental_application_active_unique') ||
           err.cause?.detail?.includes('leases_rental_application_active_unique'));
        if (isAppUniqueViolation) {
          throw new Error(`VALIDATION_ERROR: Rental application ${primaryApplicationId} is already reserved by another lease.`);
        }
        throw err;
      }
    });
  }

  async generateRentSchedule(tx: any, leaseId: string, propertyId: string, tenantId: string, unitId: string | null, startDate: string, endDate: string, monthlyRent: number, currency?: string) {
    // Robust date order check
    validateLeaseDateOrder(startDate, endDate);

    // Generate monthly rent schedule records
    let effectiveCurrency = currency;
    if (!effectiveCurrency) {
      const [leaseRecord] = await tx.select({ currency: leases.currency }).from(leases).where(eq(leases.id, leaseId)).limit(1);
      effectiveCurrency = leaseRecord?.currency || 'IQD';
    }

    const addMonthsSafe = (dateStr: string, months: number): Date => {
        const d = new Date(dateStr);
        const originalDay = d.getUTCDate();
        d.setUTCMonth(d.getUTCMonth() + months);
        if (d.getUTCDate() !== originalDay) {
          d.setUTCDate(0);
        }
        return d;
      };

      const recordsToInsert = [];
      const end = new Date(endDate);
      let iteratorIndex = 0;
      let current = addMonthsSafe(startDate, 0);

      const startDateObj = new Date(startDate);
      startDateObj.setUTCDate(1);
      startDateObj.setUTCHours(0, 0, 0, 0);

      // Fetch existing schedules in this range to handle protected partial payments safely
      const existingSchedules = await tx.select().from(rentSchedules).where(
        and(
          eq(rentSchedules.leaseId, leaseId),
          gte(rentSchedules.periodStart, startDateObj.toISOString())
        )
      );
      
      const matchedScheduleIds = new Set<string>();

      while (current < end) {
        let periodStart = addMonthsSafe(startDate, iteratorIndex);
        let periodEnd = addMonthsSafe(startDate, iteratorIndex + 1);
        
        if (periodEnd > end) periodEnd = new Date(end); // Prorated conceptually, but full rent scheduled for simplicity here
        
        let dueDate = new Date(periodStart); // Due on first day of period
        const periodStartStr = periodStart.toISOString();

        // Match by same year and month to gracefully handle cadence shifts (e.g. 1st to 15th)
        // Prefer active (non-cancelled) existing schedules over cancelled ones
        const candidateSchedules = existingSchedules.filter((s: any) => {
            const d1 = new Date(s.periodStart);
            const d2 = new Date(periodStartStr);
            return d1.getUTCFullYear() === d2.getUTCFullYear() && d1.getUTCMonth() === d2.getUTCMonth();
        });
        const existing = candidateSchedules.find((s: any) => s.status !== 'CANCELLED') || candidateSchedules[0];

        if (existing) {
          matchedScheduleIds.add(existing.id);
          const paidAmt = Number(existing.paidAmount || 0);
          if (monthlyRent < paidAmt) {
            throw new Error(`Cannot reduce rent below the amount already paid for period ${periodStartStr}`);
          }
          
          let newStatus = 'UPCOMING';
          if (paidAmt > 0) {
            newStatus = paidAmt >= monthlyRent ? 'PAID' : 'PARTIALLY_PAID';
          } else {
            const now = new Date();
            newStatus = dueDate < now ? 'OVERDUE' : 'UPCOMING';
          }

          await tx.update(rentSchedules)
            .set({
              amount: monthlyRent.toString(),
              currency: effectiveCurrency,
              periodStart: periodStartStr, // Align period start to new cadence
              dueDate: dueDate.toISOString(),
              periodEnd: periodEnd.toISOString(),
              status: newStatus
            })
            .where(eq(rentSchedules.id, existing.id));
        } else {
          recordsToInsert.push({
            leaseId,
            propertyId,
            unitId,
            tenantId,
            amount: monthlyRent.toString(),
            currency: effectiveCurrency,
            dueDate: dueDate.toISOString(),
            periodStart: periodStartStr,
            periodEnd: periodEnd.toISOString(),
            status: dueDate < new Date() ? 'OVERDUE' : 'UPCOMING'
          });
        }

        iteratorIndex++;
        current = periodEnd;
      }

      // Cleanup any leftover unmapped schedules from the old cadence in this period
      const leftovers = existingSchedules.filter((s: any) => !matchedScheduleIds.has(s.id) && s.status !== 'CANCELLED');
      for (const leftover of leftovers) {
          if (Number(leftover.paidAmount || 0) > 0) {
              throw new Error(`Cannot shift lease cadence: old schedule starting ${leftover.periodStart} has collected payments. Reverse payments first.`);
          }
          await tx.update(rentSchedules).set({ status: 'CANCELLED', amount: '0' }).where(eq(rentSchedules.id, leftover.id));
      }

      if (recordsToInsert.length > 0) {
        await tx.insert(rentSchedules).values(recordsToInsert);
      }
      return recordsToInsert;
  }

  async activateLease(leaseId: string) {
    return await db.transaction(async (tx) => {
      // 0. Fetch lease to determine lock
      const [draftLease] = await tx.select().from(leases).where(eq(leases.id, leaseId)).limit(1);
      if (!draftLease) throw new Error("Lease not found");

      // Fast fail if lease is pending owner approval or in an unactivatable state
      if (draftLease.status === LeaseStatus.PENDING_APPROVAL) {
        throw new Error("VALIDATION_ERROR: Cannot activate lease in PENDING_APPROVAL status. Owner approval is required before lease can be activated.");
      }

      if (draftLease.status !== LeaseStatus.PENDING_SIGNATURE && draftLease.status !== LeaseStatus.DRAFT) {
        throw new Error(`VALIDATION_ERROR: Cannot activate lease from status: ${draftLease.status}`);
      }

      // Validate lease dates before activation
      validateLeaseDateOrder(draftLease.startDate, draftLease.endDate);

      // 1. Lock the parent property to serialize all lease operations
      const { properties } = await import('../../db/schema.js');
      await tx.select().from(properties).where(eq(properties.id, draftLease.propertyId)).limit(1).for('update');

      // 2. Enforce overlap invariant during activation
      const { not } = await import('drizzle-orm');
      const overlapConditions = [
        or(
          eq(leases.status, LeaseStatus.ACTIVE),
          eq(leases.status, LeaseStatus.PENDING_APPROVAL),
          eq(leases.status, LeaseStatus.PENDING_SIGNATURE)
        ),
        lte(leases.startDate, draftLease.endDate),
        gte(leases.endDate, draftLease.startDate),
        not(eq(leases.id, leaseId)) // exclude current lease
      ];

      if (draftLease.unitId) {
        overlapConditions.push(
          or(
            eq(leases.unitId, draftLease.unitId),
            and(eq(leases.propertyId, draftLease.propertyId), isNull(leases.unitId))
          )
        );
      } else {
        // A property-level lease (unitId IS NULL) claims the whole property.
        // It conflicts with every lease on this property, regardless of unitId.
        overlapConditions.push(eq(leases.propertyId, draftLease.propertyId));
      }

      const overlaps = await tx.query.leases.findMany({
        where: and(...overlapConditions)
      });

      if (overlaps.length > 0) {
        throw new Error("VALIDATION_ERROR: Cannot activate lease. The period overlaps with an existing active or pending lease for this property/unit.");
      }

      // 3. Atomic Activate (only PENDING_SIGNATURE or DRAFT can transition to ACTIVE)
      const [updatedLease] = await tx.update(leases)
        .set({ status: LeaseStatus.ACTIVE })
        .where(and(
          eq(leases.id, leaseId),
          or(
            eq(leases.status, LeaseStatus.PENDING_SIGNATURE),
            eq(leases.status, LeaseStatus.DRAFT)
          )
        ))
        .returning();

      if (!updatedLease) {
        // If 0 rows updated, verify why
        const [currentLease] = await tx.select({ status: leases.status }).from(leases).where(eq(leases.id, leaseId)).limit(1);
        if (!currentLease) throw new Error("Lease not found");
        if (currentLease.status === LeaseStatus.PENDING_APPROVAL) {
          throw new Error("VALIDATION_ERROR: Cannot activate lease in PENDING_APPROVAL status. Owner approval is required before lease can be activated.");
        }
        throw new Error(`Cannot activate lease from status: ${currentLease.status} or concurrent modification occurred`);
      }

      // 2. Fetch primary tenant
      const [tenantLink] = await tx.select().from(leaseTenants).where(
        and(eq(leaseTenants.leaseId, leaseId), eq(leaseTenants.isPrimary, true))
      ).limit(1);

      if (!tenantLink) {
        throw new Error("VALIDATION_ERROR: Cannot activate lease without an assigned primary tenant.");
      }

      // 2b. Atomically consume linked rental application (if present)
      if (updatedLease.rentalApplicationId) {
        const { rentalApplications } = await import('../../db/schema.js');
        const [consumedApp] = await tx.update(rentalApplications)
          .set({
            status: 'CONVERTED_TO_LEASE',
            updatedAt: new Date()
          })
          .where(and(
            eq(rentalApplications.id, updatedLease.rentalApplicationId),
            eq(rentalApplications.status, 'APPROVED')
          ))
          .returning();

        if (!consumedApp) {
          throw new Error("VALIDATION_ERROR: Cannot activate lease: Linked rental application is no longer in APPROVED status or not found.");
        }

        await auditService.logAction({
          actorUserId: tenantLink?.tenantId || 'SYSTEM',
          actorRole: 'TENANT',
          action: 'APPLICATION_CONVERTED_TO_LEASE',
          resourceType: 'RentalApplication',
          resourceId: updatedLease.rentalApplicationId,
          changes: { leaseId: updatedLease.id, status: 'CONVERTED_TO_LEASE' },
          tx,
        });
      }

      // 3. Generate rent schedule exactly once per activation
      await this.generateRentSchedule(
        tx,
        leaseId, 
        updatedLease.propertyId, 
        tenantLink.tenantId, 
        updatedLease.unitId,
        updatedLease.startDate, 
        updatedLease.endDate, 
        Number(updatedLease.rentAmount),
        updatedLease.currency || 'IQD'
      );

      // Verify at least one active rent schedule exists for the active lease
      const activeSchedules = await tx.select({ id: rentSchedules.id }).from(rentSchedules).where(
        and(
          eq(rentSchedules.leaseId, leaseId),
          not(eq(rentSchedules.status, 'CANCELLED'))
        )
      );

      if (activeSchedules.length === 0) {
        throw new Error("VALIDATION_ERROR: Lease activation must produce a valid non-empty rent schedule.");
      }

      // 4. Generate security deposit if required
      const depositAmt = parseFloat(updatedLease.depositAmount || '0');
      if (depositAmt > 0) {
        await tx.insert(securityDeposits).values({
          leaseId: updatedLease.id,
          propertyId: updatedLease.propertyId,
          tenantId: tenantLink.tenantId,
          requiredAmount: depositAmt.toString(),
          recordedAmount: '0',
          releasedAmount: '0',
          currency: updatedLease.currency || 'IQD',
          status: 'PENDING'
        });
      }

      return updatedLease;
    });
  }

  async recordPayment(propertyId: string, leaseId: string, payerId: string, rentScheduleId: string | undefined, amount: number, paymentMethod: string, referenceNumber: string, collectorId?: string, currency?: string, options?: { allowConversion?: boolean }) {
    return await db.transaction(async (tx) => {
      let paymentCurrency = currency;

      // If rentScheduleId is provided, validate schedule and enforce currency matching
      let targetSchedule: any = null;
      if (rentScheduleId) {
        const [schedule] = await tx.select().from(rentSchedules)
          .where(eq(rentSchedules.id, rentScheduleId))
          .limit(1)
          .for('update');
        if (!schedule) {
          throw new Error("Rent schedule not found");
        }
        if (schedule.status === 'CANCELLED') {
          throw new Error("Cannot record payment for a CANCELLED rent schedule");
        }
        targetSchedule = schedule;
        const scheduleCurrency = schedule.currency || 'IQD';
        const pCurrency = (paymentCurrency || scheduleCurrency).toUpperCase();

        if (pCurrency !== scheduleCurrency) {
          if (!options?.allowConversion) {
            throw new Error(`CURRENCY_MISMATCH: Payment currency (${paymentCurrency}) does not match schedule currency (${scheduleCurrency}). Cross-currency payments are not supported.`);
          }
          if (!['USD', 'IQD'].includes(pCurrency) || !['USD', 'IQD'].includes(scheduleCurrency)) {
            throw new Error(`UNSUPPORTED_CURRENCY: Cross-currency payment between ${pCurrency} and ${scheduleCurrency} is not supported.`);
          }
        }
        paymentCurrency = pCurrency;

        const exchangeRate = await financeService.fetchFinancialPolicy('EXCHANGE_RATE_IQD', 1310);
        const numAmount = Number(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
          throw new Error('VALIDATION_ERROR: Payment amount must be a positive number');
        }
        const paymentInScheduleCurrency = convertCurrency(numAmount, paymentCurrency, scheduleCurrency, exchangeRate);

        // Overpayment and pending aggregate protection under pessimistic lock
        const pendingPayments = await tx.select({ 
          amount: paymentRecords.amount,
          currency: paymentRecords.currency,
        })
          .from(paymentRecords)
          .where(and(
            eq(paymentRecords.rentScheduleId, schedule.id),
            eq(paymentRecords.status, 'RECORDED')
          ));

        const pendingRecordedAmount = pendingPayments.reduce((sum, p) => {
          const recCur = (p.currency || scheduleCurrency).toUpperCase();
          const amtInSched = convertCurrency(Number(p.amount || 0), recCur, scheduleCurrency, exchangeRate);
          return sum + amtInSched;
        }, 0);

        const currentConfirmedPaid = Number(schedule.paidAmount || 0);
        const totalAmount = Number(schedule.amount);
        const totalCommitted = currentConfirmedPaid + pendingRecordedAmount + paymentInScheduleCurrency;

        if (totalCommitted > totalAmount) {
          throw new Error('Payment amount exceeds remaining rent due');
        }
      } else {
        const [lease] = await tx.select().from(leases).where(eq(leases.id, leaseId)).limit(1);
        const leaseCurrency = lease?.currency || 'IQD';
        const pCurrency = (paymentCurrency || leaseCurrency).toUpperCase();
        if (pCurrency !== leaseCurrency) {
          if (!options?.allowConversion) {
            throw new Error(`CURRENCY_MISMATCH: Payment currency (${paymentCurrency}) does not match lease currency (${leaseCurrency}). Cross-currency payments are not supported.`);
          }
        }
        paymentCurrency = pCurrency;
      }

      // Create payment record
      const [payment] = await tx.insert(paymentRecords).values({
        propertyId,
        leaseId,
        rentScheduleId,
        payerId,
        amount: amount.toString(),
        currency: paymentCurrency,
        paymentMethod,
        referenceNumber,
        status: 'RECORDED',
        collectorId,
        recordedDate: new Date().toISOString()
      }).returning();

      // INVARIANT (Phase 32 / F-02 Remediation):
      // An unconfirmed (RECORDED) payment must NOT alter rent_schedules.paidAmount
      // or transition schedule status to PARTIALLY_PAID or PAID.
      // Schedule balances and statuses are updated strictly upon authorized payment confirmation
      // via confirmPayment().

      return payment;
    });
  }

  async confirmPayment(paymentId: string, confirmedByUserId: string, options?: { referenceNumber?: string }) {
    return await db.transaction(async (tx) => {
      const [payment] = await tx.select().from(paymentRecords).where(eq(paymentRecords.id, paymentId)).limit(1);
      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status === 'CONFIRMED') {
        return payment;
      }

      if (payment.status !== 'RECORDED') {
        throw new Error(`Only RECORDED payments can be confirmed. Current status: ${payment.status}`);
      }

      const updateData: { status: string; confirmedByUserId: string; referenceNumber?: string } = {
        status: 'CONFIRMED',
        confirmedByUserId
      };
      if (options?.referenceNumber && options.referenceNumber.trim()) {
        updateData.referenceNumber = options.referenceNumber.trim();
      }

      const [updated] = await tx.update(paymentRecords)
        .set(updateData)
        .where(and(eq(paymentRecords.id, paymentId), eq(paymentRecords.status, 'RECORDED')))
        .returning();

      if (!updated) {
        throw new Error("Payment was modified concurrently");
      }

      // Synchronize linked rent schedule strictly from all eligible CONFIRMED payments
      if (updated.rentScheduleId) {
        const [schedule] = await tx.select().from(rentSchedules)
          .where(eq(rentSchedules.id, updated.rentScheduleId))
          .limit(1)
          .for('update');

        if (schedule) {
          if (schedule.status === 'CANCELLED') {
            throw new Error("Cannot confirm payment for a CANCELLED rent schedule");
          }
          const exchangeRate = await financeService.fetchFinancialPolicy('EXCHANGE_RATE_IQD', 1310);
          const scheduleCurrency = schedule.currency || 'IQD';

          const confirmedPayments = await tx.select({ 
            amount: paymentRecords.amount,
            currency: paymentRecords.currency,
          })
            .from(paymentRecords)
            .where(and(
              eq(paymentRecords.rentScheduleId, updated.rentScheduleId),
              eq(paymentRecords.status, 'CONFIRMED')
            ));

          const confirmedPaidAmount = confirmedPayments.reduce(
            (sum, p) => {
              const recCur = (p.currency || scheduleCurrency).toUpperCase();
              const amtInSched = convertCurrency(Number(p.amount || 0), recCur, scheduleCurrency, exchangeRate);
              return sum + amtInSched;
            },
            0
          );

          const newStatus = confirmedPaidAmount >= Number(schedule.amount)
            ? 'PAID'
            : confirmedPaidAmount > 0
              ? 'PARTIALLY_PAID'
              : (new Date(schedule.dueDate) < new Date() ? 'OVERDUE' : 'UPCOMING');

          await tx.update(rentSchedules)
            .set({
              paidAmount: confirmedPaidAmount.toString(),
              status: newStatus,
            })
            .where(eq(rentSchedules.id, schedule.id));
        }
      }

      return updated;
    });
  }

  async approveMoveOut(moveOutRequestId: string, actor?: { id?: string; role?: string; roles?: string[]; simulateFailure?: boolean }) {
    return await db.transaction(async (tx) => {
      // 1. Fetch move-out request
      const { moveOutRequests } = await import('../../db/schema.js');

      // Optimistic concurrency control for move-out
      const [updatedRequest] = await tx.update(moveOutRequests)
        .set({ status: 'COMPLETED' })
        .where(and(
          eq(moveOutRequests.id, moveOutRequestId),
          eq(moveOutRequests.status, 'PENDING_REVIEW')
        ))
        .returning();

      if (!updatedRequest) {
        throw new Error("Cannot approve move-out: request is not pending review or not found");
      }

      // 2. Fetch and lock lease row to serialize lease lifecycle transitions
      const [currentLease] = await tx.select().from(leases).where(eq(leases.id, updatedRequest.leaseId)).for('update').limit(1);
      if (!currentLease) {
        throw new Error("Lease not found for move-out request");
      }

      // 3. Determine explicit deposit reconciliation status under P01
      const leaseDeposits = await tx.select().from(securityDeposits).where(eq(securityDeposits.leaseId, currentLease.id));
      const leaseDepositRequired = parseFloat(currentLease.depositAmount || '0');
      const { reconciliationStatus, unresolvedReason, primaryDeposit } = computeDepositReconciliationStatus(
        leaseDepositRequired,
        leaseDeposits
      );

      // 4. Terminate lease and persist explicit deposit reconciliation status
      const [updatedLease] = await tx.update(leases)
        .set({
          status: LeaseStatus.TERMINATED,
          depositReconciliationStatus: reconciliationStatus
        })
        .where(eq(leases.id, currentLease.id))
        .returning();

      // 5. Audit Logging within the exact same database transaction
      const actorId = actor?.id || 'SYSTEM';
      const actorRole = actor?.role || actor?.roles?.[0] || 'PROPERTY_OWNER';

      if (reconciliationStatus === 'UNRESOLVED') {
        await auditService.logAction({
          actorUserId: actorId,
          actorRole,
          action: 'MOVE_OUT_APPROVED_DEPOSIT_UNRESOLVED',
          resourceType: 'Lease',
          resourceId: currentLease.id,
          changes: {
            moveOutRequestId: updatedRequest.id,
            leaseId: currentLease.id,
            propertyId: currentLease.propertyId,
            tenantId: updatedRequest.tenantId,
            leaseStatus: LeaseStatus.TERMINATED,
            depositReconciliationStatus: 'UNRESOLVED',
            depositDetails: {
              depositId: primaryDeposit?.id || null,
              requiredAmount: primaryDeposit?.requiredAmount || currentLease.depositAmount || '0',
              recordedAmount: primaryDeposit?.recordedAmount || '0',
              releasedAmount: primaryDeposit?.releasedAmount || '0',
              heldBalance: primaryDeposit ? (parseFloat(primaryDeposit.recordedAmount || '0') - parseFloat(primaryDeposit.releasedAmount || '0')).toString() : '0',
              depositStatus: primaryDeposit?.status || 'PENDING',
              unresolvedReason,
            }
          },
          tx
        });
      } else {
        await auditService.logAction({
          actorUserId: actorId,
          actorRole,
          action: 'MOVE_OUT_APPROVED',
          resourceType: 'Lease',
          resourceId: currentLease.id,
          changes: {
            moveOutRequestId: updatedRequest.id,
            leaseId: currentLease.id,
            propertyId: currentLease.propertyId,
            tenantId: updatedRequest.tenantId,
            leaseStatus: LeaseStatus.TERMINATED,
            depositReconciliationStatus: reconciliationStatus
          },
          tx
        });
      }

      if (actor?.simulateFailure) {
        throw new Error("SIMULATED_TRANSACTION_FAILURE");
      }

      return {
        ...updatedRequest,
        lease: updatedLease,
        depositReconciliationStatus: reconciliationStatus
      };
    });
  }

  async approveRenewal(renewalId: string, auditContext?: RenewalAuditContext) {
    return await db.transaction(async (tx) => {
      const { leaseRenewals } = await import('../../db/schema.js');

      // Optimistic concurrency control for renewal
      const [updatedRenewal] = await tx.update(leaseRenewals)
        .set({ status: 'APPROVED' })
        .where(and(
          eq(leaseRenewals.id, renewalId),
          eq(leaseRenewals.status, 'REQUESTED')
        ))
        .returning();
        
      if (!updatedRenewal) {
        throw new Error("Cannot approve renewal: renewal is not requested or not found");
      }

      // 2. Fetch current lease
      const [currentLease] = await tx.select().from(leases).where(eq(leases.id, updatedRenewal.leaseId)).limit(1);
      if (!currentLease) throw new Error("Lease not found");
      if (currentLease.status !== 'ACTIVE') throw new Error("Cannot renew a lease that is not ACTIVE");

      // 3. Lock the parent property to serialize all lease operations
      const { properties } = await import('../../db/schema.js');
      await tx.select().from(properties).where(eq(properties.id, currentLease.propertyId)).limit(1).for('update');

      // 4. Enforce overlap invariant during renewal
      const { not } = await import('drizzle-orm');
      const isShortened = new Date(updatedRenewal.proposedEndDate) < new Date(currentLease.endDate);
      const proposedStartDate = updatedRenewal.proposedStartDate || (isShortened ? currentLease.startDate : currentLease.endDate);
      const proposedEndDate = updatedRenewal.proposedEndDate;
      const overlapConditions = [
        or(
          eq(leases.status, LeaseStatus.ACTIVE),
          eq(leases.status, LeaseStatus.PENDING_APPROVAL),
          eq(leases.status, LeaseStatus.PENDING_SIGNATURE)
        ),
        lte(leases.startDate, proposedEndDate),
        gte(leases.endDate, proposedStartDate),
        not(eq(leases.id, currentLease.id)) // exclude current lease
      ];

      if (currentLease.unitId) {
        overlapConditions.push(
          or(
            eq(leases.unitId, currentLease.unitId),
            and(eq(leases.propertyId, currentLease.propertyId), isNull(leases.unitId))
          )
        );
      } else {
        // A property-level lease (unitId IS NULL) claims the whole property.
        // It conflicts with every lease on this property, regardless of unitId.
        overlapConditions.push(eq(leases.propertyId, currentLease.propertyId));
      }

      const overlaps = await tx.query.leases.findMany({
        where: and(...overlapConditions)
      });

      if (overlaps.length > 0) {
        throw new Error("VALIDATION_ERROR: Cannot approve renewal. The proposed period overlaps with another active or pending lease for this property/unit.");
      }

      // 5. Resolve and validate tenant for renewal and schedule generation
      const { leaseTenants, rentSchedules } = await import('../../db/schema.js');
      const leaseTenantLinks = await tx.select().from(leaseTenants).where(
        eq(leaseTenants.leaseId, currentLease.id)
      );

      // If renewal specifies a tenant, verify it belongs to this lease
      if (updatedRenewal.tenantId) {
        const isAssociated = leaseTenantLinks.some((t: any) => t.tenantId === updatedRenewal.tenantId);
        if (!isAssociated) {
          throw new Error("VALIDATION_ERROR: Cannot approve renewal. The renewal tenant is not associated with this lease.");
        }
      }

      // Resolve tenant: primary tenant -> renewal tenant -> first linked tenant
      const primaryTenant = leaseTenantLinks.find((t: any) => t.isPrimary);
      const fallbackTenant = updatedRenewal.tenantId 
        ? leaseTenantLinks.find((t: any) => t.tenantId === updatedRenewal.tenantId)
        : leaseTenantLinks[0];
      const resolvedTenant = primaryTenant || fallbackTenant;

      if (!resolvedTenant) {
        throw new Error("VALIDATION_ERROR: Cannot approve renewal. No valid tenant associated with this lease.");
      }

      // 6. Update lease end date, rent, and currency if specified
      const oldEndDate = currentLease.endDate;
      const targetCurrency = updatedRenewal.currency || currentLease.currency || 'IQD';
      await tx.update(leases)
        .set({ 
          endDate: updatedRenewal.proposedEndDate, 
          rentAmount: updatedRenewal.proposedRentAmount?.toString() || currentLease.rentAmount,
          currency: targetCurrency,
        })
        .where(eq(leases.id, updatedRenewal.leaseId));

      // 7. Generate schedules for new period
      const rentToUse = updatedRenewal.proposedRentAmount ? Number(updatedRenewal.proposedRentAmount) : Number(currentLease.rentAmount);
      const newStartDate = updatedRenewal.proposedStartDate || (isShortened ? currentLease.startDate : oldEndDate);

      // Prevent lease shortening from silently cancelling schedules with collected funds or pending recorded payments
      const obsoleteSchedules = await tx.select().from(rentSchedules)
        .where(and(
          eq(rentSchedules.leaseId, currentLease.id),
          gte(rentSchedules.periodStart, new Date(updatedRenewal.proposedEndDate).toISOString())
        ));
      
      for (const schedule of obsoleteSchedules) {
        if (Number(schedule.paidAmount || 0) > 0) {
           throw new Error(`Cannot shorten lease: rent schedule starting ${new Date(schedule.periodStart).toISOString().split('T')[0]} has collected payments. Reverse payments first.`);
        }
      }

      const obsoleteScheduleIds = obsoleteSchedules.map((s: any) => s.id);
      if (obsoleteScheduleIds.length > 0) {
        const { inArray } = await import('drizzle-orm');
        const pendingPayments = await tx.select()
          .from(paymentRecords)
          .where(and(
            inArray(paymentRecords.rentScheduleId, obsoleteScheduleIds),
            eq(paymentRecords.status, 'RECORDED')
          ));

        if (pendingPayments.length > 0) {
          throw new Error(`Cannot shorten lease: rent schedule starting ${new Date(obsoleteSchedules[0].periodStart).toISOString().split('T')[0]} has pending recorded payments. Cancel or resolve pending payments first.`);
        }
      }

      // Cancel obsolete schedules that fall on or after the new end date (handles shortened leases safely)
      // We use UPDATE instead of DELETE to avoid Foreign Key Constraint Violations from reversed payments
      await tx.update(rentSchedules)
        .set({ status: 'CANCELLED', amount: '0' })
        .where(and(
          eq(rentSchedules.leaseId, currentLease.id),
          gte(rentSchedules.periodStart, new Date(updatedRenewal.proposedEndDate).toISOString())
        ));

      await this.generateRentSchedule(
        tx,
        currentLease.id,
        currentLease.propertyId,
        resolvedTenant.tenantId,
        currentLease.unitId,
        newStartDate,
        updatedRenewal.proposedEndDate,
        rentToUse,
        targetCurrency
      );

      if (auditContext) {
        if (auditContext.simulateAuditFailure) {
          throw new Error("SIMULATED_AUDIT_FAILURE: Atomicity rollback test");
        }
        const { auditService } = await import('../services/audit.js');
        await auditService.logAction({
          actorUserId: auditContext.actorUserId,
          actorRole: auditContext.actorRole,
          action: 'APPROVE_LEASE_RENEWAL',
          resourceType: 'LeaseRenewal',
          resourceId: updatedRenewal.id,
          changes: {
            leaseId: updatedRenewal.leaseId,
            propertyId: updatedRenewal.propertyId,
            previousEndDate: oldEndDate,
            newEndDate: updatedRenewal.proposedEndDate,
            previousRentAmount: currentLease.rentAmount,
            newRentAmount: updatedRenewal.proposedRentAmount?.toString() || currentLease.rentAmount,
            previousStatus: 'REQUESTED',
            newStatus: 'APPROVED',
          },
          ipAddress: auditContext.ipAddress,
          tx,
        });
      }

      return updatedRenewal;
    });
  }

  async rejectRenewal(renewalId: string, ownerNotes?: string, auditContext?: RenewalAuditContext) {
    return await db.transaction(async (tx) => {
      const { leaseRenewals } = await import('../../db/schema.js');

      // Optimistic concurrency control: only reject if currently in a pending state
      const [updatedRenewal] = await tx.update(leaseRenewals)
        .set({ 
          status: 'REJECTED',
          ownerNotes: ownerNotes || null,
        })
        .where(and(
          eq(leaseRenewals.id, renewalId),
          or(
            eq(leaseRenewals.status, 'REQUESTED'),
            eq(leaseRenewals.status, 'UNDER_REVIEW')
          )
        ))
        .returning();
        
      if (!updatedRenewal) {
        throw new Error("Cannot reject renewal: renewal is not in a pending state or not found");
      }

      if (auditContext) {
        const { auditService } = await import('../services/audit.js');
        await auditService.logAction({
          actorUserId: auditContext.actorUserId,
          actorRole: auditContext.actorRole,
          action: 'REJECT_LEASE_RENEWAL',
          resourceType: 'LeaseRenewal',
          resourceId: updatedRenewal.id,
          changes: {
            leaseId: updatedRenewal.leaseId,
            propertyId: updatedRenewal.propertyId,
            previousStatus: 'REQUESTED',
            newStatus: 'REJECTED',
            ownerNotes: ownerNotes || null,
          },
          ipAddress: auditContext.ipAddress,
          tx,
        });
      }

      return updatedRenewal;
    });
  }
}

export const leaseRepository = new LeaseRepository();
