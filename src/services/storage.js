// ============================================================================
// storage.js — LocalStorage settings + IndexedDB for candles & signals
// ============================================================================

// ---------------------------------------------------------------------------
// LocalStorage keys & defaults
// ---------------------------------------------------------------------------
const SETTINGS_KEY = 'xau_settings';
const API_KEY_KEY = 'xau_api_key';
const TELEGRAM_BOT_TOKEN_KEY = 'xau_telegram_bot_token';
const TELEGRAM_CHAT_ID_KEY = 'xau_telegram_chat_id';

const DEFAULT_SETTINGS = {
  symbol: 'XAU/USD',
  swingStrength: 3,
  maxCandles: 5000,
  displayTimezone: 'local', // 'local' or IANA timezone string
};

// ---------------------------------------------------------------------------
// Settings helpers (localStorage)
// ---------------------------------------------------------------------------

/**
 * Returns persisted settings merged with defaults so new keys are always present.
 * @returns {object}
 */
export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const saved = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persists settings object to localStorage.
 * @param {object} settings
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('[storage] Failed to save settings:', err);
  }
}

/**
 * Returns the stored Twelve Data API key, or null.
 * @returns {string|null}
 */
export function getApiKey() {
  try {
    return localStorage.getItem(API_KEY_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Persists the Twelve Data API key.
 * @param {string} key
 */
export function saveApiKey(key) {
  try {
    localStorage.setItem(API_KEY_KEY, key);
  } catch (err) {
    console.error('[storage] Failed to save API key:', err);
  }
}

export function getTelegramSettings() {
  try {
    return {
      botToken: localStorage.getItem(TELEGRAM_BOT_TOKEN_KEY) || '',
      chatId: localStorage.getItem(TELEGRAM_CHAT_ID_KEY) || '',
    };
  } catch {
    return { botToken: '', chatId: '' };
  }
}

export function saveTelegramSettings(config) {
  try {
    localStorage.setItem(TELEGRAM_BOT_TOKEN_KEY, config.botToken || '');
    localStorage.setItem(TELEGRAM_CHAT_ID_KEY, config.chatId || '');
  } catch (err) {
    console.error('[storage] Failed to save Telegram settings:', err);
  }
}

// ---------------------------------------------------------------------------
// IndexedDB — singleton connection
// ---------------------------------------------------------------------------
const DB_NAME = 'xau_chart_db';
const DB_VERSION = 1;

const CANDLE_STORES = ['candles_m1', 'candles_m5', 'candles_m15', 'candles_h1'];
const SIGNAL_STORE = 'signals';

/** @type {IDBDatabase|null} */
let dbInstance = null;

/**
 * Opens (or creates) the IndexedDB and returns the database handle.
 * Uses a singleton so subsequent calls return the same connection.
 * @returns {Promise<IDBDatabase>}
 */
export async function initDB() {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create candle object stores keyed by `time`
      for (const storeName of CANDLE_STORES) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'time' });
        }
      }

      // Create signals store with auto-increment key + index on `type`
      if (!db.objectStoreNames.contains(SIGNAL_STORE)) {
        const signalStore = db.createObjectStore(SIGNAL_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        signalStore.createIndex('type', 'type', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;

      // If the browser closes the connection (e.g. storage pressure), reset singleton.
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[storage] IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };

    request.onblocked = () => {
      console.warn('[storage] IndexedDB open blocked — close other tabs using this DB.');
    };
  });
}

// ---------------------------------------------------------------------------
// Candle helpers
// ---------------------------------------------------------------------------

/**
 * Map user-facing timeframe strings to store names.
 * @param {string} tf — 'm1' | 'm5' | 'm15' | 'h1'
 * @returns {string}
 */
function candleStoreName(tf) {
  const map = { m1: 'candles_m1', m5: 'candles_m5', m15: 'candles_m15', h1: 'candles_h1' };
  const name = map[tf];
  if (!name) throw new Error(`[storage] Unknown timeframe: ${tf}`);
  return name;
}

/**
 * Loads all candles for the given timeframe, sorted by time ascending.
 * @param {string} timeframe — 'm1' | 'm5' | 'm15' | 'h1'
 * @returns {Promise<Array>}
 */
export async function loadCandles(timeframe) {
  const db = await initDB();
  const storeName = candleStoreName(timeframe);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      const candles = request.result || [];
      candles.sort((a, b) => a.time - b.time);
      resolve(candles);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clears the candle store for the given timeframe and writes all supplied candles.
 * @param {string} timeframe
 * @param {Array} candles
 * @returns {Promise<void>}
 */
export async function saveCandles(timeframe, candles) {
  const db = await initDB();
  const storeName = candleStoreName(timeframe);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    // Clear existing data first
    store.clear();

    for (const candle of candles) {
      store.put(candle);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Signal helpers
// ---------------------------------------------------------------------------

/**
 * Adds a signal object to the signals store.
 * Signal shape: { id, type, subType, price, level, levelName, time, timeframe, timestamp }
 * @param {object} signal
 * @returns {Promise<number>} — the auto-generated key
 */
export async function addSignal(signal) {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SIGNAL_STORE, 'readwrite');
    const store = tx.objectStore(SIGNAL_STORE);

    // Ensure timestamp is set
    const record = { ...signal, timestamp: signal.timestamp ?? Date.now() };
    const request = store.put(record);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Loads signals, optionally filtered by type.
 * @param {string} [type] — optional type filter (e.g. 'sweep', 'bos', 'choch')
 * @returns {Promise<Array>}
 */
export async function loadSignals(type) {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SIGNAL_STORE, 'readonly');
    const store = tx.objectStore(SIGNAL_STORE);

    let request;
    if (type) {
      const index = store.index('type');
      request = index.getAll(type);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Bulk clear
// ---------------------------------------------------------------------------

/**
 * Clears every object store in the database.
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  const db = await initDB();
  const allStores = [...CANDLE_STORES, SIGNAL_STORE];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(allStores, 'readwrite');

    for (const storeName of allStores) {
      tx.objectStore(storeName).clear();
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
