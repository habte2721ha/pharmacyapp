export enum UserRole {
  SUPER_ADMIN = 'Super Administrator',
  BRANCH_MANAGER = 'Branch Manager',
  PHARMACIST = 'Pharmacist',
  CASHIER = 'Cashier',
  STORE_KEEPER = 'Store Keeper',
  ACCOUNTANT = 'Accountant',
  AUDITOR = 'Auditor'
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  branchId: string; // "all" for superadmin, or specific branch
  isActive: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorVerified?: boolean;
  permissions?: string[]; // Custom role-based permission capabilities
  recognizedDevices?: string[]; // Authorized browser/device IDs
  deactivatedDevices?: string[]; // Deactivated browser/device IDs
  pendingDeviceOtp?: { code: string; deviceId: string; expiry: string };
  authorizedAccessIPs?: string[]; // Allowed IPs/networks if restricted
  hasLoggedInBefore?: boolean;
}

export interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  barcode: string;
  sku: string;
  category: string;
  subCategory?: string;
  price: number; // selling price
  buyingPrice: number;
  isPrescriptionRequired: boolean;
  unit: string; // e.g., Tablet, Bottle, Box, Vial
  minStockLevel: number;
  description: string;
  productType?: 'medicine' | 'cosmetics'; // Type differentiator
  imageUrl?: string; // Optional product picture URL or base64 data
  profitMargin?: number; // Automatic pricing margin (%)
  useMarginPricing?: boolean; // Toggle for margin pricing vs fixed price
  lastEditedAt?: string; // ISO timestamp for price edit tracking
  lastEditedPrice?: number; // Keeps the manual edited price for sync
  purchaseInvoiceNumber?: string; // Optional purchase invoice number for catalog items
  supplierId?: string;
  supplierName?: string;
  code?: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  stock?: number;
  expiryDate?: string;
  createdAt?: string;
  createdAtTimestamp?: number;
  lastRefilledAt?: string;
  lastRefilledTimestamp?: number;
  isNewArrival?: boolean;
  isRefilled?: boolean;
  branchAssignment?: string;
  branchId?: string;
  discountPercentage?: number; // e.g. 15 for 15% discount
  discountPrice?: number; // discounted selling price in ETB
  isDiscountActive?: boolean; // whether the discount is currently applied
  showInDealPopup?: boolean; // whether this discounted item is featured in promotional popup
}

export interface StockItem {
  id: string;
  medicineId: string;
  branchId: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  buyingPrice: number;
  supplierId: string;
  isDamaged: boolean;
  notes?: string;
  storeQuantity?: number;
  dispensaryQuantity?: number;
  originalQuantity?: number;
  createdAt?: string; // YYYY-MM-DD
  sellingPrice?: number;
  purchaseInvoiceNumber?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  balance: number; // outstanding balance
}

export interface SaleItem {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  expiryDate?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  vatAmount: number;
  total: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  serialNumber?: number;
  branchId: string;
  branchName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  cashierId: string;
  cashierName: string;
  customerId?: string;
  customerName?: string;
  customerTin?: string; // Optional customer TIN
  subtotal: number;
  discount: number;
  vat: number; // VAT amount calculated from vatPercent
  vatPercent?: number; // Open VAT percentage (manually entered)
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Credit' | 'Bank CBE' | 'Bank BOA' | 'Bank AWASH' | 'Bank DASHEN' | 'Split' | 'Other' | 'Telebirr' | string;
  paymentDate?: string; // Optional payment date
  splitDetails?: {
    cash?: number;
    card?: number;
    credit?: number;
    cbe?: number;
    boa?: number;
    awash?: number;
    dashen?: number;
    telebirr?: number;
    mobile?: number;
    other?: number;
  };
  status: 'Completed' | 'Returned' | 'Partially Returned' | 'Voided';
  refundAmount?: number;
  items: SaleItem[];
  paymentMethodHistory?: {
    oldMethod: string;
    newMethod: string;
    changedBy: string;
    changedByRole?: string;
    changedAt: string;
    reason?: string;
  }[];
  paymentMethodChanged?: boolean;
  lastPaymentChangeNote?: string;
  isOnlineOrder?: boolean;
  orderSource?: 'In-Store' | 'Online Store' | string;
  onlineOrderId?: string;
}

export interface PaymentMethodHistoryItem {
  oldMethod: string;
  newMethod: string;
  changedBy: string;
  changedByRole?: string;
  changedAt: string;
  reason?: string;
}

export interface PurchaseItem {
  id: string;
  medicineId: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  branchName: string;
  date: string;
  total: number;
  status: 'Draft' | 'Sent' | 'Received' | 'Cancelled';
  items: PurchaseItem[];
  receivedDate?: string;
  receivedBy?: string;
}

export interface TransferItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
  batchNumber: string;
  expiryDate: string;
}

export interface ExternalPharmacy {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  tinNumber?: string;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceBranchId: string;
  sourceBranchName: string;
  targetBranchId?: string;
  targetBranchName?: string;
  externalPharmacyName?: string;
  transferType: 'Internal' | 'External';
  date: string;
  status: 'Draft' | 'Approved' | 'Dispatched' | 'Received' | 'Completed' | 'Cancelled' | 'Pending' | 'Reversed';
  items: TransferItem[];
  requestedBy: string;
  processedBy?: string;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  loyaltyPoints: number;
  creditLimit: number;
  creditBalance: number;
}

export interface Expense {
  id: string;
  branchId: string;
  branchName: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  recordedBy: string;
}

export interface AuditLog {
  id: string;
  date: string;
  time: string;
  userId: string;
  username: string;
  role: string;
  action: string;
  branchId: string;
  branchName: string;
  ipAddress: string;
  details: string;
}

export interface BackupRecord {
  id: string;
  date: string;
  time: string;
  type: 'Full' | 'Branch' | 'Legacy Desktop' | 'Legacy Web' | 'Items List Only';
  branchName: string;
  filename: string;
  size: string;
  createdBy: string;
  scheduleType: 'Manual' | 'Auto' | 'Imported';
  status: 'Success' | 'Failed';
  logs: string[];
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  branchId?: string;
  date: string;
  type: 'Purchase Credit' | 'Payment';
  amount: number;
  reference?: string; // e.g. PO-0001, Bank Ref, Check No
  dueDate?: string; // Optional payment target date
  notes?: string;
  paidAmount?: number;
  paymentStatus?: 'Pending' | 'Partially Paid' | 'Paid' | 'Overdue';
  paymentTerms?: string;
}

export interface PharmacyNote {
  id: string;
  text: string;
  authorName: string;
  authorId?: string;
  role: string;
  date: string;
  time: string;
  color?: string;
  recipientUserId?: string; // "all" or specific user ID
  recipientName?: string;   // Name/role of targeted user
  isRead?: boolean;
}

export interface StockMovement {
  id: string;
  branchId: string;
  medicineId: string;
  date: string;
  quantity: number; // movement quantity (positive or negative)
  balance: number;  // remaining balance after this movement
  type?: string;     // e.g. 'In', 'Out', 'Adjustment'
  reference?: string;
  notes?: string;
  batchNumber?: string;
  expiryDate?: string;
  buyingPrice?: number;
  sellingPrice?: number;
  supplierName?: string;
  invoiceNumber?: string;
  operatorName?: string;
  quantityIn?: number;
  quantityOut?: number;
  sourceBranchId?: string;
  sourceBranchName?: string;
  targetBranchId?: string;
  targetBranchName?: string;
}

export interface OnlineOrderItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  imageUrl?: string;
  category?: string;
  productType?: 'medicine' | 'cosmetics';
}

export interface OnlineOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  notes?: string;
  items: OnlineOrderItem[];
  totalAmount: number;
  status: 'Pending' | 'Quote Sent' | 'Confirmed' | 'Dispatched' | 'Completed' | 'Cancelled';
  createdAt: string;
  updatedAt?: string;
  branchId?: string;
  prescriptionImage?: string;
  isPrescriptionQuoteRequest?: boolean;
  quotedPrice?: number;
  adminNotes?: string;
}

export interface SelectivePopupItem {
  id: string;
  medicineId?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  originalPrice?: number;
  discountPercentage?: number;
  active: boolean;
  popupTrigger?: 'auto' | 'manual' | 'daily_special';
  ctaText?: string;
  displayOrder?: number;
  createdAt?: string;
}

export interface SelectivePopupConfig {
  enabled: boolean;
  popupTitle: string;
  popupSubtitle: string;
  autoShowDelaySeconds: number;
  showOncePerSession: boolean;
  items: SelectivePopupItem[];
}

export interface TeleconsultationMessage {
  id: string;
  sender: 'customer' | 'pharmacist' | 'system' | 'ai';
  senderName: string;
  text: string;
  timestamp: string;
  attachmentUrl?: string;
  medicationMentioned?: string;
}

export interface TeleconsultationSession {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  type: 'chat' | 'video';
  topic: 'Usage & Dosage' | 'Side Effects' | 'Drug Interactions' | 'Prescription Inquiry' | 'Chronic Care' | 'General Consultation';
  status: 'queued' | 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  pharmacistId?: string;
  pharmacistName?: string;
  notes?: string;
  messages: TeleconsultationMessage[];
  videoCallRoomId?: string;
  meetingLink?: string;
}

export interface SubCategory {
  id: string;
  name: string;
  description?: string;
  code?: string;
  itemCount?: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  type?: 'medicine' | 'cosmetics' | 'general' | string;
  productType?: 'medicine' | 'cosmetics' | 'general' | string;
  description?: string;
  subCategories?: SubCategory[];
  subcategories?: SubCategory[];
  isCustom?: boolean;
  color?: string;
  icon?: string;
  order?: number;
  itemCount?: number;
}

export interface ItemMasterTemplate {
  id: string;
  name: string;
  genericName?: string;
  category?: string;
  subCategory?: string;
  unit?: string;
  buyingPrice?: number;
  price?: number;
  profitMargin?: number;
  useMarginPricing?: boolean;
  isPrescriptionRequired?: boolean;
  productType?: 'medicine' | 'cosmetics' | string;
  minStockLevel?: number;
  description?: string;
  supplierId?: string;
  supplierName?: string;
  purchaseInvoiceNumber?: string;
  expiryDate?: string;
  batchNumber?: string;
  dosageForm?: string;
  strength?: string;
  barcode?: string;
  sku?: string;
  branchId?: string;
  imageUrl?: string;
  lastUpdated?: string;
}

export interface ItemAddPresetDefaults {
  unit?: string;
  category?: string;
  subCategory?: string;
  supplierId?: string;
  supplierName?: string;
  purchaseInvoiceNumber?: string;
  branchId?: string;
  expiryDate?: string;
  buyingPrice?: number;
  price?: number;
  productType?: 'medicine' | 'cosmetics' | string;
  profitMargin?: number;
  useMarginPricing?: boolean;
  isPrescriptionRequired?: boolean;
  minStockLevel?: number;
  description?: string;
  rememberDefaults?: boolean;
  lastAddedItemName?: string;
  lastAddedAt?: string;
}

export interface VisitorActivity {
  timestamp: string;
  action: string;
  page?: string;
  details?: string;
}

export interface VisitorLogEntry {
  id: string; // Persistent Visitor ID (e.g. vid_abc123)
  ip?: string;
  device: string; // 'Desktop' | 'Mobile' | 'Tablet'
  browser: string; // 'Chrome' | 'Safari' | 'Firefox' | 'Edge' | 'Other'
  os: string; // 'Windows' | 'macOS' | 'Android' | 'iOS' | 'Linux'
  visitCount: number; // Total number of times this visitor returned
  pageViewCount: number; // Total pages/screens viewed
  firstSeen: string; // ISO string
  lastSeen: string; // ISO string
  lastActiveTimestamp: number;
  lastPage: string;
  lastAction: string;
  activities: VisitorActivity[];
  cartCount?: number;
  ordersPlaced?: number;
  consultationsRequested?: number;
  referrer?: string;
  location?: string;
}

export interface VisitorStats {
  totalUniqueVisitors: number;
  totalVisits: number;
  totalPageViews: number;
  activeNow: number; // Active in last 5 minutes
  returningVisitorsCount: number;
  returningRatePercentage: number;
  deviceBreakdown: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  browserBreakdown: {
    chrome: number;
    safari: number;
    firefox: number;
    edge: number;
    other: number;
  };
  recentVisitors: VisitorLogEntry[];
}

export interface PayrollProfile {
  id: string;
  userId?: string;
  employeeName: string;
  employeeCode: string;
  role: string;
  branchId: string;
  employmentType: 'Full-time' | 'Part-time' | 'Contract' | 'Locum / Per-shift' | 'Intern';
  hireDate: string;
  phone?: string;
  email?: string;
  tinNumber?: string;
  pensionNumber?: string;
  bankName: string;
  accountNumber: string;
  baseSalary: number; // Monthly in ETB
  hourlyRate?: number;
  allowances: {
    housing?: number;
    transport?: number;
    medical?: number;
    position?: number;
    other?: number;
  };
  deductions: {
    pensionEmployeePercent?: number; // default 7%
    pensionEmployerPercent?: number; // default 11%
    healthInsurance?: number;
    unionFee?: number;
    otherDeductions?: number;
  };
  taxExempt?: boolean;
  status: 'Active' | 'On Leave' | 'Terminated' | 'Suspended';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  role: string;
  branchId: string;
  bankName: string;
  accountNumber: string;
  tinNumber?: string;
  pensionNumber?: string;
  baseSalary: number;
  daysWorked?: number;
  overtimeHours?: number;
  overtimeRate?: number;
  overtimePay?: number;
  housingAllowance?: number;
  transportAllowance?: number;
  medicalAllowance?: number;
  positionAllowance?: number;
  otherAllowances?: number;
  totalAllowances?: number;
  allowances?: {
    housing?: number;
    transport?: number;
    medical?: number;
    position?: number;
    other?: number;
  };
  bonus?: number;
  bonuses?: number;
  commission?: number;
  commissions?: number;
  grossSalary: number;
  taxableIncome: number;
  incomeTax: number;
  pensionEmployee: number;
  pensionEmployer: number;
  salaryAdvanceDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  totalEmployerCost?: number;
  employerTotalCost?: number;
  paymentStatus: 'Pending' | 'Paid' | 'Hold';
  paymentDate?: string;
  paymentReference?: string;
  notes?: string;
}

export interface PayrollRun {
  id: string;
  payrollNumber: string;
  periodMonth: number; // 1-12
  periodYear: number; // e.g. 2026
  periodLabel: string; // e.g. "August 2026"
  branchId: string; // 'all' or branch ID
  branchName?: string;
  runDate: string;
  status: 'Draft' | 'Approved' | 'Paid' | 'Archived';
  records: PayrollRecord[];
  totalEmployees: number;
  totalGross: number;
  totalTax: number;
  totalPensionEmployee: number;
  totalPensionEmployer: number;
  totalAdvancesDeducted: number;
  totalOtherDeductions: number;
  totalNet: number;
  totalEmployerCost: number;
  paymentMethod: string;
  paymentReference?: string;
  syncedToExpenses?: boolean;
  expenseId?: string;
  createdBy: string;
  approvedBy?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
}

export interface SalaryAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  branchId: string;
  amount: number;
  remainingBalance: number;
  monthlyDeduction: number;
  reason: string;
  requestDate: string;
  approvedDate?: string;
  approvedBy?: string;
  status: 'Pending' | 'Approved' | 'Partially Repaid' | 'Fully Repaid' | 'Rejected';
  repayments: {
    date: string;
    amount: number;
    payrollRunId?: string;
    notes?: string;
  }[];
  notes?: string;
}

export interface StaffAttendance {
  id: string;
  userId: string;
  employeeCode?: string;
  userName: string;
  userRole: string;
  branchId: string;
  branchName?: string;
  date: string; // YYYY-MM-DD
  loginTime: string; // e.g. "08:30 AM"
  logoutTime?: string; // e.g. "05:15 PM" (undefined or empty if active)
  loginTimestamp: number;
  logoutTimestamp?: number;
  durationMinutes?: number;
  status: 'active' | 'present' | 'late' | 'half_day' | 'overtime' | 'completed' | 'on_leave';
  shiftType?: 'Morning' | 'Afternoon' | 'Night' | 'Full Day' | 'General';
  method: 'auto_login' | 'manual' | 'qr_biometric';
  device?: string;
  ipAddress?: string;
  notes?: string;
  markedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceSettings {
  enabled: boolean;
  standardWorkHoursPerDay: number;
  shiftStartTime: string;
  shiftEndTime: string;
  lateGraceMinutes: number;
  autoClockOutOnLogout: boolean;
  allowManualClockIn: boolean;
  overtimeThresholdHours: number;
}

export interface AllDataPaginationInfo {
  page: number;
  limit: number;
  totalMedicines: number;
  totalPages: number;
  hasMore: boolean;
  totalStockItems: number;
  totalSales: number;
  totalAuditLogs: number;
  counts: {
    branches: number;
    users: number;
    medicines: number;
    stockItems: number;
    suppliers: number;
    purchaseOrders: number;
    transfers: number;
    customers: number;
    expenses: number;
    sales: number;
    auditLogs: number;
    pharmacyNotes: number;
  };
}

export interface AllDataResponse {
  lastUpdated: number;
  pagination?: AllDataPaginationInfo;
  branches: Branch[];
  users: User[];
  medicines: Medicine[];
  stockItems: StockItem[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  transfers: StockTransfer[];
  customers: Customer[];
  expenses: Expense[];
  sales: Sale[];
  categories: ProductCategory[];
  auditLogs: AuditLog[];
  pharmacyNotes: PharmacyNote[];
  institution?: any;
  externalPharmacies?: ExternalPharmacy[];
  stockMovements?: StockMovement[];
  teleconsultations?: TeleconsultationSession[];
  payrollProfiles?: PayrollProfile[];
  payrollRuns?: PayrollRun[];
  salaryAdvances?: SalaryAdvance[];
  staffAttendance?: StaffAttendance[];
  attendanceSettings?: AttendanceSettings | null;
}

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
  customUnits?: string[];
  itemMasterTemplates?: ItemMasterTemplate[];
  itemAddPresets?: ItemAddPresetDefaults;
  supplierTransactions?: SupplierTransaction[];
  pharmacyNotes?: PharmacyNote[];
  stockMovements?: StockMovement[];
  onlineOrders?: OnlineOrder[];
  teleconsultations?: TeleconsultationSession[];
  visitors?: VisitorLogEntry[];
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
}

