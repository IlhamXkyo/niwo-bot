import urllib.request
import urllib.parse
import re
import os
from PIL import Image
from io import BytesIO

emotions = ['default', 'greeting', 'happy', 'loading', 'sad', 'shy', 'surprise']
base_dir = r'assets\stickers\sawako'

for emotion in emotions:
    print(f"Searching for {emotion}...")
    q = f"sawako kuronuma {emotion} icon anime"
    url = 'https://html.duckduckgo.com/html/?q=' + urllib.parse.quote(q)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching html for {emotion}: {e}")
        continue
        
    imgs = re.findall(r'src=\"\/\/external-content\.duckduckgo\.com\/iu\/\?u=([^\"&]+)', html)
    if not imgs:
        print(f"No images found for {emotion}")
        continue
        
    # Download the first valid image
    success = False
    for img_url in imgs:
        img_url = urllib.parse.unquote(img_url)
        try:
            print(f"Downloading {img_url}")
            req_img = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
            img_data = urllib.request.urlopen(req_img, timeout=5).read()
            img = Image.open(BytesIO(img_data))
            
            # Crop to square
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
                
            dir_path = os.path.join(base_dir, emotion)
            os.makedirs(dir_path, exist_ok=True)
            out_path = os.path.join(dir_path, f"{emotion}_01.webp")
            
            # Clear existing
            for f in os.listdir(dir_path):
                if f.endswith('.webp'):
                    os.remove(os.path.join(dir_path, f))
                    
            img.save(out_path, 'WEBP')
            print(f"Saved {out_path}")
            success = True
            break
        except Exception as e:
            print(f"Failed {img_url}: {e}")
    if not success:
        print(f"Could not download any image for {emotion}")
