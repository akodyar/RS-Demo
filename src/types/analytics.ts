import { BaseEntity } from './index.js';

export type ValuationMethod =
  | 'AUTHORITATIVE_DEED'
  | 'PROFESSIONAL_APPRAISAL'
  | 'PLATFORM_MODEL'
  | 'MANUAL_ESTIMATE'
  | 'AI_ADVISORY';

export type ValuationStatus = 'DRAFT' | 'FINAL' | 'SUPERSEDED';

export type ValuationConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface PropertyValuationItem {
  id: string;
  propertyId: string;
  valuationDate: string; // 'YYYY-MM-DD'
  estimatedValue: number;
  currency: string;
  method: ValuationMethod;
  source: string;
  confidenceIndicator: ValuationConfidence;
  reviewerUserId?: string | null;
  documentUrl?: string | null;
  notes?: string | null;
  status: ValuationStatus;
  pricePerSqFoot?: number | null;
  pricePerSqMeter?: number | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

export interface ArrearsAgingBuckets {
  days0To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  totalOverdue: number;
}

export interface LeaseExpiryCohort {
  count: number;
  percentage: number;
  unitIds: string[];
  propertyIds: string[];
}

export interface LeaseExpiryCohorts {
  days30: LeaseExpiryCohort;
  days60: LeaseExpiryCohort;
  days90: LeaseExpiryCohort;
  days180: LeaseExpiryCohort;
}

export interface UnderperformingSignal {
  propertyId: string;
  propertyName: string;
  signal: 'HIGH_VACANCY' | 'HIGH_DELINQUENCY' | 'NEGATIVE_NOI' | 'ELEVATED_MAINTENANCE' | 'LOW_COLLECTION' | 'DATA_GAP';
  metric: string;
  actualValue: number | string;
  threshold: number | string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  explanation: string;
}

export interface PropertyPerformanceMetrics {
  propertyId: string;
  propertyName: string;
  city?: string;
  type: string;
  squareFeet?: number | null;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  availableUnits: number;
  occupancyRate: number | null; // Percentage (e.g. 92.5) or null if 0 units
  vacancyRate: number | null;
  collectionRate: number | null;
  grossScheduledRent: number;
  grossCollectedRent: number;
  operatingExpenses: number;
  maintenanceExpenses: number;
  netOperatingIncome: number;
  cashFlow: {
    netOperating: number;
    netInvesting: number;
    netFinancing: number;
    netTotal: number;
  };
  delinquencyRate: number | null;
  totalArrears: number;
  arrearsBuckets: ArrearsAgingBuckets;
  latestValuation?: PropertyValuationItem | null;
  acquisitionCost?: number | null;
  acquisitionDate?: string | null;
  grossRentalYield?: number | null; // Percentage
  netRentalYield?: number | null; // Percentage
  capitalizationRate?: number | null; // Percentage
  cashOnCashReturn?: number | null; // Percentage
  holdingPeriodRoi?: number | null; // Percentage
  annualizedReturn?: number | null; // Percentage (CAGR)
  appreciationRate?: number | null; // Percentage
  unrealizedReturn?: number | null;
  operatingExpenseRatio?: number | null;
  maintenanceCostRatio?: number | null;
  profitabilityRatio?: number | null;
  healthStatus: 'HEALTHY' | 'ATTENTION_REQUIRED' | 'AT_RISK' | 'CRITICAL' | 'INSUFFICIENT_DATA';
  currency: string;
  dataSufficiency: 'SUFFICIENT' | 'INSUFFICIENT_DATA' | 'PARTIAL';
}

export interface PortfolioOverview {
  totalProperties: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  overallOccupancyRate: number | null;
  overallVacancyRate: number | null;
  totalAssetValue: number | null;
  totalGrossRevenue: number;
  totalOperatingExpenses: number;
  totalNetOperatingIncome: number;
  portfolioGrossYield: number | null;
  portfolioNetYield: number | null;
  portfolioCapRate: number | null;
  overallCollectionRate: number | null;
  overallDelinquencyRate: number | null;
  totalArrears: number;
  totalMaintenanceCost: number;
  totalCashFlow: number;
  currency: string;
  leaseExpiryCohorts: LeaseExpiryCohorts;
  underperformingSignals: UnderperformingSignal[];
  concentrationRisk: {
    topPropertyExposurePercent: number | null;
    topTenantExposurePercent: number | null;
    assetTypeConcentration: Record<string, number>;
    geographicConcentration: Record<string, number>;
  };
  reportingPeriod: {
    startDate: string;
    endDate: string;
  };
}

export interface DistributionItem {
  key: string;
  label: string;
  count: number;
  percentage: number;
  totalValue: number;
}

export interface PortfolioDistributions {
  currency: string;
  assetTypeDistribution: DistributionItem[];
  geographicDistribution: DistributionItem[];
  revenueDistribution: Array<{
    propertyId: string;
    propertyName: string;
    revenue: number;
    percentage: number;
  }>;
  occupancyDistribution: Array<{
    bucket: string;
    count: number;
  }>;
}

export interface PortfolioSnapshotItem {
  id: string;
  ownerId?: string | null;
  companyId?: string | null;
  snapshotDate: string;
  totalProperties: number;
  totalUnits: number;
  occupancyRate: number;
  grossRevenue: number;
  operatingExpenses: number;
  netOperatingIncome: number;
  totalAssetValue?: number | null;
  currency: string;
  createdAt?: string | Date | null;
}

export interface InternalMarketBenchmark {
  city: string;
  propertyType: string;
  averageSalePricePerSqm: number | null;
  medianSalePricePerSqm: number | null;
  averageRentPerSqm: number | null;
  medianRentPerSqm: number | null;
  sampleSalesCount: number;
  sampleLeasesCount: number;
  activeListingsCount: number;
  currency: string;
  dataSourceNotice: string;
}

export interface AIAdvisoryInsight {
  id: string;
  category: 'PERFORMANCE' | 'ANOMALY' | 'RENT_OPTIMIZATION' | 'EXPENSE_ALERT' | 'VALUATION' | 'LEASE_EXPIRY';
  headline: string;
  headlineKurdish: string;
  headlineArabic: string;
  explanation: string;
  explanationKurdish: string;
  explanationArabic: string;
  supportingMetrics: Record<string, any>;
  proposedHumanAction?: string;
  isAdvisoryOnly: true;
  humanReviewRequired: true;
  generatedAt: string;
}
