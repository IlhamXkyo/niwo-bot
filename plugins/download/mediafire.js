const mediaRegex=/^https?:\/\/(?:www\.)?mediafire\.com\/(?:file|folder)\/([\w-]+)/i;

const config={
  name:"mediafire",
  alias:["mf"],
  category:"downloader",
  description:"Download file dari MediaFire",
  usage:".mediafire <link>",
  isOwner:false,
  isPremium:false,
  isGroup:false,
  isPrivate:false,
  cooldown:3,
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

function formatBytes(bytes,decimals=2){
  if(!bytes)return"0 Bytes";

  const k=1024;
  const dm=decimals<0?0:decimals;
  const sizes=["Bytes","KB","MB","GB","TB"];
  const i=Math.floor(Math.log(bytes)/Math.log(k));

  return `${parseFloat(
    (bytes/Math.pow(k,i)).toFixed(dm)
  )} ${sizes[i]}`;
}

function getMimeType(ext){
  const mime={
    apk:"application/vnd.android.package-archive",
    zip:"application/zip",
    rar:"application/vnd.rar",
    "7z":"application/x-7z-compressed",
    tar:"application/x-tar",
    gz:"application/gzip",
    pdf:"application/pdf",
    txt:"text/plain",
    json:"application/json",
    js:"text/javascript",
    html:"text/html",
    css:"text/css",
    mp3:"audio/mpeg",
    mp4:"video/mp4",
    mkv:"video/x-matroska",
    avi:"video/x-msvideo",
    jpg:"image/jpeg",
    jpeg:"image/jpeg",
    png:"image/png",
    gif:"image/gif",
    webp:"image/webp",
    doc:"application/msword",
    docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls:"application/vnd.ms-excel",
    xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  };

  return mime[ext]||"application/octet-stream";
}

function decodeHtml(value){
  return String(value)
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'")
    .replace(/&#x27;/gi,"'")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">");
}

function validDownloadUrl(url){
  if(!url)return false;

  try{
    const parsed=new URL(url);

    if(!/^https?:$/i.test(parsed.protocol))return false;
    if(url==="#"||url==="javascript:void(0)")return false;

    return true;
  }catch{
    return false;
  }
}

function extractDownloadLink(html){
  const patterns=[
    /data-scrambled-url=["']([^"']+)["']/i,
    /data-href=["'](https?:\/\/[^"']+)["']/i,
    /data-url=["'](https?:\/\/[^"']+)["']/i,
    /aria-label=["']Download file["'][^>]*href=["'](https?:\/\/[^"']+)["']/i,
    /id=["']downloadButton["'][^>]*href=["'](https?:\/\/[^"']+)["']/i,
    /href=["'](https?:\/\/download\d+\.mediafire\.com\/[^"']+)["'][^>]*id=["']downloadButton["']/i
  ];

  for(const regex of patterns){
    const match=html.match(regex);

    if(!match?.[1])continue;

    let url=decodeHtml(match[1]);

    if(validDownloadUrl(url)){
      if(!/^https?:\/\//i.test(url)){
        try{
          url=new URL(url,"https://www.mediafire.com").href;
        }catch{}
      }

      if(validDownloadUrl(url))return url;
    }
  }

  return null;
}

async function getFileInfo(id){
  const endpoints=[
    `https://www.mediafire.com/api/1.5/file/get_info.php?response_format=json&quick_key=${encodeURIComponent(id)}`,
    `https://www.mediafire.com/api/file/get_info.php?response_format=json&quick_key=${encodeURIComponent(id)}`
  ];

  let lastError=null;

  for(const endpoint of endpoints){
    try{
      const response=await fetch(endpoint,{
        headers:{
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
          "Accept":"application/json"
        }
      });

      if(!response.ok){
        lastError=new Error(`HTTP ${response.status}`);
        continue;
      }

      const json=await response.json();

      if(json?.response?.result==="Success"&&json?.response?.file_info){
        return json.response.file_info;
      }

      lastError=new Error(
        json?.response?.error||
        json?.response?.message||
        "MediaFire API gagal."
      );
    }catch(e){
      lastError=e;
    }
  }

  throw lastError||new Error("Gagal mengambil informasi file.");
}

async function getDirectLink(id){
  const endpoints=[
    `https://www.mediafire.com/api/1.5/file/get_links.php?response_format=json&quick_key=${encodeURIComponent(id)}`,
    `https://www.mediafire.com/api/file/get_links.php?response_format=json&quick_key=${encodeURIComponent(id)}`
  ];

  for(const endpoint of endpoints){
    try{
      const response=await fetch(endpoint,{
        headers:{
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
          "Accept":"application/json"
        }
      });

      if(!response.ok)continue;

      const json=await response.json();

      if(json?.response?.result!=="Success")continue;

      const data=json.response;

      const links=[];

      if(data?.links?.normal_download){
        links.push(data.links.normal_download);
      }

      if(Array.isArray(data?.links)){
        for(const item of data.links){
          if(item?.normal_download)links.push(item.normal_download);
          if(item?.url)links.push(item.url);
        }
      }

      if(data?.file_info?.links?.normal_download){
        links.push(data.file_info.links.normal_download);
      }

      for(const link of links){
        if(validDownloadUrl(link))return link;
      }
    }catch{}
  }

  return null;
}

async function mediafire(url){
  const match=mediaRegex.exec(url);

  if(!match){
    throw new Error("URL MediaFire tidak valid.");
  }

  const id=match[1];

  if(url.includes("/folder/")){
    throw new Error(
      "Link folder MediaFire belum didukung. Gunakan link file MediaFire."
    );
  }

  const info=await getFileInfo(id);

  let download=await getDirectLink(id);

  if(!download){
    const response=await fetch(url,{
      headers:{
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if(!response.ok){
      throw new Error(
        `Gagal membuka halaman MediaFire (${response.status}).`
      );
    }

    const html=await response.text();

    download=extractDownloadLink(html);
  }

  if(!download||!validDownloadUrl(download)){
    throw new Error(
      "Direct download MediaFire tidak ditemukan."
    );
  }

  const filename=info.filename||"file";

  const size=parseInt(info.size)||0;

  const ext=filename.includes(".")
    ?filename.split(".").pop().toLowerCase()
    :"";

  return{
    filename,
    ext,
    size,
    sizeReadable:formatBytes(size),
    download,
    filetype:info.filetype||ext||"unknown",
    mimetype:info.mimetype||getMimeType(ext),
    privacy:info.privacy||"Unknown",
    owner_name:info.owner_name||"Unknown"
  };
}

async function handler(m,ctx={}){
  const text=getText(m,ctx);
  const prefix=ctx.usedPrefix||ctx.prefix||".";
  const command=ctx.command||config.name;

  if(!text){
    return m.reply(
      `❌ Link MediaFire belum diberikan.\n\n`+
      `Contoh:\n${prefix}${command} https://www.mediafire.com/file/941xczxhn27qbby/GBWA_V12.25FF-By.SamMods-.apk/file`
    );
  }

  const url=text.split(/\s+/)[0];

  if(!mediaRegex.test(url)){
    return m.reply(
      "❌ Link tidak valid! Pastikan link MediaFire benar."
    );
  }

  try{
    await m.reply("⏳ Mengambil informasi file MediaFire...");

    const res=await mediafire(url);

    const caption=[
      `*💌 Nama:* ${res.filename}`,
      `*📊 Size:* ${res.sizeReadable}`,
      `*🗂️ FileType:* ${res.filetype}`,
      `*📦 MimeType:* ${res.mimetype}`,
      `*🔐 Privasi:* ${res.privacy}`,
      `*👤 Owner:* ${res.owner_name}`
    ].join("\n");

    await m.reply(caption);

    const sock=ctx.sock||ctx.conn;

    if(!sock){
      throw new Error("Socket WhatsApp tidak tersedia.");
    }

    if(!validDownloadUrl(res.download)){
      throw new Error(
        `Link download tidak valid: ${res.download}`
      );
    }

    await sock.sendMessage(
      m.chat,
      {
        document:{
          url:res.download
        },
        fileName:res.filename,
        mimetype:res.mimetype
      },
      {
        quoted:m
      }
    );

  }catch(e){
    console.error("[MEDIAFIRE]",e);

    return m.reply(
      "❌ Gagal mengambil file dari MediaFire.\n\n"+
      String(e?.message||e)
    );
  }
}

export default{
  config,
  handler
};