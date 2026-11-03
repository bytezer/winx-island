param([int]$CursorX = -1, [int]$CursorY = -1, [int]$Samples = 8, [int]$IntervalMs = 60)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ExStyleProbe {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
}
"@
[void][ExStyleProbe]::SetProcessDPIAware()

$process = Get-Process winx-island -ErrorAction SilentlyContinue
if (-not $process) { Write-Output "winx-island is not running"; exit 1 }
$hwnd = $process.MainWindowHandle
if ($hwnd -eq [IntPtr]::Zero) {
  # Tool windows do not become the main window handle, so fall back to enumeration.
  Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class WindowFinder {
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr param);
  [DllImport("user32.dll")] static extern int GetWindowThreadProcessId(IntPtr hwnd, out int pid);
  delegate bool EnumProc(IntPtr hwnd, IntPtr param);
  public static IntPtr Find(int pid) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, p) => {
      int owner; GetWindowThreadProcessId(h, out owner);
      if (owner == pid) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@
  $hwnd = [WindowFinder]::Find($process.Id)
}

if ($CursorX -ge 0) { [void][ExStyleProbe]::SetCursorPos($CursorX, $CursorY) }

for ($i = 0; $i -lt $Samples; $i++) {
  $style = [ExStyleProbe]::GetWindowLongPtr($hwnd, -20).ToInt64()
  $transparent = if (($style -band 0x20) -ne 0) { "transparent" } else { "interactive" }
  $tool = if (($style -band 0x80) -ne 0) { "toolwindow" } else { "-" }
  $noactivate = if (($style -band 0x08000000) -ne 0) { "noactivate" } else { "-" }
  $visible = [ExStyleProbe]::IsWindowVisible($hwnd)
  Write-Output ("exstyle=0x{0:X8} {1} {2} {3} visible={4}" -f $style, $transparent, $tool, $noactivate, $visible)
  Start-Sleep -Milliseconds $IntervalMs
}
