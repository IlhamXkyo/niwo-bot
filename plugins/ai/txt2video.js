import axios from "axios";

const config={
  name:"txt2video",
  alias:["text2video"],
  category:"ai",
  description:"Generate video dari teks menggunakan AI",
  usage:".txt2video <prompt>",
  isOwner:false,
  isPremium:false,
  isGroup:false,
  isPrivate:false,
  cooldown:5,
  energi:0,
  limit:true,
  isEnabled:true
};

function getText(m,ctx={}){
  if(Array.isArray(ctx.args)&&ctx.args.length)return ctx.args.join(" ").trim();
  if(Array.isArray(m?.args)&&m.args.length)return m.args.join(" ").trim();

  return String(
    ctx.text||
    m?.text||
    m?.body||
    m?.message?.conversation||
    m?.message?.extendedTextMessage?.text||
    ""
  ).trim();
}

async function handler(m,ctx={}){
  const text=getText(m,ctx);
  const prefix=ctx.usedPrefix||ctx.prefix||".";
  const command=ctx.command||config.name;

  if(!text){
    return m.reply(
      `❌ Prompt belum diisi\n\n`+
      `Contoh:\n${prefix}${command} kucing lagi makan`
    );
  }

  await m.reply("⏳ Sedang generate video, mohon tunggu...");

  try{
    const apiUrl=
      `https://api.omegatech.app/api/ai/Txt2video`+
      `?action=generate`+
      `&prompt=${encodeURIComponent(text)}`+
      `&ratio=auto`+
      `&sound=true`;

    const {data}=await axios.get(apiUrl,{
      timeout:180000,
      headers:{
        Accept:"application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    if(!data?.success||!data?.data?.videoUrl){
      return m.reply(
        "❌ Gagal generate video, API tidak mengembalikan hasil."
      );
    }

    const res=data.data;

    const caption=
      `🎬 *AI TEXT TO VIDEO*\n\n`+
      `📝 *Prompt :* ${res.prompt||text}\n`+
      `📐 *Ratio :* ${res.ratio||"auto"}\n`+
      `🔊 *Sound :* ${res.sound?"Ya":"Tidak"}\n`+
      `📡 *Source :* ${data.source||"Omegatech"}`;

    const sock=ctx.sock||ctx.conn;

    if(!sock){
      throw new Error("Socket WhatsApp tidak tersedia.");
    }

    await sock.sendMessage(
      m.chat,
      {
        video:{url:res.videoUrl},
        caption,
        mimetype:"video/mp4"
      },
      {quoted:m}
    );

  }catch(e){
    console.error(
      "TXT2VIDEO ERROR:",
      e.response?.data||e.message||e
    );

    let errorMessage=
      e.response?.data?.message||
      e.message||
      "Terjadi kesalahan tidak diketahui";

    if(
      e.code==="ECONNABORTED"||
      e.code==="ETIMEDOUT"
    ){
      errorMessage=
        "Request API timeout, video generation butuh waktu lama. Coba lagi.";
    }

    return m.reply(
      `❌ *TXT2VIDEO GAGAL*\n\n${errorMessage}`
    );
  }
}

export default{
  config,
  handler
};