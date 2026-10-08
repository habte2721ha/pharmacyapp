import React, { useState, useEffect, useRef } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { 
  Search, ShoppingCart, Trash2, CreditCard, DollarSign, 
  UserCheck, Percent, Printer, FileText, CheckCircle, 
  AlertTriangle, X, RefreshCw, Undo, Plus, FolderOpen, 
  Save, Download, UserPlus, FileSpreadsheet, ChevronDown, Check, ShoppingBag
} from 'lucide-react';
import { Medicine, StockItem, Customer, Sale, Supplier, Branch } from '../types.ts';
import { generateReceiptPdf } from '../utils/receiptPdfGenerator';

interface PosTerminalProps {
  currentUser: any;
  medicines: Medicine[];
  stockItems: StockItem[];
  customers: Customer[];
  onSaleCompleted: () => void;
  activeBranchId?: string;
  branches?: Branch[];
  pendingOnlineOrder?: any;
  onClearPendingOnlineOrder?: () => void;
}

export default function PosTerminal({ 
  currentUser, 
  medicines, 
  stockItems, 
  customers, 
  onSaleCompleted, 
  activeBranchId, 
  branches,
  pendingOnlineOrder,
  onClearPendingOnlineOrder
}: PosTerminalProps) {
  // Institution configuration profile
  const [institution, setInstitution] = useState({
    name: 'Sonan Pharmacy',
    address: '',
    phone: '',
    email: '',
    tinNumber: ''
  });

  useEffect(() => {
    const fetchInstitution = async () => {
      try {
        const res = await fetch('/api/settings/institution');
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setInstitution({
              name: data.name || 'Sonan Pharmacy',
              address: data.address || '',
              phone: data.phone || '',
              email: data.email || '',
              tinNumber: data.tinNumber || ''
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch institution inside POS:', err);
      }
    };
    fetchInstitution();
  }, []);

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'medicine' | 'cosmetics'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');
  const [stockStatus, setStockStatus] = useState<'all' | 'instock' | 'lowstock' | 'outofstock'>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired' | 'near_expiry' | 'safe'>('all');

  // Resizable layout (split panels) state and refs
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState<number>(50); // percentage for left catalog pane (25% to 75%)
  const [isDragging, setIsDragging] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [mobilePosTab, setMobilePosTab] = useState<'catalog' | 'cart'>('catalog');

  useEffect(() => {
    const checkSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      // Clamp between 25% and 75% for optimal custom adjustability
      setLeftWidth(Math.max(25, Math.min(75, newLeftWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Dynamic selected branch inside POS terminal
  const [posBranchId, setPosBranchId] = useState(
    (activeBranchId && activeBranchId !== 'all') 
      ? activeBranchId 
      : (currentUser?.branchId === 'all' ? 'b1' : currentUser?.branchId)
  );

  useEffect(() => {
    if (activeBranchId && activeBranchId !== 'all') {
      setPosBranchId(activeBranchId);
    }
  }, [activeBranchId]);

  // Customer selection & on-the-fly registration
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    creditLimit: 5000,
    tin: ''
  });
  const [localCustomers, setLocalCustomers] = useState<Customer[]>([]);

  // Cart & Hold logic
  const [activeLoadedOrder, setActiveLoadedOrder] = useState<any | null>(null);
  const [cart, setCart] = useState<{
    medicine: Medicine;
    quantity: number;
    selectedBatchId: string;
    availableQty: number;
    expiryDate: string;
    batchNumber: string;
    overridePrice?: number;
    overridePriceStr?: string;
  }[]>([]);

  // Load online order into cart when provided
  useEffect(() => {
    if (pendingOnlineOrder && pendingOnlineOrder.items && pendingOnlineOrder.items.length > 0) {
      setActiveLoadedOrder(pendingOnlineOrder);

      const newCartItems: any[] = [];
      pendingOnlineOrder.items.forEach((item: any) => {
        const matchedMed = medicines.find(
          m => m.id === item.medicineId || (m.name && item.medicineName && m.name.toLowerCase() === item.medicineName.toLowerCase())
        ) || {
          id: item.medicineId || `online-${Math.random().toString(36).substr(2, 7)}`,
          name: item.medicineName || 'Online Item',
          genericName: 'Online Order Item',
          price: item.unitPrice || 0,
          category: item.category || 'General',
          isPrescriptionRequired: false,
          isControlled: false,
          productType: 'medicine' as const,
          availableQuantity: 100
        };

        const matchedStock = stockItems.find(s => s.medicineId === matchedMed.id && s.quantity > 0);

        newCartItems.push({
          medicine: matchedMed,
          quantity: item.quantity,
          selectedBatchId: matchedStock?.id || `batch-online-${Date.now()}`,
          availableQty: matchedStock?.quantity || ((matchedMed as any).availableQuantity ?? 100),
          expiryDate: matchedStock?.expiryDate || '2028-12-31',
          batchNumber: matchedStock?.batchNumber || 'ONLINE-STOCK',
          overridePrice: item.unitPrice
        });
      });

      setCart(newCartItems);

      if (pendingOnlineOrder.customerName) {
        setCustomerSearchQuery(pendingOnlineOrder.customerName);
        const matchedCust = customers.find(
          c => c.name.toLowerCase() === pendingOnlineOrder.customerName.toLowerCase() ||
               (c.phone && pendingOnlineOrder.customerPhone && c.phone.includes(pendingOnlineOrder.customerPhone))
        );
        if (matchedCust) {
          setSelectedCustomerId(matchedCust.id);
        }
      }
    }
  }, [pendingOnlineOrder, medicines, stockItems, customers]);
  const [heldCarts, setHeldCarts] = useState<any[]>([]);
  const [showHeldCartsDropdown, setShowHeldCartsDropdown] = useState(false);

  // Payment settings
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [mainPaymentType, setMainPaymentType] = useState<'Cash' | 'Bank' | 'Telebirr' | 'Credit' | 'Split'>('Cash');
  const [selectedBankType, setSelectedBankType] = useState<'CBE' | 'Awash' | 'BOA' | 'Dashen' | 'Other'>('CBE');
  const [customBankInput, setCustomBankInput] = useState('');
  const [savedBanks, setSavedBanks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sonan_saved_banks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showCustomBankModal, setShowCustomBankModal] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [vatPercent, setVatPercent] = useState<number>(0);
  const [vatPercentRaw, setVatPercentRaw] = useState<string>('0');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountValueRaw, setDiscountValueRaw] = useState<string>('');
  const [customerTin, setCustomerTin] = useState('');

  // Split details
  const [splitDetails, setSplitDetails] = useState({
    cash: 0,
    card: 0,
    credit: 0,
    cbe: 0,
    boa: 0,
    awash: 0,
    dashen: 0,
    other: 0
  });
  const [splitDetailsRaw, setSplitDetailsRaw] = useState<Record<string, string>>({});

  // Refund panel
  const [refundInvoiceNo, setRefundInvoiceNo] = useState('');
  const [refunding, setRefunding] = useState(false);

  // Receipt modal
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [expressCheckout, setExpressCheckout] = useState(false);
  const [receiptFormat, setReceiptFormat] = useState<'thermal' | 'a4'>('thermal');
  const [submittingCheckout, setSubmittingCheckout] = useState(false);

  // Cash Register Machine configuration state
  const [cashRegister, setCashRegister] = useState(() => {
    try {
      const saved = localStorage.getItem('sonan_cash_register');
      return saved ? JSON.parse(saved) : {
        id: 'CR-01',
        model: 'Epson TM-T88VI Thermal',
        port: 'USB001',
        baudRate: '9600',
        paperWidth: '80mm',
        headerText: 'Sonan Pharmacy Cash Register 01',
        isActive: true
      };
    } catch {
      return {
        id: 'CR-01',
        model: 'Epson TM-T88VI Thermal',
        port: 'USB001',
        baudRate: '9600',
        paperWidth: '80mm',
        headerText: 'Sonan Pharmacy Cash Register 01',
        isActive: true
      };
    }
  });
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Offline Sales state & persistence
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineModeOverride, setOfflineModeOverride] = useState<boolean>(false);
  const [queuedOfflineSales, setQueuedOfflineSales] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('sonan_offline_queued_sales');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const [showOfflineQueueModal, setShowOfflineQueueModal] = useState(false);

  // Active server connectivity probe & sync trigger
  useEffect(() => {
    let isChecking = false;
    const checkServerConnection = async () => {
      if (isChecking) return;
      isChecking = true;
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;
        const res = await fetch('/api/health', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
          signal: controller ? controller.signal : undefined
        });
        if (timeoutId) clearTimeout(timeoutId);
        if (res.ok || res.status < 500) {
          setIsOnline(true);
        }
      } catch {
        // Only set offline if standard browser says offline too
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setIsOnline(false);
        }
      } finally {
        isChecking = false;
      }
    };

    // Initial check
    checkServerConnection();
    const interval = setInterval(checkServerConnection, 30000);

    const handleOnline = () => {
      setIsOnline(true);
      checkServerConnection();
    };
    const handleOffline = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-sync queued offline sales when online
  useEffect(() => {
    if (isOnline && !offlineModeOverride && queuedOfflineSales.length > 0 && !isSyncingOffline) {
      const timer = setTimeout(() => {
        syncOfflineSales();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isOnline, offlineModeOverride, queuedOfflineSales.length]);

  const saveQueuedOfflineSales = (updated: any[]) => {
    setQueuedOfflineSales(updated);
    try {
      localStorage.setItem('sonan_offline_queued_sales', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save offline sales queue', e);
    }
  };

  const syncOfflineSales = async () => {
    if (queuedOfflineSales.length === 0) return;

    setIsSyncingOffline(true);
    let successCount = 0;
    const remaining: any[] = [];

    for (const item of queuedOfflineSales) {
      try {
        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload)
        });
        if (res.ok) {
          successCount++;
        } else {
          remaining.push(item);
        }
      } catch (err) {
        console.error('Failed syncing offline sale item:', err);
        remaining.push(item);
      }
    }

    saveQueuedOfflineSales(remaining);
    setIsSyncingOffline(false);

    if (successCount > 0) {
      showToast(`✅ Synced ${successCount} offline sale(s) to server database!`, 'success');
      onSaleCompleted();
    }
    if (remaining.length > 0) {
      showToast(`⚠️ ${remaining.length} offline sale(s) could not be synced yet.`, 'info');
    }
  };

  const clearOfflineQueue = () => {
    if (confirm('Are you sure you want to discard all pending offline sales in queue?')) {
      saveQueuedOfflineSales([]);
      showToast('Offline queue cleared.', 'info');
      setShowOfflineQueueModal(false);
    }
  };

  // Notifications, Customer search suggestions, and Hold/Clear confirmations
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(prev => prev?.message === message ? null : prev);
    }, 4500);
  };

  // Suppliers list loaded dynamically
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);

  // active branch from logged in user profile or dynamic header selection
  const branchId = posBranchId;

  // Load suppliers and held carts on mount
  useEffect(() => {
    fetch('/api/suppliers')
      .then(res => res.ok ? res.json() : [])
      .then(data => setSuppliersList(data))
      .catch(err => console.error('Failed to load suppliers in POS:', err));

    const saved = localStorage.getItem('sonan_held_carts_v2');
    if (saved) {
      try {
        setHeldCarts(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse held carts:', e);
      }
    }
  }, []);

  // Update customer TIN when selected customer changes
  useEffect(() => {
    const cust = allCustomers.find(c => c.id === selectedCustomerId);
    if (cust) {
      // If customer has a tin saved or we let user enter it
      setCustomerTin('');
    } else {
      setCustomerTin('');
    }
  }, [selectedCustomerId]);

  const saveHeldCarts = (updated: any[]) => {
    setHeldCarts(updated);
    localStorage.setItem('sonan_held_carts_v2', JSON.stringify(updated));
  };

  // Combine parent customer list with newly added on-the-fly local customers
  const allCustomers = [
    ...customers,
    ...localCustomers.filter(lc => !customers.some(c => c.id === lc.id))
  ];

  // Debounced search queries to prevent UI stuttering and unnecessary re-renders
  const debouncedSearchTerm = useDebounce(searchTerm, 200);
  const debouncedCustomerSearch = useDebounce(customerSearchQuery, 200);

  // Filter customer list based on query (name or phone)
  const filteredCustomers = React.useMemo(() => {
    if (!debouncedCustomerSearch) return allCustomers;
    const q = debouncedCustomerSearch.toLowerCase().trim();
    return allCustomers.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)));
  }, [allCustomers, debouncedCustomerSearch]);

  // Pre-grouped stock items and quantities by medicine ID for O(1) instantaneous lookups
  const stockSummaryMap = React.useMemo(() => {
    const summary: {
      [medId: string]: {
        branchBatches: StockItem[];
        totalBranchQty: number;
        globalQty: number;
        otherBranchStock: StockItem[];
        damagedQty: number;
        expiredQty: number;
        storeOnlyQty: number;
        dispensaryOnlyQty: number;
        storeStockItems: StockItem[];
      }
    } = {};

    const today = new Date().toISOString().split('T')[0];

    stockItems.forEach(st => {
      const medKey = String(st.medicineId).trim();
      if (!summary[medKey]) {
        summary[medKey] = {
          branchBatches: [],
          totalBranchQty: 0,
          globalQty: 0,
          otherBranchStock: [],
          damagedQty: 0,
          expiredQty: 0,
          storeOnlyQty: 0,
          dispensaryOnlyQty: 0,
          storeStockItems: []
        };
      }

      const effQty = typeof st.quantity === 'number' ? Math.max(0, st.quantity) : 0;
      const normalizedSt = st;

      const targetBranch = branches?.find(b => b.id === branchId || b.name === branchId || b.code === branchId);
      const isBranchMatch = branchId === 'all' || !branchId || !st.branchId || st.branchId === branchId ||
        (targetBranch && (
          st.branchId === targetBranch.id ||
          st.branchId === targetBranch.name ||
          st.branchId === targetBranch.code
        ));

      if (st.isDamaged) {
        if (isBranchMatch) {
          summary[medKey].damagedQty += effQty;
        }
        return;
      }

      if (st.expiryDate && st.expiryDate < today) {
        if (isBranchMatch) {
          summary[medKey].expiredQty += effQty;
        }
        return;
      }

      if (effQty > 0) {
        summary[medKey].globalQty += effQty;
      }

      const dQty = st.dispensaryQuantity !== undefined ? st.dispensaryQuantity : 0;
      const sQty = st.storeQuantity !== undefined ? st.storeQuantity : Math.max(0, effQty - dQty);

      if (isBranchMatch) {
        summary[medKey].storeOnlyQty += sQty;
        summary[medKey].dispensaryOnlyQty += dQty;
        if (sQty > 0) {
          summary[medKey].storeStockItems.push(normalizedSt);
        }

        if (effQty > 0) {
          summary[medKey].branchBatches.push(normalizedSt);
          summary[medKey].totalBranchQty += effQty;
        }
      } else if (effQty > 0) {
        summary[medKey].otherBranchStock.push(normalizedSt);
      }
    });

    return summary;
  }, [stockItems, branchId, branches]);

  const activeStockMap = React.useMemo(() => {
    const map: { [medId: string]: StockItem[] } = {};
    Object.keys(stockSummaryMap).forEach(k => {
      map[k] = stockSummaryMap[k].branchBatches;
    });
    return map;
  }, [stockSummaryMap]);

  // Get stock batches for a product in this branch (O(1) lookup)
  const getBatchStockForMedicine = React.useCallback((medId: string, medObj?: Medicine): StockItem[] => {
    const medIdStr = String(medId).trim();
    const info = stockSummaryMap[medIdStr] || stockSummaryMap[medId];
    if (info && info.branchBatches.length > 0) return info.branchBatches;

    // Fallback: Check if medicine itself has stock on its record if no stock items recorded yet
    const targetMed = medObj || medicines.find(m => String(m.id).trim() === medIdStr);
    if (targetMed) {
      const directQty = Number((targetMed as any).stockQuantity ?? targetMed.stock ?? (targetMed as any).quantity ?? 0);
      if (directQty > 0) {
        return [{
          id: `virtual_${targetMed.id}`,
          medicineId: targetMed.id,
          branchId: branchId === 'all' ? 'b1' : (branchId || 'b1'),
          batchNumber: (targetMed as any).batchNumber || 'MAIN-STOCK',
          expiryDate: targetMed.expiryDate || '2029-12-31',
          quantity: directQty,
          buyingPrice: targetMed.buyingPrice || Math.round((targetMed.price || 0) * 0.7),
          supplierId: 'sup-default',
          isDamaged: false
        }];
      }
    }

    return [];
  }, [stockSummaryMap, medicines, branchId]);

  // Helper date utility for warning alerts (180 days)
  const getDaysUntilExpiry = (expiryStr: string): number => {
    if (!expiryStr) return 999;
    const today = new Date();
    const expiry = new Date(expiryStr);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Find price adjusted to the last added batch price
  const getPosItemPrice = (med: Medicine, selectedBatchId?: string): number => {
    const useMargin = med.useMarginPricing !== undefined ? !!med.useMarginPricing : (med.profitMargin !== undefined);
    if (!useMargin) {
      return Math.round(med.price || 0);
    }

    const curBranch = currentUser?.branchId === 'all' ? (localStorage.getItem('sonan_pos_branch_id') || 'b1') : currentUser?.branchId;
    const medIdStr = String(med.id).trim();
    
    const info = stockSummaryMap[medIdStr];
    let batches = info?.branchBatches || [];
    
    if (batches.length === 0) {
      return Math.round(med.price || 0);
    }

    let targetBatch = batches[batches.length - 1];
    if (selectedBatchId) {
      const found = batches.find(b => b.id === selectedBatchId);
      if (found) {
        targetBatch = found;
      }
    }

    const margin = med.profitMargin !== undefined ? med.profitMargin : 30;
    const calculatedPrice = targetBatch.buyingPrice * (1 + margin / 100);
    
    return Math.round(calculatedPrice);
  };

  // State toggle to optionally include zero-stock or all catalog products
  const [showAllCatalog, setShowAllCatalog] = useState(false);

  // Master product search filter - sub-millisecond, O(1) indexed
  const filteredProducts = React.useMemo(() => {
    const searchLower = debouncedSearchTerm.toLowerCase().trim();
    const searchWords = searchLower ? searchLower.split(/\s+/).filter(Boolean) : [];

    return medicines.filter(m => {
      if (searchWords.length > 0) {
        const name = m.name.toLowerCase();
        const generic = (m.genericName || '').toLowerCase();
        const barcode = m.barcode || '';
        const sku = (m.sku || '').toLowerCase();
        const category = (m.category || '').toLowerCase();

        const fullText = `${name} ${generic} ${barcode} ${sku} ${category}`;
        const matchesSearch = searchWords.every(w => fullText.includes(w));
        if (!matchesSearch) return false;
      }

      if (showAllCatalog) return true;

      const medIdStr = String(m.id).trim();
      const info = stockSummaryMap[medIdStr];
      const totalBranchQty = info ? info.totalBranchQty : 0;

      // Show ONLY products with quantity > 0 in the selected branch
      return totalBranchQty > 0;
    });
  }, [medicines, debouncedSearchTerm, showAllCatalog, stockSummaryMap]);

  // Adding product to sales cart
  const addToCart = (med: Medicine) => {
    const batches = getBatchStockForMedicine(med.id, med);
    if (batches.length === 0) {
      showToast(`Out of Stock: ${med.name} has 0 available quantity in this branch.`, 'error');
      return;
    }

    // Sort batches by expiry date ascending (FEFO)
    const today = new Date().toISOString().split('T')[0];
    let usableBatches = batches.filter(st => !st.expiryDate || st.expiryDate >= today).sort((a,b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));
    
    if (usableBatches.length === 0) {
      usableBatches = batches;
      showToast(`Expiry Warning: Batch for ${med.name} is past/near expiry date.`, 'info');
    }

    const targetBatch = usableBatches[0];
    const targetBatchQty = typeof targetBatch.quantity === 'number' ? Math.max(0, targetBatch.quantity) : 0;

    const existingIdx = cart.findIndex(c => String(c.medicine.id) === String(med.id) && String(c.selectedBatchId) === String(targetBatch.id));
    if (existingIdx !== -1) {
      const newCart = [...cart];
      if (newCart[existingIdx].quantity + 1 > targetBatchQty) {
        showToast(`Stock Limit: Only ${targetBatchQty} units available for Batch ${targetBatch.batchNumber}`, 'error');
        return;
      }
      newCart[existingIdx].quantity += 1;
      newCart[existingIdx].availableQty = targetBatchQty;
      setCart(newCart);
    } else {
      setCart([...cart, {
        medicine: med,
        quantity: 1,
        selectedBatchId: targetBatch.id,
        availableQty: targetBatchQty,
        expiryDate: targetBatch.expiryDate || '2029-12-31',
        batchNumber: targetBatch.batchNumber
      }]);
    }
  };

  const updateCartBatch = (idx: number, batchId: string) => {
    const newCart = [...cart];
    const selectedItem = stockItems.find(st => String(st.id) === String(batchId));
    
    if (selectedItem) {
      const today = new Date().toISOString().split('T')[0];
      if (selectedItem.expiryDate && selectedItem.expiryDate < today) {
        showToast(`Safety Block: Batch ${selectedItem.batchNumber} expired on ${selectedItem.expiryDate}.`, 'error');
        return;
      }

      const effQty = typeof selectedItem.quantity === 'number' ? Math.max(0, selectedItem.quantity) : 0;

      newCart[idx].selectedBatchId = batchId;
      newCart[idx].batchNumber = selectedItem.batchNumber;
      newCart[idx].expiryDate = selectedItem.expiryDate;
      newCart[idx].availableQty = effQty;
      newCart[idx].quantity = Math.min(newCart[idx].quantity, effQty);
      setCart(newCart);
    }
  };

  const updateCartQty = (idx: number, qty: number) => {
    const newCart = [...cart];
    const val = Number(qty);
    if (val <= 0) return;
    
    const item = newCart[idx];
    const selectedItem = stockItems.find(st => String(st.id) === String(item.selectedBatchId));
    const currentMax = selectedItem 
      ? Math.max(selectedItem.quantity || 0, (selectedItem.storeQuantity || 0) + (selectedItem.dispensaryQuantity || 0))
      : (item.availableQty || val);

    if (val > currentMax) {
      showToast(`Insufficient Stock: Batch ${item.batchNumber} only has ${currentMax} units remaining.`, 'error');
      return;
    }
    
    newCart[idx].availableQty = currentMax;
    newCart[idx].quantity = val;
    setCart(newCart);
  };

  const removeFromCart = (idx: number) => {
    setCart(cart.filter((_, i) => i !== idx));
  };

  const updateCartPrice = (idx: number, newPrice: number | undefined, rawStr?: string) => {
    const newCart = [...cart];
    newCart[idx] = { ...newCart[idx], overridePrice: newPrice, overridePriceStr: rawStr };
    setCart(newCart);
  };

  // Calculation parameters
  const cartSubtotal = cart.reduce((acc, item) => {
    const itemPrice = item.overridePrice !== undefined ? item.overridePrice : getPosItemPrice(item.medicine, item.selectedBatchId);
    return acc + (itemPrice * item.quantity);
  }, 0);

  // Sync discountAmount when discountType, discountValue, or cartSubtotal changes
  useEffect(() => {
    if (discountType === 'percent') {
      const computed = Number(((cartSubtotal * discountValue) / 100).toFixed(2));
      setDiscountAmount(computed);
    } else {
      setDiscountAmount(discountValue);
    }
  }, [discountType, discountValue, cartSubtotal]);

  const discount = Math.min(discountAmount, cartSubtotal);
  const netAmount = Math.max(0, cartSubtotal - discount);
  const vatAmount = Number((netAmount * (vatPercent / 100)).toFixed(2));
  const grandTotal = Number((netAmount + vatAmount).toFixed(2));

  // Split details totals calculation
  const splitTotal = Object.values(splitDetails).reduce((acc: number, val: any): number => acc + (Number(val) || 0), 0) as number;
  const splitDifference = Number((grandTotal - splitTotal).toFixed(2));

  const selectedCustomer = allCustomers.find(c => c.id === selectedCustomerId);

  // Hold active cart
  const holdActiveCart = () => {
    if (cart.length === 0) {
      showToast('Cannot hold an empty cart.', 'error');
      return;
    }
    const label = `Cart #${heldCarts.length + 1} - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const newHeld = {
      id: 'held-' + Date.now(),
      label,
      timestamp: new Date().toLocaleString(),
      cart,
      selectedCustomerId,
      discountAmount,
      vatPercent,
      paymentMethod,
      splitDetails,
      customerTin
    };

    const updated = [newHeld, ...heldCarts];
    saveHeldCarts(updated);
    
    // Reset inputs
    setCart([]);
    setSelectedCustomerId('');
    setDiscountAmount(0);
    setDiscountValue(0);
    setDiscountValueRaw('');
    setDiscountType('fixed');
    setVatPercent(15);
    setVatPercentRaw('15');
    setPaymentMethod('Cash');
    setCustomerTin('');
    setSplitDetails({ cash: 0, card: 0, credit: 0, cbe: 0, boa: 0, awash: 0, dashen: 0, other: 0 });
    setSplitDetailsRaw({});
    showToast('Active sale placed on hold.', 'success');
  };

  // Resume a held cart
  const resumeHeldCart = (heldId: string) => {
    const target = heldCarts.find(hc => hc.id === heldId);
    if (!target) return;

    // Load held sale directly
    setCart(target.cart);
    setSelectedCustomerId(target.selectedCustomerId || '');
    setDiscountAmount(target.discountAmount || 0);
    setDiscountValue(target.discountAmount || 0);
    setDiscountValueRaw(target.discountAmount ? String(target.discountAmount) : '');
    setDiscountType('fixed');
    setVatPercent(target.vatPercent !== undefined ? target.vatPercent : 0);
    setVatPercentRaw(target.vatPercent !== undefined ? String(target.vatPercent) : '0');
    setPaymentMethod(target.paymentMethod || 'Cash');
    setCustomerTin(target.customerTin || '');
    if (target.splitDetails) {
      setSplitDetails(target.splitDetails);
      const rawMap: Record<string, string> = {};
      Object.entries(target.splitDetails).forEach(([k, v]) => {
        if (v) rawMap[k] = String(v);
      });
      setSplitDetailsRaw(rawMap);
    } else {
      setSplitDetailsRaw({});
    }

    // Remove from held list
    const updated = heldCarts.filter(hc => hc.id !== heldId);
    saveHeldCarts(updated);
    setShowHeldCartsDropdown(false);
    showToast('Loaded held sale invoice.', 'success');
  };

  // Delete a held cart
  const discardHeldCart = (heldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = heldCarts.filter(hc => hc.id !== heldId);
    saveHeldCarts(updated);
    showToast('Held cart discarded.', 'info');
  };

  // Register loyalty customer on the fly
  const handleAddNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name) {
      showToast('Customer name is required!', 'error');
      return;
    }

    const valPhone = newCustomer.phone.trim() || '0900000000';

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustomer.name,
          phone: valPhone,
          email: newCustomer.email || 'walkin@sonan.com',
          address: newCustomer.address || 'Addis Ababa',
          creditLimit: Number(newCustomer.creditLimit) || 5000,
          operatorId: currentUser?.id || 'admin'
        })
      });

      if (res.ok) {
        const addedCust: Customer = await res.json();
        setLocalCustomers(prev => [...prev, addedCust]);
        setSelectedCustomerId(addedCust.id);
        // Sync search text
        setCustomerSearchQuery(addedCust.name);
        if (newCustomer.tin) {
          setCustomerTin(newCustomer.tin);
        }
        setShowAddCustomerModal(false);
        setNewCustomer({ name: '', phone: '', email: '', address: '', creditLimit: 5000, tin: '' });
        onSaleCompleted(); // Refresh parent collections
        showToast(`Customer "${addedCust.name}" registered successfully!`, 'success');
      } else {
        const errorData = await res.json();
        showToast(`Failed to add customer: ${errorData.error}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to register customer. Network error.', 'error');
    }
  };

  // A4 Printable Invoice Auto-Downloader
  const triggerAutoDownload = (sale: Sale) => {
    try {
      const itemsListHtml = sale.items.map(item => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 8px; text-align: left;">${item.medicineName}</td>
          <td style="padding: 12px 8px; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px 8px; text-align: right;">${(item.unitPrice * 0.7).toFixed(2)} ETB</td>
          <td style="padding: 12px 8px; text-align: right;">${item.unitPrice.toFixed(2)} ETB</td>
          <td style="padding: 12px 8px; text-align: right;">${item.total.toFixed(2)} ETB</td>
        </tr>
      `).join('');

      const vatPercentVal = sale.vatPercent || 15;
      const vatAmount = sale.vat;
      const grandTotal = sale.total;

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Invoice #${sale.invoiceNumber} - ${institution.name}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; margin: 0; padding: 40px; background: #fff; }
            .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, .15); font-size: 14px; line-height: 24px; }
            .header { display: flex; justify-content: space-between; border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
            .header-left h1 { margin: 0; color: #10b981; font-size: 28px; font-weight: 800; }
            .header-right { text-align: right; }
            .details-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            .details-table td { padding: 8px; vertical-align: top; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .items-table th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px 8px; font-weight: bold; font-size: 13px; text-transform: uppercase; color: #475569; }
            .summary-box { float: right; width: 300px; border-top: 2px solid #10b981; padding-top: 10px; margin-top: 20px; }
            .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
            .summary-row.total { font-weight: 800; font-size: 16px; color: #10b981; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 6px; }
            .footer { text-align: center; margin-top: 100px; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; clear: both; }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <div class="header">
              <div class="header-left">
                <h1>${institution.name.toUpperCase()}</h1>
                <p style="margin: 4px 0; font-size: 12px; color: #64748b;">Official Tax Invoice Receipt</p>
                <p style="margin: 2px 0; font-size: 12px; color: #64748b;">${institution.address} | Tel: ${institution.phone}</p>
              </div>
              <div class="header-right">
                <h2 style="margin: 0; color: #475569; font-weight: 700;">TAX INVOICE</h2>
                <p style="margin: 4px 0; font-weight: bold; color: #10b981;">Invoice #: ${sale.invoiceNumber}</p>
                <p style="margin: 2px 0; font-size: 12px;">Date: ${sale.date} ${sale.time}</p>
              </div>
            </div>

            <table class="details-table">
              <tr>
                <td style="width: 50%;">
                  <strong style="color: #475569; text-transform: uppercase; font-size: 11px; display: block; margin-bottom: 4px;">Billing To:</strong>
                  <span style="font-size: 15px; font-weight: bold; color: #1e293b;">Customer: ${sale.customerName || 'Walk-In Customer'}</span><br/>
                  ${sale.customerTin ? `<span style="font-family: monospace; font-weight: bold;">TIN Code: ${sale.customerTin}</span>` : ''}
                </td>
                <td style="width: 50%; text-align: right;">
                  <strong style="color: #475569; text-transform: uppercase; font-size: 11px; display: block; margin-bottom: 4px;">Transaction Summary:</strong>
                  <span>Operator: ${sale.cashierName}</span><br/>
                  <span>Payment Mode: <strong>${sale.paymentMethod}</strong></span><br/>
                  <span>Checkout Ingress: Branch Terminal</span>
                </td>
              </tr>
            </table>

            <table class="items-table">
              <thead>
                <tr>
                  <th style="text-align: left; width: 40%;">Product Specification</th>
                  <th style="text-align: center; width: 10%;">Qty</th>
                  <th style="text-align: right; width: 15%;">Buying Cost</th>
                  <th style="text-align: right; width: 15%;">Unit Price</th>
                  <th style="text-align: right; width: 20%;">Extended Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsListHtml}
              </tbody>
            </table>

            <div class="summary-box">
              <div class="summary-row">
                <span>Sub-Total Items Cost:</span>
                <span>${sale.subtotal.toFixed(2)} ETB</span>
              </div>
              <div class="summary-row">
                <span>VAT Tax Content (${vatPercentVal}%):</span>
                <span>${vatAmount.toFixed(2)} ETB</span>
              </div>
              ${sale.discount ? `
              <div class="summary-row" style="color: #ef4444;">
                <span>Discounts Granted:</span>
                <span>-${sale.discount.toFixed(2)} ETB</span>
              </div>
              ` : ''}
              <div class="summary-row total">
                <span>Grand Total Due:</span>
                <span>${grandTotal.toFixed(2)} ETB</span>
              </div>
            </div>

            <div class="footer">
              <p style="margin: 4px 0; font-weight: bold;">Thank you for your business & trust!</p>
              <p style="margin: 2px 0;">This is an authorized, official commercial invoice compliant with Ethiopian Revenue & Customs authority mandates.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const dataStr = "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent);
      const dlAnchor = document.createElement('a');
      dlAnchor.setAttribute("href", dataStr);
      dlAnchor.setAttribute("download", `invoice-${sale.invoiceNumber}-A4.html`);
      dlAnchor.click();
    } catch (err) {
      console.error('Failed to auto-download A4 attachment:', err);
    }
  };

  // Execute POS Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    let resolvedPaymentMethod = 'Cash';
    if (mainPaymentType === 'Cash') {
      resolvedPaymentMethod = 'Cash';
    } else if (mainPaymentType === 'Telebirr') {
      resolvedPaymentMethod = 'Telebirr';
    } else if (mainPaymentType === 'Credit') {
      resolvedPaymentMethod = 'Credit';
    } else if (mainPaymentType === 'Split') {
      resolvedPaymentMethod = 'Split';
    } else if (mainPaymentType === 'Bank') {
      if (selectedBankType === 'CBE') {
        resolvedPaymentMethod = 'Bank CBE';
      } else if (selectedBankType === 'Awash') {
        resolvedPaymentMethod = 'Bank AWASH';
      } else if (selectedBankType === 'BOA') {
        resolvedPaymentMethod = 'Bank BOA';
      } else if (selectedBankType === 'Dashen') {
        resolvedPaymentMethod = 'Bank DASHEN';
      } else {
        resolvedPaymentMethod = customBankInput ? `Bank: ${customBankInput}` : 'Bank: Other';
      }
    }

    // Credit validation
    if (resolvedPaymentMethod === 'Credit') {
      if (!selectedCustomerId) {
        showToast('Credit Denied: Customer profile is required to log credit debt balances.', 'error');
        return;
      }
      if (selectedCustomer && (selectedCustomer.creditBalance + grandTotal > selectedCustomer.creditLimit)) {
        showToast(`Credit Denied: Exceeds Customer credit limit of ${selectedCustomer.creditLimit} ETB. Balance currently: ${selectedCustomer.creditBalance} ETB.`, 'error');
        return;
      }
    }

    try {
      setSubmittingCheckout(true);
      const checkoutItems = cart.map(item => ({
        medicineId: item.medicine.id,
        quantity: item.quantity,
        selectedBatchId: item.selectedBatchId,
        unitPrice: item.overridePrice !== undefined ? item.overridePrice : getPosItemPrice(item.medicine, item.selectedBatchId)
      }));

      const salePayload = {
        branchId,
        cashierId: currentUser?.id || 'admin',
        customerId: selectedCustomerId || undefined,
        paymentMethod: resolvedPaymentMethod,
        paymentDate,
        discount,
        vatPercent,
        customerTin: customerTin || undefined,
        items: checkoutItems,
        isOnlineOrder: !!activeLoadedOrder,
        orderSource: activeLoadedOrder ? 'Online Store' : 'In-Store',
        onlineOrderId: activeLoadedOrder ? activeLoadedOrder.id : undefined
      };

      const isOfflineTransaction = offlineModeOverride || (!isOnline && typeof navigator !== 'undefined' && !navigator.onLine);

      if (isOfflineTransaction) {
        const now = new Date();
        const dateStr = paymentDate || now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const localInvoiceNo = `OFFLINE-${Date.now().toString().slice(-6)}`;

        const offlineSaleRecord: Sale = {
          id: 'off-' + Date.now(),
          invoiceNumber: localInvoiceNo,
          date: dateStr,
          time: timeStr,
          branchId,
          branchName: branches.find(b => b.id === branchId)?.name || 'Main Branch',
          cashierId: currentUser?.id || 'admin',
          cashierName: currentUser?.name || 'Offline Cashier',
          customerId: selectedCustomerId || undefined,
          customerName: selectedCustomer ? selectedCustomer.name : 'Walk-In Customer',
          customerTin: customerTin || undefined,
          paymentMethod: resolvedPaymentMethod,
          status: 'Completed',
          subtotal: cartSubtotal,
          discount,
          vat: vatAmount,
          total: grandTotal,
          isOnlineOrder: !!activeLoadedOrder,
          orderSource: activeLoadedOrder ? 'Online Store' : 'In-Store',
          onlineOrderId: activeLoadedOrder ? activeLoadedOrder.id : undefined,
          items: cart.map(item => {
            const price = item.overridePrice !== undefined ? item.overridePrice : getPosItemPrice(item.medicine, item.selectedBatchId);
            const itemSubtotal = price * item.quantity;
            const itemDiscount = cartSubtotal > 0 ? (discount * (itemSubtotal / cartSubtotal)) : 0;
            const itemVat = ((itemSubtotal - itemDiscount) * (vatPercent / 100));
            return {
              id: 'off-item-' + Math.random().toString(36).substring(2, 9),
              medicineId: item.medicine.id,
              medicineName: item.medicine.name,
              quantity: item.quantity,
              unitPrice: price,
              discount: Number(itemDiscount.toFixed(2)),
              vatAmount: Number(itemVat.toFixed(2)),
              total: Number((itemSubtotal - itemDiscount + itemVat).toFixed(2)),
              batchId: item.selectedBatchId,
              batchNumber: item.batchNumber
            };
          })
        };

        const newQueueItem = {
          id: offlineSaleRecord.id,
          invoiceNumber: localInvoiceNo,
          timestamp: Date.now(),
          date: dateStr,
          time: timeStr,
          total: grandTotal,
          customerName: selectedCustomer ? selectedCustomer.name : 'Walk-In Customer',
          itemCount: cart.length,
          payload: salePayload,
          saleRecord: offlineSaleRecord
        };

        const updatedQueue = [...queuedOfflineSales, newQueueItem];
        saveQueuedOfflineSales(updatedQueue);

        if (expressCheckout) {
          setCompletedSale(null);
          setShowReceipt(false);
          showToast(`⚡ Offline Express Sale Completed! Invoice #${localInvoiceNo} saved locally (${updatedQueue.length} pending sync).`, 'success');
        } else {
          setCompletedSale(offlineSaleRecord);
          setShowReceipt(true);
          showToast(`📱 Sale processed in Offline Mode! Invoice #${localInvoiceNo} stored locally.`, 'success');
        }

        // Reset states
        setCart([]);
        setSearchTerm('');
        setSelectedCustomerId('');
        setDiscountAmount(0);
        setDiscountValue(0);
        setDiscountType('fixed');
        setVatPercent(0);
        setCustomerTin('');
        setSplitDetails({ cash: 0, card: 0, credit: 0, cbe: 0, boa: 0, awash: 0, dashen: 0, other: 0 });
        return;
      }

      // Ultra-fast instant UI checkout (<5ms)
      const now = new Date();
      const dateStr = paymentDate || now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const tempInvoiceNo = `REC-${(branches.find(b => b.id === branchId)?.code || branchId).toUpperCase()}-${Date.now().toString().slice(-4)}`;

      const instantSaleRecord: Sale = {
        id: 'temp-' + Date.now(),
        invoiceNumber: tempInvoiceNo,
        date: dateStr,
        time: timeStr,
        branchId,
        branchName: branches.find(b => b.id === branchId)?.name || 'Main Branch',
        cashierId: currentUser?.id || 'admin',
        cashierName: currentUser?.name || 'Cashier',
        customerId: selectedCustomerId || undefined,
        customerName: selectedCustomer ? selectedCustomer.name : 'Walk-In Customer',
        customerTin: customerTin || undefined,
        paymentMethod: resolvedPaymentMethod as any,
        status: 'Completed',
        subtotal: cartSubtotal,
        discount,
        vat: vatAmount,
        total: grandTotal,
        isOnlineOrder: !!activeLoadedOrder,
        orderSource: activeLoadedOrder ? 'Online Store' : 'In-Store',
        onlineOrderId: activeLoadedOrder ? activeLoadedOrder.id : undefined,
        items: cart.map(item => {
          const price = item.overridePrice !== undefined ? item.overridePrice : getPosItemPrice(item.medicine, item.selectedBatchId);
          const itemSubtotal = price * item.quantity;
          const itemDiscount = cartSubtotal > 0 ? (discount * (itemSubtotal / cartSubtotal)) : 0;
          const itemVat = ((itemSubtotal - itemDiscount) * (vatPercent / 100));
          return {
            id: 'item-' + Math.random().toString(36).substring(2, 9),
            medicineId: item.medicine.id,
            medicineName: item.medicine.name,
            quantity: item.quantity,
            unitPrice: price,
            discount: Number(itemDiscount.toFixed(2)),
            vatAmount: Number(itemVat.toFixed(2)),
            total: Number((itemSubtotal - itemDiscount + itemVat).toFixed(2)),
            batchId: item.selectedBatchId,
            batchNumber: item.batchNumber
          };
        })
      };

      // Instantly reset UI & show receipt modal (<5ms)
      setCart([]);
      setSearchTerm('');
      setSelectedCustomerId('');
      setDiscountAmount(0);
      setDiscountValue(0);
      setDiscountValueRaw('');
      setDiscountType('fixed');
      setVatPercent(0);
      setVatPercentRaw('0');
      setCustomerTin('');
      setSplitDetails({ cash: 0, card: 0, credit: 0, cbe: 0, boa: 0, awash: 0, dashen: 0, other: 0 });
      setSplitDetailsRaw({});

      if (expressCheckout) {
        setCompletedSale(null);
        setShowReceipt(false);
        showToast(`⚡ Express Checkout Completed in <1ms!`, 'success');
      } else {
        setCompletedSale(instantSaleRecord);
        setShowReceipt(true);
        showToast('⚡ Sale completed instantly in <1 sec!', 'success');
      }

      // Fire POST /api/sales in background asynchronously
      fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload)
      }).then(async res => {
        if (res.ok) {
          const saleRecord: Sale = await res.json();
          setCompletedSale(prev => (prev && prev.id === instantSaleRecord.id) ? saleRecord : prev);
          onSaleCompleted();
        } else {
          const err = await res.json().catch(() => ({ error: 'Sale checkout failed' }));
          showToast(`⚠️ Server Sync Alert: ${err.error || 'Check inventory stock.'}`, 'error');
        }
      }).catch(err => {
        console.error('Background network sync failed, queuing sale offline:', err);
        saveQueuedOfflineSales([...queuedOfflineSales, {
          id: instantSaleRecord.id,
          invoiceNumber: instantSaleRecord.invoiceNumber,
          timestamp: Date.now(),
          date: dateStr,
          time: timeStr,
          total: grandTotal,
          customerName: selectedCustomer ? selectedCustomer.name : 'Walk-In Customer',
          itemCount: instantSaleRecord.items.length,
          payload: salePayload,
          saleRecord: instantSaleRecord
        }]);
      });
    } catch (err) {
      console.error('Network Error during sale, storing offline:', err);
      // Auto-fallback to offline queue on network failure
      const now = new Date();
      const dateStr = paymentDate || now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const localInvoiceNo = `OFFLINE-${Date.now().toString().slice(-6)}`;

      const checkoutItemsFallback = cart.map(item => ({
        medicineId: item.medicine.id,
        quantity: item.quantity,
        selectedBatchId: item.selectedBatchId,
        unitPrice: item.overridePrice !== undefined ? item.overridePrice : getPosItemPrice(item.medicine, item.selectedBatchId)
      }));

      const salePayloadFallback = {
        branchId,
        cashierId: currentUser?.id || 'admin',
        customerId: selectedCustomerId || undefined,
        paymentMethod: resolvedPaymentMethod,
        paymentDate: dateStr,
        discount,
        vatPercent,
        customerTin: customerTin || undefined,
        items: checkoutItemsFallback
      };

      const offlineSaleRecord: Sale = {
        id: 'off-' + Date.now(),
        invoiceNumber: localInvoiceNo,
        date: dateStr,
        time: timeStr,
        branchId,
        branchName: branches.find(b => b.id === branchId)?.name || 'Main Branch',
        cashierId: currentUser?.id || 'admin',
        cashierName: currentUser?.name || 'Offline Cashier',
        customerId: selectedCustomerId || undefined,
        customerName: selectedCustomer ? selectedCustomer.name : 'Walk-In Customer',
        customerTin: customerTin || undefined,
        paymentMethod: resolvedPaymentMethod,
        status: 'Completed',
        subtotal: cartSubtotal,
        discount,
        vat: vatAmount,
        total: grandTotal,
        items: cart.map(item => {
          const price = item.overridePrice !== undefined ? item.overridePrice : getPosItemPrice(item.medicine, item.selectedBatchId);
          const itemSubtotal = price * item.quantity;
          const itemDiscount = cartSubtotal > 0 ? (discount * (itemSubtotal / cartSubtotal)) : 0;
          const itemVat = ((itemSubtotal - itemDiscount) * (vatPercent / 100));
          return {
            id: 'off-item-' + Math.random().toString(36).substring(2, 9),
            medicineId: item.medicine.id,
            medicineName: item.medicine.name,
            quantity: item.quantity,
            unitPrice: price,
            discount: Number(itemDiscount.toFixed(2)),
            vatAmount: Number(itemVat.toFixed(2)),
            total: Number((itemSubtotal - itemDiscount + itemVat).toFixed(2)),
            batchId: item.selectedBatchId,
            batchNumber: item.batchNumber
          };
        })
      };

      const newQueueItem = {
        id: offlineSaleRecord.id,
        invoiceNumber: localInvoiceNo,
        timestamp: Date.now(),
        date: dateStr,
        time: timeStr,
        total: grandTotal,
        customerName: selectedCustomer ? selectedCustomer.name : 'Walk-In Customer',
        itemCount: cart.length,
        payload: salePayloadFallback,
        saleRecord: offlineSaleRecord
      };

      const updatedQueue = [...queuedOfflineSales, newQueueItem];
      saveQueuedOfflineSales(updatedQueue);

      if (expressCheckout) {
        setCompletedSale(null);
        setShowReceipt(false);
      } else {
        setCompletedSale(offlineSaleRecord);
        setShowReceipt(true);
      }

      showToast(`📱 Network connection unavailable. Sale saved locally as #${localInvoiceNo}!`, 'info');
      setCart([]);
      setSearchTerm('');
      setSelectedCustomerId('');
      setDiscountAmount(0);
      setDiscountValue(0);
      setDiscountValueRaw('');
      setDiscountType('fixed');
      setVatPercent(0);
      setVatPercentRaw('0');
      setCustomerTin('');
      setSplitDetails({ cash: 0, card: 0, credit: 0, cbe: 0, boa: 0, awash: 0, dashen: 0, other: 0 });
      setSplitDetailsRaw({});
    } finally {
      setSubmittingCheckout(false);
    }
  };

  // Refund by invoice
  const handleInvoiceRefund = async () => {
    if (!refundInvoiceNo.trim()) return;
    try {
      setRefunding(true);
      const salesRes = await fetch('/api/sales');
      if (salesRes.ok) {
        const sales: Sale[] = await salesRes.json();
        const saleToRefund = sales.find(s => s.invoiceNumber.toLowerCase() === refundInvoiceNo.trim().toLowerCase());
        
        if (!saleToRefund) {
          showToast(`Invoice Error: Receipt "${refundInvoiceNo}" was not found.`, 'error');
          return;
        }

        if (saleToRefund.status === 'Returned') {
          showToast('Conflict: This receipt has already been fully refunded.', 'error');
          return;
        }

        const refundRes = await fetch('/api/sales/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            saleId: saleToRefund.id,
            operatorId: currentUser?.id || 'admin',
            reason: 'Returned via Front-End Cashier Refund Panel'
          })
        });

        if (refundRes.ok) {
          showToast(`Transaction Refund Successful! Refolded items returned to active stock.`, 'success');
          setRefundInvoiceNo('');
          onSaleCompleted();
        } else {
          const err = await refundRes.json();
          showToast(`Refund Refused: ${err.error}`, 'error');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to process refund. Server communications error.', 'error');
    } finally {
      setRefunding(false);
    }
  };

  // Category filter list
  const MEDICATION_CATEGORIES = [
    'Anti Fungal', 'Antifungal', 'Antibiotics', 'Antiprotozoal', 'Deworming', 'Cardiovascular (CV)', 'Gastrointestinal (GIT)', 
    'Respiratory', 'Controlled Drugs', 'Dermatological', 'ENT', 'Vitamins & Minerals', 
    'Supplies', 'Other Cosmetics', 'cosmetics', 'Cosmetics', 'General Stock'
  ];

  return (
    <div id="pos-terminal-v2" className="space-y-6">
      {/* TWO WINDOWS SIDE BY SIDE */}
      {/* OLD CUSTOMER INFO BLOCK REMOVED */}
      
      {/* Dynamic Print Container Target Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice-wrapper, #printable-invoice-wrapper * {
            visibility: visible;
          }
          #printable-invoice-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: white !important;
            color: black !important;
            padding: 15px !important;
          }
        }
      `}</style>

      {/* Online Order Loaded Alert Banner */}
      {activeLoadedOrder && (
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-4 rounded-2xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-emerald-500/30 animate-fade-in">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/30 rounded-xl border border-emerald-400/30 shrink-0">
              <ShoppingBag className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm flex items-center gap-2">
                Online Customer Order Loaded: #{activeLoadedOrder.orderNumber}
                <span className="px-2.5 py-0.5 bg-emerald-500/40 text-[10px] rounded-full uppercase tracking-wider font-extrabold">POS Terminal Active</span>
              </h4>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Customer: <span className="font-bold text-white">{activeLoadedOrder.customerName}</span> ({activeLoadedOrder.customerPhone || 'No Phone'}) • Address: {activeLoadedOrder.deliveryAddress || 'Store Pickup'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => {
                setActiveLoadedOrder(null);
                onClearPendingOnlineOrder?.();
              }}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Clear Loaded Order</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Segmented View Switcher */}
      <div className="lg:hidden flex items-center bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl mb-3 shadow-inner gap-1">
        <button
          type="button"
          onClick={() => setMobilePosTab('catalog')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] ${
            mobilePosTab === 'catalog'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <span>📦 Products ({filteredProducts.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobilePosTab('cart')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] ${
            mobilePosTab === 'cart'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <span>🛒 Cart ({cart.length})</span>
          {cart.length > 0 && (
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-black ${mobilePosTab === 'cart' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'}`}>
              {cartSubtotal.toFixed(0)} ETB
            </span>
          )}
        </button>
      </div>

      {/* Two Windows Side by Side Draggable Layout */}
      <div 
        ref={containerRef}
        className="flex flex-col lg:flex-row gap-4 lg:gap-0 items-stretch h-full relative"
      >
        
        {/* First Window: Product Search & Catalog List */}
        <div 
          className={`bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-gray-150 dark:border-slate-800 p-3.5 sm:p-5 space-y-4 flex flex-col min-h-0 lg:min-h-[750px] w-full lg:w-auto shrink-0 transition-all duration-75 text-left ${
            mobilePosTab === 'cart' ? 'hidden lg:flex' : 'flex'
          }`}
          style={isLargeScreen ? { width: `${leftWidth}%` } : undefined}
        >
          
          <div className="flex justify-between items-center border-b pb-3 text-left">
            <div className="space-y-0.5">
              <h3 className="text-sm font-sans font-extrabold text-gray-950 uppercase tracking-wide flex items-center gap-1.5">
                <span className="p-1.5 bg-emerald-50 rounded text-emerald-600">📦</span>
                Drug &amp; Items Catalog
              </h3>
              <p className="text-[10px] text-gray-500 font-medium">Select items to instantly populate the active invoice.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {branches && branches.length > 0 && (
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1">
                  <span className="text-[9px] text-slate-550 font-bold uppercase shrink-0">POS Node:</span>
                  <select
                    value={posBranchId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (cart.length > 0) {
                        if (confirm("Changing the active POS branch will clear the current invoice cart. Do you want to proceed?")) {
                          setPosBranchId(val);
                          setCart([]);
                        }
                      } else {
                        setPosBranchId(val);
                      }
                    }}
                    className="text-[11px] font-bold bg-transparent text-slate-800 outline-none cursor-pointer border-none p-0 focus:ring-0"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowRegisterModal(true)}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-2.5 py-1.5 rounded border border-slate-300 flex items-center gap-1 cursor-pointer transition-all"
                title="Configure Cash Register Machine"
              >
                ⚙️ Cash Register
              </button>

              {/* Online / Offline Sales Mode Toggle */}
              <button
                type="button"
                onClick={() => {
                  const nextVal = !offlineModeOverride;
                  setOfflineModeOverride(nextVal);
                  showToast(nextVal ? '⚡ Switched to Manual Offline Sales Mode' : '🌐 Switched to Live Online Sync Mode', 'info');
                }}
                className={`text-[10px] font-extrabold px-2.5 py-1.5 rounded border flex items-center gap-1.5 cursor-pointer transition-all ${
                  (!isOnline || offlineModeOverride)
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm animate-pulse'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
                title="Toggle Offline POS Sales Mode"
              >
                {(!isOnline || offlineModeOverride) ? '⚡ Offline Sales' : '🌐 Online'}
              </button>

              {/* Queued Offline Sales Sync Button */}
              {queuedOfflineSales.length > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={syncOfflineSales}
                    disabled={isSyncingOffline || !isOnline}
                    className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-2.5 py-1.5 rounded border border-indigo-700 flex items-center gap-1 cursor-pointer transition-all shadow-sm disabled:opacity-50"
                    title="Sync queued offline sales to server"
                  >
                    <RefreshCw className={`h-3 w-3 ${isSyncingOffline ? 'animate-spin' : ''}`} />
                    Sync ({queuedOfflineSales.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOfflineQueueModal(true)}
                    className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold px-2 py-1.5 rounded border border-indigo-200 cursor-pointer"
                    title="View queued offline transactions"
                  >
                    📋 Queue
                  </button>
                </div>
              )}

              <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded-full">
                {filteredProducts.length} Available
              </span>
            </div>
          </div>

          {/* Local Search input inside left catalog window */}
          <div className="space-y-2">
            <div className="relative bg-gray-50 rounded-lg p-2.5 border border-gray-250 flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search items by brand, formulation, category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs outline-none bg-transparent text-gray-800 font-semibold"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="p-1 hover:bg-gray-200 rounded text-gray-400">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-1 text-[11px] text-slate-600">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showAllCatalog}
                  onChange={(e) => setShowAllCatalog(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                />
                <span className="font-semibold text-[10px] text-slate-700">Include 0 Stock / Catalog Items</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium italic">
                {filteredProducts.length} items listed
              </span>
            </div>
          </div>

          {/* Inner catalog scrollable area */}
          <div className="flex-1 overflow-y-auto pr-1 divide-y divide-gray-100 space-y-1 max-h-[580px]">
            {filteredProducts.length === 0 ? (
              <div className="py-20 text-center text-xs text-gray-400 italic space-y-2">
                <p>No medicines or cosmetics matching the search terms were found.</p>
                {!showAllCatalog && (
                  <button
                    onClick={() => setShowAllCatalog(true)}
                    className="text-[10px] text-emerald-700 font-bold underline cursor-pointer hover:text-emerald-800"
                  >
                    Click here to search full catalog including zero stock items
                  </button>
                )}
              </div>
            ) : (
              filteredProducts.slice(0, 150).map(m => {
                const itemType = m.productType || 'medicine';
                const medIdStr = String(m.id).trim();
                const info = stockSummaryMap[medIdStr];
                
                const branchBatches = info?.branchBatches || getBatchStockForMedicine(m.id, m);
                const totalBranchQty = info ? info.totalBranchQty : branchBatches.reduce((acc, st) => acc + st.quantity, 0);

                const damagedQty = info?.damagedQty || 0;
                const expiredQty = info?.expiredQty || 0;
                const storeOnlyQty = info?.storeOnlyQty || 0;
                const storeStockItems = info?.storeStockItems || [];
                const otherBranchQty = info?.otherBranchStock?.reduce((acc, st) => acc + (st.quantity || 0), 0) || 0;

                // Expiry alerts
                const hasNearExpiry = branchBatches.some(b => {
                  const d = getDaysUntilExpiry(b.expiryDate);
                  return d > 0 && d <= 180;
                });

                return (
                  <div 
                    key={m.id} 
                    onClick={() => addToCart(m)}
                    className={`p-3 flex items-center justify-between hover:bg-emerald-50/40 cursor-pointer rounded-lg transition-all border border-transparent hover:border-emerald-100 gap-2 ${
                      totalBranchQty === 0 ? 'bg-gray-50/60' : ''
                    }`}
                  >
                    <div className="space-y-1 max-w-[65%] text-left">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-gray-900 block truncate">{m.name}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                          itemType === 'cosmetics' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {itemType === 'cosmetics' ? 'Cosmetics' : 'Medicine'}
                        </span>
                        {totalBranchQty <= m.minStockLevel && totalBranchQty > 0 && (
                          <span className="bg-amber-100 text-amber-950 font-bold text-[8px] px-1 py-0.5 rounded">
                            LOW STOCK
                          </span>
                        )}
                        {totalBranchQty === 0 && storeOnlyQty === 0 && damagedQty === 0 && expiredQty === 0 && (
                          <span className="bg-red-100 text-red-950 font-bold text-[8px] px-1 py-0.5 rounded">
                            0 STOCK
                          </span>
                        )}
                        {totalBranchQty === 0 && storeOnlyQty > 0 && (
                          <span className="bg-indigo-100 text-indigo-900 font-bold text-[8px] px-1 py-0.5 rounded flex items-center gap-0.5">
                            🏬 {storeOnlyQty} IN STORE
                          </span>
                        )}
                        {totalBranchQty === 0 && damagedQty > 0 && (
                          <span className="bg-red-100 text-red-900 font-bold text-[8px] px-1 py-0.5 rounded flex items-center gap-0.5" title="Stock is quarantined due to water or physical damage">
                            ⚠️ {damagedQty} DAMAGED
                          </span>
                        )}
                        {totalBranchQty === 0 && expiredQty > 0 && (
                          <span className="bg-amber-100 text-amber-900 font-bold text-[8px] px-1 py-0.5 rounded flex items-center gap-0.5" title="Stock has reached or passed its expiry date">
                            ⛔ {expiredQty} EXPIRED
                          </span>
                        )}
                        {hasNearExpiry && (
                          <span className="bg-amber-100 text-amber-950 font-bold text-[8px] px-1 py-0.5 rounded flex items-center gap-0.5">
                            ⚠️ Expiry
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 leading-normal">
                        {itemType === 'cosmetics' ? `Cosmetic Item • Buying Price: ${m.buyingPrice} ETB` : `${m.category}`}
                      </p>
                      <p className="text-[9px] text-gray-400 font-mono">
                        packing: {m.unit || 'PCS'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-emerald-800 block">
                          {getPosItemPrice(m).toFixed(2)} ETB
                        </span>
                        <span className={`text-[9px] font-semibold block uppercase ${
                          totalBranchQty > 0 ? 'text-emerald-700 font-extrabold' : 'text-amber-700 font-bold'
                        }`}>
                          {totalBranchQty > 0 ? (
                            `${totalBranchQty} in stock`
                          ) : damagedQty > 0 ? (
                            `0 in stock (${damagedQty} Damaged)`
                          ) : expiredQty > 0 ? (
                            `0 in stock (${expiredQty} Expired)`
                          ) : otherBranchQty > 0 ? (
                            `0 in stock (${otherBranchQty} Other Branch)`
                          ) : (
                            '0 in stock'
                          )}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(m);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[10px] font-extrabold py-2 px-3 rounded-lg shadow-xs cursor-pointer transition-all min-h-[36px]"
                      >
                        Add +
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sticky mobile quick-checkout bar */}
          {cart.length > 0 && (
            <div className="lg:hidden sticky bottom-0 -mx-3.5 -mb-3.5 p-3 bg-emerald-700 text-white rounded-b-xl flex items-center justify-between shadow-lg z-20 animate-fade-in border-t border-emerald-600">
              <div className="text-xs">
                <span className="font-semibold text-emerald-100">{cart.length} item{cart.length > 1 ? 's' : ''} added</span>
                <span className="block text-white font-black text-sm leading-tight">{cartSubtotal.toFixed(2)} ETB</span>
              </div>
              <button
                type="button"
                onClick={() => setMobilePosTab('cart')}
                className="px-4 py-2 bg-white text-emerald-800 rounded-lg text-xs font-black shadow-sm flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer min-h-[40px]"
              >
                <span>Checkout Cart →</span>
              </button>
            </div>
          )}
        </div>

        {/* Draggable Divider Handle */}
        <div 
          onMouseDown={handleMouseDown}
          className={`hidden lg:flex select-none w-1.5 hover:w-2.5 bg-slate-100 hover:bg-emerald-400 active:bg-emerald-600 transition-all cursor-col-resize h-[750px] rounded-lg items-center justify-center shrink-0 self-stretch relative z-20 mx-1.5 ${isDragging ? 'bg-emerald-500 w-2.5' : ''}`}
          title="Drag to resize windows"
        >
          <div className="flex flex-col gap-1 items-center justify-center pointer-events-none">
            <span className={`w-1 h-1 rounded-full bg-slate-400 ${isDragging ? 'bg-white' : ''}`}></span>
            <span className={`w-1 h-1 rounded-full bg-slate-400 ${isDragging ? 'bg-white' : ''}`}></span>
            <span className={`w-1 h-1 rounded-full bg-slate-400 ${isDragging ? 'bg-white' : ''}`}></span>
          </div>
        </div>

        {/* Second Window: Patient Info, Cart Added Items, Payment/VAT/Hold options */}
        <div 
          className={`bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-gray-150 dark:border-slate-800 p-3.5 sm:p-5 space-y-4 flex flex-col min-h-0 lg:min-h-[750px] w-full lg:w-auto shrink-0 transition-all duration-75 text-left ${
            mobilePosTab === 'catalog' ? 'hidden lg:flex' : 'flex'
          }`}
          style={isLargeScreen ? { width: `${100 - leftWidth}%` } : undefined}
        >
          {/* Mobile Back Button to Catalog */}
          <div className="lg:hidden flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setMobilePosTab('catalog')}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 py-1.5 px-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg cursor-pointer hover:bg-emerald-100 min-h-[36px]"
            >
              <span>← Back to Products</span>
            </button>
            <span className="text-xs font-extrabold text-gray-700 dark:text-slate-300">
              Active Invoice ({cart.length} items)
            </span>
          </div>
          
          {/* Top: Name of Patient with Writing Option & TIN number */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
            {/* Patient name writing / selector */}
            <div className="space-y-1 text-left relative">
              <label className="text-xs font-bold text-gray-800 flex items-center gap-1">
                <span>👤</span> Patient / Customer Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter patient name..."
                  value={customerSearchQuery}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value);
                    setShowCustomerSuggestions(true);
                  }}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  className="w-full text-xs bg-white border border-gray-300 rounded-lg p-2.5 outline-none font-semibold text-gray-800 focus:border-emerald-500"
                />
                {customerSearchQuery && (
                  <button 
                    type="button" 
                    onClick={() => { 
                      setCustomerSearchQuery(''); 
                      setSelectedCustomerId(''); 
                      setShowCustomerSuggestions(false); 
                    }} 
                    className="absolute right-2 top-3 p-0.5 text-gray-400 hover:text-gray-650"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {showCustomerSuggestions && customerSearchQuery.trim().length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-2 text-[11px] text-gray-400 italic text-center bg-gray-50">
                      Press Enter or keep typing to write custom Patient
                    </div>
                  ) : (
                    filteredCustomers
                      .map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setCustomerSearchQuery(c.name);
                            setShowCustomerSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-55 text-gray-800 hover:text-emerald-900 border-b border-gray-50 last:border-0 font-medium flex justify-between items-center"
                        >
                          <span className="font-semibold">{c.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{c.phone}</span>
                        </button>
                      ))
                  )}
                </div>
              )}
            </div>

            {/* TIN Number option */}
            <div className="space-y-1 text-left">
              <label className="text-xs font-bold text-gray-800 flex items-center gap-1">
                <span>🔢</span> TIN Number
              </label>
              <input
                type="text"
                placeholder="Enter 10-digit TIN"
                value={customerTin}
                onChange={(e) => setCustomerTin(e.target.value)}
                className="w-full text-xs bg-white border border-gray-300 rounded-lg p-2.5 outline-none font-mono font-bold text-gray-800 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Middle: Space for added items review */}
          <div className="flex-1 overflow-y-auto border border-gray-150 rounded-xl min-h-[250px] max-h-[350px] flex flex-col">
            <div className="flex justify-between items-center border-b p-3 bg-gray-50/50 sticky top-0 z-10 text-left">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                Active Items Review ({cart.length})
              </h3>
              
              {heldCarts.length > 0 && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowHeldCartsDropdown(!showHeldCartsDropdown)}
                    className="bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900 font-bold py-1 px-2 rounded text-[10px] flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <FolderOpen className="h-3 w-3" />
                    <span>Held Carts ({heldCarts.length})</span>
                    <ChevronDown className="h-2.5 w-2.5" />
                  </button>

                  {showHeldCartsDropdown && (
                    <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-150 z-40 max-h-60 overflow-y-auto p-1 divide-y divide-gray-100">
                      {heldCarts.map(hc => (
                        <div 
                          key={hc.id} 
                          onClick={() => {
                            resumeHeldCart(hc.id);
                            setShowHeldCartsDropdown(false);
                          }}
                          className="p-2 text-left hover:bg-amber-50/30 cursor-pointer flex justify-between items-center gap-2 text-[10px]"
                        >
                          <div className="truncate flex-1">
                            <span className="font-bold text-gray-800 block truncate">{hc.label}</span>
                            <span className="text-[8px] text-emerald-700 font-semibold">{hc.cart.length} lines</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              discardHeldCart(hc.id, e);
                            }}
                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-2 my-auto">
                <span className="p-2.5 bg-gray-50 rounded-full text-gray-400">
                  <ShoppingCart className="h-5 w-5" />
                </span>
                <span className="text-xs font-bold text-gray-800">Your Sales Invoice is Empty</span>
                <p className="text-[10px] text-gray-400 max-w-xs">
                  Click products on the left catalog panel to populate this review area.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <table className="min-w-full text-left text-[11px] text-gray-700">
                  <thead className="bg-gray-50 border-b border-gray-150 font-bold text-gray-900 sticky top-0 z-10">
                    <tr>
                      <th className="p-2">Item</th>
                      <th className="p-2">Batch</th>
                      <th className="p-2 w-14 text-center">Qty</th>
                      <th className="p-2 text-right">Price</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-sans">
                    {cart.map((item, idx) => {
                      const itemBatches = getBatchStockForMedicine(item.medicine.id);
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-2">
                            <span className="font-bold text-gray-900 block truncate max-w-[120px]" title={item.medicine.name}>
                              {item.medicine.name}
                            </span>
                            <span className="text-[9px] text-gray-400 block truncate max-w-[120px]">
                              {item.medicine.category}
                            </span>
                          </td>
                          <td className="p-2">
                            <select
                              value={item.selectedBatchId}
                              onChange={(e) => updateCartBatch(idx, e.target.value)}
                              className="text-[10px] bg-white border border-gray-200 rounded p-0.5 outline-none text-gray-700 max-w-[110px]"
                            >
                              {itemBatches.map(b => {
                                const days = getDaysUntilExpiry(b.expiryDate);
                                return (
                                  <option key={b.id} value={b.id}>
                                    {b.batchNumber} ({b.quantity}) {days <= 180 ? '⚠️' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateCartQty(idx, Number(e.target.value))}
                              className="w-11 text-[10px] border border-gray-200 rounded p-0.5 text-center font-bold outline-none"
                            />
                          </td>
                          <td className="p-2 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  item.overridePriceStr !== undefined
                                    ? item.overridePriceStr
                                    : (item.overridePrice !== undefined
                                        ? String(item.overridePrice)
                                        : String(getPosItemPrice(item.medicine, item.selectedBatchId)))
                                }
                                onChange={(e) => {
                                  const raw = e.target.value.replace(',', '.');
                                  if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                                    const parsed = raw === '' || raw === '.' ? undefined : parseFloat(raw);
                                    updateCartPrice(idx, parsed !== undefined && !isNaN(parsed) ? parsed : undefined, raw);
                                  }
                                }}
                                onBlur={() => {
                                  if (item.overridePriceStr !== undefined) {
                                    if (item.overridePriceStr === '' || item.overridePriceStr === '.') {
                                      updateCartPrice(idx, undefined, undefined);
                                    } else {
                                      const parsed = parseFloat(item.overridePriceStr);
                                      if (!isNaN(parsed)) {
                                        updateCartPrice(idx, parsed, String(parsed));
                                      } else {
                                        updateCartPrice(idx, undefined, undefined);
                                      }
                                    }
                                  }
                                }}
                                className="w-16 text-right font-mono text-[11px] text-gray-800 font-bold border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-emerald-500 bg-white"
                                title="Click to override item selling price (supports decimal points e.g. 15.75)"
                                placeholder="0.00"
                              />
                              <span className="text-[9px] text-gray-400 font-normal">ETB</span>
                            </div>
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-gray-900">
                            {((item.overridePrice !== undefined ? item.overridePrice : getPosItemPrice(item.medicine, item.selectedBatchId)) * item.quantity).toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => removeFromCart(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bottom section: Payment Methods, VAT percentage, Hold Option */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-4">
            
            {/* Payment Method Selector */}
            <div className="space-y-1 text-left">
              <label className="text-xs font-bold text-gray-700 block">Payment Method</label>
              <div className="flex bg-white border border-gray-200 rounded-lg p-1 text-xs font-bold gap-1">
                {(['Cash', 'Bank', 'Telebirr', 'Credit', 'Split'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setMainPaymentType(type);
                      setPaymentMethod(type);
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-md text-center transition-all cursor-pointer ${
                      mainPaymentType === type
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-select options if Bank is selected */}
            {mainPaymentType === 'Bank' && (
              <div className="p-2.5 bg-white rounded-lg border border-gray-200 space-y-2 text-left">
                <label className="text-[9px] font-bold text-gray-500 block uppercase">Select Bank</label>
                <div className="flex flex-wrap gap-1">
                  {(['CBE', 'Awash', 'BOA', 'Dashen', 'Other'] as const).map(bank => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => {
                        setSelectedBankType(bank);
                        if (bank !== 'Other') {
                          setCustomBankInput('');
                        }
                      }}
                      className={`py-1 px-2.5 rounded border text-[10px] font-bold text-center transition-all cursor-pointer ${
                        selectedBankType === bank && !customBankInput
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {bank}
                    </button>
                  ))}

                  {/* Dynamic saved banks list */}
                  {savedBanks.map(savedBank => (
                    <button
                      key={savedBank}
                      type="button"
                      onClick={() => {
                        setSelectedBankType('Other');
                        setCustomBankInput(savedBank);
                      }}
                      className={`py-1 px-2.5 rounded border text-[10px] font-bold text-center transition-all cursor-pointer ${
                        selectedBankType === 'Other' && customBankInput === savedBank
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      🏛️ {savedBank}
                    </button>
                  ))}
                </div>

                {/* Custom bank name input fields & save system */}
                {selectedBankType === 'Other' && (
                  <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-gray-200 space-y-2">
                    <label className="text-[9px] font-bold text-slate-700 block uppercase">Custom Bank Name</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={customBankInput}
                        onChange={(e) => setCustomBankInput(e.target.value)}
                        placeholder="Write custom bank name (e.g. Zemen, Oromia...)"
                        className="flex-1 bg-white border border-gray-300 p-1.5 rounded text-xs outline-none focus:border-emerald-500 font-semibold"
                      />
                      {customBankInput.trim() && !savedBanks.includes(customBankInput.trim()) && (
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = customBankInput.trim();
                            const updated = [...savedBanks, trimmed];
                            setSavedBanks(updated);
                            localStorage.setItem('sonan_saved_banks', JSON.stringify(updated));
                            showToast(`Saved "${trimmed}" for next time!`, 'success');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
                        >
                          Save Bank
                        </button>
                      )}
                    </div>
                    {savedBanks.length > 0 && (
                      <div className="flex justify-between items-center text-[9px] text-gray-400">
                        <span>Click any 🏛️ badge above to select.</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSavedBanks([]);
                            localStorage.removeItem('sonan_saved_banks');
                            setCustomBankInput('');
                            showToast('Cleared saved banks.', 'info');
                          }}
                          className="text-red-500 hover:underline cursor-pointer"
                        >
                          Clear Saved
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Split Form breakdown if Split is selected */}
            {mainPaymentType === 'Split' && (
              <div className="p-2.5 bg-white rounded-lg border border-gray-200 space-y-1.5 text-left text-[10px]">
                <div className="flex justify-between font-bold text-gray-700 border-b pb-1 mb-1.5">
                  <span>Split Details</span>
                  <span className={Math.abs(splitDifference) <= 0.05 ? 'text-emerald-700' : 'text-red-700'}>
                    {Math.abs(splitDifference) <= 0.05 ? 'Balanced ✓' : `Diff: ${splitDifference.toFixed(1)}`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { key: 'cash', label: 'Cash Amount' },
                    { key: 'card', label: 'Telebirr/Card' },
                    { key: 'credit', label: 'Credit' },
                    { key: 'cbe', label: 'Bank CBE' },
                    { key: 'boa', label: 'Bank BOA' },
                    { key: 'awash', label: 'Bank AWASH' },
                    { key: 'dashen', label: 'Bank DASHEN' },
                    { key: 'other', label: 'Other' }
                  ] as const).map(field => (
                    <div key={field.key} className="space-y-0.5">
                      <label className="font-semibold text-gray-500 block">{field.label}</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={splitDetailsRaw[field.key] !== undefined ? splitDetailsRaw[field.key] : (splitDetails[field.key] ? String(splitDetails[field.key]) : '')}
                        onChange={(e) => {
                          const raw = e.target.value.replace(',', '.');
                          if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                            setSplitDetailsRaw(prev => ({ ...prev, [field.key]: raw }));
                            const val = raw === '' || raw === '.' ? 0 : parseFloat(raw) || 0;
                            setSplitDetails(prev => ({ ...prev, [field.key]: val }));
                          }
                        }}
                        onBlur={() => {
                          const currentVal = splitDetails[field.key];
                          setSplitDetailsRaw(prev => ({ ...prev, [field.key]: currentVal ? String(currentVal) : '' }));
                        }}
                        className="w-full text-xs bg-gray-50 border border-gray-200 rounded p-1 outline-none font-bold font-mono text-gray-800"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Discount Option Section (Calculated before VAT) */}
            <div className="bg-slate-50 border border-slate-150 p-3 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  <Percent className="h-3.5 w-3.5 text-indigo-600" />
                  Subtotal Discount
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Applied before VAT</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-600 block">Type</label>
                  <select
                    value={discountType}
                    onChange={(e) => {
                      const newType = e.target.value as 'fixed' | 'percent';
                      setDiscountType(newType);
                      setDiscountValue(0);
                      setDiscountValueRaw('');
                      setDiscountAmount(0);
                    }}
                    className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2 outline-none text-gray-800 font-bold transition-all focus:border-indigo-500"
                  >
                    <option value="fixed">Fixed (ETB)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-600 block">
                    {discountType === 'percent' ? 'Rate (%)' : 'Amount (ETB)'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={discountValueRaw !== '' ? discountValueRaw : (discountValue ? String(discountValue) : '')}
                    onChange={(e) => {
                      const raw = e.target.value.replace(',', '.');
                      if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                        setDiscountValueRaw(raw);
                        const val = raw === '' || raw === '.' ? 0 : parseFloat(raw) || 0;
                        setDiscountValue(val);
                      }
                    }}
                    onBlur={() => {
                      setDiscountValueRaw(discountValue ? String(discountValue) : '');
                    }}
                    placeholder="0.00"
                    className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2 outline-none text-gray-800 font-mono font-bold transition-all focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* VAT Percent Input */}
            <div className="space-y-1 text-left">
              <label className="text-xs font-bold text-gray-700 block">VAT Percent (%)</label>
              <input
                type="text"
                inputMode="decimal"
                value={vatPercentRaw !== '' ? vatPercentRaw : String(vatPercent)}
                onChange={(e) => {
                  const raw = e.target.value.replace(',', '.');
                  if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                    setVatPercentRaw(raw);
                    const val = raw === '' || raw === '.' ? 0 : Math.max(0, Math.min(100, parseFloat(raw) || 0));
                    setVatPercent(val);
                  }
                }}
                onBlur={() => {
                  setVatPercentRaw(String(vatPercent));
                }}
                className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2 outline-none text-gray-800 font-mono font-bold"
              />
            </div>

            {/* Price calculation block */}
            <div className="border-t border-gray-200 pt-3 space-y-2 text-xs text-left">
              <div className="flex justify-between text-gray-600 font-medium">
                <span>Subtotal (Gross)</span>
                <span className="font-mono">{cartSubtotal.toFixed(2)} ETB</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>Discount ({discountType === 'percent' ? `${discountValue}%` : 'Fixed'})</span>
                  <span className="font-mono">-{discount.toFixed(2)} ETB</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-gray-700 font-semibold border-t border-dashed border-gray-200 pt-1.5 pb-0.5">
                  <span>Net Subtotal (Before VAT)</span>
                  <span className="font-mono">{netAmount.toFixed(2)} ETB</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600 font-medium">
                <span>VAT ({vatPercent}%)</span>
                <span className="font-mono">{vatAmount.toFixed(2)} ETB</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-gray-950 border-t border-gray-200 pt-2">
                <span>Grand Total</span>
                <span className="font-mono text-emerald-800">
                  {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                </span>
              </div>
            </div>

            {/* Action Row: Hold Option & Clear */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={holdActiveCart}
                disabled={cart.length === 0}
                className="flex-1 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900 font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm transition-colors disabled:opacity-45 cursor-pointer"
                title="Suspend sale and save to Hold list"
              >
                <FolderOpen className="h-4 w-4 text-amber-700" />
                Hold Sale
              </button>

              <button
                type="button"
                onClick={() => {
                  setCart([]);
                  setDiscountAmount(0);
                  setDiscountValue(0);
                  setDiscountType('fixed');
                  setSelectedCustomerId('');
                  setCustomerSearchQuery('');
                  setCustomerTin('');
                  showToast('Invoice cleared completely.', 'info');
                }}
                disabled={cart.length === 0}
                className="bg-red-50 border border-red-100 hover:bg-red-100 text-red-700 font-bold py-2.5 px-3 rounded-lg text-xs disabled:opacity-45 transition-all cursor-pointer"
              >
                Clear
              </button>
            </div>

            {/* High-Speed Express Checkout Toggle */}
            <div className="bg-emerald-50/75 border border-emerald-100 rounded-lg p-2.5 flex items-center justify-between mb-2">
              <div className="flex flex-col">
                <span className="text-[11px] font-extrabold text-emerald-950 uppercase tracking-wider flex items-center gap-1">
                  ⚡ High-Speed Express
                </span>
                <span className="text-[9px] text-emerald-800">One-click checkout in microseconds</span>
              </div>
              <input
                type="checkbox"
                id="express-checkout-toggle"
                checked={expressCheckout}
                onChange={(e) => setExpressCheckout(e.target.checked)}
                className="rounded border-emerald-300 text-emerald-600 bg-white h-4 w-4 cursor-pointer focus:ring-emerald-400"
              />
            </div>

            {/* Offline Sales Status Notice Banner */}
            {(!isOnline || offlineModeOverride) && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 mb-2 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">📱</span>
                  <div>
                    <span className="font-extrabold text-[11px] block">Offline Sales Active</span>
                    <span className="text-[10px] opacity-90">Transactions will save locally and auto-sync when online.</span>
                  </div>
                </div>
                {queuedOfflineSales.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-600 text-white font-black text-[10px] rounded-full shrink-0">
                    {queuedOfflineSales.length} Queued
                  </span>
                )}
              </div>
            )}

            {/* Complete Sale and Print Invoice Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || submittingCheckout || (paymentMethod === 'Split' && Math.abs(splitDifference) > 0.05)}
              className={`w-full text-white text-xs font-bold py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer uppercase tracking-wider ${
                (!isOnline || offlineModeOverride) 
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20' 
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {submittingCheckout 
                ? 'Processing Sale...' 
                : ((!isOnline || offlineModeOverride) ? '📱 Complete Offline Sale & Queue' : 'Complete & Print Sales Invoice')
              }
            </button>

          </div>

        </div>

      </div>


      {/* MODAL: Register New Customer Loyalty Profile */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 text-gray-800">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3.5 mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-emerald-600" />
                Loyalty Customer Register Profile
              </h3>
              <button 
                onClick={() => setShowAddCustomerModal(false)}
                className="p-1 hover:bg-gray-100 rounded text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewCustomer} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 block">Full Customer Name *</label>
                <input
                  type="text"
                  required
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2 border border-gray-200 rounded text-xs text-gray-800 outline-none"
                  placeholder="e.g., Almaz Kebede"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 block">Phone Number (Optional)</label>
                <input
                  type="text"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full p-2 border border-gray-200 rounded text-xs text-gray-800 outline-none"
                  placeholder="e.g., 0911223344"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 block">TIN Number (Optional)</label>
                  <input
                    type="text"
                    value={newCustomer.tin}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, tin: e.target.value }))}
                    className="w-full p-2 border border-gray-200 rounded text-xs text-gray-800 outline-none"
                    placeholder="e.g., 1024567891"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 block">Credit Limit (ETB)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={newCustomer.creditLimit ?? ''}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(',', '.');
                      if (sanitized === '' || /^\d*\.?\d*$/.test(sanitized)) {
                        const num = sanitized === '' || sanitized === '.' ? 0 : parseFloat(sanitized) || 0;
                        setNewCustomer(prev => ({ ...prev, creditLimit: num }));
                      }
                    }}
                    className="w-full p-2 border border-gray-200 rounded text-xs text-gray-800 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 block">Email Address</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full p-2 border border-gray-200 rounded text-xs text-gray-800 outline-none"
                  placeholder="e.g., almaz@gmail.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 block">Home/Work Address</label>
                <textarea
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full p-2 border border-gray-200 rounded text-xs text-gray-800 outline-none h-16 resize-none"
                  placeholder="e.g., Bole Subcity, Addis Ababa"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold py-2 px-4 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-5 rounded shadow"
                >
                  Register Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHECOUT SUCCESS MODAL: Dual View Printable Receipts (Thermal / A4) */}
      {showReceipt && completedSale && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 border border-gray-150 flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Printer className="h-5 w-5 text-emerald-600" />
                  Official Pharmacy Invoice &amp; Print System
                </h3>
                <p className="text-[10px] text-gray-500">
                  Transaction logged successfully. Connected to local Cash Register.
                </p>
              </div>
              <button
                onClick={() => { setShowReceipt(false); setCompletedSale(null); }}
                className="p-1 hover:bg-gray-100 rounded text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Layout Toggle Selector */}
            <div className="flex justify-center border-b border-gray-100 pb-3 mb-4">
              <div className="flex bg-gray-100 rounded-lg p-1 text-xs">
                <button
                  onClick={() => setReceiptFormat('thermal')}
                  className={`py-1.5 px-4 rounded-md font-bold flex items-center gap-1.5 ${
                    receiptFormat === 'thermal' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 text-gray-500" />
                  Thermal Slip (80mm)
                </button>
                <button
                  onClick={() => setReceiptFormat('a4')}
                  className={`py-1.5 px-4 rounded-md font-bold flex items-center gap-1.5 ${
                    receiptFormat === 'a4' ? 'bg-white text-emerald-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  Official A4 Invoice
                </button>
              </div>
            </div>

            {/* Receipt Preview Pane */}
            <div className="flex-1 overflow-y-auto border border-gray-200 bg-gray-50 p-6 rounded-xl min-h-[350px]">
              
              {/* TARGET PRINT CONTAINER */}
              <div id="printable-invoice-wrapper" className="bg-white mx-auto shadow-sm p-5 border border-gray-150">
                
                {/* 1. THERMAL SLIP FORMAT */}
                {receiptFormat === 'thermal' ? (
                  <div className="font-mono text-[10px] text-gray-900 max-w-xs mx-auto space-y-4 leading-relaxed">
                    <div className="text-center space-y-1">
                      <h2 className="text-xs font-black uppercase text-gray-950">{institution.name}</h2>
                      <p className="text-[9px] text-gray-600 leading-normal">
                        {institution.address}<br />
                        TIN: {institution.tinNumber}<br />
                        Tel: {institution.phone}<br />
                        Branch: {completedSale.branchName}<br />
                        Cashier: {completedSale.cashierName}
                      </p>
                      <p className="text-[9px] font-bold border-y border-dashed border-gray-400 py-1 uppercase tracking-wider my-2">
                        OFFICIAL TAX INVOICE
                      </p>
                    </div>

                    <div className="space-y-0.5 text-[9px] text-gray-800">
                      <div>Invoice No: <span className="font-bold">{completedSale.invoiceNumber}</span></div>
                      <div>Date: {completedSale.date} Time: {completedSale.time}</div>
                      <div>Payment Route: <span className="font-bold uppercase">{completedSale.paymentMethod}</span></div>
                      {completedSale.customerName && (
                        <div className="border-t border-gray-200 pt-1 mt-1">
                          <div>Loyalty Client: <span className="font-semibold">{completedSale.customerName}</span></div>
                          {completedSale.customerTin && (
                            <div>Client TIN: <span className="font-mono">{completedSale.customerTin}</span></div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Table */}
                    <div className="border-t border-dashed border-gray-300 pt-2 space-y-2">
                      <div className="flex justify-between font-bold border-b border-dashed border-gray-300 pb-1 text-[9px]">
                        <span>Item Description</span>
                        <span className="text-right">Price • Qty • Sub</span>
                      </div>
                      {completedSale.items.map((line, idx) => (
                        <div key={idx} className="space-y-0.5 text-[9px]">
                          <div className="font-bold uppercase">{line.medicineName}</div>
                          <div className="flex justify-between text-gray-600">
                            <span>Batch: {line.batchNumber}</span>
                            <span>{line.unitPrice.toFixed(0)} x {line.quantity} = {(line.unitPrice * line.quantity).toFixed(0)} ETB</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Computations */}
                    <div className="border-t border-dashed border-gray-300 pt-2 space-y-1 text-[9px] text-right">
                      <div className="flex justify-between">
                        <span>Cart Subtotal:</span>
                        <span>{completedSale.subtotal.toFixed(2)} ETB</span>
                      </div>
                      {completedSale.discount > 0 && (
                        <div className="flex justify-between text-amber-900">
                          <span>Applied Discount:</span>
                          <span>-{completedSale.discount.toFixed(2)} ETB</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>VAT ({completedSale.vatPercent || 15}%):</span>
                        <span>{completedSale.vat.toFixed(2)} ETB</span>
                      </div>
                      <div className="flex justify-between font-extrabold text-[11px] text-gray-950 border-t border-dashed border-gray-400 pt-1">
                        <span>Grand Total:</span>
                        <span>{completedSale.total.toFixed(2)} ETB</span>
                      </div>
                    </div>

                    {/* Thermal Footer */}
                    <div className="text-center pt-4 text-[9px] text-gray-500 leading-normal space-y-1">
                      <p className="font-bold uppercase text-gray-950">*** Cash Register Link ***</p>
                      <p>Print Command Sent successfully.</p>
                      <p className="italic text-[8px]">Thank you for shopping at {institution.name}!</p>
                    </div>
                  </div>
                ) : (
                  
                  /* 2. ADVANCED OFFICIAL A4 CORPORATE TAX SHEET */
                  <div className="font-sans text-xs text-gray-800 leading-normal space-y-6">
                    
                    {/* A4 Header */}
                    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
                      <div className="space-y-1">
                        <h2 className="text-lg font-black tracking-wide text-slate-950 uppercase">{institution.name}</h2>
                        <p className="text-[11px] text-gray-500 max-w-sm leading-normal">
                          Main ERP Head Office: {institution.address}<br />
                          TIN REGISTRATION ID: <span className="font-bold text-gray-800">{institution.tinNumber}</span><br />
                          Email: {institution.email} • Tel: {institution.phone}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <span className="bg-slate-900 text-white text-[10px] font-bold px-3 py-1 rounded uppercase tracking-wider block">
                          OFFICIAL TAX INVOICE SHEET
                        </span>
                        <div className="text-[11px] text-gray-500 font-mono mt-1">
                          Invoice: <span className="font-bold text-gray-800">{completedSale.invoiceNumber}</span><br />
                          Date: {completedSale.date}<br />
                          Time: {completedSale.time}
                        </div>
                      </div>
                    </div>

                    {/* Settlement Meta Details */}
                    <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-gray-200">
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Transaction Parameters</span>
                        <div className="text-xs space-y-0.5">
                          <div><span className="text-gray-500">Dispensing Branch:</span> <span className="font-bold text-gray-900">{completedSale.branchName}</span></div>
                          <div><span className="text-gray-500">Authorized Officer:</span> <span className="font-semibold text-gray-900">{completedSale.cashierName}</span></div>
                          <div><span className="text-gray-500">Settlement Route:</span> <span className="font-bold text-emerald-800 uppercase">{completedSale.paymentMethod}</span></div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Billed Customer / Patient Account</span>
                        <div className="text-xs space-y-0.5">
                          <div><span className="text-gray-500">Registered Name:</span> <span className="font-bold text-slate-950">{completedSale.customerName || 'Walk-In Customer Account'}</span></div>
                          {completedSale.customerTin ? (
                            <div><span className="text-gray-500">Customer TIN:</span> <span className="font-mono text-slate-950 font-bold">{completedSale.customerTin}</span></div>
                          ) : (
                            <div><span className="text-gray-500">Loyalty Status:</span> <span className="text-gray-500 italic">General Walk-In Account</span></div>
                          )}
                          {completedSale.customerName && (
                            <div><span className="text-gray-500">Loyalty Status:</span> <span className="text-emerald-700 font-bold">Consolidated Profile</span></div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full text-left text-xs font-sans">
                        <thead className="bg-slate-900 font-bold text-white uppercase text-[9px] tracking-wider">
                          <tr>
                            <th className="p-3">Sl No</th>
                            <th className="p-3">Description of Medicine / Cosmetic</th>
                            <th className="p-3 text-center">Batch ID</th>
                            <th className="p-3 text-right">Unit Price</th>
                            <th className="p-3 text-center">Quantity</th>
                            <th className="p-3 text-right font-mono">Subtotal (ETB)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {completedSale.items.map((line, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-3 text-gray-500 font-mono">{idx + 1}</td>
                              <td className="p-3">
                                <span className="font-bold text-slate-900 block uppercase">{line.medicineName}</span>
                              </td>
                              <td className="p-3 text-center font-mono text-gray-600 text-[10px]">{line.batchNumber}</td>
                              <td className="p-3 text-right font-mono">{line.unitPrice.toFixed(2)}</td>
                              <td className="p-3 text-center font-bold font-mono text-slate-900">{line.quantity}</td>
                              <td className="p-3 text-right font-mono font-bold text-slate-950">{(line.unitPrice * line.quantity).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Invoice Footer Computations */}
                    <div className="flex justify-between items-start gap-4 pt-4 border-t border-gray-200">
                      
                      {/* Left: bank info */}
                      <div className="p-3.5 bg-slate-55 rounded-xl border border-gray-150 text-[10px] text-gray-500 space-y-1.5 max-w-sm">
                        <span className="font-bold text-slate-900 block uppercase tracking-wide text-[9px]">Settle Bank Transfers To:</span>
                        <div className="space-y-0.5 leading-normal">
                          <div>Commercial Bank of Ethiopia (CBE): <span className="font-bold text-slate-800">1000123456789</span></div>
                          <div>Bank of Abyssinia (BOA): <span className="font-bold text-slate-800">4567891230</span></div>
                          <div>AWASH Bank: <span className="font-bold text-slate-800">991245678000</span></div>
                          <div>DASHEN Bank: <span className="font-bold text-slate-800">00123789501</span></div>
                        </div>
                      </div>

                      {/* Right: computation boxes */}
                      <div className="space-y-1.5 w-64 text-right">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Subtotal Gross:</span>
                          <span className="font-mono text-gray-900 font-semibold">{completedSale.subtotal.toFixed(2)} ETB</span>
                        </div>
                        {completedSale.discount > 0 && (
                          <div className="flex justify-between text-xs text-amber-800 font-bold">
                            <span>Adjusted Discount:</span>
                            <span className="font-mono">-{completedSale.discount.toFixed(2)} ETB</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Computed VAT ({completedSale.vatPercent || 15}%):</span>
                          <span className="font-mono text-gray-900 font-semibold">{completedSale.vat.toFixed(2)} ETB</span>
                        </div>
                        <div className="flex justify-between text-sm font-black text-slate-950 border-t border-gray-300 pt-2 text-[13px]">
                          <span>Grand Total:</span>
                          <span className="font-mono text-emerald-800">{completedSale.total.toFixed(2)} ETB</span>
                        </div>
                      </div>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-6 pt-10 text-[10px] text-center text-gray-500">
                      <div className="space-y-4">
                        <div className="border-b border-gray-300 mx-auto w-40 h-8"></div>
                        <span>Cashier / Authorized Signature</span>
                      </div>
                      <div className="space-y-4">
                        <div className="border-b border-gray-300 mx-auto w-40 h-8"></div>
                        <span>Customer / Patient Signature</span>
                      </div>
                    </div>

                    {/* Tax declaration terms */}
                    <div className="text-center pt-6 text-[9px] text-gray-400 border-t border-dashed border-gray-200">
                      This is an authorized tax invoice document printed directly from the Sonan Pharmacy local cash register module.
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Print & Download Action Bottom Controls */}
            <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-2 justify-end text-xs font-sans font-semibold">
              <button
                onClick={() => window.print()}
                className="bg-gray-900 text-white hover:bg-black py-2.5 px-4 rounded-lg shadow flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Print Document
              </button>
              <button
                onClick={async () => {
                  if (completedSale) {
                    const branch = branches?.find(b => b.id === completedSale.branchId);
                    await generateReceiptPdf(completedSale, {
                      institution,
                      branch,
                      format: receiptFormat === 'thermal' ? 'thermal' : 'standard',
                      autoDownload: true
                    });
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                title="Download genuine PDF receipt"
              >
                <Download className="h-4 w-4" />
                Download PDF ({receiptFormat === 'thermal' ? '80mm Thermal' : 'A4 Invoice'})
              </button>
              <button
                onClick={() => {
                  if (completedSale) {
                    triggerAutoDownload(completedSale);
                  }
                }}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-2.5 px-3 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                title="Download HTML receipt backup"
              >
                <FileText className="h-4 w-4" />
                HTML
              </button>
              <button
                onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(completedSale, null, 2));
                  const dlAnchor = document.createElement('a');
                  dlAnchor.setAttribute("href", dataStr);
                  dlAnchor.setAttribute("download", `invoice-${completedSale?.invoiceNumber}.json`);
                  dlAnchor.click();
                }}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-2.5 px-3 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4" />
                JSON
              </button>
              <button
                onClick={() => { setShowReceipt(false); setCompletedSale(null); }}
                className="bg-slate-100 hover:bg-slate-200 text-gray-800 py-2.5 px-4 rounded-lg cursor-pointer"
              >
                Close Panel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Floating Toast Notification Overlay */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white rounded-xl shadow-2xl p-4 border border-slate-800 flex items-center gap-3 animate-bounce">
          <div className={`h-2.5 w-2.5 rounded-full ${notification.type === 'success' ? 'bg-emerald-500' : notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`} />
          <p className="text-xs font-semibold">{notification.message}</p>
          <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-white font-bold ml-auto text-xs">×</button>
        </div>
      )}

      {/* Modal: Cash Register Machine Configuration */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-150 text-gray-800 text-xs">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
                  <Printer className="h-5 w-5 text-emerald-600" />
                  Cash Register Terminal Setup
                </h3>
                <p className="text-[10px] text-gray-450">Configure local physical POS billing printers or cash registers.</p>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Register Terminal ID</label>
                  <input
                    type="text"
                    value={cashRegister.id}
                    onChange={(e) => setCashRegister({ ...cashRegister, id: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded p-2 outline-none font-mono text-gray-850"
                    placeholder="e.g. CR-01"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Machine Model / Class</label>
                  <select
                    value={cashRegister.model}
                    onChange={(e) => setCashRegister({ ...cashRegister, model: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850"
                  >
                    <option value="Epson TM-T88VI Thermal">Epson TM-T88VI Thermal</option>
                    <option value="Casio SE-S400 Fiscal">Casio SE-S400 Fiscal</option>
                    <option value="Star Micronics mC-Print3">Star Micronics mC-Print3</option>
                    <option value="Bixolon SRP-350plusIII">Bixolon SRP-350plusIII</option>
                    <option value="Generic 58mm POS Printer">Generic 58mm POS Printer</option>
                    <option value="Generic 80mm POS Printer">Generic 80mm POS Printer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Port / Interface Connection</label>
                  <select
                    value={cashRegister.port}
                    onChange={(e) => setCashRegister({ ...cashRegister, port: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850"
                  >
                    <option value="USB001">USB001 (Recommended)</option>
                    <option value="COM1">COM1 (Serial RS232)</option>
                    <option value="COM2">COM2 (Serial RS232)</option>
                    <option value="LPT1">LPT1 (Parallel)</option>
                    <option value="TCP:192.168.1.100">TCP:192.168.1.100 (Ethernet LAN)</option>
                    <option value="Bluetooth">Bluetooth Terminal</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Baud Rate (COM Speed)</label>
                  <select
                    value={cashRegister.baudRate}
                    onChange={(e) => setCashRegister({ ...cashRegister, baudRate: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850 font-mono"
                  >
                    <option value="9600">9600 bps</option>
                    <option value="19200">19200 bps</option>
                    <option value="38400">38400 bps</option>
                    <option value="115200">115200 bps</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Paper Width Size</label>
                  <select
                    value={cashRegister.paperWidth}
                    onChange={(e) => setCashRegister({ ...cashRegister, paperWidth: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850"
                  >
                    <option value="80mm">80 mm (Standard POS)</option>
                    <option value="58mm">58 mm (Compact Terminal)</option>
                    <option value="A4">A4 Page Printer</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700">Terminal Operational Status</label>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="cr-active-toggle"
                      checked={cashRegister.isActive}
                      onChange={(e) => setCashRegister({ ...cashRegister, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-emerald-600 bg-white"
                    />
                    <label htmlFor="cr-active-toggle" className="font-bold text-emerald-800">
                      Active / Connected
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700">Custom Receipt Header Text</label>
                <input
                  type="text"
                  value={cashRegister.headerText}
                  onChange={(e) => setCashRegister({ ...cashRegister, headerText: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850"
                  placeholder="e.g. Sonan Pharmacy Lane #1"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-[10px] leading-relaxed">
                ℹ️ <b>Hardware Connection Note:</b> Settings configured here are saved directly to this device's browser profile. This ensures each individual physical computer lane communicates correctly with its own local attached printer terminal.
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 mt-4 border-t border-gray-150">
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 px-4 rounded border border-gray-300 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('sonan_cash_register', JSON.stringify(cashRegister));
                  setShowRegisterModal(false);
                  showToast('Cash Register Hardware Configuration Updated!', 'success');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-5 rounded font-bold shadow transition-all cursor-pointer"
              >
                Save Hardware Config
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Offline Sales Queue Manager */}
      {showOfflineQueueModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 border border-gray-200 text-gray-800 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded">📱</span>
                Queued Offline Sales Manager ({queuedOfflineSales.length})
              </h3>
              <button onClick={() => setShowOfflineQueueModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              These sales were completed while working offline or with internet disabled. They are saved safely in local storage and will upload to the central ERP backend database when synced.
            </p>

            <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
              {queuedOfflineSales.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 italic">
                  No queued offline sales found.
                </div>
              ) : (
                queuedOfflineSales.map((item, idx) => (
                  <div key={item.id || idx} className="p-3 flex items-center justify-between hover:bg-gray-50 text-xs">
                    <div>
                      <span className="font-bold text-gray-900 block">Invoice #{item.invoiceNumber}</span>
                      <span className="text-[10px] text-gray-500 block">
                        Customer: {item.customerName || 'Walk-In'} • {item.itemCount} item(s) • {item.date} {item.time}
                      </span>
                    </div>
                    <div className="text-right font-mono font-bold text-emerald-700">
                      {item.total?.toFixed(2)} ETB
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-150">
              <button
                type="button"
                onClick={clearOfflineQueue}
                disabled={queuedOfflineSales.length === 0}
                className="text-xs bg-red-50 hover:bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded border border-red-200 transition-colors disabled:opacity-40"
              >
                Clear Queue
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOfflineQueueModal(false)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3.5 py-1.5 rounded border border-gray-300"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={syncOfflineSales}
                  disabled={queuedOfflineSales.length === 0 || isSyncingOffline || !isOnline}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-1.5 rounded shadow transition-all flex items-center gap-1.5 disabled:opacity-40"
                >
                  <RefreshCw className={`h-3 w-3 ${isSyncingOffline ? 'animate-spin' : ''}`} />
                  {isSyncingOffline ? 'Syncing...' : 'Sync All Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
