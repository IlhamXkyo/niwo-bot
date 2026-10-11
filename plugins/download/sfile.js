import axios from "axios";

const config={
  name:"sfile",
  alias:["sfiledl","sfiledownload"],
  category:"downloader",
  description:"Search dan download file dari SFile",
  usage:".sfile <query/url>",
  example:".sfile minecraft|1",
  cooldown:10,
  energi:1
};

function decodeHtml(str=""){
  return String(str)
    .replace(/&amp;/g,"&")
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'")
    .replace(/&lt;/g,"<")
    .replace(/&gt;/g,">")
    .replace(/&#x2F;/gi,"/")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
}

function stripTags(str=""){
  return decodeHtml(
    String(str)
      .replace(/<br\s*\/?>/gi,"\n")
      .replace(/<[^>]*>/g," ")
      .replace(/\s+/g," ")
      .trim()
  );
}

async function search(query,page=1){
  const url=`https://sfile.mobi/search.php?q=${encodeURIComponent(query)}&page=${encodeURIComponent(page)}`;
  const res=await axios.get(url,{
    headers:{
      "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
    }
  });

  const html=String(res.data||"");
  const result=[];

  const blocks=html.match(/<div[^>]*class=["'][^"']*\blist\b[^"']*["'][^>]*>[\s\S]*?<\/div>/gi)||[];

  for(const block of blocks){
    const linkMatch=block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if(!linkMatch)continue;

    const link=decodeHtml(linkMatch[1]);
    const title=stripTags(linkMatch[2]);

    const text=stripTags(block);
    const sizeMatch=text.match(/\(([^()]+)\)/);

    result.push({
      title:title||"Unknown",
      size:sizeMatch?.[1]||"-",
      link
    });
  }

  return result;
}

async function download(url){
  const res=await axios.get(url,{
    headers:{
      "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
    }
  });

  let html=String(res.data||"");

  const filenameMatch=html.match(
    /<img[^>]+class=["'][^"']*\bintro\b[^"']*["'][^>]+alt=["']([^"']+)["']/i
  );

  const filename=decodeHtml(filenameMatch?.[1]||"file");

  const listMatch=html.match(
    /<div[^>]+class=["'][^"']*\blist\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  );

  let mimetype="-";

  if(listMatch){
    const text=stripTags(listMatch[1]);
    const mime=text.split(" - ")[1]?.split("\n")[0]?.trim();
    if(mime)mimetype=mime;
  }

  const dlMatch=html.match(
    /<a[^>]+id=["']download["'][^>]+href=["']([^"']+)["']/i
  );

  if(!dlMatch)throw new Error("Link download tidak ditemukan");

  const dl=decodeHtml(dlMatch[1]);

  const data=await axios.get(dl,{
    headers:{
      "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
    }
  });

  html=String(data.data||"");

  const scripts=[
    ...(html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi)||[])
  ].join("\n");

  const finalUrlRegex=/https:\\\/\\\/download\d+\.sfile\.mobi\\\/downloadfile\\\/\d+\\\/\d+\\\/[a-z0-9]+\\\/[^\s'"]+\.[a-z0-9]+(?:\?[^"']+)?/gi;

  const matches=scripts.match(finalUrlRegex);

  if(!matches?.length)throw new Error("Link file tidak ditemukan");

  const finalUrl=matches[0].replace(/\\\//g,"/");

  const upMatch=html.match(
    /Upload(?:ed)?\s*(?:at|date)?\s*:\s*([^<\n]+)/i
  );

  const uploaderMatch=html.match(
    /<div[^>]+class=["'][^"']*\blist\b[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i
  );

  return{
    filename,
    mimetype,
    upload_date:upMatch?.[1]?.trim()||"-",
    uploader:decodeHtml(uploaderMatch?.[1]?.trim()||"-"),
    total_download:"-",
    download:finalUrl
  };
}

async function handler(m,{sock}){
  const text=String(m.text||m.body||"").trim();

  if(!text){
    return m.reply(
      "❌ Masukkan query atau URL SFile.\n\n"+
      "Contoh:\n"+
      ".sfile minecraft\n"+
      ".sfile minecraft|2\n"+
      ".sfile https://sfile.mobi/xxxxx"
    );
  }

  try{
    if(/https:\/\/sfile\.mobi\//i.test(text)){
      await m.reply("⏳ Sedang mengambil file...");

      const res=await download(text);

      const info=[
        `*• Filename:* ${res.filename}`,
        `*• Mimetype:* ${res.mimetype}`,
        `*• Upload Date:* ${res.upload_date}`,
        `*• Uploader:* ${res.uploader}`,
        `*• Total Download:* ${res.total_download}`
      ].join("\n");

      await m.reply(info+"\n\n_Sending file..._");

      const file=await axios.get(res.download,{
        responseType:"arraybuffer",
        headers:{
          "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
        },
        timeout:120000,
        maxContentLength:Infinity,
        maxBodyLength:Infinity
      });

      const buffer=Buffer.from(file.data);

      return await sock.sendMessage(
        m.chat,
        {
          document:buffer,
          fileName:res.filename,
          mimetype:res.mimetype||"application/octet-stream"
        },
        {quoted:m}
      );
    }

    let [query,page]=text.split("|");
    query=String(query||"").trim();
    page=Math.max(1,parseInt(page)||1);

    if(!query){
      return m.reply("❌ Query tidak boleh kosong.");
    }

    await m.reply("🔎 Mencari file di SFile...");

    const res=await search(query,page);

    if(!res.length){
      return m.reply(`❌ Query "${query}" tidak ditemukan.`);
    }

    const result=res.map((v,i)=>
      `*${i+1}. ${v.title}*\n`+
      `• Size: ${v.size}\n`+
      `• Link: ${v.link}`
    ).join("\n\n");

    return m.reply(
      `🔎 *SFILE SEARCH*\n\n${result}\n\n`+
      `Page: ${page}\n\n`+
      `Gunakan link di atas untuk download.`
    );

  }catch(e){
    console.error("[SFILE]",e?.response?.data||e);

    return m.reply(
      "❌ Gagal memproses SFile.\n"+
      `Detail: ${e?.message||"Unknown error"}`
    );
  }
}

export default {config,handler};