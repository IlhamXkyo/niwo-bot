import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), "database");

const USERS_FILE = path.join(DB_DIR, "users.json");
const GROUPS_FILE = path.join(DB_DIR, "groups.json");
const SETTINGS_FILE = path.join(DB_DIR, "settings.json");

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function readJSON(file, fallback = {}) {
  try {
    ensureDir();

    if (!fs.existsSync(file)) {
      return fallback;
    }

    const raw = fs.readFileSync(file, "utf8").trim();

    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch (err) {
    console.error(
      `[database] Failed to read ${file}:`,
      err.message
    );

    return fallback;
  }
}

function writeJSON(file, data) {
  try {
    ensureDir();

    fs.writeFileSync(
      file,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (err) {
    console.error(
      `[database] Failed to write ${file}:`,
      err.message
    );
  }
}

function defaultUser(jid) {
  return {
    jid,
    isRegistered: false,
    name: "",
    level: 0,
    exp: 0,
    koin: 0,
    energi: 100,
    premium: false,
    registeredAt: null
  };
}

function defaultGroup(jid) {
  return {
    jid,
    botMode: "public",
    welcome: true,
    antilink: false,

    // Proteksi tambahan
    antilinkAll: false,
    antivirtex: false,
    antitoxic: false,
    antispam: false,
    antisticker: false,
    antiforeign: false,
    antidelete: false,

    // Teks kustom
    welcomeText: "",
    goodbyeText: "",
    rulesText: "",
    intro: "",

    // Fitur grup
    mute: false,
    warnings: {},
    warnLimit: 3,
    afk: {},
    autoPromote: false,
    leveling: true
  };
}

let users = null;
let groups = null;
let settings = null;
let saveTimer = null;

function loadAll() {
  ensureDir();

  if (users === null) {
    users = readJSON(USERS_FILE, {});
  }

  if (groups === null) {
    groups = readJSON(GROUPS_FILE, {});
  }

  if (settings === null) {
    settings = readJSON(SETTINGS_FILE, {
      extraOwners: []
    });
  }

  if (!Array.isArray(settings.extraOwners)) {
    settings.extraOwners = [];
  }
}

function scheduleSave() {
  if (saveTimer) return;

  saveTimer = setTimeout(() => {
    writeJSON(USERS_FILE, users);
    writeJSON(GROUPS_FILE, groups);
    writeJSON(SETTINGS_FILE, settings);

    saveTimer = null;
  }, 500);
}


function normalizeUserKey(key) {
  const raw = String(key || "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? `${digits}@s.whatsapp.net` : raw;
}

function createLegacyUsersProxy() {
  return new Proxy({}, {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      if (prop === "toJSON") return () => ({ ...users });
      const key = normalizeUserKey(prop);
      if (!key) return undefined;
      return users[key] || (users[key] = defaultUser(key));
    },
    set(_target, prop, value) {
      if (typeof prop === "symbol") return true;
      const key = normalizeUserKey(prop);
      if (!key) return true;
      users[key] = value && typeof value === "object"
        ? { ...defaultUser(key), ...value, jid: value.jid || key }
        : defaultUser(key);
      scheduleSave();
      return true;
    },
    deleteProperty(_target, prop) {
      const key = normalizeUserKey(prop);
      if (key && users[key]) delete users[key];
      scheduleSave();
      return true;
    },
    ownKeys() {
      return Reflect.ownKeys(users).map((key) => String(key).split("@")[0]);
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true };
    },
  });
}

function createLegacyData() {
  const legacyUsers = createLegacyUsersProxy();
  const legacy = {};

  Object.defineProperty(legacy, "users", {
    enumerable: true,
    configurable: true,
    get: () => legacyUsers,
    set: (value) => {
      if (!value || typeof value !== "object") return;
      for (const [key, user] of Object.entries(value)) {
        const jid = normalizeUserKey(key);
        if (jid) users[jid] = user;
      }
      scheduleSave();
    },
  });

  Object.defineProperty(legacy, "groups", {
    enumerable: true,
    configurable: true,
    get: () => groups,
    set: (value) => {
      if (value && typeof value === "object") groups = value;
      scheduleSave();
    },
  });

  return new Proxy(legacy, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "toJSON") return () => ({ ...settings, users: users, groups: groups });
      if (prop === "owner") {
        return settings.owner || settings.extraOwners
          ?.map((jid) => String(jid).replace(/[^0-9]/g, ""))
          .filter(Boolean) || [];
      }
      if (prop === "premium") return settings.premium || [];
      if (prop === "partner") return settings.partner || [];
      return settings[prop];
    },
    set(target, prop, value) {
      if (prop in target) {
        target[prop] = value;
      } else {
        settings[prop] = value;
      }
      scheduleSave();
      return true;
    },
    deleteProperty(target, prop) {
      if (prop in target) return false;
      delete settings[prop];
      scheduleSave();
      return true;
    },
    ownKeys(target) {
      return [...new Set([
        ...Reflect.ownKeys(settings),
        ...Reflect.ownKeys(target),
      ])];
    },
    getOwnPropertyDescriptor(_target, prop) {
      return { enumerable: true, configurable: true };
    },
  });
}

function getDatabase() {
  loadAll();

  return {

    // =========================
    // USER
    // =========================

    getUser(jid) {
      if (!users[jid]) {
        users[jid] = defaultUser(jid);
        scheduleSave();
      }

      return users[jid];
    },

    setUser(jid, patch) {
      users[jid] = {
        ...(users[jid] || defaultUser(jid)),
        ...patch
      };

      scheduleSave();

      return users[jid];
    },

    getUserCount() {
      return Object.keys(users).length;
    },

    getAllUsers() {
      return { ...users };
    },

    // =========================
    // GROUP
    // =========================

    getGroup(jid) {
      if (!groups[jid]) {
        groups[jid] = defaultGroup(jid);
        scheduleSave();
      }

      return groups[jid];
    },

    setGroup(jid, patch) {
      groups[jid] = {
        ...(groups[jid] || defaultGroup(jid)),
        ...patch
      };

      scheduleSave();

      return groups[jid];
    },

    getGroupCount() {
      return Object.keys(groups).length;
    },

    getAllGroups() {
      return { ...groups };
    },

    // =========================
    // SETTINGS
    // =========================

    setting(key, value) {
      if (arguments.length >= 2) {
        settings[key] = value;
        scheduleSave();
        return value;
      }

      const defaultValue = value === undefined ? null : value;
      if (settings[key] === undefined) {
        settings[key] = defaultValue;
        scheduleSave();
      }

      return settings[key];
    },

    setSetting(key, value) {
      settings[key] = value;
      scheduleSave();

      return value;
    },

    getSettings() {
      return { ...settings };
    },

    // =========================
    // OWNER
    // =========================

    getOwners() {
      if (!Array.isArray(settings.extraOwners)) {
        settings.extraOwners = [];
        scheduleSave();
      }

      return [...settings.extraOwners];
    },

    addOwner(jid) {
      if (!jid) return false;

      if (!Array.isArray(settings.extraOwners)) {
        settings.extraOwners = [];
      }

      const normalized = String(jid).trim();
      const number = normalized.replace(/[^0-9]/g, "");
      const exists = settings.extraOwners.some((owner) =>
        String(owner).replace(/[^0-9]/g, "") === number
      );

      if (exists) return false;

      settings.extraOwners.push(normalized);

      scheduleSave();

      return true;
    },

    removeOwner(jid) {
      if (!jid) return false;

      if (!Array.isArray(settings.extraOwners)) {
        settings.extraOwners = [];
      }

      const oldLength =
        settings.extraOwners.length;

      const number = String(jid).replace(/[^0-9]/g, "");
      settings.extraOwners = settings.extraOwners.filter(
        (owner) => String(owner).replace(/[^0-9]/g, "") !== number
      );

      scheduleSave();

      return (
        oldLength !==
        settings.extraOwners.length
      );
    },

    isExtraOwner(jid) {
      if (!jid) return false;

      if (!Array.isArray(settings.extraOwners)) {
        return false;
      }

      const number = String(jid).replace(/[^0-9]/g, "");
      return settings.extraOwners.some(
        (owner) => String(owner).replace(/[^0-9]/g, "") === number
      );
    },

    // Compatibility aliases used by older owner plugins.
    // Keep both naming styles so an old plugin cannot crash the bot.
    getExtraOwners() {
      return this.getOwners();
    },

    addExtraOwner(jid) {
      return this.addOwner(jid);
    },

    removeExtraOwner(jid) {
      return this.removeOwner(jid);
    },

    // =========================
    // NUMERIC / PROFILE HELPERS
    // =========================

    updateKoin(jid, amount = 0) {
      const user = this.getUser(jid);
      const next = (Number(user.koin) || 0) + (Number(amount) || 0);
      user.koin = next;
      scheduleSave();
      return next;
    },

    updateEnergi(jid, amount = 0) {
      const user = this.getUser(jid);
      if (user.energi === -1) return -1;
      const next = Math.max(0, (Number(user.energi) || 0) + (Number(amount) || 0));
      user.energi = next;
      scheduleSave();
      return next;
    },

    updateExp(jid, amount = 0) {
      const user = this.getUser(jid);
      const next = Math.max(0, (Number(user.exp) || 0) + (Number(amount) || 0));
      user.exp = next;
      scheduleSave();
      return next;
    },

    // =========================
    // LEGACY DATA COMPATIBILITY
    // =========================

    get data() {
      if (!this.__legacyData) this.__legacyData = createLegacyData();
      return this.__legacyData;
    },

    // =========================
    // SAVE
    // =========================

    save() {
      this.saveNow();
    },

    write() {
      this.saveNow();
    },

    saveNow() {
      writeJSON(USERS_FILE, users);
      writeJSON(GROUPS_FILE, groups);
      writeJSON(SETTINGS_FILE, settings);
    },

    get db() {
      return {
        data: this.data,
        write: () => this.saveNow(),
      };
    }
  };
}

export { getDatabase };