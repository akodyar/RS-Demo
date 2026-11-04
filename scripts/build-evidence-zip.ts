import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

function getSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  const rootDir = process.cwd();
  const sourceAuditDir = path.resolve(rootDir, 'artifacts/multi-role-enrollment-final-audit');
  const targetStagingDir = path.resolve(rootDir, 'artifacts/homehub-multi-role-enrollment-evidence');

  console.log('1. Synchronizing files to staging directory:', targetStagingDir);
  if (fs.existsSync(targetStagingDir)) {
    fs.rmSync(targetStagingDir, { recursive: true, force: true });
  }
  copyDirRecursive(sourceAuditDir, targetStagingDir);

  const zipTargets = [
    path.resolve(rootDir, 'homehub-multi-role-enrollment-evidence.zip'),
    path.resolve(rootDir, 'artifacts/homehub-multi-role-enrollment-evidence.zip'),
    path.resolve(rootDir, 'artifacts/multi-role-enrollment-final-audit.zip'),
  ];

  for (const targetZip of zipTargets) {
    if (fs.existsSync(targetZip)) {
      fs.unlinkSync(targetZip);
    }
  }

  const primaryZip = zipTargets[0];
  console.log('2. Creating primary zip archive at:', primaryZip);

  // Use PowerShell Compress-Archive for standard ZIP creation
  const psCmd = `powershell -Command "Compress-Archive -Path '${targetStagingDir}\\*' -DestinationPath '${primaryZip}' -Force"`;
  execSync(psCmd, { stdio: 'inherit' });

  // Copy to artifacts targets
  fs.copyFileSync(primaryZip, zipTargets[1]);
  fs.copyFileSync(primaryZip, zipTargets[2]);

  console.log('3. Verifying zip archives and computing checksums:');
  for (const targetZip of zipTargets) {
    const stats = fs.statSync(targetZip);
    const hash = getSha256(targetZip);
    console.log(`\nArchive: ${targetZip}`);
    console.log(`Size: ${stats.size} bytes (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`SHA-256: ${hash}`);

    // Verify zip integrity by reading entries
    const verifyCmd = `powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('${targetZip}'); Write-Host ('Entries in zip: ' + $zip.Entries.Count); $zip.Dispose();"`;
    const verifyOutput = execSync(verifyCmd).toString().trim();
    console.log(`Verification: ${verifyOutput}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
