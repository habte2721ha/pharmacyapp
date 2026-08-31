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
  { id: 'b1', name: 'Main Branch', code: 'SP-MAIN', address: 'Main Pharmacy Location, Addis Ababa', phone: '+251-11-0000000' }
];

const INITIAL_USERS: (User & { passwordHash: string })[] = [
  { id: 'u1', username: 'admin', name: 'Admin', email: 'admin@sonanpharma.com', role: UserRole.SUPER_ADMIN, branchId: 'all', isActive: true, twoFactorEnabled: false, twoFactorSecret: '123456', passwordHash: 'admin123', recognizedDevices: ['dev_default'] }
];

const INITIAL_SUPPLIERS: Supplier[] = [];
const INITIAL_MEDICINES: Medicine[] = [];
const INITIAL_STOCK_ITEMS: StockItem[] = [];
const INITIAL_CUSTOMERS: Customer[] = [];

// Helper to calculate dates
const getRelativeDateStr = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

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

const INITIAL_SALES: Sale[] = [];
const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [];
const INITIAL_STOCK_TRANSFERS: StockTransfer[] = [];
const INITIAL_EXPENSES: Expense[] = [];
const INITIAL_AUDIT_LOGS: AuditLog[] = [];
const INITIAL_BACKUP_RECORDS: BackupRecord[] = [];

export const INITIAL_PAYROLL_PROFILES: PayrollProfile[] = [];
export const INITIAL_SALARY_ADVANCES: SalaryAdvance[] = [];

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

export const INITIAL_STAFF_ATTENDANCE: StaffAttendance[] = [];

export const isSimilarName = (name1: string, name2: string): boolean => {
  if (!name1 || !name2) return false;
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return clean(name1) === clean(name2);
};

export const unifyDuplicateMedicines = (db: DbSchema): DbSchema => {
  if (!db.medicines || db.medicines.length === 0) return db;

  // Only remove exact duplicate IDs or identical object profiles, preserving all user-added items
  const seenIds = new Set<string>();
  const uniqueMeds: Medicine[] = [];

  db.medicines.forEach(m => {
    if (!m || !m.id) return;
    if (!seenIds.has(m.id)) {
      seenIds.add(m.id);
      uniqueMeds.push(m);
    }
  });

  db.medicines = uniqueMeds;
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
const BACKUP_DIR = path.join(DB_DIR, 'backups');
const DB_BAK_FILE = path.join(DB_DIR, 'db.json.bak');
let lastBackupSnapshotTime = 0;
let isWritingToFile = false;
let pendingWritePayload: DbSchema | null = null;

export const invalidateDbCache = () => {
  cachedDb = null;
  lastDbFileMtime = 0;
};

// Returns database diagnostic statistics for /api/health/database
export const getDbHealthStats = () => {
  try {
    const dbPath = DB_FILE;
    const exists = fs.existsSync(dbPath);
    let fileSize = 0;
    let modifiedAt = new Date().toISOString();
    if (exists) {
      const stat = fs.statSync(dbPath);
      fileSize = stat.size;
      modifiedAt = stat.mtime.toISOString();
    }
    const current = loadDb();
    return {
      status: 'ok',
      database: exists ? 'connected' : 'ready',
      databaseStatus: 'healthy',
      fileSizeKb: Math.round(fileSize / 1024),
      lastModified: modifiedAt,
      counts: {
        branches: current.branches?.length || 0,
        users: current.users?.length || 0,
        medicines: current.medicines?.length || 0,
        stockItems: current.stockItems?.length || 0,
        suppliers: current.suppliers?.length || 0,
        sales: current.sales?.length || 0,
        purchaseOrders: current.purchaseOrders?.length || 0,
        stockTransfers: current.stockTransfers?.length || 0,
        customers: current.customers?.length || 0,
        expenses: current.expenses?.length || 0,
        auditLogs: current.auditLogs?.length || 0
      }
    };
  } catch (err: any) {
    return {
      status: 'degraded',
      database: 'cached_memory',
      databaseStatus: 'recovering',
      error: err?.message || 'DB check failed',
      counts: {
        branches: cachedDb?.branches?.length || 0,
        users: cachedDb?.users?.length || 0,
        medicines: cachedDb?.medicines?.length || 0,
        sales: cachedDb?.sales?.length || 0
      }
    };
  }
};

// Helper to write file atomically and fast using temporary file + rename without event-loop blocking
const atomicWriteJson = (filePath: string, data: any): boolean => {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    // Fast compact JSON serialization (avoids massive indentation overhead)
    const jsonStr = JSON.stringify(data);
    const tempFile = path.join(DB_DIR, `.tmp_${Date.now()}_${process.pid}_${Math.random().toString(36).slice(2)}.json`);

    // 1. Fast write to temp file
    fs.writeFileSync(tempFile, jsonStr, 'utf8');

    // 2. Atomic rename to target file
    fs.renameSync(tempFile, filePath);

    // 3. Asynchronously maintain backup copy and snapshot without stalling request cycle
    setImmediate(() => {
      try {
        if (!fs.existsSync(BACKUP_DIR)) {
          fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        fs.copyFileSync(filePath, DB_BAK_FILE);

        const now = Date.now();
        if (now - lastBackupSnapshotTime > 300000) { // 5 minutes
          lastBackupSnapshotTime = now;
          const timeStampStr = new Date().toISOString().replace(/[:.]/g, '-');
          const snapFile = path.join(BACKUP_DIR, `snapshot_${timeStampStr}.json`);
          fs.writeFileSync(snapFile, jsonStr, 'utf8');

          // Async cleanup of old snapshots (keep latest 20)
          setTimeout(() => {
            try {
              const files = fs.readdirSync(BACKUP_DIR)
                .filter(f => f.startsWith('snapshot_') && f.endsWith('.json'))
                .map(f => ({ name: f, path: path.join(BACKUP_DIR, f), time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
                .sort((a, b) => b.time - a.time);

              if (files.length > 20) {
                files.slice(20).forEach(f => {
                  try { fs.unlinkSync(f.path); } catch {}
                });
              }
            } catch {}
          }, 1000);
        }
      } catch (bkErr) {
        // Non-critical background task
      }
    });

    return true;
  } catch (err) {
    console.error('CRITICAL: atomicWriteJson failed for:', filePath, err);
    return false;
  }
};

// Helper to validate whether a parsed JSON object has minimum database integrity
const isDbSchemaValid = (obj: any): boolean => {
  return (
    obj &&
    typeof obj === 'object' &&
    Array.isArray(obj.branches) && obj.branches.length > 0 &&
    Array.isArray(obj.users) && obj.users.length > 0 &&
    Array.isArray(obj.medicines)
  );
};

// Helper to try recovering from backup files
const tryRecoverFromBackups = (): DbSchema | null => {
  console.warn('[DB RECOVERY] Attempting to recover database from backups...');

  // 1. Try DB_BAK_FILE
  if (fs.existsSync(DB_BAK_FILE)) {
    try {
      const bakRaw = fs.readFileSync(DB_BAK_FILE, 'utf8');
      const parsedBak = JSON.parse(bakRaw);
      if (isDbSchemaValid(parsedBak)) {
        console.log('[DB RECOVERY] Successfully recovered database from db.json.bak!');
        atomicWriteJson(DB_FILE, parsedBak);
        return parsedBak;
      }
    } catch (e) {
      console.warn('[DB RECOVERY] db.json.bak was unparseable:', e);
    }
  }

  // 2. Try snapshots in BACKUP_DIR
  if (fs.existsSync(BACKUP_DIR)) {
    try {
      const snapFiles = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => ({ name: f, path: path.join(BACKUP_DIR, f), time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);

      for (const snap of snapFiles) {
        try {
          const raw = fs.readFileSync(snap.path, 'utf8');
          const parsed = JSON.parse(raw);
          if (isDbSchemaValid(parsed)) {
            console.log(`[DB RECOVERY] Successfully recovered database from snapshot: ${snap.name}!`);
            atomicWriteJson(DB_FILE, parsed);
            return parsed;
          }
        } catch {}
      }
    } catch (dirErr) {
      console.warn('[DB RECOVERY] Could not read backup directory:', dirErr);
    }
  }

  // 3. Try in-memory cachedDb if available and valid
  if (cachedDb && isDbSchemaValid(cachedDb)) {
    console.log('[DB RECOVERY] Restoring database from in-memory cache!');
    atomicWriteJson(DB_FILE, cachedDb);
    return cachedDb;
  }

  return null;
};

export const loadDb = (forceReload = false): DbSchema => {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      // First check if a backup exists before creating brand-new initial seed
      const recovered = tryRecoverFromBackups();
      if (recovered) {
        cachedDb = recovered;
        try { lastDbFileMtime = fs.statSync(DB_FILE).mtimeMs; } catch {}
        return cachedDb;
      }

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
        externalPharmacies: [],
        pharmacyNotes: []
      };
      const unifiedInitDb = unifyDuplicateMedicines(initialDb);
      unifiedInitDb.medicines = alignMedicinePrices(unifiedInitDb.medicines);
      atomicWriteJson(DB_FILE, unifiedInitDb);
      cachedDb = unifiedInitDb;
      try {
        lastDbFileMtime = fs.statSync(DB_FILE).mtimeMs;
      } catch {}
      return cachedDb;
    }
    
    // Fast In-Memory Cache hit
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

    let rawData = '';
    try {
      rawData = fs.readFileSync(DB_FILE, 'utf8');
    } catch (readErr) {
      console.error('[loadDb] File read error:', readErr);
      const recovered = tryRecoverFromBackups();
      if (recovered) return recovered;
      if (cachedDb) return cachedDb;
      throw readErr;
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawData);
    } catch (parseErr) {
      console.error('[loadDb] JSON Parse failure on db.json:', parseErr);
      const recovered = tryRecoverFromBackups();
      if (recovered) return recovered;
      if (cachedDb) return cachedDb;
      throw parseErr;
    }

    if (!isDbSchemaValid(parsed)) {
      console.warn('[loadDb] db.json structure was invalid or empty, attempting recovery...');
      const recovered = tryRecoverFromBackups();
      if (recovered) return recovered;
    }

    // Initialize missing arrays without erasing user empty arrays
    if (!parsed.supplierTransactions || !Array.isArray(parsed.supplierTransactions)) {
      parsed.supplierTransactions = [];
    }
    if (!parsed.stockMovements || !Array.isArray(parsed.stockMovements)) {
      parsed.stockMovements = [];
    }
    if (!parsed.pharmacyNotes || !Array.isArray(parsed.pharmacyNotes)) {
      parsed.pharmacyNotes = [];
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
    if (!parsed.externalPharmacies || !Array.isArray(parsed.externalPharmacies)) {
      parsed.externalPharmacies = [];
    }
    if (!parsed.teleconsultations || !Array.isArray(parsed.teleconsultations)) {
      parsed.teleconsultations = [];
    }
    if (!parsed.visitors || !Array.isArray(parsed.visitors)) {
      parsed.visitors = [];
    }
    if (!parsed.categories || !Array.isArray(parsed.categories)) {
      parsed.categories = INITIAL_CATEGORIES;
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
    }
    if (!parsed.itemMasterTemplates || !Array.isArray(parsed.itemMasterTemplates)) {
      parsed.itemMasterTemplates = [];
    }

    if (!parsed.payrollProfiles || !Array.isArray(parsed.payrollProfiles)) {
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
    const recovered = tryRecoverFromBackups();
    if (recovered) return recovered;
    if (cachedDb) return cachedDb;
    
    // Return initial fallback as absolute last resort
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

export const saveDb = (dbData: DbSchema, allowWipe = false): boolean => {
  try {
    if (!dbData || typeof dbData !== 'object') {
      console.error('[saveDb] Refusing to save invalid/null dbData payload');
      return false;
    }
    if (!allowWipe && Array.isArray(dbData.users) && dbData.users.length === 0 && cachedDb && cachedDb.users && cachedDb.users.length > 0) {
      dbData.users = cachedDb.users;
    }
    if (!allowWipe && Array.isArray(dbData.branches) && dbData.branches.length === 0 && cachedDb && cachedDb.branches && cachedDb.branches.length > 0) {
      dbData.branches = cachedDb.branches;
    }
    if (dbData.medicines && Array.isArray(dbData.medicines)) {
      dbData.medicines = alignMedicinePrices(dbData.medicines);
    }
    dbData.lastUpdated = Date.now();
    cachedDb = dbData;

    const success = atomicWriteJson(DB_FILE, dbData);
    if (success) {
      try {
        lastDbFileMtime = fs.statSync(DB_FILE).mtimeMs;
      } catch {}
    }
    return success;
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
