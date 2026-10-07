/**
 * Local IndexedDB Storage for MP3 audio files and settings.
 * Persists audio Blobs and artwork Blobs locally on the iPhone.
 */

const DB_NAME = 'OfflineMP3PlayerDB';
const DB_VERSION = 1;
const TRACKS_STORE = 'tracks';
const SETTINGS_STORE = 'settings';

export class AppStorage {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(TRACKS_STORE)) {
          const trackStore = db.createObjectStore(TRACKS_STORE, { keyPath: 'id' });
          trackStore.createIndex('dateAdded', 'dateAdded', { unique: false });
          trackStore.createIndex('title', 'title', { unique: false });
        }

        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async saveTrack(track) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([TRACKS_STORE], 'readwrite');
      const store = tx.objectStore(TRACKS_STORE);
      const req = store.put(track);

      req.onsuccess = () => resolve(track);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllTracks() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([TRACKS_STORE], 'readonly');
      const store = tx.objectStore(TRACKS_STORE);
      const index = store.index('dateAdded');
      const req = index.getAll();

      req.onsuccess = () => {
        const tracks = req.result || [];
        resolve(tracks);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getTrack(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([TRACKS_STORE], 'readonly');
      const store = tx.objectStore(TRACKS_STORE);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteTrack(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([TRACKS_STORE], 'readwrite');
      const store = tx.objectStore(TRACKS_STORE);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getSetting(key, defaultValue = null) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([SETTINGS_STORE], 'readonly');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.get(key);

      req.onsuccess = () => {
        resolve(req.result ? req.result.value : defaultValue);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async setSetting(key, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([SETTINGS_STORE], 'readwrite');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.put({ key, value });

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getStorageUsage() {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
          percentage: estimate.quota ? ((estimate.usage / estimate.quota) * 100).toFixed(1) : 0
        };
      } catch (e) {
        console.warn('Storage estimate failed:', e);
      }
    }
    return null;
  }

  async requestPersistence() {
    if (navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persist();
        return isPersisted;
      } catch (e) {
        console.warn('Persistence request failed:', e);
      }
    }
    return false;
  }
}
