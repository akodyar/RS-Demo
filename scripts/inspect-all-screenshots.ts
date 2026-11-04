import fs from 'fs';
import path from 'path';

const screenshotsDir = path.resolve('artifacts/cross-domain-e2e/e2e_1792485195030/screenshots');
const actionLogPath = path.resolve('artifacts/cross-domain-e2e/e2e_1792485195030/action-log.csv');

interface PngMeta {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  valid: boolean;
  error?: string;
}

function parsePngHeader(filePath: string): PngMeta {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(30);
    fs.readSync(fd, buffer, 0, 30, 0);
    fs.closeSync(fd);

    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < 8; i++) {
      if (buffer[i] !== signature[i]) {
        return { width: 0, height: 0, bitDepth: 0, colorType: 0, valid: false, error: 'Invalid PNG signature' };
      }
    }

    // Check IHDR
    const ihdr = buffer.toString('ascii', 12, 16);
    if (ihdr !== 'IHDR') {
      return { width: 0, height: 0, bitDepth: 0, colorType: 0, valid: false, error: 'Missing IHDR chunk' };
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const bitDepth = buffer.readUInt8(24);
    const colorType = buffer.readUInt8(25);

    return { width, height, bitDepth, colorType, valid: true };
  } catch (err: any) {
    return { width: 0, height: 0, bitDepth: 0, colorType: 0, valid: false, error: err.message };
  }
}

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

async function main() {
  const files = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
  console.log(`Found ${files.length} PNG screenshots in ${screenshotsDir}`);

  // Read action log
  const actionLogRaw = fs.readFileSync(actionLogPath, 'utf8');
  const actionLines = actionLogRaw.trim().split('\n').slice(1);
  const actions: Record<string, any> = {};

  for (const line of actionLines) {
    const cols = parseCSVLine(line);
    if (cols.length >= 10) {
      const [step, timestamp, domain, actionName, selector, url, beforeShot, afterShot, status, details] = cols;
      actions[beforeShot] = { step, timestamp, domain, actionName, selector, url, type: 'BEFORE', status, details };
      actions[afterShot] = { step, timestamp, domain, actionName, selector, url, type: 'AFTER', status, details };
    }
  }

  const results = [];
  let corruptCount = 0;

  for (const file of files) {
    const fullPath = path.join(screenshotsDir, file);
    const stat = fs.statSync(fullPath);
    const meta = parsePngHeader(fullPath);

    if (!meta.valid) corruptCount++;

    const actionInfo = actions[file] || {
      step: 'N/A',
      domain: 'N/A',
      actionName: 'Unmapped',
      selector: 'N/A',
      url: 'N/A',
      type: file.includes('before') ? 'BEFORE' : (file.includes('after') ? 'AFTER' : 'OTHER'),
      status: 'N/A',
      details: ''
    };

    results.push({
      file,
      path: `artifacts/cross-domain-e2e/e2e_1792485195030/screenshots/${file}`,
      sizeBytes: stat.size,
      width: meta.width,
      height: meta.height,
      valid: meta.valid,
      error: meta.error || null,
      ...actionInfo
    });
  }

  console.log(`Processed ${results.length} files. Corrupt count: ${corruptCount}`);

  // Sort by step and type
  results.sort((a, b) => {
    const stepA = parseInt(a.step) || 0;
    const stepB = parseInt(b.step) || 0;
    if (stepA !== stepB) return stepA - stepB;
    return a.type === 'BEFORE' ? -1 : 1;
  });

  fs.writeFileSync('scripts/screenshot-analysis.json', JSON.stringify(results, null, 2));
  console.log('Wrote scripts/screenshot-analysis.json');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
