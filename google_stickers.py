import urllib.request
import urllib.parse
import re
import base64
import os
from PIL import Image
from io import BytesIO

queries = {
    'default': 'sawako kuronuma smile icon anime',
    'greeting': 'sawako kuronuma waving icon anime',
    'happy': 'sawako kuronuma happy icon anime',
    'loading': 'sawako kuronuma confused icon anime',
    'sad': 'sawako kuronuma sad icon anime',
    'shy': 'sawako kuronuma shy blushing icon anime',
    'surprise': 'sawako kuronuma shocked icon anime'
}

base_dir = r'assets\stickers\sawako'

for emotion, q in queries.items():
    print(f"Searching for {emotion}...")
    url = "https://www.google.com/search?q=" + urllib.parse.quote(q) + "&tbm=isch"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    html = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')
    
    # Extract base64 image data
    matches = re.findall(r'data:image/(?:jpeg|jpg|png|gif);base64,([^"\']+)', html)
    
    if not matches:
        print(f"No base64 images found for {emotion}")
        continue
        
    img_data = base64.b64decode(matches[0])
    
    dir_path = os.path.join(base_dir, emotion)
    os.makedirs(dir_path, exist_ok=True)
    out_path = os.path.join(dir_path, f"{emotion}_01.webp")
    
    # Clear existing
    for f in os.listdir(dir_path):
        if f.endswith('.webp'):
            os.remove(os.path.join(dir_path, f))
            
    try:
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
    except Exception as e:
        print(f"Error saving {emotion}: {e}")
