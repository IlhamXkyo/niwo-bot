// plugins/maker/hdvid.js
// NIWO BOT : HD VIDEO (AI video upscaler)

import axios from "axios";
import FormData from "form-data";
import crypto from "node:crypto";

const config = {
  name: "hdvid",
  alias: ["upscalevid", "videohd"],
  category: "maker",
  description: "Meningkatkan kualitas/resolusi video jadi HD (2K).",
  usage: ".hdvid (reply video)",
  example: ".hdvid",
  isOwner: false,
  isPremium: true,
  isGroup: false,
  isPrivate: false,
  cooldown: 30,
  energi: 3,
  isEnabled: true,
};

const BASE_API = "https://api.unblurimage.ai";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pickTarget(m) {
  if (m.quoted && m.quoted.isVideo) return m.quoted;
  if (m.isVideo) return m;
  return null;
}

async function handler(m, { sock }) {
  const target = pickTarget(m);

  if (!target) {
    return m.reply(
      `🎬 *HD VIDEO*\n\nReply atau kirim video dengan caption ${m.prefix}hdvid untuk meningkatkan kualitasnya.`
    );
  }

  await m.react("🕐");

  const productSerial = crypto.randomUUID().replace(/-/g, "");

  try {
    const buffer =
      typeof target.download === "function"
        ? await target.download()
        : await m.resolveMediaTarget?.();

    if (!buffer || !buffer.length) {
      throw new Error("Gagal mengambil video, coba lagi.");
    }

    const uploadForm = new FormData();
    uploadForm.append("video_file_name", `hd-${Date.now()}.mp4`);

    const uploadResp = await axios.post(
      `${BASE_API}/api/upscaler/v1/ai-video-enhancer/upload-video`,
      uploadForm,
      { headers: uploadForm.getHeaders(), timeout: 20000 }
    );

    if (uploadResp.data?.code !== 100000) {
      throw new Error("Gagal mendapatkan upload URL.");
    }

    const { url: uploadUrl, object_name } = uploadResp.data.result;

    await axios.put(uploadUrl, buffer, {
      headers: { "content-type": "video/mp4" },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 0,
    });

    const cdnUrl = `https://cdn.unblurimage.ai/${object_name}`;

    const jobForm = new FormData();
    jobForm.append("original_video_file", cdnUrl);
    jobForm.append("resolution", "2k");
    jobForm.append("is_preview", "false");

    const jobResp = await axios.post(
      `${BASE_API}/api/upscaler/v2/ai-video-enhancer/create-job`,
      jobForm,
      { headers: { ...jobForm.getHeaders(), "product-serial": productSerial } }
    );

    if (jobResp.data?.code !== 100000) {
      throw new Error("Gagal membuat job HD.");
    }

    const jobId = jobResp.data.result.job_id;
    const start = Date.now();
    let outputUrl = null;

    while (!outputUrl) {
      if (Date.now() - start > 4 * 60 * 1000) {
        throw new Error("Timeout memproses HD video.");
      }

      const statusResp = await axios.get(
        `${BASE_API}/api/upscaler/v2/ai-video-enhancer/get-job/${jobId}`,
        { headers: { "product-serial": productSerial } }
      );

      if (statusResp.data?.result?.output_url) {
        outputUrl = statusResp.data.result.output_url;
        break;
      }

      await sleep(4000);
    }

    await sock.sendMessage(
      m.chat,
      {
        document: { url: outputUrl },
        mimetype: "video/mp4",
        fileName: "HDVIDEO.mp4",
        caption: "✅ Berhasil meningkatkan kualitas video.",
      },
      { quoted: m }
    );

    await m.react("✅");
  } catch (error) {
    console.error("[HDVID]", error);
    await m.react("❌");
    await m.reply(`❌ Gagal memproses HD video.\n> ${error?.message || "Unknown error"}`);
  }
}

export default { config, handler };
