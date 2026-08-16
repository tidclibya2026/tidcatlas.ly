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

# Remove the invalid local Umami placeholder script that returns HTML/400.
$indexPath = Join-Path $projectRoot "client\index.html"
if (Test-Path $indexPath) {
  $indexBackup = "$indexPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item $indexPath $indexBackup
  $indexContent = Get-Content -Raw -Encoding UTF8 $indexPath
  $indexContent = [regex]::Replace($indexContent, '(?m)^\s*<script defer src="%VITE_ANALYTICS_ENDPOINT%/umami"[^>]*></script>\s*\r?\n?', '')
  Set-Content -Path $indexPath -Value $indexContent -Encoding UTF8
  Write-Host "تم تنظيف index.html من Umami غير الصالح." -ForegroundColor Green
}

# Ensure Home's management helper exists in the local const module.
$constPath = Join-Path $projectRoot "client\src\const.ts"
if (Test-Path $constPath) {
  $constContent = Get-Content -Raw -Encoding UTF8 $constPath
  if ($constContent -notmatch 'export const getManagementUrl') {
    $helper = @'

export const PUBLISHED_MANAGEMENT_URL = "https://libyatlas-kgramdv2.manus.space/management";
export const isGithubPagesHost = () => typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
export const getManagementUrl = () => isGithubPagesHost() ? PUBLISHED_MANAGEMENT_URL : `${window.location.origin}${import.meta.env.BASE_URL}management`;
'@
    Add-Content -Path $constPath -Value $helper -Encoding UTF8
    Write-Host "تمت إضافة getManagementUrl إلى const.ts." -ForegroundColor Green
  }
}

$viteCache = Join-Path $projectRoot "node_modules\.vite"
if (Test-Path $viteCache) { Remove-Item $viteCache -Recurse -Force }

Write-Host "تم إصلاح Home.tsx وتهيئة ملفات التشغيل المحلية بنجاح." -ForegroundColor Green
Write-Host "تم حفظ نسخة Home الاحتياطية في: $backup"
Write-Host "شغّل الآن: pnpm check; pnpm test; pnpm build; pnpm dev"
