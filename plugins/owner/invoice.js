import { sendInvoice } from "../../src/lib/invoice.js";

const config = {
  name: "invoice",
  alias: [],
  category: "owner",
  description: "Contoh/demo tampilan invoice bot (buat dipanggil dari fitur lain seperti pembelian premium)",
  usage: ".invoice",
  example: ".invoice",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock, config: botConfig }) {
  const botName = botConfig?.botName || botConfig?.bot?.name || "Niwo Bot";

  await sendInvoice(
    sock,
    m.chat,
    {
      botName,
      invoiceId: `INV-${Date.now()}`,
      buyerName: m.pushName || "Member",
      status: "LUNAS",
      items: [
        { name: "Paket Premium 30 Hari", qty: 1, price: 25000 },
        { name: "Bonus Energi +500", qty: 1, price: 0 },
      ],
    },
    { quoted: m.raw || m },
  );
}

export default { config, handler };
