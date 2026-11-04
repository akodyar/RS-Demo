Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("$PSScriptRoot\..\homehub-multi-role-enrollment-evidence.zip")
Write-Host "Total entries in ZIP: $($zip.Entries.Count)"
$zip.Entries | Select-Object FullName, Length | Format-Table -AutoSize
$zip.Dispose()
