param([int]$X = 0, [int]$Y = 0)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Probe {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll")] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
}
"@
[void][Probe]::SetProcessDPIAware()

$point = New-Object Probe+POINT
$point.X = $X
$point.Y = $Y
$handle = [Probe]::WindowFromPoint($point)
$owner = 0
[void][Probe]::GetWindowThreadProcessId($handle, [ref]$owner)
$process = (Get-Process -Id $owner -ErrorAction SilentlyContinue).ProcessName
$class = New-Object System.Text.StringBuilder 256
[void][Probe]::GetClassNameW($handle, $class, 256)

Write-Output "point=$X,$Y proc=$process class=$($class.ToString())"
