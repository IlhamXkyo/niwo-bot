import crypto from "node:crypto";

const config = {
  name: "slot",
  alias: ["fruitslot"],
  category: "game",
  description: "Game Fruit Slot 3x3 interaktif dalam AI Rich HTML",
  usage: ".slot",
  example: ".slot",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

export function buildSlotHTML() {
  return `<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}body{margin:0;background:#0a0a0f;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#eee;touch-action:manipulation}.wrap{width:100%;max-width:620px;margin:auto;padding:10px}.box{background:#12131c;border:1px solid #222536;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px #000}.head{padding:12px 16px;border-bottom:1px solid #222536;display:flex;justify-content:space-between;align-items:center;background:#181a26}.title{font-size:16px;font-weight:900;letter-spacing:1.5px;color:#f1c40f;text-shadow:0 0 10px #f1c40f80}.subtitle{font-size:8px;color:#e67e22;letter-spacing:1px;font-weight:bold}.right{display:flex;align-items:center;gap:12px}.sound{background:#222536;border:1px solid #f1c40f;border-radius:8px;padding:4px 8px;cursor:pointer}.label{font-size:8px;color:#a4b0be;font-weight:bold}.value{font-size:13px;font-weight:bold;color:#2ecc71}.content{padding:14px;background:#0c0d14}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:#050508;padding:10px;border-radius:12px;border:2px solid #222536}.cell{background:#181a26;border:2px solid #34495e;border-radius:10px;height:75px;display:flex;align-items:center;justify-content:center;font-size:36px;box-shadow:0 4px 8px #0008}.cell.win{border-color:#f1c40f;background:#2c3e50;animation:bounce .4s infinite alternate}@keyframes bounce{to{transform:scale(1.05)}}.bets{display:flex;align-items:center;justify-content:space-between;margin-top:14px;background:#181a26;padding:8px 12px;border-radius:10px}.bet-label{font-size:11px;font-weight:bold;color:#a4b0be}.buttons{display:flex;gap:6px}.bet-btn{background:#222536;border:1px solid #34495e;border-radius:6px;color:#fff;padding:6px 10px;font-size:11px;font-weight:bold;cursor:pointer}.bet-btn:active{background:#f1c40f;color:#000}.spin{width:100%;margin-top:12px;padding:14px;background:linear-gradient(#f1c40f,#e67e22);border:1px solid #f39c12;border-radius:10px;color:#000;font-size:16px;font-weight:900;letter-spacing:1px;cursor:pointer;box-shadow:0 4px 15px #f1c40f4d}.spin:active{transform:scale(.98)}#status{text-align:center;margin-top:10px;font-size:11px;color:#a4b0be;font-weight:bold}
</style><div class="wrap"><div class="box"><div class="head"><div><div class="title">FRUIT SLOT 🎰</div><div class="subtitle">CASINO MINI • 3X3 GRID</div></div><div class="right"><div><div class="label">SALDO</div><div class="value" id="balance">$10,000</div></div><div class="sound" id="btnSound">🔊</div></div></div><div class="content"><div class="grid"><div class="cell" id="b0">🍒</div><div class="cell" id="b1">🍋</div><div class="cell" id="b2">🍉</div><div class="cell" id="b3">🍇</div><div class="cell" id="b4">🔔</div><div class="cell" id="b5">🍎</div><div class="cell" id="b6">🍓</div><div class="cell" id="b7">💎</div><div class="cell" id="b8">7️⃣</div></div><div class="bets"><div class="bet-label">TARUHAN: <span id="betText" style="color:#f1c40f">$100</span></div><div class="buttons"><div class="bet-btn" id="minus">-50</div><div class="bet-btn" id="plus">+50</div><div class="bet-btn" id="max">MAX</div></div></div><button class="spin" id="btnSpin">🎰 PUTAR (SPIN)</button><div id="status">Atur Bet lalu tekan PUTAR!</div></div></div></div><script>
(function(){var FRUITS=['🍒','🍋','🍉','🍇','🔔','🍎','🍓','💎','7️⃣'],balance=10000,bet=100,spinning=false,sound=true,audioCtx=null;var balanceEl=document.getElementById('balance'),betEl=document.getElementById('betText'),statusEl=document.getElementById('status');function audio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}function tone(f,d,type,v){if(!sound)return;try{var a=audio(),o=a.createOscillator(),g=a.createGain();o.type=type||'sine';o.frequency.value=f;g.gain.setValueAtTime(v||.1,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+d);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+d+.05)}catch(e){}}function money(n){return '$'+n.toLocaleString()}function ui(){balanceEl.textContent=money(balance);betEl.textContent=money(bet)}function fruit(){return FRUITS[Math.floor(Math.random()*FRUITS.length)]}function clear(){for(var i=0;i<9;i++)document.getElementById('b'+i).classList.remove('win')}function checkWin(res){var lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]],win=0,boxes={};for(var i=0;i<lines.length;i++){var l=lines[i],a=res[l[0]];if(a===res[l[1]]&&a===res[l[2]]){var mul=a==='7️⃣'?20:a==='💎'?10:5;win+=bet*mul;boxes[l[0]]=boxes[l[1]]=boxes[l[2]]=true}}if(win){balance+=win;ui();Object.keys(boxes).forEach(function(i){document.getElementById('b'+i).classList.add('win')});tone(win>=bet*10?880:523,.25,'triangle',.2);statusEl.textContent=(win>=bet*10?'🔥 JACKPOT! ':'🎉 MENANG ')+money(win)}else statusEl.textContent='Belum beruntung, coba lagi!'}function startSpin(){if(spinning)return;if(balance<bet){statusEl.textContent='❌ Saldo tidak cukup!';return}spinning=true;balance-=bet;ui();clear();statusEl.textContent='Memutar slot...';var result=new Array(9);for(let i=0;i<9;i++){let timer=setInterval(function(){document.getElementById('b'+i).textContent=fruit();tone(400,.05,'square',.03)},60);setTimeout(function(){clearInterval(timer);result[i]=fruit();document.getElementById('b'+i).textContent=result[i];if(i===8){spinning=false;checkWin(result)}},600+i*120)}}document.getElementById('minus').onclick=function(){if(!spinning&&bet>50){bet-=50;ui()}};document.getElementById('plus').onclick=function(){if(!spinning&&bet+50<=balance){bet+=50;ui()}};document.getElementById('max').onclick=function(){if(!spinning){bet=Math.max(50,Math.min(balance,2000));ui()}};document.getElementById('btnSpin').onclick=startSpin;document.getElementById('btnSound').onclick=function(){sound=!sound;this.textContent=sound?'🔊':'🔇';this.style.borderColor=sound?'#f1c40f':'#e74c3c'};ui()})();
</script>`;
}

export function buildSlotMessage(html = buildSlotHTML()) {
  const data = Buffer.from(
    JSON.stringify({
      __typename: "GenAIUnifiedResponse",
      response_id: crypto.randomUUID(),
      sections: [{
        __typename: "GenAIUnifiedResponseSection",
        view_model: {
          __typename: "GenAISingleLayoutViewModel",
          primitive: {
            __typename: "GenAIaeacdsnwHtmlPrimitive",
            payload: html,
            trusted_sources: [],
          },
        },
      }],
    }),
  ).toString("base64");

  return {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        messageDisclaimerText: "",
        botResponseId: crypto.randomUUID(),
      },
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [{ messageType: 2, messageText: "FRUIT SLOT 🎰" }],
          unifiedResponse: { data },
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: { botJid: "0@bot" },
            forwardOrigin: 4,
          },
        },
      },
    },
  };
}

async function handler(m, { sock }) {
  try {
    await sock.relayMessage(m.chat, buildSlotMessage(), {});
  } catch (error) {
    console.error("[slot]", error);
    await m.reply(`❌ Gagal mengirim Fruit Slot.\n\n${error?.message || error}`);
  }
}

export { config, handler };
export default { config, handler };