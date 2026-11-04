const fs = require('fs');
const { execSync } = require('child_process');

async function runAudit() {
  console.log('--- FINAL EVIDENCE-STRENGTHENING AUDIT ---');

  // 1. Secret Handling
  console.log('\n[6. SECRET HANDLING]');
  try {
    const gitGrep = execSync('git grep -i "password=" || true').toString();
    console.log('Secrets found:', gitGrep ? 'YES (Need manual review)' : 'NONE FOUND');
  } catch(e) {}

  // 2. Migration Integrity
  console.log('\n[3. MIGRATION INTEGRITY]');
  try {
    const drizzleCheck = execSync('npx drizzle-kit check').toString();
    console.log('drizzle-kit check result:', drizzleCheck.includes('Everything\'s fine') ? 'PASS' : 'FAIL');
  } catch(e) {
    console.log('drizzle-kit check failed.');
  }
  
  // 3. Test counts
  console.log('\n[5. TEST INTEGRITY]');
  const testFiles = fs.readdirSync('./tests').filter(f => f.endsWith('.test.ts'));
  console.log(`Test files count: ${testFiles.length}`);

  // Test assertions count
  let assertionCount = 0;
  for(let file of testFiles) {
    const content = fs.readFileSync(`./tests/${file}`, 'utf8');
    const matches = content.match(/assert\.|expect\(/g);
    if(matches) assertionCount += matches.length;
  }
  console.log(`Assertions count: ${assertionCount}`);

  // 4. Backup
  console.log('\n[8. BACKUP / DISASTER RECOVERY]');
  try {
    const backupScript = fs.readFileSync('./scripts/backup.ts', 'utf8');
    const tablesMatch = backupScript.match(/tables:\s*\[(.*?)\]/s);
    if(tablesMatch) {
      const tables = tablesMatch[1].split(',').filter(t => t.trim().length > 0).length;
      console.log(`Application drill covers ${tables} tables.`);
    }
  } catch(e) {}
}

runAudit();
