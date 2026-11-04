import { analyticsRepository } from '../repositories/analytics.js';
import { financeService } from './finance.js';
import { ValuationService, valuationService } from './valuation.js';
import { db } from '../../db/index.js';
import { properties, exchangeRates } from '../../db/schema.js';
import { eq, inArray, desc } from 'drizzle-orm';
import { 
  PropertyPerformanceMetrics, 
  PortfolioOverview, 
  PortfolioDistributions, 
  PortfolioSnapshotItem,
  InternalMarketBenchmark,
  AIAdvisoryInsight,
  ArrearsAgingBuckets,
  LeaseExpiryCohorts,
  UnderperformingSignal
} from '../../types/analytics.js';

export class AnalyticsService {
  /**
   * Currency Normalization Service.
   * Converts any amount to target reporting currency using authoritative exchange_rates.
   * Never silently assumes 1:1 or hardcodes rates in production.
   */
  async normalizeCurrency(
    amount: number,
    fromCurrency?: string | null,
    toCurrency: string = 'IQD',
    asOfDate?: string
  ): Promise<{ amount: number; rate: number } | null> {
    if (!fromCurrency || !toCurrency) {
      return null;
    }
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (from === to) {
      return { amount, rate: 1.0 };
    }

    const rates = await analyticsRepository.getExchangeRates();
    
    // 1. Direct rate
    let matched = rates.find(r => 
      r.baseCurrency === from && 
      r.targetCurrency === to && 
      (!asOfDate || r.date <= asOfDate)
    );

    if (matched) {
      const rate = Number(matched.rate);
      return { amount: Math.round(amount * rate * 100) / 100, rate };
    }

    // 2. Inverse rate
    let inverse = rates.find(r => 
      r.baseCurrency === to && 
      r.targetCurrency === from && 
      (!asOfDate || r.date <= asOfDate)
    );

    if (inverse) {
      const invRate = Number(inverse.rate);
      if (invRate > 0) {
        const rate = 1 / invRate;
        return { amount: Math.round(amount * rate * 100) / 100, rate };
      }
    }

    // Fallback: If no database rate is found in non-production, check for test default, else null
    if (process.env.NODE_ENV !== 'production') {
      if (from === 'USD' && to === 'IQD') return { amount: Math.round(amount * 1310), rate: 1310 };
      if (from === 'IQD' && to === 'USD') return { amount: Math.round((amount / 1310) * 100) / 100, rate: 1 / 1310 };
    }

    // Fail-safe: missing exchange rate must not silently fabricate amounts
    return null;
  }

  /**
   * Calculate detailed performance and investment metrics for a single authorized property
   */
  async getPropertyAnalytics(
    user: { id: string; organizationId?: string; roles: string[] },
    propertyId: string,
    reportingCurrency: string = 'USD'
  ): Promise<PropertyPerformanceMetrics> {
    const scope = await analyticsRepository.resolveUserPropertyScope(user, propertyId);
    if (!scope.propertyIds.includes(propertyId)) {
      const err: any = new Error('AUTHORITY_REQUIRED: Access denied for specified property');
      err.status = 403;
      throw err;
    }

    const [propRecord] = await analyticsRepository.getScopedProperties([propertyId]);
    if (!propRecord) {
      const err: any = new Error('NOT_FOUND: Property not found');
      err.status = 404;
      throw err;
    }

    const propUnits = await analyticsRepository.getScopedUnits([propertyId]);
    const activeLeases = await analyticsRepository.getScopedActiveLeases([propertyId]);
    const rentSchedules = await analyticsRepository.getScopedRentSchedules([propertyId]);
    const confirmedPayments = await analyticsRepository.getScopedPayments([propertyId]);
    const maintenanceInvoices = await analyticsRepository.getScopedMaintenanceInvoices([propertyId]);
    const latestValuation = await valuationService.getLatestValuation(user, propertyId);

    // 1. Units & Occupancy
    const totalUnits = propUnits.length;
    const occupiedUnits = activeLeases.length;
    const vacantUnits = Math.max(0, totalUnits - occupiedUnits);
    const availableUnits = propUnits.filter(u => u.status === 'VACANT').length;

    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 1000) / 10 : null;
    const vacancyRate = occupancyRate !== null ? Math.round((100 - occupancyRate) * 10) / 10 : null;

    // 2. Revenues (Normalized to reporting currency - strictly avoids fabricating USD when currency is null)
    let grossScheduledRent = 0;
    for (const l of activeLeases) {
      if (l.currency) {
        const converted = await this.normalizeCurrency(Number(l.rentAmount || 0), l.currency, reportingCurrency);
        if (converted) grossScheduledRent += converted.amount;
      }
    }

    let grossCollectedRent = 0;
    for (const p of confirmedPayments) {
      if (p.currency) {
        const converted = await this.normalizeCurrency(Number(p.amount || 0), p.currency, reportingCurrency);
        if (converted) grossCollectedRent += converted.amount;
      }
    }

    const collectionRate = grossScheduledRent > 0 
      ? Math.round((grossCollectedRent / grossScheduledRent) * 1000) / 10 
      : (grossCollectedRent > 0 ? 100 : null);

    // 3. Operating Expenses & Maintenance
    let maintenanceExpenses = 0;
    for (const inv of maintenanceInvoices) {
      if (inv.currency) {
        const converted = await this.normalizeCurrency(Number(inv.amount || 0), inv.currency, reportingCurrency);
        if (converted) maintenanceExpenses += converted.amount;
      }
    }

    // Authoritative Finance P&L integration for operating expenses
    let operatingExpenses = maintenanceExpenses;
    try {
      const pnl = await financeService.getProfitAndLoss(propertyId);
      if (pnl && pnl.totalExpense > 0) {
        operatingExpenses = Math.max(maintenanceExpenses, pnl.totalExpense);
      }
    } catch {
      // Fallback to direct invoice total if finance service has no ledger entries for property
    }

    // 4. Real Estate Standard Net Operating Income (NOI)
    // NOI = Effective Gross Revenue - Operating Expenses (excluding debt service and depreciation)
    const effectiveGrossRevenue = grossCollectedRent > 0 ? grossCollectedRent : grossScheduledRent;
    const netOperatingIncome = Math.round((effectiveGrossRevenue - operatingExpenses) * 100) / 100;

    // 5. Arrears & Delinquency Aging
    const today = new Date().toISOString().slice(0, 10);
    const arrearsBuckets: ArrearsAgingBuckets = {
      days0To30: 0,
      days31To60: 0,
      days61To90: 0,
      days90Plus: 0,
      totalOverdue: 0,
    };

    let totalScheduledRentInSchedules = 0;
    for (const s of rentSchedules) {
      const amt = Number(s.amount || 0);
      const paid = Number(s.paidAmount || 0);
      const remaining = Math.max(0, amt - paid);
      totalScheduledRentInSchedules += amt;

      if (remaining > 0 && s.dueDate < today && s.status !== 'PAID') {
        const dueDate = new Date(s.dueDate);
        const now = new Date(today);
        const diffDays = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        let remAmt = 0;
        if (s.currency) {
          const convertedRem = await this.normalizeCurrency(remaining, s.currency, reportingCurrency);
          if (convertedRem) remAmt = convertedRem.amount;
        } else {
          remAmt = remaining;
        }

        arrearsBuckets.totalOverdue += remAmt;
        if (diffDays <= 30) arrearsBuckets.days0To30 += remAmt;
        else if (diffDays <= 60) arrearsBuckets.days31To60 += remAmt;
        else if (diffDays <= 90) arrearsBuckets.days61To90 += remAmt;
        else arrearsBuckets.days90Plus += remAmt;
      }
    }

    // Delinquency rate: zero scheduled rent must be represented as null (INSUFFICIENT_DATA), not 0%
    const delinquencyRate = totalScheduledRentInSchedules > 0 
      ? Math.round((arrearsBuckets.totalOverdue / totalScheduledRentInSchedules) * 1000) / 10 
      : null;

    // 6. Cash Flow Statement
    let cashFlow = {
      netOperating: netOperatingIncome,
      netInvesting: 0,
      netFinancing: 0,
      netTotal: netOperatingIncome,
    };

    try {
      const cf = await financeService.getCashFlow(propertyId);
      if (cf) {
        cashFlow = {
          netOperating: cf.netOperatingCashFlow,
          netInvesting: cf.netInvestingCashFlow,
          netFinancing: cf.netFinancingCashFlow,
          netTotal: cf.netCashFlow,
        };
      }
    } catch {
      // Use estimated cash flow if finance module unconfigured
    }

    // 7. Investment Analytics (Yield, Cap Rate, ROI)
    // Normalize latest valuation to reporting currency
    let propertyValue = 0;
    if (latestValuation && latestValuation.estimatedValue > 0 && latestValuation.currency) {
      const convVal = await this.normalizeCurrency(
        latestValuation.estimatedValue,
        latestValuation.currency,
        reportingCurrency,
        latestValuation.valuationDate
      );
      if (convVal) {
        propertyValue = convVal.amount;
      }
    }

    // Normalize acquisition cost from property.currency to reportingCurrency
    // If property has no recorded currency, do NOT fabricate USD; leave acquisitionCost as null
    let acquisitionCost: number | null = null;
    if (propRecord.acquisitionCost && propRecord.currency) {
      const convAcq = await this.normalizeCurrency(
        Number(propRecord.acquisitionCost),
        propRecord.currency,
        reportingCurrency,
        propRecord.acquisitionDate || undefined
      );
      if (convAcq) {
        acquisitionCost = convAcq.amount;
      }
    }
    
    // Annualized rent (12 months of scheduled rent)
    const annualGrossRent = grossScheduledRent * 12;
    const annualNOI = netOperatingIncome * 12;

    const grossRentalYield = propertyValue > 0 
      ? Math.round((annualGrossRent / propertyValue) * 10000) / 100 
      : null;

    // In real estate investment analysis, Net Rental Yield and Capitalization Rate (Cap Rate)
    // measure the same fundamental unleveraged operating return relative to current asset value:
    // (Annualized NOI / Current Asset Valuation) * 100.
    const netRentalYield = propertyValue > 0 
      ? Math.round((annualNOI / propertyValue) * 10000) / 100 
      : null;

    const capitalizationRate = propertyValue > 0 
      ? Math.round((annualNOI / propertyValue) * 10000) / 100 
      : null;

    const cashOnCashReturn = (acquisitionCost && acquisitionCost > 0) 
      ? Math.round(((cashFlow.netOperating * 12) / acquisitionCost) * 10000) / 100 
      : null;

    const holdingPeriodRoi = (acquisitionCost && acquisitionCost > 0 && propertyValue > 0) 
      ? Math.round(((propertyValue - acquisitionCost + (cashFlow.netTotal * 12)) / acquisitionCost) * 10000) / 100 
      : null;

    let annualizedReturn: number | null = null;
    if (acquisitionCost && acquisitionCost > 0 && propertyValue > 0 && propRecord.acquisitionDate) {
      const acqYear = new Date(propRecord.acquisitionDate).getFullYear();
      const currentYear = new Date().getFullYear();
      const years = Math.max(1, currentYear - acqYear);
      annualizedReturn = Math.round((Math.pow(propertyValue / acquisitionCost, 1 / years) - 1) * 10000) / 100;
    }

    const appreciationRate = (acquisitionCost && acquisitionCost > 0 && propertyValue > 0) 
      ? Math.round(((propertyValue - acquisitionCost) / acquisitionCost) * 10000) / 100 
      : null;

    const unrealizedReturn = (acquisitionCost && propertyValue > 0) 
      ? Math.round((propertyValue - acquisitionCost) * 100) / 100 
      : null;

    const operatingExpenseRatio = grossScheduledRent > 0 
      ? Math.round((operatingExpenses / grossScheduledRent) * 1000) / 10 
      : null;

    const maintenanceCostRatio = operatingExpenses > 0 
      ? Math.round((maintenanceExpenses / operatingExpenses) * 1000) / 10 
      : null;

    const profitabilityRatio = grossScheduledRent > 0 
      ? Math.round((netOperatingIncome / grossScheduledRent) * 1000) / 10 
      : null;

    // 8. Health Status
    let healthStatus: 'HEALTHY' | 'ATTENTION_REQUIRED' | 'AT_RISK' | 'CRITICAL' | 'INSUFFICIENT_DATA' = 'HEALTHY';
    if (totalUnits === 0) {
      healthStatus = 'INSUFFICIENT_DATA';
    } else if ((occupancyRate !== null && occupancyRate < 60) || (delinquencyRate !== null && delinquencyRate > 25) || netOperatingIncome < 0) {
      healthStatus = 'CRITICAL';
    } else if ((occupancyRate !== null && occupancyRate < 80) || (delinquencyRate !== null && delinquencyRate > 15)) {
      healthStatus = 'AT_RISK';
    } else if ((occupancyRate !== null && occupancyRate < 90) || (delinquencyRate !== null && delinquencyRate > 8)) {
      healthStatus = 'ATTENTION_REQUIRED';
    }

    const dataSufficiency = totalUnits === 0 || !latestValuation 
      ? 'INSUFFICIENT_DATA' 
      : (!acquisitionCost ? 'PARTIAL' : 'SUFFICIENT');

    return {
      propertyId,
      propertyName: propRecord.name,
      city: (propRecord.address as any)?.city || 'Erbil',
      type: propRecord.type,
      squareFeet: propRecord.squareFeet,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      availableUnits,
      occupancyRate,
      vacancyRate,
      collectionRate,
      grossScheduledRent: Math.round(grossScheduledRent),
      grossCollectedRent: Math.round(grossCollectedRent),
      operatingExpenses: Math.round(operatingExpenses),
      maintenanceExpenses: Math.round(maintenanceExpenses),
      netOperatingIncome,
      cashFlow,
      delinquencyRate,
      totalArrears: Math.round(arrearsBuckets.totalOverdue),
      arrearsBuckets,
      latestValuation,
      acquisitionCost,
      acquisitionDate: propRecord.acquisitionDate,
      grossRentalYield,
      netRentalYield,
      capitalizationRate,
      cashOnCashReturn,
      holdingPeriodRoi,
      annualizedReturn,
      appreciationRate,
      unrealizedReturn,
      operatingExpenseRatio,
      maintenanceCostRatio,
      profitabilityRatio,
      healthStatus,
      currency: reportingCurrency,
      dataSufficiency,
    };
  }

  /**
   * Portfolio Aggregation across all authorized properties
   */
  async getPortfolioOverview(
    user: { id: string; organizationId?: string; roles: string[] },
    reportingCurrency: string = 'USD'
  ): Promise<PortfolioOverview> {
    const scope = await analyticsRepository.resolveUserPropertyScope(user);
    const propIds = scope.propertyIds;

    const emptyResult: PortfolioOverview = {
      totalProperties: 0,
      totalUnits: 0,
      occupiedUnits: 0,
      vacantUnits: 0,
      overallOccupancyRate: null,
      overallVacancyRate: null,
      totalAssetValue: null,
      totalGrossRevenue: 0,
      totalOperatingExpenses: 0,
      totalNetOperatingIncome: 0,
      portfolioGrossYield: null,
      portfolioNetYield: null,
      portfolioCapRate: null,
      overallCollectionRate: null,
      overallDelinquencyRate: null,
      totalArrears: 0,
      totalMaintenanceCost: 0,
      totalCashFlow: 0,
      currency: reportingCurrency,
      leaseExpiryCohorts: {
        days30: { count: 0, percentage: 0, unitIds: [], propertyIds: [] },
        days60: { count: 0, percentage: 0, unitIds: [], propertyIds: [] },
        days90: { count: 0, percentage: 0, unitIds: [], propertyIds: [] },
        days180: { count: 0, percentage: 0, unitIds: [], propertyIds: [] },
      },
      underperformingSignals: [],
      concentrationRisk: {
        topPropertyExposurePercent: null,
        topTenantExposurePercent: null,
        assetTypeConcentration: {},
        geographicConcentration: {},
      },
      reportingPeriod: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
      }
    };

    if (propIds.length === 0) {
      return emptyResult;
    }

    const propertyMetricsList: PropertyPerformanceMetrics[] = [];
    for (const pid of propIds) {
      const m = await this.getPropertyAnalytics(user, pid, reportingCurrency);
      propertyMetricsList.push(m);
    }

    let totalUnits = 0;
    let occupiedUnits = 0;
    let vacantUnits = 0;
    let totalGrossRevenue = 0;
    let totalOperatingExpenses = 0;
    let totalNetOperatingIncome = 0;
    let totalMaintenanceCost = 0;
    let totalArrears = 0;
    let totalCashFlow = 0;
    let totalAssetValue = 0;
    let hasValuation = false;

    for (const p of propertyMetricsList) {
      totalUnits += p.totalUnits;
      occupiedUnits += p.occupiedUnits;
      vacantUnits += p.vacantUnits;
      totalGrossRevenue += p.grossScheduledRent;
      totalOperatingExpenses += p.operatingExpenses;
      totalNetOperatingIncome += p.netOperatingIncome;
      totalMaintenanceCost += p.maintenanceExpenses;
      totalArrears += p.totalArrears;
      totalCashFlow += p.cashFlow.netTotal;
      if (p.latestValuation?.estimatedValue) {
        totalAssetValue += p.latestValuation.estimatedValue;
        hasValuation = true;
      }
    }

    const overallOccupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 1000) / 10 : null;
    const overallVacancyRate = overallOccupancyRate !== null ? Math.round((100 - overallOccupancyRate) * 10) / 10 : null;
    const overallCollectionRate = totalGrossRevenue > 0 ? Math.round(((totalGrossRevenue - totalArrears) / totalGrossRevenue) * 1000) / 10 : null;
    const overallDelinquencyRate = totalGrossRevenue > 0 ? Math.round((totalArrears / totalGrossRevenue) * 1000) / 10 : null;

    const portfolioGrossYield = (hasValuation && totalAssetValue > 0) 
      ? Math.round(((totalGrossRevenue * 12) / totalAssetValue) * 10000) / 100 
      : null;

    const portfolioNetYield = (hasValuation && totalAssetValue > 0) 
      ? Math.round(((totalNetOperatingIncome * 12) / totalAssetValue) * 10000) / 100 
      : null;

    const portfolioCapRate = (hasValuation && totalAssetValue > 0) 
      ? Math.round(((totalNetOperatingIncome * 12) / totalAssetValue) * 10000) / 100 
      : null;

    // Lease Expiry Cohorts
    const activeLeases = await analyticsRepository.getScopedActiveLeases(propIds);
    const today = new Date();
    const leaseExpiryCohorts: LeaseExpiryCohorts = {
      days30: { count: 0, percentage: 0, unitIds: [], propertyIds: [] },
      days60: { count: 0, percentage: 0, unitIds: [], propertyIds: [] },
      days90: { count: 0, percentage: 0, unitIds: [], propertyIds: [] },
      days180: { count: 0, percentage: 0, unitIds: [], propertyIds: [] },
    };

    const totalActiveLeases = activeLeases.length;
    for (const l of activeLeases) {
      if (l.endDate) {
        const end = new Date(l.endDate);
        const diffDays = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 180) {
          if (diffDays <= 30) {
            leaseExpiryCohorts.days30.count++;
            if (l.unitId) leaseExpiryCohorts.days30.unitIds.push(l.unitId);
            leaseExpiryCohorts.days30.propertyIds.push(l.propertyId);
          }
          if (diffDays <= 60) {
            leaseExpiryCohorts.days60.count++;
            if (l.unitId) leaseExpiryCohorts.days60.unitIds.push(l.unitId);
            leaseExpiryCohorts.days60.propertyIds.push(l.propertyId);
          }
          if (diffDays <= 90) {
            leaseExpiryCohorts.days90.count++;
            if (l.unitId) leaseExpiryCohorts.days90.unitIds.push(l.unitId);
            leaseExpiryCohorts.days90.propertyIds.push(l.propertyId);
          }
          leaseExpiryCohorts.days180.count++;
          if (l.unitId) leaseExpiryCohorts.days180.unitIds.push(l.unitId);
          leaseExpiryCohorts.days180.propertyIds.push(l.propertyId);
        }
      }
    }

    if (totalActiveLeases > 0) {
      leaseExpiryCohorts.days30.percentage = Math.round((leaseExpiryCohorts.days30.count / totalActiveLeases) * 1000) / 10;
      leaseExpiryCohorts.days60.percentage = Math.round((leaseExpiryCohorts.days60.count / totalActiveLeases) * 1000) / 10;
      leaseExpiryCohorts.days90.percentage = Math.round((leaseExpiryCohorts.days90.count / totalActiveLeases) * 1000) / 10;
      leaseExpiryCohorts.days180.percentage = Math.round((leaseExpiryCohorts.days180.count / totalActiveLeases) * 1000) / 10;
    }

    // Underperforming Signals Detection
    const underperformingSignals: UnderperformingSignal[] = [];
    for (const p of propertyMetricsList) {
      if (p.totalUnits === 0) {
        underperformingSignals.push({
          propertyId: p.propertyId,
          propertyName: p.propertyName,
          signal: 'DATA_GAP',
          metric: 'totalUnits',
          actualValue: 0,
          threshold: 1,
          severity: 'LOW',
          explanation: 'Property has 0 registered units. Add units to activate performance metrics.',
        });
      } else {
        if (p.occupancyRate !== null && p.occupancyRate < 75) {
          underperformingSignals.push({
            propertyId: p.propertyId,
            propertyName: p.propertyName,
            signal: 'HIGH_VACANCY',
            metric: 'occupancyRate',
            actualValue: `${p.occupancyRate}%`,
            threshold: '75%',
            severity: p.occupancyRate < 50 ? 'HIGH' : 'MEDIUM',
            explanation: `Occupancy rate (${p.occupancyRate}%) is below the healthy threshold (75%).`,
          });
        }
        if (p.delinquencyRate !== null && p.delinquencyRate > 15) {
          underperformingSignals.push({
            propertyId: p.propertyId,
            propertyName: p.propertyName,
            signal: 'HIGH_DELINQUENCY',
            metric: 'delinquencyRate',
            actualValue: `${p.delinquencyRate}%`,
            threshold: '15%',
            severity: 'HIGH',
            explanation: `Delinquency rate (${p.delinquencyRate}%) indicates delayed rent collections.`,
          });
        }
        if (p.netOperatingIncome < 0) {
          underperformingSignals.push({
            propertyId: p.propertyId,
            propertyName: p.propertyName,
            signal: 'NEGATIVE_NOI',
            metric: 'netOperatingIncome',
            actualValue: p.netOperatingIncome,
            threshold: 0,
            severity: 'CRITICAL',
            explanation: `Property is running at negative net operating income (${p.netOperatingIncome} ${reportingCurrency}).`,
          });
        }
      }
    }

    // Concentration Risk Calculations
    const assetTypeMap: Record<string, number> = {};
    const geoMap: Record<string, number> = {};
    let maxPropValue = 0;

    for (const p of propertyMetricsList) {
      assetTypeMap[p.type] = (assetTypeMap[p.type] || 0) + 1;
      const city = p.city || 'Unknown';
      geoMap[city] = (geoMap[city] || 0) + 1;
      const pVal = p.latestValuation?.estimatedValue || 0;
      if (pVal > maxPropValue) maxPropValue = pVal;
    }

    const topPropertyExposurePercent = (hasValuation && totalAssetValue > 0)
      ? Math.round((maxPropValue / totalAssetValue) * 1000) / 10
      : null;

    return {
      totalProperties: propIds.length,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      overallOccupancyRate,
      overallVacancyRate,
      totalAssetValue: hasValuation ? Math.round(totalAssetValue) : null,
      totalGrossRevenue: Math.round(totalGrossRevenue),
      totalOperatingExpenses: Math.round(totalOperatingExpenses),
      totalNetOperatingIncome: Math.round(totalNetOperatingIncome),
      portfolioGrossYield,
      portfolioNetYield,
      portfolioCapRate,
      overallCollectionRate,
      overallDelinquencyRate,
      totalArrears: Math.round(totalArrears),
      totalMaintenanceCost: Math.round(totalMaintenanceCost),
      totalCashFlow: Math.round(totalCashFlow),
      currency: reportingCurrency,
      leaseExpiryCohorts,
      underperformingSignals,
      concentrationRisk: {
        topPropertyExposurePercent,
        topTenantExposurePercent: null,
        assetTypeConcentration: assetTypeMap,
        geographicConcentration: geoMap,
      },
      reportingPeriod: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
      }
    };
  }

  /**
   * Property Comparison listing across caller's authorized portfolio
   */
  async getPortfolioPropertiesComparison(
    user: { id: string; organizationId?: string; roles: string[] },
    reportingCurrency: string = 'USD'
  ): Promise<PropertyPerformanceMetrics[]> {
    const scope = await analyticsRepository.resolveUserPropertyScope(user);
    const results: PropertyPerformanceMetrics[] = [];
    for (const pid of scope.propertyIds) {
      results.push(await this.getPropertyAnalytics(user, pid, reportingCurrency));
    }
    return results;
  }

  /**
   * Asset distributions by property type, geography, revenue, and occupancy
   */
  async getPortfolioDistributions(
    user: { id: string; organizationId?: string; roles: string[] },
    reportingCurrency: string = 'USD'
  ): Promise<PortfolioDistributions> {
    const propertiesList = await this.getPortfolioPropertiesComparison(user, reportingCurrency);
    const totalCount = propertiesList.length;

    const assetTypeCounts = new Map<string, { count: number; totalValue: number }>();
    const geoCounts = new Map<string, { count: number; totalValue: number }>();

    for (const p of propertiesList) {
      const val = p.latestValuation?.estimatedValue || 0;
      
      const typeData = assetTypeCounts.get(p.type) || { count: 0, totalValue: 0 };
      typeData.count++;
      typeData.totalValue += val;
      assetTypeCounts.set(p.type, typeData);

      const city = p.city || 'Unknown';
      const geoData = geoCounts.get(city) || { count: 0, totalValue: 0 };
      geoData.count++;
      geoData.totalValue += val;
      geoCounts.set(city, geoData);
    }

    const assetTypeDistribution = Array.from(assetTypeCounts.entries()).map(([key, data]) => ({
      key,
      label: key,
      count: data.count,
      percentage: totalCount > 0 ? Math.round((data.count / totalCount) * 1000) / 10 : 0,
      totalValue: Math.round(data.totalValue),
    }));

    const geographicDistribution = Array.from(geoCounts.entries()).map(([key, data]) => ({
      key,
      label: key,
      count: data.count,
      percentage: totalCount > 0 ? Math.round((data.count / totalCount) * 1000) / 10 : 0,
      totalValue: Math.round(data.totalValue),
    }));

    const totalRev = propertiesList.reduce((acc, p) => acc + p.grossScheduledRent, 0);
    const revenueDistribution = propertiesList.map(p => ({
      propertyId: p.propertyId,
      propertyName: p.propertyName,
      revenue: p.grossScheduledRent,
      percentage: totalRev > 0 ? Math.round((p.grossScheduledRent / totalRev) * 1000) / 10 : 0,
    }));

    // Occupancy buckets: 0-50%, 51-80%, 81-100%, No Units
    const occupancyDistribution = [
      { bucket: '0% - 50%', count: propertiesList.filter(p => p.occupancyRate !== null && p.occupancyRate <= 50).length },
      { bucket: '51% - 80%', count: propertiesList.filter(p => p.occupancyRate !== null && p.occupancyRate > 50 && p.occupancyRate <= 80).length },
      { bucket: '81% - 100%', count: propertiesList.filter(p => p.occupancyRate !== null && p.occupancyRate > 80).length },
      { bucket: 'No Units Registered', count: propertiesList.filter(p => p.totalUnits === 0).length },
    ];

    return {
      currency: reportingCurrency,
      assetTypeDistribution,
      geographicDistribution,
      revenueDistribution,
      occupancyDistribution,
    };
  }

  /**
   * Capture an immutable historical portfolio snapshot for authorized owner or company
   */
  async capturePortfolioSnapshot(
    user: { id: string; organizationId?: string; roles: string[] },
    reportingCurrency: string = 'USD'
  ): Promise<PortfolioSnapshotItem> {
    const overview = await this.getPortfolioOverview(user, reportingCurrency);
    const today = new Date().toISOString().slice(0, 10);

    const snapshot = await analyticsRepository.insertPortfolioSnapshot({
      ownerId: user.organizationId ? null : user.id,
      companyId: user.organizationId || null,
      snapshotDate: today,
      totalProperties: overview.totalProperties,
      totalUnits: overview.totalUnits,
      occupancyRate: String(overview.overallOccupancyRate || 0),
      grossRevenue: String(overview.totalGrossRevenue),
      operatingExpenses: String(overview.totalOperatingExpenses),
      netOperatingIncome: String(overview.totalNetOperatingIncome),
      totalAssetValue: overview.totalAssetValue ? String(overview.totalAssetValue) : null,
      currency: reportingCurrency,
    });

    return {
      id: snapshot.id,
      ownerId: snapshot.ownerId,
      companyId: snapshot.companyId,
      snapshotDate: snapshot.snapshotDate,
      totalProperties: snapshot.totalProperties,
      totalUnits: snapshot.totalUnits,
      occupancyRate: Number(snapshot.occupancyRate),
      grossRevenue: Number(snapshot.grossRevenue),
      operatingExpenses: Number(snapshot.operatingExpenses),
      netOperatingIncome: Number(snapshot.netOperatingIncome),
      totalAssetValue: snapshot.totalAssetValue ? Number(snapshot.totalAssetValue) : null,
      currency: snapshot.currency,
      createdAt: snapshot.createdAt,
    };
  }

  /**
   * Get historical portfolio snapshots for caller's authorized scope
   */
  async getPortfolioSnapshots(
    user: { id: string; organizationId?: string; roles: string[] },
    startDate?: string,
    endDate?: string
  ): Promise<PortfolioSnapshotItem[]> {
    const ownerId = user.organizationId ? undefined : user.id;
    const companyId = user.organizationId || undefined;

    const records = await analyticsRepository.getPortfolioSnapshots(ownerId, companyId, startDate, endDate);
    return records.map(r => ({
      id: r.id,
      ownerId: r.ownerId,
      companyId: r.companyId,
      snapshotDate: r.snapshotDate,
      totalProperties: r.totalProperties,
      totalUnits: r.totalUnits,
      occupancyRate: Number(r.occupancyRate),
      grossRevenue: Number(r.grossRevenue),
      operatingExpenses: Number(r.operatingExpenses),
      netOperatingIncome: Number(r.netOperatingIncome),
      totalAssetValue: r.totalAssetValue ? Number(r.totalAssetValue) : null,
      currency: r.currency,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Internal HomeHub Market Intelligence.
   * Derives benchmarks exclusively from real internal platform contracts and leases.
   */
  async getInternalMarketBenchmarks(city: string = 'Erbil'): Promise<InternalMarketBenchmark[]> {
    const sales = await analyticsRepository.getInternalMarketSales();
    const rentals = await analyticsRepository.getInternalMarketRentals();

    const benchmarks: InternalMarketBenchmark[] = [];
    const types = ['APARTMENT', 'VILLA', 'COMMERCIAL'];

    for (const pType of types) {
      // Filter sales by city and type
      const filteredSales = sales.filter(s => 
        ((s.address as any)?.city?.toLowerCase() === city.toLowerCase()) && 
        s.propertyType?.toUpperCase() === pType &&
        Number(s.agreedPrice) > 0 && 
        (s.squareFeet || 0) > 0
      );

      const salePricesPerSqm = filteredSales.map(s => {
        const sqm = (s.squareFeet || 1) / ValuationService.SQFT_PER_SQM;
        return Number(s.agreedPrice) / sqm;
      });

      const avgSaleSqm = salePricesPerSqm.length > 0 
        ? Math.round(salePricesPerSqm.reduce((a, b) => a + b, 0) / salePricesPerSqm.length) 
        : null;

      salePricesPerSqm.sort((a, b) => a - b);
      const medianSaleSqm = salePricesPerSqm.length > 0 
        ? Math.round(salePricesPerSqm[Math.floor(salePricesPerSqm.length / 2)]) 
        : null;

      // Filter leases by city and type
      const filteredLeases = rentals.activeLeases.filter(l => 
        ((l.address as any)?.city?.toLowerCase() === city.toLowerCase()) && 
        l.propertyType?.toUpperCase() === pType &&
        Number(l.rentAmount) > 0 && 
        (l.squareFeet || 0) > 0
      );

      const rentPerSqm = filteredLeases.map(l => {
        const sqm = (l.squareFeet || 1) / ValuationService.SQFT_PER_SQM;
        return Number(l.rentAmount) / sqm;
      });

      const avgRentSqm = rentPerSqm.length > 0 
        ? Math.round(rentPerSqm.reduce((a, b) => a + b, 0) / rentPerSqm.length) 
        : null;

      rentPerSqm.sort((a, b) => a - b);
      const medianRentSqm = rentPerSqm.length > 0 
        ? Math.round(rentPerSqm[Math.floor(rentPerSqm.length / 2)]) 
        : null;

      const activeListingsCount = rentals.publishedListings.filter(pl => 
        ((pl.address as any)?.city?.toLowerCase() === city.toLowerCase()) &&
        pl.propertyType?.toUpperCase() === pType
      ).length;

      benchmarks.push({
        city,
        propertyType: pType,
        averageSalePricePerSqm: avgSaleSqm,
        medianSalePricePerSqm: medianSaleSqm,
        averageRentPerSqm: avgRentSqm,
        medianRentPerSqm: medianRentSqm,
        sampleSalesCount: filteredSales.length,
        sampleLeasesCount: filteredLeases.length,
        activeListingsCount,
        currency: 'USD',
        dataSourceNotice: 'HOMEHUB INTERNAL TRANSACTIONAL DATA ONLY. External MLS / Land Registry feeds remain pending.',
      });
    }

    return benchmarks;
  }

  /**
   * Advisory AI Insights Generator.
   * Strictly advisory and non-executable. Explains metrics and flags anomalies.
   */
  async generateAdvisoryInsights(
    user: { id: string; organizationId?: string; roles: string[] },
    reportingCurrency: string = 'USD'
  ): Promise<AIAdvisoryInsight[]> {
    const overview = await this.getPortfolioOverview(user, reportingCurrency);
    const insights: AIAdvisoryInsight[] = [];
    const timestamp = new Date().toISOString();

    // 1. Performance Overview Insight
    insights.push({
      id: `ai_ins_perf_${Date.now()}_1`,
      category: 'PERFORMANCE',
      headline: `Portfolio Performance: ${overview.totalProperties} properties with ${overview.overallOccupancyRate ?? 0}% occupancy`,
      headlineKurdish: `ڕاپۆرتی گشتی پۆرتفۆلیۆ: ${overview.totalProperties} موڵک بە ڕێژەی پڕبوونی ${overview.overallOccupancyRate ?? 0}٪`,
      headlineArabic: `أداء المحفظة العقارية: ${overview.totalProperties} عقارات بنسبة إشغال ${overview.overallOccupancyRate ?? 0}٪`,
      explanation: `Total portfolio gross revenue is ${overview.totalGrossRevenue.toLocaleString()} ${reportingCurrency} with a Net Operating Income (NOI) of ${overview.totalNetOperatingIncome.toLocaleString()} ${reportingCurrency}.`,
      explanationKurdish: `کۆی داهاتی پۆرتفۆلیۆ بریتییە لە ${overview.totalGrossRevenue.toLocaleString()} ${reportingCurrency} و داهاتی پوختی کارپێکردن (NOI) بریتییە لە ${overview.totalNetOperatingIncome.toLocaleString()} ${reportingCurrency}.`,
      explanationArabic: `إجمالي إيرادات المحفظة يبلغ ${overview.totalGrossRevenue.toLocaleString()} ${reportingCurrency} مع صافي دخل تشغيلي (NOI) يبلغ ${overview.totalNetOperatingIncome.toLocaleString()} ${reportingCurrency}.`,
      supportingMetrics: {
        totalProperties: overview.totalProperties,
        occupancyRate: overview.overallOccupancyRate,
        noi: overview.totalNetOperatingIncome,
        capRate: overview.portfolioCapRate,
      },
      proposedHumanAction: 'Review underperforming units and verify rent schedule collection status.',
      isAdvisoryOnly: true,
      humanReviewRequired: true,
      generatedAt: timestamp,
    });

    // 2. Lease Expiry Reminder
    if (overview.leaseExpiryCohorts.days60.count > 0) {
      insights.push({
        id: `ai_ins_lease_${Date.now()}_2`,
        category: 'LEASE_EXPIRY',
        headline: `${overview.leaseExpiryCohorts.days60.count} leases expiring within 60 days`,
        headlineKurdish: `${overview.leaseExpiryCohorts.days60.count} گرێبەستی کرێ لە ماوەی ٦٠ ڕۆژدا بەسەردەچن`,
        headlineArabic: `${overview.leaseExpiryCohorts.days60.count} عقود إيجار تنتهي خلال 60 يوماً`,
        explanation: 'Early lease renewal outreach is recommended to minimize vacancy and stabilize rental cash flow.',
        explanationKurdish: 'پێشنیاز دەکرێت پەیوەندی بە کرێچییەکانەوە بکرێت بۆ نوێکردنەوەی گرێبەست بەر لە دروستبوونی بەتاڵی.',
        explanationArabic: 'يوصى بالتواصل المبكر لتجديد العقود لتقليل فترة الشغور واستقرار التدفق النقدي.',
        supportingMetrics: {
          expiringCount: overview.leaseExpiryCohorts.days60.count,
          affectedProperties: overview.leaseExpiryCohorts.days60.propertyIds,
        },
        proposedHumanAction: 'Initiate draft lease renewal agreements via HomeHub contract workflow.',
        isAdvisoryOnly: true,
        humanReviewRequired: true,
        generatedAt: timestamp,
      });
    }

    // 3. Arrears Anomaly Flag
    if (overview.totalArrears > 0) {
      insights.push({
        id: `ai_ins_arrears_${Date.now()}_3`,
        category: 'EXPENSE_ALERT',
        headline: `Outstanding rent arrears: ${overview.totalArrears.toLocaleString()} ${reportingCurrency}`,
        headlineKurdish: `بڕی کرێی دواکەوتوو: ${overview.totalArrears.toLocaleString()} ${reportingCurrency}`,
        headlineArabic: `متأخرات إيجار مستحقة: ${overview.totalArrears.toLocaleString()} ${reportingCurrency}`,
        explanation: `Delinquency rate is currently at ${overview.overallDelinquencyRate}%. Review the arrears aging schedule to take appropriate collection steps.`,
        explanationKurdish: `ڕێژەی دواکەوتنی پارەدان گەیشتووەتە ${overview.overallDelinquencyRate}٪. خشتەی دابەشبوونی ڕۆژەکان بپشکنە بۆ بەدواداچوونی پێویست.`,
        explanationArabic: `نسبة التأخر في السداد تبلغ حالياً ${overview.overallDelinquencyRate}٪. يرجى مراجعة جدول أعمار الديون لاتخاذ الإجراءات اللازمة.`,
        supportingMetrics: {
          totalArrears: overview.totalArrears,
          delinquencyRate: overview.overallDelinquencyRate,
        },
        proposedHumanAction: 'Send payment reminders to overdue tenants through the tenant portal.',
        isAdvisoryOnly: true,
        humanReviewRequired: true,
        generatedAt: timestamp,
      });
    }

    return insights;
  }
}

export const analyticsService = new AnalyticsService();
