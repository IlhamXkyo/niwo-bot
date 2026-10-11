import urllib.request
import re
import os
from PIL import Image
from io import BytesIO

url = "https://myanimelist.net/character/6977/Sawako_Kuronuma/pictures"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
html = urllib.request.urlopen(req).read().decode('utf-8')

imgs = re.findall(r'href="(https://cdn\.myanimelist\.net/images/characters/[^"]+)"', html)
# Use unique
imgs = list(set(imgs))

emotions = ['default', 'greeting', 'happy', 'loading', 'sad', 'shy', 'surprise']
base_dir = r'assets\stickers\sawako'

for i, em in enumerate(emotions):
    if i < len(imgs):
        img_url = imgs[i]
        print(f"Downloading {em} -> {img_url}")
        
        req_img = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
        img_data = urllib.request.urlopen(req_img).read()
        
        dir_path = os.path.join(base_dir, em)
        os.makedirs(dir_path, exist_ok=True)
        out_path = os.path.join(dir_path, f"{em}_01.webp")
        
        for f in os.listdir(dir_path):
            if f.endswith('.webp'):
                os.remove(os.path.join(dir_path, f))
                
        img = Image.open(BytesIO(img_data))
        w, h = img.size
        min_dim = min(w, h)
        img = img.crop(((w-min_dim)/2, (h-min_dim)/2, (w+min_dim)/2, (h+min_dim)/2))
        img = img.resize((512, 512), Image.Resampling.LANCZOS)
        
        if img.mode == 'RGBA':
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[3])
            img = bg
        else:
            img = img.convert("RGB")
            
        img.save(out_path, 'WEBP')
        print(f"Saved {out_path}")
