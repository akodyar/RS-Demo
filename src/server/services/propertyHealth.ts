import { db } from '../../db/index.js';
import {
  properties,
  rentSchedules,
  utilityBills,
  maintenanceRequests,
  managementAgreements
} from '../../db/schema.js';
import { eq, inArray, and, lt } from 'drizzle-orm';
import { Permission } from '../../types/index.js';

export interface PropertyHealth {
  propertyId: string;
  propertyName: string;
  propertyNameKurdish?: string;
  status: 'HEALTHY' | 'ATTENTION' | 'CRITICAL';
  financialVisible: boolean;
  outstandingAmountIqd: number;
  unpaidItemsCount: number;
  maintenanceIssuesCount: number;
  criticalIssuesCount: number;
  topIssue?: string;
  topIssueKurdish?: string;
  topIssueArabic?: string;
}

export class PropertyHealthService {
  async getPropertiesHealth(
    propertyIds: string[],
    role: 'OWNER' | 'AGENT',
    agentCompanyId?: string
  ): Promise<PropertyHealth[]> {
    if (propertyIds.length === 0) return [];

    // 1. Fetch properties
    const props = await db.select().from(properties).where(inArray(properties.id, propertyIds));

    // 2. Fetch agent permissions if AGENT
    const agentPermissionsMap = new Map<string, string[]>();
    if (role === 'AGENT' && agentCompanyId) {
      const agreements = await db
        .select()
        .from(managementAgreements)
        .where(and(
          inArray(managementAgreements.propertyId, propertyIds),
          eq(managementAgreements.companyId, agentCompanyId),
          eq(managementAgreements.status, 'ACTIVE')
        ));
      
      for (const ag of agreements) {
        agentPermissionsMap.set(ag.propertyId, (ag.grantedPermissions as string[]) || []);
      }
    }

    // 3. Fetch Rent Schedules
    const rents = await db.select().from(rentSchedules).where(inArray(rentSchedules.propertyId, propertyIds));

    // 4. Fetch Utility Bills
    const utilities = await db.select().from(utilityBills).where(inArray(utilityBills.propertyId, propertyIds));

    // 5. Fetch Maintenance Requests
    const maintenance = await db.select().from(maintenanceRequests).where(inArray(maintenanceRequests.propertyId, propertyIds));

    const healthList: PropertyHealth[] = [];

    for (const p of props) {
      let financialVisible = true;
      if (role === 'AGENT') {
        const perms = agentPermissionsMap.get(p.id) || [];
        financialVisible = perms.includes(Permission.VIEW_FINANCIALS) || perms.includes('VIEW_FINANCIALS');
      }

      let outstandingIqd = 0;
      let unpaidItemsCount = 0;
      let maintenanceCount = 0;
      let criticalCount = 0;
      let topIssueEn = '';
      let topIssueKu = '';
      let topIssueAr = '';
      let status: 'HEALTHY' | 'ATTENTION' | 'CRITICAL' = 'HEALTHY';

      // Financials
      if (financialVisible) {
        const propRents = rents.filter(r => r.propertyId === p.id && ['DUE', 'OVERDUE', 'PARTIALLY_PAID'].includes(r.status || ''));
        for (const r of propRents) {
          const amt = Number(r.amount) - Number(r.paidAmount || 0);
          if (amt > 0) {
            outstandingIqd += amt;
            unpaidItemsCount++;
            if (r.status === 'OVERDUE') criticalCount++;
          }
        }

        const propUtils = utilities.filter(u => u.propertyId === p.id && ['UNPAID', 'OVERDUE', 'PARTIALLY_PAID'].includes(u.status || ''));
        for (const u of propUtils) {
          const amt = Number(u.outstandingAmount || u.amount);
          if (amt > 0) {
            outstandingIqd += amt;
            unpaidItemsCount++;
            if (u.status === 'OVERDUE') criticalCount++;
          }
        }
      }

      // Maintenance
      const propMaint = maintenance.filter(m => m.propertyId === p.id && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(m.status || ''));
      maintenanceCount = propMaint.length;
      for (const m of propMaint) {
        if (m.priority === 'HIGH' || m.priority === 'URGENT') {
          criticalCount++;
        }
      }

      // Determine Status & Top Issue
      if (criticalCount > 0 || (financialVisible && outstandingIqd > 0)) {
        status = 'CRITICAL';
        if (financialVisible && outstandingIqd > 0) {
          topIssueEn = `Outstanding Balance: ${outstandingIqd.toLocaleString()} IQD`;
          topIssueKu = `بڕی ماوە: ${outstandingIqd.toLocaleString()} IQD`;
          topIssueAr = `الرصيد المستحق: ${outstandingIqd.toLocaleString()} IQD`;
        } else {
          topIssueEn = `Urgent Maintenance Required`;
          topIssueKu = `پێویستی بە چاککردنەوەی بەپەلە هەیە`;
          topIssueAr = `مطلوب صيانة عاجلة`;
        }
      } else if (maintenanceCount > 0) {
        status = 'ATTENTION';
        topIssueEn = `${maintenanceCount} Active Maintenance Request(s)`;
        topIssueKu = `${maintenanceCount} داواکاری چاککردنەوەی چالاک`;
        topIssueAr = `${maintenanceCount} طلب صيانة نشط`;
      } else {
        status = 'HEALTHY';
        topIssueEn = 'No actionable issues';
        topIssueKu = 'هیچ کێشەیەک نییە';
        topIssueAr = 'لا توجد مشكلات قابلة للتنفيذ';
      }

      healthList.push({
        propertyId: p.id,
        propertyName: p.name,
        propertyNameKurdish: (p as any).nameKurdish || p.name || '',
        status,
        financialVisible,
        outstandingAmountIqd: outstandingIqd,
        unpaidItemsCount,
        maintenanceIssuesCount: maintenanceCount,
        criticalIssuesCount: criticalCount,
        topIssue: topIssueEn,
        topIssueKurdish: topIssueKu,
        topIssueArabic: topIssueAr,
      });
    }

    return healthList;
  }
}

export const propertyHealthService = new PropertyHealthService();
