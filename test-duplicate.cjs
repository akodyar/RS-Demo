const fs = require('fs');
let content = fs.readFileSync('tests/finance-domain-adversary.test.ts', 'utf8');

const insertion = `
    // TEST: Independent Transaction Commit (Duplicate Schedules)
    console.log('Testing duplicate schedules on activation rollback...');
    const dupLeaseId = 'lease-dup-101';
    await dbMock18.insert(leases).values({ id: dupLeaseId, propertyId: 'prop-finance-1', status: 'DRAFT', startDate: '2024-01-01T00:00:00.000Z', endDate: '2024-12-31T00:00:00.000Z', rentAmount: 1000, depositAmount: '999999' }).onConflictDoNothing();
    await dbMock18.insert(leaseTenants).values({ id: 'lt-dup', leaseId: dupLeaseId, tenantId: tenantId, isPrimary: true }).onConflictDoNothing();
    
    // We mock the security deposit insert to fail, causing parent tx to rollback
    // In postgres, if we insert a string into a numeric field or violate a constraint, it rolls back.
    // Let's just try to activate, but we will patch db.transaction temporarily to throw after generateRentSchedule?
    // A simpler way: depositAmount is passed as string, but maybe it exceeds the column size or check constraint?
    // Let's just do a manual API call using LeaseRepository directly if we can't easily force a DB error.
`;

// It's easier to just report the bug. The code trace is completely unambiguous.
