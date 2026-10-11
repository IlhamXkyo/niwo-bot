import urllib.request
import json
import ssl
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

user_id = 3241449274

friends_url = f'https://friends.roblox.com/v1/users/{user_id}/friends'
req = urllib.request.Request(
    friends_url,
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
)

with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
    friends_data = json.loads(resp.read().decode('utf-8'))

friends = friends_data.get('data', [])
friend_ids = [f['id'] for f in friends]

online_list = []
offline_list = []

type_map = {
    0: 'Offline',
    1: 'Online (Website / App)',
    2: 'Sedang Bermain Game (In-Game)',
    3: 'Di Roblox Studio'
}

for i in range(0, len(friend_ids), 40):
    batch = friend_ids[i:i+40]
    payload = json.dumps({'userIds': batch}).encode('utf-8')
    req_p = urllib.request.Request(
        'https://presence.roblox.com/v1/presence/users',
        data=payload,
        headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    )
    try:
        with urllib.request.urlopen(req_p, context=ctx, timeout=10) as resp:
            pdata = json.loads(resp.read().decode('utf-8'))
            for p in pdata.get('userPresences', []):
                uid = p.get('userId')
                f_obj = next((x for x in friends if x['id'] == uid), None)
                if not f_obj:
                    continue
                ptype = p.get('userPresenceType', 0)
                location = p.get('lastLocation', '')
                status_desc = type_map.get(ptype, 'Offline')
                
                record = {
                    'name': f_obj.get('name'),
                    'displayName': f_obj.get('displayName'),
                    'status': status_desc,
                    'type': ptype,
                    'location': location
                }
                
                if ptype > 0:
                    online_list.append(record)
                else:
                    offline_list.append(record)
    except Exception as err:
        pass

result = {
    'total_friends': len(friends),
    'online_count': len(online_list),
    'online_friends': online_list
}

with open('roblox_online_friends.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"DONE: {len(online_list)} online friends found.")
