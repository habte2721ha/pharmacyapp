// IndexedDB storage engine for large offline pharmacy database caching, synchronization queue, and critical state fail-safe backup

const DB_NAME = 'SonanPharmacyOfflineDB';
const DB_VERSION = 2; // Incremented for critical state fail-safe backup stores
const STORE_SNAPSHOTS = 'db_snapshots';
const STORE_QUEUE = 'sync_queue';
const STORE_AUTH = 'auth_cache';
const STORE_REQUESTS = 'endpoint_cache';

// New dedicated fail-safe stores for critical state
const STORE_CRITICAL_BACKUPS = 'critical_state_backups';
const STORE_CRITICAL_MEDICINES = 'critical_medicines';
const STORE_CRITICAL_CUSTOMERS = 'critical_customers';
const STORE_CRITICAL_SALES = 'critical_sales';
const STORE_CRITICAL_META = 'critical_meta';

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db: IDBDatabase = event.target.result;
      
      // Base caches & sync queues
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS);
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_AUTH)) {
        db.createObjectStore(STORE_AUTH);
      }
      if (!db.objectStoreNames.contains(STORE_REQUESTS)) {
        db.createObjectStore(STORE_REQUESTS);
      }

      // Dedicated Fail-Safe Critical Stores
      if (!db.objectStoreNames.contains(STORE_CRITICAL_BACKUPS)) {
        const backupStore = db.createObjectStore(STORE_CRITICAL_BACKUPS, { keyPath: 'id' });
        backupStore.createIndex('timestamp', 'timestamp', { unique: false });
        backupStore.createIndex('reason', 'reason', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CRITICAL_MEDICINES)) {
        db.createObjectStore(STORE_CRITICAL_MEDICINES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CRITICAL_CUSTOMERS)) {
        db.createObjectStore(STORE_CRITICAL_CUSTOMERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CRITICAL_SALES)) {
        db.createObjectStore(STORE_CRITICAL_SALES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CRITICAL_META)) {
        db.createObjectStore(STORE_CRITICAL_META);
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      console.warn('[IndexedDB] Failed to open database:', event.target.error);
      dbPromise = null;
      reject(event.target.error);
    };
  });

  return dbPromise;
}

export const offlineDb = {
  // Snapshot storage for all-data payload
  async saveSnapshot(key: string, data: any): Promise<void> {
    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
        const store = tx.objectStore(STORE_SNAPSHOTS);
        const req = store.put(data, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      // Fallback to localStorage
      try {
        localStorage.setItem(`idb_fallback_${key}`, JSON.stringify(data));
      } catch {}
    }
  },

  async getSnapshot<T = any>(key: string): Promise<T | null> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
        const store = tx.objectStore(STORE_SNAPSHOTS);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => {
          // Fallback to localStorage
          try {
            const val = localStorage.getItem(`idb_fallback_${key}`);
            resolve(val ? JSON.parse(val) : null);
          } catch {
            resolve(null);
          }
        };
      });
    } catch (e) {
      try {
        const val = localStorage.getItem(`idb_fallback_${key}`);
        return val ? JSON.parse(val) : null;
      } catch {
        return null;
      }
    }
  },

  // Sync Queue storage
  async getQueue(): Promise<any[]> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_QUEUE, 'readonly');
        const store = tx.objectStore(STORE_QUEUE);
        const req = store.getAll();
        req.onsuccess = () => {
          const results = req.result || [];
          // Keep localStorage mirror in sync
          try {
            localStorage.setItem('pending_sync_queue', JSON.stringify(results));
          } catch {}
          resolve(results);
        };
        req.onerror = () => {
          try {
            const q = localStorage.getItem('pending_sync_queue');
            resolve(q ? JSON.parse(q) : []);
          } catch {
            resolve([]);
          }
        };
      });
    } catch (e) {
      try {
        const q = localStorage.getItem('pending_sync_queue');
        return q ? JSON.parse(q) : [];
      } catch {
        return [];
      }
    }
  },

  async saveQueue(items: any[]): Promise<void> {
    try {
      localStorage.setItem('pending_sync_queue', JSON.stringify(items));
    } catch {}

    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_QUEUE);
        store.clear().onsuccess = () => {
          if (items.length === 0) return resolve();
          let count = 0;
          items.forEach(item => {
            const req = store.put(item);
            req.onsuccess = () => {
              count++;
              if (count === items.length) resolve();
            };
            req.onerror = () => reject(req.error);
          });
        };
      });
    } catch (e) {
      // localStorage was already updated above
    }
  },

  async addToQueue(item: any): Promise<void> {
    try {
      const q = localStorage.getItem('pending_sync_queue');
      const list = q ? JSON.parse(q) : [];
      const existingIdx = list.findIndex((x: any) => x.id === item.id);
      if (existingIdx >= 0) {
        list[existingIdx] = item;
      } else {
        list.push(item);
      }
      localStorage.setItem('pending_sync_queue', JSON.stringify(list));
    } catch {}

    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_QUEUE);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      // LocalStorage already recorded
    }
  },

  async removeFromQueue(id: string): Promise<void> {
    try {
      const q = localStorage.getItem('pending_sync_queue');
      if (q) {
        const list = JSON.parse(q).filter((x: any) => x.id !== id);
        localStorage.setItem('pending_sync_queue', JSON.stringify(list));
      }
    } catch {}

    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_QUEUE);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch (e) {}
  },

  async clearQueue(): Promise<void> {
    try {
      localStorage.removeItem('pending_sync_queue');
    } catch {}

    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_QUEUE);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch (e) {}
  },

  // Auth Cache for offline logins
  async saveAuthUser(user: any): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction(STORE_AUTH, 'readwrite');
      const store = tx.objectStore(STORE_AUTH);
      store.put(user, user.username?.toLowerCase() || user.id);
      store.put(user, 'last_active_user');
    } catch {}
    try {
      localStorage.setItem('sonan_cached_auth_user', JSON.stringify(user));
    } catch {}
  },

  async getAuthUser(username: string): Promise<any | null> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_AUTH, 'readonly');
        const store = tx.objectStore(STORE_AUTH);
        const req = store.get(username.toLowerCase());
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      try {
        const val = localStorage.getItem('sonan_cached_auth_user');
        return val ? JSON.parse(val) : null;
      } catch {
        return null;
      }
    }
  },

  async getLastActiveUser(): Promise<any | null> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_AUTH, 'readonly');
        const store = tx.objectStore(STORE_AUTH);
        const req = store.get('last_active_user');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      try {
        const val = localStorage.getItem('sonan_cached_auth_user') || localStorage.getItem('sonan_current_user');
        return val ? JSON.parse(val) : null;
      } catch {
        return null;
      }
    }
  },

  // ==========================================
  // Dedicated Critical State Fail-Safe Storage
  // ==========================================

  // Save individual collection items into discrete stores for high-granularity recovery
  async saveCriticalEntities(storeName: 'medicines' | 'customers' | 'sales', items: any[]): Promise<void> {
    if (!Array.isArray(items)) return;
    const targetStore = storeName === 'medicines' 
      ? STORE_CRITICAL_MEDICINES 
      : storeName === 'customers' 
        ? STORE_CRITICAL_CUSTOMERS 
        : STORE_CRITICAL_SALES;

    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(targetStore, 'readwrite');
        const store = tx.objectStore(targetStore);
        store.clear().onsuccess = () => {
          if (items.length === 0) return resolve();
          let count = 0;
          items.forEach(item => {
            if (item && item.id) {
              const req = store.put(item);
              req.onsuccess = () => {
                count++;
                if (count === items.length) resolve();
              };
              req.onerror = () => reject(req.error);
            } else {
              count++;
              if (count === items.length) resolve();
            }
          });
        };
      });
    } catch (e) {
      console.warn(`[IndexedDB Fail-Safe] Could not persist ${storeName} to discrete store:`, e);
    }
  },

  // Read collection from discrete critical stores
  async getCriticalEntities<T = any>(storeName: 'medicines' | 'customers' | 'sales'): Promise<T[]> {
    const targetStore = storeName === 'medicines' 
      ? STORE_CRITICAL_MEDICINES 
      : storeName === 'customers' 
        ? STORE_CRITICAL_CUSTOMERS 
        : STORE_CRITICAL_SALES;

    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(targetStore, 'readonly');
        const store = tx.objectStore(targetStore);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  },

  // Save a complete Point-in-Time Fail-Safe Snapshot
  async saveCriticalBackupSnapshot(backupRecord: {
    id: string;
    timestamp: number;
    date: string;
    reason: string;
    itemCounts: { medicines: number; customers: number; sales: number; stockItems?: number };
    data: any;
    checksum: string;
    sizeBytes: number;
  }): Promise<void> {
    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_CRITICAL_BACKUPS, STORE_CRITICAL_META], 'readwrite');
        const backupStore = tx.objectStore(STORE_CRITICAL_BACKUPS);
        const metaStore = tx.objectStore(STORE_CRITICAL_META);

        const putReq = backupStore.put(backupRecord);
        putReq.onsuccess = () => {
          metaStore.put({
            lastBackupId: backupRecord.id,
            lastBackupTime: backupRecord.timestamp,
            lastBackupDate: backupRecord.date,
            itemCounts: backupRecord.itemCounts,
            checksum: backupRecord.checksum,
            sizeBytes: backupRecord.sizeBytes
          }, 'latest_backup_info');
          resolve();
        };
        putReq.onerror = () => reject(putReq.error);
      });
    } catch (e) {
      console.error('[IndexedDB Fail-Safe] Error saving critical state snapshot:', e);
    }
  },

  // Retrieve single snapshot by ID
  async getCriticalBackupSnapshot(id: string): Promise<any | null> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_CRITICAL_BACKUPS, 'readonly');
        const store = tx.objectStore(STORE_CRITICAL_BACKUPS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  },

  // Retrieve all snapshot headers (without full data payload to save memory)
  async getAllCriticalBackupSnapshots(): Promise<any[]> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_CRITICAL_BACKUPS, 'readonly');
        const store = tx.objectStore(STORE_CRITICAL_BACKUPS);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || []).map(b => ({
            id: b.id,
            timestamp: b.timestamp,
            date: b.date,
            reason: b.reason,
            itemCounts: b.itemCounts,
            checksum: b.checksum,
            sizeBytes: b.sizeBytes || 0
          }));
          // Sort newest first
          list.sort((a, b) => b.timestamp - a.timestamp);
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  },

  // Delete snapshot by ID
  async deleteCriticalBackupSnapshot(id: string): Promise<boolean> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_CRITICAL_BACKUPS, 'readwrite');
        const store = tx.objectStore(STORE_CRITICAL_BACKUPS);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  },

  // Meta storage
  async saveCriticalMeta(key: string, value: any): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction(STORE_CRITICAL_META, 'readwrite');
      const store = tx.objectStore(STORE_CRITICAL_META);
      store.put(value, key);
    } catch {}
  },

  async getCriticalMeta<T = any>(key: string): Promise<T | null> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_CRITICAL_META, 'readonly');
        const store = tx.objectStore(STORE_CRITICAL_META);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }
};
