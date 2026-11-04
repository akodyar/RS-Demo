import { db } from '../../db/index.js';
import {
  properties,
  ownershipRecords,
  managementAgreements,
  organizationMembers,
  units,
  leases,
  leaseTenants,
  rentSchedules,
  paymentRecords,
  maintenanceRequests,
  maintenanceQuotes,
  workOrders,
  inspections,
  maintenanceInvoices,
  journalEntries,
  ledgerLines,
  documents,
  conversations,
  messages,
  listings,
  notifications,
  users,
  organizations,
  auditLogs,
  commissions,
  leaseRenewals
} from '../../db/schema.js';
import { eq, and, or, inArray, desc } from 'drizzle-orm';
import { Permission, UserRole, LeaseStatus } from '../../types/index.js';
import { financeService } from '../services/finance.js';
import { CommissionService, OperatingModel } from '../services/commission.js';
import { leaseRepository, validateLeaseDateOrder } from './leases.js';
import { auditService } from '../services/audit.js';
import { FeatureFlags } from '../../utils/featureFlags.js';

export interface ScopedPropertyAccess {
  propertyId: string;
  isOwner: boolean;
  isCoOwner: boolean;
  ownershipPercentage?: string | null;
  ownershipStatus?: string | null;
  isManagingCompany: boolean;
  grantedPermissions: string[];
  companyId?: string | null;
}

export class OwnerRepository {
  /**
   * Resolve all property IDs the caller is authorized to view or manage:
   * 1. Verified Owner or Co-owner via ownershipRecords
   * 2. Authorized Management Company via active managementAgreements with VIEW_PROPERTY permission
   * 3. Platform Admin (all properties)
   */
  async getAuthorizedPropertyAccess(user: { id: string; organizationId?: string; roles: string[] }): Promise<ScopedPropertyAccess[]> {
    const isPlatformAdmin = user.roles.includes(UserRole.PLATFORM_ADMIN) || user.roles.includes('SUPER_ADMIN');

    if (isPlatformAdmin) {
      const allProps = await db.select().from(properties);
      return allProps.map(p => ({
        propertyId: p.id,
        isOwner: true,
        isCoOwner: false,
        ownershipPercentage: '100.00',
        ownershipStatus: 'VERIFIED',
        isManagingCompany: false,
        grantedPermissions: Object.values(Permission),
      }));
    }

    const accessMap = new Map<string, ScopedPropertyAccess>();

    // 1. Resolve Ownership Records (Verified or Pending Verification owner or co-owner)
    if (user.roles.includes(UserRole.PROPERTY_OWNER)) {
      const ownerRecords = await db
        .select({
          record: ownershipRecords,
          property: properties,
        })
        .from(ownershipRecords)
        .innerJoin(properties, eq(ownershipRecords.propertyId, properties.id))
        .where(and(
          eq(ownershipRecords.ownerId, user.id),
          or(
            eq(ownershipRecords.status, 'VERIFIED'),
            eq(ownershipRecords.status, 'PENDING_VERIFICATION'),
            eq(ownershipRecords.status, 'REJECTED')
          )
        ));

      for (const r of ownerRecords) {
        const pct = parseFloat(r.record.ownershipPercentage || '100');
        const isVerified = r.record.status === 'VERIFIED';
        accessMap.set(r.property.id, {
          propertyId: r.property.id,
          isOwner: true,
          isCoOwner: pct < 100,
          ownershipPercentage: r.record.ownershipPercentage,
          ownershipStatus: r.record.status,
          isManagingCompany: false,
          grantedPermissions: isVerified ? Object.values(Permission) : [Permission.VIEW_PROPERTY],
        });
      }
    }

    // 2. Resolve Management Agreements for Companies
    const isCompanyPrincipal = user.roles.includes(UserRole.COMPANY) || user.roles.includes(UserRole.COMPANY_MEMBER);
    const orgId = user.organizationId;

    if (isCompanyPrincipal && orgId) {
      // If user is COMPANY_MEMBER, verify active organization membership
      let isMemberActive = true;
      if (user.roles.includes(UserRole.COMPANY_MEMBER) && !user.roles.includes(UserRole.COMPANY)) {
        const mem = await db.select().from(organizationMembers).where(and(
          eq(organizationMembers.userId, user.id),
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.status, 'ACTIVE')
        )).limit(1);
        if (mem.length === 0) {
          isMemberActive = false;
        }
      }

      if (isMemberActive) {
        const agreements = await db
          .select()
          .from(managementAgreements)
          .where(and(
            eq(managementAgreements.companyId, orgId),
            eq(managementAgreements.status, 'ACTIVE')
          ));

        for (const ag of agreements) {
          // Check expiration
          if (ag.endDate && new Date(ag.endDate).getTime() < Date.now()) {
            continue;
          }

          const permissions = (ag.grantedPermissions as string[]) || [];
          // Company can access only if granted at least VIEW_PROPERTY
          if (permissions.includes(Permission.VIEW_PROPERTY) || permissions.includes('VIEW_PROPERTY')) {
            const existing = accessMap.get(ag.propertyId);
            if (!existing) {
              accessMap.set(ag.propertyId, {
                propertyId: ag.propertyId,
                isOwner: false,
                isCoOwner: false,
                ownershipPercentage: null,
                ownershipStatus: null,
                isManagingCompany: true,
                grantedPermissions: permissions,
                companyId: orgId,
              });
            }
          }
        }
      }
    }

    return Array.from(accessMap.values());
  }

  /**
   * Check if caller has specific permission on a property
   */
  async verifyPropertyPermission(
    user: { id: string; organizationId?: string; roles: string[] },
    propertyId: string,
    requiredPermission: Permission
  ): Promise<boolean> {
    const isPlatformAdmin = user.roles.includes(UserRole.PLATFORM_ADMIN) || user.roles.includes('SUPER_ADMIN');
    if (isPlatformAdmin) return true;

    // Check ownership
    if (user.roles.includes(UserRole.PROPERTY_OWNER)) {
      const ownerRecord = await db.select().from(ownershipRecords).where(and(
        eq(ownershipRecords.ownerId, user.id),
        eq(ownershipRecords.propertyId, propertyId),
        or(
          eq(ownershipRecords.status, 'VERIFIED'),
          // Only VIEW_PROPERTY is permitted for pending verification
          requiredPermission === Permission.VIEW_PROPERTY
            ? or(
                eq(ownershipRecords.status, 'PENDING_VERIFICATION'),
                eq(ownershipRecords.status, 'REJECTED')
              )
            : eq(ownershipRecords.status, 'VERIFIED')
        )
      )).limit(1);

      if (ownerRecord.length > 0) return true;
    }

    // Check company ownership or management agreement
    const isCompany = user.roles.includes(UserRole.COMPANY) || user.roles.includes(UserRole.COMPANY_MEMBER) || user.roles.includes('COMPANY') || user.roles.includes('COMPANY_MEMBER') || user.roles.includes('COMPANY_ADMIN');
    if (isCompany && user.organizationId) {
      // Validate organization membership if user is COMPANY_MEMBER
      if ((user.roles.includes(UserRole.COMPANY_MEMBER) || user.roles.includes('COMPANY_MEMBER')) && !user.roles.includes(UserRole.COMPANY) && !user.roles.includes('COMPANY')) {
        const mem = await db.select().from(organizationMembers).where(and(
          eq(organizationMembers.userId, user.id),
          eq(organizationMembers.organizationId, user.organizationId),
          eq(organizationMembers.status, 'ACTIVE')
        )).limit(1);
        if (mem.length === 0) return false;
      }

      // Check direct company ownership
      const companyOwnerRecord = await db.select().from(ownershipRecords).where(and(
        eq(ownershipRecords.companyId, user.organizationId),
        eq(ownershipRecords.propertyId, propertyId),
        or(
          eq(ownershipRecords.status, 'VERIFIED'),
          requiredPermission === Permission.VIEW_PROPERTY
            ? or(
                eq(ownershipRecords.status, 'PENDING_VERIFICATION'),
                eq(ownershipRecords.status, 'REJECTED')
              )
            : eq(ownershipRecords.status, 'VERIFIED')
        )
      )).limit(1);

      if (companyOwnerRecord.length > 0) return true;

      // Check active management agreement with specific permission
      const agreement = await db.select().from(managementAgreements).where(and(
        eq(managementAgreements.companyId, user.organizationId),
        eq(managementAgreements.propertyId, propertyId),
        eq(managementAgreements.status, 'ACTIVE')
      )).limit(1);

      if (agreement.length > 0) {
        // Also check if agreement has expired
        if (agreement[0].endDate && new Date(agreement[0].endDate).getTime() < Date.now()) {
          return false;
        }

        const permissions = (agreement[0].grantedPermissions as string[]) || [];
        return permissions.includes(requiredPermission) || permissions.includes(String(requiredPermission));
      }
    }

    return false;
  }

  /**
   * Fetch owner portfolio properties (alias for getScopedOwnerProperties)
   */
  async getPortfolio(user: { id: string; organizationId?: string; roles: string[] }) {
    return this.getScopedOwnerProperties(user);
  }

  /**
   * Fetch full authoritative properties scoped to caller's verified ownership or active management
   */
  async getScopedOwnerProperties(user: { id: string; organizationId?: string; roles: string[] }) {
    const accessList = await this.getAuthorizedPropertyAccess(user);
    if (accessList.length === 0) return [];

    const propIds = accessList.map(a => a.propertyId);

    const propRecords = await db
      .select()
      .from(properties)
      .where(inArray(properties.id, propIds))
      .orderBy(desc(properties.createdAt));

    // Fetch units and leases for these properties
    const propertyUnits = await db
      .select()
      .from(units)
      .where(inArray(units.propertyId, propIds));

    const activeLeases = await db
      .select({
        lease: leases,
        tenant: users,
      })
      .from(leases)
      .leftJoin(leaseTenants, and(eq(leases.id, leaseTenants.leaseId), eq(leaseTenants.isPrimary, true)))
      .leftJoin(users, eq(leaseTenants.tenantId, users.id))
      .where(and(
        inArray(leases.propertyId, propIds),
        eq(leases.status, LeaseStatus.ACTIVE)
      ));

    // Fetch active management agreements for managing company names
    const activeAgreements = await db
      .select({
        agreement: managementAgreements,
        company: organizations,
      })
      .from(managementAgreements)
      .leftJoin(organizations, eq(managementAgreements.companyId, organizations.id))
      .where(and(
        inArray(managementAgreements.propertyId, propIds),
        eq(managementAgreements.status, 'ACTIVE')
      ));

    const { financeService } = await import('../services/finance.js');
    const exchangeRateIqd = await financeService.fetchFinancialPolicy('EXCHANGE_RATE_IQD');
    const platformFeeRate = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');

    const confirmedPayments = await db
      .select()
      .from(paymentRecords)
      .where(and(
        inArray(paymentRecords.propertyId, propIds),
        eq(paymentRecords.status, 'CONFIRMED')
      ));

    const paymentIds = confirmedPayments.map(pay => pay.id);
    const postedCommissions = paymentIds.length > 0
      ? await db
          .select()
          .from(commissions)
          .where(and(
            inArray(commissions.paymentRecordId, paymentIds),
            eq(commissions.status, 'POSTED')
          ))
      : [];

    const commByPaymentId = new Map(postedCommissions.map(c => [c.paymentRecordId, c]));
    const jeIds = postedCommissions.map(c => c.journalEntryId).filter(Boolean) as string[];
    const ledgerEntries = jeIds.length > 0
      ? await db
          .select()
          .from(ledgerLines)
          .where(inArray(ledgerLines.journalEntryId, jeIds))
      : [];

    const linesByJeId = new Map<string, typeof ledgerEntries>();
    for (const line of ledgerEntries) {
      if (!line.journalEntryId) continue;
      const arr = linesByJeId.get(line.journalEntryId) || [];
      arr.push(line);
      linesByJeId.set(line.journalEntryId, arr);
    }

    return propRecords.map(p => {
      const access = accessList.find(a => a.propertyId === p.id);
      const propUnitList = propertyUnits.filter(u => u.propertyId === p.id);
      const leaseMatch = activeLeases.find(l => l.lease.propertyId === p.id);
      const agreementMatch = activeAgreements.find(ag => ag.agreement.propertyId === p.id);

      const isOccupied = Boolean(leaseMatch);
      const leaseCurrency = leaseMatch?.lease?.currency || p.currency || 'IQD';
      const rawRent = leaseMatch ? Number(leaseMatch.lease.rentAmount) : 0;
      let monthlyRentIqd = 0;
      let monthlyRentUsd = 0;
      if (leaseCurrency === 'USD') {
        monthlyRentUsd = rawRent;
        monthlyRentIqd = Math.round(rawRent * exchangeRateIqd);
      } else {
        monthlyRentIqd = rawRent;
        monthlyRentUsd = Math.round(rawRent / exchangeRateIqd);
      }

      const propertyPayments = confirmedPayments.filter(pay =>
        pay.propertyId === p.id && (pay.leaseId || pay.rentScheduleId)
      );

      let collectedRentIqd = 0;
      let totalFeeDeductedIqd = 0;
      let platformFeeIqd = 0;
      let rentFeeIqd = 0;
      let managementFeeIqd = 0;
      let netOwnerIncomeIqd = 0;

      const rentFeeRate = p.rentFee ? parseFloat(p.rentFee) : null;
      const managementFeeRate = p.managementFee ? parseFloat(p.managementFee) : null;
      const propOperatingModel = (p.operatingModel as OperatingModel) || 'FULLY_MANAGED';

      for (const pay of propertyPayments) {
        const amt = Number(pay.amount || 0);
        const payIqd = pay.currency === 'USD' ? Math.round(amt * exchangeRateIqd) : amt;
        collectedRentIqd += payIqd;

        const comm = commByPaymentId.get(pay.id);
        const jeLines = comm?.journalEntryId ? linesByJeId.get(comm.journalEntryId) : undefined;

        if (jeLines && jeLines.length > 0) {
          let pFee = 0;
          let rFee = 0;
          let mFee = 0;
          let netSum = 0;
          for (const l of jeLines) {
            const creditAmt = Number(l.credit || 0);
            if (l.accountId === '4010') {
              pFee += creditAmt;
            } else if (l.accountId === '4011') {
              rFee += creditAmt;
            } else if (l.accountId === '4012') {
              mFee += creditAmt;
            } else if (l.accountId === '2010') {
              netSum += creditAmt;
            }
          }
          if (pay.currency === 'USD') {
            platformFeeIqd += Math.round(pFee * exchangeRateIqd);
            rentFeeIqd += Math.round(rFee * exchangeRateIqd);
            managementFeeIqd += Math.round(mFee * exchangeRateIqd);
            totalFeeDeductedIqd += Math.round((pFee + rFee + mFee) * exchangeRateIqd);
            netOwnerIncomeIqd += Math.round(netSum * exchangeRateIqd);
          } else {
            platformFeeIqd += Math.round(pFee);
            rentFeeIqd += Math.round(rFee);
            managementFeeIqd += Math.round(mFee);
            totalFeeDeductedIqd += Math.round(pFee + rFee + mFee);
            netOwnerIncomeIqd += Math.round(netSum);
          }
        } else if (comm) {
          const syncCalc = CommissionService.calculateFeesSync(
            amt,
            Number(comm.rate || platformFeeRate),
            propOperatingModel,
            rentFeeRate,
            managementFeeRate,
            pay.currency || 'IQD'
          );
          if (pay.currency === 'USD') {
            platformFeeIqd += Math.round(syncCalc.platformFeeAmount * exchangeRateIqd);
            rentFeeIqd += Math.round(syncCalc.rentFeeAmount * exchangeRateIqd);
            managementFeeIqd += Math.round(syncCalc.managementFeeAmount * exchangeRateIqd);
            totalFeeDeductedIqd += Math.round(syncCalc.totalFeeAmount * exchangeRateIqd);
            netOwnerIncomeIqd += Math.round(syncCalc.ownerNetAmount * exchangeRateIqd);
          } else {
            platformFeeIqd += syncCalc.platformFeeAmount;
            rentFeeIqd += syncCalc.rentFeeAmount;
            managementFeeIqd += syncCalc.managementFeeAmount;
            totalFeeDeductedIqd += syncCalc.totalFeeAmount;
            netOwnerIncomeIqd += syncCalc.ownerNetAmount;
          }
        } else {
          // Fallback if payment was confirmed without posted commission/ledger
          const syncCalc = CommissionService.calculateFeesSync(
            amt,
            platformFeeRate,
            propOperatingModel,
            rentFeeRate,
            managementFeeRate,
            pay.currency || 'IQD'
          );
          if (pay.currency === 'USD') {
            platformFeeIqd += Math.round(syncCalc.platformFeeAmount * exchangeRateIqd);
            rentFeeIqd += Math.round(syncCalc.rentFeeAmount * exchangeRateIqd);
            managementFeeIqd += Math.round(syncCalc.managementFeeAmount * exchangeRateIqd);
            totalFeeDeductedIqd += Math.round(syncCalc.totalFeeAmount * exchangeRateIqd);
            netOwnerIncomeIqd += Math.round(syncCalc.ownerNetAmount * exchangeRateIqd);
          } else {
            platformFeeIqd += syncCalc.platformFeeAmount;
            rentFeeIqd += syncCalc.rentFeeAmount;
            managementFeeIqd += syncCalc.managementFeeAmount;
            totalFeeDeductedIqd += syncCalc.totalFeeAmount;
            netOwnerIncomeIqd += syncCalc.ownerNetAmount;
          }
        }
      }

      return {
        id: p.id,
        ownerId: access?.isOwner ? user.id : undefined,
        name: p.name,
        nameKurdish: p.name,
        location: (p.address as any)?.city || (p.address as any)?.district || 'Kurdistan',
        city: (p.address as any)?.city || 'هەولێر',
        type: p.type,
        status: isOccupied ? 'Occupied' : p.status === 'MAINTENANCE' ? 'Maintenance' : 'Vacant',
        monthlyRentIqd,
        monthlyRentUsd,
        currency: p.currency || leaseCurrency || 'IQD',
        unitsCount: propUnitList.length || 1,
        imageUrl: (p.address as any)?.imageUrl || (p.address as any)?.photos?.[0] || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80',
        photos: (p.address as any)?.photos || [],
        tapuStatus: access?.ownershipStatus || 'VERIFIED',
        verificationStatus: p.verificationStatus || (access?.ownershipStatus === 'VERIFIED' ? 'VERIFIED' : access?.ownershipStatus || 'PENDING_VERIFICATION'),
        rejectionReason: p.rejectionReason || null,
        managementPreference: p.managementPreference || null,
        managementArrangementStatus: p.managementArrangementStatus || 'NOT_APPLICABLE',
        isOccupied,
        tenantName: leaseMatch?.tenant ? `${leaseMatch.tenant.firstName} ${leaseMatch.tenant.lastName}` : undefined,
        activeLeaseId: leaseMatch?.lease?.id,
        leaseEndDate: leaseMatch?.lease?.endDate,
        managingAgencyName: agreementMatch?.company?.name,
        managingAgencyId: agreementMatch?.agreement?.companyId,
        relationship: access?.isOwner ? (access.isCoOwner ? 'CO_OWNER' : 'PRIMARY_OWNER') : 'MANAGING_COMPANY',
        ownershipPercentage: access?.ownershipPercentage,
        grantedPermissions: access?.grantedPermissions || [],
        operatingModel: propOperatingModel,
        platformFeeRate,
        rentFeeRate: propOperatingModel === 'FULLY_MANAGED' ? rentFeeRate : null,
        managementFeeRate: (propOperatingModel === 'FULLY_MANAGED' || propOperatingModel === 'AGENT_LISTED_PLATFORM_MANAGED') ? managementFeeRate : null,
        collectedRentIqd,
        totalFeeDeductedIqd,
        platformFeeIqd,
        rentFeeIqd,
        managementFeeIqd,
        netOwnerIncomeIqd,
      };
    });
  }

  /**
   * Aggregate authoritative dashboard metrics from PostgreSQL/Drizzle
   */
  async getAuthoritativeDashboard(user: { id: string; organizationId?: string; roles: string[]; name?: string; avatarUrl?: string }) {
    const accessList = await this.getAuthorizedPropertyAccess(user);
    const propIds = accessList.map(a => a.propertyId);

    if (propIds.length === 0) {
      return {
        ownerId: user.id,
        ownerName: user.name || 'Owner',
        ownerRole: user.roles[0] === UserRole.PLATFORM_ADMIN ? 'Platform Admin' : user.roles.includes(UserRole.COMPANY) ? 'Managing Company' : 'Property Owner',
        avatarUrl: user.avatarUrl,
        unreadNotificationsCount: 0,
        unreadMessagesCount: 0,
        kpis: {
          totalProperties: 0,
          propertiesChangeText: 'No properties registered',
          activeTenants: 0,
          occupancyRate: 0,
          monthlyRevenueIqd: 0,
          revenueChangeText: '0 IQD current revenue',
          openMaintenance: 0,
          urgentMaintenance: 0,
        },
        properties: [],
        recentActivities: [],
        upcomingEvents: [],
        rentalIncome: {
          period: '6m',
          currency: 'IQD',
          months: [],
          totalActualIqd: 0,
          totalExpectedIqd: 0,
          platformFeeRate: 0.03,
          totalCommissionIqd: 0,
          totalPlatformFeeIqd: 0,
          totalRentFeeIqd: 0,
          totalManagementFeeIqd: 0,
          totalNetOwnerIncomeIqd: 0,
        },
        occupancy: {
          totalUnits: 0,
          occupiedCount: 0,
          occupiedPercentage: 0,
          vacantCount: 0,
          vacantPercentage: 0,
          maintenanceCount: 0,
          maintenancePercentage: 0,
        },
        quickTip: {
          id: 'tip-01',
          text: 'No properties found. Register your first property deed to begin tracking.',
          textKurdish: 'هیچ موڵکێک نەدۆزرایەوە. یەکەم بەڵگەنامەی تاپۆی موڵکەکەت تۆمار بکە.',
          category: 'DOCUMENT',
          isAiGenerated: true,
        },
      };
    }

    const scopedProperties = await this.getScopedOwnerProperties(user);

    // 1. Relational Units & Occupancy
    const propUnits = await db
      .select()
      .from(units)
      .where(inArray(units.propertyId, propIds));

    const totalUnits = propUnits.length || scopedProperties.reduce((acc, p) => acc + p.unitsCount, 0);

    // 2. Relational Leases & Active Tenants
    const activeLeaseRecords = await db
      .select()
      .from(leases)
      .where(and(
        inArray(leases.propertyId, propIds),
        eq(leases.status, LeaseStatus.ACTIVE)
      ));

    const activeTenantsCount = activeLeaseRecords.length;
    const occupancyRate = totalUnits > 0 ? Math.round((activeTenantsCount / totalUnits) * 100) : 0;

    // 3. Relational Rent Schedules & Payments (Double-entry / Authoritative financial data)
    // ONLY include properties where user has VIEW_FINANCES or is Owner/Admin
    const financePropIds = accessList
      .filter(a => a.isOwner || a.grantedPermissions.includes(Permission.VIEW_FINANCIALS) || user.roles.includes(UserRole.PLATFORM_ADMIN))
      .map(a => a.propertyId);

    const schedules = financePropIds.length > 0 ? await db
      .select()
      .from(rentSchedules)
      .where(inArray(rentSchedules.propertyId, financePropIds)) : [];

    const payments = financePropIds.length > 0 ? await db
      .select()
      .from(paymentRecords)
      .where(and(
        inArray(paymentRecords.propertyId, financePropIds),
        eq(paymentRecords.status, 'CONFIRMED')
      )) : [];

    // Sum actual confirmed payments vs scheduled rent (normalized to IQD)
    const { financeService } = await import('../services/finance.js');
    const exchangeRateIqd = await financeService.fetchFinancialPolicy('EXCHANGE_RATE_IQD');

    let currentMonthRevenueIqd = 0;
    let expectedMonthRevenueIqd = 0;

    for (const l of activeLeaseRecords) {
      const leaseAmt = Number(l.rentAmount || 0);
      expectedMonthRevenueIqd += l.currency === 'USD' ? Math.round(leaseAmt * exchangeRateIqd) : leaseAmt;
    }

    // Precise date boundary for the current calendar month (UTC convention)
    const now = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7);
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

    for (const p of payments) {
      if (p.status !== 'CONFIRMED') continue;

      let isCurrentMonth = false;
      if (p.recordedDate) {
        const raw = p.recordedDate.trim();
        const d = new Date(raw.includes('T') ? raw : `${raw}T00:00:00.000Z`);
        if (!isNaN(d.getTime())) {
          isCurrentMonth = d.getTime() >= currentMonthStart.getTime() && d.getTime() < nextMonthStart.getTime();
        } else {
          isCurrentMonth = raw.slice(0, 7) === currentMonthKey;
        }
      } else if (p.createdAt) {
        const d = new Date(p.createdAt);
        if (!isNaN(d.getTime())) {
          isCurrentMonth = d.getTime() >= currentMonthStart.getTime() && d.getTime() < nextMonthStart.getTime();
        }
      }

      if (isCurrentMonth) {
        const payAmt = Number(p.amount || 0);
        currentMonthRevenueIqd += p.currency === 'USD' ? Math.round(payAmt * exchangeRateIqd) : payAmt;
      }
    }

    // 4. Relational Maintenance Requests (Real issues from maintenance_requests table)
    const maintRecords = await db
      .select()
      .from(maintenanceRequests)
      .where(inArray(maintenanceRequests.propertyId, propIds));

    const openMaintenance = maintRecords.filter(m => !['COMPLETED', 'CANCELLED'].includes(m.status || '')).length;
    const urgentMaintenance = maintRecords.filter(m => m.priority === 'URGENT' && !['COMPLETED', 'CANCELLED'].includes(m.status || '')).length;

    // 5. Relational Approvals (Pending maintenance quotes & lease approvals)
    const pendingQuotes = await db
      .select({
        quote: maintenanceQuotes,
        request: maintenanceRequests,
      })
      .from(maintenanceQuotes)
      .innerJoin(maintenanceRequests, eq(maintenanceQuotes.maintenanceRequestId, maintenanceRequests.id))
      .where(and(
        inArray(maintenanceQuotes.propertyId, propIds),
        eq(maintenanceQuotes.status, 'PENDING_APPROVAL')
      ));

    // 6. Upcoming Events from Lease expirations and Rent Schedules
    const upcomingEvents = [];
    for (const l of activeLeaseRecords) {
      if (l.endDate) {
        upcomingEvents.push({
          id: `ev-lease-${l.id}`,
          type: 'LEASE_RENEWAL' as const,
          title: 'Lease Renewal',
          titleKurdish: 'نوێکردنەوەی گرێبەست',
          dateTimeFormatted: l.endDate,
          relatedProperty: scopedProperties.find(p => p.id === l.propertyId)?.name || 'Property',
          status: 'UPCOMING',
        });
      }
    }

    // Financial breakdown by month using actual rent schedules and confirmed payments (normalized to IQD)
    const monthMap = new Map<string, { actual: number; expected: number }>();
    for (const s of schedules) {
      const monthKey = s.dueDate ? s.dueDate.substring(0, 7) : 'Unknown';
      const existing = monthMap.get(monthKey) || { actual: 0, expected: 0 };
      const sAmt = Number(s.amount || 0);
      existing.expected += s.currency === 'USD' ? Math.round(sAmt * exchangeRateIqd) : sAmt;
      // actual is intentionally NOT derived from s.paidAmount to exclude unconfirmed/pending payments
      monthMap.set(monthKey, existing);
    }

    for (const p of payments) {
      let monthKey = 'Unknown';
      if (p.rentScheduleId) {
        const schedule = schedules.find(s => s.id === p.rentScheduleId);
        if (schedule && schedule.dueDate) {
          monthKey = schedule.dueDate.substring(0, 7);
        } else if (p.recordedDate) {
          monthKey = p.recordedDate.substring(0, 7);
        }
      } else if (p.recordedDate) {
        monthKey = p.recordedDate.substring(0, 7);
      }

      const existing = monthMap.get(monthKey) || { actual: 0, expected: 0 };
      const pAmt = Number(p.amount || 0);
      existing.actual += p.currency === 'USD' ? Math.round(pAmt * exchangeRateIqd) : pAmt;
      monthMap.set(monthKey, existing);
    }

    const months = Array.from(monthMap.entries()).map(([month, data]) => ({
      month,
      actualIncomeIqd: data.actual,
      expectedIncomeIqd: data.expected,
    }));

    const totalActualIqd = months.reduce((s, m) => s + m.actualIncomeIqd, 0);
    const totalExpectedIqd = months.reduce((s, m) => s + m.expectedIncomeIqd, 0);

    const totalCommissionIqd = scopedProperties.reduce((s, p) => s + (p.totalFeeDeductedIqd || 0), 0);
    const totalPlatformFeeIqd = scopedProperties.reduce((s, p) => s + (p.platformFeeIqd || 0), 0);
    const totalRentFeeIqd = scopedProperties.reduce((s, p) => s + (p.rentFeeIqd || 0), 0);
    const totalManagementFeeIqd = scopedProperties.reduce((s, p) => s + (p.managementFeeIqd || 0), 0);
    const totalNetOwnerIncomeIqd = scopedProperties.reduce((s, p) => s + (p.netOwnerIncomeIqd || 0), 0);

    return {
      ownerId: user.id,
      ownerName: user.name || 'Owner',
      ownerRole: user.roles[0] === UserRole.PLATFORM_ADMIN ? 'Platform Admin' : user.roles.includes(UserRole.COMPANY) ? 'Managing Company' : 'Property Owner',
      avatarUrl: user.avatarUrl,
      unreadNotificationsCount: 0,
      unreadMessagesCount: 0,
      kpis: {
        totalProperties: scopedProperties.length,
        propertiesChangeText: `${scopedProperties.length} verified in registry`,
        activeTenants: activeTenantsCount,
        occupancyRate,
        monthlyRevenueIqd: currentMonthRevenueIqd,
        revenueChangeText: currentMonthRevenueIqd > 0 ? 'Verified rent roll' : 'Awaiting payment verification',
        openMaintenance,
        urgentMaintenance,
      },
      properties: scopedProperties,
      recentActivities: [],
      upcomingEvents,
      rentalIncome: {
        period: '6m',
        currency: 'IQD',
        months,
        totalActualIqd,
        totalExpectedIqd,
        platformFeeRate: await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE'),
        totalCommissionIqd,
        totalPlatformFeeIqd,
        totalRentFeeIqd,
        totalManagementFeeIqd,
        totalNetOwnerIncomeIqd,
      },
      occupancy: {
        totalUnits,
        occupiedCount: activeTenantsCount,
        occupiedPercentage: occupancyRate,
        vacantCount: Math.max(0, totalUnits - activeTenantsCount - openMaintenance),
        vacantPercentage: totalUnits > 0 ? Math.round((Math.max(0, totalUnits - activeTenantsCount - openMaintenance) / totalUnits) * 100) : 0,
        maintenanceCount: openMaintenance,
        maintenancePercentage: totalUnits > 0 ? Math.round((openMaintenance / totalUnits) * 100) : 0,
      },
      quickTip: {
        id: 'tip-01',
        text: 'All properties and financials are synchronized with the authoritative registry.',
        textKurdish: 'هەموو موڵکەکان و تۆمارە داراییەکان ڕاستەوخۆ بەستراونەتەوە بە تۆماری فەرمی.',
        category: 'REVENUE',
        isAiGenerated: true,
      },
    };
  }

  /**
   * Fetch single property by ID with strict authority check
   */
  async getPropertyById(user: { id: string; organizationId?: string; roles: string[] }, propertyId: string) {
    const hasPermission = await this.verifyPropertyPermission(user, propertyId, Permission.VIEW_PROPERTY);
    if (!hasPermission) return null;

    const [prop] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
    if (!prop) return null;

    const propUnits = await db.select().from(units).where(eq(units.propertyId, propertyId));
    const activeLeases = await db
      .select({ lease: leases, tenant: users })
      .from(leases)
      .leftJoin(leaseTenants, and(eq(leases.id, leaseTenants.leaseId), eq(leaseTenants.isPrimary, true)))
      .leftJoin(users, eq(leaseTenants.tenantId, users.id))
      .where(and(eq(leases.propertyId, propertyId), eq(leases.status, LeaseStatus.ACTIVE)));

    const agreements = await db
      .select({ agreement: managementAgreements, company: organizations })
      .from(managementAgreements)
      .leftJoin(organizations, eq(managementAgreements.companyId, organizations.id))
      .where(eq(managementAgreements.propertyId, propertyId));

    const owners = await db
      .select({ record: ownershipRecords, owner: users })
      .from(ownershipRecords)
      .leftJoin(users, eq(ownershipRecords.ownerId, users.id))
      .where(eq(ownershipRecords.propertyId, propertyId));

    return {
      property: prop,
      units: propUnits,
      activeLeases,
      agreements,
      ownershipRecords: owners,
    };
  }

  /**
   * Update property with EDIT_PROPERTY permission check
   */
  async updateProperty(
    user: { id: string; organizationId?: string; roles: string[] },
    propertyId: string,
    data: { name?: string; type?: string; address?: any; squareFeet?: number; yearBuilt?: number; rentFee?: number | null; managementFee?: number | null }
  ) {
    const hasPermission = await this.verifyPropertyPermission(user, propertyId, Permission.EDIT_PROPERTY);
    if (!hasPermission) {
      throw new Error('AUTHORITY_REQUIRED: You lack authority to edit this property');
    }

    const [existingProperty] = await db.select({
      id: properties.id,
      operatingModel: properties.operatingModel
    }).from(properties).where(eq(properties.id, propertyId)).limit(1);

    if (!existingProperty) {
      throw new Error('NOT_FOUND: Property not found');
    }

    const opModel = existingProperty.operatingModel;

    let finalRentFee = data.rentFee;
    let finalManagementFee = data.managementFee;

    if (opModel === 'AGENT_OPERATED') {
      if (finalRentFee !== undefined && finalRentFee !== null) {
        throw new Error('INVALID_FEE: Rent fee does not apply to AGENT_OPERATED operating model');
      }
      if (finalManagementFee !== undefined && finalManagementFee !== null) {
        throw new Error('INVALID_FEE: Management fee does not apply to AGENT_OPERATED operating model');
      }
      finalRentFee = null;
      finalManagementFee = null;
    } else if (opModel === 'AGENT_LISTED_PLATFORM_MANAGED') {
      if (finalRentFee !== undefined && finalRentFee !== null) {
        throw new Error('INVALID_FEE: Rent fee does not apply to AGENT_LISTED_PLATFORM_MANAGED operating model');
      }
      finalRentFee = null;
    }

    if (finalRentFee !== undefined && finalRentFee !== null) {
      const rf = Number(finalRentFee);
      if (isNaN(rf) || !isFinite(rf) || rf < 0 || rf > 1) {
        throw new Error('INVALID_FEE: Rent fee must be a valid number between 0 and 1');
      }
    }

    if (finalManagementFee !== undefined && finalManagementFee !== null) {
      const mf = Number(finalManagementFee);
      if (isNaN(mf) || !isFinite(mf) || mf < 0 || mf > 1) {
        throw new Error('INVALID_FEE: Management fee must be a valid number between 0 and 1');
      }
    }

    const [updated] = await db
      .update(properties)
      .set({
        ...(data.name ? { name: data.name } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(data.address ? { address: data.address } : {}),
        ...(data.squareFeet ? { squareFeet: data.squareFeet } : {}),
        ...(data.yearBuilt ? { yearBuilt: data.yearBuilt } : {}),
        ...(data.rentFee !== undefined ? { rentFee: finalRentFee !== null ? String(finalRentFee) : null } : {}),
        ...(data.managementFee !== undefined ? { managementFee: finalManagementFee !== null ? String(finalManagementFee) : null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId))
      .returning();

    return updated;
  }

  /**
   * Get scoped leases across caller's authorized properties
   */
  async getScopedLeases(user: { id: string; organizationId?: string; roles: string[] }, propertyId?: string) {
    const accessList = await this.getAuthorizedPropertyAccess(user);
    const authorizedPropIds = accessList.map(a => a.propertyId);

    if (authorizedPropIds.length === 0) return [];

    let targetPropIds = authorizedPropIds;
    if (propertyId) {
      if (!authorizedPropIds.includes(propertyId)) {
        return [];
      }
      targetPropIds = [propertyId];
    }

    const leaseRecords = await db
      .select({
        lease: leases,
        property: properties,
        unit: units,
        tenant: users,
      })
      .from(leases)
      .innerJoin(properties, eq(leases.propertyId, properties.id))
      .leftJoin(units, eq(leases.unitId, units.id))
      .leftJoin(leaseTenants, and(eq(leases.id, leaseTenants.leaseId), eq(leaseTenants.isPrimary, true)))
      .leftJoin(users, eq(leaseTenants.tenantId, users.id))
      .where(inArray(leases.propertyId, targetPropIds))
      .orderBy(desc(leases.createdAt));

    return leaseRecords.map(r => ({
      id: r.lease.id,
      propertyId: r.lease.propertyId,
      propertyName: r.property.name,
      unitNumber: r.unit?.unitNumber || 'Main',
      tenantId: r.tenant?.id,
      tenantName: r.tenant ? `${r.tenant.firstName} ${r.tenant.lastName}` : 'Unassigned',
      tenantPhone: r.tenant?.phone,
      tenantEmail: r.tenant?.email,
      startDate: r.lease.startDate,
      endDate: r.lease.endDate,
      rentAmount: Number(r.lease.rentAmount),
      currency: r.lease.currency,
      status: r.lease.status,
      depositAmount: r.lease.depositAmount ? Number(r.lease.depositAmount) : 0,
      rentCycle: r.lease.rentCycle || 'MONTHLY',
    }));
  }

  /**
   * Scoped renewal requests for properties the caller is authorized to manage
   */
  async getScopedRenewals(user: { id: string; organizationId?: string; roles: string[] }, propertyId?: string) {
    const accessList = await this.getAuthorizedPropertyAccess(user);
    const authorizedPropIds = accessList.map(a => a.propertyId);

    if (authorizedPropIds.length === 0) return [];

    let targetPropIds = authorizedPropIds;
    if (propertyId) {
      if (!authorizedPropIds.includes(propertyId)) {
        return [];
      }
      targetPropIds = [propertyId];
    }

    const renewalRecords = await db
      .select({
        renewal: leaseRenewals,
        property: properties,
        lease: leases,
        tenant: users,
        unit: units,
      })
      .from(leaseRenewals)
      .innerJoin(properties, eq(leaseRenewals.propertyId, properties.id))
      .innerJoin(leases, eq(leaseRenewals.leaseId, leases.id))
      .leftJoin(users, eq(leaseRenewals.tenantId, users.id))
      .leftJoin(units, eq(leases.unitId, units.id))
      .where(inArray(leaseRenewals.propertyId, targetPropIds))
      .orderBy(desc(leaseRenewals.createdAt));

    return renewalRecords.map(r => ({
      id: r.renewal.id,
      leaseId: r.renewal.leaseId,
      propertyId: r.renewal.propertyId,
      propertyName: r.property.name,
      unitNumber: r.unit?.unitNumber || 'Main',
      tenantId: r.renewal.tenantId,
      tenantName: r.tenant ? `${r.tenant.firstName} ${r.tenant.lastName}` : 'Tenant',
      tenantEmail: r.tenant?.email,
      tenantPhone: r.tenant?.phone,
      currentStartDate: r.lease.startDate,
      currentEndDate: r.lease.endDate,
      currentRentAmount: Number(r.lease.rentAmount),
      proposedStartDate: r.renewal.proposedStartDate,
      proposedEndDate: r.renewal.proposedEndDate,
      proposedRentAmount: r.renewal.proposedRentAmount ? Number(r.renewal.proposedRentAmount) : Number(r.lease.rentAmount),
      currency: r.renewal.currency || r.lease.currency || 'IQD',
      status: r.renewal.status,
      tenantNotes: r.renewal.tenantNotes,
      ownerNotes: r.renewal.ownerNotes,
      createdAt: r.renewal.createdAt,
    }));
  }

  /**
   * Get specific lease details with rent schedules and payment records
   */
  async getLeaseDetails(user: { id: string; organizationId?: string; roles: string[] }, leaseId: string) {
    const [leaseRecord] = await db
      .select({
        lease: leases,
        property: properties,
        unit: units,
      })
      .from(leases)
      .innerJoin(properties, eq(leases.propertyId, properties.id))
      .leftJoin(units, eq(leases.unitId, units.id))
      .where(eq(leases.id, leaseId))
      .limit(1);

    if (!leaseRecord) return null;

    const hasPermission = await this.verifyPropertyPermission(user, leaseRecord.lease.propertyId, Permission.VIEW_PROPERTY);
    if (!hasPermission) {
      throw new Error('AUTHORITY_REQUIRED: You do not have authority over this lease');
    }

    const tenants = await db
      .select({
        tenant: users,
        isPrimary: leaseTenants.isPrimary,
      })
      .from(leaseTenants)
      .innerJoin(users, eq(leaseTenants.tenantId, users.id))
      .where(eq(leaseTenants.leaseId, leaseId));

    const schedules = await db
      .select()
      .from(rentSchedules)
      .where(eq(rentSchedules.leaseId, leaseId))
      .orderBy(desc(rentSchedules.dueDate));

    const payments = await db
      .select()
      .from(paymentRecords)
      .where(eq(paymentRecords.leaseId, leaseId))
      .orderBy(desc(paymentRecords.createdAt));

    return {
      lease: leaseRecord.lease,
      property: leaseRecord.property,
      unit: leaseRecord.unit,
      tenants,
      schedules,
      payments,
    };
  }

  /**
   * Create new lease with MANAGE_LEASES check
   */
  async createLease(
    user: { id: string; organizationId?: string; roles: string[] },
    data: {
      propertyId: string;
      unitId?: string;
      tenantId: string;
      startDate: string;
      endDate: string;
      rentAmount: number;
      currency?: string;
      depositAmount?: number;
      rentCycle?: string;
    }
  ) {
    const hasPermission = await this.verifyPropertyPermission(user, data.propertyId, Permission.MANAGE_LEASES);
    if (!hasPermission) {
      throw new Error('AUTHORITY_REQUIRED: You lack authority to create leases for this property');
    }

    if (!data.tenantId || typeof data.tenantId !== 'string' || !data.tenantId.trim()) {
      throw new Error('VALIDATION_ERROR: tenantId is required and must be a non-empty string.');
    }

    validateLeaseDateOrder(data.startDate, data.endDate);

    const numRent = Number(data.rentAmount);
    if (isNaN(numRent) || numRent <= 0) {
      throw new Error('VALIDATION_ERROR: Rent amount must be a valid positive number.');
    }

    return await db.transaction(async (tx) => {
      // Shared parent-property row lock, unit validation, and physical-space overlap invariant
      await leaseRepository.assertNoPhysicalSpaceOverlap(tx, {
        propertyId: data.propertyId,
        unitId: data.unitId || null,
        startDate: data.startDate,
        endDate: data.endDate,
      });

      // Unified tenant role, existence, approved application, and duplicate lease invariants
      const { primaryApplicationId } = await leaseRepository.assertTenantAndApplicationInvariants(tx, {
        propertyId: data.propertyId,
        unitId: data.unitId || null,
        tenantIds: [data.tenantId.trim()],
        startDate: data.startDate,
        endDate: data.endDate,
      });

      const [targetProperty] = await tx.select().from(properties).where(eq(properties.id, data.propertyId)).limit(1);
      const effectiveCurrency = data.currency || targetProperty?.currency || 'IQD';
      if (!['IQD', 'USD'].includes(effectiveCurrency)) {
        throw new Error(`VALIDATION_ERROR: Unsupported currency '${effectiveCurrency}'. Must be IQD or USD.`);
      }

      try {
        const [newLease] = await tx
          .insert(leases)
          .values({
            propertyId: data.propertyId,
            unitId: data.unitId || null,
            startDate: data.startDate,
            endDate: data.endDate,
            rentAmount: String(numRent),
            currency: effectiveCurrency,
            depositAmount: data.depositAmount ? String(data.depositAmount) : '0',
            rentCycle: data.rentCycle || 'MONTHLY',
            status: LeaseStatus.PENDING_SIGNATURE, // Wait for tenant acceptance
            rentalApplicationId: primaryApplicationId,
          })
          .returning();

        // Associate tenant
        await tx.insert(leaseTenants).values({
          leaseId: newLease.id,
          tenantId: data.tenantId.trim(),
          isPrimary: true,
        });

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

  /**
   * Authoritative Owner decision on a lease awaiting approval (status: PENDING_APPROVAL).
   * Strictly enforces:
   * 1. Caller is verified owner via ownershipRecords or Platform Admin (companies and tenants strictly forbidden).
   * 2. Transactional locking on properties row and leases row (FOR UPDATE).
   * 3. Current lease status MUST be PENDING_APPROVAL.
   * 4. APPROVE transitions to PENDING_SIGNATURE.
   * 5. REJECT transitions to CANCELLED.
   * 6. Emits immutable audit log entry.
   */
  async decideLeaseApproval(
    user: { id: string; organizationId?: string; roles: string[] },
    leaseId: string,
    decision: 'APPROVE' | 'REJECT' | 'APPROVED' | 'REJECTED',
    notes?: string
  ) {
    const isPlatformAdmin = user.roles.includes(UserRole.PLATFORM_ADMIN) || user.roles.includes('SUPER_ADMIN');

    const normalizedDecision = decision.toUpperCase().startsWith('APPROV')
      ? 'APPROVE'
      : decision.toUpperCase().startsWith('REJECT')
      ? 'REJECT'
      : null;

    if (!normalizedDecision) {
      throw new Error("VALIDATION_ERROR: Decision must be APPROVE or REJECT.");
    }

    return await db.transaction(async (tx) => {
      // 1. Fetch lease and lock it
      const [targetLease] = await tx.select().from(leases).where(eq(leases.id, leaseId)).limit(1).for('update');
      if (!targetLease) {
        throw new Error("Lease not found");
      }

      // 2. Lock parent property row to serialize all lease and property operations
      await tx.select().from(properties).where(eq(properties.id, targetLease.propertyId)).limit(1).for('update');

      // 3. Strict ownership authority check: Must be verified owner in ownership_records or platform admin
      if (!isPlatformAdmin) {
        let isAuthorizedOwner = false;

        // Individual owner check
        if (user.roles.includes(UserRole.PROPERTY_OWNER)) {
          const ownerRec = await tx.select().from(ownershipRecords).where(and(
            eq(ownershipRecords.ownerId, user.id),
            eq(ownershipRecords.propertyId, targetLease.propertyId),
            eq(ownershipRecords.status, 'VERIFIED')
          )).limit(1);
          if (ownerRec.length > 0) isAuthorizedOwner = true;
        }

        // Corporate legal owner check (property legally owned by organization, NOT managed via management agreement)
        if (!isAuthorizedOwner && user.organizationId && (user.roles.includes(UserRole.COMPANY) || user.roles.includes(UserRole.COMPANY_MEMBER))) {
          const companyOwnerRec = await tx.select().from(ownershipRecords).where(and(
            eq(ownershipRecords.companyId, user.organizationId),
            eq(ownershipRecords.propertyId, targetLease.propertyId),
            eq(ownershipRecords.status, 'VERIFIED')
          )).limit(1);
          if (companyOwnerRec.length > 0) isAuthorizedOwner = true;
        }

        if (!isAuthorizedOwner) {
          throw new Error("AUTHORITY_REQUIRED: Only verified property owner or platform admin can decide lease approval.");
        }
      }

      // 4. Validate current status is PENDING_APPROVAL
      if (targetLease.status !== LeaseStatus.PENDING_APPROVAL) {
        throw new Error(`VALIDATION_ERROR: Cannot decide approval for lease with status '${targetLease.status}'. Only leases in PENDING_APPROVAL can be approved or rejected.`);
      }

      // 5. State transition
      const targetStatus = normalizedDecision === 'APPROVE' ? LeaseStatus.PENDING_SIGNATURE : LeaseStatus.CANCELLED;
      const [updatedLease] = await tx.update(leases)
        .set({ status: targetStatus })
        .where(and(
          eq(leases.id, leaseId),
          eq(leases.status, LeaseStatus.PENDING_APPROVAL)
        ))
        .returning();

      if (!updatedLease) {
        throw new Error("VALIDATION_ERROR: Concurrent modification detected or lease is no longer in PENDING_APPROVAL.");
      }

      // 6. Audit log
      await auditService.logAction({
        actorUserId: user.id,
        actorRole: user.roles[0] as string,
        action: normalizedDecision === 'APPROVE' ? 'OWNER_APPROVE_LEASE' : 'OWNER_REJECT_LEASE',
        resourceType: 'Lease',
        resourceId: leaseId,
        changes: { previousStatus: targetLease.status, status: targetStatus, notes: notes || null },
        tx,
      });

      return updatedLease;
    });
  }

  /**
   * Authoritative financial breakdown:
   * Reconciles EXPECTED, SCHEDULED, PAID, OUTSTANDING, OVERDUE, EXPENSES, NET
   * and queries double-entry journalEntries and ledgerLines.
   */
  async getAuthoritativeFinances(
    user: { id: string; organizationId?: string; roles: string[] },
    propertyId?: string
  ) {
    const accessList = await this.getAuthorizedPropertyAccess(user);
    const authorizedPropIds = accessList.map(a => a.propertyId);

    if (authorizedPropIds.length === 0) {
      return {
        summary: {
          expected: 0,
          scheduled: 0,
          paid: 0,
          outstanding: 0,
          overdue: 0,
          expenses: 0,
          managementFees: 0,
          net: 0,
          currency: 'IQD',
        },
        rentRoll: [],
        expensesList: [],
        ledgerEntries: [],
      };
    }

    let targetPropIds = authorizedPropIds;
    if (propertyId) {
      if (!authorizedPropIds.includes(propertyId)) {
        throw new Error('AUTHORITY_REQUIRED: Access denied for specified property');
      }
      targetPropIds = [propertyId];
    }

    // 1. Rent Schedules
    const schedules = await db
      .select({
        schedule: rentSchedules,
        property: properties,
        tenant: users,
      })
      .from(rentSchedules)
      .innerJoin(properties, eq(rentSchedules.propertyId, properties.id))
      .innerJoin(users, eq(rentSchedules.tenantId, users.id))
      .where(inArray(rentSchedules.propertyId, targetPropIds));

    // 2. Confirmed Payments
    const payments = await db
      .select()
      .from(paymentRecords)
      .where(and(
        inArray(paymentRecords.propertyId, targetPropIds),
        eq(paymentRecords.status, 'CONFIRMED')
      ));

    // 3. Maintenance Invoices (Expenses)
    const invoices = await db
      .select({
        invoice: maintenanceInvoices,
        property: properties,
        vendor: organizations,
      })
      .from(maintenanceInvoices)
      .innerJoin(properties, eq(maintenanceInvoices.propertyId, properties.id))
      .innerJoin(organizations, eq(maintenanceInvoices.vendorId, organizations.id))
      .where(inArray(maintenanceInvoices.propertyId, targetPropIds));

    // 4. Double-entry Journal & Ledger Lines
    const entries = await db
      .select({
        journal: journalEntries,
        line: ledgerLines,
      })
      .from(journalEntries)
      .innerJoin(ledgerLines, eq(journalEntries.id, ledgerLines.journalEntryId))
      .where(inArray(journalEntries.propertyId, targetPropIds));

    // 5. Active Management Agreements for commission calculations
    const agreements = await db
      .select()
      .from(managementAgreements)
      .where(and(
        inArray(managementAgreements.propertyId, targetPropIds),
        eq(managementAgreements.status, 'ACTIVE')
      ));

    const todayStr = new Date().toISOString().slice(0, 10);

    const { financeService } = await import('../services/finance.js');
    const exchangeRateIqd = await financeService.fetchFinancialPolicy('EXCHANGE_RATE_IQD');

    let singlePropertyCurrency: string | null = null;
    if (targetPropIds.length === 1) {
      const [singleProp] = await db.select().from(properties).where(eq(properties.id, targetPropIds[0])).limit(1);
      singlePropertyCurrency = singleProp?.currency || 'IQD';
    }
    const reportCurrency = singlePropertyCurrency || 'IQD';

    // Helper to normalize amount to the report currency
    const normalize = (amount: number, itemCurrency: string) => {
      const c = itemCurrency || 'IQD';
      if (reportCurrency === 'IQD') {
        return c === 'USD' ? Math.round(amount * exchangeRateIqd) : amount;
      } else {
        // reportCurrency === 'USD'
        return c === 'IQD' ? Math.round((amount / exchangeRateIqd) * 100) / 100 : amount;
      }
    };

    let expected = 0;
    let scheduled = 0;
    let paid = 0;
    let outstanding = 0;
    let overdue = 0;

    for (const s of schedules) {
      const sCurr = s.schedule.currency || s.property.currency || 'IQD';
      const amt = normalize(Number(s.schedule.amount || 0), sCurr);
      const paidAmt = normalize(Number(s.schedule.paidAmount || 0), sCurr);
      const remaining = Math.max(0, amt - paidAmt);

      expected += amt;

      if (s.schedule.status === 'UPCOMING') {
        scheduled += remaining;
      } else if (s.schedule.status === 'PAID') {
        // already counted in paid
      } else if (s.schedule.status === 'OVERDUE' || (s.schedule.dueDate < todayStr && remaining > 0)) {
        overdue += remaining;
      } else if (s.schedule.status === 'DUE' || s.schedule.status === 'PARTIALLY_PAID') {
        outstanding += remaining;
      }
    }

    const paymentsByProperty = new Map<string, number>();
    for (const p of payments) {
      const pCurr = p.currency || 'IQD';
      const amt = normalize(Number(p.amount || 0), pCurr);
      paid += amt;
      paymentsByProperty.set(p.propertyId, (paymentsByProperty.get(p.propertyId) || 0) + amt);
    }

    let expenses = 0;
    for (const inv of invoices) {
      const invCurr = inv.invoice.currency || 'USD';
      expenses += normalize(Number(inv.invoice.amount || 0), invCurr);
    }

    // Fees calculation using CONFIRMED posted commissions
    const propertyCommissions = targetPropIds.length > 0 ? await db.select()
      .from(commissions)
      .where(and(
        inArray(commissions.propertyId, targetPropIds),
        eq(commissions.status, 'POSTED')
      )) : [];

    let totalFees = 0;
    for (const c of propertyCommissions) {
      const cCurr = c.currency || 'IQD';
      totalFees += normalize(Number(c.commissionAmount || 0), cCurr);
    }

    const net = paid - expenses - totalFees;

    // Canonical double-entry ledger reconciliation
    let totalDebits = 0;
    let totalCredits = 0;
    for (const e of entries) {
      totalDebits += Number(e.line.debit || 0);
      totalCredits += Number(e.line.credit || 0);
    }
    const discrepancy = Math.abs(totalDebits - totalCredits);
    const isBalanced = discrepancy < 0.001;
    const reconciliationStatus = entries.length === 0 ? 'NO_ENTRIES' : isBalanced ? 'RECONCILED' : 'UNRECONCILED';

    return {
      summary: {
        expected: Math.round(expected * 100) / 100,
        scheduled: Math.round(scheduled * 100) / 100,
        paid: Math.round(paid * 100) / 100,
        outstanding: Math.round(outstanding * 100) / 100,
        overdue: Math.round(overdue * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        managementFees: Math.round(totalFees * 100) / 100,
        net: Math.round(net * 100) / 100,
        currency: reportCurrency,
      },
      reconciliation: {
        status: reconciliationStatus,
        totalDebits: Math.round(totalDebits * 100) / 100,
        totalCredits: Math.round(totalCredits * 100) / 100,
        isBalanced,
        discrepancy: Math.round(discrepancy * 100) / 100,
        entriesCount: entries.length,
      },
      rentRoll: schedules.map(s => ({
        id: s.schedule.id,
        propertyId: s.schedule.propertyId,
        propertyName: s.property.name,
        tenantName: `${s.tenant.firstName} ${s.tenant.lastName}`,
        dueDate: s.schedule.dueDate,
        amount: Number(s.schedule.amount),
        paidAmount: Number(s.schedule.paidAmount || 0),
        status: s.schedule.status,
      })),
      expensesList: invoices.map(i => ({
        id: i.invoice.id,
        propertyId: i.invoice.propertyId,
        propertyName: i.property.name,
        vendorName: i.vendor.name,
        amount: Number(i.invoice.amount),
        currency: i.invoice.currency,
        status: i.invoice.status,
        dueDate: i.invoice.dueDate,
      })),
      ledgerEntries: entries.map(e => ({
        journalId: e.journal.id,
        date: e.journal.date,
        description: e.journal.description,
        accountId: e.line.accountId,
        debit: Number(e.line.debit || 0),
        credit: Number(e.line.credit || 0),
        currency: e.line.currency,
      })),
    };
  }

  /**
   * Authoritative reports with verifiable data tracing
   */
  async getAuthoritativeReports(
    user: { id: string; organizationId?: string; roles: string[] }
  ) {
    const dashboard = await this.getAuthoritativeDashboard(user);
    const finances = await this.getAuthoritativeFinances(user);

    return {
      portfolioOverview: {
        totalProperties: dashboard.kpis.totalProperties,
        totalUnits: dashboard.occupancy.totalUnits,
        occupancyRate: dashboard.kpis.occupancyRate,
        activeTenants: dashboard.kpis.activeTenants,
        openMaintenance: dashboard.kpis.openMaintenance,
      },
      financialRollup: finances.summary,
      monthlyBreakdown: dashboard.rentalIncome.months,
      historicalComparison: {
        available: false,
        reason: 'Historical registry snapshots not yet accumulated for prior periods.',
      },
      propertiesPerformance: dashboard.properties.map(p => ({
        propertyId: p.id,
        propertyName: p.name,
        city: p.city,
        monthlyRentIqd: p.monthlyRentIqd,
        isOccupied: p.isOccupied,
        status: p.status,
        managingAgency: p.managingAgencyName || 'Self-Managed',
      })),
    };
  }

  /**
   * Management Company Agreement Workflow
   */
  async inviteCompany(
    ownerId: string,
    data: {
      propertyId: string;
      companyId: string;
      grantedPermissions: string[];
      spendingLimit?: number;
      startDate: string;
      endDate?: string;
    }
  ) {
    // Verify verified ownership
    const [record] = await db
      .select()
      .from(ownershipRecords)
      .where(and(
        eq(ownershipRecords.propertyId, data.propertyId),
        eq(ownershipRecords.ownerId, ownerId),
        eq(ownershipRecords.status, 'VERIFIED')
      ))
      .limit(1);

    if (!record) {
      throw new Error('AUTHORITY_REQUIRED: Only verified property owners can issue management agreements');
    }

    const [agreement] = await db
      .insert(managementAgreements)
      .values({
        propertyId: data.propertyId,
        companyId: data.companyId,
        ownerId,
        status: 'PENDING',
        startDate: data.startDate,
        endDate: data.endDate,
        grantedPermissions: data.grantedPermissions,
        spendingLimit: data.spendingLimit ? String(data.spendingLimit) : null,
      })
      .returning();

    return agreement;
  }

  async acceptAgreement(companyUserId: string, companyOrgId: string, agreementId: string) {
    const [agreement] = await db
      .select()
      .from(managementAgreements)
      .where(eq(managementAgreements.id, agreementId))
      .limit(1);

    if (!agreement) {
      throw new Error('NOT_FOUND: Management agreement not found');
    }

    if (agreement.companyId !== companyOrgId) {
      throw new Error('AUTHORITY_REQUIRED: This agreement was not issued to your organization');
    }

    if (agreement.status !== 'PENDING') {
      throw new Error(`INVALID_STATE: Agreement is already ${agreement.status}`);
    }

    const [updated] = await db
      .update(managementAgreements)
      .set({ status: 'ACTIVE' })
      .where(eq(managementAgreements.id, agreementId))
      .returning();

    return updated;
  }

  async terminateAgreement(
    user: { id: string; organizationId?: string; roles: string[] },
    agreementId: string
  ) {
    const [agreement] = await db
      .select()
      .from(managementAgreements)
      .where(eq(managementAgreements.id, agreementId))
      .limit(1);

    if (!agreement) {
      throw new Error('NOT_FOUND: Management agreement not found');
    }

    const isOwner = agreement.ownerId === user.id;
    const isCompany = agreement.companyId === user.organizationId;
    const isAdmin = user.roles.includes(UserRole.PLATFORM_ADMIN);

    if (!isOwner && !isCompany && !isAdmin) {
      throw new Error('AUTHORITY_REQUIRED: Only the property owner or the appointed company can terminate the agreement');
    }

    const [updated] = await db
      .update(managementAgreements)
      .set({ status: 'TERMINATED' })
      .where(eq(managementAgreements.id, agreementId))
      .returning();

    return updated;
  }

  async getManagementAgreements(user: { id: string; organizationId?: string; roles: string[] }) {
    if (user.roles.includes(UserRole.PLATFORM_ADMIN)) {
      return db
        .select({
          agreement: managementAgreements,
          property: properties,
          company: organizations,
          owner: users,
        })
        .from(managementAgreements)
        .innerJoin(properties, eq(managementAgreements.propertyId, properties.id))
        .innerJoin(organizations, eq(managementAgreements.companyId, organizations.id))
        .innerJoin(users, eq(managementAgreements.ownerId, users.id));
    }

    const conditions = [];
    if (user.roles.includes(UserRole.PROPERTY_OWNER)) {
      conditions.push(eq(managementAgreements.ownerId, user.id));
    }
    if ((user.roles.includes(UserRole.COMPANY) || user.roles.includes(UserRole.COMPANY_MEMBER)) && user.organizationId) {
      conditions.push(eq(managementAgreements.companyId, user.organizationId));
    }

    if (conditions.length === 0) return [];

    return db
      .select({
        agreement: managementAgreements,
        property: properties,
        company: organizations,
        owner: users,
      })
      .from(managementAgreements)
      .innerJoin(properties, eq(managementAgreements.propertyId, properties.id))
      .innerJoin(organizations, eq(managementAgreements.companyId, organizations.id))
      .innerJoin(users, eq(managementAgreements.ownerId, users.id))
      .where(or(...conditions));
  }

  /**
   * Maintenance & Work Orders
   */
  async getScopedMaintenance(user: { id: string; organizationId?: string; roles: string[] }, propertyId?: string) {
    const accessList = await this.getAuthorizedPropertyAccess(user);
    const authorizedPropIds = accessList.map(a => a.propertyId);

    if (authorizedPropIds.length === 0) return [];

    let targetPropIds = authorizedPropIds;
    if (propertyId) {
      if (!authorizedPropIds.includes(propertyId)) return [];
      targetPropIds = [propertyId];
    }

    return db
      .select({
        request: maintenanceRequests,
        property: properties,
        reporter: users,
      })
      .from(maintenanceRequests)
      .innerJoin(properties, eq(maintenanceRequests.propertyId, properties.id))
      .innerJoin(users, eq(maintenanceRequests.reporterUserId, users.id))
      .where(inArray(maintenanceRequests.propertyId, targetPropIds))
      .orderBy(desc(maintenanceRequests.createdAt));
  }

  /**
   * Approvals Center
   */
  async getScopedApprovals(user: { id: string; organizationId?: string; roles: string[] }) {
    const accessList = await this.getAuthorizedPropertyAccess(user);
    const authorizedPropIds = accessList.map(a => a.propertyId);

    if (authorizedPropIds.length === 0) return [];

    const quotes = await db
      .select({
        quote: maintenanceQuotes,
        request: maintenanceRequests,
        property: properties,
        vendor: organizations,
      })
      .from(maintenanceQuotes)
      .innerJoin(maintenanceRequests, eq(maintenanceQuotes.maintenanceRequestId, maintenanceRequests.id))
      .innerJoin(properties, eq(maintenanceQuotes.propertyId, properties.id))
      .innerJoin(organizations, eq(maintenanceQuotes.vendorId, organizations.id))
      .where(and(
        inArray(maintenanceQuotes.propertyId, authorizedPropIds),
        eq(maintenanceQuotes.status, 'PENDING_APPROVAL')
      ));

    // Check spending limits on management agreements
    const agreements = await db
      .select()
      .from(managementAgreements)
      .where(and(
        inArray(managementAgreements.propertyId, authorizedPropIds),
        eq(managementAgreements.status, 'ACTIVE')
      ));

    const mappedQuotes = quotes.map(q => {
      const agreement = agreements.find(ag => ag.propertyId === q.property.id);
      const spendingLimit = agreement?.spendingLimit ? Number(agreement.spendingLimit) : null;
      const quoteAmt = Number(q.quote.totalAmount);
      const exceedsSpendingLimit = spendingLimit !== null && quoteAmt > spendingLimit;

      return {
        id: q.quote.id,
        propertyId: q.property.id,
        propertyName: q.property.name,
        maintenanceRequestId: q.request.id,
        requestTitle: q.request.title,
        vendorName: q.vendor.name,
        amount: quoteAmt,
        currency: q.quote.currency,
        notes: q.quote.notes,
        createdAt: q.quote.createdAt,
        status: q.quote.status,
        exceedsSpendingLimit,
        spendingLimit,
        type: 'MAINTENANCE_QUOTE',
      };
    });

    // Query pending leases awaiting owner approval
    const pendingLeases = await db
      .select({
        lease: leases,
        property: properties,
      })
      .from(leases)
      .innerJoin(properties, eq(leases.propertyId, properties.id))
      .where(and(
        inArray(leases.propertyId, authorizedPropIds),
        eq(leases.status, LeaseStatus.PENDING_APPROVAL)
      ));

    const mappedLeases = pendingLeases.map(l => ({
      id: l.lease.id,
      propertyId: l.property.id,
      propertyName: l.property.name,
      maintenanceRequestId: null,
      requestTitle: `Lease Draft Activation (${l.property.name})`,
      vendorName: 'Management Company',
      amount: Number(l.lease.rentAmount || 0),
      currency: l.lease.currency || 'IQD',
      notes: `Company drafted lease (${l.lease.startDate} to ${l.lease.endDate}) awaiting owner approval.`,
      createdAt: l.lease.createdAt,
      status: l.lease.status,
      exceedsSpendingLimit: true,
      spendingLimit: null,
      type: 'LEASE',
    }));

    return [...mappedQuotes, ...mappedLeases];
  }

  /**
   * Documents
   */
  async getScopedDocuments(user: { id: string; organizationId?: string; roles: string[] }, propertyId?: string) {
    const accessList = await this.getAuthorizedPropertyAccess(user);
    const authorizedPropIds = accessList.map(a => a.propertyId);

    if (authorizedPropIds.length === 0) return [];

    let targetPropIds = authorizedPropIds;
    if (propertyId) {
      if (!authorizedPropIds.includes(propertyId)) return [];
      targetPropIds = [propertyId];
    }

    return db
      .select({
        document: documents,
        property: properties,
        uploader: users,
      })
      .from(documents)
      .innerJoin(properties, eq(documents.propertyId, properties.id))
      .innerJoin(users, eq(documents.uploaderUserId, users.id))
      .where(inArray(documents.propertyId, targetPropIds))
      .orderBy(desc(documents.createdAt));
  }

  async createDocument(
    user: { id: string; organizationId?: string; roles: string[] },
    data: {
      propertyId: string;
      title: string;
      documentType: string;
      fileUrl?: string;
      metadata?: any;
    }
  ) {
    const hasPermission = await this.verifyPropertyPermission(user, data.propertyId, Permission.MANAGE_DOCUMENTS);
    if (!hasPermission) {
      throw new Error('AUTHORITY_REQUIRED: You lack authority to manage documents for this property');
    }

    const [newDoc] = await db
      .insert(documents)
      .values({
        propertyId: data.propertyId,
        ownerId: user.roles.includes(UserRole.PROPERTY_OWNER) ? user.id : null,
        uploaderUserId: user.id,
        title: data.title,
        documentType: data.documentType,
        verificationState: 'PENDING',
        fileUrl: data.fileUrl,
        metadata: data.metadata,
      })
      .returning();

    return newDoc;
  }

  /**
   * Messaging
   */
  async getScopedConversations(user: { id: string; roles: string[] }) {
    const allConversations = await db.select().from(conversations).orderBy(desc(conversations.updatedAt));
    // Filter to conversations where user is creator or participant
    return allConversations.filter(c => {
      const participants = (c.participantIds as string[]) || [];
      return c.creatorUserId === user.id || participants.includes(user.id);
    });
  }

  async getConversationMessages(user: { id: string; roles: string[] }, conversationId: string) {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!conv) throw new Error('NOT_FOUND: Conversation not found');

    const participants = (conv.participantIds as string[]) || [];
    if (conv.creatorUserId !== user.id && !participants.includes(user.id) && !user.roles.includes(UserRole.PLATFORM_ADMIN)) {
      throw new Error('AUTHORITY_REQUIRED: You are not a participant in this conversation');
    }

    return db
      .select({
        message: messages,
        sender: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderUserId, users.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async sendMessage(
    user: { id: string; roles: string[] },
    conversationId: string,
    content: string,
    messageType = 'TEXT'
  ) {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!conv) throw new Error('NOT_FOUND: Conversation not found');

    const participants = (conv.participantIds as string[]) || [];
    if (conv.creatorUserId !== user.id && !participants.includes(user.id) && !user.roles.includes(UserRole.PLATFORM_ADMIN)) {
      throw new Error('AUTHORITY_REQUIRED: You are not a participant in this conversation');
    }

    const [newMsg] = await db
      .insert(messages)
      .values({
        conversationId,
        senderUserId: user.id,
        senderRole: user.roles[0] as string,
        content,
        messageType,
        readByUserIds: [user.id],
      })
      .returning();

    // Update conversation updatedAt
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));

    return newMsg;
  }

  /**
   * Marketplace
   */
  async listPropertyOnMarketplace(
    user: { id: string; organizationId?: string; roles: string[] },
    data: {
      propertyId: string;
      type: string;
      price: number;
      currency?: string;
      title: string;
      description?: string;
    }
  ) {
    if (!data.propertyId || typeof data.propertyId !== 'string') {
      throw new Error('VALIDATION_ERROR: propertyId is required and must be a string.');
    }

    if (!data.type || typeof data.type !== 'string' || !data.type.trim()) {
      throw new Error('VALIDATION_ERROR: Listing type is required and must be a non-empty string.');
    }

    const normalizedType = data.type.trim().toUpperCase();

    // RENTAL-ONLY BOUNDARY ENFORCEMENT:
    // Reject SALE / FOR_SALE when buying and selling is disabled
    if ((normalizedType === 'FOR_SALE' || normalizedType === 'SALE') && !FeatureFlags.BUY_SELL_ENABLED) {
      throw new Error('BUY_SELL_DISABLED: Sale workflows and FOR_SALE listings are disabled in this rental-only release.');
    }

    // Only rental listings are permitted in this release
    if (normalizedType !== 'FOR_RENT' && normalizedType !== 'RENT') {
      throw new Error(`VALIDATION_ERROR: Invalid listing type '${data.type}'. Only rental listings ('FOR_RENT') are supported in this release.`);
    }

    const canonicalType = normalizedType === 'RENT' ? 'FOR_RENT' : normalizedType;

    const hasPermission = await this.verifyPropertyPermission(user, data.propertyId, Permission.CREATE_LISTING);
    if (!hasPermission) {
      throw new Error('AUTHORITY_REQUIRED: You lack authority to list this property on the marketplace');
    }

    if (data.price === undefined || data.price === null || isNaN(Number(data.price)) || Number(data.price) <= 0) {
      throw new Error('VALIDATION_ERROR: Listing price must be a valid positive number.');
    }

    if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
      throw new Error('VALIDATION_ERROR: Listing title is required and must be a non-empty string.');
    }

    const [targetProperty] = await db
      .select({
        currency: properties.currency,
        verificationStatus: properties.verificationStatus,
        status: properties.status
      })
      .from(properties)
      .where(eq(properties.id, data.propertyId))
      .limit(1);

    if (!targetProperty || (targetProperty.verificationStatus !== 'VERIFIED' && targetProperty.status !== 'VERIFIED')) {
      throw new Error('VERIFICATION_REQUIRED: Unverified properties cannot be listed on the marketplace.');
    }
    const effectiveCurrency = data.currency || targetProperty?.currency || 'IQD';

    const [listing] = await db
      .insert(listings)
      .values({
        propertyId: data.propertyId,
        publisherUserId: user.id,
        publisherCompanyId: user.organizationId,
        type: canonicalType,
        price: String(data.price),
        currency: effectiveCurrency,
        status: 'DRAFT',
        title: data.title.trim(),
        description: data.description ? data.description.trim() : null,
      })
      .returning();

    return listing;
  }

  async updateListingStatus(
    user: { id: string; organizationId?: string; roles: string[] },
    listingId: string,
    status: 'PUBLISHED' | 'PAUSED' | 'ARCHIVED'
  ) {
    const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!listing) throw new Error('NOT_FOUND: Listing not found');

    const hasPermission = await this.verifyPropertyPermission(user, listing.propertyId, Permission.PUBLISH_LISTING);
    if (!hasPermission) {
      throw new Error('AUTHORITY_REQUIRED: You lack authority to publish or change status for this listing');
    }

    const [updated] = await db
      .update(listings)
      .set({ status, updatedAt: new Date() })
      .where(eq(listings.id, listingId))
      .returning();

    return updated;
  }

  /**
   * Notifications
   */
  async getScopedNotifications(user: { id: string }) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationsAsRead(user: { id: string }, notificationIds?: string[]) {
    if (notificationIds && notificationIds.length > 0) {
      return db
        .update(notifications)
        .set({ read: true })
        .where(and(
          eq(notifications.userId, user.id),
          inArray(notifications.id, notificationIds)
        ));
    }

    return db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, user.id));
  }
}

export const ownerRepository = new OwnerRepository();
