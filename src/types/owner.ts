export interface OwnerPropertyItem {
  id: string;
  ownerId?: string;
  name: string;
  nameKurdish?: string;
  location: string;
  city: string;
  type: string;
  status: 'Occupied' | 'Vacant' | 'Maintenance' | 'Listed' | 'Under Management';
  monthlyRentIqd: number;
  monthlyRentUsd?: number;
  unitsCount: number;
  imageUrl?: string;
  tapuStatus?: string;
  isOccupied: boolean;
  tenantName?: string;
  tenantPhone?: string;
  activeLeaseId?: string;
  leaseEndDate?: string;
  managingAgencyName?: string;
  managingAgencyId?: string;
  operatingModel?: 'FULLY_MANAGED' | 'AGENT_LISTED_PLATFORM_MANAGED' | 'AGENT_OPERATED' | null;
  collectedRentIqd?: number;
  totalFeeDeductedIqd?: number;
  platformFeeIqd?: number;
  rentFeeIqd?: number;
  managementFeeIqd?: number;
  platformFeeRate?: number;
  rentFeeRate?: number | null;
  managementFeeRate?: number | null;
  netOwnerIncomeIqd?: number;
  verificationStatus?: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
  rejectionReason?: string | null;
  managementPreference?: 'SELF_MANAGED' | 'HOMEHUB_MANAGED' | 'AGENT_MANAGED';
  managementArrangementStatus?: 'NOT_APPLICABLE' | 'AWAITING_ONBOARDING' | 'AWAITING_AGREEMENT' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
}

export interface OwnerKPIs {
  totalProperties: number;
  propertiesChangeText: string;
  activeTenants: number;
  occupancyRate: number;
  monthlyRevenueIqd: number;
  revenueChangeText: string;
  openMaintenance: number;
  urgentMaintenance: number;
}

export interface OwnerRecentActivity {
  id: string;
  type: 'RENT_PAYMENT' | 'MAINTENANCE_REQUEST' | 'TENANT_MESSAGE' | 'LEASE_SIGNED' | 'APPROVAL_REQUEST' | 'DOCUMENT_UPLOADED';
  title: string;
  titleKurdish?: string;
  relatedEntity: string;
  timestamp: string;
  timeAgo: string;
  amountIqd?: number;
  amountFormatted?: string;
  status?: string;
  isUrgent?: boolean;
}

export interface OwnerUpcomingEvent {
  id: string;
  type: 'PROPERTY_VIEWING' | 'LEASE_RENEWAL' | 'MAINTENANCE_INSPECTION' | 'RENT_DUE' | 'CONTRACT_EXPIRY';
  title: string;
  titleKurdish?: string;
  dateTimeFormatted: string;
  relatedProperty: string;
  status: string;
  urgency?: 'NORMAL' | 'MEDIUM' | 'HIGH';
}

export interface OwnerRentalIncomeData {
  period: string; // '3m' | '6m' | '9m' | '12m'
  currency: string;
  months: {
    month: string;
    actualIncomeIqd: number;
    expectedIncomeIqd: number;
  }[];
  totalActualIqd: number;
  totalExpectedIqd: number;
  platformFeeRate: number;
  totalCommissionIqd?: number;
  totalPlatformFeeIqd?: number;
  totalRentFeeIqd?: number;
  totalManagementFeeIqd?: number;
  totalNetOwnerIncomeIqd?: number;
}

export interface OwnerOccupancyData {
  totalUnits: number;
  occupiedCount: number;
  occupiedPercentage: number;
  vacantCount: number;
  vacantPercentage: number;
  maintenanceCount: number;
  maintenancePercentage: number;
}

export interface OwnerQuickTip {
  id: string;
  text: string;
  textKurdish: string;
  textArabic?: string;
  category: 'DOCUMENT' | 'LEASE' | 'MAINTENANCE' | 'OCCUPANCY' | 'REVENUE';
  isAiGenerated: boolean;
}

export interface OwnerDashboardData {
  ownerId: string;
  ownerName: string;
  ownerRole: string;
  avatarUrl?: string;
  unreadNotificationsCount: number;
  unreadMessagesCount: number;
  kpis: OwnerKPIs;
  properties: OwnerPropertyItem[];
  recentActivities: OwnerRecentActivity[];
  upcomingEvents: OwnerUpcomingEvent[];
  rentalIncome: OwnerRentalIncomeData;
  occupancy: OwnerOccupancyData;
  quickTip: OwnerQuickTip;
}

export interface OwnerApprovalRequest {
  id: string;
  ownerId?: string;
  propertyId?: string;
  requesterName: string;
  requesterRole: string;
  action: string;
  actionKurdish: string;
  relatedEntity: string;
  amountIqd?: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  createdAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface OwnerNotificationItem {
  id: string;
  ownerId?: string;
  category: string;
  priority: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  entityId?: string;
}
