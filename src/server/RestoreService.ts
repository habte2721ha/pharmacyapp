import fs from 'fs';
import path from 'path';
import { DbSchema, Medicine, StockItem, Customer, Supplier, Sale, UserRole, Branch, StockMovement } from '../types.ts';
import {
  logToAuditTrail,
  FIELD_MAPPINGS,
  mapRowFields,
  classifyCollectionByStructure,
  classifyCollectionByName,
  getRowsFromValue,
  collectAllCollections,
  parseGenericAndDetails
} from './migrationService.ts';

export class BackupScanner {
  private logs: string[] = [];

  public scan(rawBackup: any): { key: string; rows: any[] }[] {
    if (!rawBackup || typeof rawBackup !== 'object') {
      throw new Error('Backup data is corrupted or is not a valid JSON structure.');
    }

    let actualBackup = rawBackup;
    while (
      actualBackup &&
      typeof actualBackup === 'object' &&
      !Array.isArray(actualBackup) &&
      Object.keys(actualBackup).length === 1 &&
      !actualBackup.branches &&
      !actualBackup.medicines &&
      !actualBackup.Medicines
    ) {
      const singleKey = Object.keys(actualBackup)[0];
      const nestedVal = actualBackup[singleKey];
      if (nestedVal && typeof nestedVal === 'object') {
        this.log(`Unwrapped single root key "${singleKey}" to find backup data.`);
        actualBackup = nestedVal;
      } else {
        break;
      }
    }

    const collections = collectAllCollections(actualBackup);
    const result: { key: string; rows: any[] }[] = [];

    for (const { key, val } of collections) {
      const rows = getRowsFromValue(val);
      if (rows && rows.length > 0) {
        result.push({ key, rows });
      }
    }

    return result;
  }

  private log(message: string) {
    this.logs.push(message);
    logToAuditTrail(message);
  }

  public getLogs(): string[] {
    return this.logs;
  }
}

const EXACT_TABLE_MAP: { [key: string]: string } = {
  branch: 'branches',
  branches: 'branches',
  user: 'users',
  users: 'users',
  medicine: 'medicines',
  medicines: 'medicines',
  stockitem: 'stockItems',
  stockitems: 'stockItems',
  supplier: 'suppliers',
  suppliers: 'suppliers',
  sale: 'sales',
  sales: 'sales',
  purchaseorder: 'purchaseOrders',
  purchaseorders: 'purchaseOrders',
  stocktransfer: 'stockTransfers',
  stocktransfers: 'stockTransfers',
  customer: 'customers',
  customers: 'customers',
  expense: 'expenses',
  expenses: 'expenses',
  auditlog: 'auditLogs',
  auditlogs: 'auditLogs',
  backuprecord: 'backupRecords',
  backuprecords: 'backupRecords',
  suppliertransaction: 'supplierTransactions',
  suppliertransactions: 'supplierTransactions',
  pharmacynote: 'pharmacyNotes',
  pharmacynotes: 'pharmacyNotes',
  stockmovement: 'stockMovements',
  stockmovements: 'stockMovements',
  externalpharmacy: 'externalPharmacies',
  externalpharmacies: 'externalPharmacies',
  institution: 'institution'
};

export class LegacyTableDetector {
  public detect(key: string, rows: any[]): string | null {
    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (EXACT_TABLE_MAP[cleanKey]) {
      return EXACT_TABLE_MAP[cleanKey];
    }

    const lowerKey = key.toLowerCase();

    if (lowerKey.startsWith('pharma_stockitem_') || lowerKey.startsWith('pharma_stock_') || lowerKey.startsWith('stockitem_') || lowerKey.startsWith('inventory_')) {
      return 'stockItems';
    } else if (lowerKey.startsWith('pharma_bincard_') || lowerKey.startsWith('bincard_') || lowerKey.includes('_bincard_') || lowerKey === 'bincard' || lowerKey === 'bincards') {
      if (Array.isArray(rows) && rows.length > 0) {
        const first = rows[0];
        if (first && typeof first === 'object' && (first.batchNumber || first.expiryDate) && first.balance === undefined && first.type === undefined) {
          return 'stockItems';
        }
      }
      return 'stockMovements';
    } else if (lowerKey.startsWith('pharma_customers_db')) {
      return 'customers';
    } else if (lowerKey.startsWith('pharma_stock_adjustments')) {
      return 'stockMovements';
    } else if (lowerKey.startsWith('pharma_hold_carts')) {
      return 'sales';
    }

    let entityType = classifyCollectionByStructure(rows);
    if (!entityType) {
      entityType = classifyCollectionByName(key);
    }
    return entityType;
  }
}

export interface TableMapping {
  legacyName: string;
  mappedName: string;
  recordCount: number;
}

export interface UnknownTable {
  legacyName: string;
  recordCount: number;
}

export class DynamicMappingEngine {
  private detector: LegacyTableDetector;
  private mappings: TableMapping[] = [];
  private unknownTables: UnknownTable[] = [];

  constructor(detector: LegacyTableDetector) {
    this.detector = detector;
  }

  public processCollections(collections: { key: string; rows: any[] }[]): {
    mapped: { [targetTable: string]: { key: string; rows: any[] }[] };
  } {
    const mapped: { [targetTable: string]: { key: string; rows: any[] }[] } = {};

    for (const { key, rows } of collections) {
      const targetTable = this.detector.detect(key, rows);
      if (targetTable) {
        if (!mapped[targetTable]) {
          mapped[targetTable] = [];
        }
        mapped[targetTable].push({ key, rows });
        this.mappings.push({ legacyName: key, mappedName: targetTable, recordCount: rows.length });
      } else {
        this.unknownTables.push({ legacyName: key, recordCount: rows.length });
      }
    }

    return { mapped };
  }

  public getMappings(): TableMapping[] {
    return this.mappings;
  }

  public getUnknownTables(): UnknownTable[] {
    return this.unknownTables;
  }
}

export class RelationshipRepairService {
  private logs: string[] = [];
  private repairedCount = 0;
  private importedStockItemsIds = new Set<string>();
  private importedSalesIds = new Set<string>();
  private importedPOIds = new Set<string>();
  private importedStockMovementsIds = new Set<string>();

  public setImportedIds(
    stockItemsIds: Set<string>,
    salesIds: Set<string>,
    poIds: Set<string>,
    stockMovementsIds: Set<string>
  ) {
    this.importedStockItemsIds = stockItemsIds;
    this.importedSalesIds = salesIds;
    this.importedPOIds = poIds;
    this.importedStockMovementsIds = stockMovementsIds;
  }

  public repair(migratedDb: DbSchema, targetBranchId: string, operatorName: string): void {
    // 1. Repair Stock Items
    migratedDb.stockItems.forEach((st, idx) => {
      let medExists = migratedDb.medicines.find(m => m.id === st.medicineId);
      if (!medExists && st.medicineId) {
        const nameAlias = (st as any).MedicineName || (st as any).medicineName || (st as any).name || (st as any).Name || (st as any).drugName || (st as any).DrugName;
        if (nameAlias) {
          const match = migratedDb.medicines.find(m => m.name.toLowerCase().trim() === String(nameAlias).toLowerCase().trim());
          if (match) {
            st.medicineId = match.id;
            medExists = match;
          }
        }
      }

      if (!medExists) {
        const stubId = st.medicineId || `m_stub_st_${idx}`;
        const stubName = (st as any).MedicineName || `Auto-Recovered Product ${stubId}`;
        const parsedStubGeneric = parseGenericAndDetails(stubName);
        const newStub: Medicine = {
          id: stubId,
          name: stubName,
          genericName: parsedStubGeneric.generic,
          barcode: `STUB-ST-BAR-${Date.now().toString().slice(-4)}${idx}`,
          sku: `STUB-ST-SKU-${idx}`,
          category: 'Auto-Recovered Stock',
          price: 100,
          buyingPrice: 70,
          isPrescriptionRequired: false,
          unit: parsedStubGeneric.dosageForm || 'Box',
          minStockLevel: 10,
          description: 'Created automatically by stock item restoration guided recovery.'
        };
        migratedDb.medicines.push(newStub);
        st.medicineId = stubId;
        this.logRepair('stockItem', st.id, `Created stub medicine "${stubName}" for orphan stock item batch.`);
      }

      const branchExists = migratedDb.branches.some(b => b.id === st.branchId);
      if (!branchExists) {
        st.branchId = 'b1';
        this.logRepair('stockItem', st.id, `Reassigned batch from unknown branch to Main Branch (b1).`);
      }

      const supExists = migratedDb.suppliers.some(s => s.id === st.supplierId);
      if (!supExists) {
        st.supplierId = 's1';
        this.logRepair('stockItem', st.id, `Linked batch to default fallback supplier (s1).`);
      }
    });

    // 2. Repair Sales
    migratedDb.sales.forEach((sl, idx) => {
      if (this.importedSalesIds.size === 0 || !this.importedSalesIds.has(sl.id)) return;
      const branchExists = migratedDb.branches.some(b => b.id === sl.branchId);
      if (!branchExists) {
        sl.branchId = 'b1';
        this.logRepair('sale', sl.id, `Reassigned sale transaction to Main Branch (b1).`);
      }

      if (sl.customerId) {
        const custExists = migratedDb.customers.some(c => c.id === sl.customerId);
        if (!custExists) {
          sl.customerId = undefined;
          sl.customerName = 'Walk-In Customer';
          this.logRepair('sale', sl.id, `Detached unrecognized customer, reassigned to Walk-In.`);
        }
      }

      sl.items.forEach((item, lIdx) => {
        let medExists = migratedDb.medicines.find(m => m.id === item.medicineId);
        if (!medExists && item.medicineId) {
          const nameAlias = item.medicineName;
          if (nameAlias) {
            const match = migratedDb.medicines.find(m => m.name.toLowerCase() === nameAlias.toLowerCase());
            if (match) {
              item.medicineId = match.id;
              medExists = match;
            }
          }
        }

        if (!medExists) {
          const stubId = item.medicineId || `m_stub_sl_${idx}_${lIdx}`;
          const stubName = item.medicineName || `Auto-Recovered Product ${stubId}`;
          const parsedStubGeneric = parseGenericAndDetails(stubName);
          const newStub: Medicine = {
            id: stubId,
            name: stubName,
            genericName: parsedStubGeneric.generic,
            barcode: `STUB-SL-BAR-${Date.now().toString().slice(-4)}${idx}${lIdx}`,
            sku: `STUB-SL-SKU-${idx}-${lIdx}`,
            category: 'Auto-Recovered Sales',
            price: item.unitPrice || 100,
            buyingPrice: (item.unitPrice || 100) * 0.75,
            isPrescriptionRequired: false,
            unit: parsedStubGeneric.dosageForm || 'Box',
            minStockLevel: 10,
            description: 'Created automatically by sales transaction restoration guided recovery.'
          };
          migratedDb.medicines.push(newStub);
          item.medicineId = stubId;
          this.logRepair('saleItem', `${sl.id}-line-${lIdx}`, `Created stub medicine "${stubName}" for orphan sale item line.`);
        }
      });
    });

    // 3. Repair POs
    migratedDb.purchaseOrders.forEach((po, idx) => {
      if (this.importedPOIds.size === 0 || !this.importedPOIds.has(po.id)) return;
      const branchExists = migratedDb.branches.some(b => b.id === po.branchId);
      if (!branchExists) {
        po.branchId = 'b1';
        this.logRepair('purchaseOrder', po.id, `Reassigned purchase order to Main Branch (b1).`);
      }

      const supExists = migratedDb.suppliers.some(s => s.id === po.supplierId);
      if (!supExists) {
        po.supplierId = 's1';
        po.supplierName = 'Default Supplier';
        this.logRepair('purchaseOrder', po.id, `Linked PO to default fallback supplier (s1).`);
      }

      po.items.forEach((item, lIdx) => {
        let medExists = migratedDb.medicines.find(m => m.id === item.medicineId);
        if (!medExists && item.medicineId) {
          const nameAlias = item.medicineName;
          if (nameAlias) {
            const match = migratedDb.medicines.find(m => m.name.toLowerCase() === nameAlias.toLowerCase());
            if (match) {
              item.medicineId = match.id;
              medExists = match;
            }
          }
        }

        if (!medExists) {
          const stubId = item.medicineId || `m_stub_po_${idx}_${lIdx}`;
          const stubName = item.medicineName || `Auto-Recovered Product ${stubId}`;
          const parsedStubGeneric = parseGenericAndDetails(stubName);
          const newStub: Medicine = {
            id: stubId,
            name: stubName,
            genericName: parsedStubGeneric.generic,
            barcode: `STUB-PO-BAR-${Date.now().toString().slice(-4)}${idx}${lIdx}`,
            sku: `STUB-PO-SKU-${idx}-${lIdx}`,
            category: 'Auto-Recovered Purchases',
            price: item.unitPrice * 1.3 || 130,
            buyingPrice: item.unitPrice || 100,
            isPrescriptionRequired: false,
            unit: parsedStubGeneric.dosageForm || 'Box',
            minStockLevel: 10,
            description: 'Created automatically by purchase order restoration guided recovery.'
          };
          migratedDb.medicines.push(newStub);
          item.medicineId = stubId;
          this.logRepair('purchaseItem', `${po.id}-line-${lIdx}`, `Created stub medicine "${stubName}" for orphan purchase item line.`);
        }
      });
    });

    // 4. Repair Expenses
    migratedDb.expenses.forEach((e) => {
      const branchExists = migratedDb.branches.some(b => b.id === e.branchId);
      if (!branchExists) {
        e.branchId = 'b1';
        this.logRepair('expense', e.id, `Reassigned expense to Main Branch (b1).`);
      }
    });

    // 5. Repair Supplier Transactions
    migratedDb.supplierTransactions = migratedDb.supplierTransactions || [];
    migratedDb.supplierTransactions.forEach((stx) => {
      const supExists = migratedDb.suppliers.some(s => s.id === stx.supplierId);
      if (!supExists) {
        stx.supplierId = 's1';
        this.logRepair('supplierTransaction', stx.id, `Linked transaction to default fallback supplier (s1).`);
      }
    });

    // 6. Repair Stock Movements
    migratedDb.stockMovements = migratedDb.stockMovements || [];
    migratedDb.stockMovements.forEach((sm, idx) => {
      let med = migratedDb.medicines.find(m => m.id === sm.medicineId);
      if (!med && sm.medicineId) {
        const nameAlias = (sm as any).MedicineName || (sm as any).medicineName || (sm as any).name || (sm as any).Name || (sm as any).drugName || (sm as any).DrugName;
        if (nameAlias) {
          const match = migratedDb.medicines.find(m => m.name.toLowerCase().trim() === String(nameAlias).toLowerCase().trim());
          if (match) {
            sm.medicineId = match.id;
            med = match;
          }
        }
      }

      if (!med) {
        const stubId = sm.medicineId || `m_stub_sm_${idx}`;
        const stubName = (sm as any).MedicineName || (sm as any).Name || `Auto-Recovered Product ${stubId}`;
        const parsedStubGeneric = parseGenericAndDetails(stubName);
        const newStub: Medicine = {
          id: stubId,
          name: stubName,
          genericName: parsedStubGeneric.generic,
          barcode: `STUB-SM-BAR-${Date.now().toString().slice(-4)}${idx}`,
          sku: `STUB-SM-SKU-${idx}`,
          category: 'Auto-Recovered Movements',
          price: 150,
          buyingPrice: 110,
          isPrescriptionRequired: false,
          unit: parsedStubGeneric.dosageForm || 'Box',
          minStockLevel: 5,
          description: 'Created automatically by stock movement restoration guided recovery.'
        };
        migratedDb.medicines.push(newStub);
        sm.medicineId = stubId;
        this.logRepair('stockMovement', sm.id, `Created stub medicine "${stubName}" for orphan stock movement record.`);
      }

      const branchExists = migratedDb.branches.some(b => b.id === sm.branchId);
      if (!branchExists) {
        sm.branchId = 'b1';
        this.logRepair('stockMovement', sm.id, `Reassigned movement from unknown branch to Main Branch (b1).`);
      }
    });
  }

  private logRepair(entity: string, id: string, action: string) {
    this.repairedCount++;
    const msg = `Repaired [${entity}] (ID: ${id}) - Action: ${action}`;
    this.logs.push(msg);
    logToAuditTrail(`[REPAIR] ${msg}`);
  }

  public getLogs(): string[] {
    return this.logs;
  }

  public getRepairedCount(): number {
    return this.repairedCount;
  }
}

export class ImportReport {
  public static generate(
    mappings: TableMapping[],
    unknownTables: UnknownTable[],
    repairLogs: string[],
    itemsOnly: boolean,
    targetBranchId: string,
    reconciliationStats: {
      itemsOnlyQtyDesc?: boolean;
      fkStockMedsCount: number; stockItemsLength: number;
      fkStockBranchesCount: number;
      fkStockSuppliersCount: number;
      fkSalesBranchesCount: number; salesLength: number;
      fkSalesCustomersCount: number;
      fkSalesMedsCount: number; totalSaleLines: number;
      fkPOSuppliersCount: number; purchaseOrdersLength: number;
      fkPOBranchesCount: number;
      fkPOMedsCount: number; totalPOLines: number;
      fkExpensesBranchesCount: number; expensesLength: number;
      fkStxSuppliersCount: number; supplierTxLength: number;
      fkMovementMedsCount: number; stockMovementsLength: number;
      fkMovementBranchesCount: number;
    }
  ): string[] {
    const reportLogs: string[] = [];
    reportLogs.push('======================================================================');
    reportLogs.push('                  LEGACY DB MIGRATION & RECONCILIATION REPORT         ');
    reportLogs.push('======================================================================');
    
    let sourceProfile = 'Full Relational Restore';
    if (itemsOnly) {
      sourceProfile = 'Items List Only Restore';
    } else if (reconciliationStats.itemsOnlyQtyDesc) {
      sourceProfile = 'Items with Quantity & Description Only Restore';
    }
    
    reportLogs.push(`  Source Profile: ${sourceProfile}`);
    reportLogs.push(`  Target Sandbox Isolation: ${targetBranchId === 'all' ? 'System-Wide (Global)' : `Branch "${targetBranchId}"`}`);
    reportLogs.push('----------------------------------------------------------------------');
    reportLogs.push('  Target Entity Schema     <-   Legacy Field Sources      | Status');
    reportLogs.push('----------------------------------------------------------------------');

    const schemaTables = [
      { name: 'branches', legacy: 'Branches/Locations' },
      { name: 'medicines', legacy: 'Medicines/DrugList/Prod.' },
      { name: 'stockItems', legacy: 'StockItems/Batches/Inven.' },
      { name: 'suppliers', legacy: 'Suppliers/Vendors' },
      { name: 'customers', legacy: 'Customers/Clients' },
      { name: 'sales', legacy: 'Sales/Invoices/Transact.' },
      { name: 'purchaseOrders', legacy: 'PurchaseOrders/Purchases' },
      { name: 'expenses', legacy: 'Expenses/Costs/Ledger' },
      { name: 'supplierTransactions', legacy: 'SupplierTx/Payments' },
      { name: 'stockMovements', legacy: 'pharma_bincard_* (Bin C.)' }
    ];

    schemaTables.forEach((table, idx) => {
      const tableMappings = mappings.filter(m => m.mappedName === table.name);
      if (tableMappings.length > 0) {
        const totalCount = tableMappings.reduce((acc, m) => acc + m.recordCount, 0);
        const sourceKeys = tableMappings.map(m => m.legacyName).join(', ');
        reportLogs.push(`  ${idx + 1}. ${table.name.padEnd(21)} <-   ${sourceKeys.padEnd(25)} | Converted ${totalCount} rows`);
      } else {
        reportLogs.push(`  ${idx + 1}. ${table.name.padEnd(21)} <-   ${table.legacy.padEnd(25)} | Not found (Skipped/Preserved)`);
      }
    });

    reportLogs.push('======================================================================');
    reportLogs.push('                       DYNAMIC TABLE MAPPING REPORT                   ');
    reportLogs.push('======================================================================');
    reportLogs.push('  Legacy Name                   Mapped Target Name            Record Count');
    reportLogs.push('----------------------------------------------------------------------');
    mappings.forEach(m => {
      reportLogs.push(`  ${m.legacyName.padEnd(30)} ${m.mappedName.padEnd(30)} ${m.recordCount}`);
    });

    if (unknownTables.length > 0) {
      reportLogs.push('======================================================================');
      reportLogs.push('                        UNKNOWN LEGACY TABLES REPORT                  ');
      reportLogs.push('======================================================================');
      reportLogs.push('  These tables were scanned but could not be mapped to any target schema.');
      reportLogs.push('----------------------------------------------------------------------');
      reportLogs.push('  Legacy Name                                                 Record Count');
      reportLogs.push('----------------------------------------------------------------------');
      unknownTables.forEach(t => {
        reportLogs.push(`  ${t.legacyName.padEnd(60)} ${t.recordCount}`);
      });
    }

    reportLogs.push('======================================================================');
    reportLogs.push('          RELATIONAL INTEGRITY & FOREIGN KEY VERIFICATION RESULTS     ');
    reportLogs.push('======================================================================');
    
    const {
      fkStockMedsCount, stockItemsLength,
      fkStockBranchesCount,
      fkStockSuppliersCount,
      fkSalesBranchesCount, salesLength,
      fkSalesCustomersCount,
      fkSalesMedsCount, totalSaleLines,
      fkPOSuppliersCount, purchaseOrdersLength,
      fkPOBranchesCount,
      fkPOMedsCount, totalPOLines,
      fkExpensesBranchesCount, expensesLength,
      fkStxSuppliersCount, supplierTxLength,
      fkMovementMedsCount, stockMovementsLength,
      fkMovementBranchesCount
    } = reconciliationStats;

    if (stockItemsLength > 0) {
      const medPct = Math.round((fkStockMedsCount / stockItemsLength) * 100);
      const brPct = Math.round((fkStockBranchesCount / stockItemsLength) * 100);
      const supPct = Math.round((fkStockSuppliersCount / stockItemsLength) * 100);
      reportLogs.push(`  - stockItems.medicineId -> medicines   : ${medPct}% Validated (${fkStockMedsCount}/${stockItemsLength} linked)`);
      reportLogs.push(`  - stockItems.branchId   -> branches    : ${brPct}% Validated (${fkStockBranchesCount}/${stockItemsLength} linked)`);
      reportLogs.push(`  - stockItems.supplierId -> suppliers   : ${supPct}% Validated (${fkStockSuppliersCount}/${stockItemsLength} linked)`);
    }
    if (salesLength > 0) {
      const brPct = Math.round((fkSalesBranchesCount / salesLength) * 100);
      const custPct = Math.round((fkSalesCustomersCount / salesLength) * 100);
      const medPct = totalSaleLines > 0 ? Math.round((fkSalesMedsCount / totalSaleLines) * 100) : 100;
      reportLogs.push(`  - sales.branchId        -> branches    : ${brPct}% Validated (${fkSalesBranchesCount}/${salesLength} linked)`);
      reportLogs.push(`  - sales.customerId      -> customers   : ${custPct}% Validated (${fkSalesCustomersCount}/${salesLength} linked)`);
      reportLogs.push(`  - saleItems.medicineId  -> medicines   : ${medPct}% Validated (${fkSalesMedsCount}/${totalSaleLines} linked)`);
    }
    if (purchaseOrdersLength > 0) {
      const supPct = Math.round((fkPOSuppliersCount / purchaseOrdersLength) * 100);
      const brPct = Math.round((fkPOBranchesCount / purchaseOrdersLength) * 100);
      const medPct = totalPOLines > 0 ? Math.round((fkPOMedsCount / totalPOLines) * 100) : 100;
      reportLogs.push(`  - purchaseOrders.supplierId -> suppliers: ${supPct}% Validated (${fkPOSuppliersCount}/${purchaseOrdersLength} linked)`);
      reportLogs.push(`  - purchaseOrders.branchId   -> branches : ${brPct}% Validated (${fkPOBranchesCount}/${purchaseOrdersLength} linked)`);
      reportLogs.push(`  - purchaseItems.medicineId  -> medicines: ${medPct}% Validated (${fkPOMedsCount}/${totalPOLines} linked)`);
    }
    if (expensesLength > 0) {
      const brPct = Math.round((fkExpensesBranchesCount / expensesLength) * 100);
      reportLogs.push(`  - expenses.branchId         -> branches : ${brPct}% Validated (${fkExpensesBranchesCount}/${expensesLength} linked)`);
    }
    if (supplierTxLength > 0) {
      const supPct = Math.round((fkStxSuppliersCount / supplierTxLength) * 100);
      const brPct = 100; // Not direct FK, but supplier is validated
      reportLogs.push(`  - supplierTx.supplierId     -> suppliers: ${supPct}% Validated (${fkStxSuppliersCount}/${supplierTxLength} linked)`);
    }
    if (stockMovementsLength > 0) {
      const medPct = Math.round((fkMovementMedsCount / stockMovementsLength) * 100);
      const brPct = Math.round((fkMovementBranchesCount / stockMovementsLength) * 100);
      reportLogs.push(`  - stockMovements.medicineId -> medicines: ${medPct}% Validated (${fkMovementMedsCount}/${stockMovementsLength} linked)`);
      reportLogs.push(`  - stockMovements.branchId   -> branches : ${brPct}% Validated (${fkMovementBranchesCount}/${stockMovementsLength} linked)`);
    }
    reportLogs.push('======================================================================');

    return reportLogs;
  }
}

export class RestoreService {
  private scanner: BackupScanner;
  private mappingEngine: DynamicMappingEngine;
  private repairService: RelationshipRepairService;

  constructor(scanner: BackupScanner, mappingEngine: DynamicMappingEngine, repairService: RelationshipRepairService) {
    this.scanner = scanner;
    this.mappingEngine = mappingEngine;
    this.repairService = repairService;
  }

  public restore(
    rawBackup: any,
    operatorName: string,
    targetBranchId: string,
    currentDb: DbSchema,
    itemsOnly: boolean,
    itemsOnlyQtyDesc: boolean = false,
    itemsOnlyRestore: boolean = false
  ): {
    success: boolean;
    summary: { imported: number; skipped: number; repaired: number; total: number; missingEntities: string[] };
    logs: string[];
    skippedReasons: string[];
    warnings: string[];
    migratedDb: DbSchema;
    itemsOnlyRestoreResult?: string;
  } {
    const logs: string[] = [...this.scanner.getLogs()];
    const warnings: string[] = [];
    const skippedReasons: string[] = [];
    const missingEntities: string[] = [];

    let migratedDb: DbSchema = {
      branches: [...currentDb.branches],
      users: [...currentDb.users],
      medicines: [...currentDb.medicines],
      stockItems: [...currentDb.stockItems],
      suppliers: [...currentDb.suppliers],
      sales: [...currentDb.sales],
      purchaseOrders: [...currentDb.purchaseOrders],
      stockTransfers: [...(currentDb.stockTransfers || [])],
      customers: [...currentDb.customers],
      expenses: [...currentDb.expenses],
      auditLogs: [...currentDb.auditLogs],
      backupRecords: [...currentDb.backupRecords],
      categories: [...(currentDb.categories || [])],
      customUnits: [...(currentDb.customUnits || [])],
      itemMasterTemplates: [...(currentDb.itemMasterTemplates || [])],
      itemAddPresets: currentDb.itemAddPresets ? { ...currentDb.itemAddPresets } : undefined,
      supplierTransactions: [...(currentDb.supplierTransactions || [])],
      pharmacyNotes: [...(currentDb.pharmacyNotes || [])],
      stockMovements: [...(currentDb.stockMovements || [])],
      externalPharmacies: [...(currentDb.externalPharmacies || [])],
      institution: currentDb.institution ? { ...currentDb.institution } : undefined
    };

    // Restore raw customUnits, categories, itemMasterTemplates, itemAddPresets if in rawBackup
    if (rawBackup && typeof rawBackup === 'object') {
      if (Array.isArray(rawBackup.customUnits)) {
        rawBackup.customUnits.forEach((u: string) => {
          if (u && !migratedDb.customUnits?.includes(u)) {
            migratedDb.customUnits = migratedDb.customUnits || [];
            migratedDb.customUnits.push(u);
          }
        });
      }
      if (Array.isArray(rawBackup.categories) && rawBackup.categories.length > 0) {
        migratedDb.categories = rawBackup.categories;
      }
      if (Array.isArray(rawBackup.itemMasterTemplates) && rawBackup.itemMasterTemplates.length > 0) {
        migratedDb.itemMasterTemplates = rawBackup.itemMasterTemplates;
      }
      if (rawBackup.itemAddPresets) {
        if (Array.isArray(rawBackup.itemAddPresets) && rawBackup.itemAddPresets.length > 0) {
          migratedDb.itemAddPresets = { ...(migratedDb.itemAddPresets || {}), ...rawBackup.itemAddPresets[0] };
        } else if (typeof rawBackup.itemAddPresets === 'object') {
          migratedDb.itemAddPresets = { ...(migratedDb.itemAddPresets || {}), ...rawBackup.itemAddPresets };
        }
      }
    }

    if (itemsOnlyRestore) {
      logToAuditTrail(`Database Restoration Started in SIMPLIFIED Items Only Restore Mode. Target Branch: "${targetBranchId}". Operator: "${operatorName}".`);
      
      const rawItems: any[] = [];
      const seenObjects = new Set<any>();

      // Recursive candidate extraction
      function traverse(obj: any) {
        if (!obj || typeof obj !== 'object' || seenObjects.has(obj)) return;
        seenObjects.add(obj);

        if (Array.isArray(obj)) {
          let isItemArray = false;
          for (const item of obj) {
            if (item && typeof item === 'object') {
              if (
                item.name || item.Name || item.productName || item.product_name || 
                item.DrugName || item.Drug || item.drugName || item.itemName || item.item_name ||
                item.barcode || item.Barcode || item.bar_code
              ) {
                isItemArray = true;
                break;
              }
            }
          }
          if (isItemArray) {
            obj.forEach(item => {
              if (item && typeof item === 'object' && !Array.isArray(item)) {
                rawItems.push(item);
              }
            });
          }
        } else {
          for (const k of Object.keys(obj)) {
            traverse(obj[k]);
          }
        }
      }
      traverse(rawBackup);

      let importedItemsCount = 0;
      let updatedItemsCount = 0;
      let skippedItemsCount = 0;

      const existingMedsByBarcode = new Map<string, Medicine>();
      const existingMedsByName = new Map<string, Medicine>();
      
      migratedDb.medicines.forEach(m => {
        if (m.barcode && m.barcode.trim()) {
          existingMedsByBarcode.set(m.barcode.trim().toLowerCase(), m);
        }
        if (m.name && m.name.trim()) {
          existingMedsByName.set(m.name.trim().toLowerCase(), m);
        }
      });

      const existingStockItems = new Map<string, StockItem>();
      migratedDb.stockItems.forEach(st => {
        const key = `${st.medicineId}|${st.branchId}|${(st.batchNumber || '').trim().toLowerCase()}`;
        existingStockItems.set(key, st);
      });

      let defaultBranchId = targetBranchId;
      if (defaultBranchId === 'all') {
        defaultBranchId = migratedDb.branches[0]?.id || 'b_gen_1';
      }

      rawItems.forEach((raw, idx) => {
        const productName = (
          raw.name || raw.Name ||
          raw.product_name || raw.productName || raw.Product_Name ||
          raw.drugName || raw.DrugName || raw.drug_name ||
          raw.medicineName || raw.medicine_name ||
          raw.itemName || raw.item_name || raw.item || raw.Drug || raw.Product
        );

        if (!productName || typeof productName !== 'string' || !productName.trim()) {
          skippedItemsCount++;
          return;
        }

        const genericName = (
          raw.genericName || raw.generic_name || raw.GenericName ||
          raw.generic || raw.Generic || raw.generic_drug || raw.active_ingredient || ''
        );

        const rawBarcode = (
          raw.barcode || raw.bar_code || raw.Barcode || raw.BarCode ||
          raw.upc || raw.gtin || raw.sku || raw.SKU || raw.code || raw.Code || ''
        );
        const barcode = String(rawBarcode).trim();

        const batchNumber = String(
          raw.batchNumber || raw.batch_number || raw.BatchNumber ||
          raw.batch || raw.Batch || raw.batch_no || raw.batchNo || raw.BatchNo ||
          raw.lotNumber || raw.lot || 'GENERIC-BATCH'
        ).trim();

        const rawQty = raw.quantity !== undefined ? raw.quantity : (raw.qty !== undefined ? raw.qty : (raw.Quantity !== undefined ? raw.Quantity : (raw.Qty !== undefined ? raw.Qty : (raw.stock !== undefined ? raw.stock : (raw.Stock !== undefined ? raw.Stock : (raw.stock_level !== undefined ? raw.stock_level : (raw.stockLevel !== undefined ? raw.stockLevel : (raw.quantity_on_hand !== undefined ? raw.quantity_on_hand : (raw.qty_on_hand !== undefined ? raw.qty_on_hand : (raw.balance !== undefined ? raw.balance : (raw.Balance !== undefined ? raw.Balance : 0)))))))))));
        const quantity = Math.max(0, Number(rawQty) || 0);

        const unit = String(raw.unit || raw.Unit || raw.pack || raw.Pack || raw.package || raw.dosageForm || raw.DosageForm || 'Tablet').trim();

        const rawPurchasePrice = raw.buyingPrice !== undefined ? raw.buyingPrice : (raw.buying_price !== undefined ? raw.buying_price : (raw.BuyingPrice !== undefined ? raw.BuyingPrice : (raw.purchasePrice !== undefined ? raw.purchasePrice : (raw.purchase_price !== undefined ? raw.purchase_price : (raw.PurchasePrice !== undefined ? raw.PurchasePrice : (raw.costPrice !== undefined ? raw.costPrice : (raw.cost !== undefined ? raw.cost : (raw.cost_price !== undefined ? raw.cost_price : (raw.unit_cost !== undefined ? raw.unit_cost : (raw.buy_price !== undefined ? raw.buy_price : (raw.buyPrice !== undefined ? raw.buyPrice : 0)))))))))));
        const purchasePrice = Math.max(0, Number(rawPurchasePrice) || 0);

        const rawSellingPrice = raw.price !== undefined ? raw.price : (raw.Price !== undefined ? raw.Price : (raw.sellingPrice !== undefined ? raw.sellingPrice : (raw.selling_price !== undefined ? raw.selling_price : (raw.SellingPrice !== undefined ? raw.SellingPrice : (raw.unitPrice !== undefined ? raw.unitPrice : (raw.unit_price !== undefined ? raw.unit_price : (raw.UnitPrice !== undefined ? raw.UnitPrice : (raw.salesPrice !== undefined ? raw.salesPrice : (raw.sales_price !== undefined ? raw.sales_price : 0)))))))));
        const sellingPrice = Math.max(0, Number(rawSellingPrice) || 0);

        const rawExpiryDate = raw.expiryDate || raw.expiry_date || raw.ExpiryDate || raw.expDate || raw.exp_date || raw.ExpDate || raw.expiry || raw.Expiry || raw.expiration || raw.expiration_date || '';
        let expiryDate = '';
        if (rawExpiryDate) {
          const d = new Date(rawExpiryDate);
          if (!isNaN(d.getTime())) {
            expiryDate = d.toISOString().split('T')[0];
          }
        }

        const category = String(raw.category || raw.Category || raw.drug_category || raw.group || raw.Group || raw.type || raw.Type || 'General').trim();
        const lowerCategory = category.toLowerCase();
        const isCosmeticCategory = 
          lowerCategory.includes('cosmetic') || 
          lowerCategory.includes('perfume') || 
          lowerCategory.includes('shampoo') || 
          lowerCategory.includes('makeup') || 
          lowerCategory.includes('beauty') || 
          lowerCategory.includes('lotion') || 
          lowerCategory.includes('cream') || 
          lowerCategory.includes('soap') || 
          lowerCategory.includes('skin care') || 
          lowerCategory.includes('hair care') || 
          String(raw.productType || raw.type || '').toLowerCase() === 'cosmetics';

        const productType = isCosmeticCategory ? 'cosmetics' : 'medicine';

        const manufacturer = String(raw.manufacturer || raw.Manufacturer || raw.brand || raw.Brand || raw.make || raw.Make || raw.producer || raw.Producer || raw.supplierName || raw.supplier || '').trim();
        const description = String(raw.description || raw.Description || raw.desc || raw.notes || raw.Notes || raw.remarks || raw.Remarks || raw.details || raw.Details || '').trim();

        const itemBranchId = String(raw.branchId || raw.branch_id || raw.BranchId || raw.branch || raw.Branch || raw.branch_code || raw.branchCode || defaultBranchId).trim();
        const branchId = targetBranchId === 'all' ? itemBranchId : targetBranchId;

        let medicine: Medicine | undefined;
        const cleanBarcode = barcode.toLowerCase();
        const cleanName = productName.trim().toLowerCase();

        if (cleanBarcode) {
          medicine = existingMedsByBarcode.get(cleanBarcode);
        }
        if (!medicine) {
          medicine = existingMedsByName.get(cleanName);
        }

        let isNewMedicine = false;
        if (medicine) {
          medicine.name = productName.trim();
          if (genericName) medicine.genericName = genericName;
          if (sellingPrice > 0) medicine.price = sellingPrice;
          if (purchasePrice > 0) medicine.buyingPrice = purchasePrice;
          if (category && category !== 'General') medicine.category = category;
          if (unit && unit !== 'Tablet') medicine.unit = unit;
          if (manufacturer) medicine.manufacturer = manufacturer;
          if (description) medicine.description = description;
          medicine.productType = productType; // Support updating cosmetics vs medicine categories
          updatedItemsCount++;
        } else {
          const newMedId = `med_gen_${idx}_${Date.now()}`;
          const finalBarcode = barcode || `BARCODE-${idx}-${Math.floor(100000 + Math.random() * 900000)}`;
          medicine = {
            id: newMedId,
            name: productName.trim(),
            genericName: genericName || undefined,
            barcode: finalBarcode,
            sku: finalBarcode,
            category: category,
            price: sellingPrice || purchasePrice * 1.25 || 10,
            buyingPrice: purchasePrice || sellingPrice * 0.8 || 8,
            isPrescriptionRequired: false,
            unit: unit,
            minStockLevel: 10,
            description: description,
            manufacturer: manufacturer || undefined,
            productType: productType
          };
          migratedDb.medicines.push(medicine);
          
          existingMedsByBarcode.set(medicine.barcode.toLowerCase(), medicine);
          existingMedsByName.set(medicine.name.toLowerCase(), medicine);
          importedItemsCount++;
          isNewMedicine = true;
        }

        const batchKey = `${medicine.id}|${branchId}|${batchNumber.toLowerCase()}`;
        let stockItem = existingStockItems.get(batchKey);

        if (stockItem) {
          stockItem.quantity = quantity;
          if (purchasePrice > 0) stockItem.buyingPrice = purchasePrice;
          if (expiryDate) stockItem.expiryDate = expiryDate;
        } else {
          const newStockId = `st_gen_${idx}_${Date.now()}`;
          stockItem = {
            id: newStockId,
            medicineId: medicine.id,
            branchId: branchId,
            batchNumber: batchNumber,
            expiryDate: expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            quantity: quantity,
            buyingPrice: purchasePrice || medicine.buyingPrice,
            supplierId: 's_gen_default',
            isDamaged: false,
            notes: 'Imported via Items Only Restore'
          };
          migratedDb.stockItems.push(stockItem);
          existingStockItems.set(batchKey, stockItem);
        }
      });

      const branchName = currentDb.branches.find(b => b.id === targetBranchId)?.name || (targetBranchId === 'all' ? 'All Branches' : targetBranchId);
      const itemsOnlyRestoreResult = `-------------------------------------\nItems Restored Successfully\n\nImported Items: ${importedItemsCount}\nUpdated Items: ${updatedItemsCount}\nSkipped Items: ${skippedItemsCount}\nBranch: ${branchName}\n\nRestore Completed Successfully.\n-------------------------------------`;

      logToAuditTrail(`Simplified Items Only Restore Complete. Imported: ${importedItemsCount}, Updated: ${updatedItemsCount}, Skipped: ${skippedItemsCount}`);

      // Ensure itemMasterTemplates and customUnits are enriched from all restored medicines & stock
      if (!migratedDb.itemMasterTemplates) migratedDb.itemMasterTemplates = [];
      const stockMap: Record<string, any> = {};
      (migratedDb.stockItems || []).forEach((st: any) => {
        if (st.medicineId) stockMap[st.medicineId] = st;
      });
      migratedDb.medicines.forEach(m => {
        const lastSt = stockMap[m.id];
        const existingIdx = migratedDb.itemMasterTemplates!.findIndex(t => t.id === m.id || (t.name && t.name.toLowerCase() === m.name.toLowerCase()));
        const tmpl = {
          id: m.id,
          name: m.name,
          genericName: m.genericName || m.name,
          category: m.category || 'General',
          subCategory: m.subCategory || '',
          unit: m.unit || 'Piece (PCS)',
          buyingPrice: lastSt ? Number(lastSt.buyingPrice) : (Number(m.buyingPrice) || 0),
          price: Number(m.price) || 0,
          profitMargin: m.profitMargin !== undefined ? Number(m.profitMargin) : 30,
          useMarginPricing: m.useMarginPricing !== undefined ? !!m.useMarginPricing : true,
          isPrescriptionRequired: !!m.isPrescriptionRequired,
          productType: m.productType || 'medicine',
          minStockLevel: Number(m.minStockLevel) || 10,
          description: m.description || '',
          supplierId: lastSt?.supplierId || (m as any).supplierId || 's1',
          purchaseInvoiceNumber: (lastSt as any)?.purchaseInvoiceNumber || (m as any).purchaseInvoiceNumber || '',
          expiryDate: lastSt?.expiryDate || '',
          batchNumber: lastSt?.batchNumber || '',
          barcode: m.barcode || '',
          sku: m.sku || '',
          imageUrl: m.imageUrl || '',
          lastUpdated: new Date().toISOString()
        };
        if (existingIdx >= 0) {
          migratedDb.itemMasterTemplates![existingIdx] = { ...migratedDb.itemMasterTemplates![existingIdx], ...tmpl };
        } else {
          migratedDb.itemMasterTemplates!.push(tmpl);
        }
        if (m.unit && !migratedDb.customUnits?.includes(m.unit)) {
          migratedDb.customUnits = migratedDb.customUnits || [];
          migratedDb.customUnits.push(m.unit);
        }
      });

      return {
        success: true,
        summary: {
          imported: importedItemsCount,
          skipped: skippedItemsCount,
          repaired: updatedItemsCount,
          total: importedItemsCount + updatedItemsCount + skippedItemsCount,
          missingEntities: []
        },
        logs: [itemsOnlyRestoreResult],
        skippedReasons: [],
        warnings: [],
        migratedDb,
        itemsOnlyRestoreResult
      };
    }

    let importedCount = 0;
    let skippedCount = 0;
    const importedMedicineIds = new Set<string>();
    const importedStockItemIds = new Set<string>();
    const importedSaleIds = new Set<string>();
    const importedPOIds = new Set<string>();
    const importedStockMovementIds = new Set<string>();

    logToAuditTrail(`Database Restoration Started via RestoreEngine. Target Branch: "${targetBranchId}". Operator: "${operatorName}".`);

    migratedDb = {
      branches: [...currentDb.branches],
      users: [...currentDb.users],
      medicines: [...currentDb.medicines],
      stockItems: [...currentDb.stockItems],
      suppliers: [...currentDb.suppliers],
      sales: [...currentDb.sales],
      purchaseOrders: [...currentDb.purchaseOrders],
      stockTransfers: [...(currentDb.stockTransfers || [])],
      customers: [...currentDb.customers],
      expenses: [...currentDb.expenses],
      auditLogs: [...currentDb.auditLogs],
      backupRecords: [...currentDb.backupRecords],
      supplierTransactions: [...(currentDb.supplierTransactions || [])],
      pharmacyNotes: [...(currentDb.pharmacyNotes || [])],
      stockMovements: [...(currentDb.stockMovements || [])],
      externalPharmacies: [...(currentDb.externalPharmacies || [])],
      institution: currentDb.institution ? { ...currentDb.institution } : undefined
    };

    let actualBackup = rawBackup;
    while (
      actualBackup &&
      typeof actualBackup === 'object' &&
      !Array.isArray(actualBackup) &&
      Object.keys(actualBackup).length === 1 &&
      !actualBackup.branches &&
      !actualBackup.medicines &&
      !actualBackup.Medicines
    ) {
      const singleKey = Object.keys(actualBackup)[0];
      const nestedVal = actualBackup[singleKey];
      if (nestedVal && typeof nestedVal === 'object') {
        actualBackup = nestedVal;
      } else {
        break;
      }
    }

    if (actualBackup && actualBackup.institution && !itemsOnly && !itemsOnlyQtyDesc) {
      migratedDb.institution = actualBackup.institution;
      logs.push(`Restored institution setup parameters from backup: ${actualBackup.institution.name || ''}`);
    }

    const scannedCollections = this.scanner.scan(rawBackup);
    logs.push(`Dynamic auto-discovery scanner found ${scannedCollections.length} candidate collections in backup payload.`);

    const { mapped } = this.mappingEngine.processCollections(scannedCollections);

    const isTableMapped = (targetTable: string): boolean => {
      return !!mapped[targetTable] && mapped[targetTable].length > 0;
    };

    // Table restoration registry to keep core loops abstract and schema-agnostic
    const restorers = [
      {
        targetTable: 'branches',
        restoreRow: (b: any, idx: number, db: DbSchema) => {
          const id = b.id || `b_gen_${idx}`;
          const name = b.name || b.Name || `Sonan Branch ${idx}`;
          const code = b.code || b.Code || `SP-${idx}`;
          if (!db.branches.some(x => x.id === id || x.code === code)) {
            db.branches.push({
              id,
              name,
              code,
              address: b.address || b.Address || 'Addis Ababa',
              phone: b.phone || b.Phone || '+251-11-0000000'
            });
            return { imported: true };
          }
          return { imported: false };
        }
      },
      {
        targetTable: 'users',
        restoreRow: (u: any, idx: number, db: DbSchema) => {
          const id = u.id || `u_leg_${idx}`;
          const username = u.username || u.Username || `user_${idx}`;
          const fullName = u.fullName || u.FullName || u.name || u.Name || username;
          const role = u.role || u.Role || 'Operator';
          const branchId = u.branchId || u.BranchId || 'b1';
          if (!db.users.some(x => x.id === id || x.username.toLowerCase() === username.toLowerCase())) {
            db.users.push({
              id,
              username,
              name: fullName,
              email: u.email || '',
              role,
              branchId,
              isActive: u.isActive !== false,
              passwordHash: u.passwordHash || '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
              twoFactorEnabled: !!u.twoFactorEnabled,
              permissions: u.permissions || [],
              recognizedDevices: u.recognizedDevices || [],
              deactivatedDevices: u.deactivatedDevices || []
            });
            return { imported: true };
          }
          return { imported: false };
        }
      },
      {
        targetTable: 'suppliers',
        restoreRow: (s: any, idx: number, db: DbSchema) => {
          const mRow = mapRowFields(s, FIELD_MAPPINGS.supplier);
          const id = mRow.id || `s_leg_${idx}`;
          const name = mRow.name || `Supplier ${idx + 1}`;
          if (!db.suppliers.some(x => x.id === id || x.name.toLowerCase() === name.toLowerCase())) {
            db.suppliers.push({
              id,
              name,
              phone: mRow.phone || '+251-11-0000000',
              email: mRow.email || '',
              address: mRow.address || 'Addis Ababa',
              balance: Number(mRow.balance) || 0
            });
            return { imported: true };
          }
          return { imported: false };
        }
      },
      {
        targetTable: 'customers',
        restoreRow: (c: any, idx: number, db: DbSchema) => {
          const mRow = mapRowFields(c, FIELD_MAPPINGS.customer);
          const id = mRow.id || `c_leg_${idx}`;
          const name = mRow.name || `Customer ${idx + 1}`;
          const phone = mRow.phone || `+251-91-0000000`;
          if (!db.customers.some(x => x.id === id || x.phone === phone)) {
            db.customers.push({
              id,
              name,
              phone,
              email: mRow.email || '',
              address: mRow.address || '',
              loyaltyPoints: Number(mRow.loyaltyPoints) || 0,
              creditLimit: Number(mRow.creditLimit) || 5000,
              creditBalance: Number(mRow.creditBalance) || 0
            });
            return { imported: true };
          }
          return { imported: false };
        }
      },
      {
        targetTable: 'medicines',
        restoreRow: (m: any, idx: number, db: DbSchema, tBranchId: string, ctx: any) => {
          const mRow = mapRowFields(m, FIELD_MAPPINGS.medicine);
          const name = mRow.name || m.Name || `Unnamed Product ${idx}`;
          const barcode = mRow.barcode || `LEG-BAR-${200000 + idx}`;
          const id = mRow.id || `m_leg_${idx}`;

          const existingIdx = db.medicines.findIndex(x => x.id === id || x.barcode === barcode);
          if (existingIdx !== -1) {
            const existing = db.medicines[existingIdx];
            if (ctx.itemsOnlyQtyDesc) {
              const stock = Number(m.stock !== undefined ? m.stock : (m.Stock !== undefined ? m.Stock : (m.quantity !== undefined ? m.quantity : (m.qty !== undefined ? m.qty : (m.quantity_on_hand !== undefined ? m.quantity_on_hand : 0)))));
              existing.stock = stock;
              existing.description = mRow.description || m.description || m.Description || existing.description;
              const imgVal = mRow.imageUrl || m.imageUrl || m.ImageUrl || m.image || m.Image || m.photoUrl || m.PhotoUrl || m.photo || m.Photo || m.pictureUrl || m.PictureUrl || m.picture || m.Picture || m.productImage;
              if (imgVal) existing.imageUrl = imgVal;
              ctx.repairService['logRepair']('medicine', id, `Updated quantity (${stock}) and description from backup.`);
              return { imported: true };
            }

            const catVal = mRow.category || m.category || m.Category || m.Group || m.Class;
            if (catVal && catVal !== 'N/A') existing.category = catVal;

            const unitVal = mRow.unit || m.unit || m.Unit || m.Pack || m.Package || m.dosageForm || m.DosageForm;
            if (unitVal && unitVal !== 'N/A') existing.unit = unitVal;

            const genVal = mRow.genericName || m.genericName || m.Generic || m.ActiveIngredient;
            if (genVal && genVal !== 'N/A') existing.genericName = genVal;

            const bpVal = Number(mRow.buyingPrice) || Number(m.buyingPrice) || Number(m.CostPrice) || Number(m.Cost);
            if (bpVal > 0) existing.buyingPrice = bpVal;

            const spVal = Number(mRow.price) || Number(m.price) || Number(m.RetailPrice) || Number(m.SellingPrice);
            if (spVal > 0) existing.price = spVal;

            const descVal = mRow.description || m.description || m.Description || m.Notes;
            if (descVal && descVal !== 'N/A') existing.description = descVal;

            const supVal = m.supplierId || mRow.supplierId || m.SupplierId || m.Supplier;
            if (supVal) (existing as any).supplierId = supVal;

            const invVal = m.purchaseInvoiceNumber || mRow.purchaseInvoiceNumber || m.PurchaseInvoiceNumber || m.InvoiceNumber;
            if (invVal) (existing as any).purchaseInvoiceNumber = invVal;

            const prodTypeVal = m.productType || mRow.productType || m.ProductType;
            if (prodTypeVal) (existing as any).productType = prodTypeVal;

            const minStockVal = Number(mRow.minStockLevel) || Number(m.minStockLevel) || Number(m.MinStock);
            if (minStockVal > 0) existing.minStockLevel = minStockVal;

            const imgVal = mRow.imageUrl || m.imageUrl || m.ImageUrl || m.image || m.Image || m.photoUrl || m.PhotoUrl || m.photo || m.Photo || m.pictureUrl || m.PictureUrl || m.picture || m.Picture || m.productImage;
            if (imgVal) existing.imageUrl = imgVal;

            ctx.repairService['logRepair']('medicine', id, `Updated medicine catalog specs (category: ${existing.category}, unit: ${existing.unit}, buyingPrice: ${existing.buyingPrice}) from backup.`);
            return { imported: true };
          }

          const parsed = parseGenericAndDetails(
            name,
            m.strength || m.Strength || mRow.strength,
            m.dosageForm || m.dosage_form || m.DosageForm || m.dosage || m.Dosage || m.unit || mRow.unit,
            mRow.genericName || m.genericName || m.Generic || m.ActiveIngredient
          );

          const genericToUse = parsed.generic;
          let isNewGeneric = false;

          if (genericToUse !== 'N/A') {
            const lowerGeneric = genericToUse.toLowerCase();
            let matchedGeneric = '';
            for (const g of ctx.existingGenerics) {
              if (g.toLowerCase() === lowerGeneric) {
                matchedGeneric = g;
                break;
              }
            }

            if (!matchedGeneric) {
              ctx.existingGenerics.add(genericToUse);
              ctx.genericsCreatedList.push(genericToUse);
              isNewGeneric = true;
            }
          }

          if (parsed.requiresReview) {
            ctx.manualReviewList.push({ name, reason: parsed.reason || 'Manual review recommended.' });
          }

          ctx.mappedMedicinesReport.push({ name, generic: genericToUse, requiresReview: parsed.requiresReview, reason: parsed.reason });

          const code = m.code || m.Code || m.sku || m.SKU || m.item_code || mRow.sku || `LEG-SKU-${idx}`;
          const strength = m.strength || m.Strength || parsed.strength || '';
          const dosageForm = m.dosageForm || m.dosage_form || m.DosageForm || m.dosage || m.Dosage || m.unit || mRow.unit || parsed.dosageForm || 'Tablet';
          const manufacturer = m.manufacturer || m.Manufacturer || m.maker || m.Brand || '';
          const stock = Number(m.stock !== undefined ? m.stock : (m.Stock !== undefined ? m.Stock : (m.quantity !== undefined ? m.quantity : (m.qty !== undefined ? m.qty : (m.quantity_on_hand !== undefined ? m.quantity_on_hand : 0)))));
          const expiryDate = m.expiryDate || m.expiry_date || m.ExpiryDate || m.expiry || m.exp_date || '';
          const branchAssignment = m.branchAssignment || m.branch_assignment || m.branch || m.Branch || m.branchId || m.BranchId || 'b1';
          const imgVal = mRow.imageUrl || m.imageUrl || m.ImageUrl || m.image || m.Image || m.photoUrl || m.PhotoUrl || m.photo || m.Photo || m.pictureUrl || m.PictureUrl || m.picture || m.Picture || m.productImage || '';

          db.medicines.push({
            id,
            name,
            genericName: genericToUse,
            barcode,
            sku: code,
            category: mRow.category || m.category || m.Category || 'General Stock',
            price: Number(mRow.price) || Number(m.price) || 100,
            buyingPrice: Number(mRow.buyingPrice) || Number(m.buyingPrice) || (Number(mRow.price) || Number(m.price) || 100) * 0.75,
            isPrescriptionRequired: !!mRow.isPrescriptionRequired || !!m.isPrescriptionRequired || !!m.Rx,
            unit: dosageForm,
            minStockLevel: Number(mRow.minStockLevel) || Number(m.minStockLevel) || 10,
            description: mRow.description || m.description || m.Description || 'Legacy Imported Product Specifications.',
            imageUrl: imgVal,
            productType: m.productType || mRow.productType || m.ProductType || 'medicine',
            code,
            strength,
            dosageForm,
            manufacturer,
            stock,
            expiryDate,
            branchAssignment,
            branchId: branchAssignment
          });

          ctx.importedMedicineIds.add(id);

          if (isNewGeneric) {
            ctx.repairService['logRepair']('medicine', id, `Automatically created and linked generic ingredient "${genericToUse}" for medicine "${name}".`);
          }

          return { imported: true };
        }
      },
      {
        targetTable: 'stockItems',
        restoreRow: (st: any, idx: number, db: DbSchema, tBranchId: string, ctx: any) => {
          const mRow = mapRowFields(st, FIELD_MAPPINGS.stockItem);
          const id = mRow.id || `st_leg_${idx}_${Date.now().toString().slice(-3)}`;
          const branchId = tBranchId !== 'all' ? tBranchId : (mRow.branchId || 'b1');

          if (tBranchId !== 'all' && branchId !== tBranchId) {
            return { imported: false };
          }

          let medId = mRow.medicineId || st.medicineId || st.MedicineId || st.MedicineID || st.ItemId || st.Product_Id || st.DrugId || st.ProductId;
          if (!medId || !db.medicines.some(m => m.id === medId)) {
            const medName = st.medicineName || st.MedicineName || st.drugName || st.DrugName || st.productName || st.ProductName || st.name || st.Name;
            if (medName) {
              const match = db.medicines.find(m => m.name.toLowerCase().trim() === String(medName).toLowerCase().trim());
              if (match) medId = match.id;
            }
          }

          const existingIdx = db.stockItems.findIndex(x => x.id === id);
          const finalQty = Number(mRow.quantity) >= 0 ? Number(mRow.quantity) : Number(st.quantity !== undefined ? st.quantity : (st.Qty !== undefined ? st.Qty : 0));
          const bPrice = Number(mRow.buyingPrice) || Number(st.buyingPrice) || Number(st.BuyingPrice) || Number(st.CostPrice) || 50;
          const sPrice = Number(mRow.sellingPrice) || Number(st.sellingPrice) || Number(st.SellingPrice) || Number(st.RetailPrice) || 0;
          const batchNum = mRow.batchNumber || st.batchNumber || st.Batch || st.BatchNumber || st.BatchNo || `LEG-B-${idx}`;
          const expDate = mRow.expiryDate || st.expiryDate || st.Expiry || st.ExpiryDate || st.ExpDate || st.ExpirationDate || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const supId = mRow.supplierId || st.supplierId || st.SupplierId || st.Supplier || 's1';
          const pinNum = mRow.purchaseInvoiceNumber || st.purchaseInvoiceNumber || st.PurchaseInvoiceNumber || st.invoiceNumber || st.InvoiceNumber || '';

          if (existingIdx !== -1) {
            const existingSt = db.stockItems[existingIdx];
            existingSt.quantity = finalQty;
            existingSt.buyingPrice = bPrice;
            if (sPrice > 0) (existingSt as any).sellingPrice = sPrice;
            existingSt.batchNumber = batchNum;
            existingSt.expiryDate = expDate;
            existingSt.supplierId = supId;
            if (pinNum) (existingSt as any).purchaseInvoiceNumber = pinNum;
            if (medId) existingSt.medicineId = medId;
            return { imported: true };
          }

          db.stockItems.push({
            id,
            medicineId: medId || `m_stub_st_${idx}`,
            branchId,
            batchNumber: batchNum,
            expiryDate: expDate,
            quantity: finalQty,
            buyingPrice: bPrice,
            sellingPrice: sPrice > 0 ? sPrice : undefined,
            supplierId: supId,
            isDamaged: !!mRow.isDamaged || !!st.isDamaged || !!st.Damaged,
            storeQuantity: Number(mRow.storeQuantity) !== undefined ? Number(mRow.storeQuantity) : (Number(st.storeQuantity) !== undefined ? Number(st.storeQuantity) : finalQty),
            dispensaryQuantity: Number(mRow.dispensaryQuantity) || Number(st.dispensaryQuantity) || 0,
            purchaseInvoiceNumber: pinNum || undefined
          });

          ctx.importedStockItemIds.add(id);
          return { imported: true };
        }
      },
      {
        targetTable: 'sales',
        restoreRow: (sl: any, idx: number, db: DbSchema, tBranchId: string, ctx: any) => {
          const mRow = mapRowFields(sl, FIELD_MAPPINGS.sale);
          const id = mRow.id || `sl_leg_${idx}`;
          const branchId = tBranchId !== 'all' ? tBranchId : (mRow.branchId || 'b1');

          if (tBranchId !== 'all' && branchId !== tBranchId) {
            return { imported: false };
          }

          if (db.sales.some(x => x.id === id || x.invoiceNumber === mRow.invoiceNumber)) {
            return { imported: false, skipped: `Skipped [sale] (ID: ${id}) - Reason: Sale invoice code "${mRow.invoiceNumber}" already registered.` };
          }

          const rawLines = mRow.items || [];
          const validatedLines: any[] = [];

          rawLines.forEach((line: any, lIdx: number) => {
            const lineMapped = mapRowFields(line, FIELD_MAPPINGS.saleItem);
            validatedLines.push({
              id: lineMapped.id || `line_gen_${idx}_${lIdx}`,
              medicineId: lineMapped.medicineId,
              medicineName: lineMapped.medicineName || 'Recovered Medicine',
              batchNumber: lineMapped.batchNumber || 'LEG-BATCH',
              expiryDate: lineMapped.expiryDate || '',
              quantity: Number(lineMapped.quantity) || 1,
              unitPrice: Number(lineMapped.unitPrice) || 100,
              discount: Number(lineMapped.discount) || 0,
              vatAmount: Number(lineMapped.vatAmount) || 0,
              total: Number(lineMapped.total) || (Number(lineMapped.quantity) * Number(lineMapped.unitPrice)) || 100
            });
          });

          const linesTotal = validatedLines.reduce((acc, l) => acc + l.total, 0);

          db.sales.push({
            id,
            invoiceNumber: mRow.invoiceNumber || `INV-${Date.now().toString().slice(-4)}-${idx}`,
            serialNumber: Number(mRow.serialNumber) || (1000 + idx),
            branchId,
            branchName: 'Sonan Pharmacy Main Branch',
            date: mRow.date || new Date().toISOString().split('T')[0],
            time: mRow.time || '12:00',
            cashierId: mRow.cashierId || 'u1',
            cashierName: mRow.cashierName || 'Admin',
            customerId: mRow.customerId || undefined,
            customerName: mRow.customerName || undefined,
            subtotal: Number(mRow.subtotal) || linesTotal,
            vat: Number(mRow.taxAmount || mRow.vat || 0) || 0,
            discount: Number(mRow.discount) || 0,
            total: Number(mRow.total) || linesTotal,
            paymentMethod: mRow.paymentMethod || 'Cash',
            status: 'Completed',
            items: validatedLines
          });

          ctx.importedSaleIds.add(id);
          return { imported: true };
        }
      },
      {
        targetTable: 'expenses',
        restoreRow: (e: any, idx: number, db: DbSchema, tBranchId: string, ctx: any) => {
          const mRow = mapRowFields(e, {
            id: ['id', 'ExpenseId', 'ExpenseID'],
            amount: ['amount', 'Amount', 'Cost', 'CostValue'],
            description: ['description', 'Description', 'Details', 'Notes', 'Reason'],
            category: ['category', 'Category', 'ExpenseType', 'Type'],
            date: ['date', 'Date', 'ExpenseDate', 'Created'],
            branchId: ['branchId', 'BranchId', 'LocationId']
          });
          const id = mRow.id || `e_leg_${idx}`;
          const branchId = tBranchId !== 'all' ? tBranchId : (mRow.branchId || 'b1');

          if (tBranchId !== 'all' && branchId !== tBranchId) {
            return { imported: false };
          }

          db.expenses.push({
            id,
            amount: Number(mRow.amount) || 100,
            description: mRow.description || 'Legacy Imported Expense Line.',
            category: mRow.category || 'Utilities',
            date: mRow.date || new Date().toISOString().split('T')[0],
            branchId,
            branchName: 'Sonan Pharmacy Main Branch',
            recordedBy: ctx.operatorName || 'Admin'
          });

          return { imported: true };
        }
      },
      {
        targetTable: 'supplierTransactions',
        restoreRow: (stx: any, idx: number, db: DbSchema) => {
          const mRow = mapRowFields(stx, {
            id: ['id', 'stx_id', 'TransactionId', 'ID'],
            supplierId: ['supplierId', 'SupplierId', 'SupplierID'],
            date: ['date', 'Date', 'TransactionDate', 'Created'],
            type: ['type', 'Type', 'TransactionType'],
            amount: ['amount', 'Amount', 'Value'],
            reference: ['reference', 'Reference', 'Ref', 'PO_No', 'InvoiceNo'],
            dueDate: ['dueDate', 'DueDate', 'Due'],
            notes: ['notes', 'Notes', 'Description', 'Remark'],
            paidAmount: ['paidAmount', 'PaidAmount', 'Paid'],
            paymentStatus: ['paymentStatus', 'PaymentStatus', 'Status'],
            paymentTerms: ['paymentTerms', 'PaymentTerms', 'Terms']
          });

          const id = mRow.id || `stx_leg_${idx}`;
          if (!db.supplierTransactions.some(x => x.id === id)) {
            db.supplierTransactions.push({
              id,
              supplierId: mRow.supplierId || 's1',
              date: mRow.date || new Date().toISOString().split('T')[0],
              type: mRow.type === 'Payment' ? 'Payment' : 'Purchase Credit',
              amount: Number(mRow.amount) || 0,
              reference: mRow.reference || '',
              dueDate: mRow.dueDate || '',
              notes: mRow.notes || 'Legacy Imported Supplier Transaction.',
              paidAmount: Number(mRow.paidAmount) || 0,
              paymentStatus: mRow.paymentStatus || 'Paid',
              paymentTerms: mRow.paymentTerms || 'Net 30'
            });
            return { imported: true };
          }
          return { imported: false };
        }
      },
      {
        targetTable: 'purchaseOrders',
        restoreRow: (po: any, idx: number, db: DbSchema, tBranchId: string, ctx: any) => {
          const mRow = mapRowFields(po, FIELD_MAPPINGS.purchaseOrder);
          const id = mRow.id || `po_leg_${idx}`;
          const branchId = tBranchId !== 'all' ? tBranchId : (mRow.branchId || 'b1');

          if (tBranchId !== 'all' && branchId !== tBranchId) {
            return { imported: false };
          }

          if (db.purchaseOrders.some(x => x.id === id || x.poNumber === mRow.poNumber)) {
            return { imported: false };
          }

          const rawLines = mRow.items || [];
          const validatedLines: any[] = [];

          rawLines.forEach((line: any, lIdx: number) => {
            const lineMapped = mapRowFields(line, FIELD_MAPPINGS.purchaseItem);
            validatedLines.push({
              id: lineMapped.id || `po_line_${idx}_${lIdx}`,
              medicineId: lineMapped.medicineId,
              medicineName: lineMapped.medicineName || 'Recovered Medicine',
              quantity: Number(lineMapped.quantity) || 1,
              unitPrice: Number(lineMapped.unitPrice) || 100,
              total: Number(lineMapped.total) || (Number(lineMapped.quantity) * Number(lineMapped.unitPrice)) || 100
            });
          });

          const linesTotal = validatedLines.reduce((acc, l) => acc + l.total, 0);

          db.purchaseOrders.push({
            id,
            poNumber: mRow.poNumber || `PO-${Date.now().toString().slice(-4)}-${idx}`,
            supplierId: mRow.supplierId || 's1',
            supplierName: 'Medco Pharmaceuticals',
            branchId,
            branchName: 'Sonan Pharmacy Main Branch',
            date: mRow.date || new Date().toISOString().split('T')[0],
            total: Number(mRow.total) || linesTotal,
            status: mRow.status || 'Received',
            items: validatedLines,
            receivedDate: mRow.receivedDate || mRow.date || new Date().toISOString().split('T')[0],
            receivedBy: mRow.receivedBy || ctx.operatorName
          });

          ctx.importedPOIds.add(id);
          return { imported: true };
        }
      },
      {
        targetTable: 'stockMovements',
        restoreRow: (sm: any, idx: number, db: DbSchema, tBranchId: string, ctx: any) => {
          const mRow = mapRowFields(sm, FIELD_MAPPINGS.stockMovement);
          const id = mRow.id || `sm_leg_${idx}_${Date.now().toString().slice(-3)}`;
          const branchId = tBranchId !== 'all' ? tBranchId : (mRow.branchId || 'b1');

          if (tBranchId !== 'all' && branchId !== tBranchId) {
            return { imported: false };
          }

          let medId = mRow.medicineId || sm.medicineId || sm.MedicineId || sm.MedicineID || sm.ItemId || sm.Product_Id || sm.DrugId || sm.ProductId;
          if (!medId || !db.medicines.some(m => m.id === medId)) {
            const medName = sm.medicineName || sm.MedicineName || sm.drugName || sm.DrugName || sm.productName || sm.ProductName || sm.name || sm.Name;
            if (medName) {
              const match = db.medicines.find(m => m.name.toLowerCase().trim() === String(medName).toLowerCase().trim());
              if (match) medId = match.id;
            }
          }

          const quantity = Number(mRow.quantity) !== 0 ? Number(mRow.quantity) : (Number(sm.quantity) || Number(sm.qty) || Number(sm.Qty) || 0);
          const balance = Number(mRow.balance) !== 0 ? Number(mRow.balance) : (Number(sm.balance) || Number(sm.Balance) || 0);

          const bNum = mRow.batchNumber || sm.batchNumber || sm.Batch || sm.BatchNumber || sm.BatchNo || sm.batch || '';
          const expDate = mRow.expiryDate || sm.expiryDate || sm.Expiry || sm.ExpiryDate || sm.ExpDate || sm.expDate || '';
          const bPrice = Number(mRow.buyingPrice) || Number(sm.buyingPrice) || Number(sm.BuyingPrice) || Number(sm.CostPrice) || 0;
          const sPrice = Number(mRow.sellingPrice) || Number(sm.sellingPrice) || Number(sm.SellingPrice) || Number(sm.UnitPrice) || Number(sm.price) || 0;
          const supName = mRow.supplierName || sm.supplierName || sm.Supplier || sm.SupplierName || sm.vendor || '';
          const invNo = mRow.invoiceNumber || sm.invoiceNumber || sm.InvoiceNumber || sm.InvoiceNo || sm.billNo || sm.reference || '';
          const opName = mRow.operatorName || sm.operatorName || sm.Operator || sm.OperatorName || sm.user || sm.cashierName || '';
          const qIn = mRow.quantityIn !== undefined ? Number(mRow.quantityIn) : (sm.quantityIn !== undefined ? Number(sm.quantityIn) : (sm.qtyIn !== undefined ? Number(sm.qtyIn) : undefined));
          const qOut = mRow.quantityOut !== undefined ? Number(mRow.quantityOut) : (sm.quantityOut !== undefined ? Number(sm.quantityOut) : (sm.qtyOut !== undefined ? Number(sm.qtyOut) : undefined));

          db.stockMovements = db.stockMovements || [];
          const existingIdx = db.stockMovements.findIndex(x => x.id === id);
          if (existingIdx !== -1) {
            const existingSm = db.stockMovements[existingIdx];
            existingSm.medicineId = medId || existingSm.medicineId;
            existingSm.quantity = quantity;
            existingSm.balance = balance;
            if (bNum) existingSm.batchNumber = bNum;
            if (expDate) existingSm.expiryDate = expDate;
            if (bPrice > 0) existingSm.buyingPrice = bPrice;
            if (sPrice > 0) existingSm.sellingPrice = sPrice;
            if (supName) existingSm.supplierName = supName;
            if (invNo) existingSm.invoiceNumber = invNo;
            if (opName) existingSm.operatorName = opName;
            if (qIn !== undefined) existingSm.quantityIn = qIn;
            if (qOut !== undefined) existingSm.quantityOut = qOut;
            return { imported: true };
          }

          db.stockMovements.push({
            id,
            branchId,
            medicineId: medId || `m_stub_sm_${idx}`,
            date: mRow.date || sm.date || sm.Date || new Date().toISOString().split('T')[0],
            quantity,
            balance,
            type: sm.type || mRow.type || sm.Type || (quantity >= 0 ? 'Received' : 'Issued'),
            reference: mRow.reference || sm.reference || sm.Reference || sm.invoiceNumber || sm.poNumber || '',
            notes: mRow.notes || sm.notes || sm.Notes || sm.Remarks || (quantity >= 0 ? 'Stock Received' : 'Stock Issued'),
            batchNumber: bNum || undefined,
            expiryDate: expDate || undefined,
            buyingPrice: bPrice > 0 ? bPrice : undefined,
            sellingPrice: sPrice > 0 ? sPrice : undefined,
            supplierName: supName || undefined,
            invoiceNumber: invNo || undefined,
            operatorName: opName || undefined,
            quantityIn: qIn,
            quantityOut: qOut,
            sourceBranchId: sm.sourceBranchId,
            sourceBranchName: sm.sourceBranchName,
            targetBranchId: sm.targetBranchId,
            targetBranchName: sm.targetBranchName
          });

          ctx.importedStockMovementIds.add(id);
          return { imported: true };
        }
      },
      {
        targetTable: 'stockTransfers',
        restoreRow: (st: any, idx: number, db: DbSchema) => {
          const id = st.id || `st_tx_${idx}`;
          if (!db.stockTransfers) {
            db.stockTransfers = [];
          }
          if (!db.stockTransfers.some(x => x.id === id)) {
            const rawItems = st.items || [];
            const validatedItems: any[] = [];
            rawItems.forEach((item: any) => {
              validatedItems.push({
                medicineId: item.medicineId || '',
                medicineName: item.medicineName || 'Unknown Medicine',
                quantity: Number(item.quantity) || 0,
                batchNumber: item.batchNumber || 'GENERIC',
                expiryDate: item.expiryDate || ''
              });
            });

            db.stockTransfers.push({
              id,
              transferNumber: st.transferNumber || `TX-${Date.now().toString().slice(-4)}-${idx}`,
              sourceBranchId: st.sourceBranchId || 'b1',
              sourceBranchName: st.sourceBranchName || 'Sonan Pharmacy Main Branch',
              targetBranchId: st.targetBranchId,
              targetBranchName: st.targetBranchName,
              externalPharmacyName: st.externalPharmacyName,
              transferType: st.transferType || 'Internal',
              date: st.date || new Date().toISOString().split('T')[0],
              status: st.status || 'Pending',
              items: validatedItems,
              requestedBy: st.requestedBy || 'User',
              processedBy: st.processedBy,
              notes: st.notes
            });
            return { imported: true };
          }
          return { imported: false };
        }
      },
      {
        targetTable: 'pharmacyNotes',
        restoreRow: (n: any, idx: number, db: DbSchema) => {
          const id = n.id || `n_note_${idx}`;
          if (!db.pharmacyNotes) {
            db.pharmacyNotes = [];
          }
          if (!db.pharmacyNotes.some(x => x.id === id)) {
            db.pharmacyNotes.push({
              id,
              text: n.text || '',
              authorName: n.authorName || 'Admin',
              role: n.role || 'Super Administrator',
              date: n.date || new Date().toISOString().split('T')[0],
              time: n.time || new Date().toTimeString().split(' ')[0].slice(0, 5)
            });
            return { imported: true };
          }
          return { imported: false };
        }
      },
      {
        targetTable: 'externalPharmacies',
        restoreRow: (ep: any, idx: number, db: DbSchema) => {
          const id = ep.id || `ep_ph_${idx}`;
          if (!db.externalPharmacies) {
            db.externalPharmacies = [];
          }
          if (!db.externalPharmacies.some(x => x.id === id)) {
            db.externalPharmacies.push({
              id,
              name: ep.name || '',
              phone: ep.phone || '',
              address: ep.address || '',
              tinNumber: ep.tinNumber
            });
            return { imported: true };
          }
          return { imported: false };
        }
      },
      {
        targetTable: 'auditLogs',
        restoreRow: (al: any, idx: number, db: DbSchema) => {
          const id = al.id || `al_log_${idx}`;
          if (!db.auditLogs) {
            db.auditLogs = [];
          }
          if (!db.auditLogs.some(x => x.id === id)) {
            db.auditLogs.push({
              id,
              date: al.date || new Date().toISOString().split('T')[0],
              time: al.time || new Date().toTimeString().split(' ')[0].slice(0, 5),
              userId: al.userId || 'admin',
              username: al.username || 'admin',
              role: al.role || 'Super Administrator',
              action: al.action || '',
              branchId: al.branchId || 'all',
              branchName: al.branchName || 'All Branches',
              ipAddress: al.ipAddress || '127.0.0.1',
              details: al.details || ''
            });
            return { imported: true };
          }
          return { imported: false };
        }
      },
      {
        targetTable: 'backupRecords',
        restoreRow: (br: any, idx: number, db: DbSchema) => {
          const id = br.id || `br_rec_${idx}`;
          if (!db.backupRecords) {
            db.backupRecords = [];
          }
          if (!db.backupRecords.some(x => x.id === id)) {
            db.backupRecords.push({
              id,
              date: br.date || new Date().toISOString().split('T')[0],
              time: br.time || new Date().toTimeString().split(' ')[0].slice(0, 5),
              type: br.type || 'Full',
              branchName: br.branchName || 'All Branches',
              filename: br.filename || 'backup.json',
              size: br.size || '0 KB',
              createdBy: br.createdBy || 'Admin',
              scheduleType: br.scheduleType || 'Manual',
              status: br.status || 'Success',
              logs: br.logs || []
            });
            return { imported: true };
          }
          return { imported: false };
        }
      }
    ];

    // Determine if tables are mapped
    const isMapped = (targetTable: string): boolean => {
      return !!mapped[targetTable] && mapped[targetTable].length > 0;
    };

    // Clean or filter tables as needed, completely schema-agnostic
    if (!itemsOnly && !itemsOnlyQtyDesc && targetBranchId === 'all') {
      restorers.forEach(restorer => {
        if (isMapped(restorer.targetTable)) {
          (migratedDb as any)[restorer.targetTable] = [];
        }
      });
    } else if (itemsOnly) {
      logs.push('Items List Only Restoration Active: Overwriting only medicines catalog. All other tables remain untouched.');
      migratedDb.medicines = [];
    } else if (itemsOnlyQtyDesc) {
      logs.push('Items Only with Quantity & Description Restoration Active: Restoring items, updating quantity and description. All other tables remain untouched.');
      // Keep existing medicines to allow merging/updating existing records instead of overwriting completely
    } else if (targetBranchId !== 'all') {
      logs.push(`Branch-Specific Sandboxing Active: Restoring ONLY data for Branch "${targetBranchId}". All other branches remain untouched.`);
      restorers.forEach(restorer => {
        if (isMapped(restorer.targetTable)) {
          const existing = (migratedDb as any)[restorer.targetTable];
          if (Array.isArray(existing)) {
            (migratedDb as any)[restorer.targetTable] = existing.filter((item: any) => item.branchId !== targetBranchId);
          }
        }
      });
    }

    // Process missing tables dynamically
    const expectedTables = restorers.map(r => r.targetTable);
    expectedTables.forEach(t => {
      if (!isMapped(t)) {
        missingEntities.push(t);
        warnings.push(`Entity table "${t}" was not found in backup file. Existing data preserved.`);
      }
    });

    // Local execution context shared across restorers
    const existingGenerics = new Set<string>(migratedDb.medicines.map(m => m.genericName).filter(g => g && g !== 'N/A'));
    const mappedMedicinesReport: { name: string; generic: string; requiresReview: boolean; reason?: string }[] = [];
    const genericsCreatedList: string[] = [];
    const manualReviewList: { name: string; reason: string }[] = [];

    const context = {
      existingGenerics,
      genericsCreatedList,
      manualReviewList,
      mappedMedicinesReport,
      importedMedicineIds,
      importedStockItemIds,
      importedSaleIds,
      importedPOIds,
      importedStockMovementIds,
      repairService: this.repairService,
      operatorName,
      itemsOnlyQtyDesc
    };

    // Execute dynamic table restorations
    restorers.forEach(restorer => {
      const targetTable = restorer.targetTable;
      if ((itemsOnly || itemsOnlyQtyDesc) && targetTable !== 'medicines') {
        return;
      }

      if (isMapped(targetTable)) {
        mapped[targetTable].forEach(({ key, rows }) => {
          if (!Array.isArray(rows)) return;
          rows.forEach((row, idx) => {
            if (!row || typeof row !== 'object') return;
            try {
              const result: any = restorer.restoreRow(row, idx, migratedDb, targetBranchId, context);
              if (result && result.imported) {
                importedCount++;
              } else if (result && result.skipped) {
                skippedCount++;
                skippedReasons.push(result.skipped);
              } else {
                skippedCount++;
              }
            } catch (rowErr: any) {
              skippedCount++;
              const errorMsg = `Row ${idx} in table "${targetTable}" skipped: ${rowErr?.message || 'Parsing error'}`;
              skippedReasons.push(errorMsg);
              logs.push(`Warning: ${errorMsg}`);
            }
          });
        });
      }
    });

    // Run relational integrity checks & repair engine
    this.repairService.setImportedIds(importedStockItemIds, importedSaleIds, importedPOIds, importedStockMovementIds);
    this.repairService.repair(migratedDb, targetBranchId, operatorName);

    // Compute foreign key statistics for the audit report
    let fkStockMedsCount = 0, fkStockBranchesCount = 0, fkStockSuppliersCount = 0;
    let fkSalesBranchesCount = 0, fkSalesCustomersCount = 0, fkSalesMedsCount = 0;
    let fkPOSuppliersCount = 0, fkPOBranchesCount = 0, fkPOMedsCount = 0;
    let fkExpensesBranchesCount = 0, fkStxSuppliersCount = 0;
    let fkMovementMedsCount = 0, fkMovementBranchesCount = 0;

    migratedDb.stockItems.forEach(st => {
      if (migratedDb.medicines.some(m => m.id === st.medicineId)) fkStockMedsCount++;
      if (migratedDb.branches.some(b => b.id === st.branchId)) fkStockBranchesCount++;
      if (migratedDb.suppliers.some(s => s.id === st.supplierId)) fkStockSuppliersCount++;
    });

    migratedDb.sales.forEach(sl => {
      if (migratedDb.branches.some(b => b.id === sl.branchId)) fkSalesBranchesCount++;
      if (!sl.customerId || migratedDb.customers.some(c => c.id === sl.customerId)) fkSalesCustomersCount++;
      sl.items.forEach(item => {
        if (migratedDb.medicines.some(m => m.id === item.medicineId)) fkSalesMedsCount++;
      });
    });

    migratedDb.purchaseOrders.forEach(po => {
      if (migratedDb.suppliers.some(s => s.id === po.supplierId)) fkPOSuppliersCount++;
      if (migratedDb.branches.some(b => b.id === po.branchId)) fkPOBranchesCount++;
      po.items.forEach(item => {
        if (migratedDb.medicines.some(m => m.id === item.medicineId)) fkPOMedsCount++;
      });
    });

    migratedDb.expenses.forEach(e => {
      if (migratedDb.branches.some(b => b.id === e.branchId)) fkExpensesBranchesCount++;
    });

    migratedDb.supplierTransactions.forEach(stx => {
      if (migratedDb.suppliers.some(s => s.id === stx.supplierId)) fkStxSuppliersCount++;
    });

    migratedDb.stockMovements.forEach(sm => {
      if (migratedDb.medicines.some(m => m.id === sm.medicineId)) fkMovementMedsCount++;
      if (migratedDb.branches.some(b => b.id === sm.branchId)) fkMovementBranchesCount++;
    });

    const totalSaleLines = migratedDb.sales.reduce((acc, s) => acc + s.items.length, 0);
    const totalPOLines = migratedDb.purchaseOrders.reduce((acc, p) => acc + p.items.length, 0);

    const reportLogs = ImportReport.generate(
      this.mappingEngine.getMappings(),
      this.mappingEngine.getUnknownTables(),
      this.repairService.getLogs(),
      itemsOnly,
      targetBranchId,
      {
        itemsOnlyQtyDesc,
        fkStockMedsCount, stockItemsLength: migratedDb.stockItems.length,
        fkStockBranchesCount,
        fkStockSuppliersCount,
        fkSalesBranchesCount, salesLength: migratedDb.sales.length,
        fkSalesCustomersCount,
        fkSalesMedsCount, totalSaleLines,
        fkPOSuppliersCount, purchaseOrdersLength: migratedDb.purchaseOrders.length,
        fkPOBranchesCount,
        fkPOMedsCount, totalPOLines,
        fkExpensesBranchesCount, expensesLength: migratedDb.expenses.length,
        fkStxSuppliersCount, supplierTxLength: migratedDb.supplierTransactions.length,
        fkMovementMedsCount, stockMovementsLength: migratedDb.stockMovements.length,
        fkMovementBranchesCount
      }
    );

    warnings.push(...this.repairService.getLogs());
    logs.push(...reportLogs);
    logs.push(...this.repairService.getLogs());

    logToAuditTrail(`Database migration successfully completed via RestoreEngine. Imported: ${importedCount}, Skipped: ${skippedCount}, Repaired: ${this.repairService.getRepairedCount()}.`);

    // Ensure itemMasterTemplates and customUnits are enriched from all restored medicines & stock
    if (!migratedDb.itemMasterTemplates) migratedDb.itemMasterTemplates = [];
    const stockMap: Record<string, any> = {};
    (migratedDb.stockItems || []).forEach((st: any) => {
      if (st.medicineId) stockMap[st.medicineId] = st;
    });
    migratedDb.medicines.forEach(m => {
      const lastSt = stockMap[m.id];
      const existingIdx = migratedDb.itemMasterTemplates!.findIndex(t => t.id === m.id || (t.name && t.name.toLowerCase() === m.name.toLowerCase()));
      const tmpl = {
        id: m.id,
        name: m.name,
        genericName: m.genericName || m.name,
        category: m.category || 'General',
        subCategory: m.subCategory || '',
        unit: m.unit || 'Piece (PCS)',
        buyingPrice: lastSt ? Number(lastSt.buyingPrice) : (Number(m.buyingPrice) || 0),
        price: Number(m.price) || 0,
        profitMargin: m.profitMargin !== undefined ? Number(m.profitMargin) : 30,
        useMarginPricing: m.useMarginPricing !== undefined ? !!m.useMarginPricing : true,
        isPrescriptionRequired: !!m.isPrescriptionRequired,
        productType: m.productType || 'medicine',
        minStockLevel: Number(m.minStockLevel) || 10,
        description: m.description || '',
        supplierId: lastSt?.supplierId || (m as any).supplierId || 's1',
        purchaseInvoiceNumber: (lastSt as any)?.purchaseInvoiceNumber || (m as any).purchaseInvoiceNumber || '',
        expiryDate: lastSt?.expiryDate || '',
        batchNumber: lastSt?.batchNumber || '',
        barcode: m.barcode || '',
        sku: m.sku || '',
        imageUrl: m.imageUrl || '',
        lastUpdated: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        migratedDb.itemMasterTemplates![existingIdx] = { ...migratedDb.itemMasterTemplates![existingIdx], ...tmpl };
      } else {
        migratedDb.itemMasterTemplates!.push(tmpl);
      }
      if (m.unit && !migratedDb.customUnits?.includes(m.unit)) {
        migratedDb.customUnits = migratedDb.customUnits || [];
        migratedDb.customUnits.push(m.unit);
      }
    });

    // Ensure itemAddPresets is fully populated and available for immediate consecutive item additions
    if (!migratedDb.itemAddPresets || Object.keys(migratedDb.itemAddPresets).length === 0) {
      if (migratedDb.medicines && migratedDb.medicines.length > 0) {
        const lastMed = migratedDb.medicines[migratedDb.medicines.length - 1];
        const lastSt = (migratedDb.stockItems || []).find(st => st.medicineId === lastMed.id);
        migratedDb.itemAddPresets = {
          unit: lastMed.unit || 'Piece (PCS)',
          category: lastMed.category || 'Antibiotics',
          subCategory: lastMed.subCategory || '',
          supplierId: lastSt?.supplierId || (lastMed as any).supplierId || 's1',
          branchId: lastSt?.branchId || 'b1',
          productType: (lastMed.productType as 'medicine' | 'cosmetics') || 'medicine',
          profitMargin: lastMed.profitMargin !== undefined ? Number(lastMed.profitMargin) : 30,
          useMarginPricing: lastMed.useMarginPricing !== undefined ? !!lastMed.useMarginPricing : true,
          isPrescriptionRequired: !!lastMed.isPrescriptionRequired,
          minStockLevel: Number(lastMed.minStockLevel) || 10,
          buyingPrice: Number(lastSt?.buyingPrice || lastMed.buyingPrice || 70),
          price: Number(lastMed.price || 100),
          purchaseInvoiceNumber: (lastSt as any)?.purchaseInvoiceNumber || (lastMed as any).purchaseInvoiceNumber || '',
          expiryDate: lastSt?.expiryDate || '',
          description: lastMed.description || '',
          rememberDefaults: true,
          lastAddedItemName: lastMed.name,
          lastAddedAt: new Date().toISOString()
        };
      } else {
        migratedDb.itemAddPresets = {
          unit: 'Piece (PCS)',
          category: 'Antibiotics',
          subCategory: '',
          supplierId: 's1',
          branchId: 'b1',
          productType: 'medicine',
          profitMargin: 30,
          useMarginPricing: true,
          isPrescriptionRequired: false,
          minStockLevel: 10,
          buyingPrice: 70,
          price: 100,
          rememberDefaults: true,
          lastAddedItemName: '',
          lastAddedAt: new Date().toISOString()
        };
      }
    }

    return {
      success: true,
      summary: {
        imported: importedCount,
        skipped: skippedCount,
        repaired: this.repairService.getRepairedCount(),
        total: importedCount + skippedCount,
        missingEntities
      },
      logs,
      skippedReasons,
      warnings,
      migratedDb
    };
  }
}
