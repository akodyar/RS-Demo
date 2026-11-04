import { db } from './src/db/index.js';
import { properties, listings, ownershipRecords } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

const API_URL = 'http://localhost:3000/api';

async function testMissingOwner() {
  console.log("--- TEST F: Missing Owner (P0 Defect) ---");
  const res = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer dev-platform_admin',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test Ownerless Property Admin',
      type: 'APARTMENT',
      listingType: 'FOR_RENT',
      price: 1000,
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED'
    })
  });
  
  if (res.status !== 201) {
    console.log("Failed to create property:", await res.text());
  } else {
    const data = await res.json();
    console.log("Created property ID:", data.id, "Status:", data.status);
    
    // Check DB
    const listing = await db.select().from(listings).where(eq(listings.propertyId, data.id));
    const owners = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, data.id));
    
    console.log("DB Ownership Records Count:", owners.length);
    console.log("DB Listing Status:", listing.length > 0 ? listing[0].status : 'None');
    
    if (owners.length === 0 && listing.length > 0 && listing[0].status === 'PUBLISHED') {
      console.log("FAIL: Property has no owner but is PUBLISHED in listings!");
    } else {
      console.log("PASS: Property handled correctly.");
    }
  }
}

async function testOperatingModelFees() {
  console.log("\n--- TEST: AGENT_OPERATED with Fees (P1 Defect) ---");
  const res = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer dev-owner',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test Agent Operated Property',
      type: 'VILLA',
      listingType: 'FOR_RENT',
      price: 2000,
      address: { city: 'Erbil' },
      operatingModel: 'AGENT_OPERATED',
      rentFee: 0.10,
      managementFee: 0.10
    })
  });
  
  if (res.status === 201) {
    const data = await res.json();
    console.log("Created property ID:", data.id);
    console.log("Rent Fee:", data.rentFee, "Management Fee:", data.managementFee);
    
    if (data.rentFee > 0 || data.managementFee > 0) {
      console.log("FAIL: AGENT_OPERATED property allowed to persist fees!");
    } else {
      console.log("PASS: Fees ignored/rejected for AGENT_OPERATED.");
    }
  } else {
    console.log("Server response:", res.status, await res.text());
  }
}

async function testUnauthorizedOwner() {
  console.log("\n--- TEST: Unauthorized Owner (P0 Defect) ---");
  const res = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer dev-agent', // dev-agent has AGENT_BROKER role
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test Forged Owner Property',
      type: 'HOUSE',
      listingType: 'FOR_RENT',
      price: 1500,
      address: { city: 'Sulaymaniyah' },
      ownerId: 'user_owner_02', // dev-owner-b
      operatingModel: 'FULLY_MANAGED'
    })
  });
  
  if (res.status === 201) {
    console.log("Created property ID:", (await res.json()).id);
    console.log("FAIL: Agent successfully forged owner ID without an existing client relationship!");
  } else {
    console.log("Server rejected forged owner:", res.status, await res.text());
    console.log("PASS: Server rejected unauthorized owner assignment.");
  }
}

async function testTenantDenial() {
  console.log("\n--- TEST: Tenant Denial ---");
  const res = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer dev-tenant',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Tenant Created Property',
      type: 'HOUSE',
      listingType: 'FOR_RENT',
      price: 1500,
      address: { city: 'Slemani' },
      operatingModel: 'FULLY_MANAGED'
    })
  });
  
  if (res.status === 201) {
    console.log("FAIL: Tenant created property!");
  } else {
    console.log("Server rejected tenant:", res.status, await res.text());
    console.log("PASS: Tenant denied.");
  }
}

async function runAll() {
  await testMissingOwner();
  await testOperatingModelFees();
  await testUnauthorizedOwner();
  await testTenantDenial();
  process.exit(0);
}

runAll().catch(console.error);
