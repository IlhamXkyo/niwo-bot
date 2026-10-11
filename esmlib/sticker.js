import fs from "node:fs";
import Crypto from "crypto";
import ff from "fluent-ffmpeg";
import webp from "node-webpmux";
import path from "path";
import { tmpdir } from "os";
import fileType from "file-type";
import sharp from "sharp";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

if (ffmpegInstaller?.path) {
  ff.setFfmpegPath(ffmpegInstaller.path);
}
if (ffprobeInstaller?.path) {
  ff.setFfprobePath(ffprobeInstaller.path);
}

const temp = tmpdir();

async function imageToWebp(media, opts = {}) {
  const { quality = 80 } = opts;

  // Prioritaskan Sharp: cepat, tanpa file sementara, dan stabil
  try {
    return await sharp(media.data)
      .resize(512, 512, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: Number(quality) || 80 })
      .toBuffer();
  } catch (sharpErr) {
    // Fallback ke FFmpeg jika Sharp gagal membaca format tertentu
    const tmpFileIn = path.join(temp, `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.${media?.ext || "png"}`);
    const tmpFileOut = path.join(temp, `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);

    fs.writeFileSync(tmpFileIn, media.data);

    try {
      await new Promise((resolve, reject) => {
        ff(tmpFileIn)
          .on("error", reject)
          .on("end", () => resolve(true))
          .addOutputOptions([
            "-vcodec",
            "libwebp",
            "-vf",
            `scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=white@0.0`,
            "-quality",
            "80",
            "-lossless",
            "0"
          ])
          .toFormat("webp")
          .saveToFile(tmpFileOut);
      });

      const buff = fs.readFileSync(tmpFileOut);
      try { fs.unlinkSync(tmpFileIn); } catch {}
      try { fs.unlinkSync(tmpFileOut); } catch {}
      return buff;
    } catch (e) {
      try { if (fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn); } catch {}
      try { if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut); } catch {}
      throw e;
    }
  }
}

async function videoToWebp(media, opts = {}) {
  const { crop = false, quality = 50, fps = 15 } = opts;

  const tmpFileIn = path.join(temp, `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.${media?.ext || "mp4"}`);
  const tmpFileOut = path.join(temp, `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);

  fs.writeFileSync(tmpFileIn, media.data);

  const getDuration = () => {
    return new Promise((resolve) => {
      ff.ffprobe(tmpFileIn, (err, metadata) => {
        if (err || !metadata?.format?.duration) return resolve(7);
        resolve(metadata.format.duration);
      });
    });
  };

  const duration = await getDuration();
  const maxDuration = 7;
  const t = Math.min(duration || 7, maxDuration);

  try {
    await new Promise((resolve, reject) => {
      ff(tmpFileIn)
        .on("error", reject)
        .on("end", () => resolve(true))
        .addOutputOptions([
          "-vcodec",
          "libwebp",
          "-vf",
          `scale='min(256,iw)':'min(256,ih)':force_original_aspect_ratio=decrease,fps=${fps},pad=256:256:-1:-1:color=white@0.0`,
          "-loop",
          "0",
          "-ss",
          "0",
          "-t",
          `${t}`,
          "-preset",
          "default",
          "-an",
          "-vsync",
          "0",
          "-quality",
          `${quality}`,
          "-compression_level",
          "6"
        ])
        .toFormat("webp")
        .saveToFile(tmpFileOut);
    });

    const buff = fs.readFileSync(tmpFileOut);
    try { fs.unlinkSync(tmpFileIn); } catch {}
    try { fs.unlinkSync(tmpFileOut); } catch {}

    return buff;
  } catch (e) {
    try { if (fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn); } catch {}
    try { if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut); } catch {}
    throw e;
  }
}

async function writeExif(media, metadata = {}, opts = {}) {
  const { crop = false, quality = 80, fps = 15 } = opts;

  if (!media.mimetype || !media.ext) {
    try {
      const typeDetector = fileType.fromBuffer || fileType;
      const type = await typeDetector(media.data);
      if (type) {
        media.mimetype = type.mime;
        media.ext = type.ext;
      }
    } catch {}
  }

  let wMedia = null;

  if (/webp/.test(media?.mimetype || "") || media?.ext === "webp") {
    wMedia = media?.data;
  } else if (/video/.test(media?.mimetype || "") || media?.type === "video" || media?.ext === "mp4") {
    wMedia = await videoToWebp(media, { crop, quality, fps });
  } else {
    // Default gambar (JPG, PNG, GIF, BMP, atau buffer gambar)
    wMedia = await imageToWebp(media, { crop, quality, fps });
  }

  if (!wMedia) throw new Error("Gagal konversi ke format WebP");

  if (metadata && Object.keys(metadata).length !== 0) {
    try {
      const img = new webp.Image();
      const json = {
        "sticker-pack-id": metadata?.packId || `niwo-${Date.now()}`,
        "sticker-pack-name": metadata?.packName || "niwo bot",
        "sticker-pack-publisher": metadata?.packPublish || "ilham",
        "emojis": metadata?.emojis || ["😋", "😎", "🤣", "😂", "😁"],
        "is-avatar-sticker": metadata?.isAvatar || 0,
      };
      const exifAttr = Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
        0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
      ]);
      const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
      const exif = Buffer.concat([exifAttr, jsonBuff]);
      exif.writeUIntLE(jsonBuff.length, 14, 4);
      await img.load(wMedia);
      img.exif = exif;

      return await img.save(null);
    } catch (exifErr) {
      console.error("[EXIF ERROR]", exifErr?.message || exifErr);
      return wMedia;
    }
  }

  return wMedia;
}

export default {
  writeExif,
  videoToWebp,
  imageToWebp,
};