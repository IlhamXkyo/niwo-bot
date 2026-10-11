import axios from "axios";
import { prepareWAMessageMedia, generateWAMessageFromContent } from "@itsliaaa/baileys";
import { getDatabase } from "../../src/lib/database.js";

const API_CATEGORIES={
  waifu:{endpoint:"waifu",emoji:"🌸",label:"Waifu Anime"},
  neko:{endpoint:"neko",emoji:"🐱",label:"Neko Anime"},
  hug:{endpoint:"hug",emoji:"🤗",label:"Hug Anime"},
  pat:{endpoint:"pat",emoji:"🫳",label:"Pat Anime"},
  smile:{endpoint:"smile",emoji:"😊",label:"Smile Anime"},
  wave:{endpoint:"wave",emoji:"👋",label:"Wave Anime"},
  dance:{endpoint:"dance",emoji:"💃",label:"Dance Anime"},
  cry:{endpoint:"cry",emoji:"😢",label:"Cry Anime"},
  happy:{endpoint:"happy",emoji:"😆",label:"Happy Anime"},
  blush:{endpoint:"blush",emoji:"☺️",label:"Blush Anime"}
};

const ALL_COMMANDS=[
  ...Object.keys(API_CATEGORIES),
  "anime",
  "animemenu",
  "animeon",
  "animeoff"
];

const config={
  name:ALL_COMMANDS,
  alias:["animepic","animeimg"],
  category:"anime",
  description:"Koleksi gambar anime SFW dari berbagai kategori",
  usage:".anime atau .<kategori>",
  example:".anime waifu",
  isOwner:false,
  isPremium:false,
  isGroup:false,
  isPrivate:false,
  cooldown:5,
  energi:1,
  isEnabled:true
};

async function fetchAnime(endpoint){
  const res=await axios.get(`https://api.waifu.pics/sfw/${endpoint}`,{timeout:15000});
  if(!res.data?.url)throw new Error("Gambar tidak ditemukan");
  const img=await axios.get(res.data.url,{responseType:"arraybuffer",timeout:30000});
  return Buffer.from(img.data);
}

function buildCategoryList(prefix){
  let text=`🌸 *ANIME MENU*\n\n`;
  text+=`Kumpulan gambar anime SFW dari berbagai kategori.\n\n`;
  text+=`*📂 KATEGORI TERSEDIA:*\n\n`;
  for(const [cmd,info] of Object.entries(API_CATEGORIES)){
    text+=`- ${info.emoji} *${prefix}${cmd}* : ${info.label}\n`;
  }
  text+=`\n*⚙️ PENGATURAN GRUP:*\n`;
  text+=`- *${prefix}animeon* : Aktifkan fitur anime di grup\n`;
  text+=`- *${prefix}animeoff* : Nonaktifkan fitur anime di grup\n`;
  return text;
}

function isAnimeAllowed(m,db){
  if(!m.isGroup)return true;
  const groupData=db.getGroup(m.chat)||{};
  return groupData.anime===true;
}

async function sendAnimeImage(m,sock,category){
  await m.react("🕕");
  try{
    const info=API_CATEGORIES[category];
    if(!info)return m.reply(`❌ Kategori *${category}* tidak ditemukan.`);
    const buffer=await fetchAnime(info.endpoint);

    const media=await prepareWAMessageMedia(
      {image:buffer},
      {upload:sock.waUploadToServer}
    );

    const msg=generateWAMessageFromContent(
      m.chat,
      {
        viewOnceMessage:{
          message:{
            messageContextInfo:{
              deviceListMetadata:{},
              deviceListMetadataVersion:2
            },
            interactiveMessage:{
              body:{
                text:`${info.emoji} *${info.label.toUpperCase()}*`
              },
              footer:{
                text:"🌸 Anime SFW • Niwo Bot"
              },
              header:{
                hasMediaAttachment:true,
                imageMessage:media.imageMessage
              },
              nativeFlowMessage:{
                buttons:[
                  {
                    name:"quick_reply",
                    buttonParamsJson:JSON.stringify({
                      display_text:`${info.emoji} Lanjut Lagi`,
                      id:`${m.prefix}${category}`
                    })
                  },
                  {
                    name:"quick_reply",
                    buttonParamsJson:JSON.stringify({
                      display_text:"📂 Semua Kategori",
                      id:`${m.prefix}anime`
                    })
                  }
                ]
              }
            }
          }
        }
      },
      {quoted:m}
    );

    await sock.relayMessage(
      m.chat,
      msg.message,
      {messageId:msg.key.id}
    );

    await m.react("✅");
  }catch(err){
    console.error("[anime]",err);
    await m.react("❌");
    await m.reply(
      `❌ *GAGAL MENGAMBIL GAMBAR ANIME*\n\n${err.message||"Terjadi kesalahan saat mengambil gambar."}`
    );
  }
}

async function handler(m,{sock}){
  const db=getDatabase();
  const cmd=String(m.command||"").toLowerCase();

  if(cmd==="animeon"){
    if(!m.isGroup)return m.reply(
      `❌ *PERINTAH GRUP SAJA*\n\nFitur anime bisa digunakan langsung di chat pribadi.`
    );

    if(!m.isAdmin&&!m.isOwner)return m.reply(
      `❌ *AKSES DITOLAK*\n\nHanya admin grup yang dapat mengaktifkan fitur ini.`
    );

    const groupData=db.getGroup(m.chat)||{};
    groupData.anime=true;
    db.setGroup(m.chat,groupData);

    return m.reply(
      `✅ *ANIME DIAKTIFKAN*\n\n`+
      `Fitur anime berhasil diaktifkan di grup ini.\n\n`+
      `Ketik *${m.prefix}anime* untuk melihat kategori.`
    );
  }

  if(cmd==="animeoff"){
    if(!m.isGroup)return m.reply(
      `❌ *PERINTAH GRUP SAJA*\n\nDi chat pribadi fitur anime selalu tersedia.`
    );

    if(!m.isAdmin&&!m.isOwner)return m.reply(
      `❌ *AKSES DITOLAK*\n\nHanya admin grup yang dapat menonaktifkan fitur ini.`
    );

    const groupData=db.getGroup(m.chat)||{};
    groupData.anime=false;
    db.setGroup(m.chat,groupData);

    return m.reply(
      `✅ *ANIME DINONAKTIFKAN*\n\n`+
      `Fitur anime berhasil dinonaktifkan di grup ini.`
    );
  }

  if(!isAnimeAllowed(m,db)){
    return m.reply(
      `🔒 *FITUR ANIME BELUM AKTIF*\n\n`+
      `Minta admin grup mengaktifkannya dengan:\n`+
      `*${m.prefix}animeon*`
    );
  }

  if(cmd==="anime"||cmd==="animemenu"){
    const sub=m.args?.[0]?.toLowerCase();

    if(sub&&API_CATEGORIES[sub]){
      return sendAnimeImage(m,sock,sub);
    }

    return m.reply(buildCategoryList(m.prefix));
  }

  if(API_CATEGORIES[cmd]){
    return sendAnimeImage(m,sock,cmd);
  }

  return m.reply(buildCategoryList(m.prefix));
}

export default {config,handler};