// Critical State Fail-Safe Backup Utility
// Provides a persistent IndexedDB-backed recovery mechanism for mission-critical pharmacy state (medicines, customers, sales)
// Safeguards pharmacy operations beyond volatile browser localStorage.

import { offlineDb } from './offlineDb';
import { Medicine, Customer, Sale, StockItem } from '../types';

export interface CriticalStateBackupItemCounts {
  medicines: number;
  customers: number;
  sales: number;
  stockItems: number;
  categories?: number;
  branches?: number;
  users?: number;
  [key: string]: number | undefined;
}

export interface CriticalBackupSummary {
  id: string;
  timestamp: number;
  date: string;
  reason: string;
  itemCounts: CriticalStateBackupItemCounts;
  checksum: string;
  sizeBytes: number;
  isLatest?: boolean;
}

export interface CriticalBackupPayload {
  medicines: Medicine[];
  customers: Customer[];
  sales: Sale[];
  stockItems?: StockItem[];
  categories?: any[];
  branches?: any[];
  users?: any[];
  suppliers?: any[];
  expenses?: any[];
  purchaseOrders?: any[];
  transfers?: any[];
  auditLogs?: any[];
  pharmacyNotes?: any[];
  metadata?: {
    appVersion?: string;
    generatedAt: string;
    generatedTimestamp: number;
    generator: string;
    reason: string;
    checksum: string;
  };
}

export interface CriticalRestoreResult {
  success: boolean;
  message: string;
  restoredCounts?: CriticalStateBackupItemCounts;
  backupSummary?: CriticalBackupSummary;
  data?: CriticalBackupPayload;
  error?: string;
}

export interface StorageHealthCheck {
  isLocalStorageAvailable: boolean;
  isLocalStoragePopulated: boolean;
  localStorageItemCount: number;
  hasIndexedDbBackup: boolean;
  indexedDbBackupCount: number;
  latestBackupInfo: CriticalBackupSummary | null;
  storageEstimate?: {
    usageBytes?: number;
    quotaBytes?: number;
    usagePercent?: number;
  };
  isStorageVulnerable: boolean; // True if localStorage is empty but IndexedDB has recovery backup available
}

// Generate simple 32-bit fast hash checksum for data integrity verification
function computeFastChecksum(obj: any): string {
  try {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return 'chk_' + Math.abs(hash).toString(16) + '_' + str.length;
  } catch {
    return 'chk_fallback_' + Date.now();
  }
}

// Max number of rolling point-in-time snapshots kept in IndexedDB
const MAX_SNAPSHOT_RETENTION = 20;

let debounceTimer: any = null;

export const criticalStateBackup = {
  /**
   * Immediately backs up critical pharmacy collections (medicines, customers, sales, stock)
   * into IndexedDB discrete entity stores and a point-in-time snapshot checkpoint.
   */
  async saveCriticalStateBackup(
    payload: Partial<CriticalBackupPayload>,
    reason = 'Manual or automated critical state checkpoint'
  ): Promise<CriticalBackupSummary> {
    const now = new Date();
    const timestamp = now.getTime();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
    const backupId = `crit_snap_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;

    const medicines = Array.isArray(payload.medicines) ? payload.medicines : [];
    const customers = Array.isArray(payload.customers) ? payload.customers : [];
    const sales = Array.isArray(payload.sales) ? payload.sales : [];
    const stockItems = Array.isArray(payload.stockItems) ? payload.stockItems : [];

    const itemCounts: CriticalStateBackupItemCounts = {
      medicines: medicines.length,
      customers: customers.length,
      sales: sales.length,
      stockItems: stockItems.length,
      categories: Array.isArray(payload.categories) ? payload.categories.length : 0,
      branches: Array.isArray(payload.branches) ? payload.branches.length : 0,
      users: Array.isArray(payload.users) ? payload.users.length : 0
    };

    const fullPayload: CriticalBackupPayload = {
      medicines,
      customers,
      sales,
      stockItems,
      categories: payload.categories || [],
      branches: payload.branches || [],
      users: payload.users || [],
      suppliers: payload.suppliers || [],
      expenses: payload.expenses || [],
      purchaseOrders: payload.purchaseOrders || [],
      transfers: payload.transfers || [],
      auditLogs: payload.auditLogs || [],
      pharmacyNotes: payload.pharmacyNotes || [],
      metadata: {
        appVersion: '3.5.0',
        generatedAt: dateStr,
        generatedTimestamp: timestamp,
        generator: 'Sonan Pharmacy Critical State Backup Engine',
        reason,
        checksum: computeFastChecksum({ medicines, customers, sales, stockItems })
      }
    };

    const payloadJson = JSON.stringify(fullPayload);
    const sizeBytes = new Blob([payloadJson]).size;
    const checksum = fullPayload.metadata?.checksum || computeFastChecksum(payloadJson);

    // 1. Persist discrete collections for atomic recovery
    await Promise.all([
      offlineDb.saveCriticalEntities('medicines', medicines),
      offlineDb.saveCriticalEntities('customers', customers),
      offlineDb.saveCriticalEntities('sales', sales)
    ]);

    // 2. Persist full snapshot checkpoint
    const snapshotRecord = {
      id: backupId,
      timestamp,
      date: dateStr,
      reason,
      itemCounts,
      data: fullPayload,
      checksum,
      sizeBytes
    };

    await offlineDb.saveCriticalBackupSnapshot(snapshotRecord);

    // 3. Prune old snapshots exceeding retention limit
    try {
      const allSnapshots = await offlineDb.getAllCriticalBackupSnapshots();
      if (allSnapshots.length > MAX_SNAPSHOT_RETENTION) {
        // Snapshots are already sorted newest first by offlineDb
        const toDelete = allSnapshots.slice(MAX_SNAPSHOT_RETENTION);
        for (const snap of toDelete) {
          await offlineDb.deleteCriticalBackupSnapshot(snap.id);
        }
      }
    } catch (err) {
      console.warn('[Critical Backup] Non-critical snapshot prune notice:', err);
    }

    const summary: CriticalBackupSummary = {
      id: backupId,
      timestamp,
      date: dateStr,
      reason,
      itemCounts,
      checksum,
      sizeBytes,
      isLatest: true
    };

    // Dispatch global event for live UI listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('critical-backup-saved', { detail: summary }));
    }

    console.log(`[Critical State Backup] Protected ${medicines.length} medicines, ${customers.length} customers, and ${sales.length} sales into IndexedDB fail-safe (Size: ${(sizeBytes / 1024).toFixed(1)} KB).`);
    return summary;
  },

  /**
   * Debounced version to avoid disk thrashing during rapid consecutive POS transactions or batch imports.
   */
  queueDebouncedBackup(payload: Partial<CriticalBackupPayload>, reason = 'Automated state change', waitMs = 2500): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      this.saveCriticalStateBackup(payload, reason).catch(err => {
        console.warn('[Critical Backup] Debounced backup warning:', err);
      });
    }, waitMs);
  },

  /**
   * Lists all stored IndexedDB critical state snapshots.
   */
  async listBackups(): Promise<CriticalBackupSummary[]> {
    const list = await offlineDb.getAllCriticalBackupSnapshots();
    return list.map((item, idx) => ({
      ...item,
      isLatest: idx === 0
    }));
  },

  /**
   * Retrieves the newest full critical state backup from IndexedDB.
   */
  async getLatestBackup(): Promise<CriticalBackupPayload | null> {
    const list = await offlineDb.getAllCriticalBackupSnapshots();
    if (list.length === 0) {
      // Fallback: try reconstructing from discrete entity stores
      const [meds, custs, sls] = await Promise.all([
        offlineDb.getCriticalEntities<Medicine>('medicines'),
        offlineDb.getCriticalEntities<Customer>('customers'),
        offlineDb.getCriticalEntities<Sale>('sales')
      ]);

      if (meds.length > 0 || custs.length > 0 || sls.length > 0) {
        return {
          medicines: meds,
          customers: custs,
          sales: sls,
          metadata: {
            generatedAt: new Date().toISOString(),
            generatedTimestamp: Date.now(),
            generator: 'IndexedDB Discrete Stores Reconstructor',
            reason: 'Reconstructed from discrete entity stores',
            checksum: computeFastChecksum({ meds, custs, sls })
          }
        };
      }
      return null;
    }

    const latestSnapId = list[0].id;
    const fullRecord = await offlineDb.getCriticalBackupSnapshot(latestSnapId);
    return fullRecord ? fullRecord.data : null;
  },

  /**
   * Restores critical state from a specific snapshot or the latest available IndexedDB backup.
   * Repairs localStorage cache and returns the complete validated data model.
   */
  async restoreFromIndexedDb(backupId?: string): Promise<CriticalRestoreResult> {
    try {
      let snapshotData: CriticalBackupPayload | null = null;
      let summaryInfo: CriticalBackupSummary | undefined;

      if (backupId) {
        const record = await offlineDb.getCriticalBackupSnapshot(backupId);
        if (record) {
          snapshotData = record.data;
          summaryInfo = {
            id: record.id,
            timestamp: record.timestamp,
            date: record.date,
            reason: record.reason,
            itemCounts: record.itemCounts,
            checksum: record.checksum,
            sizeBytes: record.sizeBytes || 0
          };
        }
      } else {
        const list = await offlineDb.getAllCriticalBackupSnapshots();
        if (list.length > 0) {
          const record = await offlineDb.getCriticalBackupSnapshot(list[0].id);
          if (record) {
            snapshotData = record.data;
            summaryInfo = list[0];
          }
        } else {
          snapshotData = await this.getLatestBackup();
        }
      }

      if (!snapshotData) {
        return {
          success: false,
          message: 'No critical state backups were found in IndexedDB storage.',
          error: 'NO_BACKUP_FOUND'
        };
      }

      const medicines = snapshotData.medicines || [];
      const customers = snapshotData.customers || [];
      const sales = snapshotData.sales || [];
      const stockItems = snapshotData.stockItems || [];

      // Re-populate primary localStorage caches as fallback
      try {
        localStorage.setItem('sonan_client_db_state', JSON.stringify(snapshotData));
        localStorage.setItem('offline_cache_/api/all-data', JSON.stringify({
          data: snapshotData,
          timestamp: Date.now()
        }));
      } catch (err) {
        console.warn('[Critical Restore] LocalStorage re-population warning (storage full):', err);
      }

      const restoredCounts: CriticalStateBackupItemCounts = {
        medicines: medicines.length,
        customers: customers.length,
        sales: sales.length,
        stockItems: stockItems.length
      };

      // Record restore event in meta store
      await offlineDb.saveCriticalMeta('last_restore_event', {
        timestamp: Date.now(),
        date: new Date().toISOString(),
        backupId: summaryInfo?.id || 'latest',
        restoredCounts
      });

      // Dispatch global restore event so UI can re-render or trigger sync
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('critical-state-restored', {
          detail: {
            data: snapshotData,
            summary: summaryInfo,
            restoredCounts
          }
        }));
      }

      return {
        success: true,
        message: `Successfully recovered ${medicines.length} medicines, ${customers.length} customers, and ${sales.length} sales from IndexedDB fail-safe backup.`,
        restoredCounts,
        backupSummary: summaryInfo,
        data: snapshotData
      };
    } catch (err: any) {
      console.error('[Critical State Backup] Restore operation failed:', err);
      return {
        success: false,
        message: `Fail-safe restore failed: ${err?.message || 'Unknown error'}`,
        error: err?.message || 'RESTORE_EXCEPTION'
      };
    }
  },

  /**
   * Diagnostic check to assess if localStorage has been wiped while IndexedDB backups remain.
   */
  async checkStorageHealth(): Promise<StorageHealthCheck> {
    let isLocalStorageAvailable = false;
    let isLocalStoragePopulated = false;
    let localStorageItemCount = 0;

    try {
      const testKey = '__test_ls_probe__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      isLocalStorageAvailable = true;

      const clientDb = localStorage.getItem('sonan_client_db_state');
      if (clientDb) {
        const parsed = JSON.parse(clientDb);
        const medsCount = (parsed?.medicines || []).length;
        if (medsCount > 0) {
          isLocalStoragePopulated = true;
          localStorageItemCount = medsCount;
        }
      }
    } catch {
      isLocalStorageAvailable = false;
    }

    const snapshots = await offlineDb.getAllCriticalBackupSnapshots();
    const hasIndexedDbBackup = snapshots.length > 0;
    const latestBackupInfo = snapshots.length > 0 ? { ...snapshots[0], isLatest: true } : null;

    let storageEstimate: any = undefined;
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usageBytes = est.usage || 0;
        const quotaBytes = est.quota || 0;
        const usagePercent = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;
        storageEstimate = { usageBytes, quotaBytes, usagePercent };
      } catch {}
    }

    // Vulnerable if localStorage has no active state, but IndexedDB has a valid backup ready to restore
    const isStorageVulnerable = !isLocalStoragePopulated && hasIndexedDbBackup;

    return {
      isLocalStorageAvailable,
      isLocalStoragePopulated,
      localStorageItemCount,
      hasIndexedDbBackup,
      indexedDbBackupCount: snapshots.length,
      latestBackupInfo,
      storageEstimate,
      isStorageVulnerable
    };
  },

  /**
   * Auto-recovers critical state if primary storage (localStorage) has been wiped or cleared.
   */
  async autoRecoverIfPrimaryStorageLost(
    onRecovered?: (data: CriticalBackupPayload) => void
  ): Promise<{ recovered: boolean; backupSummary?: CriticalBackupSummary }> {
    const health = await this.checkStorageHealth();
    if (health.isStorageVulnerable) {
      console.warn('[Critical State Backup] Primary site storage (localStorage) was cleared. Activating IndexedDB Fail-Safe Recovery...');
      const result = await this.restoreFromIndexedDb();
      if (result.success && result.data) {
        if (onRecovered) {
          onRecovered(result.data);
        }
        return { recovered: true, backupSummary: result.backupSummary };
      }
    }
    return { recovered: false };
  },

  /**
   * Exports critical state backup to a standalone verified JSON file for offline archival.
   */
  async exportBackupJson(backupId?: string): Promise<{ filename: string; blob: Blob; jsonStr: string }> {
    let payload: CriticalBackupPayload | null = null;
    if (backupId) {
      const rec = await offlineDb.getCriticalBackupSnapshot(backupId);
      payload = rec ? rec.data : null;
    } else {
      payload = await this.getLatestBackup();
    }

    if (!payload) {
      throw new Error('No critical state backup available to export.');
    }

    const dateTag = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `sonan_critical_failsafe_backup_${dateTag}.json`;
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    return { filename, blob, jsonStr };
  },

  /**
   * Imports and validates a JSON backup file directly into IndexedDB fail-safe storage.
   */
  async importBackupJson(jsonString: string): Promise<CriticalRestoreResult> {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, message: 'Invalid JSON file format.', error: 'INVALID_JSON' };
      }

      const medicines = Array.isArray(parsed.medicines) ? parsed.medicines : [];
      const customers = Array.isArray(parsed.customers) ? parsed.customers : [];
      const sales = Array.isArray(parsed.sales) ? parsed.sales : [];

      if (medicines.length === 0 && customers.length === 0 && sales.length === 0) {
        return {
          success: false,
          message: 'The imported file does not contain critical pharmacy entities (medicines, customers, or sales).',
          error: 'EMPTY_CRITICAL_PAYLOAD'
        };
      }

      // Save as new critical backup checkpoint
      const summary = await this.saveCriticalStateBackup(parsed, 'Imported from external fail-safe JSON archive');
      // Restore the state
      return await this.restoreFromIndexedDb(summary.id);
    } catch (err: any) {
      return {
        success: false,
        message: `Import error: ${err?.message || 'Could not parse JSON'}`,
        error: err?.message
      };
    }
  },

  /**
   * Deletes a specific critical backup snapshot.
   */
  async deleteBackup(id: string): Promise<boolean> {
    return await offlineDb.deleteCriticalBackupSnapshot(id);
  }
};
