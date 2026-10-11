import fs from "fs";
import path from "path";
import zlib from "zlib";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) |
    (now.getMinutes() << 5) |
    Math.floor(now.getSeconds() / 2);
  const dosDate =
    ((Math.max(1980, now.getFullYear()) - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate();

  for (const file of files) {
    const data = fs.readFileSync(file.fullPath);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const nameBuffer = Buffer.from(file.relativePath, "utf8");

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + compressed.length;
  }

  const localDirectory = Buffer.concat(localParts);
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localDirectory.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localDirectory, centralDirectory, end]);
}

function collectFiles(rootDir) {
  const result = [];
  const excludedDirectories = new Set([
    "node_modules", ".git", ".github", ".cache", ".npm",
    "session", "sessions", "auth", "auth_info", "storage/temp",
    "skyzopedia"
  ]);
  const excludedFiles = new Set([
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml"
  ]);

  function shouldExclude(relativePath) {
    const normalized = relativePath.replace(/\\/g, "/");
    if (excludedFiles.has(path.basename(normalized))) return true;
    for (const excluded of excludedDirectories) {
      if (
        normalized === excluded ||
        normalized.startsWith(`${excluded}/`) ||
        normalized.includes(`/${excluded}/`)
      ) return true;
    }
    return false;
  }

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);
      if (shouldExclude(relativePath)) continue;
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile()) {
        result.push({
          fullPath,
          relativePath: relativePath.replace(/\\/g, "/")
        });
      }
    }
  }

  walk(rootDir);
  return result;
}

function safeBotName(name = "Niwo-Bot") {
  return String(name).trim().replace(/\s+/g, "-").replace(/[<>:"/\\|?*]/g, "") || "Niwo-Bot";
}

export async function createBackup(botName = "Niwo-Bot") {
  const rootDir = process.cwd();
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const date = `${dd}-${mm}-${yy}`;
  const fileName = `${safeBotName(botName)}-${date}-${Date.now()}.zip`;
  const tempDir = path.join(rootDir, "storage", "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const zipPath = path.join(tempDir, fileName);
  const files = collectFiles(rootDir);
  if (!files.length) throw new Error("Tidak ada file yang bisa dibackup.");

  fs.writeFileSync(zipPath, createZip(files));
  return { zipPath, fileName, date, count: files.length };
}

export function removeBackup(zipPath) {
  try {
    if (zipPath && fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  } catch {}
}
