$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$port = 8088
if ($env:WAREHOUSE_WIZARD_PORT) {
  $parsedPort = 0
  if (-not [int]::TryParse($env:WAREHOUSE_WIZARD_PORT, [ref]$parsedPort) -or $parsedPort -lt 1 -or $parsedPort -gt 65535) {
    throw "WAREHOUSE_WIZARD_PORT must be a whole number from 1 to 65535."
  }
  $port = $parsedPort
}
$url = "http://localhost:$port/"

function Test-PortOpen {
  param([int]$Port)
  try {
    $client = [System.Net.Sockets.TcpClient]::new()
    $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $connected = $iar.AsyncWaitHandle.WaitOne(250, $false)
    if ($connected) {
      $client.EndConnect($iar)
    }
    $client.Close()
    return $connected
  } catch {
    return $false
  }
}

function Test-WarehouseWizardServer {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return (
      $response.StatusCode -eq 200 -and
      $response.Content -match 'apple-mobile-web-app-title" content="Warehouse Wizard"' -and
      $response.Content -match '/src/main\.tsx'
    )
  } catch {
    return $false
  }
}

function Write-ServerDiagnostics {
  param(
    [string]$StandardOutputLog,
    [string]$StandardErrorLog
  )

  foreach ($log in @($StandardOutputLog, $StandardErrorLog)) {
    if ($log -and (Test-Path $log) -and (Get-Item $log).Length -gt 0) {
      Write-Host ""
      Get-Content -LiteralPath $log | Write-Host
    }
  }
}

Write-Host "Warehouse Wizard local launcher" -ForegroundColor Cyan
Write-Host "Project: $root"
Write-Host ""

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $npm -or -not $node) {
  throw "Node.js/npm is required before first launch. Install Node.js LTS from https://nodejs.org/, then run this launcher again."
}

$dependenciesReady = Test-Path (Join-Path $root "node_modules")
if ($dependenciesReady) {
  & $npm.Source ls --depth=0 --silent *> $null
  $dependenciesReady = $LASTEXITCODE -eq 0
}

if (-not $dependenciesReady) {
  Write-Host "Installing or repairing dependencies..." -ForegroundColor Yellow
  & $npm.Source install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) {
    throw "Dependency installation failed. Review the npm error above, then run this launcher again."
  }
}

$dev = $null
$startedServer = $false

try {
  if (Test-PortOpen -Port $port) {
    if (-not (Test-WarehouseWizardServer -Url $url)) {
      throw "Port $port is already used by another application. Close that application or set WAREHOUSE_WIZARD_PORT to a free port."
    }
    Write-Host "Warehouse Wizard is already running at $url" -ForegroundColor Yellow
  } else {
    Write-Host "Starting local dev server on $url" -ForegroundColor Yellow
    $logDirectory = Join-Path $env:TEMP "WarehouseWizard"
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $standardOutputLog = Join-Path $logDirectory "vite-$port.log"
    $standardErrorLog = Join-Path $logDirectory "vite-$port.error.log"
    Remove-Item -LiteralPath $standardOutputLog, $standardErrorLog -Force -ErrorAction SilentlyContinue

    $viteEntryPoint = Join-Path $root "node_modules\vite\bin\vite.js"
    if (-not (Test-Path $viteEntryPoint)) {
      throw "Vite is missing after dependency installation. Run npm install and try again."
    }
    $devArgs = @("`"$viteEntryPoint`"", "--host", "127.0.0.1", "--port", "$port", "--strictPort")
    $dev = Start-Process -FilePath $node.Source -ArgumentList $devArgs -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput $standardOutputLog -RedirectStandardError $standardErrorLog
    $startedServer = $true

    for ($i = 0; $i -lt 60; $i++) {
      if ($dev.HasExited) {
        $dev.WaitForExit()
        $exitCode = $dev.ExitCode
        Write-ServerDiagnostics -StandardOutputLog $standardOutputLog -StandardErrorLog $standardErrorLog
        throw "The local dev server stopped with exit code $exitCode. Logs: $standardErrorLog"
      }
      if (Test-WarehouseWizardServer -Url $url) { break }
      Start-Sleep -Milliseconds 500
    }

    if (-not (Test-WarehouseWizardServer -Url $url)) {
      Write-ServerDiagnostics -StandardOutputLog $standardOutputLog -StandardErrorLog $standardErrorLog
      throw "Warehouse Wizard did not become ready within 30 seconds. Logs: $standardErrorLog"
    }
  }

  $opened = $false
  $browserPaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  )

  foreach ($browser in $browserPaths) {
    if ($browser -and (Test-Path $browser)) {
      Start-Process -FilePath $browser -ArgumentList $url
      $opened = $true
      break
    }
  }

  if (-not $opened) {
    Start-Process $url
  }

  Write-Host ""
  Write-Host "Warehouse Wizard is running locally at $url" -ForegroundColor Green
  if ($startedServer) {
    Read-Host "Press Enter to stop the local server and close this launcher"
  } else {
    Read-Host "Press Enter to close this launcher (the existing server will remain running)"
  }
} finally {
  if ($startedServer -and $dev -and -not $dev.HasExited) {
    Write-Host "Stopping the local server..." -ForegroundColor Yellow
    Stop-Process -Id $dev.Id -Force -ErrorAction SilentlyContinue
    $dev.WaitForExit()
  }
}
