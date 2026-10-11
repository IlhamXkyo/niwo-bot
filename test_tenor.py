import urllib.request
import re
import json

def check(query):
    url = f"https://tenor.com/search/{query}-gifs"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
    html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
    matches = set(re.findall(r'https://c\.tenor\.com/[^\s\"\']+|https://media[0-9]?\.tenor\.com/[^\s\"\']+', html))
    print(f"Matches for {query}: {len(matches)}")
    for m in list(matches)[:10]:
        print("  ", m)

check("kageyama")
check("leon-resident-evil")
