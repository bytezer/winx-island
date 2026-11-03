param([int]$X = 0, [int]$Y = 0)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class InputSim {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
}
"@
[void][InputSim]::SetProcessDPIAware()
[void][InputSim]::SetCursorPos($X, $Y)
Write-Output "$X,$Y"
