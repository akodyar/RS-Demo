require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const leases = await pool.query("SELECT * FROM lease_tenants WHERE tenant_id = 'user_tenant_01'");
  console.log('Lease tenants for user_tenant_01:', leases.rows.length);
  if (leases.rows.length > 0) {
    console.log('Lease:', leases.rows[0]);
  }
  const props = await pool.query("SELECT * FROM properties WHERE owner_id = 'user_owner_01'");
  console.log('Properties for user_owner_01:', props.rows.length);
  if (props.rows.length > 0) {
    console.log('Property 0:', props.rows[0].id, props.rows[0].name);
  }
  const bills = await pool.query("SELECT * FROM utility_bills WHERE tenant_id = 'user_tenant_01'");
  console.log('Bills for user_tenant_01:', bills.rows.length);
  if (bills.rows.length > 0) {
    console.log('Bill 0:', bills.rows[0]);
  }
  const maint = await pool.query("SELECT * FROM maintenance_requests WHERE reporter_user_id = 'user_tenant_01'");
  console.log('Maintenance for user_tenant_01:', maint.rows.length);
  await pool.end();
}

run().catch(console.error);
