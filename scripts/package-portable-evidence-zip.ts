import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const EVIDENCE_BASE = path.resolve(ROOT_DIR, 'artifacts/evidence-gaps-closure-20261022');
const STAGING_DIR = path.resolve(EVIDENCE_BASE, 'staging');
const ZIP_PATH = path.resolve(ROOT_DIR, 'artifacts/homehub-audit-evidence-portable-20261022.zip');
const EXTRACT_TEST_DIR = path.resolve(ROOT_DIR, 'scratch/zip-extract-test');

function getSha256(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function copyFile(src: string, dest: string) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

async function main() {
  console.log('========================================================================');
  console.log('📦 HOMEHUB — ISSUE D: PORTABLE POSIX ZIP ARCHIVE PACKAGING & AUDIT');
  console.log('========================================================================');

  // 1. Prepare clean staging directory
  if (fs.existsSync(STAGING_DIR)) {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(STAGING_DIR, { recursive: true });

  console.log('\n[Step 1: Staging Audit Evidence Artifacts]');

  // Copy localization screenshots
  const screenshotsSrcDir = path.resolve(EVIDENCE_BASE, 'screenshots/localization');
  const screenshotFiles = fs.readdirSync(screenshotsSrcDir).filter(f => f.endsWith('.png'));
  console.log(`  - Copying ${screenshotFiles.length} localization screenshots...`);
  for (const f of screenshotFiles) {
    copyFile(path.join(screenshotsSrcDir, f), path.join(STAGING_DIR, 'screenshots/localization', f));
  }

  // Copy database verification results
  const dbResultSrc = path.resolve(EVIDENCE_BASE, 'database/DB_VERIFICATION_RESULTS.txt');
  if (fs.existsSync(dbResultSrc)) {
    copyFile(dbResultSrc, path.join(STAGING_DIR, 'database/DB_VERIFICATION_RESULTS.txt'));
    console.log('  - Copied database verification results');
  }

  // Copy JSON reports
  const locReportSrc = path.resolve(EVIDENCE_BASE, 'reports/LOCALIZATION_MATRIX_REPORT.json');
  if (fs.existsSync(locReportSrc)) {
    copyFile(locReportSrc, path.join(STAGING_DIR, 'reports/LOCALIZATION_MATRIX_REPORT.json'));
    console.log('  - Copied localization matrix report');
  }

  const dbReportSrc = path.resolve(EVIDENCE_BASE, 'reports/DATABASE_VERIFICATION_REPORT.json');
  if (fs.existsSync(dbReportSrc)) {
    copyFile(dbReportSrc, path.join(STAGING_DIR, 'reports/DATABASE_VERIFICATION_REPORT.json'));
    console.log('  - Copied database verification report');
  }

  // Copy audit verification scripts for reproducibility
  copyFile(path.resolve(ROOT_DIR, 'scripts/verify-issue-b-localization.ts'), path.join(STAGING_DIR, 'scripts/verify-issue-b-localization.ts'));
  copyFile(path.resolve(ROOT_DIR, 'scripts/verify-issue-c-database.ts'), path.join(STAGING_DIR, 'scripts/verify-issue-c-database.ts'));
  console.log('  - Copied verification scripts (issue b & issue c)');

  // 2. Generate FILE_MANIFEST.json and FILE_MANIFEST.sha256
  console.log('\n[Step 2: Generating Normalized Manifests]');
  const stagedFiles: { path: string; size: number; sha256: string }[] = [];

  function collectFiles(dir: string, baseDir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) {
        collectFiles(fullPath, baseDir);
      } else {
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        const size = fs.statSync(fullPath).size;
        const hash = getSha256(fullPath);
        stagedFiles.push({ path: relativePath, size, sha256: hash });
      }
    }
  }

  collectFiles(STAGING_DIR, STAGING_DIR);
  stagedFiles.sort((a, b) => a.path.localeCompare(b.path));

  const manifestPath = path.join(STAGING_DIR, 'FILE_MANIFEST.json');
  fs.writeFileSync(manifestPath, JSON.stringify(stagedFiles, null, 2));

  let sha256Text = '';
  for (const item of stagedFiles) {
    sha256Text += `${item.sha256}  ${item.path}\n`;
  }
  const sha256Path = path.join(STAGING_DIR, 'FILE_MANIFEST.sha256');
  fs.writeFileSync(sha256Path, sha256Text);

  // Also copy manifests to artifacts/evidence-gaps-closure-20261022/manifests
  const manifestsDir = path.resolve(EVIDENCE_BASE, 'manifests');
  fs.mkdirSync(manifestsDir, { recursive: true });
  fs.copyFileSync(manifestPath, path.join(manifestsDir, 'FILE_MANIFEST.json'));
  fs.copyFileSync(sha256Path, path.join(manifestsDir, 'FILE_MANIFEST.sha256'));

  console.log(`  - Manifest generated with ${stagedFiles.length + 2} total files.`);

  // 3. Create POSIX-Compliant ZIP Archive using .NET ZipArchive (guaranteed forward slashes)
  console.log('\n[Step 3: Creating Portable POSIX Zip Archive]');
  if (fs.existsSync(ZIP_PATH)) {
    fs.unlinkSync(ZIP_PATH);
  }

  const psScriptFile = path.resolve(ROOT_DIR, 'scratch/create-portable-zip.ps1');
  const psScriptContent = `
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$staging = '${STAGING_DIR.replace(/'/g, "''")}'
$zipTarget = '${ZIP_PATH.replace(/'/g, "''")}'

$zip = [System.IO.Compression.ZipFile]::Open($zipTarget, [System.IO.Compression.ZipArchiveMode]::Create)

Get-ChildItem -Path $staging -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($staging.Length).TrimStart('\\', '/')
    $posix = $rel.Replace('\\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $posix, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
}
$zip.Dispose()
Write-Host "ZIP created successfully."
`;
  fs.writeFileSync(psScriptFile, psScriptContent);
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptFile}"`, { stdio: 'inherit' });

  const zipStats = fs.statSync(ZIP_PATH);
  const zipSha256 = getSha256(ZIP_PATH);
  console.log(`  - Portable Archive Created: ${ZIP_PATH}`);
  console.log(`  - File Size: ${zipStats.size} bytes (${(zipStats.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  - Archive SHA-256: ${zipSha256}`);

  // 4. Verify Archive Portability: Zero Backslashes, Clean Extraction, Byte Matching
  console.log('\n[Step 4: Independent Portability & Integrity Verification]');
  
  // A. Inspect internal entry names directly from zip directory header
  const inspectPsFile = path.resolve(ROOT_DIR, 'scratch/inspect-portable-zip.ps1');
  const inspectPsContent = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('${ZIP_PATH.replace(/'/g, "''")}')
$entries = $zip.Entries
$backslashCount = ($entries | Where-Object { $_.FullName -like '*\\\\*' }).Count
$slashCount = ($entries | Where-Object { $_.FullName -like '*/*' }).Count
Write-Host ("TOTAL_ENTRIES=" + $entries.Count)
Write-Host ("BACKSLASH_ENTRIES=" + $backslashCount)
Write-Host ("POSIX_SLASH_ENTRIES=" + $slashCount)
$zip.Dispose()
`;
  fs.writeFileSync(inspectPsFile, inspectPsContent);
  const inspectOutput = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${inspectPsFile}"`).toString().trim();
  console.log(inspectOutput);

  const totalEntriesMatch = inspectOutput.match(/TOTAL_ENTRIES=(\d+)/);
  const backslashMatch = inspectOutput.match(/BACKSLASH_ENTRIES=(\d+)/);
  const totalEntries = totalEntriesMatch ? parseInt(totalEntriesMatch[1], 10) : 0;
  const backslashEntries = backslashMatch ? parseInt(backslashMatch[1], 10) : -1;

  if (backslashEntries !== 0) {
    throw new Error(`PORTABILITY FAILED: Archive contains ${backslashEntries} entries with Windows backslashes!`);
  }
  console.log(`  ✅ Asserted: Exactly 0 backslashes among ${totalEntries} zip entries.`);

  // B. Extract to clean directory and verify byte integrity
  if (fs.existsSync(EXTRACT_TEST_DIR)) {
    fs.rmSync(EXTRACT_TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(EXTRACT_TEST_DIR, { recursive: true });

  const extractPsFile = path.resolve(ROOT_DIR, 'scratch/extract-portable-zip.ps1');
  const extractPsContent = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory('${ZIP_PATH.replace(/'/g, "''")}', '${EXTRACT_TEST_DIR.replace(/'/g, "''")}')
Write-Host 'Extraction completed.'
`;
  fs.writeFileSync(extractPsFile, extractPsContent);
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${extractPsFile}"`, { stdio: 'inherit' });

  console.log('  - Verifying extracted file checksums against staging source...');
  let matchCount = 0;
  for (const item of stagedFiles) {
    const extractedFile = path.join(EXTRACT_TEST_DIR, item.path);
    if (!fs.existsSync(extractedFile)) {
      throw new Error(`MISSING EXTRACTED FILE: ${item.path}`);
    }
    const extractedHash = getSha256(extractedFile);
    if (extractedHash !== item.sha256) {
      throw new Error(`HASH MISMATCH on ${item.path}: expected ${item.sha256}, got ${extractedHash}`);
    }
    matchCount++;
  }

  console.log(`  ✅ Verified: 100% of ${matchCount} extracted files match original SHA-256 checksums.`);

  // Save portability verification report
  const portabilityReport = {
    archiveName: path.basename(ZIP_PATH),
    archivePath: ZIP_PATH,
    archiveSize: zipStats.size,
    archiveSha256: zipSha256,
    totalEntries,
    backslashEntries,
    posixCompliant: backslashEntries === 0,
    verifiedFilesMatchCount: matchCount,
    verificationStatus: 'PASSED',
    extractedFolderClean: true,
  };

  const portabilityReportPath = path.resolve(EVIDENCE_BASE, 'reports/PORTABILITY_VERIFICATION_REPORT.json');
  fs.writeFileSync(portabilityReportPath, JSON.stringify(portabilityReport, null, 2));
  console.log(`  - Portability report saved: ${portabilityReportPath}`);

  // Cleanup extract test dir
  fs.rmSync(EXTRACT_TEST_DIR, { recursive: true, force: true });

  console.log('\n========================================================================');
  console.log('🎉 ISSUE D PORTABLE POSIX EVIDENCE ARCHIVE 100% VERIFIED');
  console.log('========================================================================');
  process.exit(0);
}

main().catch(err => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
