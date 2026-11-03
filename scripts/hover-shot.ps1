param(
  [int]$CursorX = 0,
  [int]$CursorY = 0,
  [int]$X = 0,
  [int]$Y = 0,
  [int]$Width = 400,
  [int]$Height = 300,
  [int]$Wait = 600,
  [string]$Path = "$env:TEMP\winx-island-shot.png"
)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ShotHelper {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
}
"@
[void][ShotHelper]::SetProcessDPIAware()

if ($CursorX -ne -1) {
  [void][ShotHelper]::SetCursorPos($CursorX, $CursorY)
  Start-Sleep -Milliseconds $Wait
}

$bitmap = New-Object System.Drawing.Bitmap $Width, $Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($X, $Y, 0, 0, (New-Object System.Drawing.Size $Width, $Height))
$bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

Write-Output $Path
