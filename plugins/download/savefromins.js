import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

const config = {
  name:"savefromins",
  alias:["savefrom","sfins","instagramdl","igdl"],
  category:"downloader",
  description:"Download media menggunakan SaveFromINS",
  usage:".savefromins <url>",
  example:".savefromins https://www.instagram.com/...",
  cooldown:10,
  energi:1
};

const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

const FALLBACK_CONFIG={
  auth:"20250901majwlqo",
  domain:"api-ak.savefromins.com",
  reqUrl:"https://api.savefromins.com/api/contentsite_api"
};

async function fetchText(url,ms=15000){
  const res=await fetch(url,{
    headers:{
      "User-Agent":UA,
      Accept:"*/*"
    },
    signal:AbortSignal.timeout(ms)
  });
  if(!res.ok)throw new Error("HTTP "+res.status+" "+url);
  return res.text();
}

function pickConfig(jsList){
  let auth,domain,reqUrl;
  for(const js of jsList){
    if(!auth){
      const m=js.match(/auth:"([^"]+)"/);
      if(m&&js.includes("media/parse"))auth=m[1];
    }
    if(!domain){
      const m=js.match(/VIDEODOWNLOAD:"([^"]+)"/);
      if(m)domain=m[1];
    }
    if(!reqUrl){
      const m=js.match(/REQ_URL:"([^"]+)"/);
      if(m)reqUrl=m[1];
    }
  }
  return{auth,domain,reqUrl};
}

async function getSessionConfig(){
  try{
    const html=await fetchText("https://savefromins/");
    const chunks=[
      ...html.matchAll(/src="([^"]*_next\/static\/chunks\/[^"]+\.js)"/g)
    ].map(m=>
      m[1].startsWith("http")
        ? m[1]
        : "https://savefromins.com"+m[1]
    );

    let jsList=(await Promise.allSettled(
      [...new Set(chunks)].map(u=>fetchText(u))
    )).map(r=>
      r.status==="fulfilled"?r.value:""
    );

    let cfg=pickConfig(jsList);

    if(!cfg.auth||!cfg.domain||!cfg.reqUrl){
      await new Promise(r=>setTimeout(r,1000));

      jsList=(await Promise.allSettled(
        [...new Set(chunks)].map(u=>fetchText(u,20000))
      )).map(r=>
        r.status==="fulfilled"?r.value:""
      );

      cfg=pickConfig(jsList);
    }

    if(!cfg.auth||!cfg.domain||!cfg.reqUrl){
      console.error(
        "DEBUG: config scrape tidak lengkap, pakai FALLBACK_CONFIG"
      );
    }

    return{
      auth:cfg.auth||FALLBACK_CONFIG.auth,
      domain:cfg.domain||FALLBACK_CONFIG.domain,
      reqUrl:cfg.reqUrl||FALLBACK_CONFIG.reqUrl
    };
  }catch(err){
    console.error(
      "DEBUG: config scrape gagal ("+
      err.message+
      "), pakai FALLBACK_CONFIG"
    );

    return FALLBACK_CONFIG;
  }
}

function collectResources(data){
  if(
    Array.isArray(data.resources)&&
    data.resources.length
  ){
    return data.resources;
  }

  const out=[];

  for(const m of data.media||[]){
    if(
      Array.isArray(m.resources)&&
      m.resources.length
    ){
      out.push(m.resources[0]);
    }
  }

  return out;
}

async function run(link){
  if(!/^https?:\/\//i.test(link||"")){
    return{
      status:false,
      code:400,
      input:link??null,
      result:null
    };
  }

  try{
    const cfg=await getSessionConfig();

    const body=new URLSearchParams({
      auth:cfg.auth,
      domain:cfg.domain,
      origin:"source",
      link
    }).toString();

    const res=await fetch(
      cfg.reqUrl+"/media/parse",
      {
        method:"POST",
        headers:{
          "Content-Type":
            "application/x-www-form-urlencoded",
          "User-Agent":UA,
          Origin:"https://savefromins.com",
          Referer:"https://savefromins.com/",
          Accept:"*/*"
        },
        body,
        signal:AbortSignal.timeout(45000)
      }
    );

    const payload=await res.json();

    if(
      payload?.status!==1||
      !payload?.data
    ){
      return{
        status:false,
        code:res.status,
        input:link,
        result:null
      };
    }

    const resources=
      collectResources(payload.data);

    if(!resources.length){
      return{
        status:false,
        code:200,
        input:link,
        result:null
      };
    }

    const d=payload.data;

    return{
      status:true,
      code:200,
      input:link,
      result:{
        title:d.title??"",
        thumbnail:d.thumbnail??"",
        duration:d.duration??0,
        links:resources.map(r=>({
          type:r.type??"",
          quality:r.quality??"",
          format:r.format??"",
          url:
            r.download_url||
            r.preview_url||
            ""
        })),
        comments:
          d.comment_items?.items??[]
      }
    };
  }catch(err){
    console.error(
      "DEBUG:",
      err.message,
      err.cause?.code??""
    );

    return{
      status:false,
      code:500,
      input:link,
      result:null
    };
  }
}

function getText(m){
  return String(
    m?.text||
    m?.body||
    m?.message?.conversation||
    m?.message?.extendedTextMessage?.text||
    ""
  ).trim();
}

function getUrl(m){
  const text=getText(m);

  const match=text.match(
    /https?:\/\/[^\s]+/i
  );

  return match
    ? match[0].replace(/[)>.,]+$/,"")
    : "";
}

function formatDuration(seconds){
  const n=Number(seconds)||0;

  if(!n)return"-";

  const h=Math.floor(n/3600);
  const m=Math.floor((n%3600)/60);
  const s=Math.floor(n%60);

  if(h>0){
    return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }

  return `${m}:${String(s).padStart(2,"0")}`;
}

async function handler(m,{sock}={}){
  const url=getUrl(m);

  if(!url){
    return m.reply(
      `❌ *URL tidak ditemukan.*\n\n`+
      `Contoh:\n`+
      `.savefromins https://www.instagram.com/...`
    );
  }

  await m.react?.("⏳");

  try{
    const data=await run(url);

    if(
      !data?.status||
      !data?.result?.links?.length
    ){
      await m.react?.("❌");

      return m.reply(
        `❌ *Gagal mengambil media.*\n\n`+
        `Link tidak dapat diproses oleh SaveFromINS.`
      );
    }

    const result=data.result;
    const links=result.links;

    const caption=
      `*SAVEFROMINS DOWNLOADER*\n\n`+
      `> *Judul:* ${result.title||"-"}\n`+
      `> *Durasi:* ${formatDuration(result.duration)}\n`+
      `> *Media:* ${links.length}\n\n`+
      `> *Source:* SaveFromINS`;

    await m.react?.("📥");

    for(let i=0;i<links.length;i++){
      const item=links[i];

      if(!item.url)continue;

      const mediaCaption=
        `${caption}\n\n`+
        (links.length>1
          ? `> *Media:* ${i+1}/${links.length}\n`
          :"")+
        `> *Type:* ${item.type||"-"}\n`+
        `> *Quality:* ${item.quality||"-"}\n`+
        `> *Format:* ${item.format||"-"}`;

      try{
        if(
          /video|mp4/i.test(
            `${item.type} ${item.format}`
          )
        ){
          await sock.sendMessage(
            m.chat,
            {
              video:{url:item.url},
              caption:mediaCaption,
              mimetype:"video/mp4"
            },
            {quoted:m}
          );
        }else{
          await sock.sendMessage(
            m.chat,
            {
              image:{url:item.url},
              caption:mediaCaption
            },
            {quoted:m}
          );
        }
      }catch(err){
        console.error(
          "[SAVEFROMINS SEND]",
          err?.stack||err
        );

        await m.reply(
          `⚠️ *Media ${i+1} gagal dikirim.*\n\n`+
          item.url
        );
      }

      if(i<links.length-1){
        await new Promise(r=>setTimeout(r,800));
      }
    }

    await m.react?.("✅");
  }catch(err){
    console.error(
      "[SAVEFROMINS]",
      err?.stack||err
    );

    await m.react?.("❌");

    return m.reply(
      `❌ *Terjadi kesalahan saat download.*\n\n`+
      `${err?.message||"Unknown error"}`
    );
  }
}

export{run};

export default{
  config,
  handler
};