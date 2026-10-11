// plugins/dino.js
import { randomUUID } from 'crypto';

const pluginConfig = {
  name: "dino",
  alias: ['dinorun', 'trex'],
  category: "game",
  description: "Main game Dino Run (T-Rex Runner) seperti di Chrome",
  usage: ".dino",
  example: ".dino",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

const DINO_HTML = `
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none}
html,body{width:100%;min-height:100%;background:#0a0a1a}
body{background:radial-gradient(circle at 50% -10%,#1a2a4a 0%,#0a1225 42%,#030712 100%);padding:10px;display:flex;justify-content:center;min-height:100vh;overflow-y:auto}
#app{max-width:440px;width:100%;margin:0 auto}
.hdr{display:flex;justify-content:space-between;align-items:center;padding:4px 2px 10px;gap:6px}
.tt{font:900 15px 'Arial Black';color:#e9d79a;text-shadow:0 0 14px #e9d79a55;letter-spacing:0.5px;display:flex;align-items:center;gap:6px}
.tt small{display:block;font:700 6px Arial;letter-spacing:1.5px;color:#93a6c9;text-shadow:none;margin-top:-2px}
.hrs{display:flex;gap:4px;align-items:center}
.hr{background:rgba(0,0,0,.4);border:1px solid rgba(233,215,154,.2);border-radius:8px;padding:2px 7px;text-align:center;min-width:44px}
.hr i{display:block;font:700 5.5px Arial;font-style:normal;letter-spacing:0.5px;color:#93a6c9}
.hr b{font:900 11px 'Arial Black';color:#f5d67d;font-variant-numeric:tabular-nums}
.mbtn{width:32px;height:32px;border:2px solid rgba(233,215,154,.2);border-radius:8px;background:rgba(0,0,0,.4);color:#fff;font-size:13px;cursor:pointer;touch-action:none;display:flex;align-items:center;justify-content:center}
.mbtn:active{filter:brightness(1.5);transform:scale(.92)}
.gw{position:relative;border:2px solid rgba(233,215,154,.2);border-radius:14px;overflow:hidden;background:#0a0f1a;box-shadow:0 0 30px rgba(0,0,0,.6),inset 0 0 60px rgba(0,0,0,.3)}
canvas{width:100%;display:block;touch-action:none;image-rendering:pixelated}
.bar{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}
.pd{height:38px;border:2px solid rgba(255,255,255,.12);border-radius:11px;font:900 11px Arial;color:#fff;cursor:pointer;touch-action:none;box-shadow:0 3px 0 rgba(0,0,0,.5);background:linear-gradient(#2a3a5a,#152035)}
.pd:active{transform:translateY(2px);box-shadow:none;filter:brightness(1.3)}
#startB{background:linear-gradient(#4caf50,#2e7d32);color:#fff}
#resetB{background:linear-gradient(#f44336,#c62828);color:#fff}
.hint{text-align:center;font:600 8px Arial;color:#8fa3c8;margin-top:6px;line-height:1.4;padding:0 4px}
.credit{text-align:center;font:600 7px Arial;color:#4a5a7a;margin-top:6px;padding-bottom:2px}
</style>
<div id="app">
  <div class="hdr">
    <div class="tt">🦖<span>DINO RUN<small>CHROME STYLE</small></span></div>
    <div class="hrs">
      <div class="hr"><i>SCORE</i><b id="scoreEl">0</b></div>
      <div class="hr"><i>BEST</i><b id="bestEl">0</b></div>
      <button class="mbtn" id="muteB">🔊</button>
    </div>
  </div>
  <div class="gw"><canvas id="cv" width="400" height="220"></canvas></div>
  <div class="bar">
    <button class="pd" id="startB">▶ START</button>
    <button class="pd" id="resetB">⟳ RESET</button>
  </div>
  <div class="hint" id="hint">🦖 Tap / SPASI untuk lompat! Hindari rintangan!</div>
  <div class="credit">⚡ Valzz Dino Runner</div>
</div>
<script>
window.onerror=function(m,s,l){var e=document.getElementById('hint');if(e){e.textContent='⚠ '+m+' @'+l;e.style.color='#ff7a8a'}};
(function(){
var cv=document.getElementById('cv'),ctx=cv.getContext('2d');
var W=400,H=220,DPR=Math.min(2,window.devicePixelRatio||1);
cv.width=W*DPR;cv.height=H*DPR;

var scoreEl=document.getElementById('scoreEl');
var bestEl=document.getElementById('bestEl');
var hintEl=document.getElementById('hint');
var muted=false,AC=null;

function audio(){
  if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){return null}}
  try{if(AC.state==='suspended')AC.resume()}catch(e){}
  return AC;
}
function tone(f,d,type,v,delay){
  var a=audio();if(!a||muted)return;
  try{
    var t=a.currentTime+(delay||0),o=a.createOscillator(),g=a.createGain();
    o.type=type||'square';o.frequency.setValueAtTime(f,t);
    g.gain.setValueAtTime(v||.05,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+d+.02)
  }catch(e){}
}
function sJump(){tone(560,.05,'square',.05);tone(820,.07,'sine',.04,.03)}
function sDie(){tone(420,.08,'square',.07);tone(300,.1,'square',.05,.07);tone(180,.12,'square',.04,.14)}

document.getElementById('muteB').addEventListener('pointerdown',function(e){
  e.preventDefault();e.stopPropagation();audio();
  muted=!muted;this.textContent=muted?'🔇':'🔊';
});

var game={
  running:false,
  gameOver:false,
  score:0,
  best:0,
  speed:5,
  gravity:0.55,
  jumpPower:-11,
  groundY:185,
  dino:{
    x:45,
    y:155,
    w:28,
    h:30,
    vy:0,
    grounded:true,
    frame:0,
    blink:0,
    runCycle:0
  },
  obstacles:[],
  clouds:[],
  frame:0,
  spawnTimer:0,
  spawnInterval:55,
  groundOffset:0,
  particles:[]
};

try{
  var saved=localStorage.getItem('dino_best');
  if(saved) game.best=parseInt(saved)||0;
  bestEl.textContent=game.best;
}catch(e){}

function saveBest(){
  try{localStorage.setItem('dino_best',String(game.best))}catch(e){}
}

function resetGame(){
  game.running=false;
  game.gameOver=false;
  game.score=0;
  game.speed=5;
  game.dino.y=155;
  game.dino.vy=0;
  game.dino.grounded=true;
  game.dino.frame=0;
  game.dino.runCycle=0;
  game.obstacles=[];
  game.clouds=[];
  game.particles=[];
  game.spawnTimer=0;
  game.spawnInterval=55;
  game.groundOffset=0;
  game.frame=0;
  scoreEl.textContent='0';
  hintEl.textContent='🦖 Tap START / SPASI untuk mulai!';
  initClouds();
}

function initClouds(){
  game.clouds=[];
  for(var i=0;i<5;i++){
    game.clouds.push({
      x:50+Math.random()*300,
      y:8+Math.random()*40,
      w:35+Math.random()*35,
      speed:0.15+Math.random()*0.25,
      opacity:0.3+Math.random()*0.3
    });
  }
}

function startGame(){
  if(game.gameOver) resetGame();
  if(game.running) return;
  game.running=true;
  game.gameOver=false;
  game.score=0;
  game.speed=5;
  game.dino.y=155;
  game.dino.vy=0;
  game.dino.grounded=true;
  game.obstacles=[];
  game.particles=[];
  game.spawnTimer=0;
  game.spawnInterval=55;
  hintEl.textContent='🏃 Lari! Hindari rintangan!';
  scoreEl.textContent='0';
  initClouds();
}

function jump(){
  if(!game.running || game.gameOver) {
    if(game.gameOver){resetGame();startGame();return}
    startGame();
    return;
  }
  if(game.dino.grounded){
    game.dino.vy=game.jumpPower;
    game.dino.grounded=false;
    sJump();
    for(var i=0;i<6;i++){
      game.particles.push({
        x:game.dino.x+14,
        y:game.dino.y+game.dino.h,
        vx:(Math.random()-0.5)*2,
        vy:-Math.random()*3-1,
        life:1,
        size:2+Math.random()*3,
        color:'rgba(200,180,150,'
      });
    }
  }
}

function spawnObstacle(){
  var types=['cactus','cactus','cactus','bird','cactus'];
  var type=types[Math.floor(Math.random()*types.length)];
  var obs={
    x:W+30,
    type:type,
    passed:false,
    wobble:Math.random()*Math.PI*2
  };
  if(type==='cactus'){
    var h=22+Math.floor(Math.random()*4)*6;
    obs.h=h;
    obs.w=12+Math.random()*6;
    obs.y=game.groundY-h;
  }else{
    obs.w=28;
    obs.h=14;
    obs.y=game.groundY-30-Math.random()*20;
  }
  game.obstacles.push(obs);
}

function checkCollision(){
  var d=game.dino;
  for(var i=0;i<game.obstacles.length;i++){
    var o=game.obstacles[i];
    var padding=4;
    var dx=d.x+padding - (o.x+o.w/2);
    var dy=d.y+padding - (o.y+o.h/2);
    var dw=(d.w-padding*2)/2 + o.w/2;
    var dh=(d.h-padding*2)/2 + o.h/2;
    if(Math.abs(dx)<dw && Math.abs(dy)<dh){
      return true;
    }
  }
  return false;
}

function update(){
  if(!game.running || game.gameOver) return;
  game.frame++;
  
  if(game.frame%80===0 && game.speed<13){
    game.speed+=0.25;
    game.spawnInterval=Math.max(32,55-game.speed*2);
  }
  
  var d=game.dino;
  d.vy+=game.gravity;
  d.y+=d.vy;
  
  if(d.y>=game.groundY-d.h){
    d.y=game.groundY-d.h;
    d.vy=0;
    if(!d.grounded){
      d.grounded=true;
      for(var i=0;i<4;i++){
        game.particles.push({
          x:d.x+14,
          y:d.y+d.h,
          vx:(Math.random()-0.5)*1.5,
          vy:-Math.random()*2,
          life:0.8,
          size:2+Math.random()*2,
          color:'rgba(180,160,130,'
        });
      }
    }
    d.grounded=true;
  }else{
    d.grounded=false;
  }
  
  if(d.grounded && game.frame%4===0){
    d.runCycle=(d.runCycle+1)%6;
    d.frame=Math.floor(d.runCycle/2);
  }
  
  if(Math.random()<0.001) d.blink=8;
  if(d.blink>0) d.blink--;
  
  game.spawnTimer++;
  if(game.spawnTimer>=game.spawnInterval){
    game.spawnTimer=0;
    if(Math.random()<0.65) spawnObstacle();
  }
  
  for(var i=game.obstacles.length-1;i>=0;i--){
    var o=game.obstacles[i];
    o.x-=game.speed;
    if(o.type==='bird'){
      o.wobble+=0.05;
      o.y+=Math.sin(o.wobble)*0.3;
    }
    if(o.x+o.w<-20){
      game.obstacles.splice(i,1);
      continue;
    }
    if(!o.passed && o.x+o.w<d.x){
      o.passed=true;
      game.score+=10;
      scoreEl.textContent=game.score;
      if(game.score>game.best){
        game.best=game.score;
        bestEl.textContent=game.best;
        saveBest();
      }
    }
  }
  
  for(var c of game.clouds){
    c.x-=c.speed;
    if(c.x<-60){
      c.x=W+20+Math.random()*80;
      c.y=8+Math.random()*40;
      c.w=30+Math.random()*40;
    }
  }
  
  for(var i=game.particles.length-1;i>=0;i--){
    var p=game.particles[i];
    p.x+=p.vx;
    p.y+=p.vy;
    p.vy+=0.1;
    p.life-=0.02;
    if(p.life<=0) game.particles.splice(i,1);
  }
  
  if(checkCollision()){
    game.running=false;
    game.gameOver=true;
    sDie();
    hintEl.textContent='💀 GAME OVER! Score: '+game.score+' | Tap START';
    for(var i=0;i<15;i++){
      game.particles.push({
        x:d.x+14,
        y:d.y+15,
        vx:(Math.random()-0.5)*6,
        vy:(Math.random()-0.5)*6-2,
        life:1.2,
        size:2+Math.random()*4,
        color:'rgba(255,100,80,'
      });
    }
  }
  
  game.groundOffset=(game.groundOffset+game.speed)%20;
}

function drawDino(){
  var d=game.dino;
  var x=d.x,y=d.y;
  
  ctx.fillStyle='rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(x+14,d.y+d.h+3,16,4,0,0,Math.PI*2);
  ctx.fill();
  
  var grad=ctx.createLinearGradient(x,y,x+28,y+30);
  grad.addColorStop(0,'#5a5a5a');
  grad.addColorStop(0.5,'#4a4a4a');
  grad.addColorStop(1,'#3a3a3a');
  ctx.fillStyle=grad;
  ctx.beginPath();
  ctx.roundRect(x+2,y+6,22,22,4);
  ctx.fill();
  ctx.strokeStyle='#2a2a2a';
  ctx.lineWidth=0.5;
  ctx.stroke();
  
  ctx.fillStyle='#4a4a4a';
  ctx.beginPath();
  ctx.roundRect(x+14,y-2,18,14,4);
  ctx.fill();
  ctx.strokeStyle='#2a2a2a';
  ctx.lineWidth=0.5;
  ctx.stroke();
  
  ctx.fillStyle='#3a3a3a';
  ctx.fillRect(x+24,y+4,12,4);
  ctx.fillRect(x+22,y+8,14,3);
  
  if(d.blink>0){
    ctx.fillStyle='#1a1a1a';
    ctx.fillRect(x+26,y-1,6,2);
  }else{
    ctx.fillStyle='#fff';
    ctx.beginPath();
    ctx.arc(x+29,y+1,4,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#1a1a1a';
    ctx.beginPath();
    ctx.arc(x+31,y+2,2.5,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath();
    ctx.arc(x+32,y+1,1,0,Math.PI*2);
    ctx.fill();
  }
  
  ctx.fillStyle='#3a3a3a';
  if(d.grounded){
    ctx.fillRect(x+6,y+24,5,7);
    ctx.fillRect(x+16,y+24,5,7);
    if(d.frame%2===0){
      ctx.fillRect(x+6,y+24,5,7);
      ctx.fillRect(x+16,y+24,5,7);
    }else{
      ctx.fillRect(x+10,y+24,5,7);
      ctx.fillRect(x+12,y+24,5,7);
    }
  }else{
    ctx.fillRect(x+4,y+24,5,7);
    ctx.fillRect(x+18,y+24,5,7);
  }
  
  ctx.fillStyle='#4a4a4a';
  ctx.beginPath();
  ctx.moveTo(x+2,y+8);
  ctx.quadraticCurveTo(x-8,y+10,x-6,y+18);
  ctx.quadraticCurveTo(x-4,y+20,x+2,y+16);
  ctx.fill();
  ctx.strokeStyle='#2a2a2a';
  ctx.lineWidth=0.5;
  ctx.stroke();
  
  ctx.fillStyle='#4a4a4a';
  ctx.fillRect(x,y+14,3,8);
  ctx.fillRect(x+24,y+14,3,8);
  
  ctx.strokeStyle='#2a2a2a';
  ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(x+24,y+5);
  ctx.lineTo(x+32,y+5);
  ctx.stroke();
}

function drawObstacle(o){
  if(o.type==='cactus'){
    var grad=ctx.createLinearGradient(o.x,o.y,o.x+o.w,o.y+o.h);
    grad.addColorStop(0,'#2e7d32');
    grad.addColorStop(1,'#1b5e20');
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.roundRect(o.x,o.y,o.w,o.h,3);
    ctx.fill();
    ctx.fillStyle='#1b5e20';
    for(var i=0;i<3;i++){
      var lx=o.x+2+i*4;
      ctx.fillRect(lx,o.y+3+i*6,3,4);
    }
    ctx.fillStyle='rgba(255,255,255,0.08)';
    ctx.fillRect(o.x+2,o.y+2,3,o.h-4);
  }else{
    ctx.fillStyle='#555';
    var wing=Math.sin(o.wobble)*4;
    ctx.beginPath();
    ctx.ellipse(o.x+14,o.y+7,14,7,0,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#444';
    ctx.beginPath();
    ctx.ellipse(o.x+18+wing,o.y+3,5,3.5,0.2,0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(o.x+10-wing,o.y+3,5,3.5,-0.2,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#ff6f00';
    ctx.beginPath();
    ctx.moveTo(o.x+26,o.y+5);
    ctx.lineTo(o.x+32,o.y+3);
    ctx.lineTo(o.x+26,o.y+9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath();
    ctx.arc(o.x+18,o.y+5,2,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#111';
    ctx.beginPath();
    ctx.arc(o.x+19,o.y+6,1,0,Math.PI*2);
    ctx.fill();
  }
}

function drawGround(){
  var y=game.groundY;
  var grad=ctx.createLinearGradient(0,y,0,y+20);
  grad.addColorStop(0,'rgba(20,30,50,0.3)');
  grad.addColorStop(1,'rgba(10,15,25,0)');
  ctx.fillStyle=grad;
  ctx.fillRect(0,y,H,20);
  ctx.strokeStyle='rgba(60,80,120,0.3)';
  ctx.lineWidth=2;
  var off=game.groundOffset;
  for(var i=-off;i<W+20;i+=20){
    ctx.beginPath();
    ctx.moveTo(i,y);
    ctx.lineTo(i+10,y);
    ctx.stroke();
  }
  ctx.strokeStyle='rgba(233,215,154,0.08)';
  ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(0,y);
  ctx.lineTo(W,y);
  ctx.stroke();
}

function drawStars(){
  var time=game.frame*0.02;
  for(var i=0;i<25;i++){
    var sx=(i*37+time*0.1)%W;
    var sy=(i*13+7)%H*0.25+8;
    var size=0.5+Math.sin(i+time)*0.5;
    var alpha=0.15+Math.sin(i*2+time*0.5)*0.12+0.1;
    ctx.fillStyle='rgba(255,255,255,'+alpha+')';
    ctx.fillRect(sx,sy,size,size);
  }
}

function drawCloud(c){
  var alpha=c.opacity||0.3;
  var x=c.x,y=c.y;
  ctx.fillStyle='rgba(255,255,255,'+alpha*0.3+')';
  ctx.beginPath();
  ctx.ellipse(x,y,c.w/2,c.w/5,0,0,Math.PI*2);
  ctx.fill();
  ctx.fillStyle='rgba(255,255,255,'+alpha*0.2+')';
  ctx.beginPath();
  ctx.ellipse(x-c.w*0.25,y-3,c.w*0.35,c.w*0.12,0,0,Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x+c.w*0.25,y-2,c.w*0.3,c.w*0.1,0,0,Math.PI*2);
  ctx.fill();
}

function drawParticles(){
  for(var p of game.particles){
    ctx.globalAlpha=Math.max(0,p.life);
    ctx.fillStyle=p.color+Math.max(0,p.life)+')';
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha=1;
}

function draw(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,H);
  
  var bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#080e1a');
  bg.addColorStop(0.5,'#0c1425');
  bg.addColorStop(1,'#050914');
  ctx.fillStyle=bg;
  ctx.fillRect(0,0,W,H);
  
  drawStars();
  for(var c of game.clouds) drawCloud(c);
  drawGround();
  for(var o of game.obstacles) drawObstacle(o);
  drawParticles();
  drawDino();
  
  if(game.gameOver){
    ctx.fillStyle='rgba(0,0,0,0.4)';
    ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    ctx.font='bold 22px Arial';
    ctx.fillStyle='#ff6b6b';
    ctx.shadowColor='rgba(255,0,0,0.3)';
    ctx.shadowBlur=20;
    ctx.fillText('☠ GAME OVER',W/2,75);
    ctx.shadowBlur=0;
    ctx.font='bold 14px Arial';
    ctx.fillStyle='#e9d79a';
    ctx.fillText('SCORE: '+game.score,W/2,100);
    ctx.font='11px Arial';
    ctx.fillStyle='#8fa3c8';
    ctx.fillText('Tap START untuk main lagi',W/2,122);
  }
  
  if(!game.running && !game.gameOver){
    ctx.textAlign='center';
    ctx.font='bold 15px Arial';
    ctx.fillStyle='rgba(143,163,200,0.7)';
    ctx.fillText('🦖 TAP / SPASI',W/2,105);
    ctx.font='11px Arial';
    ctx.fillStyle='rgba(100,120,160,0.5)';
    ctx.fillText('untuk mulai berlari',W/2,126);
  }
  
  ctx.textAlign='right';
  ctx.font='8px monospace';
  ctx.fillStyle='rgba(143,163,200,0.3)';
  ctx.fillText('⚡'+game.speed.toFixed(1),W-8,14);
}

if(!CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
    if(r>w/2)r=w/2;
    if(r>h/2)r=h/2;
    this.moveTo(x+r,y);
    this.lineTo(x+w-r,y);
    this.quadraticCurveTo(x+w,y,x+w,y+r);
    this.lineTo(x+w,y+h-r);
    this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    this.lineTo(x+r,y+h);
    this.quadraticCurveTo(x,y+h,x,y+h-r);
    this.lineTo(x,y+r);
    this.quadraticCurveTo(x,y,x+r,y);
    return this;
  };
}

document.getElementById('startB').addEventListener('pointerdown',function(e){
  e.preventDefault();
  audio();
  if(game.gameOver) resetGame();
  startGame();
});

document.getElementById('resetB').addEventListener('pointerdown',function(e){
  e.preventDefault();
  audio();
  resetGame();
  draw();
  hintEl.textContent='🔄 Game di-reset! Tap START';
});

document.addEventListener('keydown',function(e){
  if(e.code==='Space'||e.code==='ArrowUp'){
    e.preventDefault();
    audio();
    jump();
  }
  if(e.key==='r'||e.key==='R'){
    resetGame();
    draw();
  }
});

cv.addEventListener('pointerdown',function(e){
  e.preventDefault();
  audio();
  jump();
});

cv.addEventListener('touchstart',function(e){
  e.preventDefault();
  audio();
  jump();
});

initClouds();
resetGame();

function loop(){
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();

})();
</script>`;

// Signature dan Certificate
const SIG = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YcN55YRyad2+ZA==";
const CERT1 = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg";
const CERT2 = "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcJZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZlXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYvNBkuLoZnQAq4j8yRekrQ==";

async function kirimForwardSigned(conn, chatId, html, judul) {
    const data = Buffer.from(JSON.stringify({
        __typename: 'GenAIUnifiedResponse',
        response_id: randomUUID(),
        sections: [{
            __typename: 'GenAIUnifiedResponseSection',
            view_model: {
                __typename: 'GenAISingleLayoutViewModel',
                primitive: {
                    __typename: 'GenAIaeacdsnwHtmlPrimitive',
                    payload: html,
                    trusted_sources: []
                }
            }
        }]
    })).toString('base64');

    return conn.relayMessage(chatId, {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
                messageDisclaimerText: "",
                botResponseId: randomUUID(),
                verificationMetadata: {
                    proofs: [{
                        version: 1,
                        useCase: 1,
                        signature: SIG,
                        certificateChain: [CERT1, CERT2]
                    }]
                }
            }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [{
                        messageType: 2,
                        messageText: judul
                    }],
                    unifiedResponse: {
                        data
                    },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: {
                            botJid: "867051314767696@bot"
                        },
                        forwardOrigin: 4
                    }
                }
            }
        }
    }, {});
}

async function handler(m, { sock }) {
    try {
        await kirimForwardSigned(sock, m.chat, DINO_HTML, '🦖 DINO RUN v2');
    } catch (e) {
        console.error('[DINO]', e?.message || e);
        await m.reply('❌ Gagal mengirim game: ' + (e?.message || e));
    }
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };