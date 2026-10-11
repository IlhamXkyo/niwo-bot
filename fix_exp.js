const fs = require('fs');
let c = fs.readFileSync('C:/Users/ACER NITRO/Downloads/Hiyuki-AI-21-09-26-1789982840727/plugins/canvas/fakektp.js', 'utf8');
c = c.replace(/export \{ config: pluginConfig, handler \};\r?\nexport default \{ config: pluginConfig, handler \};/, 'export { pluginConfig as config, handler };\nexport default { config: pluginConfig, handler };');
fs.writeFileSync('C:/Users/ACER NITRO/Downloads/Hiyuki-AI-21-09-26-1789982840727/plugins/canvas/fakektp.js', c, 'utf8');
