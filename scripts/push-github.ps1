# 自动检测 Windows 系统代理并推送 Sidor_UI 到远端。
#
# 背景：git 默认不走系统代理，而代理端口会变（7890/7892/…），硬编码必然失效。
# 本脚本读 Internet 设置里的当前代理，仅对本次 push 生效（git -c，不改全局配置），
# 未启用代理时直连；推送后用 GitHub API 校验远端 head 与本地一致。
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File .\scripts\push-github.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\push-github.ps1 -Branch main -NoVerify
param(
  [string]$Remote = 'origin',
  [string]$Branch = 'main',
  [switch]$NoVerify
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

# 读取系统代理：ProxyEnable=1 时取 ProxyServer；支持 "host:port" 与
# "http=h:p;https=h:p" 两种登记形式，https 优先。
function Get-SystemProxy {
  $reg = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
  if (-not $reg -or $reg.ProxyEnable -ne 1) { return $null }
  $raw = [string]$reg.ProxyServer
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  $value = $null
  if ($raw -match '=') {
    $map = @{}
    foreach ($seg in ($raw -split ';')) {
      if ($seg -match '^\s*([^=]+)=(.+)$') { $map[$matches[1].Trim().ToLower()] = $matches[2].Trim() }
    }
    if ($map['https']) { $value = $map['https'] } elseif ($map['http']) { $value = $map['http'] }
  } else {
    $value = $raw.Trim()
  }
  if ([string]::IsNullOrWhiteSpace($value)) { return $null }
  if ($value -notmatch '^[a-z]+://') { $value = "http://$value" }
  return $value
}

$proxy = Get-SystemProxy
if ($proxy) { Write-Host "  proxy  : $proxy (system)" } else { Write-Host '  proxy  : (none, direct)' }

$gitArgs = @('-C', $repo)
if ($proxy) { $gitArgs += @('-c', "http.proxy=$proxy", '-c', "https.proxy=$proxy") }
$gitArgs += @('push', $Remote, $Branch)

Write-Host "  push   : git push $Remote $Branch"
& git @gitArgs
if ($LASTEXITCODE -ne 0) { throw "push failed (exit $LASTEXITCODE)" }

if ($NoVerify) { exit 0 }

# 远端校验：GitHub API 走系统代理（.NET 默认读取 Internet 设置）。
$local = (& git -C $repo rev-parse HEAD).Trim()
$url = (& git -C $repo remote get-url $Remote).Trim() -replace '^git\+', '' -replace '\.git$', ''
if ($url -match 'github\.com[:/](?<owner>[^/]+)/(?<name>[^/]+)$') {
  $api = "https://api.github.com/repos/$($matches['owner'])/$($matches['name'])/branches/$Branch"
  try {
    $remote = (Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent' = 'sidor-push' } -TimeoutSec 20).commit.sha
    if ($remote -eq $local) {
      Write-Host "  verify : OK  remote head = $remote"
    } else {
      Write-Host "  verify : MISMATCH  remote=$remote local=$local"
      exit 1
    }
  } catch {
    Write-Host "  verify : skipped ($($_.Exception.Message))"
  }
}
Write-Host '  推送完成。'
