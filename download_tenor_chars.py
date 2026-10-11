import urllib.request
import re
import os
from PIL import Image

def fetch_tenor_webps(query):
    url = f"https://tenor.com/search/{query}-gifs"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
    try:
        html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8')
        # We can grab webp or gif links
        webps = list(set(re.findall(r'https://media\.tenor\.com/[^\s\"\']+\.webp', html)))
        gifs = list(set(re.findall(r'https://media\.tenor\.com/[^\s\"\']+\.gif', html)))
        return webps + gifs
    except Exception as e:
        print(f"Error fetching {query}: {e}")
        return []

def convert_to_webp(in_path, out_path):
    try:
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
        img.save(out_path, 'WEBP', quality=85)
        return True
    except Exception as e:
        print(f"Error converting: {e}")
        return False

targets = {
    'kageyama': {
        'search': 'kageyama',
        'emotions': ['default', 'angry', 'proud', 'drink', 'happy', 'sad', 'shocked']
    },
    'leon': {
        'search': 'leon-resident-evil',
        'emotions': ['default', 'confident', 'serious', 'action', 'tired', 'sarcastic']
    }
}

base_dir = r'assets\stickers'

for char_name, conf in targets.items():
    print(f"=== Downloading stickers for {char_name} ===")
    media_urls = fetch_tenor_webps(conf['search'])
    print(f"Found {len(media_urls)} items for {char_name}")
    
    char_dir = os.path.join(base_dir, char_name)
    os.makedirs(char_dir, exist_ok=True)
    
    for idx, em in enumerate(conf['emotions']):
        if idx >= len(media_urls):
            break
        media_url = media_urls[idx]
        ext = '.webp' if media_url.endswith('.webp') else '.gif'
        tmp_file = f"tmp_{char_name}_{em}{ext}"
        print(f"[{char_name}] Downloading {em} from {media_url}...")
        try:
            req = urllib.request.Request(media_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as resp, open(tmp_file, 'wb') as f:
                f.write(resp.read())
            
            emo_dir = os.path.join(char_dir, em)
            os.makedirs(emo_dir, exist_ok=True)
            out_file = os.path.join(emo_dir, f"{em}_01.webp")
            if convert_to_webp(tmp_file, out_file):
                print(f"  -> Saved {out_file} ({os.path.getsize(out_file)} bytes)")
            if os.path.exists(tmp_file):
                os.remove(tmp_file)
        except Exception as e:
            print(f"  Failed {em}: {e}")

print("=== Complete! ===")
