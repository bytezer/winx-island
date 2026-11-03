Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class WindowList {
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr param);
  [DllImport("user32.dll")] static extern int GetWindowThreadProcessId(IntPtr hwnd, out int pid);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassNameW(IntPtr hwnd, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextW(IntPtr hwnd, StringBuilder s, int n);
  delegate bool EnumProc(IntPtr hwnd, IntPtr param);

  public static List<string> ForProcess(int pid) {
    var list = new List<string>();
    EnumWindows((h, p) => {
      int owner; GetWindowThreadProcessId(h, out owner);
      if (owner != pid) return true;
      var cls = new StringBuilder(256); GetClassNameW(h, cls, 256);
      var title = new StringBuilder(256); GetWindowTextW(h, title, 256);
      long style = GetWindowLongPtr(h, -20).ToInt64();
      list.Add(string.Format("hwnd=0x{0:X} exstyle=0x{1:X8} visible={2} class='{3}' title='{4}'",
        h.ToInt64(), style, IsWindowVisible(h), cls, title));
      return true;
    }, IntPtr.Zero);
    return list;
  }
}
"@

$process = Get-Process winx-island -ErrorAction SilentlyContinue
if (-not $process) { Write-Output "winx-island is not running"; exit 1 }
[WindowList]::ForProcess($process.Id)
