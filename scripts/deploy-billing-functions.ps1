# Deploy billing Edge Functions (CodeCraft Gestao / mesmo projeto Supabase)
# Rode no PowerShell:
#   $env:SUPABASE_ACCESS_TOKEN = 'sbp_TOKEN_DONO'
#   .\scripts\deploy-billing-functions.ps1

$ErrorActionPreference = "Stop"
$ref = "eqaoanbanhryhbldlbhc"
$root = Split-Path -Parent $PSScriptRoot

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "Crie um token de DONO em https://supabase.com/dashboard/account/tokens"
  Write-Host "Depois: `$env:SUPABASE_ACCESS_TOKEN = 'sbp_...'"
  exit 1
}

Set-Location $root
foreach ($fn in @("billing-webhook", "billing-subscribe", "billing-cancel")) {
  Write-Host "Deploy $fn ..."
  npx --yes supabase functions deploy $fn --project-ref $ref --no-verify-jwt
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Write-Host "OK — 3 functions atualizadas."
