const https = require('https');

https.get('https://myanimelist.net/character.php?q=Sawako%20Kuronuma', { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        const match = data.match(/https:\/\/myanimelist\.net\/character\/(\d+)\/[^"]+/);
        if (match) {
            console.log(match[0]);
        } else {
            console.log("Not found");
        }
    });
});
