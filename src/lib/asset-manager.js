// src/lib/asset-manager.js
import fs from "fs";
import path from "path";
import config from "../../config.js";

const assetCache = {};

function isUrl(value) {
  return typeof value === "string" && /^(https?:\/\/|data:)/i.test(value);
}

function resolveAssetPath(filepath) {
  if (!filepath || typeof filepath !== "string") return null;
  return path.isAbsolute(filepath) ? filepath : path.resolve(process.cwd(), filepath);
}

export function preloadAssets(configAssets = null) {
  const assets = configAssets || config?.assets;
  if (!assets || typeof assets !== "object") return;

  for (const [key, filepath] of Object.entries(assets)) {
    try {
      if (isUrl(filepath)) continue;
      const fullPath = resolveAssetPath(filepath);
      if (!fullPath) continue;

      if (fs.existsSync(fullPath)) {
        assetCache[key] = fs.readFileSync(fullPath);
        console.log(`[AssetManager] 📂 Cached: ${key}`);
      } else {
        console.error(`[AssetManager] ❌ File not found: ${fullPath}`);
      }
    } catch (e) {
      console.error(`[AssetManager] ❌ Failed to load ${key}:`, e.message);
    }
  }
}

export function getAssetBuffer(key, configAssets = null) {
  if (!key) return null;
  if (assetCache[key]) return assetCache[key];

  const assets = configAssets || config?.assets;
  const filepath = assets?.[key];

  if (!filepath || isUrl(filepath)) return null;

  try {
    const fullPath = resolveAssetPath(filepath);
    if (!fullPath || !fs.existsSync(fullPath)) return null;

    const buffer = fs.readFileSync(fullPath);
    assetCache[key] = buffer;
    return buffer;
  } catch (e) {
    console.error(`[AssetManager] ❌ Failed to read ${key}:`, e.message);
    return null;
  }
}

export function updateAssetAndSave(key, buffer, filepath = null) {
  if (!key || !Buffer.isBuffer(buffer)) return false;

  assetCache[key] = buffer;

  if (!filepath || isUrl(filepath)) return true;

  try {
    const fullPath = resolveAssetPath(filepath);
    if (!fullPath) return false;

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(fullPath, buffer);
    return true;
  } catch (e) {
    console.error(`[AssetManager] ❌ Failed to save ${key}:`, e.message);
    return false;
  }
}

export function deleteAssetCache(key) {
  if (!key) return false;
  if (!assetCache[key]) return false;
  delete assetCache[key];
  return true;
}

export function hasAsset(key, configAssets = null) {
  if (assetCache[key]) return true;

  const assets = configAssets || config?.assets;
  const filepath = assets?.[key];
  if (!filepath || isUrl(filepath)) return false;

  const fullPath = resolveAssetPath(filepath);
  return !!(fullPath && fs.existsSync(fullPath));
}

export function getAssetKeys(configAssets = null) {
  const assets = configAssets || config?.assets || {};
  return Object.keys(assets);
}

export function clearAssetCache() {
  for (const key of Object.keys(assetCache)) delete assetCache[key];
}

export function getAssetCacheSize() {
  return Object.keys(assetCache).length;
}

export default {
  preloadAssets,
  getAssetBuffer,
  updateAssetAndSave,
  deleteAssetCache,
  hasAsset,
  getAssetKeys,
  clearAssetCache,
  getAssetCacheSize,
};