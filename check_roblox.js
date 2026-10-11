import fs from 'node:fs';

const userId = 3241449274;

async function checkRoblox() {
  try {
    const res = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends`);
    const data = await res.json();
    const friends = data.data || [];
    const friendIds = friends.map(f => f.id);

    const presences = [];
    for (let i = 0; i < friendIds.length; i += 40) {
      const chunk = friendIds.slice(i, i + 40);
      try {
        const presenceRes = await fetch('https://presence.roblox.com/v1/presence/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          },
          body: JSON.stringify({ userIds: chunk })
        });
        const presData = await presenceRes.json();
        if (presData.userPresences) {
          presences.push(...presData.userPresences);
        }
      } catch (e) {
        console.error('Error presence chunk:', e);
      }
    }

    const onlinePresences = presences.filter(p => p.userPresenceType > 0);
    const onlineIds = onlinePresences.map(p => p.userId);

    // Fetch user profiles for online friends
    let userProfiles = [];
    if (onlineIds.length > 0) {
      const usersRes = await fetch('https://users.roblox.com/v1/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify({ userIds: onlineIds, excludeBannedUsers: false })
      });
      const usersData = await usersRes.json();
      userProfiles = usersData.data || [];
    }

    const userMap = new Map(userProfiles.map(u => [u.id, u]));
    const typeNames = {
      0: 'Offline',
      1: 'Online (Website / App)',
      2: 'Sedang Main Game (In-Game)',
      3: 'Di Roblox Studio'
    };

    const onlineFriends = onlinePresences.map(p => {
      const u = userMap.get(p.userId);
      return {
        id: p.userId,
        name: u ? u.name : `User_${p.userId}`,
        displayName: u ? u.displayName : `User_${p.userId}`,
        status: typeNames[p.userPresenceType] || 'Online',
        location: p.lastLocation || ''
      };
    });

    const out = {
      account: 'UwUNimeTime (Niwo_uwu)',
      totalFriends: friends.length,
      onlineCount: onlineFriends.length,
      onlineFriends
    };

    fs.writeFileSync('roblox_online_friends.json', JSON.stringify(out, null, 2), 'utf8');
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

checkRoblox();
