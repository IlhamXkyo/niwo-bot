import os
import time
import requests
from PIL import Image
from io import BytesIO
from duckduckgo_search import DDGS

emotions = {
    'default': 'Sawako Kuronuma cute smile icon anime',
    'greeting': 'Sawako Kuronuma waving icon anime',
    'happy': 'Sawako Kuronuma happy smile icon anime',
    'loading': 'Sawako Kuronuma confused icon anime',
    'sad': 'Sawako Kuronuma sad crying icon anime',
    'shy': 'Sawako Kuronuma blushing shy icon anime',
    'surprise': 'Sawako Kuronuma shocked surprised icon anime'
}

base_dir = r'assets\stickers\sawako'

def download_and_convert(url, output_path):
    try:
        response = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
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
        
        # Add a white background if RGBA
        if img.mode == 'RGBA':
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[3])
            img = bg
        else:
            img = img.convert('RGB')
        
        # Save as webp
        img.save(output_path, 'WEBP')
        return True
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False

def main():
    with DDGS() as ddgs:
        for emotion, query in emotions.items():
            print(f"Searching for {emotion}...")
            results = list(ddgs.images(query, max_results=5))
            
            dir_path = os.path.join(base_dir, emotion)
            os.makedirs(dir_path, exist_ok=True)
            
            # Clean existing files
            for f in os.listdir(dir_path):
                if f.endswith('.webp'):
                    os.remove(os.path.join(dir_path, f))
                
            success = False
            for res in results:
                url = res.get('image')
                if url:
                    print(f"Trying URL: {url}")
                    out_file = os.path.join(dir_path, f"{emotion}_01.webp")
                    if download_and_convert(url, out_file):
                        print(f"Success for {emotion}!")
                        success = True
                        break
            if not success:
                print(f"Failed to find image for {emotion}.")
            time.sleep(1)

if __name__ == '__main__':
    main()
