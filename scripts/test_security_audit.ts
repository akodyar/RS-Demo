import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/properties';

async function runTests() {
  console.log('\n--- Test A: Agent attempts to create property with random/invalid ownerId ---');
  let res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer dev-agent', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test A', type: 'Apartment', listingType: 'FOR_RENT', address: { city: 'Erbil' },
      ownerId: 'invalid_user_123'
    })
  });
  console.log('Status:', res.status, await res.json());

  console.log('\n--- Test B: Agent attempts to impersonate another creator ---');
  res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer dev-agent', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test B', type: 'Apartment', listingType: 'FOR_RENT', address: { city: 'Erbil' },
      creatorId: 'user_owner_01'
    })
  });
  console.log('Status:', res.status, await res.json());

  console.log('\n--- Test C: Tenant attempts to create property ---');
  res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer dev-tenant', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test C', type: 'Apartment', listingType: 'FOR_RENT', address: { city: 'Erbil' },
      ownerId: 'user_owner_01'
    })
  });
  console.log('Status:', res.status, await res.json());

  console.log('\n--- Test D: Normal Owner attempts to assign ownership to someone else ---');
  res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer dev-owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test D', type: 'Apartment', listingType: 'FOR_RENT', address: { city: 'Erbil' },
      ownerId: 'admin_user_02'
    })
  });
  console.log('Status:', res.status, await res.json());

  console.log('\n--- Test E: Normal Owner attempts to create valid property (baseline) ---');
  res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer dev-owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test E', type: 'Apartment', listingType: 'FOR_RENT', address: { city: 'Erbil' },
    })
  });
  console.log('Status:', res.status, await res.json());
}

runTests();
