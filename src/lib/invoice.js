/**
 * src/lib/invoice.js
 * Generator kartu invoice (gambar) buat dikirim bot : misal buat
 * konfirmasi pembelian fitur premium, top-up koin, dsb.
 *
 * SENGAJA dibikin sebagai gambar biasa + teks jelas siapa penerbitnya,
 * BUKAN pakai orderMessage yang nyamar jadi konfirmasi pembayaran resmi
 * WhatsApp (itu bisa disalahgunakan buat nipu orang).
 */

import sharp from "sharp";

function escapeXml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatRupiah(n) {
  return "Rp" + Number(n || 0).toLocaleString("id-ID");
}

/**
 * @param {object} data
 * @param {string} data.botName
 * @param {string} data.invoiceId
 * @param {string} [data.date] - default: sekarang
 * @param {string} data.buyerName
 * @param {{name: string, qty?: number, price: number}[]} data.items
 * @param {string} [data.status] - "LUNAS" | "MENUNGGU" | "DIBATALKAN"
 * @returns {Promise<Buffer>} JPEG buffer
 */
async function generateInvoiceImage(data) {
  const {
    botName = "Niwo Bot",
    invoiceId = `INV-${Date.now()}`,
    date = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
    buyerName = "-",
    items = [],
    status = "LUNAS",
  } = data;

  const total = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);

  const statusColor = { LUNAS: "#2ecc71", MENUNGGU: "#f39c12", DIBATALKAN: "#e74c3c" }[status] || "#7b5cff";

  const rowHeight = 56;
  const rowsStartY = 370;
  const rows = items
    .map((it, i) => {
      const y = rowsStartY + i * rowHeight;
      const qty = it.qty || 1;
      const lineTotal = (Number(it.price) || 0) * qty;
      return `
        <text x="70" y="${y}" font-family="Arial" font-size="26" fill="#2d2d3a">${escapeXml(it.name)}</text>
        <text x="600" y="${y}" font-family="Arial" font-size="26" fill="#6b6b80" text-anchor="middle">x${qty}</text>
        <text x="930" y="${y}" font-family="Arial" font-size="26" fill="#2d2d3a" text-anchor="end">${escapeXml(formatRupiah(lineTotal))}</text>
        <line x1="70" y1="${y + 20}" x2="930" y2="${y + 20}" stroke="#ececf3" stroke-width="1"/>
      `;
    })
    .join("");

  const height = rowsStartY + items.length * rowHeight + 160;

  const svg = `
  <svg width="1000" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="1000" height="${height}" fill="#ffffff"/>
    <rect width="1000" height="180" fill="#181824"/>

    <text x="70" y="75" font-family="Arial" font-weight="bold" font-size="40" fill="#ffffff">${escapeXml(botName)}</text>
    <text x="70" y="115" font-family="Arial" font-size="24" fill="#a9a3d6">Invoice / bukti transaksi bot</text>

    <rect x="800" y="45" width="130" height="46" rx="23" fill="${statusColor}"/>
    <text x="865" y="75" font-family="Arial" font-weight="bold" font-size="22" fill="#ffffff" text-anchor="middle">${escapeXml(status)}</text>

    <text x="70" y="230" font-family="Arial" font-size="24" fill="#6b6b80">No. Invoice</text>
    <text x="70" y="262" font-family="Arial" font-weight="bold" font-size="26" fill="#181824">${escapeXml(invoiceId)}</text>

    <text x="450" y="230" font-family="Arial" font-size="24" fill="#6b6b80">Tanggal</text>
    <text x="450" y="262" font-family="Arial" font-weight="bold" font-size="26" fill="#181824">${escapeXml(date)}</text>

    <text x="70" y="300" font-family="Arial" font-size="22" fill="#6b6b80">Atas nama: ${escapeXml(buyerName)}</text>

    <line x1="70" y1="316" x2="930" y2="316" stroke="#181824" stroke-width="2"/>

    ${rows}

    <line x1="70" y1="${rowsStartY + items.length * rowHeight + 10}" x2="930" y2="${rowsStartY + items.length * rowHeight + 10}" stroke="#181824" stroke-width="2"/>

    <text x="700" y="${rowsStartY + items.length * rowHeight + 60}" font-family="Arial" font-size="26" fill="#2d2d3a" text-anchor="end">TOTAL</text>
    <text x="930" y="${rowsStartY + items.length * rowHeight + 60}" font-family="Arial" font-weight="bold" font-size="32" fill="#181824" text-anchor="end">${escapeXml(formatRupiah(total))}</text>

    <text x="70" y="${height - 30}" font-family="Arial" font-size="18" fill="#a0a0b0">Invoice ini diterbitkan oleh bot "${escapeXml(botName)}", bukan tagihan resmi dari WhatsApp.</text>
  </svg>`;

  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

/** Generate lalu langsung kirim ke chat. */
async function sendInvoice(sock, jid, data, options = {}) {
  const buffer = await generateInvoiceImage(data);
  const total = (data.items || []).reduce(
    (s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1),
    0,
  );

  return sock.sendMessage(
    jid,
    {
      image: buffer,
      caption:
        options.caption ||
        `🧾 Invoice ${data.invoiceId || ""}\nTotal: ${formatRupiah(total)}\nStatus: ${data.status || "LUNAS"}`,
    },
    { quoted: options.quoted },
  );
}

export { generateInvoiceImage, sendInvoice };
