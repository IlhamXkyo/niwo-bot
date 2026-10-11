[CmdletBinding()]
param()

try {
    Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class WinStaScanner {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenWindowStation(string a, bool b, uint c);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessWindowStation(IntPtr a);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string a, uint b, bool c, uint d);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public class WinInfo {
        public int Pid;
        public string Title;
    }

    public static List<WinInfo> GetActiveWindows() {
        var list = new List<WinInfo>();
        IntPtr hWinsta = OpenWindowStation("WinSta0", false, 0x037F);
        if (hWinsta != IntPtr.Zero) {
            SetProcessWindowStation(hWinsta);
            IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
            if (hDesk != IntPtr.Zero) {
                EnumDesktopWindows(hDesk, (hWnd, lParam) => {
                    if (IsWindowVisible(hWnd)) {
                        StringBuilder sb = new StringBuilder(512);
                        int len = GetWindowText(hWnd, sb, 512);
                        if (len > 0) {
                            uint pid;
                            GetWindowThreadProcessId(hWnd, out pid);
                            list.Add(new WinInfo { Pid = (int)pid, Title = sb.ToString() });
                        }
                    }
                    return true;
                }, IntPtr.Zero);
            }
        }
        return list;
    }
}
"@

    $raw = [WinStaScanner]::GetActiveWindows()
    $intPids = [int[]]@($raw | ForEach-Object { $_.Pid } | Select-Object -Unique)
    $procMap = @{}
    if ($intPids.Count -gt 0) {
        $procs = Get-Process -Id $intPids -ErrorAction SilentlyContinue
        foreach ($p in $procs) {
            $procMap[$p.Id] = $p.ProcessName
        }
    }

    $results = @()
    foreach ($item in $raw) {
        $name = if ($procMap.ContainsKey($item.Pid)) { $procMap[$item.Pid] } else { "Unknown" }
        $results += [PSCustomObject]@{
            pid = $item.Pid
            process = $name + ".exe"
            title = $item.Title
        }
    }

    if ($results.Count -eq 0) {
        Write-Output "[]"
    } else {
        $results | ConvertTo-Json -Compress
    }
    exit 0
} catch {
    Write-Error "Scan error: $_"
    exit 1
}
