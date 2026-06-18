$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $root "Launch Warehouse Wizard.bat"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Warehouse Wizard Local.lnk"
$logoPng = Join-Path $root "public\logo.png"
$iconPath = Join-Path $root "public\warehouse-wizard.ico"

if (-not (Test-Path $target)) {
  throw "Launcher not found: $target"
}

if ((-not (Test-Path $iconPath)) -and (Test-Path $logoPng)) {
  Add-Type -AssemblyName System.Drawing
  $source = [System.Drawing.Image]::FromFile($logoPng)
  try {
    $bitmap = New-Object System.Drawing.Bitmap 256, 256
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.DrawImage($source, 0, 0, 256, 256)
      $handle = $bitmap.GetHicon()
      try {
        $icon = [System.Drawing.Icon]::FromHandle($handle)
        $stream = [System.IO.File]::Create($iconPath)
        try {
          $icon.Save($stream)
        } finally {
          $stream.Dispose()
          $icon.Dispose()
        }
      } finally {
        [void][System.Runtime.InteropServices.Marshal]::Release($handle)
      }
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = $root
$shortcut.WindowStyle = 1
$shortcut.Description = "Build and run Warehouse Wizard locally"
if (Test-Path $iconPath) {
  $shortcut.IconLocation = $iconPath
}
$shortcut.Save()

Write-Host "Created desktop shortcut: $shortcutPath" -ForegroundColor Green
