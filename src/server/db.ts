import fs from 'fs';
import path from 'path';
import { 
  Branch, User, Medicine, StockItem, Supplier, Sale, 
  PurchaseOrder, StockTransfer, Customer, Expense, AuditLog, 
  BackupRecord, UserRole, SupplierTransaction, PharmacyNote, StockMovement, ExternalPharmacy,
  SelectivePopupConfig, TeleconsultationSession, ProductCategory, SubCategory,
  ItemMasterTemplate, ItemAddPresetDefaults, VisitorLogEntry,
  PayrollProfile, PayrollRun, SalaryAdvance, StaffAttendance, AttendanceSettings
} from '../types.ts';
import { parseRawBackup, migrateAndRestoreSchema, logToAuditTrail } from './migrationService.ts';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

export interface DbSchema {
  branches: Branch[];
  users: (User & { passwordHash: string })[];
  medicines: Medicine[];
  stockItems: StockItem[];
  suppliers: Supplier[];
  sales: Sale[];
  purchaseOrders: PurchaseOrder[];
  stockTransfers: StockTransfer[];
  customers: Customer[];
  expenses: Expense[];
  auditLogs: AuditLog[];
  backupRecords: BackupRecord[];
  categories?: ProductCategory[];
  supplierTransactions?: SupplierTransaction[];
  pharmacyNotes?: PharmacyNote[];
  stockMovements?: StockMovement[];
  payrollProfiles?: PayrollProfile[];
  payrollRuns?: PayrollRun[];
  salaryAdvances?: SalaryAdvance[];
  staffAttendance?: StaffAttendance[];
  attendanceSettings?: AttendanceSettings;
  institution?: {
    name: string;
    address: string;
    phone: string;
    email: string;
    tinNumber?: string;
    logoUrl?: string;
    promoVideos?: any[];
    selectivePopupConfig?: SelectivePopupConfig;
  };
  externalPharmacies?: ExternalPharmacy[];
  onlineOrders?: any[];
  teleconsultations?: TeleconsultationSession[];
  visitors?: any[];
  customUnits?: string[];
  itemMasterTemplates?: ItemMasterTemplate[];
  itemAddPresets?: ItemAddPresetDefaults;
  lastUpdated?: number;
}

const INITIAL_BRANCHES: Branch[] = [
  { id: 'b1', name: 'Sonan Pharmacy Main Branch', code: 'SP-MAIN', address: '120 Ring Road, Addis Ababa, Ethiopia', phone: '+251-11-6112233' },
  { id: 'b2', name: 'Sonan Pharmacy No. 2', code: 'SP-B2', address: 'Bole Medhanialem, Addis Ababa, Ethiopia', phone: '+251-11-6633445' },
  { id: 'b3', name: 'Sonan Pharmacy No. 3', code: 'SP-B3', address: 'Megenagna Square, Addis Ababa, Ethiopia', phone: '+251-11-6225566' }
];

const INITIAL_USERS: (User & { passwordHash: string })[] = [
  { id: 'u1', username: 'admin', name: 'Admin', email: 'admin.super@sonanpharma.com', role: UserRole.SUPER_ADMIN, branchId: 'all', isActive: true, twoFactorEnabled: false, twoFactorSecret: '123456', passwordHash: 'admin123', recognizedDevices: ['dev_default'] }
];

const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 's1', name: 'Medco Pharmaceuticals PLC', phone: '+251-11-4402030', email: 'sales@medco-ethiopia.com', address: 'Lideta Industrial Zone, Addis Ababa', balance: 45000 },
  { id: 's2', name: 'Sonan Distributors Group', phone: '+251-11-6554433', email: 'orders@sonandistributors.com', address: 'Kirkos Subcity, Addis Ababa', balance: 12000 },
  { id: 's3', name: 'Apex Biotech Supplies', phone: '+251-11-5509988', email: 'apex@biotech-supplies.com', address: 'Akaki Kality, Addis Ababa', balance: 0 }
];

const INITIAL_MEDICINES: Medicine[] = [
  { id: 'm1', name: 'Amoxicillin 500mg', genericName: 'Amoxicillin Trihydrate', barcode: '6281001123456', sku: 'MED-AMX-500', category: 'Antibiotics', subCategory: 'Penicillins', price: 180, buyingPrice: 120, isPrescriptionRequired: true, unit: 'Box', minStockLevel: 20, description: 'Broad-spectrum penicillin antibiotic used to treat bacterial infections.', productType: 'medicine', imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&q=80' },
  { id: 'm2', name: 'Paracetamol 500mg', genericName: 'Paracetamol (Acetaminophen)', barcode: '6281001123457', sku: 'MED-PAR-500', category: 'Analgesics', subCategory: 'Antipyretics (Fever)', price: 45, buyingPrice: 25, isPrescriptionRequired: false, unit: 'Box', minStockLevel: 50, description: 'Common pain reliever and fever reducer.', productType: 'medicine', imageUrl: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=300&q=80' },
  { id: 'm3', name: 'Metformin 850mg', genericName: 'Metformin Hydrochloride', barcode: '6281001123458', sku: 'MED-MET-850', category: 'Hormones', subCategory: 'Diabetes / Insulin', price: 240, buyingPrice: 160, isPrescriptionRequired: true, unit: 'Box', minStockLevel: 15, description: 'Oral diabetes medicine that helps control blood sugar levels.', productType: 'medicine' },
  { id: 'm4', name: 'Atorvastatin 20mg', genericName: 'Atorvastatin Calcium', barcode: '6281001123459', sku: 'MED-ATR-20', category: 'Cardiovascular (CV)', subCategory: 'Statins / Cholesterol', price: 380, buyingPrice: 280, isPrescriptionRequired: true, unit: 'Box', minStockLevel: 10, description: 'Statins lipid-lowering medication used to prevent cardiovascular disease.', productType: 'medicine' },
  { id: 'm5', name: 'Omeprazole 20mg', genericName: 'Omeprazole Delayed-Release', barcode: '6281001123460', sku: 'MED-OMP-20', category: 'Gastrointestinal (GIT)', subCategory: 'Antacids / PPIs', price: 90, buyingPrice: 55, isPrescriptionRequired: false, unit: 'Box', minStockLevel: 25, description: 'Proton pump inhibitor used to treat gastroesophageal reflux disease.', productType: 'medicine' },
  { id: 'm6', name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', barcode: '6281001123461', sku: 'MED-IBU-400', category: 'Analgesics', subCategory: 'NSAIDs', price: 65, buyingPrice: 38, isPrescriptionRequired: false, unit: 'Box', minStockLevel: 30, description: 'Nonsteroidal anti-inflammatory drug (NSAID) used for pain and fever.', productType: 'medicine' },
  { id: 'm7', name: 'Azithromycin 500mg', genericName: 'Azithromycin dihydrate', barcode: '6281001123462', sku: 'MED-AZM-500', category: 'Antibiotics', subCategory: 'Macrolides', price: 420, buyingPrice: 300, isPrescriptionRequired: true, unit: 'Box', minStockLevel: 15, description: 'Macrolide antibiotic used for bacterial infections.', productType: 'medicine' },
  { id: 'm8', name: 'Loratadine 10mg', genericName: 'Loratadine', barcode: '6281001123463', sku: 'MED-LOR-10', category: 'Respiratory', subCategory: 'Antihistamines / Allergy', price: 80, buyingPrice: 48, isPrescriptionRequired: false, unit: 'Box', minStockLevel: 20, description: 'Non-drowsy 24-hour allergy relief tablets.', productType: 'medicine' },
  { id: 'm9', name: 'Fluconazole 150mg', genericName: 'Fluconazole', barcode: '6281001123464', sku: 'MED-FLU-150', category: 'Anti Fungal', subCategory: 'Oral Antifungal', price: 160, buyingPrice: 100, isPrescriptionRequired: true, unit: 'Box', minStockLevel: 10, description: 'Antifungal medication used to treat mucosal and systemic fungal infections.', productType: 'medicine' },
  { id: 'm10', name: 'Cefalexin 500mg Capsule', genericName: 'Cefalexin Monohydrate', barcode: '6281001123465', sku: 'MED-CFX-500', category: 'Antibiotics', subCategory: 'Cephalosporins', price: 290, buyingPrice: 190, isPrescriptionRequired: true, unit: 'Box', minStockLevel: 15, description: 'First-generation cephalosporin antibiotic used to treat skin and respiratory infections.', productType: 'medicine' },
  { id: 'm11', name: 'Coartem 20/120mg Tablet', genericName: 'Artemether + Lumefantrine', barcode: '6281001123466', sku: 'MED-COA-120', category: 'Antiprotozoal', subCategory: 'Antimalarial / Malaria', price: 210, buyingPrice: 140, isPrescriptionRequired: true, unit: 'Box', minStockLevel: 25, description: 'Artemisinin-based combination therapy (ACT) for acute uncomplicated malaria.', productType: 'medicine' },
  { id: 'm12', name: 'Augmentin 625mg Tablet', genericName: 'Amoxicillin + Clavulanic Acid', barcode: '6281001123467', sku: 'MED-AUG-625', category: 'Antibiotics', subCategory: 'Penicillins', price: 540, buyingPrice: 380, isPrescriptionRequired: true, unit: 'Box', minStockLevel: 20, description: 'Broad-spectrum antibacterial combination effective against beta-lactamase producing organisms.', productType: 'medicine' },
  { id: 'm13', name: 'Ciprofloxacin 500mg', genericName: 'Ciprofloxacin Hydrochloride', barcode: '6281001123468', sku: 'MED-CIP-500', category: 'Antibiotics', subCategory: 'Fluoroquinolones', price: 190, buyingPrice: 110, isPrescriptionRequired: true, unit: 'Box', minStockLevel: 20, description: 'Broad-spectrum fluoroquinolone antibiotic for urinary tract and systemic infections.', productType: 'medicine' },
  
  // Cosmetics & Skincare Products across all subcategories
  { id: 'c_m1', name: 'Hydrating Hyaluronic Acid Serum 30ml', genericName: 'Facial Serum', barcode: '6281001123901', sku: 'COS-SER-30', category: 'Skin Care', price: 850, buyingPrice: 550, isPrescriptionRequired: false, unit: 'Bottle', minStockLevel: 10, description: 'Deep hydrating facial serum for smooth, glowing skin.', productType: 'cosmetics', imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&q=80' },
  { id: 'c_m2', name: 'UV Protection Sunscreen SPF 50+', genericName: 'Sunscreen Lotion', barcode: '6281001123902', sku: 'COS-SUN-50', category: 'Sunscreen', price: 620, buyingPrice: 400, isPrescriptionRequired: false, unit: 'Tube', minStockLevel: 15, description: 'Broad spectrum UVA/UVB high protection non-greasy sunscreen lotion.', productType: 'cosmetics', imageUrl: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=300&q=80' },
  { id: 'c_m3', name: 'Nourishing Soft Body Wash 400ml', genericName: 'Shower Gel & Body Wash', barcode: '6281001123903', sku: 'COS-LOT-400', category: 'Body Wash', price: 480, buyingPrice: 320, isPrescriptionRequired: false, unit: 'Bottle', minStockLevel: 20, description: 'Moisturizing shower gel with natural shea butter and Vitamin E.', productType: 'cosmetics', imageUrl: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=300&q=80' },
  { id: 'c_m4', name: 'Volumizing Herbal Shampoo 500ml', genericName: 'Hair Shampoo', barcode: '6281001123904', sku: 'COS-SHM-500', category: 'Shampoo', price: 390, buyingPrice: 250, isPrescriptionRequired: false, unit: 'Bottle', minStockLevel: 15, description: 'Revitalizing herbal shampoo for hair shine, strength, and volume.', productType: 'cosmetics', imageUrl: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=300&q=80' },
  { id: 'c_m5', name: 'Argan Oil Moisture Repair Conditioner 350ml', genericName: 'Hair Conditioner', barcode: '6281001123905', sku: 'COS-CND-350', category: 'Conditioner', price: 420, buyingPrice: 280, isPrescriptionRequired: false, unit: 'Bottle', minStockLevel: 12, description: 'Deep hair conditioner enriched with organic Argan oil for soft, tangle-free hair.', productType: 'cosmetics' },
  { id: 'c_m6', name: 'Creamy Milk Moisturizing Soap Bar 100g', genericName: 'Beauty Soap', barcode: '6281001123906', sku: 'COS-SOP-100', category: 'Soap', price: 95, buyingPrice: 50, isPrescriptionRequired: false, unit: 'Bar', minStockLevel: 40, description: 'Gentle cleansing soap bar with rich milk protein moisturizer.', productType: 'cosmetics' },
  { id: 'c_m7', name: 'Gentle Baby & Kids Sensitive Skin Lotion 250ml', genericName: 'Baby Body Lotion', barcode: '6281001123907', sku: 'COS-KID-250', category: 'Kids Product', price: 340, buyingPrice: 220, isPrescriptionRequired: false, unit: 'Bottle', minStockLevel: 15, description: 'Hypoallergenic soothing baby lotion for delicate sensitive skin.', productType: 'cosmetics' },
  { id: 'c_m8', name: 'Keratin Deep Repair Hair Mask 250g', genericName: 'Hair Mask Treatment', barcode: '6281001123908', sku: 'COS-TRT-250', category: 'Hair Treatment', price: 580, buyingPrice: 380, isPrescriptionRequired: false, unit: 'Jar', minStockLevel: 10, description: 'Intensive keratin therapy mask to restore damaged hair fibers.', productType: 'cosmetics' },
  { id: 'c_m9', name: 'Luxury Floral Eau De Parfum Spray 100ml', genericName: 'Perfume Spray', barcode: '6281001123909', sku: 'COS-PRF-100', category: 'Parfum', price: 1450, buyingPrice: 900, isPrescriptionRequired: false, unit: 'Bottle', minStockLevel: 8, description: 'Long-lasting premium floral fragrance perfume spray.', productType: 'cosmetics' },
  { id: 'c_m10', name: '24H Active Antiperspirant Body Spray 150ml', genericName: 'Deodorant Spray', barcode: '6281001123910', sku: 'COS-DEO-150', category: 'Deodorant', price: 290, buyingPrice: 180, isPrescriptionRequired: false, unit: 'Can', minStockLevel: 25, description: '24-hour odor defense refreshing antiperspirant spray.', productType: 'cosmetics' },
  { id: 'c_m11', name: 'Soft Care Gentle Roll-On Deodorant 50ml', genericName: 'Roll-On Deodorant', barcode: '6281001123911', sku: 'COS-ROL-50', category: 'Stick and Roll Body Deodorants', price: 185, buyingPrice: 110, isPrescriptionRequired: false, unit: 'Bottle', minStockLevel: 30, description: 'Alcohol-free roll-on deodorant for sensitive underarms.', productType: 'cosmetics' },
  { id: 'c_m12', name: 'Advanced Whitening Mint Toothpaste 100ml', genericName: 'Whitening Toothpaste', barcode: '6281001123912', sku: 'COS-ORL-100', category: 'Oral Care', price: 160, buyingPrice: 95, isPrescriptionRequired: false, unit: 'Tube', minStockLevel: 35, description: 'Triple-action enamel protection and whitening toothpaste.', productType: 'cosmetics' },
  { id: 'c_m13', name: 'Biotin Hair, Skin & Nails Beauty Gummies 60s', genericName: 'Beauty Supplement', barcode: '6281001123913', sku: 'COS-VIT-60', category: 'Vitamins and Supplement', price: 780, buyingPrice: 500, isPrescriptionRequired: false, unit: 'Bottle', minStockLevel: 15, description: 'Delicious biotin and vitamin C gummies for hair growth and radiant skin.', productType: 'cosmetics' },
  { id: 'c_m14', name: 'Coconut Hair Nourishing Styling Cream 150ml', genericName: 'Hair Cream', barcode: '6281001123914', sku: 'COS-HAI-150', category: 'Hair Product', price: 310, buyingPrice: 190, isPrescriptionRequired: false, unit: 'Tub', minStockLevel: 20, description: 'Non-sticky styling and nourishing cream for smooth hair.', productType: 'cosmetics' }
];

// Helper to calculate dates
const getRelativeDateStr = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const INITIAL_STOCK_ITEMS: StockItem[] = [
  // b1 Main branch stocks
  { id: 'st1', medicineId: 'm1', branchId: 'b1', batchNumber: 'AMX-2026-01', expiryDate: getRelativeDateStr(120), quantity: 35, buyingPrice: 120, supplierId: 's1', isDamaged: false },
  { id: 'st2', medicineId: 'm2', branchId: 'b1', batchNumber: 'PAR-2026-04', expiryDate: getRelativeDateStr(240), quantity: 120, buyingPrice: 25, supplierId: 's1', isDamaged: false },
  { id: 'st3', medicineId: 'm2', branchId: 'b1', batchNumber: 'PAR-2026-EX', expiryDate: getRelativeDateStr(-5), quantity: 15, buyingPrice: 25, supplierId: 's1', isDamaged: false }, // Expired
  { id: 'st4', medicineId: 'm3', branchId: 'b1', batchNumber: 'MET-2026-08', expiryDate: getRelativeDateStr(30), quantity: 8, buyingPrice: 160, supplierId: 's2', isDamaged: false }, // Low Stock and Expiring soon
  { id: 'st5', medicineId: 'm4', branchId: 'b1', batchNumber: 'ATR-2026-03', expiryDate: getRelativeDateStr(45), quantity: 18, buyingPrice: 280, supplierId: 's2', isDamaged: false },
  { id: 'st6', medicineId: 'm5', branchId: 'b1', batchNumber: 'OMP-2026-11', expiryDate: getRelativeDateStr(360), quantity: 40, buyingPrice: 55, supplierId: 's1', isDamaged: false },
  
  // b2 branch stocks
  { id: 'st7', medicineId: 'm1', branchId: 'b2', batchNumber: 'AMX-2026-02', expiryDate: getRelativeDateStr(150), quantity: 12, buyingPrice: 120, supplierId: 's1', isDamaged: false }, // Low Stock
  { id: 'st8', medicineId: 'm2', branchId: 'b2', batchNumber: 'PAR-2026-05', expiryDate: getRelativeDateStr(210), quantity: 95, buyingPrice: 25, supplierId: 's1', isDamaged: false },
  { id: 'st9', medicineId: 'm3', branchId: 'b2', batchNumber: 'MET-2026-09', expiryDate: getRelativeDateStr(180), quantity: 22, buyingPrice: 160, supplierId: 's2', isDamaged: false },
  { id: 'st10', medicineId: 'm5', branchId: 'b2', batchNumber: 'OMP-2026-12', expiryDate: getRelativeDateStr(320), quantity: 3, buyingPrice: 55, supplierId: 's3', isDamaged: true, notes: 'Water damage' }, // Low stock & Damaged

  // b3 branch stocks
  { id: 'st11', medicineId: 'm1', branchId: 'b3', batchNumber: 'AMX-2026-03', expiryDate: getRelativeDateStr(100), quantity: 45, buyingPrice: 120, supplierId: 's1', isDamaged: false },
  { id: 'st12', medicineId: 'm4', branchId: 'b3', batchNumber: 'ATR-2026-04', expiryDate: getRelativeDateStr(90), quantity: 5, buyingPrice: 280, supplierId: 's2', isDamaged: false }, // Low Stock
  { id: 'st13', medicineId: 'm6', branchId: 'b3', batchNumber: 'IBU-2026-10', expiryDate: getRelativeDateStr(400), quantity: 80, buyingPrice: 38, supplierId: 's3', isDamaged: false },
  { id: 'st14', medicineId: 'm7', branchId: 'b3', batchNumber: 'AZM-2026-01', expiryDate: getRelativeDateStr(15), quantity: 20, buyingPrice: 300, supplierId: 's2', isDamaged: false },
  { id: 'st15', medicineId: 'm9', branchId: 'b1', batchNumber: 'FLU-2026-01', expiryDate: getRelativeDateStr(280), quantity: 40, buyingPrice: 100, supplierId: 's1', isDamaged: false },
  { id: 'st15_b', medicineId: 'm10', branchId: 'b1', batchNumber: 'CFX-2026-01', expiryDate: getRelativeDateStr(360), quantity: 45, buyingPrice: 190, supplierId: 's1', isDamaged: false },
  { id: 'st15_c', medicineId: 'm11', branchId: 'b1', batchNumber: 'COA-2026-01', expiryDate: getRelativeDateStr(420), quantity: 60, buyingPrice: 140, supplierId: 's1', isDamaged: false },
  { id: 'st15_d', medicineId: 'm12', branchId: 'b1', batchNumber: 'AUG-2026-01', expiryDate: getRelativeDateStr(200), quantity: 30, buyingPrice: 380, supplierId: 's2', isDamaged: false },
  { id: 'st15_e', medicineId: 'm13', branchId: 'b1', batchNumber: 'CIP-2026-01', expiryDate: getRelativeDateStr(300), quantity: 50, buyingPrice: 110, supplierId: 's3', isDamaged: false },
  
  // Cosmetics stocks
  { id: 'st16', medicineId: 'c_m1', branchId: 'b1', batchNumber: 'COS-SER-2026', expiryDate: getRelativeDateStr(500), quantity: 25, buyingPrice: 550, supplierId: 's2', isDamaged: false },
  { id: 'st17', medicineId: 'c_m2', branchId: 'b1', batchNumber: 'COS-SUN-2026', expiryDate: getRelativeDateStr(600), quantity: 30, buyingPrice: 400, supplierId: 's2', isDamaged: false },
  { id: 'st18', medicineId: 'c_m3', branchId: 'b1', batchNumber: 'COS-LOT-2026', expiryDate: getRelativeDateStr(700), quantity: 40, buyingPrice: 320, supplierId: 's2', isDamaged: false },
  { id: 'st19', medicineId: 'c_m4', branchId: 'b1', batchNumber: 'COS-SHM-2026', expiryDate: getRelativeDateStr(550), quantity: 50, buyingPrice: 250, supplierId: 's2', isDamaged: false },
  { id: 'st20', medicineId: 'c_m5', branchId: 'b1', batchNumber: 'COS-CND-2026', expiryDate: getRelativeDateStr(650), quantity: 35, buyingPrice: 280, supplierId: 's2', isDamaged: false },
  { id: 'st21', medicineId: 'c_m6', branchId: 'b1', batchNumber: 'COS-SOP-2026', expiryDate: getRelativeDateStr(800), quantity: 100, buyingPrice: 50, supplierId: 's2', isDamaged: false },
  { id: 'st22', medicineId: 'c_m7', branchId: 'b1', batchNumber: 'COS-KID-2026', expiryDate: getRelativeDateStr(450), quantity: 40, buyingPrice: 220, supplierId: 's2', isDamaged: false },
  { id: 'st23', medicineId: 'c_m8', branchId: 'b1', batchNumber: 'COS-TRT-2026', expiryDate: getRelativeDateStr(520), quantity: 20, buyingPrice: 380, supplierId: 's2', isDamaged: false },
  { id: 'st24', medicineId: 'c_m9', branchId: 'b1', batchNumber: 'COS-PRF-2026', expiryDate: getRelativeDateStr(900), quantity: 15, buyingPrice: 900, supplierId: 's2', isDamaged: false },
  { id: 'st25', medicineId: 'c_m10', branchId: 'b1', batchNumber: 'COS-DEO-2026', expiryDate: getRelativeDateStr(600), quantity: 60, buyingPrice: 180, supplierId: 's2', isDamaged: false },
  { id: 'st26', medicineId: 'c_m11', branchId: 'b1', batchNumber: 'COS-ROL-2026', expiryDate: getRelativeDateStr(620), quantity: 45, buyingPrice: 110, supplierId: 's2', isDamaged: false },
  { id: 'st27', medicineId: 'c_m12', branchId: 'b1', batchNumber: 'COS-ORL-2026', expiryDate: getRelativeDateStr(720), quantity: 80, buyingPrice: 95, supplierId: 's2', isDamaged: false },
  { id: 'st28', medicineId: 'c_m13', branchId: 'b1', batchNumber: 'COS-VIT-2026', expiryDate: getRelativeDateStr(400), quantity: 30, buyingPrice: 500, supplierId: 's2', isDamaged: false },
  { id: 'st29', medicineId: 'c_m14', branchId: 'b1', batchNumber: 'COS-HAI-2026', expiryDate: getRelativeDateStr(580), quantity: 40, buyingPrice: 190, supplierId: 's2', isDamaged: false }
];

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Chala Tolossa', phone: '+251-91-1223344', email: 'chala.t@gmail.com', address: 'Bole, Addis Ababa', loyaltyPoints: 340, creditLimit: 15000, creditBalance: 3200 },
  { id: 'c2', name: 'Aster Ayele', phone: '+251-91-1334455', email: 'aster.ayele@yahoo.com', address: 'Kazanchis, Addis Ababa', loyaltyPoints: 120, creditLimit: 5000, creditBalance: 0 },
  { id: 'c3', name: 'Dr. Dawit Mezgebu', phone: '+251-91-1445566', email: 'dawit.m@clinic.com', address: 'Piazza, Addis Ababa', loyaltyPoints: 850, creditLimit: 50000, creditBalance: 14500 }
];

export const INITIAL_CATEGORIES: ProductCategory[] = [
  {
    id: 'cat_antibiotics',
    name: 'Antibiotics',
    productType: 'medicine',
    description: 'Antibacterial agents, penicillins, cephalosporins, carbapenems, macrolides, and other antibiotics',
    color: 'emerald',
    subCategories: [
      { id: 'sub_ant_1', name: 'Penicillins', description: 'Amoxicillin, Ampicillin, Augmentin, Cloxacillin, Penicillin V/G' },
      { id: 'sub_ant_2', name: 'Cephalosporins', description: 'Cefalexin, Cefuroxime, Ceftriaxone, Cefixime, Cefepime' },
      { id: 'sub_ant_3', name: 'Carbapenems', description: 'Meropenem, Imipenem/Cilastatin, Ertapenem, Doripenem' },
      { id: 'sub_ant_4', name: 'Monobactams', description: 'Aztreonam and monocyclic beta-lactam antibiotics' },
      { id: 'sub_ant_5', name: 'Macrolides', description: 'Azithromycin, Clarithromycin, Erythromycin, Roxithromycin' },
      { id: 'sub_ant_6', name: 'Tetracyclines', description: 'Doxycycline, Tetracycline, Minocycline, Tigecycline' },
      { id: 'sub_ant_7', name: 'Aminoglycosides', description: 'Gentamicin, Amikacin, Tobramycin, Streptomycin, Neomycin' },
      { id: 'sub_ant_8', name: 'Fluoroquinolones', description: 'Ciprofloxacin, Levofloxacin, Norfloxacin, Moxifloxacin, Ofloxacin' },
      { id: 'sub_ant_9', name: 'Sulfonamides', description: 'Co-trimoxazole, Sulfamethoxazole/Trimethoprim, Sulfadiazine' },
      { id: 'sub_ant_10', name: 'Lincosamides', description: 'Clindamycin, Lincomycin' },
      { id: 'sub_ant_11', name: 'Glycopeptides', description: 'Vancomycin, Teicoplanin, Telavancin' },
      { id: 'sub_ant_12', name: 'Nitroimidazoles', description: 'Metronidazole, Tinidazole, Secnidazole' },
      { id: 'sub_ant_13', name: 'Oxazolidinones', description: 'Linezolid, Tedizolid' },
      { id: 'sub_ant_14', name: 'Other Antibiotics', description: 'Polymyxins (Colistin), Nitrofurantoin, Fosfomycin, Chloramphenicol, and other antibacterials' }
    ]
  },
  {
    id: 'cat_analgesics',
    name: 'Analgesics',
    productType: 'medicine',
    description: 'Pain relief, NSAIDs, antipyretics, and anti-inflammatories',
    color: 'amber',
    subCategories: [
      { id: 'sub_ana_1', name: 'NSAIDs', description: 'Nonsteroidal anti-inflammatory' },
      { id: 'sub_ana_2', name: 'Opioids / Pain Relief', description: 'Controlled pain management' },
      { id: 'sub_ana_3', name: 'Antipyretics (Fever)', description: 'Fever reducing agents' },
      { id: 'sub_ana_4', name: 'Topical Analgesic Gels', description: 'External pain rubs' },
      { id: 'sub_ana_5', name: 'Pediatric Pain Drops', description: 'Child fever and pain drops' }
    ]
  },
  {
    id: 'cat_cardiovascular',
    name: 'Cardiovascular (CV)',
    productType: 'medicine',
    description: 'Cardiac therapeutics, antihypertensives, and statins',
    color: 'rose',
    subCategories: [
      { id: 'sub_cv_1', name: 'CHF', description: 'Heart failure management' },
      { id: 'sub_cv_2', name: 'Antihypertensives', description: 'Blood pressure regulation' },
      { id: 'sub_cv_3', name: 'Antiarrhythmics', description: 'Arrhythmia management' },
      { id: 'sub_cv_4', name: 'Anticoagulants / Blood Thinners', description: 'Antithrombotic agents' },
      { id: 'sub_cv_5', name: 'Statins / Cholesterol', description: 'Lipid lowering agents' },
      { id: 'sub_cv_6', name: 'Diuretics', description: 'Fluid control diuretics' }
    ]
  },
  {
    id: 'cat_gastrointestinal',
    name: 'Gastrointestinal (GIT)',
    productType: 'medicine',
    description: 'Antacids, PPIs, anti-diarrheal, laxatives, and antiemetics',
    color: 'blue',
    subCategories: [
      { id: 'sub_git_1', name: 'Antacids / PPIs', description: 'Acid suppression' },
      { id: 'sub_git_2', name: 'Laxatives', description: 'Bowel stimulants' },
      { id: 'sub_git_3', name: 'Anti-Diarrheal', description: 'Motility inhibitors' },
      { id: 'sub_git_4', name: 'Antiemetics / Anti-Nausea', description: 'Nausea control' },
      { id: 'sub_git_5', name: 'Probiotics & Enzymes', description: 'Gut microbiome balance' }
    ]
  },
  {
    id: 'cat_respiratory',
    name: 'Respiratory',
    productType: 'medicine',
    description: 'Asthma inhalers, antihistamines, expectorants, and decongestants',
    color: 'sky',
    subCategories: [
      { id: 'sub_resp_1', name: 'Inhalers / Nebulizers', description: 'Aerosol delivery' },
      { id: 'sub_resp_2', name: 'Antihistamines / Allergy', description: 'Allergy relief' },
      { id: 'sub_resp_3', name: 'Cough Syrups & Expectorants', description: 'Cough mixtures' },
      { id: 'sub_resp_4', name: 'Nasal Decongestants', description: 'Decongestant sprays' }
    ]
  },
  {
    id: 'cat_dermatological',
    name: 'Dermatological',
    productType: 'medicine',
    description: 'Topical steroids, antifungal creams, and burn care',
    color: 'orange',
    subCategories: [
      { id: 'sub_derm_1', name: 'Antifungal Creams', description: 'Cutaneous antifungals' },
      { id: 'sub_derm_2', name: 'Topical Steroids', description: 'Anti-inflammatory creams' },
      { id: 'sub_derm_3', name: 'Antiseptic Ointments', description: 'Wound care' },
      { id: 'sub_derm_4', name: 'Burn Care', description: 'Silver sulfadiazine, gels' },
      { id: 'sub_derm_5', name: 'Acne Treatments', description: 'Acne topical agents' }
    ]
  },
  {
    id: 'cat_ent',
    name: 'ENT',
    productType: 'medicine',
    description: 'Ear, nose, throat, and ophthalmic drops and lozenges',
    color: 'cyan',
    subCategories: [
      { id: 'sub_ent_1', name: 'Ear Drops', description: 'Otic drops' },
      { id: 'sub_ent_2', name: 'Nasal Sprays', description: 'Steroid & saline sprays' },
      { id: 'sub_ent_3', name: 'Throat Lozenges/Sprays', description: 'Sore throat relief' },
      { id: 'sub_ent_4', name: 'Eye Drops / Ointments', description: 'Ophthalmic solutions' }
    ]
  },
  {
    id: 'cat_vitamins',
    name: 'Vitamins & Minerals',
    productType: 'medicine',
    description: 'Multivitamins, calcium, vitamin D, and iron supplements',
    color: 'lime',
    subCategories: [
      { id: 'sub_vit_1', name: 'Multivitamins', description: 'Complete multivitamins' },
      { id: 'sub_vit_2', name: 'Iron / Anemia Supplements', description: 'Ferrous formulations' },
      { id: 'sub_vit_3', name: 'Calcium & Vitamin D', description: 'Bone health' },
      { id: 'sub_vit_4', name: 'Vitamin C / Immunity', description: 'Immune support' },
      { id: 'sub_vit_5', name: 'Pediatric Vitamin Drops', description: 'Infant supplements' }
    ]
  },
  {
    id: 'cat_antifungal',
    name: 'Anti Fungal',
    productType: 'medicine',
    description: 'Oral and topical antifungal therapeutics',
    color: 'purple',
    subCategories: [
      { id: 'sub_af_1', name: 'Oral Antifungal', description: 'Fluconazole, Itraconazole' },
      { id: 'sub_af_2', name: 'Topical Creams', description: 'Clotrimazole, Terbinafine' },
      { id: 'sub_af_3', name: 'Vaginal Suppositories', description: 'Pessaries and ovules' }
    ]
  },
  {
    id: 'cat_antiprotozoal',
    name: 'Antiprotozoal',
    productType: 'medicine',
    description: 'Metronidazole, antimalarials, and anti-giardiasis drugs',
    color: 'teal',
    subCategories: [
      { id: 'sub_ap_1', name: 'Metronidazole & Tinidazole', description: 'Anaerobic antimicrobials' },
      { id: 'sub_ap_2', name: 'Anti-Amoebic', description: 'Amoebiasis treatments' },
      { id: 'sub_ap_3', name: 'Anti-Giardiasis', description: 'Giardiasis regimens' },
      { id: 'sub_ap_4', name: 'Antimalarial / Malaria', description: 'Coartem, Artemether' }
    ]
  },
  {
    id: 'cat_deworming',
    name: 'Deworming',
    productType: 'medicine',
    description: 'Anti-helminthics, albendazole, and deworming syrups',
    color: 'yellow',
    subCategories: [
      { id: 'sub_dew_1', name: 'Albendazole & Mebendazole', description: 'Standard dewormers' },
      { id: 'sub_dew_2', name: 'Broad Spectrum Dewormers', description: 'Multi-parasite coverage' },
      { id: 'sub_dew_3', name: 'Pediatric Deworming Syrups', description: 'Oral syrups for kids' },
      { id: 'sub_dew_4', name: 'Anti-Helminthic', description: 'Tapeworm & roundworm' }
    ]
  },
  {
    id: 'cat_hormones',
    name: 'Hormones',
    productType: 'medicine',
    description: 'Diabetes insulin, thyroid, contraceptives, and steroids',
    color: 'indigo',
    subCategories: [
      { id: 'sub_hor_1', name: 'Diabetes / Insulin', description: 'Metformin, Insulin, Glibenclamide' },
      { id: 'sub_hor_2', name: 'Thyroid Medications', description: 'Levothyroxine' },
      { id: 'sub_hor_3', name: 'Oral Contraceptive Pills', description: 'Birth control' },
      { id: 'sub_hor_4', name: 'Steroids', description: 'Prednisolone, Dexamethasone' }
    ]
  },
  {
    id: 'cat_controlled',
    name: 'Controlled Drugs',
    productType: 'medicine',
    description: 'Schedule II-IV controlled psychotropics and narcotics',
    color: 'red',
    subCategories: [
      { id: 'sub_ctrl_1', name: 'Sedatives / Anxiolytics', description: 'Diazepam, Lorazepam' },
      { id: 'sub_ctrl_2', name: 'Narcotic Analgesics', description: 'Morphine, Tramadol' },
      { id: 'sub_ctrl_3', name: 'Anticonvulsants', description: 'Phenobarbital, Phenytoin' }
    ]
  },
  {
    id: 'cat_supplies',
    name: 'Supplies',
    productType: 'medicine',
    description: 'Medical consumables, diagnostic strips, bandages, and syringes',
    color: 'zinc',
    subCategories: [
      { id: 'sub_sup_1', name: 'Syringes & Needles', description: 'Sterile disposables' },
      { id: 'sub_sup_2', name: 'Bandages & Gauze', description: 'Wound dressing' },
      { id: 'sub_sup_3', name: 'Gloves & Masks', description: 'PPE equipment' },
      { id: 'sub_sup_4', name: 'Catheters & Tubes', description: 'Clinical tubing' },
      { id: 'sub_sup_5', name: 'Diagnostic Strips', description: 'Glucometer, pregnancy tests' }
    ]
  },
  // Cosmetics Categories
  {
    id: 'cat_shampoo',
    name: 'Shampoo',
    productType: 'cosmetics',
    description: 'Hair care shampoos and anti-dandruff treatments',
    color: 'teal',
    subCategories: [
      { id: 'sub_shm_1', name: 'Anti-Dandruff', description: 'Flake-control formulas' },
      { id: 'sub_shm_2', name: 'Color Protection', description: 'Color-treated hair care' },
      { id: 'sub_shm_3', name: 'Volumizing & Hydrating', description: 'Fullness and moisture' },
      { id: 'sub_shm_4', name: 'Gentle / Baby Shampoo', description: 'Tear-free gentle wash' },
      { id: 'sub_shm_5', name: 'Clarifying Shampoo', description: 'Deep scalp cleansing' }
    ]
  },
  {
    id: 'cat_conditioner',
    name: 'Conditioner',
    productType: 'cosmetics',
    description: 'Hair conditioning, masks, and hydration treatments',
    color: 'pink',
    subCategories: [
      { id: 'sub_cnd_1', name: 'Deep Conditioning', description: 'Intensive moisture' },
      { id: 'sub_cnd_2', name: 'Leave-In Treatment', description: 'All-day protection' },
      { id: 'sub_cnd_3', name: 'Moisturizing Hair Mask', description: 'Weekly restorative mask' }
    ]
  },
  {
    id: 'cat_bodywash',
    name: 'Body Wash',
    productType: 'cosmetics',
    description: 'Shower gels, scrubs, and antibacterial body cleansers',
    color: 'cyan',
    subCategories: [
      { id: 'sub_bw_1', name: 'Hydrating Shower Gel', description: 'Moisturizing daily wash' },
      { id: 'sub_bw_2', name: 'Exfoliating Scrub', description: 'Skin renewal exfoliators' },
      { id: 'sub_bw_3', name: 'Antibacterial Body Wash', description: 'Deep cleansing hygiene' },
      { id: 'sub_bw_4', name: 'Sensitive Skin Cleanser', description: 'Hypoallergenic body wash' }
    ]
  },
  {
    id: 'cat_skincare',
    name: 'Skin Care',
    productType: 'cosmetics',
    description: 'Face serums, creams, toners, and anti-aging cosmetics',
    color: 'fuchsia',
    subCategories: [
      { id: 'sub_sc_1', name: 'Facial Cleansers & Foams', description: 'Daily face wash' },
      { id: 'sub_sc_2', name: 'Moisturizers & Day Creams', description: 'Hydrating barrier creams' },
      { id: 'sub_sc_3', name: 'Face Serums & Anti-Aging', description: 'Vitamin C, Retinol, HA' },
      { id: 'sub_sc_4', name: 'Sunscreen Lotion', description: 'Facial UV protective creams' },
      { id: 'sub_sc_5', name: 'Acne & Blemish Control', description: 'Salicylic, Niacinamide' },
      { id: 'sub_sc_6', name: 'Toner & Micellar Water', description: 'Pore refining toners' }
    ]
  },
  {
    id: 'cat_kidsproduct',
    name: 'Kids Product',
    productType: 'cosmetics',
    description: 'Baby skincare, lotions, powders, and baby shampoos',
    color: 'amber',
    subCategories: [
      { id: 'sub_kp_1', name: 'Baby Lotion & Oils', description: 'Gentle infant oils' },
      { id: 'sub_kp_2', name: 'Tear-Free Shampoo', description: 'Mild baby shampoo' },
      { id: 'sub_kp_3', name: 'Baby Powder & Diaper Rash', description: 'Zinc barrier creams' },
      { id: 'sub_kp_4', name: 'Baby Soaps', description: 'Ultra-mild cleansing bars' }
    ]
  },
  {
    id: 'cat_soap',
    name: 'Soap',
    productType: 'cosmetics',
    description: 'Beauty bar soaps, herbal soaps, and liquid hand soaps',
    color: 'emerald',
    subCategories: [
      { id: 'sub_sp_1', name: 'Beauty Bar Soap', description: 'Moisturizing beauty bars' },
      { id: 'sub_sp_2', name: 'Herbal Soap', description: 'Botanical natural bars' },
      { id: 'sub_sp_3', name: 'Medicated Soap', description: 'Sulfur and anti-blemish' },
      { id: 'sub_sp_4', name: 'Liquid Hand Soap', description: 'Sink liquid washes' }
    ]
  },
  {
    id: 'cat_hairtreatment',
    name: 'Hair Treatment',
    productType: 'cosmetics',
    description: 'Keratin therapy, scalp serums, and hair oils',
    color: 'violet',
    subCategories: [
      { id: 'sub_ht_1', name: 'Hair Oils & Serums', description: 'Argan, castor oils' },
      { id: 'sub_ht_2', name: 'Scalp Care', description: 'Follicle stimulants' },
      { id: 'sub_ht_3', name: 'Keratin & Smoothing', description: 'Anti-frizz treatments' },
      { id: 'sub_ht_4', name: 'Hair Mask / Butter', description: 'Shea butter hair treatments' }
    ]
  },
  {
    id: 'cat_parfum',
    name: 'Parfum',
    productType: 'cosmetics',
    description: 'Fine fragrances, eau de parfum, and body mists',
    color: 'purple',
    subCategories: [
      { id: 'sub_prf_1', name: 'Eau de Parfum (EDP)', description: 'Concentrated luxury fragrance' },
      { id: 'sub_prf_2', name: 'Eau de Toilette (EDT)', description: 'Fresh daily fragrance' },
      { id: 'sub_prf_3', name: 'Body Mist / Spray', description: 'Light refreshing mists' },
      { id: 'sub_prf_4', name: 'Roll-on Perfume', description: 'Pocket perfume oils' }
    ]
  },
  {
    id: 'cat_deodorant',
    name: 'Deodorant',
    productType: 'cosmetics',
    description: '24-hour body sprays and antiperspirants',
    color: 'blue',
    subCategories: [
      { id: 'sub_deo_1', name: 'Antiperspirant Spray', description: 'Sweat protection' },
      { id: 'sub_deo_2', name: 'Body Spray', description: 'All-over fragrance' },
      { id: 'sub_deo_3', name: 'Natural Deodorant', description: 'Aluminum-free formula' }
    ]
  },
  {
    id: 'cat_stickroll',
    name: 'Stick and Roll Body Deodorants',
    productType: 'cosmetics',
    description: 'Roll-on and stick deodorants',
    color: 'indigo',
    subCategories: [
      { id: 'sub_sr_1', name: 'Roll-On Deodorant', description: 'Liquid ball applicator' },
      { id: 'sub_sr_2', name: 'Stick Deodorant', description: 'Solid glide stick' },
      { id: 'sub_sr_3', name: 'Whitening Roll-On', description: 'Underarm tone brightening' }
    ]
  },
  {
    id: 'cat_oralcare',
    name: 'Oral Care',
    productType: 'cosmetics',
    description: 'Toothpaste, dental rinses, and toothbrushes',
    color: 'sky',
    subCategories: [
      { id: 'sub_oc_1', name: 'Toothpaste', description: 'Fluoride and herbal toothpaste' },
      { id: 'sub_oc_2', name: 'Mouthwash & Rinses', description: 'Antibacterial mouthwashes' },
      { id: 'sub_oc_3', name: 'Toothbrushes', description: 'Soft and medium bristles' },
      { id: 'sub_oc_4', name: 'Teeth Whitening', description: 'Whitening strips & gels' }
    ]
  },
  {
    id: 'cat_sunscreen',
    name: 'Sunscreen',
    productType: 'cosmetics',
    description: 'SPF 30 and SPF 50+ sun protection lotions and sprays',
    color: 'orange',
    subCategories: [
      { id: 'sub_sun_1', name: 'SPF 30 Broad Spectrum', description: 'Daily medium protection' },
      { id: 'sub_sun_2', name: 'SPF 50+ Sun Lotion', description: 'High UV protection' },
      { id: 'sub_sun_3', name: 'Sunscreen Spray', description: 'Quick mist application' },
      { id: 'sub_sun_4', name: 'Matte Fluid Sunscreen', description: 'Non-greasy oil-control' }
    ]
  },
  {
    id: 'cat_cos_vitamins',
    name: 'Vitamins and Supplement',
    productType: 'cosmetics',
    description: 'Beauty gummies, collagen, biotin, and skin supplements',
    color: 'rose',
    subCategories: [
      { id: 'sub_cvit_1', name: 'Beauty & Collagen', description: 'Collagen peptide boosters' },
      { id: 'sub_cvit_2', name: 'Skin, Hair & Nails', description: 'Biotin complex' },
      { id: 'sub_cvit_3', name: 'Herbal Supplements', description: 'Botanical extracts' }
    ]
  },
  {
    id: 'cat_hairproduct',
    name: 'Hair Product',
    productType: 'cosmetics',
    description: 'Styling gels, curling creams, leave-ins, and hair foods',
    color: 'emerald',
    subCategories: [
      { id: 'sub_hp_1', name: 'Hair Curling', description: 'Curl defining creams' },
      { id: 'sub_hp_2', name: 'Leave-in Conditioner', description: 'Moisturizing leave-in' },
      { id: 'sub_hp_3', name: 'Hair Growth', description: 'Follicle stimulating oils' },
      { id: 'sub_hp_4', name: 'Hair Oil', description: 'Nourishing botanical oils' },
      { id: 'sub_hp_5', name: 'Styling Gel & Wax', description: 'Edge control and waxes' },
      { id: 'sub_hp_6', name: 'Hair Spray / Mousse', description: 'Hold and volume mousses' },
      { id: 'sub_hp_7', name: 'Hair Food & Relaxer', description: 'Conditioning relaxer kits' }
    ]
  }
];

// Seed sales for the past few days to populate charts
const INITIAL_SALES: Sale[] = [
  {
    id: 'sal1',
    invoiceNumber: 'INV-2026-0001',
    branchId: 'b1',
    branchName: 'Sonan Pharmacy Main Branch',
    date: getRelativeDateStr(-4),
    time: '10:15',
    cashierId: 'u4',
    cashierName: 'Hana Assefa',
    customerId: 'c1',
    customerName: 'Chala Tolossa',
    subtotal: 180 + 90,
    discount: 10,
    vat: 39, // (270 - 10) * 0.15 = 39
    total: 299,
    paymentMethod: 'Cash',
    status: 'Completed',
    items: [
      { id: 'si1', medicineId: 'm1', medicineName: 'Amoxicillin 500mg', batchNumber: 'AMX-2026-01', quantity: 1, unitPrice: 180, discount: 5, vatAmount: 26.25, total: 201.25 },
      { id: 'si2', medicineId: 'm5', medicineName: 'Omeprazole 20mg', batchNumber: 'OMP-2026-11', quantity: 1, unitPrice: 90, discount: 5, vatAmount: 12.75, total: 97.75 }
    ]
  },
  {
    id: 'sal2',
    invoiceNumber: 'INV-2026-0002',
    branchId: 'b1',
    branchName: 'Sonan Pharmacy Main Branch',
    date: getRelativeDateStr(-3),
    time: '14:30',
    cashierId: 'u4',
    cashierName: 'Hana Assefa',
    customerId: 'c3',
    customerName: 'Dr. Dawit Mezgebu',
    subtotal: 760, // 2 * Atorvastatin (380)
    discount: 50,
    vat: 106.5, // (760 - 50) * 0.15 = 106.5
    total: 816.5,
    paymentMethod: 'Credit',
    status: 'Completed',
    items: [
      { id: 'si3', medicineId: 'm4', medicineName: 'Atorvastatin 20mg', batchNumber: 'ATR-2026-03', quantity: 2, unitPrice: 380, discount: 50, vatAmount: 106.5, total: 816.5 }
    ]
  },
  {
    id: 'sal3',
    invoiceNumber: 'INV-2026-0003',
    branchId: 'b2',
    branchName: 'Sonan Pharmacy No. 2',
    date: getRelativeDateStr(-2),
    time: '11:45',
    cashierId: 'u2',
    cashierName: 'Selam Tesfaye',
    subtotal: 90, // 2 * Paracetamol (45)
    discount: 0,
    vat: 13.5, // 90 * 0.15 = 13.5
    total: 103.5,
    paymentMethod: 'Cash',
    status: 'Completed',
    items: [
      { id: 'si4', medicineId: 'm2', medicineName: 'Paracetamol 500mg', batchNumber: 'PAR-2026-05', quantity: 2, unitPrice: 45, discount: 0, vatAmount: 13.5, total: 103.5 }
    ]
  },
  {
    id: 'sal4',
    invoiceNumber: 'INV-2026-0004',
    branchId: 'b3',
    branchName: 'Sonan Pharmacy No. 3',
    date: getRelativeDateStr(-1),
    time: '16:20',
    cashierId: 'u1',
    cashierName: 'Admin',
    subtotal: 540, // 3 * Amoxicillin (180)
    discount: 40,
    vat: 75, // (540-40)*0.15 = 75
    total: 575,
    paymentMethod: 'Card',
    status: 'Completed',
    items: [
      { id: 'si5', medicineId: 'm1', medicineName: 'Amoxicillin 500mg', batchNumber: 'AMX-2026-03', quantity: 3, unitPrice: 180, discount: 40, vatAmount: 75, total: 575 }
    ]
  },
  {
    id: 'sal5',
    invoiceNumber: 'INV-2026-0005',
    branchId: 'b1',
    branchName: 'Sonan Pharmacy Main Branch',
    date: getRelativeDateStr(0),
    time: '09:00',
    cashierId: 'u4',
    cashierName: 'Hana Assefa',
    customerId: 'c1',
    customerName: 'Chala Tolossa',
    subtotal: 180,
    discount: 0,
    vat: 27,
    total: 207,
    paymentMethod: 'Cash',
    status: 'Completed',
    items: [
      { id: 'si6', medicineId: 'm1', medicineName: 'Amoxicillin 500mg', batchNumber: 'AMX-2026-01', quantity: 1, unitPrice: 180, discount: 0, vatAmount: 27, total: 207 }
    ]
  },
  {
    id: 'sal6',
    invoiceNumber: 'INV-2026-0006',
    branchId: 'b2',
    branchName: 'Sonan Pharmacy No. 2',
    date: getRelativeDateStr(0),
    time: '10:30',
    cashierId: 'u2',
    cashierName: 'Selam Tesfaye',
    subtotal: 300,
    discount: 10,
    vat: 43.5,
    total: 333.5,
    paymentMethod: 'Cash',
    status: 'Completed',
    items: [
      { id: 'si7', medicineId: 'm2', medicineName: 'Paracetamol 500mg', batchNumber: 'PAR-2026-05', quantity: 4, unitPrice: 45, discount: 5, vatAmount: 26.25, total: 201.25 },
      { id: 'si8', medicineId: 'c_m6', medicineName: 'Johnson Baby Soap 100g', batchNumber: 'COS-SOP-2026', quantity: 2, unitPrice: 60, discount: 5, vatAmount: 17.25, total: 132.25 }
    ]
  },
  {
    id: 'sal7',
    invoiceNumber: 'INV-2026-0007',
    branchId: 'b3',
    branchName: 'Sonan Pharmacy No. 3',
    date: getRelativeDateStr(0),
    time: '11:15',
    cashierId: 'u1',
    cashierName: 'Admin',
    subtotal: 500,
    discount: 20,
    vat: 72,
    total: 552,
    paymentMethod: 'Bank CBE',
    status: 'Completed',
    items: [
      { id: 'si9', medicineId: 'm3', medicineName: 'Metformin 850mg', batchNumber: 'MET-2026-08', quantity: 2, unitPrice: 250, discount: 20, vatAmount: 72, total: 552 }
    ]
  }
];

const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'po1',
    poNumber: 'PO-2026-0001',
    supplierId: 's1',
    supplierName: 'Medco Pharmaceuticals PLC',
    branchId: 'b1',
    branchName: 'Sonan Pharmacy Main Branch',
    date: getRelativeDateStr(-10),
    total: 2400, // 20 boxes of Amoxicillin @ 120
    status: 'Received',
    items: [
      { id: 'pi1', medicineId: 'm1', medicineName: 'Amoxicillin 500mg', quantity: 20, unitPrice: 120, total: 2400 }
    ],
    receivedDate: getRelativeDateStr(-8),
    receivedBy: 'Tariku Alemu'
  },
  {
    id: 'po2',
    poNumber: 'PO-2026-0002',
    supplierId: 's2',
    supplierName: 'Sonan Distributors Group',
    branchId: 'b1',
    branchName: 'Sonan Pharmacy Main Branch',
    date: getRelativeDateStr(-2),
    total: 4200, // 15 Metformin (160) + 5 Atorvastatin (280) = 2400 + 1400 = 3800
    status: 'Sent',
    items: [
      { id: 'pi2', medicineId: 'm3', medicineName: 'Metformin 850mg', quantity: 15, unitPrice: 160, total: 2400 },
      { id: 'pi3', medicineId: 'm4', medicineName: 'Atorvastatin 20mg', quantity: 5, unitPrice: 280, total: 1400 }
    ]
  }
];

const INITIAL_STOCK_TRANSFERS: StockTransfer[] = [
  {
    id: 't1',
    transferNumber: 'ST-2026-0001',
    sourceBranchId: 'b1',
    sourceBranchName: 'Sonan Pharmacy Main Branch',
    targetBranchId: 'b2',
    targetBranchName: 'Sonan Pharmacy No. 2',
    transferType: 'Internal',
    date: getRelativeDateStr(-3),
    status: 'Received',
    items: [
      { medicineId: 'm1', medicineName: 'Amoxicillin 500mg', quantity: 5, batchNumber: 'AMX-2026-01', expiryDate: getRelativeDateStr(120) }
    ],
    requestedBy: 'Selam Tesfaye',
    processedBy: 'Admin'
  },
  {
    id: 't2',
    transferNumber: 'ST-2026-0002',
    sourceBranchId: 'b1',
    sourceBranchName: 'Sonan Pharmacy Main Branch',
    targetBranchId: 'b3',
    targetBranchName: 'Sonan Pharmacy No. 3',
    transferType: 'Internal',
    date: getRelativeDateStr(0),
    status: 'Pending',
    items: [
      { medicineId: 'm2', medicineName: 'Paracetamol 500mg', quantity: 20, batchNumber: 'PAR-2026-04', expiryDate: getRelativeDateStr(240) }
    ],
    requestedBy: 'Dr. Girma Wolde'
  }
];

const INITIAL_EXPENSES: Expense[] = [
  { id: 'e1', branchId: 'b1', branchName: 'Sonan Pharmacy Main Branch', date: getRelativeDateStr(-5), category: 'Utilities', amount: 3500, description: 'Electricity and high-speed internet bill for main clinic', recordedBy: 'Martha Bekele' },
  { id: 'e2', branchId: 'b1', branchName: 'Sonan Pharmacy Main Branch', date: getRelativeDateStr(-2), category: 'Salaries', amount: 12000, description: 'Part-time intern pharmacist salary', recordedBy: 'Martha Bekele' },
  { id: 'e3', branchId: 'b2', branchName: 'Sonan Pharmacy No. 2', date: getRelativeDateStr(-3), category: 'Rent', amount: 8000, description: 'Monthly storage annex rent', recordedBy: 'Selam Tesfaye' }
];

const INITIAL_AUDIT_LOGS: AuditLog[] = [
  { id: 'l1', date: getRelativeDateStr(-5), time: '09:00', userId: 'u1', username: 'admin', role: 'Super Administrator', action: 'Login', branchId: 'all', branchName: 'All Branches', ipAddress: '192.168.1.10', details: 'Successful administrator login with Two-Factor Verification.' },
  { id: 'l2', date: getRelativeDateStr(-5), time: '14:35', userId: 'u3', username: 'pharmacist1', role: 'Pharmacist', action: 'Stock Alert Resolved', branchId: 'b1', branchName: 'Sonan Pharmacy Main Branch', ipAddress: '192.168.1.45', details: 'Stock alert flagged for medicine Metformin 850mg (Batch MET-2026-08)' },
  { id: 'l3', date: getRelativeDateStr(-1), time: '17:45', userId: 'u1', username: 'admin', role: 'Super Administrator', action: 'Database Backup', branchId: 'all', branchName: 'All Branches', ipAddress: '192.168.1.10', details: 'Manual database full backup triggered. Destination: backup_sonan_20260627_full.json' }
];

const INITIAL_BACKUP_RECORDS: BackupRecord[] = [
  {
    id: 'back1',
    date: getRelativeDateStr(-5),
    time: '23:00',
    type: 'Full',
    branchName: 'All Branches',
    filename: 'sonan_backup_20260623_auto.json',
    size: '184 KB',
    createdBy: 'System Scheduler',
    scheduleType: 'Auto',
    status: 'Success',
    logs: [
      'Initializing backup procedure...',
      'Target database schema: Sonan Pharmacy Multi-Branch Relational JSON V2',
      'Table [branches]: 3 records compiled successfully.',
      'Table [users]: 7 records compiled successfully.',
      'Table [medicines]: 8 records compiled successfully.',
      'Table [stockItems]: 14 records compiled successfully.',
      'Table [suppliers]: 3 records compiled successfully.',
      'Table [sales]: 3 records compiled successfully.',
      'Table [purchaseOrders]: 1 record compiled successfully.',
      'Table [expenses]: 2 records compiled successfully.',
      'Table [auditLogs]: 2 records compiled successfully.',
      'Backup compression complete. Hash: 8ae9b34cd56aef19',
      'Saved successfully on Cloud Backups Storage.'
    ]
  }
];

export const INITIAL_PAYROLL_PROFILES: PayrollProfile[] = [
  {
    id: 'pay_prof_1',
    userId: 'u1',
    employeeName: 'Admin Super User',
    employeeCode: 'EMP-001',
    role: 'Super Administrator',
    branchId: 'all',
    employmentType: 'Full-time',
    hireDate: '2024-01-15',
    phone: '+251-91-1223344',
    email: 'admin.super@sonanpharma.com',
    tinNumber: '1092837465',
    pensionNumber: 'PO-2024-001',
    bankName: 'Commercial Bank of Ethiopia (CBE)',
    accountNumber: '1000192837465',
    baseSalary: 35000,
    allowances: { housing: 4000, transport: 2500, medical: 1500, position: 2000, other: 0 },
    deductions: { pensionEmployeePercent: 7, pensionEmployerPercent: 11, healthInsurance: 0, unionFee: 0, otherDeductions: 0 },
    status: 'Active',
    createdAt: '2024-01-15T08:00:00.000Z'
  },
  {
    id: 'pay_prof_2',
    employeeName: 'Dr. Dawit Abebe',
    employeeCode: 'EMP-002',
    role: 'Pharmacist',
    branchId: 'b1',
    employmentType: 'Full-time',
    hireDate: '2024-03-01',
    phone: '+251-91-2334455',
    email: 'dawit.pharmacist@sonanpharma.com',
    tinNumber: '1083746592',
    pensionNumber: 'PO-2024-002',
    bankName: 'Commercial Bank of Ethiopia (CBE)',
    accountNumber: '1000283746591',
    baseSalary: 28000,
    allowances: { housing: 3000, transport: 2000, medical: 1000, position: 1500, other: 0 },
    deductions: { pensionEmployeePercent: 7, pensionEmployerPercent: 11, healthInsurance: 0, unionFee: 0, otherDeductions: 0 },
    status: 'Active',
    createdAt: '2024-03-01T08:00:00.000Z'
  },
  {
    id: 'pay_prof_3',
    employeeName: 'Selam Tesfaye',
    employeeCode: 'EMP-003',
    role: 'Branch Manager',
    branchId: 'b2',
    employmentType: 'Full-time',
    hireDate: '2024-04-10',
    phone: '+251-91-3445566',
    email: 'selam.manager@sonanpharma.com',
    tinNumber: '1074659283',
    pensionNumber: 'PO-2024-003',
    bankName: 'Awash Bank',
    accountNumber: '01420987654300',
    baseSalary: 25000,
    allowances: { housing: 2500, transport: 1800, medical: 1000, position: 1200, other: 0 },
    deductions: { pensionEmployeePercent: 7, pensionEmployerPercent: 11, healthInsurance: 0, unionFee: 0, otherDeductions: 0 },
    status: 'Active',
    createdAt: '2024-04-10T08:00:00.000Z'
  },
  {
    id: 'pay_prof_4',
    employeeName: 'Tigist Haile',
    employeeCode: 'EMP-004',
    role: 'Cashier',
    branchId: 'b1',
    employmentType: 'Full-time',
    hireDate: '2024-06-01',
    phone: '+251-91-4556677',
    email: 'tigist.cashier@sonanpharma.com',
    tinNumber: '1065928374',
    pensionNumber: 'PO-2024-004',
    bankName: 'Commercial Bank of Ethiopia (CBE)',
    accountNumber: '1000374659281',
    baseSalary: 14000,
    allowances: { housing: 1500, transport: 1200, medical: 500, position: 0, other: 0 },
    deductions: { pensionEmployeePercent: 7, pensionEmployerPercent: 11, healthInsurance: 0, unionFee: 0, otherDeductions: 0 },
    status: 'Active',
    createdAt: '2024-06-01T08:00:00.000Z'
  },
  {
    id: 'pay_prof_5',
    employeeName: 'Yohannes Bekele',
    employeeCode: 'EMP-005',
    role: 'Store Keeper',
    branchId: 'b1',
    employmentType: 'Full-time',
    hireDate: '2024-05-15',
    phone: '+251-91-5667788',
    email: 'yohannes.store@sonanpharma.com',
    tinNumber: '1059283746',
    pensionNumber: 'PO-2024-005',
    bankName: 'Bank of Abyssinia (BOA)',
    accountNumber: '883920194820',
    baseSalary: 17000,
    allowances: { housing: 1800, transport: 1500, medical: 600, position: 0, other: 0 },
    deductions: { pensionEmployeePercent: 7, pensionEmployerPercent: 11, healthInsurance: 0, unionFee: 0, otherDeductions: 0 },
    status: 'Active',
    createdAt: '2024-05-15T08:00:00.000Z'
  },
  {
    id: 'pay_prof_6',
    employeeName: 'Helen Girma',
    employeeCode: 'EMP-006',
    role: 'Accountant',
    branchId: 'b1',
    employmentType: 'Full-time',
    hireDate: '2024-02-20',
    phone: '+251-91-6778899',
    email: 'helen.finance@sonanpharma.com',
    tinNumber: '1048392019',
    pensionNumber: 'PO-2024-006',
    bankName: 'Dashen Bank',
    accountNumber: '502938472910',
    baseSalary: 23000,
    allowances: { housing: 2200, transport: 1800, medical: 800, position: 1000, other: 0 },
    deductions: { pensionEmployeePercent: 7, pensionEmployerPercent: 11, healthInsurance: 0, unionFee: 0, otherDeductions: 0 },
    status: 'Active',
    createdAt: '2024-02-20T08:00:00.000Z'
  }
];

export const INITIAL_SALARY_ADVANCES: SalaryAdvance[] = [
  {
    id: 'adv_1',
    employeeId: 'pay_prof_4',
    employeeName: 'Tigist Haile',
    employeeCode: 'EMP-004',
    branchId: 'b1',
    amount: 3000,
    remainingBalance: 1500,
    monthlyDeduction: 1500,
    reason: 'Emergency appliance repair',
    requestDate: getRelativeDateStr(-20),
    approvedDate: getRelativeDateStr(-18),
    approvedBy: 'Admin',
    status: 'Approved',
    repayments: [
      { date: getRelativeDateStr(-10), amount: 1500, notes: 'Auto-deducted from prior cycle' }
    ]
  }
];

export const INITIAL_ATTENDANCE_SETTINGS: AttendanceSettings = {
  enabled: true,
  standardWorkHoursPerDay: 8,
  shiftStartTime: '08:30',
  shiftEndTime: '17:30',
  lateGraceMinutes: 15,
  autoClockOutOnLogout: true,
  allowManualClockIn: true,
  overtimeThresholdHours: 8
};

export const INITIAL_STAFF_ATTENDANCE: StaffAttendance[] = [
  {
    id: 'att_seed_1',
    userId: 'u_pharm',
    employeeCode: 'EMP-002',
    userName: 'Dr. Dawit Abebe',
    userRole: 'Pharmacist',
    branchId: 'b1',
    branchName: 'Sonan Pharmacy Main Branch',
    date: getRelativeDateStr(0),
    loginTime: '08:25 AM',
    logoutTime: '',
    loginTimestamp: new Date().setHours(8, 25, 0, 0),
    status: 'present',
    shiftType: 'Morning',
    method: 'auto_login',
    device: 'POS-Terminal-01',
    ipAddress: '192.168.1.15',
    notes: 'Clocked in on duty. Morning shift dispensary.'
  },
  {
    id: 'att_seed_2',
    userId: 'u_cash',
    employeeCode: 'EMP-004',
    userName: 'Tigist Haile',
    userRole: 'Cashier',
    branchId: 'b1',
    branchName: 'Sonan Pharmacy Main Branch',
    date: getRelativeDateStr(0),
    loginTime: '08:32 AM',
    logoutTime: '',
    loginTimestamp: new Date().setHours(8, 32, 0, 0),
    status: 'present',
    shiftType: 'Morning',
    method: 'auto_login',
    device: 'POS-Cashier-01',
    ipAddress: '192.168.1.18',
    notes: 'Shift started on register 1.'
  },
  {
    id: 'att_seed_3',
    userId: 'u_mgr',
    employeeCode: 'EMP-003',
    userName: 'Selam Tesfaye',
    userRole: 'Branch Manager',
    branchId: 'b2',
    branchName: 'Sonan Pharmacy No. 2',
    date: getRelativeDateStr(0),
    loginTime: '08:50 AM',
    logoutTime: '',
    loginTimestamp: new Date().setHours(8, 50, 0, 0),
    status: 'late',
    shiftType: 'Morning',
    method: 'auto_login',
    device: 'Manager-Laptop',
    ipAddress: '192.168.2.10',
    notes: 'Traffic delay on Ring Road. Checked in 20 mins late.'
  },
  {
    id: 'att_seed_4',
    userId: 'u_pharm',
    employeeCode: 'EMP-002',
    userName: 'Dr. Dawit Abebe',
    userRole: 'Pharmacist',
    branchId: 'b1',
    branchName: 'Sonan Pharmacy Main Branch',
    date: getRelativeDateStr(-1),
    loginTime: '08:20 AM',
    logoutTime: '05:30 PM',
    loginTimestamp: new Date(Date.now() - 86400000).setHours(8, 20, 0, 0),
    logoutTimestamp: new Date(Date.now() - 86400000).setHours(17, 30, 0, 0),
    durationMinutes: 550,
    status: 'completed',
    shiftType: 'Full Day',
    method: 'auto_login',
    device: 'POS-Terminal-01',
    ipAddress: '192.168.1.15',
    notes: 'Full day clinical shift completed with 10 mins overtime.'
  },
  {
    id: 'att_seed_5',
    userId: 'u_cash',
    employeeCode: 'EMP-004',
    userName: 'Tigist Haile',
    userRole: 'Cashier',
    branchId: 'b1',
    branchName: 'Sonan Pharmacy Main Branch',
    date: getRelativeDateStr(-1),
    loginTime: '08:30 AM',
    logoutTime: '05:00 PM',
    loginTimestamp: new Date(Date.now() - 86400000).setHours(8, 30, 0, 0),
    logoutTimestamp: new Date(Date.now() - 86400000).setHours(17, 0, 0, 0),
    durationMinutes: 510,
    status: 'completed',
    shiftType: 'Full Day',
    method: 'auto_login',
    device: 'POS-Cashier-01',
    ipAddress: '192.168.1.18',
    notes: 'Cashier shift signed off.'
  },
  {
    id: 'att_seed_6',
    userId: 'u_store',
    employeeCode: 'EMP-005',
    userName: 'Yohannes Bekele',
    userRole: 'Store Keeper',
    branchId: 'b1',
    branchName: 'Sonan Pharmacy Main Branch',
    date: getRelativeDateStr(-1),
    loginTime: '08:15 AM',
    logoutTime: '05:15 PM',
    loginTimestamp: new Date(Date.now() - 86400000).setHours(8, 15, 0, 0),
    logoutTimestamp: new Date(Date.now() - 86400000).setHours(17, 15, 0, 0),
    durationMinutes: 540,
    status: 'completed',
    shiftType: 'Full Day',
    method: 'auto_login',
    device: 'Store-Desktop',
    ipAddress: '192.168.1.22',
    notes: 'Inventory verification & stock transfer intake completed.'
  },
  {
    id: 'att_seed_7',
    userId: 'u_fin',
    employeeCode: 'EMP-006',
    userName: 'Helen Girma',
    userRole: 'Accountant',
    branchId: 'b1',
    branchName: 'Sonan Pharmacy Main Branch',
    date: getRelativeDateStr(-2),
    loginTime: '09:00 AM',
    logoutTime: '05:30 PM',
    loginTimestamp: new Date(Date.now() - 172800000).setHours(9, 0, 0, 0),
    logoutTimestamp: new Date(Date.now() - 172800000).setHours(17, 30, 0, 0),
    durationMinutes: 510,
    status: 'completed',
    shiftType: 'Full Day',
    method: 'auto_login',
    device: 'Finance-PC',
    ipAddress: '192.168.1.30',
    notes: 'Accounts reconciled & purchase orders verified.'
  }
];

export const isSimilarName = (name1: string, name2: string): boolean => {
  if (!name1 || !name2) return false;
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return clean(name1) === clean(name2);
};

export const unifyDuplicateMedicines = (db: DbSchema): DbSchema => {
  if (!db.medicines || db.medicines.length === 0) return db;

  const clean = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  // Find canonical representative for each clean name group
  const canonicalMap: { [cleanName: string]: Medicine } = {};
  const idMap: { [oldId: string]: string } = {}; // oldId -> canonicalId

  const uniqueMeds: Medicine[] = [];

  db.medicines.forEach(m => {
    const key = clean(m.name);
    if (!canonicalMap[key]) {
      canonicalMap[key] = m;
      uniqueMeds.push(m);
      idMap[m.id] = m.id;
    } else {
      idMap[m.id] = canonicalMap[key].id;
    }
  });

  const hasMerged = Object.keys(idMap).some(oldId => idMap[oldId] !== oldId);
  if (!hasMerged) {
    db.medicines = uniqueMeds;
    return db;
  }

  // Update medicines list
  db.medicines = uniqueMeds;

  // Update stock items
  if (db.stockItems && Array.isArray(db.stockItems)) {
    db.stockItems.forEach(st => {
      if (idMap[st.medicineId]) {
        st.medicineId = idMap[st.medicineId];
      }
    });
  }

  // Update sales items
  if (db.sales && Array.isArray(db.sales)) {
    db.sales.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          if (idMap[item.medicineId]) {
            item.medicineId = idMap[item.medicineId];
          }
        });
      }
    });
  }

  // Update purchase orders
  if (db.purchaseOrders && Array.isArray(db.purchaseOrders)) {
    db.purchaseOrders.forEach(po => {
      if (po.items && Array.isArray(po.items)) {
        po.items.forEach(item => {
          if (idMap[item.medicineId]) {
            item.medicineId = idMap[item.medicineId];
          }
        });
      }
    });
  }

  // Update stock transfers
  if (db.stockTransfers && Array.isArray(db.stockTransfers)) {
    db.stockTransfers.forEach(st => {
      if (st.items && Array.isArray(st.items)) {
        st.items.forEach(item => {
          if (idMap[item.medicineId]) {
            item.medicineId = idMap[item.medicineId];
          }
        });
      }
    });
  }

  return db;
};

export const alignMedicinePrices = (medicines: Medicine[]): Medicine[] => {
  if (!medicines || medicines.length === 0) return medicines;

  // Group medicines by their name (case-insensitive, trimmed)
  const groups: { [name: string]: Medicine[] } = {};
  medicines.forEach(m => {
    const key = m.name.trim().toLowerCase();
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(m);
  });

  // For each group, determine the correct price
  Object.keys(groups).forEach(nameKey => {
    const group = groups[nameKey];
    if (group.length <= 1) return; // No need to align a group of size 1

    const editedItems = group.filter(m => m.lastEditedPrice !== undefined && m.lastEditedPrice !== null);
    
    let targetPrice = group[0].price;

    if (editedItems.length > 0) {
      // Find the one with the latest lastEditedAt timestamp
      editedItems.sort((a, b) => {
        const timeA = a.lastEditedAt ? new Date(a.lastEditedAt).getTime() : 0;
        const timeB = b.lastEditedAt ? new Date(b.lastEditedAt).getTime() : 0;
        return timeB - timeA;
      });
      targetPrice = editedItems[0].lastEditedPrice!;
    } else {
      // "adjust the price of the same items of to the last intery or highest price"
      const prices = group.map(m => m.price);
      const maxPrice = Math.max(...prices);
      const lastEntryPrice = group[group.length - 1].price;
      targetPrice = Math.max(maxPrice, lastEntryPrice);
    }

    // Apply targetPrice to all items in the group
    group.forEach(m => {
      m.price = targetPrice;
      if (editedItems.length > 0) {
        m.lastEditedPrice = editedItems[0].lastEditedPrice;
        m.lastEditedAt = editedItems[0].lastEditedAt;
      }
    });
  });

  return medicines;
};

let cachedDb: DbSchema | null = null;
let lastDbFileMtime: number = 0;

export const invalidateDbCache = () => {
  cachedDb = null;
  lastDbFileMtime = 0;
};

export const loadDb = (forceReload = false): DbSchema => {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      const initialDb: DbSchema = {
        branches: INITIAL_BRANCHES,
        users: INITIAL_USERS,
        medicines: INITIAL_MEDICINES,
        stockItems: INITIAL_STOCK_ITEMS,
        suppliers: INITIAL_SUPPLIERS,
        sales: INITIAL_SALES,
        purchaseOrders: INITIAL_PURCHASE_ORDERS,
        stockTransfers: INITIAL_STOCK_TRANSFERS,
        customers: INITIAL_CUSTOMERS,
        expenses: INITIAL_EXPENSES,
        auditLogs: INITIAL_AUDIT_LOGS,
        backupRecords: INITIAL_BACKUP_RECORDS,
        categories: INITIAL_CATEGORIES,
        externalPharmacies: [
          { id: 'ep1', name: 'Zewditu Hospital Pharmacy', phone: '+251-11-5511223', address: 'Zewditu Street, Addis Ababa', tinNumber: '9928374615' },
          { id: 'ep2', name: 'St. Paulos General Hospital Pharmacy', phone: '+251-11-2750125', address: 'Swaziland Street, Addis Ababa', tinNumber: '7738491029' }
        ],
        pharmacyNotes: [
          {
            id: 'note_1',
            text: 'Reminder: The cold chain refrigerator temperature needs to be logged at the start and end of every shift. Keep it between 2°C and 8°C.',
            authorName: 'Admin',
            role: 'Super Administrator',
            date: '2026-06-30',
            time: '08:00'
          },
          {
            id: 'note_2',
            text: 'Azithromycin is running low in Branch 1. I requested a stock transfer from Branch 2, please approve it when you start your manager shift.',
            authorName: 'Selam Tesfaye',
            role: 'Branch Manager',
            date: '2026-06-30',
            time: '16:30'
          }
        ]
      };
      const unifiedInitDb = unifyDuplicateMedicines(initialDb);
      unifiedInitDb.medicines = alignMedicinePrices(unifiedInitDb.medicines);
      fs.writeFileSync(DB_FILE, JSON.stringify(unifiedInitDb, null, 2), 'utf8');
      cachedDb = unifiedInitDb;
      try {
        lastDbFileMtime = fs.statSync(DB_FILE).mtimeMs;
      } catch {}
      return cachedDb;
    }
    
    // Instant In-Memory Cache hit (prevents blocking sync disk I/O on rapid API calls)
    if (!forceReload && cachedDb && lastDbFileMtime !== 0) {
      try {
        const currentMtime = fs.statSync(DB_FILE).mtimeMs;
        if (currentMtime === lastDbFileMtime) {
          return cachedDb;
        }
      } catch {
        return cachedDb;
      }
    }

    const rawData = fs.readFileSync(DB_FILE, 'utf8');
    let parsed = JSON.parse(rawData);
    parsed = unifyDuplicateMedicines(parsed);
    if (!parsed.supplierTransactions) {
      parsed.supplierTransactions = [];
    }
    if (!parsed.stockMovements) {
      parsed.stockMovements = [];
    }
    if (!parsed.pharmacyNotes) {
      parsed.pharmacyNotes = [
        {
          id: 'note_1',
          text: 'Reminder: The cold chain refrigerator temperature needs to be logged at the start and end of every shift. Keep it between 2°C and 8°C.',
          authorName: 'Admin',
          role: 'Super Administrator',
          date: '2026-06-30',
          time: '08:00'
        },
        {
          id: 'note_2',
          text: 'Azithromycin is running low in Branch 1. I requested a stock transfer from Branch 2, please approve it when you start your manager shift.',
          authorName: 'Selam Tesfaye',
          role: 'Branch Manager',
          date: '2026-06-30',
          time: '16:30'
        }
      ];
    }
    if (!parsed.institution) {
      parsed.institution = {
        name: 'Sonan Pharmacy',
        address: '120 Ring Road, Addis Ababa, Ethiopia',
        phone: '+251-11-6112233',
        email: 'info@sonanpharma.com',
        tinNumber: '1234567890',
        logoUrl: ''
      };
    }
    if (!parsed.externalPharmacies) {
      parsed.externalPharmacies = [
        { id: 'ep1', name: 'Zewditu Hospital Pharmacy', phone: '+251-11-5511223', address: 'Zewditu Street, Addis Ababa', tinNumber: '9928374615' },
        { id: 'ep2', name: 'St. Paulos General Hospital Pharmacy', phone: '+251-11-2750125', address: 'Swaziland Street, Addis Ababa', tinNumber: '7738491029' }
      ];
    }
    if (!parsed.teleconsultations) {
      parsed.teleconsultations = [];
    }
    if (!parsed.visitors || !Array.isArray(parsed.visitors)) {
      parsed.visitors = [];
    }
    if (!parsed.visitors || !Array.isArray(parsed.visitors)) {
      parsed.visitors = [];
    }
    if (!parsed.categories || !Array.isArray(parsed.categories) || parsed.categories.length === 0) {
      parsed.categories = INITIAL_CATEGORIES;
    } else {
      // Ensure existing default categories have all standard subcategories available
      INITIAL_CATEGORIES.forEach(initialCat => {
        const existingCat = parsed.categories.find(
          (c: any) => c.name.toLowerCase() === initialCat.name.toLowerCase()
        );
        if (existingCat) {
          if (existingCat.name.toLowerCase() === 'antibiotics') {
            existingCat.subCategories = initialCat.subCategories || [];
          } else if (!existingCat.subCategories || !Array.isArray(existingCat.subCategories)) {
            existingCat.subCategories = initialCat.subCategories || [];
          } else {
            // Append missing subcategories from standard initial subcategories
            (initialCat.subCategories || []).forEach(standardSub => {
              const hasSub = existingCat.subCategories.some(
                (s: any) => (s.name || '').toLowerCase() === standardSub.name.toLowerCase()
              );
              if (!hasSub) {
                existingCat.subCategories.push(standardSub);
              }
            });
          }
        } else {
          parsed.categories.push(initialCat);
        }
      });
    }
    if (parsed.itemMasterTemplates && Array.isArray(parsed.itemMasterTemplates)) {
      parsed.itemMasterTemplates.forEach((t: any) => {
        if ((t.category || '').trim().toLowerCase() === 'antibiotics') {
          t.subCategory = '';
        }
      });
    }
    if (!parsed.customUnits || !Array.isArray(parsed.customUnits) || parsed.customUnits.length === 0) {
      parsed.customUnits = [
        'Piece (PCS)', 'Box', 'Strip', 'Tablet', 'Capsule', 'Vial', 'Ampoule', 
        'Bottle', 'Tube', 'Sachet', 'Blister Pack', 'Pfs (Prefilled Syringe)', 
        'Syrup Bottle', 'Suspension Bottle', 'Suppository', 'Patch', 'Jar', 
        'Spray / Inhaler', 'Canister', 'Bag', 'Roll', 'Unit'
      ];
    }
    if (!parsed.itemAddPresets) {
      parsed.itemAddPresets = {
        unit: 'Piece (PCS)',
        category: 'Antibiotics',
        subCategory: '',
        supplierId: 's1',
        branchId: 'b1',
        productType: 'medicine',
        profitMargin: 30,
        useMarginPricing: true,
        isPrescriptionRequired: false,
        rememberDefaults: true
      };
    } else if (parsed.itemAddPresets.category?.toLowerCase() === 'antibiotics') {
      parsed.itemAddPresets.subCategory = '';
    }
    if (!parsed.itemMasterTemplates || !Array.isArray(parsed.itemMasterTemplates)) {
      parsed.itemMasterTemplates = [];
    }
    // Auto-populate itemMasterTemplates from medicines if empty
    if (parsed.itemMasterTemplates.length === 0 && parsed.medicines && parsed.medicines.length > 0) {
      const stockMap: Record<string, any> = {};
      (parsed.stockItems || []).forEach((st: any) => {
        if (st.medicineId) {
          stockMap[st.medicineId] = st;
        }
      });
      parsed.itemMasterTemplates = parsed.medicines.map((m: any) => {
        const lastSt = stockMap[m.id];
        return {
          id: `tmpl_${m.id}`,
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
      });
    }
    parsed.medicines = alignMedicinePrices(parsed.medicines || []);

    // Clean up & normalize supplier names in stock movements
    if (parsed.stockMovements && Array.isArray(parsed.stockMovements)) {
      const suppliersList = parsed.suppliers && parsed.suppliers.length > 0 ? parsed.suppliers : INITIAL_SUPPLIERS;
      parsed.stockMovements.forEach((sm: any) => {
        if (sm.quantityIn > 0 && !sm.sourceBranchName && !sm.targetBranchName) {
          const curSupName = sm.supplierName || '';
          const isPlaceholder = !curSupName || 
            curSupName === 'supplier1' || 
            curSupName === 'suplier1' || 
            curSupName === 's1' || 
            curSupName === 'supplier-1' || 
            curSupName.toLowerCase() === 'registered supplier';
          
          if (isPlaceholder || sm.supplierId) {
            const matched = suppliersList.find((s: any) => 
              s.id === sm.supplierId || 
              s.id === curSupName || 
              s.name.toLowerCase() === curSupName.toLowerCase()
            );
            if (matched) {
              sm.supplierName = matched.name;
              sm.supplierId = matched.id;
            } else if (isPlaceholder) {
              const defaultSup = suppliersList.find((s: any) => s.id === 's1') || suppliersList[0];
              if (defaultSup) {
                sm.supplierName = defaultSup.name;
                sm.supplierId = defaultSup.id;
              }
            }
          }
        }
      });
    }

    // Auto-migrate: assign branch-specific sequential serialNumber starting from 1
    if (parsed.sales && Array.isArray(parsed.sales)) {
      const salesByBranch: { [branchId: string]: any[] } = {};
      parsed.sales.forEach((s: any) => {
        const bId = s.branchId || 'default';
        if (!salesByBranch[bId]) {
          salesByBranch[bId] = [];
        }
        salesByBranch[bId].push(s);
      });

      Object.keys(salesByBranch).forEach(bId => {
        const sorted = salesByBranch[bId].sort((a, b) => {
          const dateA = a.date || '';
          const dateB = b.date || '';
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          const timeA = a.time || '';
          const timeB = b.time || '';
          if (timeA !== timeB) return timeA.localeCompare(timeB);
          const idA = a.id || '';
          const idB = b.id || '';
          return idA.localeCompare(idB);
        });

        sorted.forEach((sale, index) => {
          if (!sale.serialNumber) {
            sale.serialNumber = index + 1;
          }
        });
      });
    }

    if (!parsed.payrollProfiles || !Array.isArray(parsed.payrollProfiles) || parsed.payrollProfiles.length === 0) {
      parsed.payrollProfiles = INITIAL_PAYROLL_PROFILES;
    }
    if (!parsed.payrollRuns || !Array.isArray(parsed.payrollRuns)) {
      parsed.payrollRuns = [];
    }
    if (!parsed.salaryAdvances || !Array.isArray(parsed.salaryAdvances)) {
      parsed.salaryAdvances = INITIAL_SALARY_ADVANCES;
    }
    if (!parsed.staffAttendance || !Array.isArray(parsed.staffAttendance)) {
      parsed.staffAttendance = INITIAL_STAFF_ATTENDANCE;
    }
    if (!parsed.attendanceSettings) {
      parsed.attendanceSettings = INITIAL_ATTENDANCE_SETTINGS;
    }

    cachedDb = parsed;
    try {
      lastDbFileMtime = fs.statSync(DB_FILE).mtimeMs;
    } catch {}
    return cachedDb;
  } catch (error) {
    console.error('Error loading database:', error);
    if (cachedDb) return cachedDb;
    // Return initial fallback if file read fails to prevent crash
    return {
      branches: INITIAL_BRANCHES,
      users: INITIAL_USERS,
      medicines: INITIAL_MEDICINES,
      stockItems: INITIAL_STOCK_ITEMS,
      suppliers: INITIAL_SUPPLIERS,
      sales: INITIAL_SALES,
      purchaseOrders: INITIAL_PURCHASE_ORDERS,
      stockTransfers: INITIAL_STOCK_TRANSFERS,
      customers: INITIAL_CUSTOMERS,
      expenses: INITIAL_EXPENSES,
      auditLogs: INITIAL_AUDIT_LOGS,
      backupRecords: INITIAL_BACKUP_RECORDS,
      supplierTransactions: []
    };
  }
};

export const saveDb = (dbData: DbSchema): boolean => {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (dbData && dbData.medicines) {
      dbData.medicines = alignMedicinePrices(dbData.medicines);
    }
    dbData.lastUpdated = Date.now();
    cachedDb = dbData;
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData), 'utf8');
    try {
      lastDbFileMtime = fs.statSync(DB_FILE).mtimeMs;
    } catch {}
    return true;
  } catch (error) {
    console.error('Error saving database:', error);
    return false;
  }
};

// Database integrity checks and transaction-like rollback helper with legacy migration support
export const validateAndRestoreDb = (
  rawBackup: any, 
  operatorName: string,
  targetBranchId: string = 'all',
  legacyMode: boolean = false,
  fileName: string = 'backup.json',
  itemsOnly: boolean = false,
  itemsOnlyQtyDesc: boolean = false,
  itemsOnlyRestore: boolean = false
): { 
  success: boolean; 
  summary: { imported: number; skipped: number; repaired: number; total: number; missingEntities: string[] }; 
  logs: string[]; 
  skippedReasons: string[];
  warnings: string[];
  itemsOnlyRestoreResult?: string;
} => {
  const currentDb = loadDb();

  // 1. Process and parse file types (JSON, SQL, SQLite, ZIP, etc.)
  const parseResult = parseRawBackup(rawBackup, fileName);
  if (!parseResult.success) {
    const errorLogs = [
      'Starting database restoration procedures...',
      `CRITICAL ERROR - PARSING FAILED: ${parseResult.logs[parseResult.logs.length - 1] || 'Unknown parsing exception.'}`
    ];
    return {
      success: false,
      summary: { imported: 0, skipped: 0, repaired: 0, total: 0, missingEntities: [] },
      logs: errorLogs,
      skippedReasons: parseResult.logs,
      warnings: []
    };
  }

  // 2. Perform Migration and relational auto-repair
  const migrationResult = migrateAndRestoreSchema(parseResult.data, operatorName, targetBranchId, currentDb, itemsOnly, itemsOnlyQtyDesc, itemsOnlyRestore);

  if (migrationResult.success) {
    // 3. Write migrated DB to disk
    const saveSuccess = saveDb(migrationResult.migratedDb);
    if (!saveSuccess) {
      const errorLogs = [...parseResult.logs, ...migrationResult.logs, 'FileSystem Exception: Failed to write committed database transactions to disk.'];
      return {
        success: false,
        summary: migrationResult.summary,
        logs: errorLogs,
        skippedReasons: ['Disk Write Failure'],
        warnings: migrationResult.warnings
      };
    }

    // 4. Save Backup record & Audit log to disk
    const backupId = `back_res_${Date.now().toString().slice(-4)}`;
    const mappedType: 'Full' | 'Branch' | 'Legacy Desktop' | 'Legacy Web' = 
      parseResult.format.includes('Desktop') || legacyMode 
        ? 'Legacy Desktop' 
        : parseResult.format.includes('Web') 
          ? 'Legacy Web' 
          : 'Full';

    const backupLog: BackupRecord = {
      id: backupId,
      date: getRelativeDateStr(0),
      time: new Date().toTimeString().split(' ')[0].slice(0, 5),
      type: mappedType,
      branchName: targetBranchId === 'all' ? 'All Branches' : (currentDb.branches.find(b => b.id === targetBranchId)?.name || targetBranchId),
      filename: `restore_log_${backupId}.json`,
      size: `${Math.round(JSON.stringify(rawBackup).length / 1024)} KB`,
      createdBy: operatorName,
      scheduleType: 'Imported',
      status: 'Success',
      logs: [...parseResult.logs, ...migrationResult.logs]
    };

    const finalDb = loadDb();
    finalDb.backupRecords.unshift(backupLog);

    // Create audit log
    const auditId = `l_res_${Date.now().toString().slice(-4)}`;
    const auditTrail: AuditLog = {
      id: auditId,
      date: getRelativeDateStr(0),
      time: new Date().toTimeString().split(' ')[0].slice(0, 5),
      userId: 'u1',
      username: 'admin',
      role: 'Super Administrator',
      action: 'Database Restored',
      branchId: targetBranchId,
      branchName: targetBranchId === 'all' ? 'All Branches' : (currentDb.branches.find(b => b.id === targetBranchId)?.name || targetBranchId),
      ipAddress: '127.0.0.1',
      details: `Restored database from ${parseResult.format}. Imported: ${migrationResult.summary.imported}, Skipped: ${migrationResult.summary.skipped}, Repaired: ${migrationResult.summary.repaired}. Target sandbox: ${targetBranchId}.`
    };
    finalDb.auditLogs.unshift(auditTrail);
    saveDb(finalDb);

    logToAuditTrail(`Database restoration completed successfully. ID: ${backupId}. Imported: ${migrationResult.summary.imported} rows.`);

    return {
      success: true,
      summary: migrationResult.summary,
      logs: [...parseResult.logs, ...migrationResult.logs, 'Database successfully restored and locked. Audit logs generated.'],
      skippedReasons: migrationResult.skippedReasons,
      warnings: migrationResult.warnings,
      itemsOnlyRestoreResult: migrationResult.itemsOnlyRestoreResult
    };
  } else {
    // Failure handling
    logToAuditTrail(`Database restoration failed/rolled back. Operator: ${operatorName}. Reason: ${migrationResult.skippedReasons[0]}`);
    return {
      success: false,
      summary: migrationResult.summary,
      logs: [...parseResult.logs, ...migrationResult.logs, 'Restoration halted. Transaction rolled back.'],
      skippedReasons: migrationResult.skippedReasons,
      warnings: migrationResult.warnings
    };
  }
};
