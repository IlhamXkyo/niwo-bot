import urllib.request
import re
import json
import os
from PIL import Image

def fetch_tenor():
    req = urllib.request.Request('https://tenor.com/search/sawako-kuronuma-gifs', headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req).read().decode('utf-8')
    gifs = list(set(re.findall(r'https://media1\.tenor\.com/[^\s\"]+\.gif', html)))
    return gifs

def convert_to_webp(in_path, out_path):
    # Just take the first frame as a static sticker for now
    img = Image.open(in_path)
    img.seek(0)
    w, h = img.size
    min_dim = min(w, h)
    left = (w - min_dim)/2
    top = (h - min_dim)/2
    right = (w + min_dim)/2
    bottom = (h + min_dim)/2
    img = img.crop((left, top, right, bottom))
    img = img.resize((512, 512), Image.Resampling.LANCZOS)
    if img.mode == 'RGBA':
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        img = bg
    else:
        img = img.convert("RGB")
    img.save(out_path, 'WEBP')

def main():
    gifs = fetch_tenor()
    print("Found GIFs:", len(gifs))
    if len(gifs) < 7:
        print("Not enough GIFs!")
        return
    
    emotions = ['default', 'greeting', 'happy', 'loading', 'sad', 'shy', 'surprise']
    base_dir = r'assets\stickers\sawako'
    
    for i, em in enumerate(emotions):
        url = gifs[i]
        print(f"Downloading {em} -> {url}")
        urllib.request.urlretrieve(url, 'temp.gif')
        
        dir_path = os.path.join(base_dir, em)
        os.makedirs(dir_path, exist_ok=True)
        out_path = os.path.join(dir_path, f"{em}_01.webp")
        
        convert_to_webp('temp.gif', out_path)
        print(f"Saved {out_path}")
        os.remove('temp.gif')

if __name__ == '__main__':
    main()
