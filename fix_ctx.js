const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  // Rename the canvas context declaration
  content = content.replace("const ctx = canvas.getContext('2d');", "const cctx = canvas.getContext('2d');");
  
  // Replace canvas drawing methods: ctx.fillStyle -> cctx.fillStyle etc.
  const canvasMethods = ['fillStyle', 'fillRect', 'createLinearGradient', 'font', 'textAlign', 'fillText', 'drawImage', 'beginPath', 'arc', 'fill'];
  
  for (let method of canvasMethods) {
    let regex = new RegExp(`ctx\\.${method}`, 'g');
    content = content.replace(regex, `cctx.${method}`);
  }
  
  fs.writeFileSync(file, content, 'utf8');
}

fixFile('C:/Users/ACER NITRO/Downloads/Hiyuki-AI-21-09-26-1789982840727/plugins/canvas/fakektp.js');
fixFile('C:/Users/ACER NITRO/Downloads/Hiyuki-AI-21-09-26-1789982840727/plugins/canvas/fakedana.js');

console.log('Fixed variable shadowing!');
