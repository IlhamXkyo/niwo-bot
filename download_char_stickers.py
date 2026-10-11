import os
import time
import requests
from PIL import Image
from io import BytesIO
from duckduckgo_search import DDGS

characters = {
    'kageyama': {
        'default': 'Tobio Kageyama Karasuno anime profile icon',
        'happy': 'Tobio Kageyama smiling rare Haikyuu anime',
        'angry': 'Tobio Kageyama angry annoyed boke Haikyuu anime',
        'proud': 'Tobio Kageyama king of the court confident Haikyuu anime',
        'drink': 'Tobio Kageyama drinking milk Haikyuu anime',
        'sad': 'Tobio Kageyama frustrated disappointed Haikyuu anime',
        'shocked': 'Tobio Kageyama shocked dumbfounded Haikyuu anime'
    },
    'leon': {
        'default': 'Leon S Kennedy Resident Evil 4 Remake cool portrait',
        'confident': 'Leon S Kennedy smirk gun Resident Evil 4',
        'action': 'Leon S Kennedy aiming weapon Resident Evil combat',
        'tired': 'Leon S Kennedy exhausted sigh Resident Evil',
        'serious': 'Leon S Kennedy serious agent Resident Evil 4',
        'sarcastic': 'Leon S Kennedy cool jacket one liner Resident Evil'
    }
}

base_dir = r'assets\stickers'

def download_and_convert(url, output_path):
    try:
        response = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        response.raise_for_status()
        img = Image.open(BytesIO(response.content))
        
        # Crop to square
        width, height = img.size
        min_dim = min(width, height)
        left = (width - min_dim) / 2
        top = (height - min_dim) / 2
        right = (width + min_dim) / 2
        bottom = (height + min_dim) / 2
        img = img.crop((left, top, right, bottom))
        
        # Resize to 512x512
        img = img.resize((512, 512), Image.Resampling.LANCZOS)
        
        # Convert RGBA to RGB with white background
        if img.mode == 'RGBA':
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[3])
            img = bg
        else:
            img = img.convert('RGB')
        
        # Save as webp
        img.save(output_path, 'WEBP', quality=85)
        return True
    except Exception as e:
        return False

def main():
    with DDGS() as ddgs:
        for char_name, emotions in characters.items():
            print(f"=== Downloading stickers for {char_name} ===")
            char_dir = os.path.join(base_dir, char_name)
            for emotion, query in emotions.items():
                print(f"[{char_name}] Searching {emotion}: {query}...")
                emo_dir = os.path.join(char_dir, emotion)
                os.makedirs(emo_dir, exist_ok=True)
                
                # Check if file exists
                out_file = os.path.join(emo_dir, f"{emotion}_01.webp")
                if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
                    print(f"Already exists: {out_file}")
                    continue
                
                results = list(ddgs.images(query, max_results=6))
                success = False
                for res in results:
                    url = res.get('image')
                    if url and download_and_convert(url, out_file):
                        print(f"Downloaded: {out_file}")
                        success = True
                        break
                if not success:
                    print(f"Failed to download for {char_name}/{emotion}")
                time.sleep(1)

if __name__ == '__main__':
    main()
