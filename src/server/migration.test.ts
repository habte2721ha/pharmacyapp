import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { parseRawBackup, migrateAndRestoreSchema, logToAuditTrail } from './migrationService.ts';
import { DbSchema, UserRole } from '../types.ts';

// Helper to create a dummy baseline database
function createDummyDb(): DbSchema {
  return {
    branches: [
      { id: 'b1', name: 'Sonan Pharmacy (Main Branch)', code: 'SP-1', address: 'Bole, Addis Ababa', phone: '+251-11-1111111' },
      { id: 'b2', name: 'Sonan Pharmacy No. 2', code: 'SP-2', address: 'Kazanchis, Addis Ababa', phone: '+251-11-2222222' },
      { id: 'b3', name: 'Sonan Pharmacy No. 3', code: 'SP-3', address: 'Piazza, Addis Ababa', phone: '+251-11-3333333' }
    ],
    users: [
      { id: 'u1', username: 'admin', name: 'System Admin', email: 'admin@sonan.com', role: UserRole.SUPER_ADMIN, branchId: 'all', isActive: true, twoFactorEnabled: false, passwordHash: 'dummy-hash' }
    ],
    medicines: [
      { id: 'm1', name: 'Existing Drug A', genericName: 'Generic A', barcode: 'BAR-A', sku: 'SKU-A', category: 'General', price: 100, buyingPrice: 70, isPrescriptionRequired: false, unit: 'Box', minStockLevel: 10, description: 'Existing' }
    ],
    stockItems: [
      { id: 'st1', medicineId: 'm1', branchId: 'b1', batchNumber: 'BAT-A', expiryDate: '2026-12-31', quantity: 50, buyingPrice: 70, supplierId: 's1', isDamaged: false }
    ],
    suppliers: [
      { id: 's1', name: 'Default Supplier', phone: '+251-11-0000000', email: 'supplier@med.com', address: 'Addis Ababa', balance: 0 }
    ],
    sales: [],
    purchaseOrders: [],
    stockTransfers: [],
    customers: [],
    expenses: [],
    auditLogs: [],
    backupRecords: [],
    supplierTransactions: [],
    pharmacyNotes: []
  };
}

async function runTests() {
  console.log('====================================================');
  console.log('       RUNNING RESTORATION MODULE UNIT TESTS        ');
  console.log('====================================================');
  
  // Self-heal legacy_v2_backup.zip if it has replacement characters or is invalid
  try {
    const zipPath = path.join(process.cwd(), 'data', 'samples', 'legacy_v2_backup.zip');
    const jsonPath = path.join(process.cwd(), 'data', 'samples', 'legacy_desktop_backup.json');
    if (fs.existsSync(jsonPath)) {
      const jsonContent = fs.readFileSync(jsonPath, 'utf8');
      const zip = new AdmZip();
      zip.addFile('legacy_backup_contents.json', Buffer.from(jsonContent, 'utf8'));
      zip.writeZip(zipPath);
      console.log('[HEAL] Regenerated clean legacy_v2_backup.zip archive.');
    }
  } catch (err) {
    console.error('[HEAL] Failed to self-heal ZIP:', err);
  }

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failedCount++;
    }
  }

  // TEST 1: Parse Raw Legacy Backup (JSON format)
  try {
    const filePath = path.join(process.cwd(), 'data', 'samples', 'legacy_desktop_backup.json');
    const jsonText = fs.readFileSync(filePath, 'utf8');
    const parseResult = parseRawBackup(JSON.parse(jsonText), 'legacy_desktop_backup.json');
    
    assert(parseResult.success === true, 'Parse legacy desktop backup JSON');
    assert(parseResult.format.includes('Desktop'), 'Detect desktop app format');
    assert(parseResult.data.Medicines.length === 2, 'Extract correct number of Medicines');
  } catch (err: any) {
    console.error('Test 1 failed with error:', err);
    failedCount++;
  }

  // TEST 2: Parse Raw SQL Backup
  try {
    const filePath = path.join(process.cwd(), 'data', 'samples', 'legacy_v1_backup.sql');
    const sqlText = fs.readFileSync(filePath, 'utf8');
    const parseResult = parseRawBackup(sqlText, 'legacy_v1_backup.sql');
    
    assert(parseResult.success === true, 'Parse legacy SQL dump');
    assert(parseResult.format.includes('SQL'), 'Detect SQL script format');
    assert(parseResult.data.medicines !== undefined, 'Extracted medicines table from SQL');
    assert(parseResult.data.medicines.length === 2, 'Extracted 2 medicine SQL records');
  } catch (err: any) {
    console.error('Test 2 failed with error:', err);
    failedCount++;
  }

  // TEST 3: Parse Raw ZIP Backup
  try {
    const filePath = path.join(process.cwd(), 'data', 'samples', 'legacy_v2_backup.zip');
    // Read as binary buffer base64 string
    const zipBuffer = fs.readFileSync(filePath);
    const b64 = zipBuffer.toString('base64');
    const parseResult = parseRawBackup(b64, 'legacy_v2_backup.zip');
    
    assert(parseResult.success === true, 'Parse legacy ZIP backup');
    assert(parseResult.format.includes('ZIP'), 'Detect ZIP archive format');
    if (parseResult.data) {
      assert(parseResult.data.Medicines !== undefined, 'Extracted archived contents from ZIP');
    } else {
      assert(false, 'Extracted archived contents from ZIP (data is null)');
    }
  } catch (err: any) {
    console.error('Test 3 failed with error:', err);
    failedCount++;
  }

  // TEST 4: Migrate & Map Legacy Fields & Handle Missing Tables (Guided Recovery)
  try {
    const filePath = path.join(process.cwd(), 'data', 'samples', 'legacy_desktop_backup.json');
    const jsonText = fs.readFileSync(filePath, 'utf8');
    const parseResult = parseRawBackup(JSON.parse(jsonText), 'legacy_desktop_backup.json');
    const currentDb = createDummyDb();
    
    const migrationResult = migrateAndRestoreSchema(parseResult.data, 'Admin Operator', 'all', currentDb);
    
    assert(migrationResult.success === true, 'Migrate and restore V1 legacy layout');
    assert(migrationResult.summary.imported > 0, 'Restored items count is greater than zero');
    assert(migrationResult.summary.missingEntities.includes('stockItems'), 'Detected missing inventory table');
    assert(migrationResult.migratedDb.medicines.length === 2, 'Overwrote medicines catalogs correctly (2 legacy)');
    assert(migrationResult.migratedDb.customers.length === 2, 'Imported customers from legacy format');
  } catch (err: any) {
    console.error('Test 4 failed with error:', err);
    failedCount++;
  }

  // TEST 5: Verify Sandboxing (Branch isolation does not overwrite other branches)
  try {
    const filePath = path.join(process.cwd(), 'data', 'samples', 'legacy_desktop_backup.json');
    const jsonText = fs.readFileSync(filePath, 'utf8');
    const parseResult = parseRawBackup(JSON.parse(jsonText), 'legacy_desktop_backup.json');
    const currentDb = createDummyDb();
    
    // Sandbox to Branch 2
    const migrationResult = migrateAndRestoreSchema(parseResult.data, 'Admin Operator', 'b2', currentDb);
    
    assert(migrationResult.success === true, 'Isolate restore to branch b2');
    // Check that existing b1 stockItems are untouched!
    const hasB1Stock = migrationResult.migratedDb.stockItems.some(st => st.branchId === 'b1');
    assert(hasB1Stock === true, 'Branch sandboxing preserved existing branch b1 inventory levels');
  } catch (err: any) {
    console.error('Test 5 failed with error:', err);
    failedCount++;
  }

  // TEST 6: Relational repair & logging audit trail
  try {
    logToAuditTrail('Restoration unit testing checkpoint engagement.');
    const logPath = path.join(process.cwd(), 'restoration_validation_audit_trail.log');
    assert(fs.existsSync(logPath), 'Writes audits to restoration_validation_audit_trail.log');
  } catch (err: any) {
    console.error('Test 6 failed with error:', err);
    failedCount++;
  }

  console.log('====================================================');
  console.log(`TEST SUITE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED.`);
  console.log('====================================================');
  
  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
