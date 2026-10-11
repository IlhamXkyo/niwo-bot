const fs = require('fs');

function fix(file) {
  let c = fs.readFileSync(file, 'utf8');
  // Just fix all 'ccctx.' and 'cccctx.' to 'cctx.'
  c = c.replace(/c+tx\./g, 'cctx.');
  fs.writeFileSync(file, c, 'utf8');
}

fix('C:/Users/ACER NITRO/Downloads/Hiyuki-AI-21-09-26-1789982840727/plugins/canvas/fakektp.js');
fix('C:/Users/ACER NITRO/Downloads/Hiyuki-AI-21-09-26-1789982840727/plugins/canvas/fakedana.js');

console.log('Fixed ccctx typo!');
