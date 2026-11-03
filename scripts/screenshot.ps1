param(
  [string]$Path = "$env:TEMP\winx-island-shot.png",
  [int]$Width = 0,
  [int]$Height = 0,
  [int]$X = 0,
  [int]$Y = 0
)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DpiAware {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[void][DpiAware]::SetProcessDPIAware()

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
if ($Width -le 0) { $Width = $bounds.Width }
if ($Height -le 0) { $Height = $bounds.Height }

$bitmap = New-Object System.Drawing.Bitmap $Width, $Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($X, $Y, 0, 0, (New-Object System.Drawing.Size $Width, $Height))
$bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

Write-Output $Path
