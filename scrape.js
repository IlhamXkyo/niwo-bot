const https = require('https');
https.get('https://tenor.com/search/sawako-kuronuma-gifs', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = data.match(/https:\/\/media1\.tenor\.com\/[^\s"]+\.gif/g);
    if(matches) console.log(Array.from(new Set(matches)).slice(0, 10).join('\n'));
  });
});
