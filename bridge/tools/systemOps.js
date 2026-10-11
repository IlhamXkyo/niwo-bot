/**
 * bridge/tools/systemOps.js
 * ---------------------------------------------------------------------
 * System operations for Remote C2 Assistant:
 * - Desktop Screenshot trigger via PowerShell GDI+
 * - Guarded shutdown scheduling (60s timer + abort capability)
 * - Safe path resolution within project root
 * - Real application and window inspection (PowerShell + tasklist)
 * ---------------------------------------------------------------------
 */

import path from 'node:path';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Common background system services and driver hosts to filter out
const SYSTEM_SERVICE_PROCESSES = new Set([
  'dwm.exe', 'svchost.exe', 'taskhostw.exe', 'nvcontainer.exe',
  'rtkauduservice64.exe', 'nvdisplay.container.exe', 'searchhost.exe',
  'startmenuexperiencehost.exe', 'widgetboard.exe', 'widgetservice.exe',
  'textinputhost.exe', 'shellexperiencehost.exe', 'shellhost.exe',
  'runtimebroker.exe', 'conhost.exe', 'dllhost.exe', 'audiodg.exe',
  'wmiprvse.exe', 'wmiapsrv.exe', 'searchprotocolhost.exe',
  'searchfilterhost.exe', 'backgroundtaskhost.exe', 'crossdeviceresume.exe',
  'crossdeviceservice.exe', 'phoneexperiencehost.exe', 'appactions.exe',
  'systemsettings.exe', 'aqauserps.exe', 'accuserps.exe',
  'acerhardwareservice.exe', 'acersyshardwareservice.exe', 'nvsphelper64.exe',
  'sdxhelper.exe', 'unsecapp.exe', 'tasklist.exe', 'smss.exe', 'csrss.exe',
  'wininit.exe', 'services.exe', 'lsass.exe', 'winlogon.exe', 'fontdrvhost.exe',
  'spoolsv.exe', 'securityhealthsystray.exe', 'securityhealthservice.exe',
  'monotificationux.exe', 'ctfmon.exe', 'sihost.exe'
]);

// Non-user window titles to filter out
const SYSTEM_WINDOW_TITLES = new Set([
  'n/a', 'olemainthreadwndname', 'default ime', 'msctfime ui',
  'wuiconwindow', 'olechannelwnd', 'task host window',
  'dwm notification window', 'nvsvc', 'broadcastlistenerwindow',
  'realtekaudioadminbackgroundprocessclass',
  'windows push notifications platform', 'crossdeviceresumewindow',
  'nvidia nodejs share window', 'quick settings', 'search', 'start',
  'windows widgets', 'qa osd', 'acerhardwareservice',
  'i3dmessageonlywindow', 'windows input experience', 'temp window',
  'dde server window', 'new notification', 'nvidia geforce overlay',
  'program manager'
]);

// Friendly display names for common applications
const APP_DISPLAY_NAMES = {
  'chrome.exe': 'Google Chrome',
  'msedge.exe': 'Microsoft Edge',
  'code.exe': 'Visual Studio Code',
  'windowsterminal.exe': 'Windows Terminal',
  'antigravity.exe': 'Antigravity Assistant',
  'robloxplayerbeta.exe': 'Roblox Game',
  'llama-server.exe': 'Ollama Local AI',
  'ollama.exe': 'Ollama Local AI',
  'nitrosense.exe': 'Acer NitroSense',
  'cloudflare warp.exe': 'Cloudflare WARP',
  'browser_assistant.exe': 'Opera GX Assistant',
  'applicationframehost.exe': 'Windows App',
  'explorer.exe': 'File Explorer / Desktop',
  'cmd.exe': 'Command Prompt',
  'powershell.exe': 'PowerShell',
  'discord.exe': 'Discord',
  'spotify.exe': 'Spotify',
  'steam.exe': 'Steam',
  'notepad.exe': 'Notepad',
  'onedrive.sync.service.exe': 'OneDrive Sync'
};

// Known user background processes worth displaying in running apps summary
const KNOWN_USER_BACKGROUND_APPS = new Set([
  'robloxplayerbeta.exe', 'llama-server.exe', 'ollama.exe', 'cloudflare warp.exe',
  'discord.exe', 'spotify.exe', 'steam.exe', 'node.exe', 'python.exe', 'code.exe'
]);

export function getFriendlyAppName(processName) {
  const lower = (processName || '').toLowerCase();
  return APP_DISPLAY_NAMES[lower] || processName.replace(/\.exe$/i, '');
}

/**
 * Validates that a requested file path does not escape the project root.
 * Blocks directory traversal (.. and URL-encoded variations).
 * @param {string} requestedPath
 * @param {string} [projectRoot]
 * @returns {{ safe: boolean, resolvedPath?: string, error?: string }}
 */
export function validateSafeFilePath(requestedPath, projectRoot = PROJECT_ROOT) {
  if (typeof requestedPath !== 'string') {
    return { safe: false, error: 'Path must be a string.' };
  }

  let decoded = requestedPath;
  try {
    decoded = decodeURIComponent(requestedPath);
  } catch (err) {
    decoded = requestedPath;
  }

  if (decoded.includes('..') || requestedPath.includes('..') || /%2e%2e/i.test(requestedPath)) {
    return {
      safe: false,
      error: 'Security alert: Access outside project root is strictly blocked.'
    };
  }

  const resolved = path.resolve(projectRoot, decoded);
  const relative = path.relative(projectRoot, resolved);
  const isInside = !relative.startsWith('..') && !path.isAbsolute(relative);

  if (!isInside) {
    return {
      safe: false,
      error: 'Security alert: Access outside project root is strictly blocked.'
    };
  }

  return {
    safe: true,
    resolvedPath: resolved
  };
}

/**
 * Triggers a desktop screenshot via PowerShell.
 * @returns {Promise<string>} Path to captured screenshot PNG
 */
export function captureScreenshot() {
  return new Promise((resolve, reject) => {
    const psScript = path.join(__dirname, 'screenshot.ps1');
    const mediaDir = path.resolve(__dirname, '../media');
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
    const outputPath = path.join(mediaDir, `screenshot_${Date.now()}.png`);

    exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${psScript}" "${outputPath}"`, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`Screenshot failed: ${stderr || err.message}`));
      }
      const finalPath = stdout.trim() || outputPath;
      if (fs.existsSync(finalPath)) {
        resolve(finalPath);
      } else {
        reject(new Error('Screenshot file was not created.'));
      }
    });
  });
}

/**
 * Initiates a guarded shutdown with a 60-second grace period.
 * @param {number} [timeoutSec=60]
 * @returns {Promise<string>}
 */
export function scheduleShutdown(timeoutSec = 60) {
  return new Promise((resolve, reject) => {
    exec(`shutdown /s /t ${timeoutSec} /c "Remote shutdown initiated via Niwo Bot Antigravity"`, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`Failed to schedule shutdown: ${stderr || err.message}`));
      }
      resolve(`Laptop dijadwalkan mati dalam ${timeoutSec} detik. Ketik .abort_shutdown untuk membatalkan.`);
    });
  });
}

/**
 * Aborts any pending system shutdown.
 * @returns {Promise<string>}
 */
export function abortShutdown() {
  return new Promise((resolve, reject) => {
    exec('shutdown /a', (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`Failed to abort shutdown: ${stderr || err.message}`));
      }
      resolve('Jadwal shutdown laptop berhasil dibatalkan! (*v*)');
    });
  });
}

/**
 * Lists user-facing windows and application tabs currently open on the desktop.
 * Uses high-speed WinSta0 desktop scanner via PowerShell, filtering out background noise.
 * @returns {Promise<Array<{ process: string, name: string, pid: number, title: string }>>}
 */
export function listOpenWindows() {
  return new Promise((resolve, reject) => {
    const psScript = path.join(__dirname, 'list_windows.ps1');
    exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${psScript}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`Failed to inspect windows: ${stderr || err.message}`));
      }

      let rawList = [];
      try {
        rawList = JSON.parse(stdout.trim() || '[]');
      } catch (_) {
        rawList = [];
      }

      const windows = [];
      const seenTitles = new Set();

      for (const item of rawList) {
        const processName = item.process || '';
        const pid = parseInt(item.pid, 10) || 0;
        let title = (item.title || '').trim();

        const lowerProc = processName.toLowerCase();
        const lowerTitle = title.toLowerCase();

        if (SYSTEM_SERVICE_PROCESSES.has(lowerProc)) continue;
        if (SYSTEM_WINDOW_TITLES.has(lowerTitle)) continue;
        if (!title || title === 'N/A' || title === 'Program Manager') continue;
        if (/^\{[0-9a-f-]+\}$/i.test(title)) continue;
        if (/^\.net-broadcasteventwindow/i.test(title)) continue;

        // Clean up title artifacts
        title = title.replace(/Microsoft\? Edge/g, 'Microsoft Edge').trim();
        if (!title) continue;

        const dedupKey = `${lowerProc}::${title}`;
        if (seenTitles.has(dedupKey)) continue;
        seenTitles.add(dedupKey);

        windows.push({
          process: processName,
          name: getFriendlyAppName(processName),
          pid,
          title
        });
      }

      resolve(windows);
    });
  });
}

/**
 * Inspects all active user-facing applications and windows on the laptop.
 * Gathers open window titles, active user background apps, and produces
 * a human-readable summary formatted in Sawako's persona.
 * @returns {Promise<{ windows: Array, runningApps: Array, formatted: string }>}
 */
export function listOpenApps() {
  return new Promise((resolve, reject) => {
    // 1. Get active user windows
    listOpenWindows().then((windows) => {
      // 2. Fast background check for other user processes via tasklist /fo csv
      exec('tasklist /fo csv', { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }, (err, stdout) => {
        const runningApps = [];
        const seenOpenProcs = new Set(windows.map((w) => w.process.toLowerCase()));
        const seenApps = new Set();

        if (!err && stdout) {
          const lines = stdout.split(/\r?\n/).filter(Boolean);
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.startsWith('"')) continue;
            const cols = line.slice(1, -1).split('","');
            const proc = cols[0] || '';
            const lowerProc = proc.toLowerCase();
            const pid = parseInt(cols[1], 10) || 0;

            if (KNOWN_USER_BACKGROUND_APPS.has(lowerProc) && !seenOpenProcs.has(lowerProc) && !seenApps.has(lowerProc)) {
              seenApps.add(lowerProc);
              runningApps.push({
                process: proc,
                name: getFriendlyAppName(proc),
                pid
              });
            }
          }
        }

        const formatted = formatRunningAppsMessage(windows, runningApps);
        resolve({ windows, runningApps, formatted });
      });
    }).catch(reject);
  });
}

/**
 * Formats open windows and running applications into Sawako's conversational voice.
 * @param {Array} windows
 * @param {Array} runningApps
 * @returns {string}
 */
export function formatRunningAppsMessage(windows = [], runningApps = []) {
  if (windows.length === 0 && runningApps.length === 0) {
    return 'A-ano... sepertinya saat ini tidak ada jendela aplikasi utama yang sedang terbuka di desktop laptop Master (*v*). [ACTION: SEND_STICKER_DEFAULT]';
  }

  let text = 'A-ano... halo Master (*v*)! Ini hasil pemeriksaan aplikasi dan tab yang sedang terbuka di laptop:\n\n';

  if (windows.length > 0) {
    text += '*Jendela & Tab Aktif:*\n';
    for (const w of windows) {
      text += `• ${w.name}: ${w.title}\n`;
    }
  }

  if (runningApps.length > 0) {
    text += '\n*Aplikasi Lain yang Berjalan:*\n';
    for (const app of runningApps) {
      text += `• ${app.name} (${app.process})\n`;
    }
  }

  text += '\nSemua sistem berjalan lancar di laptop Master (*^▽^*)! [ACTION: SEND_STICKER_HAPPY]';
  return text.trim();
}

/**
 * Executes a network ping to verify internet latency and packet transmission.
 * @param {string} [target='8.8.8.8']
 * @param {number} [count=3]
 * @returns {Promise<{ target: string, sent: number, received: number, lost: number, lossPercent: number, minLatencyMs: number, maxLatencyMs: number, avgLatencyMs: number, success: boolean, formatted: string }>}
 */
export function pingInternet(target = '8.8.8.8', count = 3) {
  return new Promise((resolve, reject) => {
    const cleanTarget = String(target || '8.8.8.8').trim().replace(/[^a-zA-Z0-9.-]/g, '') || '8.8.8.8';
    const scriptPath = path.resolve(__dirname, 'ping_network.ps1');
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Target "${cleanTarget}" -Count ${count}`;

    exec(cmd, { encoding: 'utf8', timeout: 15000 }, (err, stdout, stderr) => {
      let data = null;
      try {
        data = JSON.parse(stdout.trim());
      } catch (_) {}

      if (!data) {
        if (err) return reject(new Error(`Ping execution failed: ${stderr || err.message}`));
        return reject(new Error('Failed to parse ping output.'));
      }

      let formatted = '';
      if (data.Success && data.Received > 0) {
        let quality = 'sangat lancar dan stabil (*^▽^*)';
        if (data.AvgLatencyMs > 250) quality = 'terhubung, meski agak tinggi latensinya (*v*)';
        else if (data.AvgLatencyMs > 120) quality = 'stabil dan cukup baik (*v*)';

        formatted = [
          `A-ano... halo Master (*v*)! Ini hasil tes ping internet langsung dari laptop:`,
          ``,
          `• Sasaran Ping: ${data.Target}`,
          `• Paket: ${data.Sent} terkirim, ${data.Received} diterima (${data.LossPercent}% hilang)`,
          `• Waktu Latensi: Rata-rata ${data.AvgLatencyMs} ms (Min: ${data.MinLatencyMs} ms, Max: ${data.MaxLatencyMs} ms)`,
          `• Kualitas Jaringan: ${quality}`,
          ``,
          `Koneksi internet laptop Master siap digunakan m(_ _)m! [ACTION: SEND_STICKER_HAPPY]`
        ].join('\n');
      } else {
        formatted = [
          `Sumimasen Master m(_ _)m... Hasil tes ping ke ${data.Target} menunjukkan paket hilang 100% (｡•́︿•̀｡).`,
          `Sepertinya koneksi internet di laptop Master sedang terputus atau mengalami kendala jaringan.`,
          `[ACTION: SEND_STICKER_SAD]`
        ].join('\n');
      }

      data.formatted = formatted;
      resolve(data);
    });
  });
}

/**
 * Gathers complete real system hardware and performance telemetry:
 * CPU, RAM, Battery, Disk C:, Uptime.
 * @returns {Promise<{ cpu: string, cpuLoad: number, totalRamGB: number, freeRamGB: number, usedRamGB: number, ramPercent: number, battery: number, batteryStatus: number, diskTotalGB: number, diskFreeGB: number, diskUsedGB: number, diskPercent: number, uptimeHours: number, formatted: string }>}
 */
export function getSystemSpecs() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, 'system_info.ps1');
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;

    exec(cmd, { encoding: 'utf8', timeout: 15000 }, (err, stdout, stderr) => {
      let data = null;
      try {
        data = JSON.parse(stdout.trim());
      } catch (_) {}

      if (!data) {
        if (err) return reject(new Error(`System specs query failed: ${stderr || err.message}`));
        return reject(new Error('Failed to parse system specs output.'));
      }

      let batteryDesc = 'Tidak terpasang / Desktop';
      if (data.Battery >= 0) {
        if (data.BatteryStatus === 2) {
          batteryDesc = 'Tersambung ke daya AC (Listrik aktif / Terisi)';
        } else if (data.BatteryStatus === 1) {
          batteryDesc = 'Menggunakan daya baterai (Discharging)';
        } else if (data.BatteryStatus === 3) {
          batteryDesc = 'Sedang mengisi daya (Charging)';
        } else {
          batteryDesc = 'Tersambung ke daya AC';
        }
      }

      const formatted = [
        `A-ano... halo Master (*v*)! Ini ringkasan kondisi dan performa laptop Master:`,
        ``,
        `• Sistem Operasi: ${data.OsCaption || 'Windows 11'}`,
        `• Prosesor (CPU): ${data.Cpu} (Beban kerja: ${data.CpuLoad}%)`,
        `• Memori (RAM): ${data.UsedRamGB} GB terpakai dari ${data.TotalRamGB} GB (${data.RamPercent}%, Sisa: ${data.FreeRamGB} GB)`,
        `• Penyimpanan (Drive C:): Sisa ${data.DiskFreeGB} GB bebas dari total ${data.DiskTotalGB} GB (${data.DiskPercent}% terpakai)`,
        data.Battery >= 0 ? `• Baterai Laptop: ${data.Battery}% (${batteryDesc})` : `• Status Daya: ${batteryDesc}`,
        `• Durasi Aktif (Uptime): Sekitar ${data.UptimeHours} jam`,
        ``,
        `Semua sistem laptop Master dalam kondisi terpantau prima (*^▽^*)! m(_ _)m [ACTION: SEND_STICKER_HAPPY]`
      ].join('\n');

      data.formatted = formatted;
      resolve(data);
    });
  });
}

/**
 * Executes a terminal/PowerShell command directly on the laptop and returns sanitized output.
 * @param {string} commandString
 * @param {number} [timeoutMs=20000]
 * @returns {Promise<{ command: string, output: string, exitCode: number, formatted: string }>}
 */
export function executeTerminalCommand(commandString, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const rawCmd = String(commandString || '').trim();
    if (!rawCmd) {
      return reject(new Error('Command cannot be empty.'));
    }

    exec(rawCmd, {
      shell: 'powershell.exe',
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024
    }, (err, stdout, stderr) => {
      const outputText = (stdout || '') + (stderr ? `\n[STDERR]\n${stderr}` : '');
      const trimmedOutput = outputText.trim() || '(Perintah selesai tanpa luaran teks)';
      
      let displayOutput = trimmedOutput;
      if (displayOutput.length > 1500) {
        displayOutput = displayOutput.slice(0, 1500) + '\n\n... (luaran dipotong karena terlalu panjang)';
      }

      const formatted = [
        `A-ano... halo Master (*v*)! Perintah \`${rawCmd}\` telah selesai dijalankan di terminal laptop Master:`,
        ``,
        '```',
        displayOutput,
        '```',
        ``,
        `Eksekusi selesai dengan status ${err ? 'terdapat peringatan/error' : 'sukses'} (*^▽^*)! [ACTION: SEND_STICKER_HAPPY]`
      ].join('\n');

      resolve({
        command: rawCmd,
        output: trimmedOutput,
        exitCode: err?.code ?? 0,
        formatted
      });
    });
  });
}

/**
 * Closes or kills a process by name (e.g. notepad.exe, chrome.exe).
 * @param {string} processName
 * @returns {Promise<{ processName: string, success: boolean, formatted: string }>}
 */
export function killProcessByName(processName) {
  return new Promise((resolve) => {
    let cleanName = String(processName || '').trim();
    if (!cleanName.toLowerCase().endsWith('.exe')) {
      cleanName += '.exe';
    }

    exec(`taskkill /F /IM "${cleanName}"`, { encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          processName: cleanName,
          success: false,
          formatted: `Sumimasen Master m(_ _)m... Gagal menghentikan proses ${cleanName}: ${stderr || err.message} (｡•́︿•̀｡) [ACTION: SEND_STICKER_SAD]`
        });
      } else {
        resolve({
          processName: cleanName,
          success: true,
          formatted: `A-ano... proses ${cleanName} telah berhasil dihentikan di laptop Master (*v*)! [ACTION: SEND_STICKER_HAPPY]`
        });
      }
    });
  });
}

export default {
  validateSafeFilePath,
  captureScreenshot,
  scheduleShutdown,
  abortShutdown,
  listOpenWindows,
  listOpenApps,
  formatRunningAppsMessage,
  getFriendlyAppName,
  pingInternet,
  getSystemSpecs,
  executeTerminalCommand,
  killProcessByName
};

