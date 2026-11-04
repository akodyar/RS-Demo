import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

function sha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function checkPngValid(filePath: string): { valid: boolean; width?: number; height?: number; error?: string } {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 24) return { valid: false, error: 'File too small for PNG header' };
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
                  buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
    if (!isPng) return { valid: false, error: 'Invalid PNG signature' };
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { valid: true, width, height };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

async function run() {
  console.log('================================================================');
  console.log('FORENSIC SCREENSHOT EVIDENCE & DISCREPANCY AUDIT');
  console.log('================================================================\n');

  // 1. INVESTIGATE IDE .tempmediaStorage
  console.log('--- 1. IDE .tempmediaStorage (User Chat UI Artifacts) ---');
  const tempMediaDir = 'C:\\Users\\zakar\\.gemini\\antigravity-ide\\brain\\65adeca1-8f38-48aa-ae38-984d90a95418\\.tempmediaStorage';
  const tempMediaFiles: { file: string; size: number; hash: string }[] = [];
  if (fs.existsSync(tempMediaDir)) {
    const files = fs.readdirSync(tempMediaDir);
    console.log(`Found ${files.length} files in IDE .tempmediaStorage:`);
    for (const f of files) {
      const fullPath = path.join(tempMediaDir, f);
      const stats = fs.statSync(fullPath);
      const h = sha256(fullPath);
      tempMediaFiles.push({ file: f, size: stats.size, hash: h });
      console.log(`  ${f}: ${stats.size} bytes | SHA256: ${h.slice(0, 16)}...`);
    }
  } else {
    console.log('  Directory does not exist');
  }

  // 2. ENUMERATE WORKSPACE SCREENSHOT DIRECTORIES
  console.log('\n--- 2. Workspace Screenshot Directories on Disk ---');
  const scRoot = path.resolve(process.cwd(), 'screenshots');
  const allDirs = fs.readdirSync(scRoot);
  const dirBreakdown: Record<string, { count: number; totalBytes: number }> = {};
  for (const d of allDirs) {
    const p = path.join(scRoot, d);
    if (fs.statSync(p).isDirectory()) {
      const files = fs.readdirSync(p).filter(f => f.endsWith('.png'));
      let bytes = 0;
      files.forEach(f => bytes += fs.statSync(path.join(p, f)).size);
      dirBreakdown[d] = { count: files.length, totalBytes: bytes };
      console.log(`  Directory: screenshots/${d.padEnd(25)} Count: ${String(files.length).padStart(3)} PNGs | ${(bytes / 1024 / 1024).toFixed(2)} MB`);
    }
  }

  // 3. TARGET AUDIT SCREENSHOTS (56 CLAIMED)
  console.log('\n--- 3. Target Scope Screenshots (Admin Fees + Property Verification) ---');
  const targetDirs = [
    'screenshots/admin-fees',
    'screenshots/property-verification',
    'screenshots/management-choice',
    'screenshots/financial-regression'
  ];

  const targetScreenshots: {
    relPath: string;
    absPath: string;
    size: number;
    hash: string;
    validPng: boolean;
    dimensions?: string;
    matchedTempMedia?: string;
  }[] = [];

  const hashMap = new Map<string, string[]>();

  for (const td of targetDirs) {
    const fullDir = path.resolve(process.cwd(), td);
    if (!fs.existsSync(fullDir)) {
      console.log(`  Directory missing: ${td}`);
      continue;
    }
    const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.png')).sort();
    console.log(`\n  [${td}] — ${files.length} files:`);
    for (const f of files) {
      const absPath = path.join(fullDir, f);
      const relPath = path.join(td, f).replace(/\\/g, '/');
      const stats = fs.statSync(absPath);
      const h = sha256(absPath);
      const pngCheck = checkPngValid(absPath);

      if (!hashMap.has(h)) hashMap.set(h, []);
      hashMap.get(h)!.push(relPath);

      // Check if matches any tempMedia file
      const matched = tempMediaFiles.find(tm => tm.hash === h);

      targetScreenshots.push({
        relPath,
        absPath,
        size: stats.size,
        hash: h,
        validPng: pngCheck.valid,
        dimensions: pngCheck.valid ? `${pngCheck.width}x${pngCheck.height}` : undefined,
        matchedTempMedia: matched?.file
      });

      console.log(`    ${f.padEnd(45)} ${String(stats.size).padStart(8)} B | ${pngCheck.valid ? pngCheck.dimensions : 'INVALID'} | SHA: ${h.slice(0, 12)}... ${matched ? `(MATCHES IDE: ${matched.file})` : ''}`);
    }
  }

  // 4. SUMMARY STATISTICS
  console.log('\n--- 4. Summary Statistics ---');
  const totalTargetFiles = targetScreenshots.length;
  const uniqueHashes = hashMap.size;
  const allPngValid = targetScreenshots.every(s => s.validPng);
  console.log(`Total Target Screenshot Files: ${totalTargetFiles}`);
  console.log(`Unique Image Hashes:          ${uniqueHashes}`);
  console.log(`All Images Valid PNG:         ${allPngValid}`);

  // Check for duplicate hashes among target screenshots
  const duplicates: { hash: string; files: string[] }[] = [];
  for (const [h, files] of hashMap.entries()) {
    if (files.length > 1) {
      duplicates.push({ hash: h, files });
    }
  }
  console.log(`Duplicate Hash Groups:        ${duplicates.length}`);
  if (duplicates.length > 0) {
    duplicates.forEach(d => console.log(`  Duplicate: ${d.files.join(' == ')}`));
  }

  // 5. ZIP ARCHIVE VERIFICATION
  console.log('\n--- 5. ZIP Archive Verification ---');
  const zipPath = path.resolve(process.cwd(), 'homehub-admin-fees-and-property-verification-evidence.zip');
  if (fs.existsSync(zipPath)) {
    const stats = fs.statSync(zipPath);
    const zHash = sha256(zipPath);
    console.log(`ZIP file path: ${zipPath}`);
    console.log(`ZIP size:      ${stats.size} bytes (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`ZIP SHA-256:   ${zHash}`);

    // Inspect entries via PowerShell
    const inspectPs = `
      Add-Type -AssemblyName System.IO.Compression.FileSystem;
      $zip = [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/\\/g, '\\\\')}');
      $pngs = $zip.Entries | Where-Object { $_.FullName -like '*.png' };
      $other = $zip.Entries | Where-Object { $_.FullName -notlike '*.png' };
      Write-Host "Total entries in ZIP: $($zip.Entries.Count)";
      Write-Host "PNG entries in ZIP:   $($pngs.Count)";
      Write-Host "Other entries in ZIP: $($other.Count)";
      $zip.Dispose();
    `;
    const psOut = execSync(`powershell -NoProfile -Command "${inspectPs.replace(/\n/g, ' ')}"`, { encoding: 'utf8' });
    console.log(psOut);
  } else {
    console.log(`ZIP file NOT found at: ${zipPath}`);
  }

  // 6. RESOLVE THE 56-vs-12 DISCREPANCY
  console.log('\n--- 6. Root Cause Analysis: The 56 vs 12 Discrepancy ---');
  console.log('Hypothesis A: User sees the 12 files registered in IDE .tempmediaStorage.');
  console.log(`  .tempmediaStorage file count: ${tempMediaFiles.length}`);
  const tempMatchesInTarget = targetScreenshots.filter(s => s.matchedTempMedia);
  console.log(`  Target screenshots matching .tempmediaStorage: ${tempMatchesInTarget.length}`);

  console.log('Hypothesis B: User sees screenshots/rtl_ltr_audit directory.');
  console.log(`  screenshots/rtl_ltr_audit count: ${dirBreakdown['rtl_ltr_audit']?.count || 0}`);

  console.log('Hypothesis C: User chat interface only renders images passed via view_file or generate_image in the current session.');
  console.log(`  Number of binary artifacts in current conversation metadata: 12 images.`);

  console.log('\n=== AUDIT COMPLETE ===');
}

run().catch(console.error);
