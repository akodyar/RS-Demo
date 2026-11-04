import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'screenshots', 'rental-property-search-deep-audit-2026-10-30');
const indexJsonPath = path.join(dir, 'screenshot-index.json');
const indexMdPath = path.join(dir, 'screenshot-index.md');
const matrixPath = path.join(process.cwd(), 'rental-search-audit', 'audit-test-matrix.json');

console.log('--- INSPECTING PREVIOUS AUDIT ARTIFACTS ---');

if (!fs.existsSync(indexJsonPath)) {
  console.error('FAIL: indexJsonPath missing:', indexJsonPath);
  process.exit(1);
}

const index = JSON.parse(fs.readFileSync(indexJsonPath, 'utf8'));
console.log('Total entries in screenshot-index.json:', index.length);

const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let missingCount = 0;
let invalidPngCount = 0;
let dimensionMismatchCount = 0;
const filenamesInIndex = new Set<string>();
const duplicateFilenames: string[] = [];

index.forEach((entry: any, idx: number) => {
  if (filenamesInIndex.has(entry.filename)) {
    duplicateFilenames.push(entry.filename);
  }
  filenamesInIndex.add(entry.filename);

  const fullPath = path.join(dir, entry.filename);
  if (!fs.existsSync(fullPath)) {
    console.error(`[MISSING] ${entry.filename}`);
    missingCount++;
    return;
  }
  const buf = fs.readFileSync(fullPath);
  const isPng = buf.subarray(0, 8).equals(pngMagic);
  if (!isPng) {
    console.error(`[INVALID PNG] ${entry.filename}`);
    invalidPngCount++;
    return;
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const [expectedW, expectedH] = entry.viewport.split('x').map(Number);
  const matches = width === expectedW && height === expectedH;
  if (!matches) {
    console.warn(`[DIMENSION MISMATCH] ${entry.filename}: actual=${width}x${height}, claimed=${entry.viewport}`);
    dimensionMismatchCount++;
  } else {
    // console.log(`[VALID] ${entry.filename}: ${width}x${height}`);
  }
});

// Also check directory files vs index
const allFiles = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
const unindexedFiles = allFiles.filter(f => !filenamesInIndex.has(f));

console.log('\n--- VERIFICATION SUMMARY ---');
console.log('Expected screenshots count:', 35);
console.log('PNG files on disk:', allFiles.length);
console.log('Index entries count:', index.length);
console.log('Missing files:', missingCount);
console.log('Invalid PNG headers:', invalidPngCount);
console.log('Dimension mismatches:', dimensionMismatchCount);
console.log('Duplicate index entries:', duplicateFilenames.length);
console.log('Unindexed PNG files on disk:', unindexedFiles.length);

if (fs.existsSync(matrixPath)) {
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  console.log('Audit test matrix items:', matrix.length);
  const passed = matrix.filter((r: any) => r.status === 'PASS').length;
  const failed = matrix.filter((r: any) => r.status === 'FAIL').length;
  console.log(`Matrix tests - PASS: ${passed}, FAIL: ${failed}`);
} else {
  console.warn('audit-test-matrix.json missing');
}

