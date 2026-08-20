# Sidor_UI 安装/卸载脚本（无 pnpm 环境的手工安装通道）
# 安装：把本包复制进 DSH profile 的 node_modules，并把插件行写入该 profile 的 cordis.patch.yml，
#       使 Sidor_UI 随 DSH 启动自动加载（持久化插件，重启无需手动）。
# 用法：
#   powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -ProfileName web -Remove
param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot),
  [string]$DshHome = $env:DSH_HOME,
  [string]$ProfileName = 'web',
  [switch]$Remove
)

if (-not $DshHome) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
$profileDir = Join-Path $DshHome "profiles\$ProfileName"
$pkgName = 'sidor-ui'
$target = Join-Path $profileDir "node_modules\$pkgName"
$patchFile = Join-Path $profileDir 'cordis.patch.yml'

$mode = 'install'; if ($Remove) { $mode = 'uninstall' }
Write-Host "== Sidor_UI $mode =="
Write-Host "  profile : $profileDir"
Write-Host "  package : $target"

if (-not (Test-Path $profileDir)) { throw "profile not found: $profileDir" }

if ($Remove) {
  if (Test-Path $target) { Remove-Item $target -Recurse -Force; Write-Host "  removed package: $target" }
  if (Test-Path $patchFile) {
    $c = Get-Content $patchFile -Raw
    if ($c -match '(?m)^\s*-\s*insert:.*?name:\s*sidor-ui.*?$') {
      # 简单移除：把整个 insert 块替换为空（仅当该块只含 sidor-ui 时；复杂 patch 请手工编辑）
      $c = $c -replace '(?ms)^\s*-\s*insert:\s*\n\s*-\s*id:\s*sidor-ui\s*\n\s*name:\s*sidor-ui\s*\n?', ''
      Set-Content $patchFile $c -Encoding UTF8
      Write-Host '  removed patch entry (cordis.patch.yml)'
    }
  }
  Write-Host '  完成。重启 dsh 生效。'
  exit 0
}

# 1) 复制包进 profile node_modules（只装运行时需要的文件）
New-Item -ItemType Directory -Force -Path (Join-Path $profileDir 'node_modules') | Out-Null
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
New-Item -ItemType Directory -Force -Path $target | Out-Null
foreach ($rel in @('package.json', 'lib', 'cordis.patch.yml', 'skin.json')) {
  $src = Join-Path $Root $rel
  if (Test-Path $src) { Copy-Item $src $target -Recurse -Force }
}
Write-Host "  copied package -> $target"

# 2) patch：把插件行并入 profile 的 cordis.patch.yml
if (-not (Test-Path $patchFile)) { Set-Content $patchFile '[]' -Encoding UTF8 }
$c = Get-Content $patchFile -Raw
$trimmed = $c.Trim()
if ($c -match 'sidor-ui') {
  Write-Host '  patch already contains sidor-ui; skipped.'
} elseif ($trimmed -eq '[]' -or $trimmed.EndsWith('[]')) {
  $new = @'
# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; `!!js` expressions allowed).

# Sidor_UI 持久化插件（由 scripts/install.ps1 写入；卸载请重跑 -Remove）
- insert:
    - id: sidor-ui
      name: sidor-ui
'@
  Set-Content $patchFile $new -Encoding UTF8
  Write-Host '  wrote patch entry -> cordis.patch.yml'
} else {
  Write-Warning '  cordis.patch.yml 已有其他内容且不含 sidor-ui：请手动合并 patch\sidor-ui.patch.yml 片段。'
}

Write-Host ''
Write-Host '  安装完成。重启 DSH（或热重载 profile）后 Sidor_UI 将随宿主自动加载。'
Write-Host '  若浏览器未出现开屏动画，请硬刷新（Ctrl+Shift+R）。'
