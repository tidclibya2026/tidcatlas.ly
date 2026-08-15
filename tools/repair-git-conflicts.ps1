$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$target = Join-Path $projectRoot "client\src\pages\Home.tsx"
if (-not (Test-Path $target)) {
  throw "لم يتم العثور على الملف: $target"
}

$backup = "$target.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $target $backup

$content = Get-Content -Raw -Encoding UTF8 $target
if ($content -notmatch '<<<<<<<|=======|>>>>>>>') {
  Write-Host "لا توجد علامات تعارض في Home.tsx. النسخة الاحتياطية: $backup" -ForegroundColor Green
  exit 0
}

# Restore the complete file, not only conflict marker lines. Prefer origin/main
# because a local HEAD may itself be the result of a bad conflict resolution.
$headContent = git show origin/main:client/src/pages/Home.tsx 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($headContent)) {
  $headContent = git show HEAD:client/src/pages/Home.tsx
}
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($headContent)) {
  throw "تعذر قراءة نسخة Home.tsx من origin/main أو HEAD. نفّذ git fetch origin أولًا."
}
Set-Content -Path $target -Value $headContent -Encoding UTF8

$remaining = Select-String -Path $target -Pattern '<<<<<<<|=======|>>>>>>>' -SimpleMatch
if ($remaining) {
  throw "ما زالت علامات تعارض موجودة في Home.tsx"
}

$allConflicts = git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' -- .
if ($LASTEXITCODE -eq 0 -and $allConflicts) {
  Write-Warning "توجد تعارضات في ملفات أخرى:`n$allConflicts"
  exit 2
}

Write-Host "تم إصلاح Home.tsx بنجاح." -ForegroundColor Green
Write-Host "تم حفظ نسخة احتياطية في: $backup"
Write-Host "شغّل الآن: pnpm check; pnpm test; pnpm dev"
