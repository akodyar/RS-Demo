const fs = require('fs');
const renames = {
  '0005_soft_tempest': '0002_soft_tempest',
  '0006_daffy_rumiko_fujikawa': '0003_daffy_rumiko_fujikawa',
  '0007_handy_franklin_storm': '0004_handy_franklin_storm',
  '0002_buyer_domain': '0005_buyer_domain',
  '0003_agent_domain': '0006_agent_domain',
  '0004_vendor_domain': '0007_vendor_domain'
};

for (let [oldN, newN] of Object.entries(renames)) {
  fs.renameSync(`drizzle/${oldN}.sql`, `drizzle/temp_${newN}.sql`);
  fs.renameSync(`drizzle/meta/${oldN.split('_')[0]}_snapshot.json`, `drizzle/meta/temp_${newN.split('_')[0]}_snapshot.json`);
}

for (let [oldN, newN] of Object.entries(renames)) {
  fs.renameSync(`drizzle/temp_${newN}.sql`, `drizzle/${newN}.sql`);
  fs.renameSync(`drizzle/meta/temp_${newN.split('_')[0]}_snapshot.json`, `drizzle/meta/${newN.split('_')[0]}_snapshot.json`);
  console.log(`Renamed ${oldN} to ${newN}`);
}

const journalPath = 'drizzle/meta/_journal.json';
const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));

// Rebuild journal
const sortedTags = [
  '0000_icy_daimon_hellstrom',
  '0001_nosy_abomination',
  '0002_soft_tempest',
  '0003_daffy_rumiko_fujikawa',
  '0004_handy_franklin_storm',
  '0005_buyer_domain',
  '0006_agent_domain',
  '0007_vendor_domain',
  '0008_ai_autopilot_governance',
  '0009_trust_verification_disputes',
  '0010_communications_notifications_crm',
  '0011_dusty_mephisto'
];

journal.entries = sortedTags.map((tag, idx) => ({
  idx,
  version: '7',
  when: Date.now() + idx,
  tag,
  breakpoints: true
}));

fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2));
console.log('Rebuilt _journal.json');
