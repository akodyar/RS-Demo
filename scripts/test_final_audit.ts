import fetch from 'node-fetch';
import { db } from '../src/db/index.js';
import { properties, ownershipRecords, agentPropertyAssignments, managementAgreements } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

const API_URL = 'http://localhost:3000/api/properties';

async function testFlow(token: string, name: string) {
  console.log(`\n======================================`);
  console.log(`TESTING FLOW: ${name} (Token: ${token})`);
  
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      type: 'Apartment',
      listingType: 'FOR_RENT',
      address: { city: 'Erbil' },
      ownerId: 'user_owner_01' // Real Owner supplied
    })
  });
  
  const property = await res.json();
  console.log('Status:', res.status, property.error ? property : 'Property Created');
  
  if (res.status === 201) {
    const pId = property.id;
    console.log(`\nDATABASE VERIFICATION FOR PROPERTY ID: ${pId}`);
    
    // Check Ownership
    const owners = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, pId));
    console.log(`OWNERSHIP RECORDS (${owners.length}):`);
    owners.forEach(o => console.log(`  - ID: ${o.id}, OwnerID: ${o.ownerId}, CompanyID: ${o.companyId}, %: ${o.ownershipPercentage}`));

    // Check Management Agreements (Company Agents)
    const managers = await db.select().from(managementAgreements).where(eq(managementAgreements.propertyId, pId));
    console.log(`MANAGEMENT AGREEMENTS (${managers.length}):`);
    managers.forEach(m => console.log(`  - ID: ${m.id}, CompanyID: ${m.companyId}, OwnerID: ${m.ownerId}, Status: ${m.status}`));

    // Check Agent Assignments (Individual Agents)
    const agents = await db.select().from(agentPropertyAssignments).where(eq(agentPropertyAssignments.propertyId, pId));
    console.log(`AGENT ASSIGNMENTS (${agents.length}):`);
    agents.forEach(a => console.log(`  - ID: ${a.id}, UserID: ${a.userId}, AssignedBy: ${a.assignedBy}, Status: ${a.status}`));
  }
}

async function run() {
  await testFlow('dev-agent', 'Final Audit - Agent');
  await testFlow('dev-company-agent', 'Final Audit - Company Agent');
  await testFlow('dev-platform-admin', 'Final Audit - Platform Admin');
}

run();
