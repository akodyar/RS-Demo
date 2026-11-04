/**
 * HomeHub — Production-Guarded Safe Cross-Domain Demo Data Seeder
 * 
 * INVARIANTS & SAFETY GUARANTEES:
 * 1. Hard fail-closed safety gate: Will throw and immediately abort if NODE_ENV === 'production'
 *    or target database is 'homehub_production' or ambiguous.
 * 2. Strict rental-only release scope: Buying and selling records are strictly excluded.
 * 3. Authoritative 3-fee model: Reconciles financial_policies (PLATFORM_FEE_RATE = 2%),
 *    property-level fees (Rent Fee = 5%, Management Fee = 3%), and double-entry ledger lines.
 * 4. Idempotent & deterministic: Uses deterministic IDs (demo_*) and ON CONFLICT DO UPDATE
 *    to guarantee safe re-runs with zero duplicate errors or state corruption.
 * 5. Access boundaries preserved: Generates cross-domain scenarios across Owner, Company,
 *    Tenant, Vendor, and Admin workspaces without weakening RBAC or IDOR controls.
 */

import dotenv from 'dotenv';
dotenv.config();

import { db, pool, closePool } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { sql, and, eq } from 'drizzle-orm';
import { hashPassword } from '../src/server/utils/auth.js';

// ============================================================================
// PHASE 0: HARD FAIL-CLOSED SAFETY GATES
// ============================================================================
export function assertSafeEnvironmentForSeed(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    throw new Error('CRITICAL SAFETY GATE: Demo data seeding is fundamentally forbidden in PRODUCTION environment (NODE_ENV=production). Aborting.');
  }

  const targetDb = process.env.SQL_DB_NAME;
  if (!targetDb || targetDb === 'homehub_production' || targetDb.toLowerCase().includes('prod')) {
    throw new Error(`CRITICAL SAFETY GATE: SQL_DB_NAME must explicitly target a development/test database (e.g. 'homehub_test' or 'homehub_dev'). Current target: '${targetDb || 'UNSET'}'. Aborting.`);
  }

  if (process.env.DATABASE_URL) {
    try {
      const parsedUrl = new URL(process.env.DATABASE_URL);
      if (parsedUrl.pathname === '/homehub_production' || parsedUrl.pathname.toLowerCase().includes('prod')) {
        throw new Error(`CRITICAL SAFETY GATE: DATABASE_URL targets production database '${parsedUrl.pathname}'. Aborting.`);
      }
    } catch (e: any) {
      if (e.message?.includes('CRITICAL SAFETY GATE')) throw e;
      throw new Error(`CRITICAL SAFETY GATE: DATABASE_URL is malformed. Aborting.`);
    }
  }
}

// Track seeding metrics
export interface SeedSummary {
  users: number;
  organizations: number;
  organizationMembers: number;
  financialPolicies: number;
  properties: number;
  units: number;
  ownershipRecords: number;
  managementAgreements: number;
  leases: number;
  leaseTenants: number;
  rentSchedules: number;
  paymentRecords: number;
  commissions: number;
  journalEntries: number;
  ledgerLines: number;
  securityDeposits: number;
  utilityBills: number;
  maintenanceRequests: number;
  maintenanceQuotes: number;
  workOrders: number;
  vendorProfiles: number;
  documents: number;
  conversations: number;
  messages: number;
  notifications: number;
  listings: number;
  rentalApplications: number;
  agentProfiles: number;
  agentLicenses: number;
  agentPropertyAssignments: number;
  agentLeads: number;
  agentTasks: number;
  propertyInquiries: number;
  propertyViewings: number;
  agentEvents: number;
  chartOfAccounts: number;
}

export async function runDemoSeed(): Promise<SeedSummary> {
  assertSafeEnvironmentForSeed();

  console.log('================================================================');
  console.log('  HOMEHUB — SAFE CROSS-DOMAIN DEMO DATA INITIALIZATION');
  console.log(`  Target Database: ${process.env.SQL_DB_NAME}`);
  console.log(`  Environment:     ${process.env.NODE_ENV || 'development'}`);
  console.log('================================================================\n');

  const summary: SeedSummary = {
    users: 0,
    organizations: 0,
    organizationMembers: 0,
    financialPolicies: 0,
    chartOfAccounts: 0,
    properties: 0,
    units: 0,
    ownershipRecords: 0,
    managementAgreements: 0,
    leases: 0,
    leaseTenants: 0,
    rentSchedules: 0,
    paymentRecords: 0,
    commissions: 0,
    journalEntries: 0,
    ledgerLines: 0,
    securityDeposits: 0,
    utilityBills: 0,
    maintenanceRequests: 0,
    maintenanceQuotes: 0,
    workOrders: 0,
    vendorProfiles: 0,
    documents: 0,
    conversations: 0,
    messages: 0,
    notifications: 0,
    listings: 0,
    rentalApplications: 0,
    agentProfiles: 0,
    agentLicenses: 0,
    agentPropertyAssignments: 0,
    agentLeads: 0,
    agentTasks: 0,
    propertyInquiries: 0,
    propertyViewings: 0,
    agentEvents: 0,
  };

  // --------------------------------------------------------------------------
  // 1. SEED FINANCIAL POLICIES (Authoritative 3-Fee Model)
  // --------------------------------------------------------------------------
  console.log('1. Seeding authoritative financial policies...');
  await db.insert(schema.financialPolicies).values([
    {
      id: 'demo_policy_platform_fee',
      policyType: 'PLATFORM_FEE_RATE',
      policyValue: '0.02', // 2% Global Platform Fee
      currency: null,
      active: true,
      description: 'HomeHub authoritative global platform fee rate (2.0%)',
    },
    {
      id: 'demo_policy_max_spending_limit',
      policyType: 'DEFAULT_SPENDING_LIMIT',
      policyValue: '1000000', // 1,000,000 IQD default approval threshold
      currency: 'IQD',
      active: true,
      description: 'Default maintenance spending approval threshold',
    },
    {
      id: 'demo_policy_exchange_rate_iqd',
      policyType: 'EXCHANGE_RATE_IQD',
      policyValue: '1310', // 1,310 IQD per USD
      currency: 'IQD',
      active: true,
      description: 'Authoritative currency exchange rate peg (1,310 IQD per 1 USD)',
    }
  ]).onConflictDoUpdate({
    target: schema.financialPolicies.policyType,
    set: {
      policyValue: sql`EXCLUDED.policy_value`,
      active: sql`EXCLUDED.active`,
      updatedAt: new Date(),
    }
  });
  summary.financialPolicies = 3;

  // --------------------------------------------------------------------------
  // 1b. SEED CANONICAL CHART OF ACCOUNTS (Double-Entry Invariant Authority)
  // --------------------------------------------------------------------------
  console.log('1b. Seeding canonical chart of accounts...');
  await db.insert(schema.chartOfAccounts).values([
    {
      id: 'demo_coa_1010',
      code: '1010',
      name: 'Operating Cash',
      description: 'Operating bank and cash collection accounts',
      accountType: 'ASSET',
      currency: 'IQD',
      active: true,
      systemAccount: true,
    },
    {
      id: 'demo_coa_1200',
      code: '1200',
      name: 'Tenant Accounts Receivable',
      description: 'Outstanding rent receivables and tenant collection clearing',
      accountType: 'ASSET',
      currency: 'IQD',
      active: true,
      systemAccount: true,
    },
    {
      id: 'demo_coa_2000',
      code: '2000',
      name: 'Trade Accounts Payable',
      description: 'Outstanding vendor and contractor liabilities for operational expenses',
      accountType: 'LIABILITY',
      currency: 'IQD',
      active: true,
      systemAccount: true,
    },
    {
      id: 'demo_coa_2010',
      code: '2010',
      name: 'Owner Net Entitlement Payable',
      description: 'Net rental income collected and payable to property owners',
      accountType: 'LIABILITY',
      currency: 'IQD',
      active: true,
      systemAccount: true,
    },
    {
      id: 'demo_coa_2100',
      code: '2100',
      name: 'Security Deposits Liability',
      description: 'Custodial tenant security deposit funds held in escrow',
      accountType: 'LIABILITY',
      currency: 'IQD',
      active: true,
      systemAccount: true,
    },
    {
      id: 'demo_coa_4000',
      code: '4000',
      name: 'Gross Rent Clearing',
      description: 'Gross rent clearing and allocation source (non-corporate revenue transit account)',
      accountType: 'LIABILITY',
      currency: 'IQD',
      active: true,
      systemAccount: true,
    },
    {
      id: 'demo_coa_4010',
      code: '4010',
      name: 'Platform Fee Revenue',
      description: 'HomeHub platform technology service fee revenue',
      accountType: 'REVENUE',
      currency: 'IQD',
      active: true,
      systemAccount: true,
    },
    {
      id: 'demo_coa_4011',
      code: '4011',
      name: 'Rent Fee Revenue',
      description: 'HomeHub rent collection service fee revenue',
      accountType: 'REVENUE',
      currency: 'IQD',
      active: true,
      systemAccount: true,
    },
    {
      id: 'demo_coa_4012',
      code: '4012',
      name: 'Management Fee Revenue',
      description: 'HomeHub property management service fee revenue',
      accountType: 'REVENUE',
      currency: 'IQD',
      active: true,
      systemAccount: true,
    },
    {
      id: 'demo_coa_5000',
      code: '5000',
      name: 'Operating Expenses',
      description: 'Property and platform operational expenses',
      accountType: 'EXPENSE',
      currency: 'IQD',
      active: true,
      systemAccount: true,
    },
  ]).onConflictDoUpdate({
    target: schema.chartOfAccounts.code,
    set: {
      name: sql`EXCLUDED.name`,
      description: sql`EXCLUDED.description`,
      accountType: sql`EXCLUDED.account_type`,
      currency: sql`EXCLUDED.currency`,
      active: true,
      systemAccount: true,
      updatedAt: new Date(),
    }
  });
  summary.chartOfAccounts = 9;

  // --------------------------------------------------------------------------
  // 2. SEED USERS (Authoritative Dev Personas)
  // --------------------------------------------------------------------------
  console.log('2. Seeding development personas & test users...');
  const usersToSeed = [
    {
      id: 'user_owner_01',
      firstName: 'Salar',
      lastName: 'Aziz',
      email: 'owner@homehub.iq',
      phone: '+964 750 111 2233',
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    },
    {
      id: 'user_owner_02',
      firstName: 'Karwan',
      lastName: 'Sleman',
      email: 'owner_b@homehub.iq',
      phone: '+964 750 111 4455',
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    },
    {
      id: 'user_company_01',
      firstName: 'Zagros',
      lastName: 'Admin',
      email: 'company@homehub.iq',
      phone: '+964 750 222 3344',
      roles: ['COMPANY', 'COMPANY_MEMBER', 'COMPANY_ADMIN'],
      isActive: true,
    },
    {
      id: 'user_agent_01',
      firstName: 'Ahmed',
      lastName: 'Rahman',
      email: 'agent@homehub.iq',
      phone: '+964 750 333 4455',
      roles: ['AGENT_BROKER', 'COMPANY_MEMBER'],
      isActive: true,
    },
    {
      id: 'user_tenant_01',
      firstName: 'Ahmed',
      lastName: 'Farhad',
      email: 'tenant@homehub.iq',
      phone: '+964 750 444 5566',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: 'user_tenant_b_01',
      firstName: 'Dana',
      lastName: 'Bakir',
      email: 'tenant_b@homehub.iq',
      phone: '+964 750 555 6677',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: 'user_tenant_expiring',
      firstName: 'Rezan',
      lastName: 'Jamal',
      email: 'tenant_expiring@homehub.iq',
      phone: '+964 750 666 7788',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: 'user_tenant_inactive_01',
      firstName: 'Aram',
      lastName: 'Kawa',
      email: 'tenant_inactive@homehub.iq',
      phone: '+964 750 777 0011',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: 'user_vendor_01',
      firstName: 'Dilshad',
      lastName: 'Qadir',
      email: 'vendor@homehub.iq',
      phone: '+964 750 777 8899',
      roles: ['VENDOR'],
      isActive: true,
    },
    {
      id: 'admin_user_01',
      firstName: 'Platform',
      lastName: 'SuperAdmin',
      email: 'superadmin@homehub.iq',
      phone: '+964 750 999 0001',
      roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'FINANCE_ADMIN', 'SECURITY_ADMIN'],
      isActive: true,
    },
    {
      id: 'admin_user_02',
      firstName: 'Platform',
      lastName: 'Admin',
      email: 'admin@homehub.iq',
      phone: '+964 750 999 0002',
      roles: ['PLATFORM_ADMIN', 'ADMIN'],
      isActive: true,
    },
  ];

  const defaultPasswordHash = await hashPassword('password123');
  for (const u of usersToSeed) {
    await db.insert(schema.users).values({ ...u, passwordHash: defaultPasswordHash }).onConflictDoUpdate({
      target: schema.users.id,
      set: {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        roles: u.roles,
        isActive: u.isActive,
        passwordHash: defaultPasswordHash,
        updatedAt: new Date(),
      }
    });
  }
  summary.users = usersToSeed.length;

  // --------------------------------------------------------------------------
  // 3. SEED ORGANIZATIONS & MEMBERSHIPS
  // --------------------------------------------------------------------------
  console.log('3. Seeding organizations & company memberships...');
  const orgsToSeed = [
    {
      id: 'org_company_01',
      name: 'Zagros Real Estate',
      legalName: 'Zagros Real Estate & Property Management LLC',
      type: 'COMPANY',
      registrationNumber: 'KR-EBL-2023-8841',
      taxId: 'TX-992384',
      email: 'company@homehub.iq',
      phone: '+964 750 222 3344',
      serviceArea: 'Erbil & Surroundings',
      serviceCategories: ['PROPERTY_MANAGEMENT', 'LEASING', 'MAINTENANCE'],
      teamSize: '10-25',
      spendingLimitDefault: '1500000',
      status: 'VERIFIED',
      verified: true,
      address: {
        street: 'Gulan Street, Prime Tower 7th Floor',
        city: 'Erbil',
        region: 'Kurdistan Region',
        country: 'Iraq',
      },
    },
    {
      id: 'org_vendor_01',
      name: 'Erbil Quick Fix Services',
      legalName: 'Erbil Quick Fix Technical Services Co.',
      type: 'VENDOR',
      registrationNumber: 'KR-VND-2024-1102',
      email: 'vendor@homehub.iq',
      phone: '+964 750 777 8899',
      serviceArea: 'Erbil Metropolitan Area',
      serviceCategories: ['PLUMBING', 'ELECTRICAL', 'HVAC'],
      teamSize: '5-10',
      status: 'VERIFIED',
      verified: true,
      address: {
        street: '100m Road, Industrial Zone Sector 3',
        city: 'Erbil',
        region: 'Kurdistan Region',
        country: 'Iraq',
      },
    }
  ];

  for (const org of orgsToSeed) {
    await db.insert(schema.organizations).values(org).onConflictDoUpdate({
      target: schema.organizations.id,
      set: {
        name: org.name,
        legalName: org.legalName,
        type: org.type,
        status: org.status,
        verified: org.verified,
        spendingLimitDefault: org.spendingLimitDefault,
        address: org.address,
        updatedAt: new Date(),
      }
    });
  }
  summary.organizations = orgsToSeed.length;

  const membersToSeed = [
    {
      id: 'demo_member_company_admin',
      organizationId: 'org_company_01',
      userId: 'user_company_01',
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    },
    {
      id: 'demo_member_company_agent',
      organizationId: 'org_company_01',
      userId: 'user_agent_01',
      role: 'AGENT',
      status: 'ACTIVE',
    },
  ];

  for (const mem of membersToSeed) {
    await db.insert(schema.organizationMembers).values(mem).onConflictDoUpdate({
      target: schema.organizationMembers.id,
      set: {
        organizationId: mem.organizationId,
        userId: mem.userId,
        role: mem.role,
        status: mem.status,
        updatedAt: new Date(),
      }
    });
  }
  summary.organizationMembers = membersToSeed.length;

  // --------------------------------------------------------------------------
  // 4. SEED PROPERTIES & UNITS
  // --------------------------------------------------------------------------
  console.log('4. Seeding properties & units...');
  const propertiesToSeed = [
    {
      id: 'demo_prop_01',
      name: 'Zagros Heights Luxury Tower',
      type: 'RESIDENTIAL',
      yearBuilt: 2023,
      squareFeet: 5200,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      currency: 'IQD',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.05',       // 5% property-agreed rent fee
      managementFee: '0.03', // 3% property-agreed management fee
      managedByAgentId: 'org_company_01',
      address: {
        street: 'Gulan Street, Building 42',
        city: 'Erbil',
        region: 'Kurdistan Region',
        country: 'Iraq',
        postalCode: '44001',
        imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80',
        photos: [
          'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80'
        ],
        amenities: ['Elevator', '24/7 Security', 'Underground Parking', '24/7 Generator', 'Central AC'],
      },
    },
    {
      id: 'demo_prop_02',
      name: 'Dream City Executive Villa',
      type: 'RESIDENTIAL',
      yearBuilt: 2022,
      squareFeet: 3400,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      currency: 'IQD',
      operatingModel: 'AGENT_OPERATED', // Self-managed by owner
      rentFee: '0.00',
      managementFee: '0.00',
      managedByAgentId: null,
      address: {
        street: 'Dream City Complex, Villa 18',
        city: 'Erbil',
        region: 'Kurdistan Region',
        country: 'Iraq',
        postalCode: '44002',
        imageUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1000&q=80',
        photos: [
          'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1000&q=80'
        ],
        amenities: ['Private Garden', 'Swimming Pool', 'Solar Backup', 'Smart Home System'],
      },
    },
    {
      id: 'demo_prop_03',
      name: 'Slemani View Luxury Residences',
      type: 'RESIDENTIAL',
      yearBuilt: 2024,
      squareFeet: 4800,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      currency: 'IQD',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.04',       // 4% property-agreed rent fee
      managementFee: '0.04', // 4% property-agreed management fee
      managedByAgentId: 'org_company_01',
      address: {
        street: 'Malik Mahmood Ring Road, Building 8',
        city: 'Sulaymaniyah',
        region: 'Kurdistan Region',
        country: 'Iraq',
        postalCode: '46001',
        imageUrl: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=1000&q=80',
        photos: [
          'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80'
        ],
        amenities: ['Panoramic Mountain View', 'Elevator', '24/7 Security', 'Backup Generator', 'Fitness Center'],
      },
    },
    {
      id: 'demo_prop_04',
      name: 'Empire World Business Plaza 3',
      type: 'COMMERCIAL',
      yearBuilt: 2023,
      squareFeet: 6500,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      currency: 'USD',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.06',       // 6% commercial rent fee
      managementFee: '0.02', // 2% management fee
      managedByAgentId: 'org_company_01',
      address: {
        street: '100M Road, Empire World Plaza 3',
        city: 'Erbil',
        region: 'Kurdistan Region',
        country: 'Iraq',
        postalCode: '44003',
        imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80',
        photos: [
          'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=80'
        ],
        amenities: ['High-Speed Fiber', 'Conference Rooms', 'Underground Valet', '24/7 Access Control', 'HVAC Automation'],
      },
    },
    {
      id: 'demo_prop_05',
      name: 'Duhok Valley Panorama Villas',
      type: 'RESIDENTIAL',
      yearBuilt: 2024,
      squareFeet: 4200,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      currency: 'IQD',
      operatingModel: 'AGENT_OPERATED', // Self-managed by owner
      rentFee: '0.00',
      managementFee: '0.00',
      managedByAgentId: null,
      address: {
        street: 'Malta Heights, Valley Road 14',
        city: 'Duhok',
        region: 'Kurdistan Region',
        country: 'Iraq',
        postalCode: '42001',
        imageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1000&q=80',
        photos: [
          'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1000&q=80'
        ],
        amenities: ['Private Courtyard', 'Mountain Overlook', 'Dedicated Generator', 'Water Cistern'],
      },
    }
  ];

  for (const prop of propertiesToSeed) {
    await db.insert(schema.properties).values(prop).onConflictDoUpdate({
      target: schema.properties.id,
      set: {
        name: prop.name,
        type: prop.type,
        yearBuilt: prop.yearBuilt,
        squareFeet: prop.squareFeet,
        status: prop.status,
        verificationStatus: 'VERIFIED',
        currency: prop.currency,
        operatingModel: prop.operatingModel,
        rentFee: prop.rentFee,
        managementFee: prop.managementFee,
        managedByAgentId: prop.managedByAgentId,
        address: prop.address,
        updatedAt: new Date(),
      }
    });
  }
  summary.properties = propertiesToSeed.length;

  const unitsToSeed = [
    {
      id: 'demo_unit_101',
      propertyId: 'demo_prop_01',
      unitNumber: '101',
      beds: 2,
      baths: '2.0',
      squareFeet: 1250,
      status: 'OCCUPIED',
      marketRent: '1200000',
      currency: 'IQD',
    },
    {
      id: 'demo_unit_102',
      propertyId: 'demo_prop_01',
      unitNumber: '102',
      beds: 3,
      baths: '2.5',
      squareFeet: 1600,
      status: 'VACANT',
      marketRent: '1500000',
      currency: 'IQD',
    },
    {
      id: 'demo_unit_103',
      propertyId: 'demo_prop_01',
      unitNumber: '103',
      beds: 1,
      baths: '1.0',
      squareFeet: 850,
      status: 'OCCUPIED',
      marketRent: '800000',
      currency: 'IQD',
    },
    {
      id: 'demo_unit_201',
      propertyId: 'demo_prop_02',
      unitNumber: 'V-01',
      beds: 4,
      baths: '4.0',
      squareFeet: 3400,
      status: 'OCCUPIED',
      marketRent: '2500000',
      currency: 'IQD',
    },
    {
      id: 'demo_unit_202',
      propertyId: 'demo_prop_02',
      unitNumber: 'V-02',
      beds: 4,
      baths: '4.0',
      squareFeet: 3200,
      status: 'VACANT',
      marketRent: '2400000',
      currency: 'IQD',
    },
    {
      id: 'demo_unit_301',
      propertyId: 'demo_prop_03',
      unitNumber: '301',
      beds: 2,
      baths: '2.0',
      squareFeet: 1300,
      status: 'OCCUPIED',
      marketRent: '900000',
      currency: 'IQD',
    },
    {
      id: 'demo_unit_302',
      propertyId: 'demo_prop_03',
      unitNumber: '302',
      beds: 3,
      baths: '2.5',
      squareFeet: 1550,
      status: 'OCCUPIED',
      marketRent: '1100000',
      currency: 'IQD',
    },
    {
      id: 'demo_unit_303',
      propertyId: 'demo_prop_03',
      unitNumber: '303',
      beds: 1,
      baths: '1.0',
      squareFeet: 800,
      status: 'VACANT',
      marketRent: '750000',
      currency: 'IQD',
    },
    {
      id: 'demo_unit_401',
      propertyId: 'demo_prop_04',
      unitNumber: 'Suite-401',
      beds: 0,
      baths: '2.0',
      squareFeet: 2100,
      status: 'OCCUPIED',
      marketRent: '2800',
      currency: 'USD',
    },
    {
      id: 'demo_unit_402',
      propertyId: 'demo_prop_04',
      unitNumber: 'Suite-402',
      beds: 0,
      baths: '2.0',
      squareFeet: 1750,
      status: 'VACANT',
      marketRent: '2200',
      currency: 'USD',
    },
    {
      id: 'demo_unit_501',
      propertyId: 'demo_prop_05',
      unitNumber: 'Villa-A',
      beds: 5,
      baths: '5.0',
      squareFeet: 4200,
      status: 'OCCUPIED',
      marketRent: '2000000',
      currency: 'IQD',
    },
    {
      id: 'demo_unit_502',
      propertyId: 'demo_prop_05',
      unitNumber: 'Villa-B',
      beds: 4,
      baths: '4.0',
      squareFeet: 3600,
      status: 'VACANT',
      marketRent: '1800000',
      currency: 'IQD',
    }
  ];

  for (const unit of unitsToSeed) {
    await db.insert(schema.units).values(unit).onConflictDoUpdate({
      target: schema.units.id,
      set: {
        propertyId: unit.propertyId,
        unitNumber: unit.unitNumber,
        beds: unit.beds,
        baths: unit.baths,
        squareFeet: unit.squareFeet,
        status: unit.status,
        marketRent: unit.marketRent,
        currency: unit.currency,
      }
    });
  }
  summary.units = unitsToSeed.length;

  // --------------------------------------------------------------------------
  // 5. SEED OWNERSHIP RECORDS & MANAGEMENT AGREEMENTS
  // --------------------------------------------------------------------------
  console.log('5. Seeding ownership records & management agreements...');
  const ownershipToSeed = [
    {
      id: 'demo_own_01',
      propertyId: 'demo_prop_01',
      ownerId: 'user_owner_01',
      ownershipPercentage: '100.00',
      acquiredDate: '2023-04-10',
      status: 'VERIFIED',
    },
    {
      id: 'demo_own_02',
      propertyId: 'demo_prop_02',
      ownerId: 'user_owner_01',
      ownershipPercentage: '100.00',
      acquiredDate: '2022-09-01',
      status: 'VERIFIED',
    },
    {
      id: 'demo_own_03',
      propertyId: 'demo_prop_03',
      ownerId: 'user_owner_02',
      ownershipPercentage: '100.00',
      acquiredDate: '2024-01-10',
      status: 'VERIFIED',
    },
    {
      id: 'demo_own_04',
      propertyId: 'demo_prop_04',
      ownerId: 'user_owner_01',
      ownershipPercentage: '100.00',
      acquiredDate: '2023-08-15',
      status: 'VERIFIED',
    },
    {
      id: 'demo_own_05',
      propertyId: 'demo_prop_05',
      ownerId: 'user_owner_01',
      ownershipPercentage: '100.00',
      acquiredDate: '2024-03-01',
      status: 'VERIFIED',
    }
  ];

  for (const own of ownershipToSeed) {
    await db.insert(schema.ownershipRecords).values(own).onConflictDoUpdate({
      target: schema.ownershipRecords.id,
      set: {
        propertyId: own.propertyId,
        ownerId: own.ownerId,
        ownershipPercentage: own.ownershipPercentage,
        acquiredDate: own.acquiredDate,
        status: own.status,
      }
    });
  }
  summary.ownershipRecords = ownershipToSeed.length;

  const agreementsToSeed = [
    {
      id: 'demo_agree_01',
      propertyId: 'demo_prop_01',
      companyId: 'org_company_01',
      ownerId: 'user_owner_01',
      status: 'ACTIVE',
      startDate: '2025-01-01',
      endDate: '2028-12-31',
      spendingLimit: '1500000',
      grantedPermissions: [
        'VIEW_PROPERTY',
        'MANAGE_LEASES',
        'MANAGE_TENANTS',
        'COLLECT_RENT',
        'MANAGE_MAINTENANCE',
        'VIEW_FINANCIALS',
        'EXECUTE_PAYMENTS',
        'MANAGE_DOCUMENTS'
      ],
      approvalRules: {
        maintenanceSpendingLimit: 1500000,
        requireOwnerSignOffOnLease: false,
      },
    },
    {
      id: 'demo_agree_02',
      propertyId: 'demo_prop_03',
      companyId: 'org_company_01',
      ownerId: 'user_owner_02',
      status: 'ACTIVE',
      startDate: '2025-01-01',
      endDate: '2028-12-31',
      spendingLimit: '2000000',
      grantedPermissions: [
        'VIEW_PROPERTY',
        'MANAGE_LEASES',
        'MANAGE_TENANTS',
        'COLLECT_RENT',
        'MANAGE_MAINTENANCE',
        'VIEW_FINANCIALS',
        'EXECUTE_PAYMENTS',
        'MANAGE_DOCUMENTS'
      ],
      approvalRules: {
        maintenanceSpendingLimit: 2000000,
        requireOwnerSignOffOnLease: false,
      },
    },
    {
      id: 'demo_agree_03',
      propertyId: 'demo_prop_04',
      companyId: 'org_company_01',
      ownerId: 'user_owner_01',
      status: 'ACTIVE',
      startDate: '2025-01-01',
      endDate: '2028-12-31',
      spendingLimit: '3000000',
      grantedPermissions: [
        'VIEW_PROPERTY',
        'MANAGE_LEASES',
        'MANAGE_TENANTS',
        'COLLECT_RENT',
        'MANAGE_MAINTENANCE',
        'VIEW_FINANCIALS',
        'EXECUTE_PAYMENTS',
        'MANAGE_DOCUMENTS'
      ],
      approvalRules: {
        maintenanceSpendingLimit: 3000000,
        requireOwnerSignOffOnLease: false,
      },
    }
  ];

  for (const ag of agreementsToSeed) {
    await db.insert(schema.managementAgreements).values(ag).onConflictDoUpdate({
      target: schema.managementAgreements.id,
      set: {
        propertyId: ag.propertyId,
        companyId: ag.companyId,
        ownerId: ag.ownerId,
        status: ag.status,
        startDate: ag.startDate,
        endDate: ag.endDate,
        spendingLimit: ag.spendingLimit,
        grantedPermissions: ag.grantedPermissions,
        approvalRules: ag.approvalRules,
        updatedAt: new Date(),
      }
    });
  }
  summary.managementAgreements = agreementsToSeed.length;

  // --------------------------------------------------------------------------
  // 6. SEED LEASES & LEASE TENANTS
  // --------------------------------------------------------------------------
  console.log('6. Seeding leases & tenant associations...');
  const leasesToSeed = [
    {
      id: 'demo_lease_01',
      propertyId: 'demo_prop_01',
      unitId: 'demo_unit_101',
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '1200000',
      depositAmount: '1200000',
      currency: 'IQD',
      rentCycle: 'MONTHLY',
    },
    {
      id: 'demo_lease_02',
      propertyId: 'demo_prop_01',
      unitId: 'demo_unit_103',
      status: 'EXPIRING',
      startDate: '2025-11-01',
      endDate: '2026-10-31',
      rentAmount: '800000',
      depositAmount: '800000',
      currency: 'IQD',
      rentCycle: 'MONTHLY',
    },
    {
      id: 'demo_lease_03',
      propertyId: 'demo_prop_02',
      unitId: 'demo_unit_201',
      status: 'ACTIVE',
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      rentAmount: '2500000',
      depositAmount: '2500000',
      currency: 'IQD',
      rentCycle: 'MONTHLY',
    },
    {
      id: 'demo_lease_04',
      propertyId: 'demo_prop_03',
      unitId: 'demo_unit_301',
      status: 'ACTIVE',
      startDate: '2026-03-01',
      endDate: '2027-02-28',
      rentAmount: '900000',
      depositAmount: '900000',
      currency: 'IQD',
      rentCycle: 'MONTHLY',
    },
    {
      id: 'demo_lease_05',
      propertyId: 'demo_prop_04',
      unitId: 'demo_unit_401',
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '2800',
      depositAmount: '2800',
      currency: 'USD',
      rentCycle: 'MONTHLY',
    },
    {
      id: 'demo_lease_06',
      propertyId: 'demo_prop_05',
      unitId: 'demo_unit_501',
      status: 'ACTIVE',
      startDate: '2026-05-01',
      endDate: '2027-04-30',
      rentAmount: '2000000',
      depositAmount: '2000000',
      currency: 'IQD',
      rentCycle: 'MONTHLY',
    }
  ];

  for (const l of leasesToSeed) {
    await db.insert(schema.leases).values(l).onConflictDoUpdate({
      target: schema.leases.id,
      set: {
        propertyId: l.propertyId,
        unitId: l.unitId,
        status: l.status,
        startDate: l.startDate,
        endDate: l.endDate,
        rentAmount: l.rentAmount,
        depositAmount: l.depositAmount,
        currency: l.currency,
        rentCycle: l.rentCycle,
      }
    });
  }
  summary.leases = leasesToSeed.length;

  const leaseTenantsToSeed = [
    {
      id: 'demo_lt_01',
      leaseId: 'demo_lease_01',
      tenantId: 'user_tenant_01',
      isPrimary: true,
    },
    {
      id: 'demo_lt_02',
      leaseId: 'demo_lease_02',
      tenantId: 'user_tenant_expiring',
      isPrimary: true,
    },
    {
      id: 'demo_lt_03',
      leaseId: 'demo_lease_03',
      tenantId: 'user_tenant_b_01',
      isPrimary: true,
    },
    {
      id: 'demo_lt_04',
      leaseId: 'demo_lease_04',
      tenantId: 'user_tenant_b_01',
      isPrimary: true,
    },
    {
      id: 'demo_lt_05',
      leaseId: 'demo_lease_05',
      tenantId: 'user_tenant_01',
      isPrimary: false,
    },
    {
      id: 'demo_lt_06',
      leaseId: 'demo_lease_06',
      tenantId: 'user_tenant_expiring',
      isPrimary: true,
    }
  ];

  // Clean up any orphaned non-demo lease associations for demo tenant personas to restore clean demo state
  const demoTenantIds = ['user_tenant_01', 'user_tenant_expiring', 'user_tenant_b_01', 'user_tenant_inactive_01'];
  for (const tId of demoTenantIds) {
    await db.delete(schema.leaseTenants).where(
      and(
        eq(schema.leaseTenants.tenantId, tId),
        sql`${schema.leaseTenants.leaseId} NOT LIKE 'demo_%'`
      )
    );
  }

  for (const lt of leaseTenantsToSeed) {
    await db.insert(schema.leaseTenants).values(lt).onConflictDoUpdate({
      target: schema.leaseTenants.id,
      set: {
        leaseId: lt.leaseId,
        tenantId: lt.tenantId,
        isPrimary: lt.isPrimary,
      }
    });
  }
  summary.leaseTenants = leaseTenantsToSeed.length;

  // --------------------------------------------------------------------------
  // 7. SEED RENT SCHEDULES (Paid, Due, Upcoming, Overdue)
  // --------------------------------------------------------------------------
  console.log('7. Seeding rent schedules...');
  const schedulesToSeed = [
    // Unit 101 — Past schedule: PAID & CONFIRMED
    {
      id: 'demo_sch_01',
      leaseId: 'demo_lease_01',
      propertyId: 'demo_prop_01',
      unitId: 'demo_unit_101',
      tenantId: 'user_tenant_01',
      amount: '1200000',
      paidAmount: '1200000',
      currency: 'IQD',
      dueDate: '2026-01-01',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      status: 'PAID',
    },
    // Unit 101 — Current schedule: DUE
    {
      id: 'demo_sch_02',
      leaseId: 'demo_lease_01',
      propertyId: 'demo_prop_01',
      unitId: 'demo_unit_101',
      tenantId: 'user_tenant_01',
      amount: '1200000',
      paidAmount: '0',
      currency: 'IQD',
      dueDate: '2026-10-01',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      status: 'DUE',
    },
    // Unit 101 — Future schedule: UPCOMING
    {
      id: 'demo_sch_03',
      leaseId: 'demo_lease_01',
      propertyId: 'demo_prop_01',
      unitId: 'demo_unit_101',
      tenantId: 'user_tenant_01',
      amount: '1200000',
      paidAmount: '0',
      currency: 'IQD',
      dueDate: '2026-11-01',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      status: 'UPCOMING',
    },
    // Unit 103 — Past schedule: OVERDUE
    {
      id: 'demo_sch_04',
      leaseId: 'demo_lease_02',
      propertyId: 'demo_prop_01',
      unitId: 'demo_unit_103',
      tenantId: 'user_tenant_expiring',
      amount: '800000',
      paidAmount: '0',
      currency: 'IQD',
      dueDate: '2026-09-01',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      status: 'OVERDUE',
    },
    // Unit 201 — Villa schedule: Current month
    {
      id: 'demo_sch_05',
      leaseId: 'demo_lease_03',
      propertyId: 'demo_prop_02',
      unitId: 'demo_unit_201',
      tenantId: 'user_tenant_b_01',
      amount: '2500000',
      paidAmount: '0',
      currency: 'IQD',
      dueDate: '2026-10-01',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      status: 'DUE',
    },
    // Unit 301 (Slemani View) — Past schedule: OVERDUE
    {
      id: 'demo_sch_06',
      leaseId: 'demo_lease_04',
      propertyId: 'demo_prop_03',
      unitId: 'demo_unit_301',
      tenantId: 'user_tenant_b_01',
      amount: '900000',
      paidAmount: '0',
      currency: 'IQD',
      dueDate: '2026-09-01',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      status: 'OVERDUE',
    },
    // Unit 301 (Slemani View) — Current schedule: DUE
    {
      id: 'demo_sch_07',
      leaseId: 'demo_lease_04',
      propertyId: 'demo_prop_03',
      unitId: 'demo_unit_301',
      tenantId: 'user_tenant_b_01',
      amount: '900000',
      paidAmount: '0',
      currency: 'IQD',
      dueDate: '2026-10-01',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      status: 'DUE',
    },
    // Suite 401 (Empire World) — Confirmed Paid schedule ($2,800 USD)
    {
      id: 'demo_sch_08',
      leaseId: 'demo_lease_05',
      propertyId: 'demo_prop_04',
      unitId: 'demo_unit_401',
      tenantId: 'user_tenant_01',
      amount: '2800',
      paidAmount: '2800',
      currency: 'USD',
      dueDate: '2026-09-01',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      status: 'PAID',
    },
    // Suite 401 (Empire World) — Current schedule: DUE ($2,800 USD)
    {
      id: 'demo_sch_09',
      leaseId: 'demo_lease_05',
      propertyId: 'demo_prop_04',
      unitId: 'demo_unit_401',
      tenantId: 'user_tenant_01',
      amount: '2800',
      paidAmount: '0',
      currency: 'USD',
      dueDate: '2026-10-01',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      status: 'DUE',
    },
    // Villa A (Duhok Valley) — Current schedule: DUE
    {
      id: 'demo_sch_10',
      leaseId: 'demo_lease_06',
      propertyId: 'demo_prop_05',
      unitId: 'demo_unit_501',
      tenantId: 'user_tenant_expiring',
      amount: '2000000',
      paidAmount: '0',
      currency: 'IQD',
      dueDate: '2026-10-01',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      status: 'DUE',
    }
  ];

  for (const sch of schedulesToSeed) {
    await db.insert(schema.rentSchedules).values(sch).onConflictDoUpdate({
      target: schema.rentSchedules.id,
      set: {
        amount: sch.amount,
        paidAmount: sch.paidAmount,
        currency: sch.currency,
        dueDate: sch.dueDate,
        periodStart: sch.periodStart,
        periodEnd: sch.periodEnd,
        status: sch.status,
      }
    });
  }
  summary.rentSchedules = schedulesToSeed.length;

  // --------------------------------------------------------------------------
  // 8. SEED PAYMENT RECORDS & RECONCILED DOUBLE-ENTRY FINANCIALS
  // --------------------------------------------------------------------------
  console.log('8. Seeding payment records and authoritative double-entry ledger...');
  // Payment 1: Confirmed payment for Unit 101 Schedule 1
  const payment1 = {
    id: 'demo_pay_01',
    propertyId: 'demo_prop_01',
    leaseId: 'demo_lease_01',
    rentScheduleId: 'demo_sch_01',
    payerId: 'user_tenant_01',
    collectorId: 'user_company_01',
    confirmedByUserId: 'user_company_01',
    amount: '1200000',
    currency: 'IQD',
    paymentMethod: 'FIB',
    referenceNumber: 'TXN-FIB-20260105-0921',
    receiptNumber: 'RCP-2026-000101',
    status: 'CONFIRMED',
    recordedDate: '2026-01-05T10:30:00Z',
    idempotencyKey: 'idemp_demo_pay_01',
  };

  // Payment 2: Unconfirmed cash payment for Unit 201 (Demonstrates unconfirmed isolation)
  const payment2 = {
    id: 'demo_pay_02',
    propertyId: 'demo_prop_02',
    leaseId: 'demo_lease_03',
    rentScheduleId: 'demo_sch_05',
    payerId: 'user_tenant_b_01',
    collectorId: null,
    confirmedByUserId: null,
    amount: '2500000',
    currency: 'IQD',
    paymentMethod: 'CASH',
    referenceNumber: 'CASH-REC-PENDING-994',
    receiptNumber: null,
    status: 'PENDING',
    recordedDate: '2026-10-02T14:15:00Z',
    idempotencyKey: 'idemp_demo_pay_02',
  };

  // Payment 3: Confirmed commercial payment for Suite 401 on demo_prop_04 ($2,800 USD)
  const payment3 = {
    id: 'demo_pay_03',
    propertyId: 'demo_prop_04',
    leaseId: 'demo_lease_05',
    rentScheduleId: 'demo_sch_08',
    payerId: 'user_tenant_01',
    collectorId: 'user_company_01',
    confirmedByUserId: 'user_company_01',
    amount: '2800',
    currency: 'USD',
    paymentMethod: 'FIB',
    referenceNumber: 'TXN-FIB-20260905-8831',
    receiptNumber: 'RCP-2026-000401',
    status: 'CONFIRMED',
    recordedDate: '2026-09-05T11:00:00Z',
    idempotencyKey: 'idemp_demo_pay_03',
  };

  await db.insert(schema.paymentRecords).values([payment1, payment2, payment3]).onConflictDoUpdate({
    target: schema.paymentRecords.id,
    set: {
      amount: sql`EXCLUDED.amount`,
      currency: sql`EXCLUDED.currency`,
      status: sql`EXCLUDED.status`,
      paymentMethod: sql`EXCLUDED.payment_method`,
      referenceNumber: sql`EXCLUDED.reference_number`,
      receiptNumber: sql`EXCLUDED.receipt_number`,
      confirmedByUserId: sql`EXCLUDED.confirmed_by_user_id`,
      recordedDate: sql`EXCLUDED.recorded_date`,
    }
  });
  summary.paymentRecords = 3;

  // Reconciled 3-Fee Allocation for Payment 1 (Amount: 1,200,000 IQD):
  // Operating model: FULLY_MANAGED
  // Platform Fee (2%): 24,000 IQD
  // Rent Fee (5%):     60,000 IQD
  // Management Fee (3%): 36,000 IQD
  // Total Fees:       120,000 IQD
  // Owner Net Amount: 1,080,000 IQD
  const jeCash = {
    id: 'demo_je_cash_01',
    propertyId: 'demo_prop_01',
    date: '2026-01-05T10:30:00Z',
    description: 'Cash collection for rent payment demo_pay_01',
    referenceType: 'PAYMENT_RECORD',
    referenceId: 'demo_pay_01',
    status: 'POSTED',
    idempotencyKey: 'JE_CASH_demo_pay_01',
  };

  const jeCommission = {
    id: 'demo_je_comm_01',
    propertyId: 'demo_prop_01',
    date: '2026-01-05T10:30:00Z',
    description: 'HomeHub 3-Fee Allocation for Payment demo_pay_01',
    referenceType: 'PAYMENT_RECORD',
    referenceId: 'demo_pay_01',
    status: 'POSTED',
    idempotencyKey: 'JE_COMMISSION_demo_pay_01',
  };

  // Reconciled 3-Fee Allocation for Payment 3 (Amount: $2,800 USD):
  // Operating model: FULLY_MANAGED on demo_prop_04
  // Platform Fee (2%): $56 USD
  // Rent Fee (6%):     $168 USD
  // Management Fee (2%): $56 USD
  // Total Fees:       $280 USD
  // Owner Net Amount: $2,520 USD
  const jeCash2 = {
    id: 'demo_je_cash_02',
    propertyId: 'demo_prop_04',
    date: '2026-09-05T11:00:00Z',
    description: 'Cash collection for rent payment demo_pay_03 ($2,800 USD)',
    referenceType: 'PAYMENT_RECORD',
    referenceId: 'demo_pay_03',
    status: 'POSTED',
    idempotencyKey: 'JE_CASH_demo_pay_03',
  };

  const jeCommission2 = {
    id: 'demo_je_comm_02',
    propertyId: 'demo_prop_04',
    date: '2026-09-05T11:00:00Z',
    description: 'HomeHub 3-Fee Allocation for Payment demo_pay_03 ($2,800 USD)',
    referenceType: 'PAYMENT_RECORD',
    referenceId: 'demo_pay_03',
    status: 'POSTED',
    idempotencyKey: 'JE_COMMISSION_demo_pay_03',
  };

  await db.insert(schema.journalEntries).values([jeCash, jeCommission, jeCash2, jeCommission2]).onConflictDoUpdate({
    target: schema.journalEntries.id,
    set: {
      description: sql`EXCLUDED.description`,
      status: sql`EXCLUDED.status`,
    }
  });
  summary.journalEntries = 4;

  const ledgerLinesToSeed = [
    // Payment 1: Cash collection lines
    {
      id: 'demo_line_cash_dr',
      journalEntryId: 'demo_je_cash_01',
      accountId: '1010', // Bank / FIB Collection Account
      debit: '1200000',
      credit: '0',
      currency: 'IQD',
    },
    {
      id: 'demo_line_cash_cr',
      journalEntryId: 'demo_je_cash_01',
      accountId: '1200', // Tenant Rent Clearing
      debit: '0',
      credit: '1200000',
      currency: 'IQD',
    },
    // Payment 1: Fee allocation lines
    {
      id: 'demo_line_rev_dr',
      journalEntryId: 'demo_je_comm_01',
      accountId: '4000', // Property Gross Rent Revenue Clearing
      debit: '1200000',
      credit: '0',
      currency: 'IQD',
    },
    {
      id: 'demo_line_plat_cr',
      journalEntryId: 'demo_je_comm_01',
      accountId: '4010', // HomeHub Platform Fee Revenue (2%)
      debit: '0',
      credit: '24000',
      currency: 'IQD',
    },
    {
      id: 'demo_line_rent_cr',
      journalEntryId: 'demo_je_comm_01',
      accountId: '4011', // HomeHub Rent Fee Revenue (5%)
      debit: '0',
      credit: '60000',
      currency: 'IQD',
    },
    {
      id: 'demo_line_mgmt_cr',
      journalEntryId: 'demo_je_comm_01',
      accountId: '4012', // HomeHub Management Fee Revenue (3%)
      debit: '0',
      credit: '36000',
      currency: 'IQD',
    },
    {
      id: 'demo_line_owner_cr',
      journalEntryId: 'demo_je_comm_01',
      accountId: '2010', // Owner Net Entitlement Payable
      debit: '0',
      credit: '1080000',
      currency: 'IQD',
    },
    // Payment 3: Cash collection lines ($2,800 USD)
    {
      id: 'demo_line_cash_dr_02',
      journalEntryId: 'demo_je_cash_02',
      accountId: '1010',
      debit: '2800',
      credit: '0',
      currency: 'USD',
    },
    {
      id: 'demo_line_cash_cr_02',
      journalEntryId: 'demo_je_cash_02',
      accountId: '1200',
      debit: '0',
      credit: '2800',
      currency: 'USD',
    },
    // Payment 3: Fee allocation lines (Total Debits $2,800 === Total Credits $2,800)
    {
      id: 'demo_line_rev_dr_02',
      journalEntryId: 'demo_je_comm_02',
      accountId: '4000',
      debit: '2800',
      credit: '0',
      currency: 'USD',
    },
    {
      id: 'demo_line_plat_cr_02',
      journalEntryId: 'demo_je_comm_02',
      accountId: '4010', // Platform Fee (2%)
      debit: '0',
      credit: '56',
      currency: 'USD',
    },
    {
      id: 'demo_line_rent_cr_02',
      journalEntryId: 'demo_je_comm_02',
      accountId: '4011', // Rent Fee (6%)
      debit: '0',
      credit: '168',
      currency: 'USD',
    },
    {
      id: 'demo_line_mgmt_cr_02',
      journalEntryId: 'demo_je_comm_02',
      accountId: '4012', // Management Fee (2%)
      debit: '0',
      credit: '56',
      currency: 'USD',
    },
    {
      id: 'demo_line_owner_cr_02',
      journalEntryId: 'demo_je_comm_02',
      accountId: '2010', // Owner Net Entitlement Payable
      debit: '0',
      credit: '2520',
      currency: 'USD',
    }
  ];

  for (const line of ledgerLinesToSeed) {
    await db.insert(schema.ledgerLines).values(line).onConflictDoUpdate({
      target: schema.ledgerLines.id,
      set: {
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
        currency: line.currency,
      }
    });
  }
  summary.ledgerLines = ledgerLinesToSeed.length;

  // Authoritative commission records
  const commission1 = {
    id: 'demo_comm_01',
    paymentRecordId: 'demo_pay_01',
    propertyId: 'demo_prop_01',
    unitId: 'demo_unit_101',
    leaseId: 'demo_lease_01',
    tenantId: 'user_tenant_01',
    ownerId: 'user_owner_01',
    companyId: 'org_company_01',
    commissionType: 'PLATFORM_FEES',
    rate: '0.02',
    baseAmount: '1200000',
    commissionAmount: '120000', // Total 3 fees (24k + 60k + 36k)
    currency: 'IQD',
    status: 'POSTED',
    policyVersion: 'v2.0',
    journalEntryId: 'demo_je_comm_01',
    idempotencyKey: 'COMMISSION_demo_pay_01',
  };

  const commission2 = {
    id: 'demo_comm_02',
    paymentRecordId: 'demo_pay_03',
    propertyId: 'demo_prop_04',
    unitId: 'demo_unit_401',
    leaseId: 'demo_lease_05',
    tenantId: 'user_tenant_01',
    ownerId: 'user_owner_01',
    companyId: 'org_company_01',
    commissionType: 'PLATFORM_FEES',
    rate: '0.02',
    baseAmount: '2800',
    commissionAmount: '280', // Total 3 fees ($56 + $168 + $56)
    currency: 'USD',
    status: 'POSTED',
    policyVersion: 'v2.0',
    journalEntryId: 'demo_je_comm_02',
    idempotencyKey: 'COMMISSION_demo_pay_03',
  };

  await db.insert(schema.commissions).values([commission1, commission2]).onConflictDoUpdate({
    target: schema.commissions.id,
    set: {
      status: sql`EXCLUDED.status`,
      baseAmount: sql`EXCLUDED.base_amount`,
      commissionAmount: sql`EXCLUDED.commission_amount`,
      currency: sql`EXCLUDED.currency`,
      rate: sql`EXCLUDED.rate`,
    }
  });
  summary.commissions = 2;

  // --------------------------------------------------------------------------
  // 9. SEED SECURITY DEPOSITS
  // --------------------------------------------------------------------------
  console.log('9. Seeding security deposits...');
  const depositsToSeed = [
    {
      id: 'demo_dep_01',
      leaseId: 'demo_lease_01',
      propertyId: 'demo_prop_01',
      tenantId: 'user_tenant_01',
      requiredAmount: '1200000',
      recordedAmount: '1200000',
      releasedAmount: '0',
      currency: 'IQD',
      status: 'HELD',
    },
    {
      id: 'demo_dep_02',
      leaseId: 'demo_lease_03',
      propertyId: 'demo_prop_02',
      tenantId: 'user_tenant_b_01',
      requiredAmount: '2500000',
      recordedAmount: '0',
      releasedAmount: '0',
      currency: 'IQD',
      status: 'PENDING',
    },
    {
      id: 'demo_dep_03',
      leaseId: 'demo_lease_04',
      propertyId: 'demo_prop_03',
      tenantId: 'user_tenant_b_01',
      requiredAmount: '900000',
      recordedAmount: '900000',
      releasedAmount: '0',
      currency: 'IQD',
      status: 'HELD',
    },
    {
      id: 'demo_dep_04',
      leaseId: 'demo_lease_05',
      propertyId: 'demo_prop_04',
      tenantId: 'user_tenant_01',
      requiredAmount: '2800',
      recordedAmount: '2800',
      releasedAmount: '0',
      currency: 'USD',
      status: 'HELD',
    }
  ];

  for (const dep of depositsToSeed) {
    await db.insert(schema.securityDeposits).values(dep).onConflictDoUpdate({
      target: schema.securityDeposits.id,
      set: {
        requiredAmount: dep.requiredAmount,
        recordedAmount: dep.recordedAmount,
        releasedAmount: dep.releasedAmount,
        currency: dep.currency,
        status: dep.status,
      }
    });
  }
  summary.securityDeposits = depositsToSeed.length;

  // --------------------------------------------------------------------------
  // 10. SEED UTILITY BILLS
  // --------------------------------------------------------------------------
  console.log('10. Seeding utility bills...');
  const utilityBillsToSeed = [
    {
      id: 'demo_bill_01',
      propertyId: 'demo_prop_01',
      unitId: 'demo_unit_101',
      tenantId: 'user_tenant_01',
      leaseId: 'demo_lease_01',
      type: 'WATER',
      description: 'Erbil Directorate of Water & Sewage — Oct 2026',
      amount: '45000',
      outstandingAmount: '45000',
      status: 'UNPAID',
      billingDate: '2026-10-01',
      dueDate: '2026-10-25',
    },
    {
      id: 'demo_bill_02',
      propertyId: 'demo_prop_01',
      unitId: 'demo_unit_101',
      tenantId: 'user_tenant_01',
      leaseId: 'demo_lease_01',
      type: 'ELECTRICITY',
      description: 'National Grid & Shared Generator — Sep 2026',
      amount: '110000',
      outstandingAmount: '0',
      status: 'PAID',
      billingDate: '2026-09-01',
      dueDate: '2026-09-20',
    },
    {
      id: 'demo_bill_03',
      propertyId: 'demo_prop_03',
      unitId: 'demo_unit_301',
      tenantId: 'user_tenant_b_01',
      leaseId: 'demo_lease_04',
      type: 'WATER',
      description: 'Sulaymaniyah Directorate of Water — Oct 2026',
      amount: '35000',
      outstandingAmount: '35000',
      status: 'UNPAID',
      billingDate: '2026-10-01',
      dueDate: '2026-10-25',
    },
    {
      id: 'demo_bill_04',
      propertyId: 'demo_prop_05',
      unitId: 'demo_unit_501',
      tenantId: 'user_tenant_expiring',
      leaseId: 'demo_lease_06',
      type: 'ELECTRICITY',
      description: 'Duhok Malta Power & Neighborhood Generator — Oct 2026',
      amount: '65000',
      outstandingAmount: '65000',
      status: 'UNPAID',
      billingDate: '2026-10-01',
      dueDate: '2026-10-28',
    }
  ];

  for (const bill of utilityBillsToSeed) {
    await db.insert(schema.utilityBills).values(bill).onConflictDoUpdate({
      target: schema.utilityBills.id,
      set: {
        amount: bill.amount,
        outstandingAmount: bill.outstandingAmount,
        status: bill.status,
        billingDate: bill.billingDate,
        dueDate: bill.dueDate,
        updatedAt: new Date(),
      }
    });
  }
  summary.utilityBills = utilityBillsToSeed.length;

  // --------------------------------------------------------------------------
  // 11. SEED VENDOR PROFILE & LICENSES
  // --------------------------------------------------------------------------
  console.log('11. Seeding vendor profile & credentials...');
  const vendorProfile = {
    id: 'demo_vp_01',
    userId: 'user_vendor_01',
    organizationId: 'org_vendor_01',
    businessName: 'Erbil Quick Fix Services',
    legalName: 'Erbil Quick Fix Technical Services Co.',
    bio: 'Professional certified plumbing, electrical and HVAC maintenance contractor serving Erbil since 2018.',
    categories: ['PLUMBING', 'ELECTRICAL', 'HVAC'],
    specialties: ['Pipe leak repairs', 'Boiler maintenance', 'Circuit diagnosis', 'Chiller service'],
    serviceAreas: ['Erbil Center', 'Dream City', 'Gulan', 'Empire World', 'Bakhtiyari', 'Sulaymaniyah Center'],
    phone: '+964 750 777 8899',
    email: 'vendor@homehub.iq',
    emergencyAvailable: true,
    status: 'ACTIVE',
    verificationStatus: 'APPROVED',
    rating: '4.95',
    reviewCount: 38,
    hourlyRate: '35000',
    currency: 'IQD',
  };

  await db.insert(schema.vendorProfiles).values(vendorProfile).onConflictDoUpdate({
    target: schema.vendorProfiles.userId,
    set: {
      organizationId: vendorProfile.organizationId,
      businessName: vendorProfile.businessName,
      legalName: vendorProfile.legalName,
      bio: vendorProfile.bio,
      categories: vendorProfile.categories,
      specialties: vendorProfile.specialties,
      serviceAreas: vendorProfile.serviceAreas,
      phone: vendorProfile.phone,
      email: vendorProfile.email,
      emergencyAvailable: vendorProfile.emergencyAvailable,
      status: vendorProfile.status,
      verificationStatus: vendorProfile.verificationStatus,
      rating: vendorProfile.rating,
      reviewCount: vendorProfile.reviewCount,
      hourlyRate: vendorProfile.hourlyRate,
      currency: vendorProfile.currency,
      updatedAt: new Date(),
    }
  });
  summary.vendorProfiles = 1;

  // --------------------------------------------------------------------------
  // 12. SEED MAINTENANCE REQUESTS, QUOTES & WORK ORDERS
  // --------------------------------------------------------------------------
  console.log('12. Seeding maintenance requests, quotes & work orders...');
  const maintRequestsToSeed = [
    {
      id: 'demo_maint_01',
      propertyId: 'demo_prop_01',
      unitId: 'demo_unit_101',
      reporterUserId: 'user_tenant_01',
      category: 'PLUMBING',
      priority: 'HIGH',
      status: 'ASSIGNED',
      title: 'Water Leak Under Master Bathroom Vanity',
      description: 'Persistent water leaking under the sink vanity cabinet. Shut-off valve appears corroded.',
      assignedVendorId: 'org_vendor_01',
      budget: '150000',
    },
    {
      id: 'demo_maint_02',
      propertyId: 'demo_prop_01',
      unitId: 'demo_unit_103',
      reporterUserId: 'user_tenant_expiring',
      category: 'HVAC',
      priority: 'NORMAL',
      status: 'REPORTED',
      title: 'AC Airflow Weak in Main Bedroom',
      description: 'Central split unit blowing lukewarm air. Filter cleaned but airflow remains weak.',
      assignedVendorId: null,
      budget: '75000',
    },
    {
      id: 'demo_maint_03',
      propertyId: 'demo_prop_03',
      unitId: 'demo_unit_302',
      reporterUserId: 'user_tenant_b_01',
      category: 'HVAC',
      priority: 'HIGH',
      status: 'REPORTED',
      title: 'Heating System Boiler Valve Failure',
      description: 'Radiator heating not firing up in Unit 302. Temperature drops at night.',
      assignedVendorId: 'org_vendor_01',
      budget: '180000',
    }
  ];

  for (const m of maintRequestsToSeed) {
    await db.insert(schema.maintenanceRequests).values(m).onConflictDoUpdate({
      target: schema.maintenanceRequests.id,
      set: {
        category: m.category,
        priority: m.priority,
        status: m.status,
        title: m.title,
        description: m.description,
        assignedVendorId: m.assignedVendorId,
        budget: m.budget,
        updatedAt: new Date(),
      }
    });
  }
  summary.maintenanceRequests = maintRequestsToSeed.length;

  const quote1 = {
    id: 'demo_quote_01',
    maintenanceRequestId: 'demo_maint_01',
    vendorId: 'demo_vp_01',
    vendorUserId: 'user_vendor_01',
    propertyId: 'demo_prop_01',
    totalAmount: '120000',
    laborAmount: '80000',
    materialsAmount: '40000',
    feesAmount: '0',
    currency: 'IQD',
    estimatedDuration: '3 Hours',
    status: 'APPROVED',
  };

  const quote2 = {
    id: 'demo_quote_02',
    maintenanceRequestId: 'demo_maint_03',
    vendorId: 'demo_vp_01',
    vendorUserId: 'user_vendor_01',
    propertyId: 'demo_prop_03',
    totalAmount: '140000',
    laborAmount: '95000',
    materialsAmount: '45000',
    feesAmount: '0',
    currency: 'IQD',
    estimatedDuration: '4 Hours',
    status: 'PENDING',
  };

  await db.insert(schema.maintenanceQuotes).values([quote1, quote2]).onConflictDoUpdate({
    target: schema.maintenanceQuotes.id,
    set: {
      totalAmount: sql`EXCLUDED.total_amount`,
      laborAmount: sql`EXCLUDED.labor_amount`,
      materialsAmount: sql`EXCLUDED.materials_amount`,
      status: sql`EXCLUDED.status`,
    }
  });
  summary.maintenanceQuotes = 2;

  const workOrder1 = {
    id: 'demo_wo_01',
    maintenanceRequestId: 'demo_maint_01',
    quoteId: 'demo_quote_01',
    vendorId: 'demo_vp_01',
    vendorUserId: 'user_vendor_01',
    assignedTechnicianId: 'user_vendor_01',
    propertyId: 'demo_prop_01',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    scheduledStartDate: '2026-10-14T09:00:00Z',
    scheduledEndDate: '2026-10-14T12:00:00Z',
    scopeOfWork: 'Replace corroded brass angle stop valves and supply lines. Pressure test connections.',
  };

  await db.insert(schema.workOrders).values(workOrder1).onConflictDoUpdate({
    target: schema.workOrders.id,
    set: {
      status: workOrder1.status,
      scheduledStartDate: workOrder1.scheduledStartDate,
      scheduledEndDate: workOrder1.scheduledEndDate,
      scopeOfWork: workOrder1.scopeOfWork,
      updatedAt: new Date(),
    }
  });
  summary.workOrders = 1;

  // --------------------------------------------------------------------------
  // 13. SEED DOCUMENTS (Strict RBAC Boundaries)
  // --------------------------------------------------------------------------
  console.log('13. Seeding documents with authoritative access boundaries...');
  const docsToSeed = [
    // TAPU Deed: Accessible to Owner & Company. Strictly FORBIDDEN to Tenant!
    {
      id: 'demo_doc_tapu_01',
      propertyId: 'demo_prop_01',
      ownerId: 'user_owner_01',
      uploaderUserId: 'user_owner_01',
      title: 'Zagros Heights Official Tapu Deed Registration',
      documentType: 'TAPU',
      verificationState: 'VERIFIED',
      fileUrl: '/api/storage/documents/tapu-zagros-heights.pdf',
      metadata: {
        registrationOffice: 'Erbil Land Registry Directorate',
        parcelNumber: '42/108-A',
        isOwnerConfidential: true,
      },
    },
    // Tapu Deed for Empire World (Property 4)
    {
      id: 'demo_doc_tapu_02',
      propertyId: 'demo_prop_04',
      ownerId: 'user_owner_01',
      uploaderUserId: 'user_owner_01',
      title: 'Empire World Business Plaza 3 Commercial Tapu Deed',
      documentType: 'TAPU',
      verificationState: 'VERIFIED',
      fileUrl: '/api/storage/documents/tapu-empire-world.pdf',
      metadata: {
        registrationOffice: 'Erbil Commercial Land Registry',
        parcelNumber: '100M/Plaza-3',
        isOwnerConfidential: true,
      },
    },
    // Tapu Deed for Slemani View (Property 3, Owner 2)
    {
      id: 'demo_doc_tapu_03',
      propertyId: 'demo_prop_03',
      ownerId: 'user_owner_02',
      uploaderUserId: 'user_owner_02',
      title: 'Slemani View Residences Official Tapu Deed Registration',
      documentType: 'TAPU',
      verificationState: 'VERIFIED',
      fileUrl: '/api/storage/documents/tapu-slemani-view.pdf',
      metadata: {
        registrationOffice: 'Sulaymaniyah Land Directorate',
        parcelNumber: '8/Sarchinar-View',
        isOwnerConfidential: true,
      },
    },
    // Lease Contract: Visible to Owner, Company, and Tenant 01 (matches leaseId)
    {
      id: 'demo_doc_lease_01',
      propertyId: 'demo_prop_01',
      ownerId: 'user_owner_01',
      uploaderUserId: 'user_company_01',
      title: 'Signed Residential Lease Agreement — Unit 101',
      documentType: 'LEASE_CONTRACT',
      verificationState: 'VERIFIED',
      fileUrl: '/api/storage/documents/lease-unit-101-2026.pdf',
      metadata: {
        leaseId: 'demo_lease_01',
        unitId: 'demo_unit_101',
        tenantId: 'user_tenant_01',
      },
    },
    // Building Rules: Visible to all residents and management
    {
      id: 'demo_doc_rules_01',
      propertyId: 'demo_prop_01',
      ownerId: 'user_owner_01',
      uploaderUserId: 'user_company_01',
      title: 'Zagros Heights Resident Handbook & Community Rules',
      documentType: 'BUILDING_RULES',
      verificationState: 'VERIFIED',
      fileUrl: '/api/storage/documents/building-rules.pdf',
      metadata: {
        isPropertyWide: true,
        version: '2026.1',
      },
    },
    // Inspection Report: Scoped to Unit 101
    {
      id: 'demo_doc_insp_01',
      propertyId: 'demo_prop_01',
      ownerId: 'user_owner_01',
      uploaderUserId: 'user_company_01',
      title: 'Move-In Condition Inspection Report — Unit 101',
      documentType: 'INSPECTION',
      verificationState: 'VERIFIED',
      fileUrl: '/api/storage/documents/inspection-unit-101.pdf',
      metadata: {
        leaseId: 'demo_lease_01',
        unitId: 'demo_unit_101',
        tenantId: 'user_tenant_01',
      },
    }
  ];

  for (const doc of docsToSeed) {
    await db.insert(schema.documents).values(doc).onConflictDoUpdate({
      target: schema.documents.id,
      set: {
        title: doc.title,
        documentType: doc.documentType,
        verificationState: doc.verificationState,
        fileUrl: doc.fileUrl,
        metadata: doc.metadata,
        updatedAt: new Date(),
      }
    });
  }
  summary.documents = docsToSeed.length;

  // --------------------------------------------------------------------------
  // 14. SEED CONVERSATIONS & MESSAGES
  // --------------------------------------------------------------------------
  console.log('14. Seeding communications & messages...');
  const conv1 = {
    id: 'demo_conv_01',
    propertyId: 'demo_prop_01',
    creatorUserId: 'user_company_01',
    participantIds: ['user_company_01', 'user_tenant_01', 'user_owner_01'],
    title: 'Zagros Heights Unit 101 — Tenancy & Onboarding',
    status: 'ACTIVE',
  };

  await db.insert(schema.conversations).values(conv1).onConflictDoUpdate({
    target: schema.conversations.id,
    set: {
      title: conv1.title,
      status: conv1.status,
      participantIds: conv1.participantIds,
      updatedAt: new Date(),
    }
  });
  summary.conversations = 1;

  const msgsToSeed = [
    {
      id: 'demo_msg_01',
      conversationId: 'demo_conv_01',
      senderUserId: 'user_company_01',
      senderRole: 'COMPANY_ADMIN',
      content: 'بەخێربێیت بەڕێز ئەحمەد بۆ باڵەخانەی زاگرۆس هایتس. گرێبەستەکەت و ڕێنماییەکان بەردەستن.',
      messageType: 'TEXT',
      readByUserIds: ['user_company_01', 'user_tenant_01'],
    },
    {
      id: 'demo_msg_02',
      conversationId: 'demo_conv_01',
      senderUserId: 'user_tenant_01',
      senderRole: 'TENANT',
      content: 'سوپاس، کێشەیەکی کەمی دزەکردنی ئاو لە ژێر دەستشۆر هەیە و داواکاری چاککردنەوەم تۆمار کردووە.',
      messageType: 'MAINTENANCE_UPDATE',
      readByUserIds: ['user_tenant_01', 'user_company_01'],
    }
  ];

  for (const msg of msgsToSeed) {
    await db.insert(schema.messages).values(msg).onConflictDoUpdate({
      target: schema.messages.id,
      set: {
        content: msg.content,
        readByUserIds: msg.readByUserIds,
      }
    });
  }
  summary.messages = msgsToSeed.length;

  // --------------------------------------------------------------------------
  // 15. SEED NOTIFICATIONS
  // --------------------------------------------------------------------------
  console.log('15. Seeding notifications...');
  const notifsToSeed = [
    {
      id: 'demo_notif_01',
      userId: 'user_owner_01',
      propertyId: 'demo_prop_01',
      category: 'RENT_PAYMENT',
      priority: 'NORMAL',
      title: 'کرێی مانگانە پشتڕاستکرایەوە (Rent Payment Confirmed)',
      message: 'بڕی 1,200,000 دینار بۆ یەکەی 101 لە زاگرۆس هایتس پشتڕاستکرایەوە بە سەرکەوتوویی.',
      read: false,
      status: 'SENT',
      idempotencyKey: 'notif_demo_01',
    },
    {
      id: 'demo_notif_02',
      userId: 'user_tenant_01',
      propertyId: 'demo_prop_01',
      category: 'UTILITY_BILL',
      priority: 'NORMAL',
      title: 'پسوولەی نوێی ئاو (New Water Utility Bill)',
      message: 'پسوولەی مانگی ١٠ بە بڕی 45,000 دینار گەیشتووە. تکایە لە کاتی خۆیدا بیدەن.',
      read: false,
      status: 'SENT',
      idempotencyKey: 'notif_demo_02',
    },
    {
      id: 'demo_notif_03',
      userId: 'user_vendor_01',
      propertyId: 'demo_prop_01',
      category: 'MAINTENANCE',
      priority: 'HIGH',
      title: 'فەرمانی نوێی چاککردنەوە (Work Order Assigned)',
      message: 'داواکاری چاککردنەوەی دزەکردنی ئاو لە یەکەی 101 بۆ ئێوە دیاریکراوە.',
      read: false,
      status: 'SENT',
      idempotencyKey: 'notif_demo_03',
    }
  ];

  for (const n of notifsToSeed) {
    await db.insert(schema.notifications).values(n).onConflictDoUpdate({
      target: schema.notifications.id,
      set: {
        title: n.title,
        message: n.message,
        read: n.read,
        status: n.status,
      }
    });
  }
  summary.notifications = notifsToSeed.length;

  // --------------------------------------------------------------------------
  // 16. SEED RENTAL LISTINGS (Rental-only scope across Erbil, Sulaymaniyah, Duhok)
  // --------------------------------------------------------------------------
  console.log('16. Seeding rental listings across regions...');
  const listingsToSeed = [
    {
      id: 'demo_listing_01',
      propertyId: 'demo_prop_01',
      publisherUserId: 'user_company_01',
      publisherCompanyId: 'org_company_01',
      type: 'FOR_RENT', // Strictly rental! No sales.
      price: '1500000',
      currency: 'IQD',
      status: 'PUBLISHED',
      title: 'خانووی بەکرێی ڕازاوە لە زاگرۆس هایتس (Luxury 3-Bed in Zagros Heights)',
      description: 'ئاپارتمانی شاهانەی ٣ ژووری نووستن، تەواوی خزمەتگوزارییەکان، دیمەنی سەرنجڕاکێشی شاخی سەفین.',
    },
    {
      id: 'demo_listing_02',
      propertyId: 'demo_prop_03',
      publisherUserId: 'user_company_01',
      publisherCompanyId: 'org_company_01',
      type: 'FOR_RENT',
      price: '750000',
      currency: 'IQD',
      status: 'PUBLISHED',
      title: 'ئاپارتمانی مۆدێرنی ١ ژووری لە چاوی سلێمانی (Modern 1-Bed in Slemani View)',
      description: 'ئاپارتمانی ڕازاوەی ١ ژووری نووستن، پێداویستی تەواو، دیمەنی دڵڕفێنی شاری سلێمانی و کێوی گۆیژە.',
    },
    {
      id: 'demo_listing_03',
      propertyId: 'demo_prop_04',
      publisherUserId: 'user_agent_01',
      publisherCompanyId: 'org_company_01',
      type: 'FOR_RENT',
      price: '2200',
      currency: 'USD',
      status: 'PUBLISHED',
      title: 'نووسینگەی شاهانەی بازرگانی لە ئیمپایەر وۆڕڵد (Executive Commercial Suite in Empire World)',
      description: 'سوویتی بازرگانی پلە یەک لە پلازا ٣، تەواوی ئامادەکاری تەکنیکی و شوێنی تایبەتی کۆبوونەوە.',
    },
    {
      id: 'demo_listing_04',
      propertyId: 'demo_prop_05',
      publisherUserId: 'user_owner_01',
      publisherCompanyId: null,
      type: 'FOR_RENT',
      price: '1800000',
      currency: 'IQD',
      status: 'PUBLISHED',
      title: 'ڤێلای ناوازەی دۆڵی دهۆک بە دیمەنی سروشتی (Panoramic Nature Villa in Duhok Valley)',
      description: 'ڤێلای سەربەخۆی ٤ ژووری نووستن بە حەوشەی گەورە و هەوای پاکی دەڤەری دهۆک.',
    }
  ];

  for (const l of listingsToSeed) {
    await db.insert(schema.listings).values(l).onConflictDoUpdate({
      target: schema.listings.id,
      set: {
        price: l.price,
        currency: l.currency,
        status: l.status,
        title: l.title,
        description: l.description,
        updatedAt: new Date(),
      }
    });
  }
  summary.listings = listingsToSeed.length;

  // --------------------------------------------------------------------------
  // 16b. SEED PROMOTION CAMPAIGNS (Featured on Homepage and Sponsored Search)
  // --------------------------------------------------------------------------
  console.log('16b. Seeding promotion campaigns for homepage featured listings...');
  const now = new Date();
  const startTime = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  const endTime = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

  await db.insert(schema.promotionCampaigns).values([
    {
      id: 'demo_campaign_01',
      listingId: 'demo_listing_01',
      propertyId: 'demo_prop_01',
      requesterUserId: 'user_company_01',
      payerUserId: 'user_company_01',
      packageId: 'PKG_HOME_FEATURED_7D',
      packageVersion: 1,
      campaignType: 'HOME_FEATURED',
      placementScope: ['HOMEPAGE', 'SEARCH'],
      pointsCost: 500,
      durationDays: 7,
      status: 'ACTIVE',
      startTime,
      endTime,
      consentStatus: 'NOT_REQUIRED',
    },
    {
      id: 'demo_campaign_02',
      listingId: 'demo_listing_02',
      propertyId: 'demo_prop_03',
      requesterUserId: 'user_company_01',
      payerUserId: 'user_company_01',
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      packageVersion: 1,
      campaignType: 'SPONSORED_SEARCH',
      placementScope: ['SEARCH', 'HOMEPAGE'],
      pointsCost: 350,
      durationDays: 7,
      status: 'ACTIVE',
      startTime,
      endTime,
      consentStatus: 'NOT_REQUIRED',
    }
  ]).onConflictDoUpdate({
    target: schema.promotionCampaigns.id,
    set: {
      status: 'ACTIVE',
      startTime,
      endTime,
      updatedAt: new Date(),
    }
  });

  // --------------------------------------------------------------------------
  // 17. SEED RENTAL APPLICATION (Inactive Tenant Scenario)
  // --------------------------------------------------------------------------
  console.log('17. Seeding rental application for inactive tenant scenario...');
  const app1 = {
    id: 'demo_app_01',
    propertyId: 'demo_prop_01',
    unitId: 'demo_unit_102',
    applicantUserId: 'user_tenant_inactive_01',
    status: 'UNDER_REVIEW',
    monthlyIncome: '3500000',
    currency: 'IQD',
    employmentStatus: 'FULL_TIME_ENGINEER',
    preferredMoveInDate: '2026-11-01',
    notes: 'Senior tech specialist relocating to Erbil. Clean background and verifiable references.',
  };

  await db.insert(schema.rentalApplications).values(app1).onConflictDoUpdate({
    target: schema.rentalApplications.id,
    set: {
      status: app1.status,
      monthlyIncome: app1.monthlyIncome,
      currency: app1.currency,
      employmentStatus: app1.employmentStatus,
      preferredMoveInDate: app1.preferredMoveInDate,
      notes: app1.notes,
      updatedAt: new Date(),
    }
  });
  summary.rentalApplications = 1;

  // --------------------------------------------------------------------------
  // 18. SEED AGENT PROFILE & LICENSING (Agent Domain)
  // --------------------------------------------------------------------------
  console.log('18. Seeding agent profile and license...');
  const agentProfile1 = {
    id: 'demo_agent_profile_01',
    userId: 'user_agent_01',
    displayName: 'Ahmed Rahman',
    professionalTitle: 'Certified Real Estate Consultant',
    biography: 'Specialized in luxury residential rentals across Erbil, Dream City, and English Village.',
    phone: '+964 750 333 4455',
    email: 'agent@homehub.iq',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=256&auto=format&fit=crop&q=80',
    officeName: 'Zagros Property Management Ltd',
    officeAddress: 'Gulan Street, Erbil, Kurdistan Region, Iraq',
    spokenLanguages: ['Kurdish', 'Arabic', 'English'],
    specialties: ['Residential Leasing', 'Corporate Relocation', 'Tenant Screening'],
    propertyTypes: ['APARTMENT', 'VILLA'],
    serviceAreas: ['Erbil', 'Dream City', 'Empire World'],
    availabilityStatus: 'AVAILABLE',
    status: 'ACTIVE',
    isPublic: true,
  };

  await db.insert(schema.agentProfiles).values(agentProfile1).onConflictDoUpdate({
    target: schema.agentProfiles.userId,
    set: {
      displayName: agentProfile1.displayName,
      professionalTitle: agentProfile1.professionalTitle,
      biography: agentProfile1.biography,
      phone: agentProfile1.phone,
      email: agentProfile1.email,
      status: agentProfile1.status,
      availabilityStatus: agentProfile1.availabilityStatus,
      updatedAt: new Date(),
    }
  });
  summary.agentProfiles = 1;

  const agentLicense1 = {
    id: 'demo_license_agent_01',
    agentId: 'demo_agent_profile_01',
    userId: 'user_agent_01',
    licenseNumber: 'KRG-RE-2025-0892',
    issuingAuthority: 'Ministry of Trade and Industry - KRG',
    issuedDate: '2025-01-15',
    expiryDate: '2027-01-15',
    documentUrl: 'https://homehub.iq/docs/licenses/KRG-RE-2025-0892.pdf',
    verificationStatus: 'APPROVED',
    reviewedBy: 'admin_user_01',
    reviewedAt: new Date('2025-01-20'),
  };

  await db.insert(schema.agentLicenses).values(agentLicense1).onConflictDoUpdate({
    target: schema.agentLicenses.id,
    set: {
      licenseNumber: agentLicense1.licenseNumber,
      issuingAuthority: agentLicense1.issuingAuthority,
      issuedDate: agentLicense1.issuedDate,
      expiryDate: agentLicense1.expiryDate,
      verificationStatus: agentLicense1.verificationStatus,
      updatedAt: new Date(),
    }
  });
  summary.agentLicenses = 1;

  // --------------------------------------------------------------------------
  // 19. SEED AGENT PROPERTY ASSIGNMENT (Strict Scoping: demo_prop_01 & 04 assigned, others excluded)
  // --------------------------------------------------------------------------
  console.log('19. Seeding agent property assignments with strict access boundaries...');
  const agentAssignmentsToSeed = [
    {
      id: 'demo_apa_01',
      agentId: 'demo_agent_profile_01',
      userId: 'user_agent_01',
      propertyId: 'demo_prop_01',
      companyId: 'org_company_01',
      assignedBy: 'user_company_01',
      permissions: [
        'VIEW_PROPERTY',
        'CREATE_LISTING',
        'EDIT_LISTING',
        'MANAGE_VIEWINGS',
        'MANAGE_OFFERS',
        'VIEW_DOCUMENTS',
      ],
      status: 'ACTIVE',
      effectiveDate: new Date('2026-01-01'),
      expiryDate: null,
    },
    {
      id: 'demo_apa_02',
      agentId: 'demo_agent_profile_01',
      userId: 'user_agent_01',
      propertyId: 'demo_prop_04',
      companyId: 'org_company_01',
      assignedBy: 'user_company_01',
      permissions: [
        'VIEW_PROPERTY',
        'CREATE_LISTING',
        'EDIT_LISTING',
        'MANAGE_VIEWINGS',
        'MANAGE_OFFERS',
        'VIEW_DOCUMENTS',
      ],
      status: 'ACTIVE',
      effectiveDate: new Date('2026-01-01'),
      expiryDate: null,
    }
  ];

  for (const apa of agentAssignmentsToSeed) {
    await db.insert(schema.agentPropertyAssignments).values(apa).onConflictDoUpdate({
      target: schema.agentPropertyAssignments.id,
      set: {
        agentId: apa.agentId,
        userId: apa.userId,
        propertyId: apa.propertyId,
        companyId: apa.companyId,
        assignedBy: apa.assignedBy,
        permissions: apa.permissions,
        status: apa.status,
        updatedAt: new Date(),
      }
    });
  }
  summary.agentPropertyAssignments = agentAssignmentsToSeed.length;

  // --------------------------------------------------------------------------
  // 20. SEED PROPERTY INQUIRIES & VIEWINGS (Rental-Only Pipeline)
  // --------------------------------------------------------------------------
  console.log('20. Seeding property inquiries and viewings...');
  const inqsToSeed = [
    {
      id: 'demo_inq_01',
      buyerId: 'user_tenant_inactive_01',
      propertyId: 'demo_prop_01',
      listingId: 'demo_listing_01',
      inquiryType: 'GENERAL',
      message: 'Slaw, is Unit 102 available for lease starting November 2026? Can we arrange an in-person viewing?',
      status: 'PENDING',
      recipientUserId: 'user_agent_01',
      recipientCompanyId: 'org_company_01',
    },
    {
      id: 'demo_inq_02',
      buyerId: 'user_tenant_inactive_01',
      propertyId: 'demo_prop_03',
      listingId: 'demo_listing_02',
      inquiryType: 'AVAILABILITY',
      message: 'سڵاو، ئایا ئاپارتمانی یەکەی 303 لە چاوی سلێمانی خزمەتگوزاری گەرمکەرەوەی تێدایە؟',
      status: 'PENDING',
      recipientUserId: 'user_company_01',
      recipientCompanyId: 'org_company_01',
    }
  ];

  for (const inq of inqsToSeed) {
    await db.insert(schema.propertyInquiries).values(inq).onConflictDoUpdate({
      target: schema.propertyInquiries.id,
      set: {
        message: inq.message,
        status: inq.status,
        recipientUserId: inq.recipientUserId,
        recipientCompanyId: inq.recipientCompanyId,
        updatedAt: new Date(),
      }
    });
  }
  summary.propertyInquiries = inqsToSeed.length;

  const viewingsToSeed = [
    {
      id: 'demo_viewing_01',
      buyerId: 'user_tenant_inactive_01',
      propertyId: 'demo_prop_01',
      listingId: 'demo_listing_01',
      scheduledAt: new Date(Date.now() + 86400000 * 2), // 2 days in future
      status: 'CONFIRMED',
      viewingType: 'IN_PERSON',
      notes: 'Prospective tenant tour of luxury 3BR unit (Unit 102).',
      organizerUserId: 'user_agent_01',
      organizerCompanyId: 'org_company_01',
    },
    {
      id: 'demo_viewing_02',
      buyerId: 'user_tenant_01',
      propertyId: 'demo_prop_04',
      listingId: 'demo_listing_03',
      scheduledAt: new Date(Date.now() + 86400000 * 3), // 3 days in future
      status: 'CONFIRMED',
      viewingType: 'IN_PERSON',
      notes: 'Executive corporate office inspection for Suite 402 with technical lead.',
      organizerUserId: 'user_agent_01',
      organizerCompanyId: 'org_company_01',
    }
  ];

  for (const v of viewingsToSeed) {
    await db.insert(schema.propertyViewings).values(v).onConflictDoUpdate({
      target: schema.propertyViewings.id,
      set: {
        scheduledAt: v.scheduledAt,
        status: v.status,
        viewingType: v.viewingType,
        notes: v.notes,
        organizerUserId: v.organizerUserId,
        organizerCompanyId: v.organizerCompanyId,
        updatedAt: new Date(),
      }
    });
  }
  summary.propertyViewings = viewingsToSeed.length;

  // --------------------------------------------------------------------------
  // 21. SEED AGENT LEADS & TASKS (Rental-Only Pipeline)
  // --------------------------------------------------------------------------
  console.log('21. Seeding agent leads and operational tasks...');
  const leadsToSeed = [
    {
      id: 'demo_lead_01',
      agentId: 'demo_agent_profile_01',
      userId: 'user_agent_01',
      companyId: 'org_company_01',
      clientName: 'Azad Ibrahim',
      clientPhone: '+964 750 666 7788',
      clientEmail: 'tenant.inactive@homehub.iq',
      leadType: 'RENT',
      stage: 'QUALIFIED',
      budgetMin: '2000000',
      budgetMax: '3500000',
      currency: 'IQD',
      preferredLocations: ['Dream City', 'Gulan', 'Empire World'],
      propertyType: 'APARTMENT',
      notes: 'Senior tech specialist looking for high-finish 2BR/3BR apartment. Qualified income.',
      priority: 'HIGH',
      source: 'MARKETPLACE_INQUIRY',
      linkedBuyerId: 'user_tenant_inactive_01',
      linkedPropertyId: 'demo_prop_01',
      linkedListingId: 'demo_listing_01',
      linkedInquiryId: 'demo_inq_01',
      linkedViewingId: 'demo_viewing_01',
    },
    {
      id: 'demo_lead_02',
      agentId: 'demo_agent_profile_01',
      userId: 'user_agent_01',
      companyId: 'org_company_01',
      clientName: 'Rebin Tech Solutions',
      clientPhone: '+964 750 888 9911',
      clientEmail: 'corporate@rebintech.iq',
      leadType: 'RENT',
      stage: 'VIEWING_SCHEDULED',
      budgetMin: '2000',
      budgetMax: '2500',
      currency: 'USD',
      preferredLocations: ['Empire World', '100M Road'],
      propertyType: 'COMMERCIAL',
      notes: 'Looking for modern executive office space in Empire World for software engineering team.',
      priority: 'HIGH',
      source: 'DIRECT_CALL',
      linkedPropertyId: 'demo_prop_04',
      linkedListingId: 'demo_listing_03',
      linkedViewingId: 'demo_viewing_02',
    }
  ];

  for (const lead of leadsToSeed) {
    await db.insert(schema.agentLeads).values(lead).onConflictDoUpdate({
      target: schema.agentLeads.id,
      set: {
        clientName: lead.clientName,
        clientPhone: lead.clientPhone,
        clientEmail: lead.clientEmail,
        leadType: lead.leadType,
        stage: lead.stage,
        budgetMin: lead.budgetMin,
        budgetMax: lead.budgetMax,
        currency: lead.currency,
        priority: lead.priority,
        notes: lead.notes,
        updatedAt: new Date(),
      }
    });
  }
  summary.agentLeads = leadsToSeed.length;

  const tasksToSeed = [
    {
      id: 'demo_task_01',
      agentId: 'demo_agent_profile_01',
      userId: 'user_agent_01',
      companyId: 'org_company_01',
      title: 'Review Rental Application for Unit 102',
      description: 'Evaluate income verification and references for Azad Ibrahim on Unit 102.',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 86400000 * 3),
      status: 'PENDING',
      category: 'APPLICATION_REVIEW',
      linkedLeadId: 'demo_lead_01',
      linkedPropertyId: 'demo_prop_01',
    },
    {
      id: 'demo_task_02',
      agentId: 'demo_agent_profile_01',
      userId: 'user_agent_01',
      companyId: 'org_company_01',
      title: 'Host Commercial Office Tour for Suite 402',
      description: 'Meet Rebin Tech Solutions delegation at Empire World Plaza 3 lobby for suite tour.',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 86400000 * 3),
      status: 'PENDING',
      category: 'VIEWING_COORDINATION',
      linkedLeadId: 'demo_lead_02',
      linkedPropertyId: 'demo_prop_04',
    }
  ];

  for (const t of tasksToSeed) {
    await db.insert(schema.agentTasks).values(t).onConflictDoUpdate({
      target: schema.agentTasks.id,
      set: {
        title: t.title,
        description: t.description,
        priority: t.priority,
        dueDate: t.dueDate,
        status: t.status,
        category: t.category,
        updatedAt: new Date(),
      }
    });
  }
  summary.agentTasks = tasksToSeed.length;

  // --------------------------------------------------------------------------
  // 22. SEED AGENT CALENDAR EVENTS
  // --------------------------------------------------------------------------
  console.log('22. Seeding agent calendar events...');
  const eventsToSeed = [
    {
      id: 'demo_event_01',
      userId: 'user_agent_01',
      title: 'Property Viewing: Unit 102 (Azad Ibrahim)',
      eventType: 'VIEWING',
      startTime: new Date(Date.now() + 86400000 * 2),
      endTime: new Date(Date.now() + 86400000 * 2 + 3600000),
      location: 'Gulan Towers, Unit 102, Erbil',
      status: 'SCHEDULED',
      linkedLeadId: 'demo_lead_01',
      linkedViewingId: 'demo_viewing_01',
      linkedPropertyId: 'demo_prop_01',
      notes: 'Client requested in-person tour of 3BR unit.',
    },
    {
      id: 'demo_event_02',
      userId: 'user_agent_01',
      title: 'Commercial Suite Tour: Empire World 402 (Rebin Tech)',
      eventType: 'VIEWING',
      startTime: new Date(Date.now() + 86400000 * 3),
      endTime: new Date(Date.now() + 86400000 * 3 + 3600000),
      location: 'Empire World Plaza 3, Suite 402, Erbil',
      status: 'SCHEDULED',
      linkedLeadId: 'demo_lead_02',
      linkedViewingId: 'demo_viewing_02',
      linkedPropertyId: 'demo_prop_04',
      notes: 'Corporate executive viewing with technical lead.',
    }
  ];

  for (const ev of eventsToSeed) {
    await db.insert(schema.agentEvents).values(ev).onConflictDoUpdate({
      target: schema.agentEvents.id,
      set: {
        title: ev.title,
        eventType: ev.eventType,
        startTime: ev.startTime,
        endTime: ev.endTime,
        location: ev.location,
        status: ev.status,
        notes: ev.notes,
        updatedAt: new Date(),
      }
    });
  }
  summary.agentEvents = eventsToSeed.length;

  console.log('\n================================================================');
  console.log('  HOMEHUB DEMO SEEDING COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
  console.log(`  Users Seeded:                ${summary.users}`);
  console.log(`  Organizations:               ${summary.organizations}`);
  console.log(`  Organization Members:        ${summary.organizationMembers}`);
  console.log(`  Financial Policies:          ${summary.financialPolicies}`);
  console.log(`  Properties Seeded:           ${summary.properties}`);
  console.log(`  Units Seeded:                ${summary.units}`);
  console.log(`  Ownership Records:           ${summary.ownershipRecords}`);
  console.log(`  Management Agreements:       ${summary.managementAgreements}`);
  console.log(`  Leases Seeded:               ${summary.leases}`);
  console.log(`  Lease Tenants Linked:        ${summary.leaseTenants}`);
  console.log(`  Rent Schedules:              ${summary.rentSchedules}`);
  console.log(`  Payment Records:             ${summary.paymentRecords}`);
  console.log(`  Commissions Posted:          ${summary.commissions}`);
  console.log(`  Journal Entries:             ${summary.journalEntries}`);
  console.log(`  Ledger Lines Balanced:       ${summary.ledgerLines}`);
  console.log(`  Security Deposits:           ${summary.securityDeposits}`);
  console.log(`  Utility Bills:               ${summary.utilityBills}`);
  console.log(`  Maintenance Requests:        ${summary.maintenanceRequests}`);
  console.log(`  Maintenance Quotes:          ${summary.maintenanceQuotes}`);
  console.log(`  Work Orders:                 ${summary.workOrders}`);
  console.log(`  Vendor Profiles:             ${summary.vendorProfiles}`);
  console.log(`  Documents Protected:         ${summary.documents}`);
  console.log(`  Conversations:               ${summary.conversations}`);
  console.log(`  Messages:                    ${summary.messages}`);
  console.log(`  Notifications:               ${summary.notifications}`);
  console.log(`  Rental Listings:             ${summary.listings}`);
  console.log(`  Rental Applications:         ${summary.rentalApplications}`);
  console.log(`  Agent Profiles:              ${summary.agentProfiles}`);
  console.log(`  Agent Licenses:              ${summary.agentLicenses}`);
  console.log(`  Agent Property Assignments:  ${summary.agentPropertyAssignments}`);
  console.log(`  Agent Leads:                 ${summary.agentLeads}`);
  console.log(`  Agent Tasks:                 ${summary.agentTasks}`);
  console.log(`  Property Inquiries:          ${summary.propertyInquiries}`);
  console.log(`  Property Viewings:           ${summary.propertyViewings}`);
  console.log(`  Agent Events:                ${summary.agentEvents}`);
  console.log('================================================================\n');

  return summary;
}

// Allow standalone execution via tsx scripts/seed-demo-data.ts
if (process.argv[1]?.includes('seed-demo-data')) {
  runDemoSeed()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('\n❌ SEED EXECUTION FAILED:', err);
      await closePool();
      process.exit(1);
    });
}
