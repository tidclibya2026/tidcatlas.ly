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

# This file is restored from the committed version because the conflict state
# can contain duplicated imports and incomplete JSX branches.
$headContent = git show HEAD:client/src/pages/Home.tsx
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($headContent)) {
  throw "تعذر قراءة النسخة المحفوظة من HEAD. لم يتم تعديل الملف الأصلي."
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
