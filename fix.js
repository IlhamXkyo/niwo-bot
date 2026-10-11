const fs = require('fs');

const ktp = 'C:/Users/ACER NITRO/Downloads/Hiyuki-AI-21-09-26-1789982840727/plugins/canvas/fakektp.js';
let k = fs.readFileSync(ktp, 'utf8');
k = k.replace("'canvas'", "'@napi-rs/canvas'");
k = k.replace(/```offline```/g, "'offline'");
fs.writeFileSync(ktp, k, 'utf8');

const dana = 'C:/Users/ACER NITRO/Downloads/Hiyuki-AI-21-09-26-1789982840727/plugins/canvas/fakedana.js';
let d = fs.readFileSync(dana, 'utf8');
d = d.replace("'canvas'", "'@napi-rs/canvas'");
fs.writeFileSync(dana, d, 'utf8');
