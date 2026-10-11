import { generateWAMessageFromContent } from "@itsliaaa/baileys";
import axios from "axios";

const config={
  name:"yts",
  alias:["youtubesearch","ytsearch","ysearch"],
  category:"tools",
  description:"Mencari video di YouTube",
  usage:".yts <pencarian>",
  example:".yts lagu terbaru",
  cooldown:5,
  energi:1
};

function formatNumber(num){
  const suffixes=["","k","M","B","T"];
  const n=Number(num)||0;
  const numString=Math.abs(Math.trunc(n)).toString();
  const numDigits=numString.length;
  if(numDigits<=3)return numString;
  const suffixIndex=Math.floor((numDigits-1)/3);
  let formattedNum=(n/Math.pow(1000,suffixIndex)).toFixed(1);
  if(formattedNum.endsWith(".0"))formattedNum=formattedNum.slice(0,-2);
  return formattedNum+(suffixes[suffixIndex]||"");
}

function getText(value){
  if(!value)return "";
  if(typeof value==="string")return value;
  if(value.simpleText)return value.simpleText;
  if(Array.isArray(value.runs))return value.runs.map(v=>v.text||"").join("");
  return "";
}

function getVideoThumbnail(video){
  const thumbs=video?.thumbnail?.thumbnails;
  if(!Array.isArray(thumbs)||!thumbs.length)return "";
  return thumbs[thumbs.length-1]?.url||thumbs[0]?.url||"";
}

function parseViewCount(value){
  const text=getText(value);
  if(!text)return 0;
  const clean=text.replace(/,/g,"");
  const match=clean.match(/[\d.]+/);
  if(!match)return 0;
  const n=parseFloat(match[0]);
  if(/K/i.test(clean))return Math.round(n*1000);
  if(/M/i.test(clean))return Math.round(n*1000000);
  if(/B/i.test(clean))return Math.round(n*1000000000);
  return Math.round(n);
}

function findVideoRenderers(data){
  const results=[];

  function walk(obj){
    if(!obj||typeof obj!=="object")return;

    if(Array.isArray(obj)){
      for(const item of obj)walk(item);
      return;
    }

    if(obj.videoRenderer?.videoId){
      results.push(obj.videoRenderer);
    }

    for(const key of Object.keys(obj)){
      if(key==="videoRenderer")continue;
      walk(obj[key]);
    }
  }

  walk(data);

  const seen=new Set();

  return results.filter(v=>{
    if(seen.has(v.videoId))return false;
    seen.add(v.videoId);
    return true;
  });
}

function extractInitialData(html){
  const markers=[
    "var ytInitialData = ",
    "var ytInitialData=",
    'window["ytInitialData"] = ',
    'window["ytInitialData"]='
  ];

  let start=-1;

  for(const marker of markers){
    start=html.indexOf(marker);
    if(start!==-1){
      start+=marker.length;
      break;
    }
  }

  if(start===-1){
    const pos=html.indexOf("ytInitialData");
    if(pos===-1)throw new Error("Data YouTube tidak ditemukan");
    start=html.indexOf("{",pos);
    if(start===-1)throw new Error("JSON YouTube tidak ditemukan");
  }

  while(start<html.length&&/\s/.test(html[start]))start++;

  if(html[start]!=="{"){
    start=html.indexOf("{",start);
    if(start===-1)throw new Error("JSON YouTube tidak ditemukan");
  }

  let depth=0;
  let inString=false;
  let escaped=false;

  for(let i=start;i<html.length;i++){
    const char=html[i];

    if(inString){
      if(escaped)escaped=false;
      else if(char==="\\")escaped=true;
      else if(char==='"')inString=false;
      continue;
    }

    if(char==='"'){
      inString=true;
      continue;
    }

    if(char==="{"){
      depth++;
    }else if(char==="}"){
      depth--;
      if(depth===0){
        return JSON.parse(html.slice(start,i+1));
      }
    }
  }

  throw new Error("JSON YouTube tidak lengkap");
}

async function searchYoutube(query){
  const url=`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  const res=await axios.get(url,{
    timeout:30000,
    responseType:"text",
    headers:{
      "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept-Language":"id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
    }
  });

  const data=extractInitialData(res.data);
  const videos=findVideoRenderers(data);

  return videos.map(v=>{
    const videoId=v.videoId;
    const title=getText(v.title)||"-";
    const description=
      getText(v.detailedMetadataSnippets?.[0]?.snippetText)||
      getText(v.descriptionSnippet)||"-";
    const thumbnail=getVideoThumbnail(v);
    const duration=getText(v.lengthText)||"-";
    const views=parseViewCount(v.viewCountText);
    const published=getText(v.publishedTimeText)||"-";

    const author=v.ownerText?.runs?.[0];

    const authorName=author?.text||"-";

    const authorUrl=author?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url
      ? `https://www.youtube.com${author.navigationEndpoint.commandMetadata.webCommandMetadata.url}`
      : "-";

    return {
      type:"video",
      videoId,
      url:`https://www.youtube.com/watch?v=${videoId}`,
      title,
      description,
      image:thumbnail,
      thumbnail,
      seconds:0,
      timestamp:duration,
      duration:{
        timestamp:duration,
        seconds:0
      },
      ago:published,
      views,
      author:{
        name:authorName,
        url:authorUrl
      }
    };
  });
}

async function downloadThumbnail(url){
  if(!url)return null;

  try{
    const res=await axios.get(url,{
      responseType:"arraybuffer",
      timeout:30000,
      headers:{
        "User-Agent":"Mozilla/5.0"
      }
    });

    return Buffer.from(res.data);
  }catch{
    return null;
  }
}

async function handler(m,{sock}){
  const text=String(m.text||m.body||"").trim();

  if(!text){
    return m.reply("✳️ Masukkan apa yang ingin dicari di YouTube.");
  }

  try{
    await m.react("🔎").catch(()=>{});

    const results=await searchYoutube(text);

    if(!results.length){
      await m.react("❌").catch(()=>{});
      return m.reply(`❌ Pencarian "${text}" tidak ditemukan.`);
    }

    const tes=results.slice(0,10);

    const teks=tes.map(v=>`
📹 *Type:* ${v.type}
🆔 *VideoId:* ${v.videoId}
🔗 *URL:* ${v.url}
📺 *Title:* ${v.title}
📝 *Description:* ${v.description||"-"}
🖼️ *Image:* ${v.image||"-"}
🖼️ *Thumbnail:* ${v.thumbnail||"-"}
⏱️ *Seconds:* ${v.seconds||0}
⏰ *Timestamp:* ${v.timestamp||"-"}
⏲️ *Duration Timestamp:* ${v.duration?.timestamp||"-"}
⌛ *Duration Seconds:* ${v.duration?.seconds||0}
⌚ *Ago:* ${v.ago||"-"}
👀 *Views:* ${formatNumber(v.views)}
👤 *Author Name:* ${v.author?.name||"-"}
🔗 *Author URL:* ${v.author?.url||"-"}
`.trim()).join("\n\n________________________\n\n");

    const ytthumb=tes[0]?.thumbnail
      ? await downloadThumbnail(tes[0].thumbnail)
      : null;

    const content={
      extendedTextMessage:{
        text:teks,
        contextInfo:{
          mentionedJid:[m.sender],
          ...(ytthumb?{
            externalAdReply:{
              title:"YouTube Search",
              body:`Hasil pencarian: ${text}`,
              thumbnail:ytthumb,
              mediaType:1,
              renderLargerThumbnail:true,
              showAdAttribution:false,
              sourceUrl:tes[0]?.url||""
            }
          }:{})
        }
      }
    };

    const msg=await generateWAMessageFromContent(
      m.chat,
      content,
      {quoted:m}
    );

    await sock.relayMessage(
      m.chat,
      msg.message,
      {messageId:msg.key.id}
    );

    await m.react("✅").catch(()=>{});
  }catch(e){
    console.error("[YTS]",e);
    await m.react("❌").catch(()=>{});

    return m.reply(
      `❌ Gagal mencari YouTube.\n${e?.message||"Unknown error"}`
    );
  }
}

export default {config,handler};