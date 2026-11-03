param(
  [int]$PillX = 1280,
  [int]$PillY = 40,
  [string]$OutDir = "$env:TEMP"
)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class UiTest {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll")] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }

  public static void Hold(int x, int y, int milliseconds) {
    var thread = new System.Threading.Thread(() => {
      var end = Environment.TickCount + milliseconds;
      while (Environment.TickCount < end) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(25);
      }
    });
    thread.IsBackground = true;
    thread.Start();
  }
}
"@
[void][UiTest]::SetProcessDPIAware()

function Probe([int]$x, [int]$y) {
  $p = New-Object UiTest+POINT
  $p.X = $x; $p.Y = $y
  $h = [UiTest]::WindowFromPoint($p)
  $pid2 = 0
  [void][UiTest]::GetWindowThreadProcessId($h, [ref]$pid2)
  $proc = (Get-Process -Id $pid2 -ErrorAction SilentlyContinue).ProcessName
  return $proc
}

function Snap([string]$name, [int]$x, [int]$y, [int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($x, $y, 0, 0, (New-Object System.Drawing.Size $w, $h))
  $path = Join-Path $OutDir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "saved $path"
}

# Keep the physical cursor parked: the machine is in active use, so a still
# cursor cannot be assumed while the captures run.
[UiTest]::Hold($PillX, $PillY, 6000)
Start-Sleep -Milliseconds 900
Write-Output ("probe pill while hovering: " + (Probe $PillX $PillY))
Snap "wx-hover.png" 880 0 820 300

# Left click on the pill: expands to the full panel.
[void][UiTest]::SetCursorPos($PillX, $PillY)
Start-Sleep -Milliseconds 120
[UiTest]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 60
[UiTest]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 700
Snap "wx-panel.png" 880 0 820 620

# Park the cursor away from the island and check click-through.
[void][UiTest]::SetCursorPos(200, 900)
Start-Sleep -Milliseconds 500
Write-Output ("probe canvas outside pill: " + (Probe 1000 300))
Write-Output ("probe pill not hovering: " + (Probe $PillX $PillY))

