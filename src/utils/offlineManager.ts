// Offline Support and Synchronization Manager
// Intercepts window.fetch to support offline reads, optimistic offline writes, and automatic background queue synchronization.

export interface PendingRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  timestamp: number;
}

const CACHE_PREFIX = 'offline_cache_';
const QUEUE_KEY = 'pending_sync_queue';
const SIMULATE_OFFLINE_KEY = 'simulate_offline_mode';

let isSimulatedOffline = localStorage.getItem(SIMULATE_OFFLINE_KEY) === 'true';
let isNetworkOnline = navigator.onLine;
let listeners: Array<() => void> = [];

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
          console.warn('[Offline Storage Check] Swallowed storage exception: Unable to free up enough space:', finalErr);
        }
      }
    } else {
      console.warn('[Offline Storage Check] Swallowed non-quota storage error:', e);
    }
  }
}

// Set up browser online/offline event handlers
window.addEventListener('online', () => {
  isNetworkOnline = true;
  notifyListeners();
  triggerAutoSync();
});

window.addEventListener('offline', () => {
  isNetworkOnline = false;
  notifyListeners();
});

export const offlineManager = {
  isOffline(): boolean {
    return isSimulatedOffline || !isNetworkOnline;
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
    try {
      const data = localStorage.getItem(QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveQueue(queue: PendingRequest[]) {
    try {
      safeLocalStorageSet(QUEUE_KEY, JSON.stringify(queue));
    } catch (err) {
      console.error('[Offline Manager] Failed to save sync queue:', err);
    }
    notifyListeners();
  },

  clearQueue() {
    this.saveQueue([]);
  },

  addListener(cb: () => void) {
    listeners.push(cb);
  },

  removeListener(cb: () => void) {
    listeners = listeners.filter(l => l !== cb);
  },

  // Optimistically update cached GET /api/all-data response to make offline workflow feel fully real-time
  optimisticUpdate(url: string, method: string, bodyObj: any): any {
    try {
      const allDataCacheKey = `${CACHE_PREFIX}/api/all-data`;
      const cachedStr = localStorage.getItem(allDataCacheKey);
      if (!cachedStr) return null;

      const cacheObj = JSON.parse(cachedStr);
      if (!cacheObj || !cacheObj.data) return null;

      const db = cacheObj.data; // Server response for /api/all-data contains { data: { medicines, stockItems, ... } } or directly properties depending on structure

      // Standardize data representation (might be directly root properties or nested under data)
      const root = db.medicines ? db : (db.data || {});
      let resultRecord: any = null;

      if (url.includes('/api/sales') && method === 'POST') {
        const { branchId, cashierId, customerId, paymentMethod, items, discount, vatPercent } = bodyObj;
        const saleId = 'sale_offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const serialNumber = (root.sales?.filter((s: any) => s.branchId === branchId).length || 0) + 1;
        const invoiceNumber = `REC-OFFLINE-${serialNumber}`;

        const branchName = root.branches?.find((b: any) => b.id === branchId)?.name || 'Dispensary Lane #1';
        const cashierName = root.users?.find((u: any) => u.id === cashierId)?.name || 'Offline Operator';
        const customerName = root.customers?.find((c: any) => c.id === customerId)?.name;

        let subtotal = 0;
        const saleItems = items.map((item: any) => {
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
            id: 'si_off_' + Math.random(),
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
          branchId,
          branchName,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().split(' ')[0].slice(0, 5),
          cashierId: cashierId || 'c1',
          cashierName,
          customerId: customerId || '',
          customerName,
          customerTin: bodyObj.customerTin,
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
        if (idx !== -1) {
          root.medicines[idx] = { ...root.medicines[idx], ...bodyObj };
          resultRecord = root.medicines[idx];
        }
      }

      else if (url.includes('/api/inventory/adjust') && method === 'POST') {
        const { stockItemId, adjustmentType, quantity } = bodyObj;
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
        const { stockItemId, transferQuantity } = bodyObj;
        const stockItem = root.stockItems?.find((st: any) => st.id === stockItemId);
        if (stockItem) {
          const qty = Number(transferQuantity);
          stockItem.storeQuantity = Math.max(0, (stockItem.storeQuantity || 0) - qty);
          stockItem.dispensaryQuantity = (stockItem.dispensaryQuantity || 0) + qty;
          resultRecord = stockItem;
        }
      }

      else if (url.includes('/api/transfers/bulk') && method === 'POST') {
        const { items, sourceBranchId, targetBranchId, requestedBy } = bodyObj;
        const transId = 'transfer_offline_' + Date.now();
        const newTransfer = {
          id: transId,
          sourceBranchId,
          targetBranchId,
          status: 'Pending',
          requestedBy,
          createdAt: new Date().toISOString(),
          items: items.map((item: any) => {
            const stockItem = root.stockItems?.find((st: any) => st.id === item.stockItemId);
            const med = root.medicines?.find((m: any) => m.id === stockItem?.medicineId);

            if (stockItem) {
              stockItem.quantity = Math.max(0, stockItem.quantity - item.quantity);
              stockItem.storeQuantity = Math.max(0, (stockItem.storeQuantity || 0) - item.quantity);
            }

            return {
              id: 'ti_' + Math.random(),
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
        if (idx !== -1) {
          root.stockItems[idx] = { ...root.stockItems[idx], ...bodyObj };
          resultRecord = root.stockItems[idx];
        }
      }

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
        if (idx !== -1) {
          root.pharmacyNotes[idx] = { ...root.pharmacyNotes[idx], ...bodyObj, updatedAt: new Date().toISOString() };
          resultRecord = root.pharmacyNotes[idx];
        }
      }

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

      // Save updated cache
      safeLocalStorageSet(allDataCacheKey, JSON.stringify(cacheObj));
      return resultRecord;
    } catch (e) {
      console.error('Optimistic cache update failed:', e);
      return null;
    }
  },

  // Flushes/replays all offline actions sequentially to restore synchronization
  async syncPendingRequests(onProgress?: (syncedCount: number, total: number) => void): Promise<boolean> {
    const queue = this.getQueue();
    if (queue.length === 0) return true;

    console.log(`Starting synchronization of ${queue.length} offline transactions...`);
    const total = queue.length;
    let synced = 0;

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

        if (res.ok) {
          synced++;
          if (onProgress) {
            onProgress(synced, total);
          }
        } else {
          console.error(`Offline sync request failed for ${req.url}:`, res.statusText);
          // To keep local sequence order, we can continue or pause, but let's continue to drain queue if possible
        }
      } catch (err) {
        console.error(`Network error during offline replay for ${req.url}:`, err);
        // Break out to try again later since network is probably still unstable
        return false;
      }
    }

    // Clear queue after full or partial processing
    const remaining = queue.slice(synced);
    this.saveQueue(remaining);

    // Trigger full fresh reload
    return remaining.length === 0;
  }
};

// Automatic trigger for offline queue flushing when network connection restores
let isSyncing = false;
export async function triggerAutoSync() {
  if (isSyncing || offlineManager.isOffline()) return;
  const queue = offlineManager.getQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  notifyListeners();
  
  try {
    const success = await offlineManager.syncPendingRequests();
    if (success) {
      console.log('Offline transactions successfully synchronized!');
      // Dispatch custom event so app can refresh its collections
      window.dispatchEvent(new CustomEvent('offline-sync-completed'));
    }
  } catch (e) {
    console.error('Auto sync error:', e);
  } finally {
    isSyncing = false;
    notifyListeners();
  }
}

// Intercept window.fetch by wrapping it
if (!(window as any).__originalFetch) {
  const originalFetch = window.fetch;
  (window as any).__originalFetch = originalFetch;

  const customFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : (input as any).url || input.toString();
    const method = init?.method?.toUpperCase() || 'GET';

    // Check if it's an API route that we want to manage for offline support
    const isApiCall = url.includes('/api/') && !url.includes('/api/auth/');

    if (!isApiCall) {
      return originalFetch(input, init);
    }

    if (method === 'GET') {
      const cacheKey = `${CACHE_PREFIX}${url}`;
      const cachedResponseStr = localStorage.getItem(cacheKey);

      // If in explicit simulated offline mode (manually triggered in UI for testing)
      if (offlineManager.isSimulated()) {
        if (cachedResponseStr) {
          try {
            const cachedResponse = JSON.parse(cachedResponseStr);
            console.log(`[Simulated Offline Mode] Serving GET response from local cache: ${url}`);
            return new Response(JSON.stringify(cachedResponse.data), {
              status: 200,
              statusText: 'OK',
              headers: {
                'Content-Type': 'application/json',
                'X-Offline-Cached': 'true',
                ...cachedResponse.headers
              }
            });
          } catch (e) {
            console.error('Failed to parse cached response:', e);
          }
        }
        return Promise.reject(new TypeError('Failed to fetch (offline simulation active)'));
      }

      // Always perform live network request first to guarantee latest server database data
      try {
        const response = await originalFetch(input, init);
        if (response.ok) {
          isNetworkOnline = true;
          // Asynchronously cache non-poll endpoints in background without blocking caller response
          const shouldCache = !url.includes('/api/teleconsultations') && 
                              !url.includes('/api/pharmacy-notes') && 
                              !url.includes('/api/all-data') &&
                              !url.includes('/api/auth');
          if (shouldCache) {
            setTimeout(async () => {
              try {
                const clonedResponse = response.clone();
                const responseJson = await clonedResponse.json();
                safeLocalStorageSet(cacheKey, JSON.stringify({
                  data: responseJson,
                  timestamp: Date.now(),
                  headers: {
                    'Content-Type': 'application/json'
                  }
                }));
              } catch (storageErr) {
                // non-critical
              }
            }, 100);
          }
        }
        return response;
      } catch (err) {
        // True network failure / offline: fall back to cached data
        if (cachedResponseStr) {
          try {
            const cachedResponse = JSON.parse(cachedResponseStr);
            console.warn(`[Network Offline / Server Unreachable] Serving fallback GET cache for: ${url}`);
            return new Response(JSON.stringify(cachedResponse.data), {
              status: 200,
              statusText: 'OK',
              headers: {
                'Content-Type': 'application/json',
                'X-Offline-Cached': 'true',
                ...cachedResponse.headers
              }
            });
          } catch (e) {
            console.error('Failed to parse cached response:', e);
          }
        }
        throw err;
      }
    } else {
      // Modify request (POST, PUT, DELETE)
      if (offlineManager.isSimulated()) {
        console.log(`[Simulated Offline Mode] Intercepting modify request: ${method} ${url}`);
        
        let bodyObj = null;
        if (init?.body) {
          try {
            bodyObj = JSON.parse(init.body as string);
          } catch {
            bodyObj = init.body;
          }
        }

        // Add to pending sync queue
        const queue = offlineManager.getQueue();
        const pendingReq: PendingRequest = {
          id: 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          url,
          method,
          headers: (init?.headers as Record<string, string>) || {},
          body: init?.body ? String(init.body) : null,
          timestamp: Date.now()
        };
        queue.push(pendingReq);
        offlineManager.saveQueue(queue);

        // Optimistically update the cached data model
        const resultRecord = offlineManager.optimisticUpdate(url, method, bodyObj);

        // Simulated successful response
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

      // If not simulated, send directly to server
      try {
        const res = await originalFetch(input, init);
        isNetworkOnline = true;
        return res;
      } catch (err) {
        // Unstable connection or failed write -> intercept and save to queue
        console.warn(`[Unstable Connection] Write failed, saving to sync queue: ${method} ${url}`);
        
        let bodyObj = null;
        if (init?.body) {
          try {
            bodyObj = JSON.parse(init.body as string);
          } catch {
            bodyObj = init.body;
          }
        }

        const queue = offlineManager.getQueue();
        const pendingReq: PendingRequest = {
          id: 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          url,
          method,
          headers: (init?.headers as Record<string, string>) || {},
          body: init?.body ? String(init.body) : null,
          timestamp: Date.now()
        };
        queue.push(pendingReq);
        offlineManager.saveQueue(queue);

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
    console.warn("Failed to define window.fetch via Object.defineProperty. Trying direct assignment...", e1);
    try {
      (window as any).fetch = customFetch;
    } catch (e2) {
      console.error("Window.fetch is completely read-only. Attempting globalThis patch...", e2);
      try {
        Object.defineProperty(globalThis, 'fetch', {
          value: customFetch,
          writable: true,
          configurable: true
        });
      } catch (e3) {
        console.error("Could not override fetch on globalThis either.", e3);
      }
    }
  }
}
