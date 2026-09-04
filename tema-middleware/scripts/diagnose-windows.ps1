# =============================================================================
# TEMA Middleware - Windows connectivity diagnostic
# Run ON THE WINDOWS SERVER:  powershell -ExecutionPolicy Bypass -File .\diagnose-windows.ps1
# Diagnoses the ERR_CONNECTION_RESET on the login POST.
# =============================================================================

$appPort   = 9081      # <-- the port from your .env (TEMA_PORT)
$publicPort = 8088     # <-- the port your clients call
$body      = '{"username":"7051","password":"1234"}'

function Test-Login($port) {
  $url = "http://localhost:$port/api/auth/technician/login"
  Write-Host "`n--- POST $url ---" -ForegroundColor Cyan
  try {
    $r = Invoke-WebRequest -Uri $url -Method Post -ContentType 'application/json' `
         -Body $body -TimeoutSec 10 -UseBasicParsing
    Write-Host ("HTTP {0}" -f $r.StatusCode) -ForegroundColor Green
    Write-Host $r.Content
  } catch {
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
      Write-Host ("HTTP {0} (server replied - app is reachable)" -f $code) -ForegroundColor Yellow
      $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
      Write-Host $sr.ReadToEnd()
    } else {
      Write-Host ("NO HTTP REPLY -> {0}" -f $_.Exception.Message) -ForegroundColor Red
    }
  }
}

Write-Host "=== 1. What is listening ===" -ForegroundColor Magenta
Write-Host "Port $appPort:";    netstat -ano | Select-String ":$appPort\s"
Write-Host "Port $publicPort:"; netstat -ano | Select-String ":$publicPort\s"

Write-Host "`n=== 2. Health on each port ===" -ForegroundColor Magenta
foreach ($p in @($appPort, $publicPort)) {
  try {
    $h = Invoke-WebRequest "http://localhost:$p/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host ("Port {0} /health -> HTTP {1}" -f $p, $h.StatusCode) -ForegroundColor Green
  } catch {
    Write-Host ("Port {0} /health -> {1}" -f $p, $_.Exception.Message) -ForegroundColor Red
  }
}

Write-Host "`n=== 3. Login directly on the app port ($appPort) ===" -ForegroundColor Magenta
Test-Login $appPort

Write-Host "`n=== 4. Login on the public port ($publicPort) ===" -ForegroundColor Magenta
Test-Login $publicPort

Write-Host "`n=== VERDICT ===" -ForegroundColor Magenta
Write-Host "If step 3 = HTTP 200 but step 4 resets  -> the 8088 proxy/old-process/firewall is the problem."
Write-Host "If step 3 also resets                    -> the Node process crashed/stale; check 'pm2 logs'."
Write-Host "If nothing listens on $appPort           -> the app did not start on the .env port; check the service + logs."
