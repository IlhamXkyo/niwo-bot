const fs = require('fs');
const https = require('https');
const path = require('path');
const { execSync } = require('child_process');

const urls = {
    'default': 'https://i.pinimg.com/736x/21/be/c7/21bec7b5e406f0e0bcba05f32d84711f.jpg',
    'greeting': 'https://i.pinimg.com/736x/8f/c9/71/8fc97155eeb5bcbe13158309cd9eefd0.jpg',
    'happy': 'https://i.pinimg.com/736x/43/d8/9e/43d89edb5155f9a63c3d5272a74c3e3a.jpg',
    'loading': 'https://i.pinimg.com/736x/2c/b0/a1/2cb0a1bf64c235ef9875f6bafbe059f0.jpg',
    'sad': 'https://i.pinimg.com/736x/e4/df/e8/e4dfe87f0b95eb835154cdb02f8b5490.jpg',
    'shy': 'https://i.pinimg.com/736x/b2/e3/ab/b2e3ab9f6f6ef42d2a45a6ab60e7e0bc.jpg',
    'surprise': 'https://i.pinimg.com/736x/32/38/20/3238202523277719f9f8c6b753f5a770.jpg'
};

const baseDir = path.join(__dirname, 'assets', 'stickers', 'sawako');

async function downloadAndConvert(url, emotion) {
    const dirPath = path.join(baseDir, emotion);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    
    const tempJpg = path.join(dirPath, 'temp.jpg');
    const finalWebp = path.join(dirPath, `${emotion}_01.webp`);
    
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
            if (res.statusCode !== 200 && res.statusCode !== 301 && res.statusCode !== 302) {
                console.error(`Error ${res.statusCode} downloading ${emotion}`);
                return resolve(false);
            }
            if (res.headers.location) {
                // follow redirect once
                https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res2) => {
                    const fileStream = fs.createWriteStream(tempJpg);
                    res2.pipe(fileStream);
                    fileStream.on('finish', () => processDownload(fileStream, tempJpg, finalWebp, emotion, resolve));
                });
                return;
            }
            const fileStream = fs.createWriteStream(tempJpg);
            res.pipe(fileStream);
            fileStream.on('finish', () => processDownload(fileStream, tempJpg, finalWebp, emotion, resolve));
        }).on('error', (e) => {
            console.error(`Error downloading ${emotion}:`, e.message);
            resolve(false);
        });
    });
}

function processDownload(fileStream, tempJpg, finalWebp, emotion, resolve) {
    fileStream.close();
    try {
        execSync(`python -c "from PIL import Image; img = Image.open('${tempJpg.replace(/\\/g, '/')}'); w,h=img.size; min_dim=min(w,h); img=img.crop(((w-min_dim)/2, (h-min_dim)/2, (w+min_dim)/2, (h+min_dim)/2)).resize((512,512)); img.save('${finalWebp.replace(/\\/g, '/')}', 'WEBP')"`);
        fs.unlinkSync(tempJpg);
        console.log(`Success: ${emotion}`);
        resolve(true);
    } catch (e) {
        console.error(`Error converting ${emotion}:`, e.message);
        resolve(false);
    }
}

async function main() {
    for (const [emotion, url] of Object.entries(urls)) {
        // Clear existing webp files
        const dirPath = path.join(baseDir, emotion);
        if (fs.existsSync(dirPath)) {
            for (const file of fs.readdirSync(dirPath)) {
                if (file.endsWith('.webp')) fs.unlinkSync(path.join(dirPath, file));
            }
        }
        await downloadAndConvert(url, emotion);
    }
}

main();
