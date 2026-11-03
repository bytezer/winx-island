param(
  [int]$PillX = 1280,
  [int]$PillY = 40,
  [int]$PlayY = 295,
  [int]$QuitX = 1554,
  [int]$QuitY = 390,
  [string]$OutDir = "$env:TEMP"
)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Act {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr param);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern int GetWindowTextLengthW(IntPtr hwnd);
  [DllImport("user32.dll")] static extern int GetWindowTextW(IntPtr hwnd, StringBuilder s, int n);
  delegate bool EnumProc(IntPtr hwnd, IntPtr param);

  public static IntPtr FindWindowOfProcess(int targetPid) {
    IntPtr best = IntPtr.Zero;
    int bestLength = -1;
    EnumWindows((h, p) => {
      int owner; GetWindowThreadProcessId(h, out owner);
      if (owner != targetPid || !IsWindowVisible(h)) return true;
      int length = GetWindowTextLengthW(h);
      if (length > bestLength) { bestLength = length; best = h; }
      return true;
    }, IntPtr.Zero);
    return best;
  }

  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    System.Threading.Thread.Sleep(120);
    mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
    System.Threading.Thread.Sleep(60);
    mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
  }
}
"@
[void][Act]::SetProcessDPIAware()

function Foreground() {
  $handle = [Act]::GetForegroundWindow()
  $owner = 0
  [void][Act]::GetWindowThreadProcessId($handle, [ref]$owner)
  $name = (Get-Process -Id $owner -ErrorAction SilentlyContinue).ProcessName
  return "$name"
}

function Snap([string]$name) {
  $bmp = New-Object System.Drawing.Bitmap 840, 480
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen(880, 0, 0, 0, (New-Object System.Drawing.Size 840, 480))
  $path = Join-Path $OutDir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

# Establish a baseline: the terminal should own the foreground.
$terminal = Get-Process WindowsTerminal -ErrorAction SilentlyContinue | Select-Object -First 1
if ($terminal) {
  $hwnd = [Act]::FindWindowOfProcess($terminal.Id)
  if ($hwnd -ne [IntPtr]::Zero) { [void][Act]::SetForegroundWindow($hwnd) }
  Start-Sleep -Milliseconds 400
}
Write-Output ("foreground baseline: " + (Foreground))

[Act]::Click($PillX, $PillY)
Start-Sleep -Milliseconds 800
Write-Output ("foreground after pill click: " + (Foreground))
Snap "wx-step1-panel.png"

[Act]::SetCursorPos($PillX, $PlayY)
Start-Sleep -Milliseconds 200
[Act]::Click($PillX, $PlayY)
Start-Sleep -Milliseconds 1000
Write-Output ("foreground after play click: " + (Foreground))
Snap "wx-step2-play.png"

[Act]::Click($QuitX, $QuitY)
Start-Sleep -Milliseconds 900
$alive = Get-Process winx-island -ErrorAction SilentlyContinue
Write-Output ("island still running: " + [bool]$alive)
