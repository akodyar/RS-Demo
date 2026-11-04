const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const archiveDir = path.join(rootDir, 'archive');

if (!fs.existsSync(archiveDir)) {
  fs.mkdirSync(archiveDir, { recursive: true });
}

// 1. Move root .zip files
const files = fs.readdirSync(rootDir);
let movedZips = 0;
for (const file of files) {
  if (file.endsWith('.zip') && file !== 'archive') {
    const srcPath = path.join(rootDir, file);
    const destPath = path.join(archiveDir, file);
    fs.renameSync(srcPath, destPath);
    movedZips++;
  }
}
console.log(`Moved ${movedZips} zip files to archive/`);

// 2. Move duplicate extracted snapshot folders and legacy app remnants
const duplicateDirs = [
  'homehub-db-safety-phase-64-4',
  'homehub-db-safety-phase-64-5',
  'homehub-db-safety-phase-64-6',
  'homehub-db-safety-phase-64-7',
  'homehub-db-safety-audit-package',
  'homehub-lease-renewal-evidence',
  'homehub-lease-renewal-corrected-evidence',
  'flutter_homehub',
];

let movedDirs = 0;
for (const dirName of duplicateDirs) {
  const srcPath = path.join(rootDir, dirName);
  if (fs.existsSync(srcPath)) {
    try {
      const destPath = path.join(archiveDir, dirName);
      fs.renameSync(srcPath, destPath);
      movedDirs++;
    } catch (e) {
      console.warn(`Could not move ${dirName}:`, e.message);
    }
  }
}
console.log(`Moved ${movedDirs} legacy / duplicate directories to archive/`);

// 3. Move ad-hoc root fix scripts (fix-*.cjs, modify-*.cjs, etc.)
const adHocPrefixes = ['fix-', 'fix_', 'modify-', 'modify_', 'inject_', 'extract_', 'remove_', 'replace_', 'add_'];
let movedScripts = 0;
for (const file of files) {
  if (adHocPrefixes.some(p => file.startsWith(p)) && (file.endsWith('.cjs') || file.endsWith('.py') || file.endsWith('.txt'))) {
    const srcPath = path.join(rootDir, file);
    const destPath = path.join(archiveDir, file);
    if (fs.existsSync(srcPath)) {
      fs.renameSync(srcPath, destPath);
      movedScripts++;
    }
  }
}
console.log(`Moved ${movedScripts} ad-hoc patch scripts to archive/`);

// 4. Move untracked root markdown reports (keep AGENTS.md, README.md, and core docs)
const keepFiles = new Set(['AGENTS.md', 'README.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'playwright.config.ts', 'server.ts']);
let movedReports = 0;
for (const file of files) {
  if (file.endsWith('.md') && !keepFiles.has(file)) {
    const srcPath = path.join(rootDir, file);
    const destPath = path.join(archiveDir, file);
    if (fs.existsSync(srcPath)) {
      fs.renameSync(srcPath, destPath);
      movedReports++;
    }
  }
}
console.log(`Moved ${movedReports} root markdown audit reports to archive/`);

// 5. Ensure archive/ is in .gitignore
const gitignorePath = path.join(rootDir, '.gitignore');
let gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
if (!gitignoreContent.includes('archive/')) {
  gitignoreContent += '\n# Archived Legacy Audit Artifacts and Duplicates\narchive/\n*.zip\n';
  fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
  console.log('Updated .gitignore to ignore archive/ and *.zip');
}
console.log('Repository uncluttering complete!');

