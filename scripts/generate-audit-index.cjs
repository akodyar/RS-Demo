const fs = require('fs');
const jsonPath = 'screenshots/notifications-communications-crm-localization-deep-audit/INDEX.json';
const mdPath = 'screenshots/notifications-communications-crm-localization-deep-audit/INDEX.md';
const records = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const lines = [
  '# HomeHub Notifications, Communications, Messaging & CRM UI Deep Audit',
  '## Screenshot Evidence & Inspection Index',
  '',
  '**Target Directory**: `screenshots/notifications-communications-crm-localization-deep-audit`',
  '**Total Screenshots Captured**: ' + records.length,
  '**Execution Environment**: Local Playwright Chromium (Option C Mandate)',
  '**Status**: Authoritative Discrepancies Remediated & Verified',
  '',
  '| Seq | Filename | Role | Language | Dir | Viewport | Workflow | Assertion Result |',
  '|---|---|---|---|---|---|---|---|'
];

for (const r of records) {
  lines.push(`| ${r.seq} | [\`${r.filename}\`](./${r.filename}) | ${r.role} | ${r.language.toUpperCase()} | ${r.direction.toUpperCase()} | ${r.viewport} | ${r.workflow} | ${r.assertionResult} |`);
}

lines.push('', '', '## Individual Visual Inspection Details', '');
for (const r of records) {
  lines.push(`### ${r.seq}. ${r.filename}`);
  lines.push(`- **Workflow**: ${r.workflow}`);
  lines.push(`- **Page State**: ${r.pageState}`);
  lines.push(`- **User Role**: ${r.role}`);
  lines.push(`- **Language & Direction**: ${r.language.toUpperCase()} (${r.direction.toUpperCase()})`);
  lines.push(`- **Viewport**: ${r.viewport}`);
  lines.push(`- **Action Taken**: ${r.action}`);
  lines.push(`- **Description**: ${r.description}`);
  lines.push(`- **Verification Status**: ${r.status}`);
  lines.push('');
}

fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');
console.log('INDEX.md generated successfully with', records.length, 'records');
