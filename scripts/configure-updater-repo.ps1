param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')]
  [string]$Repository
)

$configPath = Resolve-Path (Join-Path $PSScriptRoot '..\src-tauri\tauri.conf.json')
$json = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$endpoint = "https://github.com/$Repository/releases/latest/download/latest.json"

if (-not $json.plugins) {
  $json | Add-Member -MemberType NoteProperty -Name plugins -Value ([pscustomobject]@{})
}

if (-not $json.plugins.updater) {
  $json.plugins | Add-Member -MemberType NoteProperty -Name updater -Value ([pscustomobject]@{})
}

$json.plugins.updater.endpoints = @($endpoint)
$json | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $configPath -Encoding UTF8

Write-Host "Updater endpoint set to $endpoint"
