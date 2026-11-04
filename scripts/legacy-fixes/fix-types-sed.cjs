const fs = require('fs');

let lines = fs.readFileSync('src/types/index.ts', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('status: AIActionStatus;|')) {
    if (lines[i].includes('executionStatus')) {
        lines[i] = "  executionStatus: 'PENDING' | 'EXECUTED' | 'FAILED' | 'REJECTED';";
    } else if (lines[i].includes('status: \'PROPOSED\' |')) {
        lines[i] = "  status: AIActionStatus;";
    } else if (lines[i].includes('status: \'PENDING\' |')) {
        lines[i] = "  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';";
    }
  }
}

fs.writeFileSync('src/types/index.ts', lines.join('\n'));

