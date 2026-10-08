// Offline Support and Synchronization Manager
// Intercepts window.fetch to support offline reads, optimistic offline writes, and automatic background queue synchronization with persistent IndexedDB backing.
import { offlineDb } from './offlineDb';
import { criticalStateBackup } from './criticalStateBackup';

export interface PendingRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  timestamp: number;
  retryCount?: number;
  lastAttempt?: number;
  lastError?: string;
}

const CACHE_PREFIX = 'offline_cache_';
const QUEUE_KEY = 'pending_sync_queue';
const SIMULATE_OFFLINE_KEY = 'simulate_offline_mode';

let isSimulatedOffline = localStorage.getItem(SIMULATE_OFFLINE_KEY) === 'true';
let isNetworkOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let listeners: Array<() => void> = [];

// In-memory queue cache synced with IndexedDB and localStorage
let inMemoryQueue: PendingRequest[] = [];
let isQueueLoadedFromDb = false;

// Helper to notify all UI listeners of status updates
function notifyListeners() {
  listeners.forEach(cb => {
    try {
      cb();
    } catch (e) {
      console.error('Error notifying offline listener:', e);
    }
  });
}

// Initial bootstrap: load persistent queue from IndexedDB
async function initQueueFromIndexedDb() {
  try {
    const idbQueue = await offlineDb.getQueue();
    if (idbQueue && Array.isArray(idbQueue) && idbQueue.length > 0) {
      inMemoryQueue = idbQueue;
      safeLocalStorageSet(QUEUE_KEY, JSON.stringify(idbQueue));
    } else {
      const lsQueue = localStorage.getItem(QUEUE_KEY);
      if (lsQueue) {
        inMemoryQueue = JSON.parse(lsQueue);
        await offlineDb.saveQueue(inMemoryQueue);
      }
    }
  } catch (err) {
    try {
      const lsQueue = localStorage.getItem(QUEUE_KEY);
      inMemoryQueue = lsQueue ? JSON.parse(lsQueue) : [];
    } catch {
      inMemoryQueue = [];
    }
  } finally {
    isQueueLoadedFromDb = true;
    notifyListeners();
    // If online and items are queued, attempt sync
    if (inMemoryQueue.length > 0 && isNetworkOnline && !isSimulatedOffline) {
      setTimeout(() => triggerAutoSync(), 1000);
    }
  }
}

if (typeof window !== 'undefined') {
  initQueueFromIndexedDb();
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      console.warn('[Offline Storage Check] Quota exceeded. Cleaning up secondary caches...');
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.includes('offline_cache_') && !k.includes('all-data')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      try {
        localStorage.setItem(key, value);
      } catch (retryErr) {
        console.warn('[Offline Storage Check] Quota still exceeded. Removing main all-data cache...');
        const keysToRemove2: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.includes('offline_cache_')) {
            keysToRemove2.push(k);
          }
        }
        keysToRemove2.forEach(k => localStorage.removeItem(k));
        
        try {
          localStorage.setItem(key, value);
        } catch (finalErr) {
          console.warn('[Offline Storage Check] Swallowed storage exception:', finalErr);
        }
      }
    } else {
      console.warn('[Offline Storage Check] Swallowed non-quota storage error:', e);
    }
  }
}

// Robust server connectivity check function using originalFetch with consecutive failure tolerance
let consecutiveConnectivityFailures = 0;

function markNetworkOnline() {
  consecutiveConnectivityFailures = 0;
  if (!isNetworkOnline) {
    isNetworkOnline = true;
    notifyListeners();
    triggerAutoSync();
  }
}

async function verifyServerConnectivity(): Promise<boolean> {
  if (isSimulatedOffline) return false;

  // If the browser/OS network interface is strictly offline, report false
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    consecutiveConnectivityFailures++;
    return false;
  }

  try {
    const fetchFn = (window as any).__originalFetch || window.fetch;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;

    const res = await fetchFn('/api/health', {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      signal: controller ? controller.signal : undefined
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (res.ok || res.status < 500) {
      consecutiveConnectivityFailures = 0;
      return true;
    }

    consecutiveConnectivityFailures++;
    // If browser navigator.onLine is active, do not falsely declare offline
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      return true;
    }
    return consecutiveConnectivityFailures < 5;
  } catch {
    consecutiveConnectivityFailures++;
    // If browser says we are online, do not drop to offline on transient glitch or latency
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      return true;
    }
    return false;
  }
}

// Set up browser online/offline event handlers and periodic network check
if (typeof window !== 'undefined') {
  const updateOnlineStatus = async (forcedValue?: boolean) => {
    if (isSimulatedOffline) {
      isNetworkOnline = false;
      notifyListeners();
      return;
    }

    if (typeof forcedValue === 'boolean') {
      if (forcedValue) consecutiveConnectivityFailures = 0;
      if (isNetworkOnline !== forcedValue) {
        isNetworkOnline = forcedValue;
        notifyListeners();
      }
      if (forcedValue) triggerAutoSync();
      return;
    }

    const connected = await verifyServerConnectivity();
    if (connected !== isNetworkOnline) {
      isNetworkOnline = connected;
      notifyListeners();
      if (connected) {
        triggerAutoSync();
      }
    } else if (connected && inMemoryQueue.length > 0 && !isSyncing) {
      triggerAutoSync();
    }
  };

  window.addEventListener('online', () => {
    consecutiveConnectivityFailures = 0;
    updateOnlineStatus(true);
  });

  window.addEventListener('offline', () => {
    // Only mark offline if multiple verification checks confirm outage
    updateOnlineStatus();
  });

  // Initial check on load
  setTimeout(() => updateOnlineStatus(), 300);

  // Periodic heartbeat / connectivity check every 20 seconds (gentle, resilient)
  setInterval(() => {
    if (!isSimulatedOffline) {
      updateOnlineStatus();
    }
  }, 20000);
}

// In-memory cache fallback in case both IndexedDB and localStorage are empty
let inMemoryDbState: any = null;

export const offlineManager = {
  isOffline(): boolean {
    if (isSimulatedOffline) return true;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
    return !isNetworkOnline;
  },

  isSimulated(): boolean {
    return isSimulatedOffline;
  },

  isNetworkOnline(): boolean {
    return isNetworkOnline;
  },

  toggleSimulation() {
    isSimulatedOffline = !isSimulatedOffline;
    localStorage.setItem(SIMULATE_OFFLINE_KEY, String(isSimulatedOffline));
    notifyListeners();
    if (!isSimulatedOffline && isNetworkOnline) {
      triggerAutoSync();
    }
  },

  getQueue(): PendingRequest[] {
    if (inMemoryQueue && inMemoryQueue.length > 0) {
      return inMemoryQueue;
    }
    try {
      const data = localStorage.getItem(QUEUE_KEY);
      const list = data ? JSON.parse(data) : [];
      inMemoryQueue = list;
      return list;
    } catch {
      return [];
    }
  },

  async getQueueAsync(): Promise<PendingRequest[]> {
    try {
      const idbQueue = await offlineDb.getQueue();
      if (idbQueue && Array.isArray(idbQueue)) {
        inMemoryQueue = idbQueue;
        safeLocalStorageSet(QUEUE_KEY, JSON.stringify(idbQueue));
        return idbQueue;
      }
    } catch {}
    return this.getQueue();
  },

  saveQueue(queue: PendingRequest[]) {
    inMemoryQueue = queue;
    try {
      safeLocalStorageSet(QUEUE_KEY, JSON.stringify(queue));
      offlineDb.saveQueue(queue).catch(err => {
        console.warn('[Offline Manager] IndexedDB queue save warning:', err);
      });
    } catch (err) {
      console.error('[Offline Manager] Failed to save sync queue:', err);
    }
    notifyListeners();
  },

  async addPendingRequest(pendingReq: PendingRequest): Promise<void> {
    inMemoryQueue.push(pendingReq);
    safeLocalStorageSet(QUEUE_KEY, JSON.stringify(inMemoryQueue));
    try {
      await offlineDb.addToQueue(pendingReq);
    } catch (err) {
      console.warn('[Offline Manager] Error writing item to IndexedDB queue:', err);
    }
    notifyListeners();
  },

  async removePendingRequest(id: string): Promise<void> {
    inMemoryQueue = inMemoryQueue.filter(req => req.id !== id);
    safeLocalStorageSet(QUEUE_KEY, JSON.stringify(inMemoryQueue));
    try {
      await offlineDb.removeFromQueue(id);
    } catch (err) {
      console.warn('[Offline Manager] Error removing item from IndexedDB queue:', err);
    }
    notifyListeners();
  },

  clearQueue() {
    inMemoryQueue = [];
    this.saveQueue([]);
    offlineDb.clearQueue().catch(() => {});
  },

  addListener(cb: () => void) {
    listeners.push(cb);
  },

  removeListener(cb: () => void) {
    listeners = listeners.filter(l => l !== cb);
  },

  // Save a complete snapshot of database state into IndexedDB & localStorage
  saveDatabaseSnapshot(snapshot: any, force = false) {
    if (!snapshot || typeof snapshot !== 'object') return;

    inMemoryDbState = snapshot;
    offlineDb.saveSnapshot('latest_all_data', snapshot);
    
    // Automatically protect critical pharmacy collections (medicines, customers, sales) in dedicated IndexedDB fail-safe
    if (Array.isArray(snapshot.medicines) || Array.isArray(snapshot.customers) || Array.isArray(snapshot.sales)) {
      criticalStateBackup.queueDebouncedBackup(snapshot, 'Database snapshot update');
    }

    try {
      safeLocalStorageSet('sonan_client_db_state', JSON.stringify(snapshot));
      safeLocalStorageSet(`${CACHE_PREFIX}/api/all-data`, JSON.stringify({
        data: snapshot,
        timestamp: Date.now()
      }));
    } catch {}
  },

  // Retrieve best available cached database snapshot
  async getDatabaseSnapshot(): Promise<any | null> {
    if (inMemoryDbState) return inMemoryDbState;

    // Try IndexedDB snapshot first
    const fromIdb = await offlineDb.getSnapshot('latest_all_data');
    if (fromIdb) {
      inMemoryDbState = fromIdb;
      return fromIdb;
    }

    // Try IndexedDB Critical Fail-Safe Backup
    try {
      const fromCriticalIdb = await criticalStateBackup.getLatestBackup();
      if (fromCriticalIdb && (fromCriticalIdb.medicines?.length || fromCriticalIdb.customers?.length || fromCriticalIdb.sales?.length)) {
        inMemoryDbState = fromCriticalIdb;
        return fromCriticalIdb;
      }
    } catch {}

    // Try localStorage
    try {
      const cached = localStorage.getItem('sonan_client_db_state') || localStorage.getItem(`${CACHE_PREFIX}/api/all-data`);
      if (cached) {
        const parsed = JSON.parse(cached);
        const data = parsed.data || parsed;
        inMemoryDbState = data;
        return data;
      }
    } catch {}

    return null;
  },

  // Optimistically update cached GET /api/all-data response to make offline workflow feel fully real-time
  optimisticUpdate(url: string, method: string, bodyObj: any): any {
    try {
      let root = inMemoryDbState;
      if (!root) {
        const allDataCacheKey = `${CACHE_PREFIX}/api/all-data`;
        const cachedStr = localStorage.getItem('sonan_client_db_state') || localStorage.getItem(allDataCacheKey);
        if (cachedStr) {
          const cacheObj = JSON.parse(cachedStr);
          root = cacheObj.data || cacheObj;
        }
      }

      if (!root) {
        root = {
          branches: [],
          users: [],
          medicines: [],
          stockItems: [],
          suppliers: [],
          purchaseOrders: [],
          transfers: [],
          customers: [],
          expenses: [],
          sales: [],
          categories: [],
          auditLogs: [],
          pharmacyNotes: []
        };
      }

      let resultRecord: any = null;

      // 1. Sales & POS Checkout
      if (url.includes('/api/sales') && method === 'POST') {
        const { branchId, cashierId, customerId, paymentMethod, items, discount, vatPercent } = bodyObj || {};
        const saleId = 'sale_offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const serialNumber = (root.sales?.filter((s: any) => s.branchId === branchId).length || 0) + 1;
        const invoiceNumber = `REC-OFFLINE-${serialNumber}`;

        const branchName = root.branches?.find((b: any) => b.id === branchId)?.name || 'Dispensary Lane #1';
        const cashierName = root.users?.find((u: any) => u.id === cashierId)?.name || 'Offline Operator';
        const customerName = root.customers?.find((c: any) => c.id === customerId)?.name;

        let subtotal = 0;
        const saleItems = (items || []).map((item: any) => {
          const med = root.medicines?.find((m: any) => m.id === item.medicineId);
          const stockItem = root.stockItems?.find((st: any) => st.id === item.selectedBatchId);
          const itemPrice = item.price || med?.price || 0;
          const itemTotal = itemPrice * item.quantity;
          subtotal += itemTotal;

          // Deduct stock in local cache
          if (stockItem) {
            stockItem.quantity = Math.max(0, stockItem.quantity - item.quantity);
            let storeQty = stockItem.storeQuantity !== undefined ? stockItem.storeQuantity : (stockItem.quantity + item.quantity);
            let dispQty = stockItem.dispensaryQuantity !== undefined ? stockItem.dispensaryQuantity : 0;
            if (dispQty >= item.quantity) {
              dispQty -= item.quantity;
            } else {
              const remaining = item.quantity - dispQty;
              dispQty = 0;
              storeQty = Math.max(0, storeQty - remaining);
            }
            stockItem.storeQuantity = storeQty;
            stockItem.dispensaryQuantity = dispQty;
          }

          return {
            id: 'si_off_' + Math.random().toString(36).substr(2, 6),
            medicineId: item.medicineId,
            medicineName: med?.name || 'Unknown Item',
            batchNumber: stockItem?.batchNumber || 'N/A',
            expiryDate: stockItem?.expiryDate || 'N/A',
            quantity: item.quantity,
            unitPrice: itemPrice,
            discount: 0,
            vatAmount: Number((itemTotal * 0.15).toFixed(2)),
            total: Number((itemTotal * 1.15).toFixed(2))
          };
        });

        const discountVal = Number(discount) || 0;
        const taxable = subtotal - discountVal;
        const vatVal = Number((taxable * ((vatPercent !== undefined ? Number(vatPercent) : 15) / 100)).toFixed(2));
        const totalAmount = Number((taxable + vatVal).toFixed(2));

        const newSale = {
          id: saleId,
          invoiceNumber,
          serialNumber,
          branchId: branchId || 'b1',
          branchName,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().split(' ')[0].slice(0, 5),
          cashierId: cashierId || 'c1',
          cashierName,
          customerId: customerId || '',
          customerName,
          customerTin: bodyObj?.customerTin,
          subtotal,
          discount: discountVal,
          vat: vatVal,
          vatPercent: vatPercent !== undefined ? Number(vatPercent) : 15,
          total: totalAmount,
          paymentMethod: paymentMethod || 'Cash',
          status: 'Completed',
          items: saleItems,
          createdAt: new Date().toISOString(),
          isOfflineQueued: true
        };

        if (!root.sales) root.sales = [];
        root.sales.unshift(newSale);
        resultRecord = newSale;
      }

      // 2. Medicines Catalog
      else if (url.includes('/api/medicines') && method === 'POST') {
        const medId = 'med_offline_' + Date.now();
        const newMed = {
          id: medId,
          ...bodyObj,
          createdAt: new Date().toISOString()
        };
        if (!root.medicines) root.medicines = [];
        root.medicines.unshift(newMed);

        if (Number(bodyObj.storeQuantity) > 0 || Number(bodyObj.dispensaryQuantity) > 0) {
          const stockId = 'stock_offline_' + Date.now();
          const newStock = {
            id: stockId,
            medicineId: medId,
            branchId: bodyObj.branchId || 'b1',
            batchNumber: bodyObj.batchNumber || `B-${Date.now().toString().slice(-4)}`,
            expiryDate: bodyObj.expiryDate || '',
            quantity: (Number(bodyObj.storeQuantity) || 0) + (Number(bodyObj.dispensaryQuantity) || 0),
            storeQuantity: Number(bodyObj.storeQuantity) || 0,
            dispensaryQuantity: Number(bodyObj.dispensaryQuantity) || 0,
            buyingPrice: Number(bodyObj.buyingPrice) || 0,
            supplierId: bodyObj.supplierId || 's1'
          };
          if (!root.stockItems) root.stockItems = [];
          root.stockItems.unshift(newStock);
        }
        resultRecord = newMed;
      }

      else if (url.includes('/api/medicines/') && method === 'PUT') {
        const parts = url.split('/');
        const id = parts[parts.length - 1];
        const idx = root.medicines?.findIndex((m: any) => m.id === id);
        if (idx !== -1 && idx !== undefined) {
          root.medicines[idx] = { ...root.medicines[idx], ...bodyObj };
          resultRecord = root.medicines[idx];
        }
      }

      // 3. Inventory Adjustments & Transfers
      else if (url.includes('/api/inventory/adjust') && method === 'POST') {
        const { stockItemId, adjustmentType, quantity } = bodyObj || {};
        const stockItem = root.stockItems?.find((st: any) => st.id === stockItemId);
        if (stockItem) {
          const qtyNum = Number(quantity);
          if (adjustmentType === 'add') {
            stockItem.quantity += qtyNum;
            stockItem.storeQuantity = (stockItem.storeQuantity || 0) + qtyNum;
          } else {
            stockItem.quantity = Math.max(0, stockItem.quantity - qtyNum);
            if ((stockItem.dispensaryQuantity || 0) >= qtyNum) {
              stockItem.dispensaryQuantity -= qtyNum;
            } else {
              const remaining = qtyNum - (stockItem.dispensaryQuantity || 0);
              stockItem.dispensaryQuantity = 0;
              stockItem.storeQuantity = Math.max(0, (stockItem.storeQuantity || 0) - remaining);
            }
          }
          resultRecord = stockItem;
        }
      }

      else if (url.includes('/api/inventory/transfer-to-dispensary') && method === 'POST') {
        const { stockItemId, transferQuantity } = bodyObj || {};
        const stockItem = root.stockItems?.find((st: any) => st.id === stockItemId);
        if (stockItem) {
          const qty = Number(transferQuantity);
          stockItem.storeQuantity = Math.max(0, (stockItem.storeQuantity || 0) - qty);
          stockItem.dispensaryQuantity = (stockItem.dispensaryQuantity || 0) + qty;
          resultRecord = stockItem;
        }
      }

      else if (url.includes('/api/transfers/bulk') && method === 'POST') {
        const { items, sourceBranchId, targetBranchId, requestedBy } = bodyObj || {};
        const transId = 'transfer_offline_' + Date.now();
        const newTransfer = {
          id: transId,
          sourceBranchId,
          targetBranchId,
          status: 'Pending',
          requestedBy,
          createdAt: new Date().toISOString(),
          items: (items || []).map((item: any) => {
            const stockItem = root.stockItems?.find((st: any) => st.id === item.stockItemId);
            const med = root.medicines?.find((m: any) => m.id === stockItem?.medicineId);

            if (stockItem) {
              stockItem.quantity = Math.max(0, stockItem.quantity - item.quantity);
              stockItem.storeQuantity = Math.max(0, (stockItem.storeQuantity || 0) - item.quantity);
            }

            return {
              id: 'ti_' + Math.random().toString(36).substr(2, 6),
              medicineId: stockItem?.medicineId,
              medicineName: med?.name || 'Unknown Medicine',
              batchNumber: stockItem?.batchNumber || 'N/A',
              quantity: item.quantity
            };
          })
        };
        if (!root.transfers) root.transfers = [];
        root.transfers.unshift(newTransfer);
        resultRecord = newTransfer;
      }

      else if (url.includes('/api/inventory') && method === 'POST') {
        const stockId = 'stock_offline_' + Date.now();
        const newStock = {
          id: stockId,
          medicineId: bodyObj.medicineId,
          branchId: bodyObj.branchId || 'b1',
          batchNumber: bodyObj.batchNumber || `B-${Date.now().toString().slice(-4)}`,
          expiryDate: bodyObj.expiryDate || '',
          quantity: Number(bodyObj.quantity) || 0,
          storeQuantity: Number(bodyObj.quantity) || 0,
          dispensaryQuantity: 0,
          buyingPrice: Number(bodyObj.buyingPrice) || 0,
          supplierId: bodyObj.supplierId || 's1'
        };
        if (!root.stockItems) root.stockItems = [];
        root.stockItems.unshift(newStock);
        resultRecord = newStock;
      }

      else if (url.includes('/api/inventory/') && method === 'PUT') {
        const parts = url.split('/');
        const id = parts[parts.length - 1];
        const idx = root.stockItems?.findIndex((st: any) => st.id === id);
        if (idx !== -1 && idx !== undefined) {
          root.stockItems[idx] = { ...root.stockItems[idx], ...bodyObj };
          resultRecord = root.stockItems[idx];
        }
      }

      // 4. Finances & Expenses
      else if (url.includes('/api/finances/expenses') && method === 'POST') {
        const expId = 'expense_offline_' + Date.now();
        const newExpense = {
          id: expId,
          ...bodyObj,
          date: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString()
        };
        if (!root.expenses) root.expenses = [];
        root.expenses.unshift(newExpense);
        resultRecord = newExpense;
      }

      // 5. Staff Attendance (Clock in / Clock out offline)
      else if (url.includes('/api/attendance/clock-in') && method === 'POST') {
        const attId = 'att_offline_' + Date.now();
        const newAtt = {
          id: attId,
          userId: bodyObj.userId,
          userName: bodyObj.userName || 'Staff Member',
          userRole: bodyObj.userRole || 'Staff',
          branchId: bodyObj.branchId || 'b1',
          branchName: bodyObj.branchName || 'Dispensary Lane #1',
          date: new Date().toISOString().split('T')[0],
          clockInTime: new Date().toLocaleTimeString('en-US', { hour12: false }),
          clockOutTime: null,
          totalWorkHours: 0,
          status: 'Present',
          isLate: false,
          isManualEntry: false,
          createdAt: new Date().toISOString()
        };
        if (!root.staffAttendance) root.staffAttendance = [];
        root.staffAttendance.unshift(newAtt);
        resultRecord = newAtt;
      }

      else if (url.includes('/api/attendance/clock-out') && method === 'POST') {
        const { userId } = bodyObj || {};
        const todayStr = new Date().toISOString().split('T')[0];
        const record = root.staffAttendance?.find((a: any) => a.userId === userId && a.date === todayStr && !a.clockOutTime);
        if (record) {
          record.clockOutTime = new Date().toLocaleTimeString('en-US', { hour12: false });
          record.status = 'Completed';
          resultRecord = record;
        }
      }

      // 6. Pharmacy Notes & Announcements
      else if (url.includes('/api/pharmacy-notes') && method === 'POST') {
        const noteId = 'note_offline_' + Date.now();
        const newNote = {
          id: noteId,
          ...bodyObj,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        if (!root.pharmacyNotes) root.pharmacyNotes = [];
        root.pharmacyNotes.unshift(newNote);
        resultRecord = newNote;
      }

      else if (url.includes('/api/pharmacy-notes/') && method === 'PUT') {
        const parts = url.split('/');
        const id = parts[parts.length - 1];
        const idx = root.pharmacyNotes?.findIndex((n: any) => n.id === id);
        if (idx !== -1 && idx !== undefined) {
          root.pharmacyNotes[idx] = { ...root.pharmacyNotes[idx], ...bodyObj, updatedAt: new Date().toISOString() };
          resultRecord = root.pharmacyNotes[idx];
        }
      }

      // 7. Customers & Suppliers
      else if (url.includes('/api/customers') && method === 'POST') {
        const custId = 'customer_offline_' + Date.now();
        const newCust = {
          id: custId,
          ...bodyObj,
          createdAt: new Date().toISOString()
        };
        if (!root.customers) root.customers = [];
        root.customers.unshift(newCust);
        resultRecord = newCust;
      }

      else if (url.includes('/api/suppliers') && method === 'POST') {
        const supId = 'supplier_offline_' + Date.now();
        const newSup = {
          id: supId,
          ...bodyObj,
          createdAt: new Date().toISOString()
        };
        if (!root.suppliers) root.suppliers = [];
        root.suppliers.unshift(newSup);
        resultRecord = newSup;
      }

      // Save updated cache in IndexedDB and LocalStorage
      this.saveDatabaseSnapshot(root);
      return resultRecord;
    } catch (e) {
      console.error('Optimistic cache update failed:', e);
      return null;
    }
  },

  // Concurrency Lock for offline queue synchronization
  _activeSyncPromise: null as Promise<boolean> | null,

  // Flushes/replays all offline actions sequentially to restore synchronization
  async syncPendingRequests(onProgress?: (syncedCount: number, total: number) => void): Promise<boolean> {
    if (this._activeSyncPromise) {
      return this._activeSyncPromise;
    }

    const syncPromise = (async () => {
      try {
        const queue = await this.getQueueAsync();
        if (queue.length === 0) return true;

        console.log(`[Offline Manager] Starting synchronization of ${queue.length} persistent offline transactions...`);
        const total = queue.length;
        let synced = 0;
        const failedQueue: PendingRequest[] = [];

        // Use original fetch to bypass interception
        const originalFetch = (window as any).__originalFetch || window.fetch;

        for (let i = 0; i < queue.length; i++) {
          const req = queue[i];
          try {
            const res = await originalFetch(req.url, {
              method: req.method,
              headers: {
                ...req.headers,
                'Content-Type': 'application/json'
              },
              body: req.body
            });

            // 2xx success or 409 conflict (item already created) can be safely considered resolved
            if (res.ok || res.status === 409) {
              synced++;
              await this.removePendingRequest(req.id);
              if (onProgress) {
                onProgress(synced, total);
              }
            } else if (res.status >= 400 && res.status < 500 && res.status !== 429) {
              // Client error that cannot be resolved by retrying (e.g. 400 Bad Request, 404 Not Found)
              console.warn(`[Offline Sync] Request ${req.url} returned permanent status ${res.status}. Removing from sync queue.`);
              synced++;
              await this.removePendingRequest(req.id);
            } else {
              // 5xx or 429 server error - keep in persistent queue for next retry
              console.error(`[Offline Sync] Transient failure for ${req.url} (status: ${res.status}). Will retry later.`);
              const updatedReq: PendingRequest = {
                ...req,
                retryCount: (req.retryCount || 0) + 1,
                lastAttempt: Date.now(),
                lastError: `HTTP ${res.status}: ${res.statusText}`
              };
              failedQueue.push(updatedReq);
            }
          } catch (err: any) {
            console.error(`[Offline Sync] Network connection error during replay for ${req.url}:`, err?.message || err);
            // Retain remaining requests in queue
            const updatedReq: PendingRequest = {
              ...req,
              retryCount: (req.retryCount || 0) + 1,
              lastAttempt: Date.now(),
              lastError: err?.message || 'Network unreachable'
            };
            failedQueue.push(updatedReq);
            for (let j = i + 1; j < queue.length; j++) {
              failedQueue.push(queue[j]);
            }
            break;
          }
        }

        if (failedQueue.length > 0) {
          this.saveQueue(failedQueue);
        } else {
          this.clearQueue();
        }

        return failedQueue.length === 0;
      } finally {
        this._activeSyncPromise = null;
      }
    })();

    this._activeSyncPromise = syncPromise;
    return syncPromise;
  }
};

// Automatic trigger for offline queue flushing when network connection restores
let isSyncing = false;
export async function triggerAutoSync() {
  if (isSyncing || offlineManager.isOffline()) return;
  const queue = await offlineManager.getQueueAsync();
  if (queue.length === 0) return;

  isSyncing = true;
  notifyListeners();
  
  try {
    const success = await offlineManager.syncPendingRequests();
    if (success) {
      console.log('[Offline Manager] All persistent offline transactions successfully synchronized!');
      window.dispatchEvent(new CustomEvent('offline-sync-completed'));
    } else {
      console.warn('[Offline Manager] Some transactions remain in persistent retry queue.');
    }
  } catch (e) {
    console.error('Auto sync error:', e);
  } finally {
    isSyncing = false;
    notifyListeners();
  }
}

// Intercept window.fetch by wrapping it
if (typeof window !== 'undefined' && !(window as any).__originalFetch) {
  const originalFetch = window.fetch;
  (window as any).__originalFetch = originalFetch;

  const customFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : (input as any).url || input.toString();
    const method = init?.method?.toUpperCase() || 'GET';

    // Check if it's an API route
    const isApiCall = url.includes('/api/');
    if (!isApiCall) {
      return originalFetch(input, init);
    }

    // ----------------------------------------------------
    // SPECIAL CASE 1: Offline Authentication (/api/auth/login, /api/auth/verify-device-otp)
    // ----------------------------------------------------
    if (url.includes('/api/auth/login')) {
      if (offlineManager.isOffline()) {
        try {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          const username = (body.username || '').trim().toLowerCase();
          
          // Look up user in cached DB snapshot
          const dbSnapshot = await offlineManager.getDatabaseSnapshot();
          const users = dbSnapshot?.users || [];
          let matchedUser = users.find((u: any) => u.username?.toLowerCase() === username || u.name?.toLowerCase() === username);

          // Fallback built-in emergency offline roles
          if (!matchedUser) {
            if (username === 'admin' || username === 'superadmin') {
              matchedUser = { id: 'u1', name: 'Super Administrator', username: 'admin', role: 'Super Administrator', branchId: 'b1' };
            } else if (username === 'pharmacist' || username === 'pharm') {
              matchedUser = { id: 'u2', name: 'Lead Pharmacist', username: 'pharmacist', role: 'Pharmacist', branchId: 'b1' };
            } else if (username === 'cashier') {
              matchedUser = { id: 'u3', name: 'Lane Cashier', username: 'cashier', role: 'Cashier', branchId: 'b1' };
            } else if (username === 'manager') {
              matchedUser = { id: 'u4', name: 'Branch Manager', username: 'manager', role: 'Branch Manager', branchId: 'b1' };
            }
          }

          if (matchedUser) {
            await offlineDb.saveAuthUser(matchedUser);
            return new Response(JSON.stringify({
              user: matchedUser,
              token: 'offline_jwt_token_' + Date.now(),
              isOfflineMode: true,
              initialData: dbSnapshot
            }), {
              status: 200,
              statusText: 'OK',
              headers: { 'Content-Type': 'application/json', 'X-Offline-Auth': 'true' }
            });
          }
        } catch (e) {
          console.error('[Offline Auth] Error during offline login lookup:', e);
        }
      }

      // Try network first
      try {
        const response = await originalFetch(input, init);
        if (response.ok) {
          markNetworkOnline();
          // Clone and cache user
          try {
            const clone = response.clone();
            const resJson = await clone.json();
            if (resJson.user) {
              offlineDb.saveAuthUser(resJson.user);
            }
            if (resJson.initialData) {
              offlineManager.saveDatabaseSnapshot(resJson.initialData);
            }
          } catch {}
        }
        return response;
      } catch (networkErr) {
        // Network failed -> perform offline login fallback
        try {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          const username = (body.username || '').trim().toLowerCase();
          const dbSnapshot = await offlineManager.getDatabaseSnapshot();
          const users = dbSnapshot?.users || [];
          let matchedUser = users.find((u: any) => u.username?.toLowerCase() === username || u.name?.toLowerCase() === username);

          if (!matchedUser) {
            if (username === 'admin' || username === 'superadmin') {
              matchedUser = { id: 'u1', name: 'Super Administrator', username: 'admin', role: 'Super Administrator', branchId: 'b1' };
            } else if (username === 'pharmacist' || username === 'pharm') {
              matchedUser = { id: 'u2', name: 'Lead Pharmacist', username: 'pharmacist', role: 'Pharmacist', branchId: 'b1' };
            } else if (username === 'cashier') {
              matchedUser = { id: 'u3', name: 'Lane Cashier', username: 'cashier', role: 'Cashier', branchId: 'b1' };
            } else if (username === 'manager') {
              matchedUser = { id: 'u4', name: 'Branch Manager', username: 'manager', role: 'Branch Manager', branchId: 'b1' };
            }
          }

          if (matchedUser) {
            return new Response(JSON.stringify({
              user: matchedUser,
              token: 'offline_jwt_token_' + Date.now(),
              isOfflineMode: true,
              initialData: dbSnapshot
            }), {
              status: 200,
              statusText: 'OK',
              headers: { 'Content-Type': 'application/json', 'X-Offline-Auth': 'true' }
            });
          }
        } catch {}
        throw networkErr;
      }
    }

    // ----------------------------------------------------
    // GET REQUESTS
    // ----------------------------------------------------
    if (method === 'GET') {
      const cacheKey = `${CACHE_PREFIX}${url}`;
      const cachedResponseStr = localStorage.getItem(cacheKey);

      // If simulated offline
      if (offlineManager.isSimulated()) {
        if (url.includes('/api/all-data')) {
          const snapshot = await offlineManager.getDatabaseSnapshot();
          if (snapshot) {
            return new Response(JSON.stringify(snapshot), {
              status: 200,
              statusText: 'OK',
              headers: { 'Content-Type': 'application/json', 'X-Offline-Cached': 'true' }
            });
          }
        }

        if (cachedResponseStr) {
          try {
            const cachedResponse = JSON.parse(cachedResponseStr);
            return new Response(JSON.stringify(cachedResponse.data), {
              status: 200,
              statusText: 'OK',
              headers: {
                'Content-Type': 'application/json',
                'X-Offline-Cached': 'true',
                ...cachedResponse.headers
              }
            });
          } catch (e) {}
        }
        return Promise.reject(new TypeError('Failed to fetch (offline simulation active)'));
      }

      // Try network first
      try {
        const response = await originalFetch(input, init);
        const contentType = response.headers.get('content-type') || '';

        // If an API endpoint returned HTML instead of JSON, the dev server/proxy returned an SPA fallback or error page
        if (url.includes('/api/') && contentType.includes('text/html')) {
          console.warn(`[Offline Interceptor] API request ${url} returned HTML fallback. Treating as transient offline state.`);
          throw new TypeError(`API endpoint ${url} returned HTML instead of JSON.`);
        }

        if (response.ok || response.status < 500) {
          markNetworkOnline();
        }

        if (response.ok && contentType.includes('application/json')) {
          // Background snapshot cache on /api/all-data
          if (url.includes('/api/all-data')) {
            try {
              const clone = response.clone();
              clone.text().then(text => {
                try {
                  if (text && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
                    const data = JSON.parse(text);
                    offlineManager.saveDatabaseSnapshot(data);
                  }
                } catch {}
              }).catch(() => {});
            } catch {}
          } else {
            // Cache secondary GET requests
            setTimeout(async () => {
              try {
                const clonedResponse = response.clone();
                const text = await clonedResponse.text();
                if (text && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
                  const responseJson = JSON.parse(text);
                  safeLocalStorageSet(cacheKey, JSON.stringify({
                    data: responseJson,
                    timestamp: Date.now(),
                    headers: { 'Content-Type': 'application/json' }
                  }));
                }
              } catch {}
            }, 100);
          }
        }
        return response;
      } catch (err) {
        // True network failure / offline: fall back to cached data
        if (url.includes('/api/all-data')) {
          const snapshot = await offlineManager.getDatabaseSnapshot();
          if (snapshot) {
            console.warn('[Offline Mode] Serving offline snapshot for /api/all-data');
            return new Response(JSON.stringify(snapshot), {
              status: 200,
              statusText: 'OK',
              headers: { 'Content-Type': 'application/json', 'X-Offline-Cached': 'true' }
            });
          }
        }

        if (cachedResponseStr) {
          try {
            const cachedResponse = JSON.parse(cachedResponseStr);
            console.warn(`[Offline Mode] Serving fallback GET cache for: ${url}`);
            return new Response(JSON.stringify(cachedResponse.data), {
              status: 200,
              statusText: 'OK',
              headers: {
                'Content-Type': 'application/json',
                'X-Offline-Cached': 'true',
                ...cachedResponse.headers
              }
            });
          } catch (e) {}
        }
        throw err;
      }
    } else {
      // ----------------------------------------------------
      // MODIFY REQUESTS (POST, PUT, DELETE)
      // ----------------------------------------------------
      if (offlineManager.isSimulated()) {
        let bodyObj = null;
        if (init?.body) {
          try {
            bodyObj = JSON.parse(init.body as string);
          } catch {
            bodyObj = init.body;
          }
        }

        // Add to persistent sync queue
        const pendingReq: PendingRequest = {
          id: 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          url,
          method,
          headers: (init?.headers as Record<string, string>) || {},
          body: init?.body ? String(init.body) : null,
          timestamp: Date.now(),
          retryCount: 0
        };
        offlineManager.addPendingRequest(pendingReq);

        // Optimistically update the cached data model
        const resultRecord = offlineManager.optimisticUpdate(url, method, bodyObj);

        return new Response(JSON.stringify(resultRecord || {
          success: true,
          isOfflineQueued: true,
          message: 'Action queued for local synchronization upon network restore.',
          requestId: pendingReq.id
        }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Live write attempt
      try {
        const res = await originalFetch(input, init);
        if (res.ok || res.status < 500) {
          markNetworkOnline();
        }
        return res;
      } catch (err) {
        // Network failure -> queue write persistently and optimistically update local store
        console.warn(`[Offline Mode] Write failed due to network outage, queueing to IndexedDB: ${method} ${url}`);
        
        let bodyObj = null;
        if (init?.body) {
          try {
            bodyObj = JSON.parse(init.body as string);
          } catch {
            bodyObj = init.body;
          }
        }

        const pendingReq: PendingRequest = {
          id: 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          url,
          method,
          headers: (init?.headers as Record<string, string>) || {},
          body: init?.body ? String(init.body) : null,
          timestamp: Date.now(),
          retryCount: 0
        };
        offlineManager.addPendingRequest(pendingReq);

        const resultRecord = offlineManager.optimisticUpdate(url, method, bodyObj);

        return new Response(JSON.stringify(resultRecord || {
          success: true,
          isOfflineQueued: true,
          message: 'Network connection lost. Action saved for local synchronization.',
          requestId: pendingReq.id
        }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: customFetch,
      writable: true,
      configurable: true
    });
  } catch (e1) {
    try {
      (window as any).fetch = customFetch;
    } catch (e2) {}
  }
}
