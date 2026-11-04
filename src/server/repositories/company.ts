import { db } from '../../db/index.js';
import { 
  properties, 
  ownershipRecords, 
  managementAgreements, 
  organizationMembers,
  companyInvitations,
  units, 
  leases, 
  leaseTenants, 
  rentSchedules, 
  paymentRecords, 
  maintenanceRequests, 
  maintenanceQuotes, 
  workOrders,
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
  commissions
} from '../../db/schema.js';
import { eq, and, or, inArray, desc, sql } from 'drizzle-orm';
import { Permission, UserRole, CompanyRole } from '../../types/index.js';
import { 
  CompanyDashboardData, 
  CompanyProfile, 
  CompanyPropertyItem, 
  CompanyMemberItem, 
  CompanyManagementAgreementItem,
  CompanyTenantItem,
  CompanyLeaseItem,
  CompanyMaintenanceItem,
  CompanyVendorItem,
  CompanyListingItem,
  CompanyFinancialSummary,
  CompanyApprovalItem,
  CompanyReportItem,
  CompanyAIRecommendation,
  ManagementAgreementStatus
} from '../../types/company.js';
import { auditService } from '../services/audit.js';
import { financeService } from '../services/finance.js';
import { CommissionService, OperatingModel } from '../services/commission.js';
import { leaseRepository, validateLeaseDateOrder } from './leases.js';

export class CompanyRepository {
  /**
   * Resolve company membership for a user
   */
  async getCompanyMembership(userId: string, targetCompanyId?: string) {
    if (targetCompanyId) {
      const members = await db.select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, targetCompanyId)
        ))
        .limit(1);
      return members[0] || null;
    }

    const members = await db.select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId))
      .limit(1);
    return members[0] || null;
  }

  /**
   * Resolve active management agreements for a company
   */
  async getActiveAgreements(companyId: string) {
    return await db.select()
      .from(managementAgreements)
      .where(and(
        eq(managementAgreements.companyId, companyId),
        eq(managementAgreements.status, 'ACTIVE')
      ));
  }

  /**
   * Get Company Profile
   */
  async getCompanyProfile(companyId: string): Promise<CompanyProfile | null> {
    const orgs = await db.select()
      .from(organizations)
      .where(eq(organizations.id, companyId))
      .limit(1);

    if (orgs.length === 0) return null;
    const org = orgs[0];

    return {
      id: org.id,
      name: org.name,
      legalName: org.legalName || org.name,
      registrationNumber: org.registrationNumber || undefined,
      taxId: org.taxId || undefined,
      email: org.email || undefined,
      phone: org.phone || undefined,
      address: (org.address as any) || undefined,
      serviceArea: org.serviceArea || undefined,
      serviceCategories: (org.serviceCategories as string[]) || [],
      teamSize: org.teamSize || undefined,
      spendingLimitDefault: org.spendingLimitDefault ? Number(org.spendingLimitDefault) : 500000, // 500,000 IQD default
      status: (org.status as any) || 'PENDING_VERIFICATION',
      verified: Boolean(org.verified),
      createdAt: org.createdAt ? org.createdAt.toISOString() : undefined,
      updatedAt: org.updatedAt ? org.updatedAt.toISOString() : undefined,
    };
  }

  /**
   * Update Company Profile
   */
  async updateCompanyProfile(companyId: string, updates: Partial<CompanyProfile>, actorUserId: string): Promise<CompanyProfile> {
    const payload: any = {
      updatedAt: new Date(),
    };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.legalName !== undefined) payload.legalName = updates.legalName;
    if (updates.registrationNumber !== undefined) payload.registrationNumber = updates.registrationNumber;
    if (updates.taxId !== undefined) payload.taxId = updates.taxId;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.address !== undefined) payload.address = updates.address;
    if (updates.serviceArea !== undefined) payload.serviceArea = updates.serviceArea;
    if (updates.serviceCategories !== undefined) payload.serviceCategories = updates.serviceCategories;
    if (updates.teamSize !== undefined) payload.teamSize = updates.teamSize;
    if (updates.spendingLimitDefault !== undefined) payload.spendingLimitDefault = String(updates.spendingLimitDefault);

    await db.update(organizations)
      .set(payload)
      .where(eq(organizations.id, companyId));

    await auditService.logAction({
      actorUserId,
      actorRole: 'COMPANY_ADMIN',
      action: 'UPDATE_COMPANY_PROFILE',
      resourceType: 'Organization',
      resourceId: companyId,
      changes: updates,
    });

    const refreshed = await this.getCompanyProfile(companyId);
    return refreshed!;
  }

  /**
   * Onboard Company (Initial Setup)
   */
  async onboardCompany(actorUserId: string, data: {
    companyName: string;
    legalName?: string;
    registrationNumber?: string;
    email?: string;
    phone?: string;
    serviceArea?: string;
    teamSize?: string;
  }): Promise<{ company: CompanyProfile; member: any }> {
    // 1. Create or update company organization
    const orgs = await db.insert(organizations).values({
      name: data.companyName,
      legalName: data.legalName || data.companyName,
      type: 'COMPANY',
      registrationNumber: data.registrationNumber || null,
      email: data.email || null,
      phone: data.phone || null,
      serviceArea: data.serviceArea || null,
      teamSize: data.teamSize || '1-5',
      status: 'PENDING_VERIFICATION', // Explicitly truth-based: pending verification
      verified: false,
    }).returning();

    const createdOrg = orgs[0];

    // 2. Add caller as COMPANY_OWNER
    const member = await db.insert(organizationMembers).values({
      organizationId: createdOrg.id,
      userId: actorUserId,
      role: CompanyRole.COMPANY_OWNER,
      status: 'ACTIVE',
    }).returning();

    // 3. Update user roles if not already present
    const userRecs = await db.select().from(users).where(eq(users.id, actorUserId)).limit(1);
    if (userRecs.length > 0) {
      const existingRoles = (userRecs[0].roles as string[]) || [];
      const updatedRoles = Array.from(new Set([...existingRoles, UserRole.COMPANY, UserRole.COMPANY_MEMBER, 'COMPANY_OWNER']));
      await db.update(users).set({ roles: updatedRoles }).where(eq(users.id, actorUserId));
    }

    // 4. Audit
    await auditService.logAction({
      actorUserId,
      actorRole: CompanyRole.COMPANY_OWNER,
      action: 'COMPANY_CREATED',
      resourceType: 'Organization',
      resourceId: createdOrg.id,
      changes: { name: createdOrg.name, status: 'PENDING_VERIFICATION' },
    });

    const profile = await this.getCompanyProfile(createdOrg.id);
    return { company: profile!, member: member[0] };
  }

  /**
   * Get Authoritative Company Dashboard
   */
  async getAuthoritativeDashboard(user: { id: string; organizationId?: string; roles: string[] }): Promise<CompanyDashboardData> {
    const companyId = user.organizationId;
    if (!companyId) {
      throw new Error('Caller is not associated with an organization.');
    }

    const member = await this.getCompanyMembership(user.id, companyId);
    if (!member || member.status !== 'ACTIVE') {
      throw new Error('Caller is not an active member of this organization.');
    }

    // 1. Get profile
    let profile = await this.getCompanyProfile(companyId);
    if (!profile) {
      throw new Error('AUTHORITATIVE_DATA_MISSING: Company profile not found for active organization member.');
    }

    // 2. Get active management agreements (ONLY properties with active agreements are managed)
    const activeAgreements = await this.getActiveAgreements(companyId);
    const managedPropertyIds = activeAgreements.map(a => a.propertyId);

    // 3. Scoped Properties
    const managedProperties = await this.getManagedProperties(companyId, user.id, member.role);

    // 4. Active Tenants count on managed properties
    let activeTenantsCount = 0;
    let monthlyRentTotal = 0;
    if (managedPropertyIds.length > 0) {
      const activeLeases = await db.select()
        .from(leases)
        .where(and(
          inArray(leases.propertyId, managedPropertyIds),
          eq(leases.status, 'ACTIVE')
        ));
      
      const distinctTenants = new Set<string>();
      if (activeLeases.length > 0) {
        const leaseIds = activeLeases.map(l => l.id);
        const lt = await db.select().from(leaseTenants).where(inArray(leaseTenants.leaseId, leaseIds));
        lt.forEach(t => distinctTenants.add(t.tenantId));
        const rate = await financeService.fetchFinancialPolicy('EXCHANGE_RATE_IQD');
        activeLeases.forEach(l => {
          const amt = Number(l.rentAmount || 0);
          monthlyRentTotal += l.currency === 'USD' ? Math.round(amt * rate) : amt;
        });
      }
      activeTenantsCount = distinctTenants.size;
    }

    // 5. Open Maintenance count
    let openMaintenanceCount = 0;
    if (managedPropertyIds.length > 0) {
      const openMaint = await db.select()
        .from(maintenanceRequests)
        .where(and(
          inArray(maintenanceRequests.propertyId, managedPropertyIds),
          inArray(maintenanceRequests.status, ['REPORTED', 'TRIAGED', 'IN_PROGRESS', 'PENDING_QUOTE'])
        ));
      openMaintenanceCount = openMaint.length;
    }

    // 6. Active Listings count
    const companyListings = await db.select()
      .from(listings)
      .where(and(
        eq(listings.publisherCompanyId, companyId),
        eq(listings.status, 'PUBLISHED')
      ));
    const activeListingsCount = companyListings.length;

    // 7. Pending Approvals count (Quotes > spending limit or pending owner/company approval)
    const pendingApprovals = await this.getApprovals(companyId);

    // 8. Financial Summary strictly from authoritative records
    const financialSummary = await this.getFinancials(companyId);

    // 9. Recent Activities from Audit Logs
    const recentLogs = await db.select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(10);
    
    const recentActivities = recentLogs.map(log => ({
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      description: `${log.actorRole}: ${log.action} on ${log.resourceType}`,
      timestamp: log.timestamp ? log.timestamp.toISOString() : new Date().toISOString(),
    }));

    // 10. Urgent Alerts
    const urgentAlerts: { id: string; level: 'INFO' | 'WARNING' | 'ALERT'; title: string; message: string; link?: string }[] = [];
    if (profile.status === 'PENDING_VERIFICATION') {
      urgentAlerts.push({
        id: 'alert_pending_verification',
        level: 'INFO',
        title: 'دۆخی پشتڕاستکردنەوە: چاوەڕوانکراو (Verification Status: Pending)',
        message: 'کۆمپانیاکەت لە دۆخی چاوەڕوانی بەڵگەنامەدایە. پشکنینی ناوخۆیی بەردەوامە. (External KYB integrations deferred; internal review pending).',
      });
    }
    if (pendingApprovals.length > 0) {
      urgentAlerts.push({
        id: 'alert_pending_approvals',
        level: 'WARNING',
        title: `${pendingApprovals.length} پەسەندکردنی چاوەڕوانکراو (Pending Approvals)`,
        message: 'داواکاری دارایی یان چاککردنەوە پێویستی بە بڕیاری بەڕێوەبەر یان خاوەن موڵکە.',
        link: '/workspace/company',
      });
    }

    // 11. AI Recommendations (strictly factual/estimates with human approval required)
    const aiRecommendations = await this.generateAIRecommendations(companyId, managedPropertyIds);

    return {
      company: profile,
      callerMember: {
        userId: user.id,
        role: member.role,
        status: member.status || 'ACTIVE',
      },
      kpis: {
        managedProperties: managedProperties.length,
        activeTenants: activeTenantsCount,
        monthlyRentManagedIqd: monthlyRentTotal,
        openMaintenance: openMaintenanceCount,
        activeListings: activeListingsCount,
        pendingApprovals: pendingApprovals.length,
      },
      managedProperties,
      urgentAlerts,
      recentActivities,
      pendingApprovals,
      financialSummary,
      aiRecommendations,
    };
  }

  /**
   * Get Managed Properties strictly scoped by active management agreements
   */
  async getManagedProperties(companyId: string, userId?: string, memberRole?: string): Promise<CompanyPropertyItem[]> {
    const activeAgreements = await db.select()
      .from(managementAgreements)
      .where(and(
        eq(managementAgreements.companyId, companyId),
        eq(managementAgreements.status, 'ACTIVE')
      ));

    if (activeAgreements.length === 0) return [];

    const propertyIds = activeAgreements.map(a => a.propertyId);
    
    // Check if member is property-scoped
    let allowedPropertyIds = propertyIds;
    if (userId) {
      const member = await this.getCompanyMembership(userId, companyId);
      if (member && member.assignedPropertyIds && (member.assignedPropertyIds as string[]).length > 0) {
        if (memberRole !== CompanyRole.COMPANY_OWNER && memberRole !== CompanyRole.COMPANY_ADMIN) {
          allowedPropertyIds = propertyIds.filter(id => (member.assignedPropertyIds as string[]).includes(id));
        }
      }
    }

    if (allowedPropertyIds.length === 0) return [];

    const propRecords = await db.select()
      .from(properties)
      .where(inArray(properties.id, allowedPropertyIds));

    const owners = await db.select().from(users);
    const ownerMap = new Map<string, any>(owners.map(u => [u.id, u]));

    const agreementMap = new Map<string, any>(activeAgreements.map(a => [a.propertyId, a]));

    const result: CompanyPropertyItem[] = [];

    // Bulk load to eliminate N+1
    const allUnits = await db.select().from(units).where(inArray(units.propertyId, allowedPropertyIds));
    const allLeases = await db.select().from(leases).where(and(
      inArray(leases.propertyId, allowedPropertyIds),
      eq(leases.status, 'ACTIVE')
    ));
    const allMaint = await db.select().from(maintenanceRequests).where(and(
      inArray(maintenanceRequests.propertyId, allowedPropertyIds),
      inArray(maintenanceRequests.status, ['REPORTED', 'TRIAGED', 'IN_PROGRESS'])
    ));

    for (const prop of propRecords) {
      const agreement = agreementMap.get(prop.id);
      const owner = agreement ? ownerMap.get(agreement.ownerId) : null;

      // Filter bulk arrays for this property
      const propUnits = allUnits.filter(u => u.propertyId === prop.id);
      const propLeases = allLeases.filter(l => l.propertyId === prop.id);
      const propMaint = allMaint.filter(m => m.propertyId === prop.id);

      // Authoritative occupancy derived from ACTIVE leases, not static unit.status
      let occupiedUnitsCount = 0;
      if (propUnits.length === 0) {
        // Single unit property
        occupiedUnitsCount = propLeases.length > 0 ? 1 : 0;
      } else {
        // Multi-unit property: count unique units with active leases
        const occupiedUnitIds = new Set(propLeases.filter(l => l.unitId).map(l => l.unitId));
        occupiedUnitsCount = occupiedUnitIds.size;
      }

      let monthlyRent = 0;
      propLeases.forEach(l => {
        monthlyRent += Number(l.rentAmount || 0);
      });

      result.push({
        id: prop.id,
        name: prop.name,
        nameKurdish: prop.name,
        type: prop.type,
        status: prop.status || 'ACTIVE',
        address: prop.address,
        ownerId: agreement ? agreement.ownerId : '',
        ownerName: owner ? `${owner.firstName} ${owner.lastName}` : 'خاوەن موڵک (Property Owner)',
        ownerPhone: owner ? owner.phone || undefined : undefined,
        ownerEmail: owner ? owner.email : undefined,
        managementAgreementId: agreement ? agreement.id : '',
        managementAgreementStatus: agreement ? agreement.status : 'ACTIVE',
        grantedPermissions: agreement ? (agreement.grantedPermissions as string[]) : [],
        spendingLimit: agreement && agreement.spendingLimit ? Number(agreement.spendingLimit) : 500000,
        managementFee: prop.managementFee ? Number(prop.managementFee) : undefined,
        unitsCount: propUnits.length,
        occupiedUnitsCount: occupiedUnitsCount,
        activeLeasesCount: propLeases.length,
        openMaintenanceCount: propMaint.length,
        monthlyRentIqd: monthlyRent,
        isOwner: false, // CRITICAL: Company managing a property NEVER becomes owner
      });
    }

    return result;
  }

  /**
   * Get Single Property Detail with Authorization Verification
   */
  async getPropertyDetail(propertyId: string, companyId: string, userId: string, memberRole: string) {
    // 1. Verify active management agreement
    const agreements = await db.select()
      .from(managementAgreements)
      .where(and(
        eq(managementAgreements.companyId, companyId),
        eq(managementAgreements.propertyId, propertyId),
        eq(managementAgreements.status, 'ACTIVE')
      ))
      .limit(1);

    if (agreements.length === 0) {
      throw new Error('AUTHORITY_REQUIRED: No active management agreement exists for this property and company.');
    }

    const agreement = agreements[0];

    // 2. Member property-scope check
    const member = await this.getCompanyMembership(userId, companyId);
    if (member && member.assignedPropertyIds && (member.assignedPropertyIds as string[]).length > 0) {
      if (memberRole !== CompanyRole.COMPANY_OWNER && memberRole !== CompanyRole.COMPANY_ADMIN) {
        if (!(member.assignedPropertyIds as string[]).includes(propertyId)) {
          throw new Error('PROPERTY_SCOPE_DENIED: Member is not assigned to this property.');
        }
      }
    }

    // 3. Retrieve details
    const prop = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
    if (prop.length === 0) throw new Error('Property not found');

    const propUnits = await db.select().from(units).where(eq(units.propertyId, propertyId));
    const propLeases = await db.select().from(leases).where(eq(leases.propertyId, propertyId));
    const propMaint = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.propertyId, propertyId));
    const propDocs = await db.select().from(documents).where(eq(documents.propertyId, propertyId));
    const propListings = await db.select().from(listings).where(eq(listings.propertyId, propertyId));
    const propOwnership = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, propertyId));

    const ownerUser = await db.select().from(users).where(eq(users.id, agreement.ownerId)).limit(1);

    return {
      property: prop[0],
      agreement: {
        id: agreement.id,
        status: agreement.status,
        startDate: agreement.startDate,
        endDate: agreement.endDate,
        grantedPermissions: agreement.grantedPermissions,
        spendingLimit: agreement.spendingLimit,
        approvalRules: agreement.approvalRules,
      },
      owner: ownerUser[0] ? {
        id: ownerUser[0].id,
        name: `${ownerUser[0].firstName} ${ownerUser[0].lastName}`,
        email: ownerUser[0].email,
        phone: ownerUser[0].phone,
      } : null,
      ownershipRecords: propOwnership,
      units: propUnits,
      leases: propLeases,
      maintenanceRequests: propMaint,
      documents: propDocs,
      listings: propListings,
      isOwner: false,
    };
  }

  /**
   * Get Company Members
   */
  async getCompanyMembers(companyId: string): Promise<CompanyMemberItem[]> {
    const memberRows = await db.select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      status: organizationMembers.status,
      assignedPropertyIds: organizationMembers.assignedPropertyIds,
      createdAt: organizationMembers.createdAt,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, companyId));

    return memberRows.map(m => ({
      id: m.id,
      userId: m.userId,
      name: `${m.userFirstName} ${m.userLastName}`,
      email: m.userEmail,
      role: m.role,
      status: (m.status as any) || 'ACTIVE',
      assignedPropertyIds: (m.assignedPropertyIds as string[]) || [],
      createdAt: m.createdAt ? m.createdAt.toISOString() : undefined,
    }));
  }

  /**
   * Invite Company Member
   */
  async inviteMember(companyId: string, invitedByUserId: string, email: string, role: string, assignedPropertyIds?: string[]): Promise<any> {
    const invitation = await db.insert(companyInvitations).values({
      companyId,
      invitedByUserId,
      email,
      role,
      assignedPropertyIds: assignedPropertyIds || [],
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }).returning();

    await auditService.logAction({
      actorUserId: invitedByUserId,
      actorRole: 'COMPANY_ADMIN',
      action: 'MEMBER_INVITED',
      resourceType: 'CompanyInvitation',
      resourceId: invitation[0].id,
      changes: { email, role, assignedPropertyIds },
    });

    return invitation[0];
  }

  /**
   * Update Member Role
   * Atomically changes assigned role and invalidates active user sessions
   */
  async updateMemberRole(companyId: string, memberId: string, newRole: string, actorUserId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Authoritatively resolve the target member record
      const [member] = await tx.select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.id, memberId),
        eq(organizationMembers.organizationId, companyId)
      ))
      .limit(1);

      if (!member) {
        throw new Error('MEMBER_NOT_FOUND: Organization member not found.');
      }

      // 2. Update member role atomically
      await tx.update(organizationMembers)
        .set({ role: newRole, updatedAt: new Date() })
        .where(eq(organizationMembers.id, member.id));

      // 3. Atomically invalidate active sessions for the affected user
      await tx.update(users)
        .set({
          tokenVersion: sql`COALESCE(token_version, 1) + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, member.userId));

      // 4. Audit log within transaction
      await auditService.logAction({
        actorUserId,
        actorRole: 'COMPANY_ADMIN',
        action: 'MEMBER_ROLE_CHANGED',
        resourceType: 'OrganizationMember',
        resourceId: memberId,
        changes: { previousRole: member.role, newRole, affectedUserId: member.userId },
      });
    });
  }

  /**
   * Update Member Status (ACTIVE / SUSPENDED / REMOVED)
   * Atomically updates status and invalidates active user sessions
   */
  async updateMemberStatus(companyId: string, memberId: string, newStatus: 'ACTIVE' | 'SUSPENDED' | 'REMOVED', actorUserId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Authoritatively resolve the target member record
      const [member] = await tx.select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        status: organizationMembers.status,
      })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.id, memberId),
        eq(organizationMembers.organizationId, companyId)
      ))
      .limit(1);

      if (!member) {
        throw new Error('MEMBER_NOT_FOUND: Organization member not found.');
      }

      // 2. Update member status atomically
      await tx.update(organizationMembers)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(organizationMembers.id, member.id));

      // 3. Atomically invalidate active sessions for the affected user
      await tx.update(users)
        .set({
          tokenVersion: sql`COALESCE(token_version, 1) + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, member.userId));

      // 4. Audit log within transaction
      await auditService.logAction({
        actorUserId,
        actorRole: 'COMPANY_ADMIN',
        action: newStatus === 'SUSPENDED' ? 'MEMBER_SUSPENDED' : newStatus === 'REMOVED' ? 'MEMBER_REMOVED' : 'MEMBER_REACTIVATED',
        resourceType: 'OrganizationMember',
        resourceId: memberId,
        changes: { previousStatus: member.status, newStatus, affectedUserId: member.userId },
      });
    });
  }

  /**
   * Remove Member (Soft Removal & Session Invalidation)
   */
  async removeMember(companyId: string, memberId: string, actorUserId: string): Promise<void> {
    return this.updateMemberStatus(companyId, memberId, 'REMOVED', actorUserId);
  }

  /**
   * Get Management Agreements
   */
  async getManagementAgreements(companyId: string): Promise<CompanyManagementAgreementItem[]> {
    const agreements = await db.select({
      id: managementAgreements.id,
      propertyId: managementAgreements.propertyId,
      companyId: managementAgreements.companyId,
      ownerId: managementAgreements.ownerId,
      status: managementAgreements.status,
      startDate: managementAgreements.startDate,
      endDate: managementAgreements.endDate,
      grantedPermissions: managementAgreements.grantedPermissions,
      spendingLimit: managementAgreements.spendingLimit,
      approvalRules: managementAgreements.approvalRules,
      createdAt: managementAgreements.createdAt,
      propertyName: properties.name,
      propertyType: properties.type,
      ownerFirstName: users.firstName,
      ownerLastName: users.lastName,
      ownerEmail: users.email,
      ownerPhone: users.phone,
    })
    .from(managementAgreements)
    .innerJoin(properties, eq(managementAgreements.propertyId, properties.id))
    .innerJoin(users, eq(managementAgreements.ownerId, users.id))
    .where(eq(managementAgreements.companyId, companyId));

    const companyOrg = await this.getCompanyProfile(companyId);

    return agreements.map(a => ({
      id: a.id,
      propertyId: a.propertyId,
      propertyName: a.propertyName,
      propertyType: a.propertyType,
      ownerId: a.ownerId,
      ownerName: `${a.ownerFirstName} ${a.ownerLastName}`,
      ownerEmail: a.ownerEmail,
      ownerPhone: a.ownerPhone || undefined,
      companyId: a.companyId,
      companyName: companyOrg ? companyOrg.name : 'Company',
      status: (a.status as any) || 'PENDING',
      startDate: a.startDate,
      endDate: a.endDate || undefined,
      grantedPermissions: (a.grantedPermissions as string[]) || [],
      spendingLimit: a.spendingLimit ? Number(a.spendingLimit) : 500000,
      approvalRules: a.approvalRules || undefined,
      createdAt: a.createdAt ? a.createdAt.toISOString() : undefined,
    }));
  }

  /**
   * Respond to Management Agreement (ACCEPT or DECLINE)
   */
  async respondToManagementAgreement(companyId: string, agreementId: string, action: 'ACCEPT' | 'DECLINE', actorUserId: string) {
    const agRows = await db.select()
      .from(managementAgreements)
      .where(and(
        eq(managementAgreements.id, agreementId),
        eq(managementAgreements.companyId, companyId)
      ))
      .limit(1);

    if (agRows.length === 0) {
      throw new Error('Management agreement not found or not assigned to this company.');
    }

    const ag = agRows[0];
    if (ag.status !== 'PENDING') {
      throw new Error(`Cannot respond to agreement in status: ${ag.status}`);
    }

    const newStatus: ManagementAgreementStatus = action === 'ACCEPT' ? 'ACTIVE' : 'REVOKED';

    await db.update(managementAgreements)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(managementAgreements.id, agreementId));

    await auditService.logAction({
      actorUserId,
      actorRole: 'COMPANY_ADMIN',
      action: action === 'ACCEPT' ? 'MANAGEMENT_AGREEMENT_ACCEPTED' : 'MANAGEMENT_AGREEMENT_REVOKED',
      resourceType: 'ManagementAgreement',
      resourceId: agreementId,
      changes: { newStatus, previousStatus: ag.status },
    });

    return { id: agreementId, status: newStatus };
  }

  /**
   * Get Tenants on authorized properties
   */
  async getTenants(companyId: string, userId: string, memberRole: string): Promise<CompanyTenantItem[]> {
    const managedProps = await this.getManagedProperties(companyId, userId, memberRole);
    if (managedProps.length === 0) return [];

    const propIds = managedProps.map(p => p.id);
    const propMap = new Map(managedProps.map(p => [p.id, p]));

    const activeLeases = await db.select()
      .from(leases)
      .where(and(
        inArray(leases.propertyId, propIds),
        eq(leases.status, 'ACTIVE')
      ));

    if (activeLeases.length === 0) return [];

    const leaseIds = activeLeases.map(l => l.id);
    const leaseMap = new Map(activeLeases.map(l => [l.id, l]));

    const lts = await db.select().from(leaseTenants).where(inArray(leaseTenants.leaseId, leaseIds));
    if (lts.length === 0) return [];

    const tenantUserIds = lts.map(t => t.tenantId);
    const tenantUsers = await db.select().from(users).where(inArray(users.id, tenantUserIds));
    const tenantUserMap = new Map(tenantUsers.map(u => [u.id, u]));

    const result: CompanyTenantItem[] = [];
    for (const lt of lts) {
      const lease = leaseMap.get(lt.leaseId);
      if (!lease) continue;
      const prop = propMap.get(lease.propertyId);
      const user = tenantUserMap.get(lt.tenantId);
      if (!user) continue;

      result.push({
        id: lt.id,
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone || undefined,
        propertyId: lease.propertyId,
        propertyName: prop ? prop.name : 'Property',
        unitNumber: lease.unitId || undefined,
        leaseId: lease.id,
        leaseStatus: lease.status,
        rentAmount: Number(lease.rentAmount || 0),
        rentStatus: 'UPCOMING',
        currency: lease.currency || 'USD',
      });
    }

    return result;
  }

  /**
   * Get Leases on authorized properties
   */
  async getLeases(companyId: string, userId: string, memberRole: string): Promise<CompanyLeaseItem[]> {
    const managedProps = await this.getManagedProperties(companyId, userId, memberRole);
    if (managedProps.length === 0) return [];

    const propIds = managedProps.map(p => p.id);
    const propMap = new Map(managedProps.map(p => [p.id, p]));

    const leaseRows = await db.select()
      .from(leases)
      .where(inArray(leases.propertyId, propIds));

    const result: CompanyLeaseItem[] = [];
    for (const l of leaseRows) {
      const prop = propMap.get(l.propertyId);
      const lts = await db.select().from(leaseTenants).where(eq(leaseTenants.leaseId, l.id)).limit(1);
      let tenantName = 'کرێچی (Tenant)';
      let tenantId = '';
      if (lts.length > 0) {
        tenantId = lts[0].tenantId;
        const u = await db.select().from(users).where(eq(users.id, tenantId)).limit(1);
        if (u.length > 0) {
          tenantName = `${u[0].firstName} ${u[0].lastName}`;
        }
      }

      result.push({
        id: l.id,
        propertyId: l.propertyId,
        propertyName: prop ? prop.name : 'Property',
        unitId: l.unitId || undefined,
        unitNumber: l.unitId || undefined,
        tenantId,
        tenantName,
        startDate: l.startDate,
        endDate: l.endDate,
        rentAmount: Number(l.rentAmount || 0),
        currency: l.currency || 'USD',
        depositAmount: l.depositAmount ? Number(l.depositAmount) : undefined,
        status: l.status,
        approvalRequired: true,
        isOwnerApproved: l.status === 'ACTIVE',
      });
    }

    return result;
  }

  /**
   * Create Lease Draft
   */
  async createLeaseDraft(companyId: string, userId: string, leaseData: {
    propertyId: string;
    unitId?: string;
    tenantId: string;
    startDate: string;
    endDate: string;
    rentAmount: number;
    currency?: string;
    depositAmount?: number;
  }): Promise<any> {
    // 1. Verify property is under active agreement granting MANAGE_LEASES
    const agreements = await db.select()
      .from(managementAgreements)
      .where(and(
        eq(managementAgreements.companyId, companyId),
        eq(managementAgreements.propertyId, leaseData.propertyId),
        eq(managementAgreements.status, 'ACTIVE')
      ))
      .limit(1);

    if (agreements.length === 0) {
      throw new Error('AUTHORITY_REQUIRED: No active management agreement exists for this property.');
    }

    const perms = (agreements[0].grantedPermissions as string[]) || [];
    if (!perms.includes(Permission.MANAGE_LEASES)) {
      throw new Error('PERMISSION_DENIED: Management agreement does not grant lease management authority.');
    }

    if (!leaseData.tenantId || typeof leaseData.tenantId !== 'string' || !leaseData.tenantId.trim()) {
      throw new Error('VALIDATION_ERROR: tenantId is required and must be a non-empty string.');
    }

    validateLeaseDateOrder(leaseData.startDate, leaseData.endDate);

    const numRent = Number(leaseData.rentAmount);
    if (isNaN(numRent) || numRent <= 0) {
      throw new Error('VALIDATION_ERROR: Rent amount must be a valid positive number.');
    }

    // 2. Transact: Lock parent property, validate unit, enforce overlap invariant, and insert
    const createdLease = await db.transaction(async (tx) => {
      // Shared parent-property row lock, unit validation, and physical-space overlap invariant
      await leaseRepository.assertNoPhysicalSpaceOverlap(tx, {
        propertyId: leaseData.propertyId,
        unitId: leaseData.unitId || null,
        startDate: leaseData.startDate,
        endDate: leaseData.endDate,
      });

      // Unified tenant role, existence, approved application, and duplicate lease invariants
      const { primaryApplicationId } = await leaseRepository.assertTenantAndApplicationInvariants(tx, {
        propertyId: leaseData.propertyId,
        unitId: leaseData.unitId || null,
        tenantIds: [leaseData.tenantId.trim()],
        startDate: leaseData.startDate,
        endDate: leaseData.endDate,
      });

      const [targetProperty] = await tx.select().from(properties).where(eq(properties.id, leaseData.propertyId)).limit(1);
      const effectiveCurrency = leaseData.currency || targetProperty?.currency || 'USD';
      if (!['IQD', 'USD'].includes(effectiveCurrency)) {
        throw new Error(`VALIDATION_ERROR: Unsupported currency '${effectiveCurrency}'. Must be IQD or USD.`);
      }

      try {
        // Insert lease as PENDING_APPROVAL (requires owner approval before activation)
        const newLeases = await tx.insert(leases).values({
          propertyId: leaseData.propertyId,
          unitId: leaseData.unitId || null,
          status: 'PENDING_APPROVAL',
          startDate: leaseData.startDate,
          endDate: leaseData.endDate,
          rentAmount: String(numRent),
          currency: effectiveCurrency,
          depositAmount: leaseData.depositAmount ? String(leaseData.depositAmount) : null,
          rentCycle: 'MONTHLY',
          rentalApplicationId: primaryApplicationId,
        }).returning();

        const lease = newLeases[0];

        // 3. Attach tenant
        await tx.insert(leaseTenants).values({
          leaseId: lease.id,
          tenantId: leaseData.tenantId.trim(),
          isPrimary: true,
        });

        return lease;
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

    // 4. Audit
    await auditService.logAction({
      actorUserId: userId,
      actorRole: 'PROPERTY_MANAGER',
      action: 'LEASE_CREATED',
      resourceType: 'Lease',
      resourceId: createdLease.id,
      changes: { propertyId: leaseData.propertyId, status: 'PENDING_APPROVAL', rentAmount: leaseData.rentAmount },
    });

    return createdLease;
  }

  /**
   * Get Maintenance Requests on authorized properties
   */
  async getMaintenance(companyId: string, userId: string, memberRole: string): Promise<CompanyMaintenanceItem[]> {
    const managedProps = await this.getManagedProperties(companyId, userId, memberRole);
    if (managedProps.length === 0) return [];

    const propIds = managedProps.map(p => p.id);
    const propMap = new Map(managedProps.map(p => [p.id, p]));

    const reqs = await db.select()
      .from(maintenanceRequests)
      .where(inArray(maintenanceRequests.propertyId, propIds))
      .orderBy(desc(maintenanceRequests.createdAt));

    const vendorsList = await db.select().from(organizations);
    const vendorMap = new Map(vendorsList.map(v => [v.id, v.name]));

    const usersList = await db.select().from(users);
    const userMap = new Map(usersList.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

    const result: CompanyMaintenanceItem[] = [];
    for (const r of reqs) {
      const prop = propMap.get(r.propertyId);
      const quotes = await db.select().from(maintenanceQuotes).where(eq(maintenanceQuotes.maintenanceRequestId, r.id));

      result.push({
        id: r.id,
        propertyId: r.propertyId,
        propertyName: prop ? prop.name : 'Property',
        unitId: r.unitId || undefined,
        category: r.category,
        priority: (r.priority as any) || 'NORMAL',
        status: r.status || 'REPORTED',
        title: r.title,
        description: r.description,
        reportedBy: userMap.get(r.reporterUserId) || 'Tenant',
        assignedVendorName: r.assignedVendorId ? vendorMap.get(r.assignedVendorId) : undefined,
        budget: r.budget ? Number(r.budget) : undefined,
        quotesCount: quotes.length,
        createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
      });
    }

    return result;
  }

  /**
   * Create Maintenance Request
   */
  async createMaintenanceRequest(companyId: string, userId: string, data: {
    propertyId: string;
    unitId?: string;
    category: string;
    priority: string;
    title: string;
    description: string;
    budget?: number;
  }): Promise<any> {
    const agreements = await db.select()
      .from(managementAgreements)
      .where(and(
        eq(managementAgreements.companyId, companyId),
        eq(managementAgreements.propertyId, data.propertyId),
        eq(managementAgreements.status, 'ACTIVE')
      ))
      .limit(1);

    if (agreements.length === 0) {
      throw new Error('AUTHORITY_REQUIRED: No active management agreement exists for this property.');
    }

    const perms = (agreements[0].grantedPermissions as string[]) || [];
    if (!perms.includes(Permission.CREATE_MAINTENANCE) && !perms.includes(Permission.MANAGE_MAINTENANCE)) {
      throw new Error('PERMISSION_DENIED: Agreement does not grant maintenance authority.');
    }

    const newReqs = await db.insert(maintenanceRequests).values({
      propertyId: data.propertyId,
      unitId: data.unitId || null,
      reporterUserId: userId,
      category: data.category,
      priority: data.priority,
      status: 'REPORTED',
      title: data.title,
      description: data.description,
      budget: data.budget ? String(data.budget) : null,
    }).returning();

    await auditService.logAction({
      actorUserId: userId,
      actorRole: 'MAINTENANCE_MANAGER',
      action: 'MAINTENANCE_CREATED',
      resourceType: 'MaintenanceRequest',
      resourceId: newReqs[0].id,
      changes: { propertyId: data.propertyId, title: data.title, priority: data.priority },
    });

    return newReqs[0];
  }

  /**
   * Approve Maintenance Quote with spending limit check
   */
  async approveMaintenanceQuote(companyId: string, quoteId: string, actorUserId: string) {
    const quoteRows = await db.select().from(maintenanceQuotes).where(eq(maintenanceQuotes.id, quoteId)).limit(1);
    if (quoteRows.length === 0) throw new Error('Quote not found.');
    const quote = quoteRows[0];

    // Verify active agreement
    const agreements = await db.select()
      .from(managementAgreements)
      .where(and(
        eq(managementAgreements.companyId, companyId),
        eq(managementAgreements.propertyId, quote.propertyId),
        eq(managementAgreements.status, 'ACTIVE')
      ))
      .limit(1);

    if (agreements.length === 0) {
      throw new Error('AUTHORITY_REQUIRED: No active management agreement for property.');
    }

    const agreement = agreements[0];
    const spendingLimit = agreement.spendingLimit ? Number(agreement.spendingLimit) : 500000;
    const quoteAmount = Number(quote.totalAmount || 0);

    // CRITICAL SPENDING LIMIT & APPROVAL RULE:
    // If quote exceeds configured threshold, Company cannot approve alone; must be escalated to Owner
    if (quoteAmount > spendingLimit) {
      return {
        quoteId,
        approved: false,
        requiresOwnerApproval: true,
        spendingLimit,
        quoteAmount,
        message: `Quote amount (${quoteAmount} IQD) exceeds company spending limit (${spendingLimit} IQD). Explicit owner approval required.`,
      };
    }

    // Within limit -> approve
    await db.update(maintenanceQuotes)
      .set({ status: 'APPROVED' })
      .where(eq(maintenanceQuotes.id, quoteId));

    // Create work order
    const wo = await db.insert(workOrders).values({
      maintenanceRequestId: quote.maintenanceRequestId,
      quoteId: quote.id,
      vendorId: quote.vendorId,
      propertyId: quote.propertyId,
      status: 'SCHEDULED',
      scopeOfWork: quote.notes || 'Approved maintenance work order.',
    }).returning();

    await auditService.logAction({
      actorUserId,
      actorRole: 'MAINTENANCE_MANAGER',
      action: 'QUOTE_APPROVED',
      resourceType: 'MaintenanceQuote',
      resourceId: quoteId,
      changes: { status: 'APPROVED', workOrderId: wo[0].id, quoteAmount },
    });

    return {
      quoteId,
      approved: true,
      requiresOwnerApproval: false,
      workOrder: wo[0],
    };
  }

  /**
   * Get Listings published or managed by this company
   */
  async getListings(companyId: string): Promise<CompanyListingItem[]> {
    const listRows = await db.select({
      id: listings.id,
      propertyId: listings.propertyId,
      type: listings.type,
      price: listings.price,
      currency: listings.currency,
      status: listings.status,
      title: listings.title,
      description: listings.description,
      createdAt: listings.createdAt,
      propertyName: properties.name,
    })
    .from(listings)
    .innerJoin(properties, eq(listings.propertyId, properties.id))
    .where(eq(listings.publisherCompanyId, companyId));

    return listRows.map(l => ({
      id: l.id,
      propertyId: l.propertyId,
      propertyName: l.propertyName,
      type: (l.type as any) || 'FOR_RENT',
      price: Number(l.price || 0),
      currency: l.currency || 'USD',
      status: (l.status as any) || 'DRAFT',
      title: l.title,
      description: l.description || undefined,
      listingAuthorityGranted: true,
      createdAt: l.createdAt ? l.createdAt.toISOString() : new Date().toISOString(),
    }));
  }

  /**
   * Create Listing with strict listing authority check
   */
  async createListing(companyId: string, userId: string, data: {
    propertyId: string;
    type: 'FOR_RENT' | 'FOR_SALE';
    price: number;
    currency?: string;
    title: string;
    description?: string;
    publishImmediately?: boolean;
  }): Promise<any> {
    const agreements = await db.select()
      .from(managementAgreements)
      .where(and(
        eq(managementAgreements.companyId, companyId),
        eq(managementAgreements.propertyId, data.propertyId),
        eq(managementAgreements.status, 'ACTIVE')
      ))
      .limit(1);

    if (agreements.length === 0) {
      throw new Error('AUTHORITY_REQUIRED: No active management agreement for this property.');
    }

    const perms = (agreements[0].grantedPermissions as string[]) || [];
    if (!perms.includes(Permission.CREATE_LISTING)) {
      throw new Error('LISTING_AUTHORITY_REQUIRED: Active agreement does not grant listing creation authority.');
    }

    let initialStatus = 'DRAFT';
    if (data.publishImmediately) {
      if (!perms.includes(Permission.PUBLISH_LISTING)) {
        throw new Error('PUBLISH_AUTHORITY_REQUIRED: Agreement permits drafting listings but NOT publishing directly without owner review.');
      }
      initialStatus = 'PUBLISHED';
    }

    const newListing = await db.insert(listings).values({
      propertyId: data.propertyId,
      publisherUserId: userId,
      publisherCompanyId: companyId,
      type: data.type,
      price: String(data.price),
      currency: data.currency || 'USD',
      status: initialStatus,
      title: data.title,
      description: data.description || null,
    }).returning();

    await auditService.logAction({
      actorUserId: userId,
      actorRole: 'AGENT',
      action: initialStatus === 'PUBLISHED' ? 'LISTING_PUBLISHED' : 'LISTING_CREATED',
      resourceType: 'Listing',
      resourceId: newListing[0].id,
      changes: { propertyId: data.propertyId, status: initialStatus, price: data.price },
    });

    return newListing[0];
  }

  /**
   * Get Authoritative Financial Summary (Double-Entry Ledger + Payment Records)
   */
  async getFinancials(companyId: string): Promise<CompanyFinancialSummary> {
    const activeAgreements = await this.getActiveAgreements(companyId);
    const propIds = activeAgreements.map(a => a.propertyId);

    if (propIds.length === 0) {
      return {
        rentManagedTotalIqd: 0,
        collectedRentIqd: 0,
        pendingRentIqd: 0,
        commissionsEarnedIqd: 0,
        expensesApprovedIqd: 0,
        platformCommissionIqd: 0,
        rentFeeIqd: 0,
        ownerSettlementPayableIqd: 0,
        sourceOfTruth: 'POSTGRESQL_DOUBLE_ENTRY_LEDGER',
        propertiesCount: 0,
        reconciliationStatus: 'NO_DATA',
        currency: 'IQD',
      };
    }

    // 1. Authoritative Payment Records (Strictly CONFIRMED payments)
    const payments = await db.select()
      .from(paymentRecords)
      .where(and(
        inArray(paymentRecords.propertyId, propIds),
        eq(paymentRecords.status, 'CONFIRMED')
      ));

    let exchangeRateIqd = 1310;
    try {
      exchangeRateIqd = await financeService.fetchFinancialPolicy('EXCHANGE_RATE_IQD');
    } catch {
      exchangeRateIqd = 1310;
    }

    let defaultPlatformFeeRate = 0.03;
    try {
      defaultPlatformFeeRate = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');
    } catch {
      defaultPlatformFeeRate = 0.03;
    }

    let collectedRent = 0;
    payments.forEach(p => {
      const amt = Number(p.amount || 0);
      collectedRent += p.currency === 'USD' ? Math.round(amt * exchangeRateIqd) : amt;
    });

    // 2. Authoritative Rent Schedules
    const schedules = await db.select()
      .from(rentSchedules)
      .where(and(
        inArray(rentSchedules.propertyId, propIds),
        inArray(rentSchedules.status, ['UPCOMING', 'DUE', 'OVERDUE'])
      ));

    let pendingRent = 0;
    schedules.forEach(s => {
      const amt = Number(s.amount || 0);
      pendingRent += s.currency === 'USD' ? Math.round(amt * exchangeRateIqd) : amt;
    });

    // 3. Authoritative derivation from Double-Entry Ledger and Posted Commission records
    const paymentIds = payments.map(p => p.id);
    const postedCommissions = paymentIds.length > 0
      ? await db.select()
          .from(commissions)
          .where(and(
            inArray(commissions.paymentRecordId, paymentIds),
            eq(commissions.status, 'POSTED')
          ))
      : [];

    const commissionMap = new Map(postedCommissions.map(c => [c.paymentRecordId, c]));
    const jeIds = postedCommissions.map(c => c.journalEntryId).filter(Boolean) as string[];
    const lines = jeIds.length > 0
      ? await db.select().from(ledgerLines).where(inArray(ledgerLines.journalEntryId, jeIds))
      : [];

    const linesByJe = new Map<string, typeof lines>();
    for (const l of lines) {
      if (!l.journalEntryId) continue;
      const arr = linesByJe.get(l.journalEntryId) || [];
      arr.push(l);
      linesByJe.set(l.journalEntryId, arr);
    }

    const propsList = await db.select().from(properties).where(inArray(properties.id, propIds));
    const propMap = new Map(propsList.map(p => [p.id, p]));

    let platformCommissionIqd = 0;
    let rentFeeIqd = 0;
    let commissionsEarnedIqd = 0;
    let totalOwnerNetEntitlementIqd = 0;
    let allLedgerBalanced = true;
    let hasAnyLedgerBreakdown = false;
    let hasUnpostedPayments = false;
    let usdPaymentCount = 0;

    for (const p of payments) {
      if (p.currency === 'USD') {
        usdPaymentCount++;
      }
      const comm = commissionMap.get(p.id);
      const jeLines = comm?.journalEntryId ? linesByJe.get(comm.journalEntryId) : undefined;

      if (jeLines && jeLines.length > 0) {
        hasAnyLedgerBreakdown = true;
        let pDebit = 0;
        let pCredit = 0;
        let pPlatform = 0;
        let pRentFee = 0;
        let pMgmt = 0;
        let pOwnerNet = 0;

        for (const l of jeLines) {
          const debit = Number(l.debit || 0);
          const credit = Number(l.credit || 0);
          pDebit += debit;
          pCredit += credit;

          if (l.accountId === '4010') pPlatform += credit;
          if (l.accountId === '4011') pRentFee += credit;
          if (l.accountId === '4012') pMgmt += credit;
          if (l.accountId === '2010') pOwnerNet += credit;
        }

        if (Math.abs(pDebit - pCredit) > 0.01) {
          allLedgerBalanced = false;
        }

        if (p.currency === 'USD') {
          platformCommissionIqd += Math.round(pPlatform * exchangeRateIqd);
          rentFeeIqd += Math.round(pRentFee * exchangeRateIqd);
          commissionsEarnedIqd += Math.round(pMgmt * exchangeRateIqd);
          totalOwnerNetEntitlementIqd += Math.round(pOwnerNet * exchangeRateIqd);
        } else {
          platformCommissionIqd += Math.round(pPlatform);
          rentFeeIqd += Math.round(pRentFee);
          commissionsEarnedIqd += Math.round(pMgmt);
          totalOwnerNetEntitlementIqd += Math.round(pOwnerNet);
        }
      } else {
        // Fallback if payment was confirmed without posted commission/ledger
        hasUnpostedPayments = true;
        const prop = propMap.get(p.propertyId);
        const operatingModel = (prop?.operatingModel as OperatingModel) || 'FULLY_MANAGED';
        const rentFeeRate = prop?.rentFee ? parseFloat(prop.rentFee) : null;
        const mgmtFeeRate = prop?.managementFee ? parseFloat(prop.managementFee) : null;
        const pAmt = Number(p.amount || 0);
        const feeRateToUse = comm?.rate ? parseFloat(comm.rate) : defaultPlatformFeeRate;

        const calc = CommissionService.calculateFeesSync(
          pAmt,
          feeRateToUse,
          operatingModel,
          rentFeeRate,
          mgmtFeeRate,
          p.currency || 'IQD'
        );

        if (p.currency === 'USD') {
          platformCommissionIqd += Math.round(calc.platformFeeAmount * exchangeRateIqd);
          rentFeeIqd += Math.round(calc.rentFeeAmount * exchangeRateIqd);
          commissionsEarnedIqd += Math.round(calc.managementFeeAmount * exchangeRateIqd);
          totalOwnerNetEntitlementIqd += Math.round(calc.ownerNetAmount * exchangeRateIqd);
        } else {
          platformCommissionIqd += calc.platformFeeAmount;
          rentFeeIqd += calc.rentFeeAmount;
          commissionsEarnedIqd += calc.managementFeeAmount;
          totalOwnerNetEntitlementIqd += calc.ownerNetAmount;
        }
      }
    }

    // 4. Approved Expenses (from approved maintenance quotes)
    const approvedQuotes = await db.select()
      .from(maintenanceQuotes)
      .where(and(
        inArray(maintenanceQuotes.propertyId, propIds),
        eq(maintenanceQuotes.status, 'APPROVED')
      ));

    let totalExpenses = 0;
    approvedQuotes.forEach(q => {
      const amt = Number(q.totalAmount || 0);
      totalExpenses += q.currency === 'USD' ? Math.round(amt * exchangeRateIqd) : amt;
    });

    // 5. Owner Net Settlement Payable:
    // Authoritative net entitlement from ledger/policy minus approved maintenance expenses
    const ownerSettlementPayable = Math.max(0, totalOwnerNetEntitlementIqd - totalExpenses);

    // 6. Reconciliation verification:
    // - Individual double-entry journal balance: allLedgerBalanced (Debit == Credit within 0.01)
    // - Portfolio summary balance: Collected Rent == Sum of components (Platform + Rent Fee + Mgmt Fee + Owner Net Entitlement)
    const sumOfParts = platformCommissionIqd + rentFeeIqd + commissionsEarnedIqd + totalOwnerNetEntitlementIqd;
    const maxRoundingTolerance = Math.max(2, usdPaymentCount * 2);
    const isSummaryBalanced = Math.abs(collectedRent - sumOfParts) <= maxRoundingTolerance;

    let reconciliationStatus: 'BALANCED' | 'PENDING_RECONCILIATION' | 'UNRECONCILED' | 'NO_DATA';
    if (payments.length === 0) {
      reconciliationStatus = 'NO_DATA';
    } else if (!allLedgerBalanced || !isSummaryBalanced) {
      reconciliationStatus = 'UNRECONCILED';
    } else if (hasUnpostedPayments) {
      reconciliationStatus = 'PENDING_RECONCILIATION';
    } else {
      reconciliationStatus = 'BALANCED';
    }

    return {
      rentManagedTotalIqd: collectedRent + pendingRent,
      collectedRentIqd: collectedRent,
      pendingRentIqd: pendingRent,
      commissionsEarnedIqd: commissionsEarnedIqd,
      expensesApprovedIqd: totalExpenses,
      platformCommissionIqd: platformCommissionIqd,
      rentFeeIqd: rentFeeIqd,
      ownerSettlementPayableIqd: ownerSettlementPayable,
      sourceOfTruth: 'POSTGRESQL_DOUBLE_ENTRY_LEDGER',
      propertiesCount: propIds.length,
      reconciliationStatus,
      currency: 'IQD',
    };
  }

  /**
   * Get Pending Approvals across portfolio
   */
  async getApprovals(companyId: string): Promise<CompanyApprovalItem[]> {
    const activeAgreements = await this.getActiveAgreements(companyId);
    if (activeAgreements.length === 0) return [];

    const propIds = activeAgreements.map(a => a.propertyId);
    const agMap = new Map(activeAgreements.map(a => [a.propertyId, a]));

    const propList = await db.select().from(properties).where(inArray(properties.id, propIds));
    const propMap = new Map(propList.map(p => [p.id, p.name]));

    const ownerList = await db.select().from(users);
    const ownerMap = new Map(ownerList.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

    const items: CompanyApprovalItem[] = [];

    // Quotes pending approval
    const pendingQuotes = await db.select()
      .from(maintenanceQuotes)
      .where(and(
        inArray(maintenanceQuotes.propertyId, propIds),
        eq(maintenanceQuotes.status, 'PENDING_APPROVAL')
      ));

    for (const q of pendingQuotes) {
      const ag = agMap.get(q.propertyId);
      const spendingLimit = ag && ag.spendingLimit ? Number(ag.spendingLimit) : 500000;
      const amount = Number(q.totalAmount || 0);
      const requiresOwner = amount > spendingLimit;

      items.push({
        id: q.id,
        type: 'MAINTENANCE_QUOTE',
        title: `پەسەندکردنی نەفەقەی چاککردنەوە (${amount.toLocaleString()} IQD)`,
        description: q.notes || 'داواکاری نرخی چاککردنەوە پێویستی بە بڕیارە.',
        propertyId: q.propertyId,
        propertyName: propMap.get(q.propertyId) || 'Property',
        ownerId: ag ? ag.ownerId : '',
        ownerName: ag ? (ownerMap.get(ag.ownerId) || 'Owner') : 'Owner',
        amount,
        status: 'PENDING',
        requestedByRole: 'MAINTENANCE_MANAGER',
        requiresOwnerDecision: requiresOwner,
        createdAt: q.createdAt ? q.createdAt.toISOString() : new Date().toISOString(),
      });
    }

    // Leases pending approval
    const pendingLeases = await db.select()
      .from(leases)
      .where(and(
        inArray(leases.propertyId, propIds),
        eq(leases.status, 'PENDING_APPROVAL')
      ));

    for (const l of pendingLeases) {
      const ag = agMap.get(l.propertyId);
      items.push({
        id: l.id,
        type: 'LEASE_ACTIVATION',
        title: `چالاککردنی گرێبەستی کرێ (${Number(l.rentAmount).toLocaleString()} IQD)`,
        description: `گرێبەستی کرێ لە ${l.startDate} تا ${l.endDate} پێویستی بە پەسەندکردنی کۆتاییە.`,
        propertyId: l.propertyId,
        propertyName: propMap.get(l.propertyId) || 'Property',
        ownerId: ag ? ag.ownerId : '',
        ownerName: ag ? (ownerMap.get(ag.ownerId) || 'Owner') : 'Owner',
        amount: Number(l.rentAmount),
        status: 'PENDING',
        requestedByRole: 'PROPERTY_MANAGER',
        requiresOwnerDecision: true,
        createdAt: l.createdAt ? l.createdAt.toISOString() : new Date().toISOString(),
      });
    }

    return items;
  }

  /**
   * Decide Approval (Approve / Reject)
   */
  async decideApproval(companyId: string, approvalId: string, type: string, decision: 'APPROVE' | 'REJECT', actorUserId: string, memberRole: string) {
    if (memberRole !== CompanyRole.COMPANY_OWNER && memberRole !== CompanyRole.COMPANY_ADMIN) {
      throw new Error('ROLE_PRIVILEGE_REQUIRED: Only Company Owner or Admin can execute approval decisions.');
    }

    if (type === 'LEASE' || type === 'LEASE_ACTIVATION') {
      throw new Error('AUTHORITY_REQUIRED: Leases awaiting owner approval cannot be approved by company members. Owner approval is required.');
    }

    if (type === 'MAINTENANCE_QUOTE') {
      const quote = await db.select().from(maintenanceQuotes).where(eq(maintenanceQuotes.id, approvalId)).limit(1);
      if (quote.length === 0) throw new Error('Quote not found.');

      const newStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      await db.update(maintenanceQuotes).set({ status: newStatus }).where(eq(maintenanceQuotes.id, approvalId));

      await auditService.logAction({
        actorUserId,
        actorRole: memberRole,
        action: decision === 'APPROVE' ? 'FINANCIAL_APPROVAL_GRANTED' : 'FINANCIAL_APPROVAL_REJECTED',
        resourceType: 'MaintenanceQuote',
        resourceId: approvalId,
        changes: { status: newStatus },
      });

      return { id: approvalId, status: newStatus };
    }

    throw new Error(`Unsupported approval type: ${type}`);
  }

  /**
   * Generate AI Recommendations strictly scoped and categorized
   */
  async generateAIRecommendations(companyId: string, managedPropertyIds: string[]): Promise<CompanyAIRecommendation[]> {
    if (managedPropertyIds.length === 0) {
      return [{
        id: 'ai_welcome_rec',
        category: 'PORTFOLIO_OPTIMIZATION',
        type: 'FACT',
        headline: 'دەستپێکردنی بەڕێوەبردنی موڵک (Property Management Onboarding)',
        details: 'هێشتا هیچ موڵکێکی بەڕێوەبراو نییە. بۆ دەستپێکردن، بانگهێشتی خاوەن موڵک بکە بۆ بەستنی گرێبەستی بەڕێوەبردن.',
        actionRequired: true,
        humanApprovalRequired: true,
        generatedAt: new Date().toISOString(),
      }];
    }

    const recs: CompanyAIRecommendation[] = [];

    // Factual portfolio metric
    recs.push({
      id: 'ai_rec_portfolio_status',
      category: 'PORTFOLIO_OPTIMIZATION',
      type: 'FACT',
      headline: `پۆرتفۆلیۆی چالاک: ${managedPropertyIds.length} موڵکی بەڕێوەبراو`,
      details: 'هەموو موڵکەکان بەپێی گرێبەستی فەرمی بەڕێوەبردن (Management Agreement) کارپێدەکرێن و دەسەڵاتەکان جیاکراونەتەوە.',
      actionRequired: false,
      humanApprovalRequired: true,
      generatedAt: new Date().toISOString(),
    });

    // Check expiring leases
    const expiringLeases = await db.select()
      .from(leases)
      .where(and(
        inArray(leases.propertyId, managedPropertyIds),
        eq(leases.status, 'ACTIVE')
      ))
      .limit(3);

    if (expiringLeases.length > 0) {
      recs.push({
        id: 'ai_rec_lease_renewal',
        category: 'LEASE_RENEWAL',
        type: 'RECOMMENDATION',
        headline: 'پێشنیازی نوێکردنەوەی پێشوەختەی گرێبەستی کرێ (Lease Renewal Strategy)',
        details: 'پێشنیاز دەکرێت بە ٦٠ ڕۆژ پێش بەسەرچوونی گرێبەست نامەی نوێکردنەوە بۆ کرێچی بنێردرێت بۆ ڕێگریکردن لە بەتاڵبوون.',
        actionRequired: true,
        humanApprovalRequired: true,
        generatedAt: new Date().toISOString(),
      });
    }

    return recs;
  }
}

export const companyRepository = new CompanyRepository();
