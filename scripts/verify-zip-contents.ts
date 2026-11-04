import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const zipPath = path.resolve(process.cwd(), 'homehub-multi-role-enrollment-evidence.zip');

const script = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/\\/g, '\\\\')}')
$z.Entries | ForEach-Object { [PSCustomObject]@{ FullName = $_.FullName; Length = $_.Length } } | Format-Table -AutoSize
$z.Dispose()
`;

const res = execSync(`powershell -NoProfile -Command "${script.replace(/\n/g, ' ')}"`);
console.log(res.toString());
