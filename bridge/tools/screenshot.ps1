[CmdletBinding()]
param(
    [string]$OutputPath
)

try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

    if (-not $OutputPath) {
        $mediaDir = Join-Path (Split-Path -Parent $PSScriptRoot) "media"
        if (-not (Test-Path $mediaDir)) {
            New-Item -ItemType Directory -Path $mediaDir -Force | Out-Null
        }
        $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        $OutputPath = Join-Path $mediaDir "screenshot_$timestamp.png"
    }

    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()

    Write-Output $OutputPath
    exit 0
} catch {
    Write-Error "Screenshot capture failed: $_"
    exit 1
}
