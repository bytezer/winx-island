param(
  [int]$StartX = 1280,
  [int]$StartY = 40,
  [int]$EndX = 900,
  [int]$EndY = 140
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DragSim {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
}
"@
[void][DragSim]::SetProcessDPIAware()

[void][DragSim]::SetCursorPos($StartX, $StartY)
Start-Sleep -Milliseconds 400
[DragSim]::mouse_event(0x0008, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 120

$steps = 12
for ($i = 1; $i -le $steps; $i++) {
  $x = [int]($StartX + ($EndX - $StartX) * $i / $steps)
  $y = [int]($StartY + ($EndY - $StartY) * $i / $steps)
  [void][DragSim]::SetCursorPos($x, $y)
  Start-Sleep -Milliseconds 60
}

[DragSim]::mouse_event(0x0010, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 400
Write-Output "drag simulated"
