import fetch from 'node-fetch';
import { db } from '../src/db/index.js';
import { properties, ownershipRecords, agentPropertyAssignments, managementAgreements } from '../src/db/schema.js';
import { eq, desc } from 'drizzle-orm';

const API_URL = 'http://localhost:3000/api/properties';

async function testPropertyCreation(token: string, name: string) {
  console.log(`\nTesting with token: ${token}`);
  const bodyPayload: any = {
    name,
    type: 'Apartment',
    listingType: 'FOR_RENT',
    address: { city: 'Erbil' },
    operatingModel: 'AGENT_OPERATED'
  };

  if (token.includes('agent') || token.includes('admin')) {
    bodyPayload.ownerId = 'user_owner_01'; // Simulated real owner selected by Agent/Admin
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyPayload)
  });

  const statusCode = res.status;
  const data = await res.json();
  console.log(`Status: ${statusCode}`);
  
  if (statusCode === 201) {
    const propertyId = data.id;
    console.log(`Property Created: ${propertyId}`);
    
    // Check ownershipRecords
    const owners = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, propertyId));
    console.log(`Ownership Records: ${JSON.stringify(owners)}`);

    // Check managementAgreements
    const mgmt = await db.select().from(managementAgreements).where(eq(managementAgreements.propertyId, propertyId));
    console.log(`Management Agreements: ${JSON.stringify(mgmt)}`);

    // Check agentPropertyAssignments
    const agents = await db.select().from(agentPropertyAssignments).where(eq(agentPropertyAssignments.propertyId, propertyId));
    console.log(`Agent Assignments: ${JSON.stringify(agents)}`);

    // Check property fields
    const prop = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
    console.log(`Property Fields (managedByAgentId): ${prop[0].managedByAgentId}`);
  } else {
    console.log(`Error: ${JSON.stringify(data)}`);
  }
}

async function run() {
  await testPropertyCreation('dev-owner', 'Test Prop Owner Individual');
  await testPropertyCreation('dev-company', 'Test Prop Owner Company');
  await testPropertyCreation('dev-agent', 'Test Prop Agent Individual');
  await testPropertyCreation('dev-company-agent', 'Test Prop Agent Company');
  await testPropertyCreation('dev-platform-admin', 'Test Prop Admin');
  await testPropertyCreation('dev-tenant', 'Test Prop Tenant');
  process.exit(0);
}

run();
