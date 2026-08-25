import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, AlertCircle, Calendar, ShieldAlert, 
  MapPin, ShoppingCart, Award, Package, ArrowUpRight, 
  AlertTriangle, DollarSign, Activity, Download, FileSpreadsheet, 
  Search, Filter, Printer, RefreshCw, Clock, CreditCard, ChevronRight,
  Coins, Sparkles, AlertOctagon, CalendarClock, LineChart, FileDown,
  Edit2, X, Share2, Copy, Check, ExternalLink, MessageSquare, Send, Mail,
  QrCode, Globe, ShoppingBag
} from 'lucide-react';
import QRCode from 'qrcode';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell, ComposedChart, Line
} from 'recharts';
import { Sale, StockItem, Medicine, Branch, Supplier } from '../types.ts';

interface EnterpriseDashboardProps {
  sales: Sale[];
  stockItems: StockItem[];
  medicines: Medicine[];
  branches: Branch[];
  suppliers: Supplier[];
  currentUser?: any;
  onDataChanged?: () => void;
  activeBranchId?: string;
  allSales?: Sale[];
}

export default function EnterpriseDashboard({ sales, stockItems, medicines, branches, suppliers, currentUser, onDataChanged, activeBranchId, allSales }: EnterpriseDashboardProps) {
  const isAdmin = currentUser?.role === 'Super Administrator' || currentUser?.role === 'Admin' || (currentUser?.role && String(currentUser.role).toLowerCase().includes('admin'));

  // Top-level Dashboard Category Filter ('all' | 'medicine' | 'cosmetics')
  const [dashboardCategory, setDashboardCategory] = useState<'all' | 'medicine' | 'cosmetics'>('all');

  // Customer Store Link & Share States
  const [copiedStoreLink, setCopiedStoreLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [shareBranchId, setShareBranchId] = useState<string>('all');

  const getPublicStoreUrl = (branchId?: string) => {
    const targetBranch = branchId || shareBranchId;
    const baseUrl = `${window.location.origin}${window.location.pathname}?view=catalog`;
    if (targetBranch && targetBranch !== 'all') {
      return `${baseUrl}&branchId=${targetBranch}`;
    }
    return baseUrl;
  };

  const handleCopyStoreLink = (branchId?: string) => {
    const url = getPublicStoreUrl(branchId);
    navigator.clipboard.writeText(url);
    setCopiedStoreLink(true);
    setTimeout(() => setCopiedStoreLink(false), 2500);
  };

  const handleOpenQrModal = async (branchId?: string) => {
    const url = getPublicStoreUrl(branchId);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 360,
        margin: 2,
        color: {
          dark: '#064e3b',
          light: '#ffffff'
        }
      });
      setQrDataUrl(dataUrl);
      setShowQrModal(true);
    } catch (err) {
      console.error('Failed to generate QR:', err);
    }
  };

  const shareStoreToPlatform = (platform: 'whatsapp' | 'telegram' | 'facebook' | 'twitter' | 'email' | 'native', branchId?: string) => {
    const url = getPublicStoreUrl(branchId);
    const selectedBranch = branches.find(b => b.id === (branchId || shareBranchId));
    const branchSuffix = selectedBranch ? ` (${selectedBranch.name} Branch)` : '';
    const text = `🛍️ Browse medicine & cosmetics catalog and order online for fast home delivery${branchSuffix}:`;

    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    } else if (platform === 'telegram') {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'email') {
      window.open(`mailto:?subject=${encodeURIComponent('Online Pharmacy & Cosmetics Catalog')}&body=${encodeURIComponent(text + '\n' + url)}`);
    } else if (platform === 'native') {
      if (navigator.share) {
        navigator.share({ title: 'Pharmacy Customer Catalog', text, url }).catch(() => {});
      } else {
        handleCopyStoreLink(branchId);
      }
    }
  };

  // Payment Method Edit States
  const [editingDashboardSale, setEditingDashboardSale] = useState<Sale | null>(null);
  const [newDashboardPaymentMethod, setNewDashboardPaymentMethod] = useState<string>('Cash');
  const [dashboardPaymentReason, setDashboardPaymentReason] = useState<string>('');
  const [isUpdatingDashboardPayment, setIsUpdatingDashboardPayment] = useState<boolean>(false);

  // Edit Expiry Date States
  const [editingExpiryBatch, setEditingExpiryBatch] = useState<{
    id: string;
    batchNumber: string;
    medicineName: string;
    currentExpiryDate: string;
    newExpiryDate: string;
    reason: string;
  } | null>(null);
  const [isSavingExpiry, setIsSavingExpiry] = useState<boolean>(false);

  const handleSaveExpiryDate = async () => {
    if (!editingExpiryBatch) return;
    setIsSavingExpiry(true);
    try {
      const res = await fetch(`/api/inventory/${editingExpiryBatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiryDate: editingExpiryBatch.newExpiryDate,
          editWho: currentUser?.name || currentUser?.username || 'Admin',
          editWhy: editingExpiryBatch.reason || 'Updated batch expiry date',
          operatorId: currentUser?.id
        })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to update expiry date');
      } else {
        alert(`Successfully updated expiry date for batch ${editingExpiryBatch.batchNumber} to ${editingExpiryBatch.newExpiryDate}`);
        setEditingExpiryBatch(null);
        if (onDataChanged) onDataChanged();
      }
    } catch (error) {
      alert('Error updating expiry date: ' + error);
    } finally {
      setIsSavingExpiry(false);
    }
  };

  const handleUpdateDashboardPayment = async () => {
    if (!editingDashboardSale) return;
    setIsUpdatingDashboardPayment(true);
    try {
      const res = await fetch('/api/sales/update-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: editingDashboardSale.id,
          paymentMethod: newDashboardPaymentMethod,
          reason: dashboardPaymentReason || 'Payment method updated from Enterprise Dashboard',
          operatorId: currentUser?.id || 'usr'
        })
      });

      if (res.ok) {
        setEditingDashboardSale(null);
        setDashboardPaymentReason('');
        if (onDataChanged) onDataChanged();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to update payment method');
      }
    } catch (err) {
      alert('Error updating payment method: ' + err);
    } finally {
      setIsUpdatingDashboardPayment(false);
    }
  };

  // Reports Section States
  const [reportPaymentMethod, setReportPaymentMethod] = useState<string>('all');
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportBranchId, setReportBranchId] = useState<string>((activeBranchId && activeBranchId !== 'all') ? activeBranchId : 'all');
  const [reportCategory, setReportCategory] = useState<'all' | 'medicine' | 'cosmetics'>('all');
  const [reportCashierName, setReportCashierName] = useState<string>('all');
  const [reportChannel, setReportChannel] = useState<'all' | 'instore' | 'online'>('all');

  useEffect(() => {
    if (activeBranchId && activeBranchId !== 'all') {
      setReportBranchId(activeBranchId);
    } else if (activeBranchId === 'all') {
      setReportBranchId('all');
    }
  }, [activeBranchId]);

  // Expiry notification modal state
  const [showExpiryModal, setShowExpiryModal] = useState<boolean>(false);
  const [expirySearchQuery, setExpirySearchQuery] = useState<string>('');
  const [expiryActiveTab, setExpiryActiveTab] = useState<'expired' | 'soon'>('expired');

  // Predictive Stock Demand States
  const [predictiveFilterMode, setPredictiveFilterMode] = useState<'critical' | 'velocity' | 'all'>('critical');
  const [forecastHorizonMonths, setForecastHorizonMonths] = useState<number>(1);

  // Source of all unpartitioned sales for enterprise dashboard, daily ledger, and branch breakdown audits
  const salesPool = (allSales && allSales.length > 0) ? allSales : sales;

  // Date normalization helpers (handling YYYY-MM-DD, ISO timestamps, and UTC vs local time)
  const getSaleDateStr = React.useCallback((dateVal?: string): string => {
    if (!dateVal) return '';
    return dateVal.split('T')[0].split(' ')[0].trim();
  }, []);

  const todayUTC = new Date().toISOString().split('T')[0];
  const todayLocal = new Date(Date.now() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const isSaleToday = React.useCallback((dateVal?: string) => {
    const d = getSaleDateStr(dateVal);
    return d === todayUTC || d === todayLocal;
  }, [getSaleDateStr, todayUTC, todayLocal]);

  // Robust string normalization helper
  const normalizeStr = (str?: string | null) => (str || '').trim().toLowerCase();

  // Lossless branch resolution: attributes every sale to exactly one known branch
  const getSaleBranchId = React.useCallback((s: any): string => {
    if (!s || !branches || branches.length === 0) return branches?.[0]?.id || 'b1';
    const saleBId = normalizeStr(s.branchId);
    const saleBName = normalizeStr(s.branchName);

    // 1. Direct match with a branch id
    const foundById = branches.find(b => normalizeStr(b.id) === saleBId);
    if (foundById) return foundById.id;

    // 2. Match with branch code
    const foundByCode = branches.find(b => b.code && normalizeStr(b.code) === saleBId);
    if (foundByCode) return foundByCode.id;

    // 3. Match with branch name
    const foundByName = branches.find(b => 
      normalizeStr(b.name) === saleBName || 
      normalizeStr(b.name) === saleBId ||
      (b.code && normalizeStr(b.code) === saleBName)
    );
    if (foundByName) return foundByName.id;

    // 4. Fuzzy / partial name matching (e.g. "Main Branch" -> "Sonan Pharmacy Main Branch", "No. 2" -> "Sonan Pharmacy No. 2")
    if (saleBName || saleBId) {
      const targetStr = saleBName || saleBId;
      const foundFuzzy = branches.find(b => {
        const bNameNorm = normalizeStr(b.name);
        const bCodeNorm = normalizeStr(b.code);
        return (
          bNameNorm.includes(targetStr) || 
          targetStr.includes(bNameNorm) ||
          (bCodeNorm && (bCodeNorm.includes(targetStr) || targetStr.includes(bCodeNorm))) ||
          (targetStr.includes('main') && bNameNorm.includes('main')) ||
          (targetStr.includes('2') && (bNameNorm.includes('2') || b.id === 'b2')) ||
          (targetStr.includes('3') && (bNameNorm.includes('3') || b.id === 'b3'))
        );
      });
      if (foundFuzzy) return foundFuzzy.id;
    }

    // Default fallback to first branch if unassigned to prevent lost revenue in partitioning
    return branches[0]?.id || 'b1';
  }, [branches]);

  // Branch filter helper with strict lossless matching for accurate multi-branch accounting
  const checkSaleMatchesBranch = React.useCallback((s: any, targetBranchId: string) => {
    if (!targetBranchId || targetBranchId === 'all') return true;
    const targetNorm = normalizeStr(targetBranchId);
    const targetBranch = branches?.find(b => 
      normalizeStr(b.id) === targetNorm || 
      normalizeStr(b.name) === targetNorm || 
      (b.code && normalizeStr(b.code) === targetNorm)
    );
    const resolvedTargetId = targetBranch ? targetBranch.id : targetBranchId;
    const resolvedSaleBranchId = getSaleBranchId(s);
    return resolvedSaleBranchId === resolvedTargetId;
  }, [branches, getSaleBranchId]);

  const checkStockMatchesBranch = (st: StockItem, targetBranchId: string) => {
    if (!targetBranchId || targetBranchId === 'all') return true;
    if (st.branchId && String(st.branchId).trim() === String(targetBranchId).trim()) return true;

    const targetB = branches?.find(b => 
      String(b.id).trim() === String(targetBranchId).trim() || 
      String(b.name).trim().toLowerCase() === String(targetBranchId).trim().toLowerCase() || 
      (b.code && String(b.code).trim().toLowerCase() === String(targetBranchId).trim().toLowerCase())
    );

    if (targetB) {
      const stockBId = st.branchId ? String(st.branchId).trim() : '';
      if (stockBId && (
        stockBId === String(targetB.id).trim() || 
        (targetB.code && stockBId.toLowerCase() === String(targetB.code).trim().toLowerCase()) ||
        stockBId.toLowerCase() === String(targetB.name).trim().toLowerCase()
      )) {
        return true;
      }
      if (st.branchId && (st.branchId === targetB.name || st.branchId === targetB.code)) return true;
    }

    return false;
  };

  // 1. Dynamic category & branch filtering of transactions and stock
  const checkIsCosmeticMed = React.useCallback((medId: string) => {
    const med = medicines.find(m => m.id === medId);
    if (!med) return false;
    const prodType = med.productType || 'medicine';
    const catLower = med.category?.toLowerCase() || '';
    return prodType === 'cosmetics' || catLower === 'cosmetics' || catLower.includes('cosmetic');
  }, [medicines]);

  const filteredSalesByCat = React.useMemo(() => {
    return salesPool.map(s => {
      if (s.status === 'Voided' || s.status === 'Returned') return null;
      if (!checkSaleMatchesBranch(s, reportBranchId)) return null;

      const filteredItems = s.items.filter(item => {
        const isCosmetic = checkIsCosmeticMed(item.medicineId);
        const type = isCosmetic ? 'cosmetics' : 'medicine';
        return dashboardCategory === 'all' || type === dashboardCategory;
      });
      
      if (filteredItems.length === 0) return null;
      if (filteredItems.length === s.items.length) {
        return s;
      }

      const subtotal = filteredItems.reduce((acc, x) => acc + (x.unitPrice * x.quantity), 0);
      const originalSubtotal = s.subtotal || s.items.reduce((acc, x) => acc + (x.unitPrice * x.quantity), 0) || 1;
      const ratio = subtotal / originalSubtotal;
      const discount = (s.discount || 0) * ratio;
      const vat = filteredItems.reduce((acc, x) => acc + (x.vatAmount || 0), 0);
      const total = Math.max(0, subtotal - discount + vat);
      
      return {
        ...s,
        items: filteredItems,
        subtotal,
        discount,
        vat,
        total
      };
    }).filter(Boolean) as Sale[];
  }, [salesPool, reportBranchId, dashboardCategory, checkSaleMatchesBranch, checkIsCosmeticMed]);

  const filteredStockItemsByCat = React.useMemo(() => {
    return stockItems.filter(st => {
      const isCosmetic = checkIsCosmeticMed(st.medicineId);
      const type = isCosmetic ? 'cosmetics' : 'medicine';
      const matchesCat = dashboardCategory === 'all' || type === dashboardCategory;
      const matchesBranch = checkStockMatchesBranch(st, reportBranchId);
      return matchesCat && matchesBranch;
    });
  }, [stockItems, dashboardCategory, reportBranchId, checkIsCosmeticMed, checkStockMatchesBranch]);

  const filteredMedicinesByCat = React.useMemo(() => {
    return medicines.filter(m => {
      const isCosmetic = m.productType === 'cosmetics' || m.category?.toLowerCase() === 'cosmetics' || m.category?.toLowerCase().includes('cosmetic');
      const type = isCosmetic ? 'cosmetics' : 'medicine';
      return dashboardCategory === 'all' || type === dashboardCategory;
    });
  }, [medicines, dashboardCategory]);

  // Precomputed Stock Totals Map for O(1) alert lookups
  const stockQtyByMedIdMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    filteredStockItemsByCat.forEach(st => {
      map[st.medicineId] = (map[st.medicineId] || 0) + (st.quantity || 0);
    });
    return map;
  }, [filteredStockItemsByCat]);

  // Outstanding Supplier Debt Calculation
  const outstandingSupplierDebt = React.useMemo(() => {
    return suppliers ? suppliers.reduce((acc, s) => acc + (s.balance || 0), 0) : 0;
  }, [suppliers]);

  // 2. Statistics Calculations using filtered datasets
  const getSalePaymentAmount = (s: any, targetMode: string) => {
    const pm = (s.paymentMethod || '').toLowerCase();
    if (targetMode === 'Cash') {
      if (s.paymentMethod === 'Split') return s.splitDetails?.cash || 0;
      return (pm === 'cash') ? s.total : 0;
    }
    if (targetMode === 'Bank') {
      if (s.paymentMethod === 'Split') {
        return (s.splitDetails?.cbe || 0) + (s.splitDetails?.boa || 0) + (s.splitDetails?.awash || 0) + (s.splitDetails?.dashen || 0) + (s.splitDetails?.other || 0);
      }
      return (pm.includes('bank') || pm.includes('cbe') || pm.includes('boa') || pm.includes('awash') || pm.includes('dashen')) ? s.total : 0;
    }
    if (targetMode === 'Bank CBE') {
      if (s.paymentMethod === 'Split') return s.splitDetails?.cbe || 0;
      return (pm.includes('cbe')) ? s.total : 0;
    }
    if (targetMode === 'Bank BOA') {
      if (s.paymentMethod === 'Split') return s.splitDetails?.boa || 0;
      return (pm.includes('boa')) ? s.total : 0;
    }
    if (targetMode === 'Bank AWASH') {
      if (s.paymentMethod === 'Split') return s.splitDetails?.awash || 0;
      return (pm.includes('awash')) ? s.total : 0;
    }
    if (targetMode === 'Bank DASHEN') {
      if (s.paymentMethod === 'Split') return s.splitDetails?.dashen || 0;
      return (pm.includes('dashen')) ? s.total : 0;
    }
    if (targetMode === 'Credit') {
      if (s.paymentMethod === 'Split') return s.splitDetails?.credit || 0;
      return (pm === 'credit') ? s.total : 0;
    }
    if (targetMode === 'Card') {
      if (s.paymentMethod === 'Split') return s.splitDetails?.card || 0;
      return (pm === 'card') ? s.total : 0;
    }
    return (s.paymentMethod === targetMode) ? s.total : 0;
  };

  const totalSalesVolume = React.useMemo(() => filteredSalesByCat.reduce((acc, s) => acc + s.total, 0), [filteredSalesByCat]);
  const totalSalesTax = React.useMemo(() => filteredSalesByCat.reduce((acc, s) => acc + s.vat, 0), [filteredSalesByCat]);
  const cashSales = React.useMemo(() => filteredSalesByCat.reduce((acc, s) => acc + getSalePaymentAmount(s, 'Cash'), 0), [filteredSalesByCat]);
  const creditSales = React.useMemo(() => filteredSalesByCat.reduce((acc, s) => acc + getSalePaymentAmount(s, 'Credit'), 0), [filteredSalesByCat]);
  const cardSales = React.useMemo(() => filteredSalesByCat.reduce((acc, s) => acc + getSalePaymentAmount(s, 'Card'), 0), [filteredSalesByCat]);
  const bankCBESales = React.useMemo(() => filteredSalesByCat.reduce((acc, s) => acc + getSalePaymentAmount(s, 'Bank CBE'), 0), [filteredSalesByCat]);
  const bankBOASales = React.useMemo(() => filteredSalesByCat.reduce((acc, s) => acc + getSalePaymentAmount(s, 'Bank BOA'), 0), [filteredSalesByCat]);
  const bankAwashSales = React.useMemo(() => filteredSalesByCat.reduce((acc, s) => acc + getSalePaymentAmount(s, 'Bank AWASH'), 0), [filteredSalesByCat]);
  const bankDashenSales = React.useMemo(() => filteredSalesByCat.reduce((acc, s) => acc + getSalePaymentAmount(s, 'Bank DASHEN'), 0), [filteredSalesByCat]);
  const splitSales = React.useMemo(() => filteredSalesByCat.filter(s => s.paymentMethod === 'Split').reduce((acc, s) => acc + s.total, 0), [filteredSalesByCat]);
  const otherSales = React.useMemo(() => filteredSalesByCat.filter(s => s.paymentMethod === 'Other').reduce((acc, s) => acc + s.total, 0), [filteredSalesByCat]);

  // Expiry notifications & Alert calculations (filtered)
  const todayStr = new Date().toISOString().split('T')[0];
  const soonLimitStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 180); // Alert if expired or within 180 days (User mandate)
    return d.toISOString().split('T')[0];
  })();

  const expiredBatches = React.useMemo(() => filteredStockItemsByCat.filter(st => st.expiryDate < todayStr && st.quantity > 0), [filteredStockItemsByCat, todayStr]);
  const expiringSoonBatches = React.useMemo(() => filteredStockItemsByCat.filter(st => st.expiryDate >= todayStr && st.expiryDate <= soonLimitStr && st.quantity > 0), [filteredStockItemsByCat, todayStr, soonLimitStr]);
  
  // Low stock alerts - O(M) with Map lookup
  const lowStockItems = React.useMemo(() => {
    return filteredStockItemsByCat.filter(st => {
      const med = filteredMedicinesByCat.find(m => m.id === st.medicineId);
      return med ? st.quantity <= med.minStockLevel : false;
    });
  }, [filteredStockItemsByCat, filteredMedicinesByCat]);

  // Out of stock alerts - O(M) with Map lookup
  const outOfStockMeds = React.useMemo(() => {
    return filteredMedicinesByCat.filter(med => {
      const totalQty = stockQtyByMedIdMap[med.id] || 0;
      return totalQty === 0;
    });
  }, [filteredMedicinesByCat, stockQtyByMedIdMap]);

  // Calculate Today's Sales volume
  const todaysSalesVolume = React.useMemo(() => {
    return filteredSalesByCat
      .filter(s => isSaleToday(s.date))
      .reduce((acc, s) => acc + s.total, 0);
  }, [filteredSalesByCat, isSaleToday]);

  // Profit calculations
  const medicineCostMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    medicines.forEach(m => {
      map[m.id] = (m.buyingPrice || m.price * 0.7);
    });
    return map;
  }, [medicines]);

  const calculateSaleProfit = React.useCallback((sale: any): number => {
    let profit = 0;
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach((item: any) => {
        const costPrice = medicineCostMap[item.medicineId] ?? (item.unitPrice * 0.7);
        const itemCost = costPrice * item.quantity;
        const itemRevenue = item.total - (item.vatAmount || 0);
        profit += (itemRevenue - itemCost);
      });
    }
    return Math.max(0, profit);
  }, [medicineCostMap]);

  const totalNetProfit = React.useMemo(() => filteredSalesByCat.reduce((acc, s) => acc + calculateSaleProfit(s), 0), [filteredSalesByCat, calculateSaleProfit]);

  const currentMonthPrefix = todayStr.slice(0, 7); // e.g. "2026-06"
  const monthlyNetProfit = React.useMemo(() => {
    return filteredSalesByCat
      .filter(s => (s.date || '').startsWith(currentMonthPrefix))
      .reduce((acc, s) => acc + calculateSaleProfit(s), 0);
  }, [filteredSalesByCat, currentMonthPrefix, calculateSaleProfit]);

  const todaysSales = React.useMemo(() => filteredSalesByCat.filter(s => isSaleToday(s.date)), [filteredSalesByCat, isSaleToday]);
  const dailyNetProfit = React.useMemo(() => todaysSales.reduce((acc, s) => acc + calculateSaleProfit(s), 0), [todaysSales, calculateSaleProfit]);
  const dailyTotalSalesRevenue = React.useMemo(() => todaysSales.reduce((acc, s) => acc + s.total, 0), [todaysSales]);
  const dailyProfitMargin = dailyTotalSalesRevenue > 0 ? (dailyNetProfit / dailyTotalSalesRevenue) * 100 : 0;

  // 3. Branch Performance Comparisons (across all branches)
  const categorySalesAllBranches = React.useMemo(() => {
    return salesPool.map(s => {
      if (s.status === 'Voided' || s.status === 'Returned') return null;

      const filteredItems = s.items.filter(item => {
        const isCosmetic = checkIsCosmeticMed(item.medicineId);
        const type = isCosmetic ? 'cosmetics' : 'medicine';
        return dashboardCategory === 'all' || type === dashboardCategory;
      });
      
      if (filteredItems.length === 0) return null;
      if (filteredItems.length === s.items.length) {
        return s;
      }

      const subtotal = filteredItems.reduce((acc, x) => acc + (x.unitPrice * x.quantity), 0);
      const originalSubtotal = s.subtotal || s.items.reduce((acc, x) => acc + (x.unitPrice * x.quantity), 0) || 1;
      const ratio = subtotal / originalSubtotal;
      const discount = (s.discount || 0) * ratio;
      const vat = filteredItems.reduce((acc, x) => acc + (x.vatAmount || 0), 0);
      const total = Math.max(0, subtotal - discount + vat);
      
      return {
        ...s,
        items: filteredItems,
        subtotal,
        discount,
        vat,
        total
      };
    }).filter(Boolean) as Sale[];
  }, [salesPool, dashboardCategory, checkIsCosmeticMed]);

  const branchPerformances = React.useMemo(() => {
    return branches.map(b => {
      const bSales = categorySalesAllBranches.filter(s => checkSaleMatchesBranch(s, b.id));
      const totalRevenue = bSales.reduce((acc, s) => acc + s.total, 0);
      const stockCount = stockItems.filter(st => {
        const isCosmetic = checkIsCosmeticMed(st.medicineId);
        const type = isCosmetic ? 'cosmetics' : 'medicine';
        const matchesCat = dashboardCategory === 'all' || type === dashboardCategory;
        const matchesBranch = checkStockMatchesBranch(st, b.id);
        return matchesCat && matchesBranch;
      }).reduce((acc, st) => acc + st.quantity, 0);
      return {
        ...b,
        revenue: totalRevenue,
        salesCount: bSales.length,
        stockCount
      };
    });
  }, [branches, categorySalesAllBranches, stockItems, dashboardCategory, checkSaleMatchesBranch, checkIsCosmeticMed, checkStockMatchesBranch]);

  // 4. Fast & Slow Moving Items
  const { fastMoving, slowMoving, sortedMeds } = React.useMemo(() => {
    const medicineSalesCountMap: { [medId: string]: { name: string; category: string; count: number; value: number } } = {};
    filteredMedicinesByCat.forEach(m => {
      medicineSalesCountMap[m.id] = { name: m.name, category: m.category, count: 0, value: 0 };
    });

    filteredSalesByCat.forEach(sale => {
      sale.items.forEach(line => {
        if (medicineSalesCountMap[line.medicineId]) {
          medicineSalesCountMap[line.medicineId].count += line.quantity;
          medicineSalesCountMap[line.medicineId].value += line.total;
        }
      });
    });

    const sorted = Object.values(medicineSalesCountMap).sort((a, b) => b.count - a.count);
    return {
      fastMoving: sorted.slice(0, 4),
      slowMoving: sorted.filter(x => x.count < 3).slice(0, 4),
      sortedMeds: sorted
    };
  }, [filteredMedicinesByCat, filteredSalesByCat]);

  // Compute unique cashiers/users from sales records matching the active branch filter without mixing across branches
  const branchFilteredSalesForCashiers = salesPool.filter(s => checkSaleMatchesBranch(s, reportBranchId));
  const uniqueCashierOptions = React.useMemo(() => {
    const map = new Map<string, { key: string; name: string; branchId: string; branchName: string; displayName: string }>();
    
    branchFilteredSalesForCashiers.forEach(s => {
      const cName = (s.cashierName || '').trim();
      if (!cName) return;
      
      const bId = getSaleBranchId(s) || s.branchId || 'default';
      const bObj = branches.find(b => b.id === bId || b.code === bId || b.name === s.branchName);
      const bName = bObj?.name || s.branchName || bId;
      
      const cId = s.cashierId ? String(s.cashierId).trim() : cName;
      // Scoped unique key
      const key = `${cId}:::${bId}`;
      
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: cName,
          branchId: bId,
          branchName: bName,
          displayName: reportBranchId === 'all' ? `${cName} (${bName})` : cName
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [branchFilteredSalesForCashiers, branches, reportBranchId]);

  // 5. Daily Sales Report Filter Execution
  const baseDailyReportSales = salesPool.filter(s => {
    // A. Filter by Payment Method, including split payments that contain the selected mode
    const pm = (s.paymentMethod || '').toLowerCase();
    let matchesMethod = false;
    if (reportPaymentMethod === 'all') {
      matchesMethod = true;
    } else if (reportPaymentMethod === 'Cash') {
      matchesMethod = pm === 'cash' || (s.paymentMethod === 'Split' && !!s.splitDetails?.cash);
    } else if (reportPaymentMethod === 'Bank') {
      matchesMethod = pm.includes('bank') || pm.includes('cbe') || pm.includes('boa') || pm.includes('awash') || pm.includes('dashen') ||
        (s.paymentMethod === 'Split' && (!!s.splitDetails?.cbe || !!s.splitDetails?.boa || !!s.splitDetails?.awash || !!s.splitDetails?.dashen || !!s.splitDetails?.other));
    } else if (reportPaymentMethod === 'Card') {
      matchesMethod = pm === 'card' || (s.paymentMethod === 'Split' && !!s.splitDetails?.card);
    } else if (reportPaymentMethod === 'Credit') {
      matchesMethod = pm === 'credit' || (s.paymentMethod === 'Split' && !!s.splitDetails?.credit);
    } else if (reportPaymentMethod === 'Bank CBE') {
      matchesMethod = pm.includes('cbe') || (s.paymentMethod === 'Split' && !!s.splitDetails?.cbe);
    } else if (reportPaymentMethod === 'Bank BOA') {
      matchesMethod = pm.includes('boa') || (s.paymentMethod === 'Split' && !!s.splitDetails?.boa);
    } else if (reportPaymentMethod === 'Bank AWASH') {
      matchesMethod = pm.includes('awash') || (s.paymentMethod === 'Split' && !!s.splitDetails?.awash);
    } else if (reportPaymentMethod === 'Bank DASHEN') {
      matchesMethod = pm.includes('dashen') || (s.paymentMethod === 'Split' && !!s.splitDetails?.dashen);
    } else if (reportPaymentMethod === 'Telebirr') {
      matchesMethod = pm.includes('telebirr') || (s.paymentMethod === 'Split' && (!!s.splitDetails?.telebirr || !!s.splitDetails?.mobile));
    } else if (reportPaymentMethod === 'Other') {
      matchesMethod = pm === 'other' || 
        (s.paymentMethod === 'Split' && !!s.splitDetails?.other) ||
        (pm.startsWith('bank:') && !pm.includes('cbe') && !pm.includes('boa') && !pm.includes('awash') && !pm.includes('dashen'));
    } else {
      matchesMethod = s.paymentMethod === reportPaymentMethod || pm.includes(reportPaymentMethod.toLowerCase());
    }
    // B. Filter by Date using normalized date string matching
    const saleDate = getSaleDateStr(s.date);
    const matchesDate = !reportDate || saleDate === reportDate.trim();
    // C. Filter by Branch
    const matchesBranch = checkSaleMatchesBranch(s, reportBranchId);
    // D. Filter by Cashier / User without mixing across branches
    const matchesCashier = (() => {
      if (!reportCashierName || reportCashierName === 'all') return true;
      if (reportCashierName.includes(':::')) {
        const [cKey, bKey] = reportCashierName.split(':::');
        const matchesIdent = 
          (s.cashierId && String(s.cashierId).trim() === cKey.trim()) ||
          (s.cashierName && s.cashierName.trim().toLowerCase() === cKey.trim().toLowerCase());
        const matchesB = checkSaleMatchesBranch(s, bKey);
        return matchesIdent && matchesB;
      }
      // Fallback matching
      const matchesIdent = 
        (s.cashierName && s.cashierName.trim().toLowerCase() === reportCashierName.trim().toLowerCase()) ||
        (s.cashierId && String(s.cashierId).trim() === String(reportCashierName).trim());
      return matchesIdent;
    })();
    // E. Filter by Order Channel / Source (In-Store POS vs Online Order)
    const isOnline = Boolean(s.isOnlineOrder || s.orderSource === 'Online Store' || s.orderSource?.toLowerCase().includes('online'));
    const matchesChannel = reportChannel === 'all' || 
      (reportChannel === 'online' && isOnline) || 
      (reportChannel === 'instore' && !isOnline);

    return matchesMethod && matchesDate && matchesBranch && matchesCashier && matchesChannel;
  });

  // Calculate separate medicine-only daily filtered sales
  const medicineDailyFilteredSales = baseDailyReportSales.map(s => {
    const filteredItems = s.items.filter(item => !checkIsCosmeticMed(item.medicineId));
    if (filteredItems.length === 0) return null;
    
    const isExcludedFromSums = s.status === 'Voided' || s.status === 'Returned';

    let subtotal = s.subtotal;
    let discount = s.discount || 0;
    let vat = s.vat || 0;
    let total = s.total;

    if (filteredItems.length < s.items.length) {
      subtotal = filteredItems.reduce((acc, x) => acc + (x.unitPrice * x.quantity), 0);
      const originalSubtotal = s.subtotal || s.items.reduce((acc, x) => acc + (x.unitPrice * x.quantity), 0) || 1;
      const ratio = subtotal / originalSubtotal;
      discount = (s.discount || 0) * ratio;
      vat = filteredItems.reduce((acc, x) => acc + (x.vatAmount || 0), 0);
      total = Math.max(0, subtotal - discount + vat);
    }

    // Split-payment portion allocation
    if (s.paymentMethod === 'Split' && reportPaymentMethod !== 'all') {
      let portion = 0;
      if (reportPaymentMethod === 'Cash') portion = s.splitDetails?.cash || 0;
      else if (reportPaymentMethod === 'Bank') portion = (s.splitDetails?.cbe || 0) + (s.splitDetails?.boa || 0) + (s.splitDetails?.awash || 0) + (s.splitDetails?.dashen || 0) + (s.splitDetails?.other || 0);
      else if (reportPaymentMethod === 'Card') portion = s.splitDetails?.card || 0;
      else if (reportPaymentMethod === 'Credit') portion = s.splitDetails?.credit || 0;
      else if (reportPaymentMethod === 'Bank CBE') portion = s.splitDetails?.cbe || 0;
      else if (reportPaymentMethod === 'Bank BOA') portion = s.splitDetails?.boa || 0;
      else if (reportPaymentMethod === 'Bank AWASH') portion = s.splitDetails?.awash || 0;
      else if (reportPaymentMethod === 'Bank DASHEN') portion = s.splitDetails?.dashen || 0;
      else if (reportPaymentMethod === 'Telebirr') portion = s.splitDetails?.telebirr || s.splitDetails?.mobile || 0;
      else if (reportPaymentMethod === 'Other') portion = s.splitDetails?.other || 0;

      if (total > 0 && s.total > 0) {
        const ratio = portion / s.total;
        total = total * ratio;
      } else {
        total = portion;
      }
    }

    return {
      ...s,
      items: filteredItems,
      subtotal,
      discount,
      vat,
      total,
      isExcludedFromSums
    };
  }).filter(Boolean) as any[];

  // Calculate separate cosmetics-only daily filtered sales
  const cosmeticsDailyFilteredSales = baseDailyReportSales.map(s => {
    const filteredItems = s.items.filter(item => checkIsCosmeticMed(item.medicineId));
    if (filteredItems.length === 0) return null;
    
    const isExcludedFromSums = s.status === 'Voided' || s.status === 'Returned';

    let subtotal = s.subtotal;
    let discount = s.discount || 0;
    let vat = s.vat || 0;
    let total = s.total;

    if (filteredItems.length < s.items.length) {
      subtotal = filteredItems.reduce((acc, x) => acc + (x.unitPrice * x.quantity), 0);
      const originalSubtotal = s.subtotal || s.items.reduce((acc, x) => acc + (x.unitPrice * x.quantity), 0) || 1;
      const ratio = subtotal / originalSubtotal;
      discount = (s.discount || 0) * ratio;
      vat = filteredItems.reduce((acc, x) => acc + (x.vatAmount || 0), 0);
      total = Math.max(0, subtotal - discount + vat);
    }

    // Split-payment portion allocation
    if (s.paymentMethod === 'Split' && reportPaymentMethod !== 'all') {
      let portion = 0;
      if (reportPaymentMethod === 'Cash') portion = s.splitDetails?.cash || 0;
      else if (reportPaymentMethod === 'Bank') portion = (s.splitDetails?.cbe || 0) + (s.splitDetails?.boa || 0) + (s.splitDetails?.awash || 0) + (s.splitDetails?.dashen || 0) + (s.splitDetails?.other || 0);
      else if (reportPaymentMethod === 'Card') portion = s.splitDetails?.card || 0;
      else if (reportPaymentMethod === 'Credit') portion = s.splitDetails?.credit || 0;
      else if (reportPaymentMethod === 'Bank CBE') portion = s.splitDetails?.cbe || 0;
      else if (reportPaymentMethod === 'Bank BOA') portion = s.splitDetails?.boa || 0;
      else if (reportPaymentMethod === 'Bank AWASH') portion = s.splitDetails?.awash || 0;
      else if (reportPaymentMethod === 'Bank DASHEN') portion = s.splitDetails?.dashen || 0;
      else if (reportPaymentMethod === 'Telebirr') portion = s.splitDetails?.telebirr || s.splitDetails?.mobile || 0;
      else if (reportPaymentMethod === 'Other') portion = s.splitDetails?.other || 0;

      if (total > 0 && s.total > 0) {
        const ratio = portion / s.total;
        total = total * ratio;
      } else {
        total = portion;
      }
    }

    return {
      ...s,
      items: filteredItems,
      subtotal,
      discount,
      vat,
      total,
      isExcludedFromSums
    };
  }).filter(Boolean) as any[];

  // General combined / selected category daily filtered sales (for original table and indicators)
  const dailyReportFilteredSales = baseDailyReportSales.map(s => {
    const filteredItems = s.items.filter(item => {
      const isCosmetic = checkIsCosmeticMed(item.medicineId);
      if (reportCategory === 'medicine') return !isCosmetic;
      if (reportCategory === 'cosmetics') return isCosmetic;
      return true;
    });
    
    if (filteredItems.length === 0) return null;
    
    const isExcludedFromSums = s.status === 'Voided' || s.status === 'Returned';

    let subtotal = s.subtotal;
    let discount = s.discount || 0;
    let vat = s.vat || 0;
    let total = s.total;

    if (filteredItems.length < s.items.length) {
      subtotal = filteredItems.reduce((acc, x) => acc + (x.unitPrice * x.quantity), 0);
      const originalSubtotal = s.subtotal || s.items.reduce((acc, x) => acc + (x.unitPrice * x.quantity), 0) || 1;
      const ratio = subtotal / originalSubtotal;
      discount = (s.discount || 0) * ratio;
      vat = filteredItems.reduce((acc, x) => acc + (x.vatAmount || 0), 0);
      total = Math.max(0, subtotal - discount + vat);
    }

    // Split-payment portion allocation
    let displayTotal = total;
    let displayVat = vat;
    if (s.paymentMethod === 'Split' && reportPaymentMethod !== 'all') {
      let portion = 0;
      if (reportPaymentMethod === 'Cash') portion = s.splitDetails?.cash || 0;
      else if (reportPaymentMethod === 'Bank') portion = (s.splitDetails?.cbe || 0) + (s.splitDetails?.boa || 0) + (s.splitDetails?.awash || 0) + (s.splitDetails?.dashen || 0) + (s.splitDetails?.other || 0);
      else if (reportPaymentMethod === 'Card') portion = s.splitDetails?.card || 0;
      else if (reportPaymentMethod === 'Credit') portion = s.splitDetails?.credit || 0;
      else if (reportPaymentMethod === 'Bank CBE') portion = s.splitDetails?.cbe || 0;
      else if (reportPaymentMethod === 'Bank BOA') portion = s.splitDetails?.boa || 0;
      else if (reportPaymentMethod === 'Bank AWASH') portion = s.splitDetails?.awash || 0;
      else if (reportPaymentMethod === 'Bank DASHEN') portion = s.splitDetails?.dashen || 0;
      else if (reportPaymentMethod === 'Telebirr') portion = s.splitDetails?.telebirr || s.splitDetails?.mobile || 0;
      else if (reportPaymentMethod === 'Other') portion = s.splitDetails?.other || 0;

      if (s.total > 0) {
        const ratio = portion / s.total;
        displayTotal = total * ratio;
        displayVat = vat * ratio;
      } else {
        displayTotal = portion;
        displayVat = 0;
      }
    }

    return {
      ...s,
      items: filteredItems,
      subtotal,
      discount,
      vat: displayVat,
      total: displayTotal,
      isExcludedFromSums
    };
  }).filter(Boolean) as any[];

  // Cumulative metrics for filtered report (original) - properly excluding Voided / Returned invoices
  const reportTotalRevenue = dailyReportFilteredSales.reduce((acc, s) => acc + (s.isExcludedFromSums ? 0 : s.total), 0);
  const reportTotalTax = dailyReportFilteredSales.reduce((acc, s) => acc + (s.isExcludedFromSums ? 0 : s.vat), 0);
  const reportSalesCount = dailyReportFilteredSales.filter(s => !s.isExcludedFromSums).length;
  const reportTotalItemsSold = dailyReportFilteredSales.reduce((acc, s) => acc + (s.isExcludedFromSums ? 0 : s.items.reduce((acc2, i) => acc2 + i.quantity, 0)), 0);

  // Medicine separate metrics
  const medicineOnlyRevenue = medicineDailyFilteredSales.reduce((acc, s) => acc + (s.isExcludedFromSums ? 0 : s.total), 0);
  const medicineOnlyTax = medicineDailyFilteredSales.reduce((acc, s) => acc + (s.isExcludedFromSums ? 0 : s.vat), 0);
  const medicineOnlySalesCount = medicineDailyFilteredSales.filter(s => !s.isExcludedFromSums).length;
  const medicineOnlyItemsSold = medicineDailyFilteredSales.reduce((acc, s) => acc + (s.isExcludedFromSums ? 0 : s.items.reduce((acc2, i) => acc2 + i.quantity, 0)), 0);

  // Cosmetics separate metrics
  const cosmeticsOnlyRevenue = cosmeticsDailyFilteredSales.reduce((acc, s) => acc + (s.isExcludedFromSums ? 0 : s.total), 0);
  const cosmeticsOnlyTax = cosmeticsDailyFilteredSales.reduce((acc, s) => acc + (s.isExcludedFromSums ? 0 : s.vat), 0);
  const cosmeticsOnlySalesCount = cosmeticsDailyFilteredSales.filter(s => !s.isExcludedFromSums).length;
  const cosmeticsOnlyItemsSold = cosmeticsDailyFilteredSales.reduce((acc, s) => acc + (s.isExcludedFromSums ? 0 : s.items.reduce((acc2, i) => acc2 + i.quantity, 0)), 0);

  // Online Orders Sold metrics
  const onlineOnlySales = dailyReportFilteredSales.filter(s => s.isOnlineOrder || s.orderSource === 'Online Store' || s.orderSource?.toLowerCase().includes('online'));
  const onlineOnlyRevenue = onlineOnlySales.reduce((acc, s) => acc + (s.isExcludedFromSums ? 0 : s.total), 0);
  const onlineOnlyTax = onlineOnlySales.reduce((acc, s) => acc + (s.isExcludedFromSums ? 0 : s.vat), 0);
  const onlineOnlySalesCount = onlineOnlySales.filter(s => !s.isExcludedFromSums).length;
  const onlineOnlyItemsSold = onlineOnlySales.reduce((acc, s) => acc + (s.isExcludedFromSums ? 0 : s.items.reduce((acc2, i) => acc2 + i.quantity, 0)), 0);

  // CSV Exporters
  const exportDashboardSummaryToCSV = () => {
    let csv = "KPI Metric,Value (ETB/Count),Description\n";
    csv += `"Consolidated Revenue",${totalSalesVolume.toFixed(2)},"Total gross revenue collected based on filters"\n`;
    csv += `"Outstanding Supplier Debt",${outstandingSupplierDebt.toFixed(2)},"Outstanding accounts payable to suppliers"\n`;
    csv += `"VAT Liability (15%)",${totalSalesTax.toFixed(2)},"Output VAT collected on taxable transactions"\n`;
    csv += `"Expired Batches Alert",${expiredBatches.length},"Total inventory batches currently past expiration"\n`;
    csv += `"Low Stock Safety Triggers",${lowStockItems.length},"Batches currently equal or below minimum safety levels"\n`;
    csv += `\nPayment Method Shares\n`;
    csv += `"Cash Receipts",${cashSales.toFixed(2)}\n`;
    csv += `"POS Cards",${cardSales.toFixed(2)}\n`;
    csv += `"Client Credit",${creditSales.toFixed(2)}\n`;
    csv += `"Bank CBE",${bankCBESales.toFixed(2)}\n`;
    csv += `"Bank BOA",${bankBOASales.toFixed(2)}\n`;
    csv += `"Bank AWASH",${bankAwashSales.toFixed(2)}\n`;
    csv += `"Bank DASHEN",${bankDashenSales.toFixed(2)}\n`;
    csv += `"Split Payment Mode",${splitSales.toFixed(2)}\n`;
    csv += `"Other Methods",${otherSales.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `enterprise_dashboard_summary_${dashboardCategory}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportExpiryToCSV = () => {
    let csv = "Batch Status,Product Name,Batch Number,Expiry Date,Location Branch,Current Stock Qty,Buying Price (ETB),Total Cost Value (ETB)\n";
    
    expiredBatches.forEach(st => {
      const med = medicines.find(m => m.id === st.medicineId);
      const branchName = branches.find(b => b.id === st.branchId)?.name || st.branchId;
      const costPrice = st.buyingPrice || med?.buyingPrice || 0;
      const totalCost = st.quantity * costPrice;
      csv += `"EXPIRED","${(med?.name || 'Unknown').replace(/"/g, '""')}","${st.batchNumber}","${st.expiryDate}","${branchName}",${st.quantity},${costPrice.toFixed(2)},${totalCost.toFixed(2)}\n`;
    });

    expiringSoonBatches.forEach(st => {
      const med = medicines.find(m => m.id === st.medicineId);
      const branchName = branches.find(b => b.id === st.branchId)?.name || st.branchId;
      const costPrice = st.buyingPrice || med?.buyingPrice || 0;
      const totalCost = st.quantity * costPrice;
      csv += `"EXPIRING SOON","${(med?.name || 'Unknown').replace(/"/g, '""')}","${st.batchNumber}","${st.expiryDate}","${branchName}",${st.quantity},${costPrice.toFixed(2)},${totalCost.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Enterprise_Expiry_Risk_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportDailyReportToCSV = () => {
    let csv = "Invoice Number,Date,Time,Branch Name,Cashier Name,Order Source,Payment Route,Customer Name,Customer TIN,Subtotal (ETB),Applied Discount (ETB),VAT Amount (ETB),Grand Total (ETB),Line Items Details\n";
    dailyReportFilteredSales.forEach(s => {
      const itemsDetail = s.items.map(i => `${i.medicineName} (Qty: ${i.quantity} @ ${i.unitPrice} ETB)`).join(" | ");
      const source = (s.isOnlineOrder || s.orderSource === 'Online Store' || s.orderSource?.toLowerCase().includes('online')) ? 'Online Store' : 'In-Store POS';
      csv += `"${s.invoiceNumber}","${s.date}","${s.time}","${s.branchName}","${s.cashierName || 'N/A'}","${source}","${s.paymentMethod}","${s.customerName || 'Walk-In Customer'}","${s.customerTin || 'N/A'}",${s.subtotal.toFixed(2)},${s.discount.toFixed(2)},${s.vat.toFixed(2)},${s.total.toFixed(2)},"${itemsDetail}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const branchNamePart = reportBranchId === 'all' ? 'All_Branches' : (branches.find(b => b.id === reportBranchId)?.name || reportBranchId).replace(/\s+/g, '_');
    link.download = `daily_sales_report_${branchNamePart}_${reportDate}_${reportCategory}_${reportPaymentMethod}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportBestSellersToCSV = () => {
    let csv = "Product Name,Category,Quantity Sold,Total Revenue (ETB)\n";
    sortedMeds.forEach(m => {
      csv += `"${m.name}","${m.category}",${m.count},${m.value.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `product_velocity_ranking_${dashboardCategory}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportBranchPerformancesToCSV = () => {
    let csv = "Branch Name,Branch Code,Sales Count,Stock Level,Outstanding Revenue (ETB)\n";
    branchPerformances.forEach(bp => {
      csv += `"${bp.name}","${bp.code}",${bp.salesCount},${bp.stockCount},${bp.revenue.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `branch_ledger_performances.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Recharts Data Aggregation for Monthly Sales Trends & Branch Comparison
  const monthlySalesData = (() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const counts: { [key: string]: { month: string; revenue: number; transactions: number } } = {};
    
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const tempDate = new Date();
      tempDate.setMonth(d.getMonth() - i);
      const mName = monthNames[tempDate.getMonth()];
      const year = tempDate.getFullYear();
      const key = `${year}-${tempDate.getMonth() + 1}`;
      counts[key] = { month: `${mName} ${year}`, revenue: 0, transactions: 0 };
    }

    sales.forEach(s => {
      if (!s.date) return;
      const sDate = new Date(s.date);
      if (isNaN(sDate.getTime())) return;
      const monthIdx = sDate.getMonth();
      const year = sDate.getFullYear();
      const key = `${year}-${monthIdx + 1}`;
      
      if (counts[key]) {
        counts[key].revenue += s.total;
        counts[key].transactions += 1;
      } else {
        const mName = monthNames[monthIdx];
        counts[key] = { month: `${mName} ${year}`, revenue: s.total, transactions: 1 };
      }
    });

    return Object.values(counts);
  })();

  const rechartsBranchData = branchPerformances.map((bp, idx) => ({
    name: bp.name,
    code: bp.code,
    revenue: bp.revenue,
    salesCount: bp.salesCount,
    color: idx === 0 ? '#10b981' : idx === 1 ? '#3b82f6' : '#f59e0b'
  }));

  // 3-Month Sales Velocity & Stock Requirement Prediction Calculation
  const predictiveStockData = (() => {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    // Map to hold quantities sold per medicine over 3 distinct 30-day windows
    const salesByMed: { [medId: string]: { m1: number; m2: number; m3: number; total3m: number } } = {};

    filteredSalesByCat.forEach(s => {
      if (!s.date) return;
      const saleDate = new Date(s.date);
      if (isNaN(saleDate.getTime()) || saleDate < ninetyDaysAgo) return;

      s.items.forEach(item => {
        if (!salesByMed[item.medicineId]) {
          salesByMed[item.medicineId] = { m1: 0, m2: 0, m3: 0, total3m: 0 };
        }
        salesByMed[item.medicineId].total3m += item.quantity;
        if (saleDate >= ninetyDaysAgo && saleDate < sixtyDaysAgo) {
          salesByMed[item.medicineId].m1 += item.quantity;
        } else if (saleDate >= sixtyDaysAgo && saleDate < thirtyDaysAgo) {
          salesByMed[item.medicineId].m2 += item.quantity;
        } else if (saleDate >= thirtyDaysAgo) {
          salesByMed[item.medicineId].m3 += item.quantity;
        }
      });
    });

    // Compute stock velocity and predictive demand for each medicine
    const results = filteredMedicinesByCat.map(med => {
      const salesData = salesByMed[med.id] || { m1: 0, m2: 0, m3: 0, total3m: 0 };
      
      // Calculate current total stock on hand for this medicine across active branches
      const currentStock = filteredStockItemsByCat
        .filter(st => st.medicineId === med.id && !st.isDamaged)
        .reduce((sum, st) => sum + st.quantity, 0);

      // Monthly sales velocity (average units sold per month over 3 months)
      const monthlyVelocity = salesData.total3m > 0 
        ? Math.round((salesData.total3m / 3) * 10) / 10 
        : 0;

      const dailyVelocity = monthlyVelocity / 30;

      // Projected demand based on forecast horizon
      const forecastDemand = Math.ceil(monthlyVelocity * forecastHorizonMonths);

      // Days of stock remaining based on daily velocity
      const daysOfStockLeft = dailyVelocity > 0 ? Math.round(currentStock / dailyVelocity) : (currentStock > 0 ? 999 : 0);

      // Recommended reorder stock need to cover demand horizon + safety stock buffer
      const targetBuffer = med.minStockLevel || 10;
      const reorderNeeded = Math.max(0, Math.ceil((forecastDemand + targetBuffer) - currentStock));

      return {
        id: med.id,
        name: med.name.length > 20 ? med.name.substring(0, 18) + '...' : med.name,
        fullName: med.name,
        category: med.category || 'General',
        unit: med.unit || 'units',
        currentStock,
        monthlyVelocity,
        m1Sales: salesData.m1,
        m2Sales: salesData.m2,
        m3Sales: salesData.m3,
        total3mSales: salesData.total3m,
        forecastDemand,
        reorderNeeded,
        daysOfStockLeft,
        minStockLevel: targetBuffer
      };
    });

    // Filter based on user-selected mode
    let filtered = [...results];
    if (predictiveFilterMode === 'critical') {
      filtered = filtered.filter(item => item.reorderNeeded > 0 || item.daysOfStockLeft <= 30 || item.currentStock <= item.minStockLevel);
      filtered.sort((a, b) => b.reorderNeeded - a.reorderNeeded || a.daysOfStockLeft - b.daysOfStockLeft);
    } else if (predictiveFilterMode === 'velocity') {
      filtered.sort((a, b) => b.monthlyVelocity - a.monthlyVelocity);
    } else {
      filtered.sort((a, b) => b.forecastDemand - a.forecastDemand);
    }

    return filtered.slice(0, 12);
  })();

  const totalPredictiveDeficitUnits = predictiveStockData.reduce((acc, item) => acc + item.reorderNeeded, 0);
  const totalForecastDemandUnits = predictiveStockData.reduce((acc, item) => acc + item.forecastDemand, 0);
  const criticalStockoutCount = predictiveStockData.filter(item => item.daysOfStockLeft <= 14).length;

  const exportPredictiveReorderToCSV = () => {
    let csv = "Medicine Name,Category,Current Stock,3-Month Sales Total,Avg Monthly Velocity,Projected Demand,Min Safety Buffer,Recommended Reorder Qty,Est. Days Stock Left\n";
    predictiveStockData.forEach(item => {
      csv += `"${item.fullName}","${item.category}",${item.currentStock},${item.total3mSales},${item.monthlyVelocity},${item.forecastDemand},${item.minStockLevel},${item.reorderNeeded},${item.daysOfStockLeft === 999 ? '999+' : item.daysOfStockLeft}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `3Month_Velocity_Predictive_Reorder_Plan_${forecastHorizonMonths}Mo.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isRegularUser = currentUser?.role !== 'Super Administrator' && currentUser?.role !== 'Auditor';

  if (isRegularUser) {
    const mySalesToday = salesPool.filter(s => {
      const matchesUser = (currentUser?.id && s.cashierId === currentUser.id) ||
        (currentUser?.name && s.cashierName?.trim().toLowerCase() === currentUser.name.trim().toLowerCase());
      const matchesBranch = !currentUser?.branchId || currentUser.branchId === 'all' || checkSaleMatchesBranch(s, currentUser.branchId);

      return matchesUser &&
        matchesBranch &&
        isSaleToday(s.date) &&
        s.status !== 'Voided' &&
        s.status !== 'Returned';
    });
    const mySalesVolumeToday = mySalesToday.reduce((acc, s) => acc + s.total, 0);
    const mySalesCountToday = mySalesToday.length;
    
    // Combine expired and soon expiring
    const allNearExpiry = [...expiredBatches, ...expiringSoonBatches];

    return (
      <div id="user-dashboard" className="space-y-6">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 rounded-2xl text-white shadow-md">
          <h1 className="text-xl font-sans font-extrabold flex items-center gap-2">
            <Sparkles className="h-5.5 w-5.5 animate-pulse" />
            Welcome back, {currentUser?.name || 'User'}!
          </h1>
          <p className="text-xs text-emerald-100 mt-1 font-semibold">
            Logged in as <span className="underline font-bold">{currentUser?.role}</span> &bull; Today's Date: {todayStr}
          </p>
        </div>

        {/* Simplified KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-150 p-5 rounded-xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">My Sales Today</span>
              <span className="text-lg font-mono font-bold text-gray-900 block">{mySalesVolumeToday.toLocaleString()} ETB</span>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">Gross daily revenue</span>
            </div>
          </div>

          <div className="bg-white border border-gray-150 p-5 rounded-xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600 shrink-0">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Invoices Issued Today</span>
              <span className="text-lg font-mono font-bold text-gray-900 block">{mySalesCountToday} Sales</span>
              <span className="text-[10px] text-blue-600 font-semibold mt-0.5 block">Completed POS checkouts</span>
            </div>
          </div>

          <div className="bg-white border border-gray-150 p-5 rounded-xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-lg text-amber-600 shrink-0">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Critical Expiry Alerts</span>
              <span className="text-lg font-mono font-bold text-gray-900 block">{allNearExpiry.length} Batches</span>
              <span className="text-[10px] text-amber-600 font-semibold mt-0.5 block">Expired or within 180 days</span>
            </div>
          </div>
        </div>

        {/* 2-Column Section for My Sales and Near Expiry */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column A: Today's Sales List */}
          <div className="bg-white border border-gray-150 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-150 bg-gray-50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-800 flex items-center gap-2">
                <ShoppingCart className="h-4.5 w-4.5 text-emerald-600" />
                My Sales Logs (Today)
              </h3>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                Active Session
              </span>
            </div>
            
            <div className="overflow-x-auto flex-1 max-h-[400px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-150 font-bold text-gray-650">
                    <th className="p-3">Invoice</th>
                    <th className="p-3">Time</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3 text-right">Amount (ETB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-semibold text-gray-750">
                  {mySalesToday.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50/75">
                      <td className="p-3 font-mono text-gray-900">{s.invoiceNumber}</td>
                      <td className="p-3 text-gray-500">{s.time}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          s.paymentMethod === 'Cash' ? 'bg-green-100 text-green-800 border border-green-200' :
                          s.paymentMethod === 'Credit' ? 'bg-red-100 text-red-800 border border-red-200' :
                          'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {s.paymentMethod}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-gray-900 font-bold">{s.total.toLocaleString()}</td>
                    </tr>
                  ))}
                  {mySalesToday.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-400 italic">
                        No sales recorded by you today yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Column B: Near Expiry List */}
          <div className="bg-white border border-gray-150 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-150 bg-gray-50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-800 flex items-center gap-2">
                <AlertCircle className="h-4.5 w-4.5 text-amber-500" />
                Near Expiry &amp; Expired Inventory Batches
              </h3>
              <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2.5 py-0.5 rounded-full">
                Attention Required
              </span>
            </div>

            <div className="overflow-x-auto flex-1 max-h-[400px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-150 font-bold text-gray-650">
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Batch Number</th>
                    <th className="p-3 text-center">Expiry</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-semibold text-gray-750">
                  {allNearExpiry.map(st => {
                    const med = medicines.find(m => m.id === st.medicineId);
                    const isExpired = st.expiryDate < todayStr;
                    return (
                      <tr key={st.id} className="hover:bg-gray-50/75">
                        <td className="p-3 text-gray-900 font-bold">
                          {med?.name || 'Unknown Item'}
                          <span className="text-[9px] text-gray-400 block font-normal">Branch: {branches.find(b => b.id === st.branchId)?.name || st.branchId}</span>
                        </td>
                        <td className="p-3 font-mono text-gray-500">{st.batchNumber}</td>
                        <td className="p-3 text-center font-mono">{st.expiryDate}</td>
                        <td className="p-3 text-center">
                          {isExpired ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 uppercase">
                              Expired
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                              Soon
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono text-gray-900 font-bold">{st.quantity}</td>
                      </tr>
                    );
                  })}
                  {allNearExpiry.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                        No critical near-expiry items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="enterprise-dashboard" className="space-y-6">
      
      {/* Customer Online Store Link & Social Sharing Card */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-3.5 sm:p-5 rounded-2xl shadow-md border border-emerald-500/30 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-800/60 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 sm:p-2.5 bg-emerald-500/20 border border-emerald-400/30 rounded-xl shrink-0">
              <ShoppingBag className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-extrabold text-xs sm:text-sm text-white">Customer Online Store Portal</h3>
                <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 text-[9px] font-extrabold rounded-full uppercase tracking-wider">
                  Live
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/80 leading-tight">
                Public customer web catalog for remote orders.
              </p>
            </div>
          </div>

          {/* Quick Controls: Branch Selector & Primary Actions */}
          <div className="flex flex-wrap items-center gap-1.5">
            {branches.length > 0 && (
              <select
                value={shareBranchId}
                onChange={(e) => setShareBranchId(e.target.value)}
                className="bg-slate-800/90 text-emerald-100 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-500/30 outline-none focus:ring-1 focus:ring-emerald-400"
              >
                <option value="all">🏬 All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>📍 {b.name}</option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => handleCopyStoreLink()}
              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] rounded-lg shadow-xs transition flex items-center space-x-1 cursor-pointer min-h-[36px]"
            >
              {copiedStoreLink ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedStoreLink ? 'Copied!' : 'Copy Link'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenQrModal()}
              className="px-2.5 py-1.5 bg-emerald-400/20 hover:bg-emerald-400/30 text-emerald-200 font-bold text-[11px] rounded-lg border border-emerald-400/30 transition flex items-center space-x-1 cursor-pointer min-h-[36px]"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-300" />
              <span>QR Code</span>
            </button>

            <a
              href={getPublicStoreUrl()}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] rounded-lg transition flex items-center space-x-1 border border-white/20 min-h-[36px]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open</span>
            </a>
          </div>
        </div>

        {/* Display URL Box and Social Share Buttons Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-950/60 p-2 sm:p-2.5 rounded-xl border border-emerald-900/60">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] font-mono font-bold text-emerald-200 truncate select-all">
              {getPublicStoreUrl()}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 overflow-x-auto py-0.5">
            <button
              type="button"
              onClick={() => shareStoreToPlatform('whatsapp')}
              className="px-2 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 text-[10px] font-bold rounded-md border border-emerald-500/40 flex items-center space-x-1 transition cursor-pointer"
              title="Share to WhatsApp"
            >
              <MessageSquare className="w-3 h-3 text-emerald-400" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => shareStoreToPlatform('telegram')}
              className="px-2 py-1 bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 text-[10px] font-bold rounded-md border border-sky-500/40 flex items-center space-x-1 transition cursor-pointer"
              title="Share to Telegram"
            >
              <Send className="w-3 h-3 text-sky-400" />
              <span>Telegram</span>
            </button>

            <button
              type="button"
              onClick={() => shareStoreToPlatform('facebook')}
              className="px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 text-[10px] font-bold rounded-md border border-blue-500/40 flex items-center space-x-1 transition cursor-pointer"
              title="Share to Facebook"
            >
              <Share2 className="w-3 h-3 text-blue-400" />
              <span>Facebook</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Controls: Dynamic Filtering & Excel Exporter */}
      <div className="bg-white border border-gray-150 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-sans font-extrabold text-gray-900 flex items-center gap-2">
            <Filter className="h-4.5 w-4.5 text-emerald-600" />
            Enterprise Analytical Category Control
          </h2>
          <p className="text-[11px] text-gray-500">
            Dynamically adjust the entire dashboard analytics and metrics to view specific product classifications.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Branch Filter Dropdown */}
          {branches.length > 0 && (
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg p-1 text-xs font-semibold">
              <span className="text-[10px] text-gray-500 font-bold px-1 uppercase tracking-wider">Branch:</span>
              <select
                value={reportBranchId}
                onChange={(e) => setReportBranchId(e.target.value)}
                className="bg-white border border-gray-200 text-gray-800 text-xs font-bold px-2.5 py-1 rounded-md outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-sm"
              >
                <option value="all">🏬 All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>📍 {b.name} ({b.code})</option>
                ))}
              </select>
            </div>
          )}

          {/* Category Toggle Buttons */}
          <div className="flex bg-gray-100 rounded-lg p-1 text-xs font-semibold">
            <button
              onClick={() => setDashboardCategory('all')}
              className={`py-1.5 px-3 rounded-md transition-all ${
                dashboardCategory === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              All Stocks
            </button>
            <button
              onClick={() => setDashboardCategory('medicine')}
              className={`py-1.5 px-3 rounded-md transition-all ${
                dashboardCategory === 'medicine' ? 'bg-white text-emerald-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Medicines Only
            </button>
            <button
              onClick={() => setDashboardCategory('cosmetics')}
              className={`py-1.5 px-3 rounded-md transition-all ${
                dashboardCategory === 'cosmetics' ? 'bg-white text-pink-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Cosmetics Only
            </button>
          </div>

          <button
            onClick={exportDashboardSummaryToCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-1.5 px-3 rounded shadow flex items-center gap-1.5 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export Dashboard CSV
          </button>
        </div>
      </div>

      {/* Critical Expiry & Stock Safety Alarms */}
      {(expiredBatches.length > 0 || outOfStockMeds.length > 0) && (
        <div 
          onClick={() => {
            if (expiredBatches.length > 0) {
              setShowExpiryModal(true);
            }
          }}
          className="bg-red-50 hover:bg-red-100 border border-red-150 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer transition-all shadow-sm group"
        >
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg text-red-700 group-hover:scale-105 transition-transform">
              <ShieldAlert className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-red-950 uppercase tracking-wide flex items-center gap-2">
                Critical Safety &amp; Expiration Alarms
                <span className="text-[9px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">Click to View &amp; Export Expiry List</span>
              </h3>
              <p className="text-[11px] text-red-700 leading-normal mt-0.5">
                We detected {expiredBatches.length} expired or expiring-soon (&lt; 180 days) batches blocked from POS dispensing, and {outOfStockMeds.length} items completely out of stock.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <span className="text-[10px] font-bold bg-red-150 text-red-900 px-2.5 py-1 rounded border border-red-200">
              {expiredBatches.length} Expirations
            </span>
            <span className="text-[10px] font-bold bg-red-150 text-red-900 px-2.5 py-1 rounded border border-red-200">
              {outOfStockMeds.length} Out of Stock
            </span>
          </div>
        </div>
      )}

      {/* Enterprise Statistics Grid (Modern, Decorative KPI Views) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Decorative Today's Sales KPI */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/10 border border-amber-200 p-5 rounded-xl space-y-3 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider">Today's Sales</span>
            <div className="bg-amber-100 text-amber-700 p-1.5 rounded-lg">
              <CalendarClock className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-sans font-black tracking-tight text-amber-800">
              {todaysSalesVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-bold text-amber-500">ETB</span>
            </h3>
            <span className="text-[10px] text-amber-700 font-bold block flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              Today's Volume Receipts
            </span>
          </div>
        </div>

        {/* Decorative Daily Net Profit KPI */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/20 border border-emerald-200 p-5 rounded-xl space-y-3 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider">Daily Net Profit</span>
            <div className="bg-emerald-100 text-emerald-700 p-1.5 rounded-lg">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-sans font-black tracking-tight text-emerald-600">
              {dailyNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-bold text-emerald-400">ETB</span>
            </h3>
            <span className="text-[10px] text-emerald-700 font-bold block flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-emerald-500 animate-spin" />
              Margin: <span className="font-mono text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded-md font-extrabold">{dailyProfitMargin.toFixed(1)}%</span>
            </span>
          </div>
        </div>

        {/* Interactive Expiry Risk KPI */}
        <div 
          onClick={() => setShowExpiryModal(true)}
          className="bg-gradient-to-br from-red-50 to-rose-50/10 border border-red-200 p-5 rounded-xl space-y-3 shadow-sm hover:border-red-400 hover:shadow-md cursor-pointer transition-all group"
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-extrabold text-red-900 uppercase tracking-wider">Expiry Risk</span>
            <div className="bg-red-100 text-red-700 p-1.5 rounded-lg group-hover:scale-110 transition-transform">
              <AlertOctagon className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-sans font-black tracking-tight text-red-600">
              {expiredBatches.length + expiringSoonBatches.length} <span className="text-[10px] font-bold text-gray-400">batches</span>
            </h3>
            <span className="text-[10px] text-red-700 font-bold block flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping"></span>
              {expiredBatches.length} Expired - Click to Export
            </span>
          </div>
        </div>

        {/* Decorative Monthly Profit KPI */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/20 border border-blue-200 p-5 rounded-xl space-y-3 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-extrabold text-blue-900 uppercase tracking-wider">Monthly Profit</span>
            <div className="bg-blue-100 text-blue-700 p-1.5 rounded-lg">
              <LineChart className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-sans font-black tracking-tight text-blue-600">
              {monthlyNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-bold text-blue-400">ETB</span>
            </h3>
            <span className="text-[10px] text-blue-700 font-bold block flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Current Month Net (Est.)
            </span>
          </div>
        </div>

      </div>

      {/* Recharts Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
        
        {/* Monthly Sales Trend AreaChart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-150 p-5 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-gray-950 uppercase tracking-wider flex items-center gap-1.5">
                <span>📈</span> Monthly Sales Revenue Trend
              </h3>
              <p className="text-[10px] text-gray-400 font-medium">Visualizing corporate checkout cashflow momentum over past months.</p>
            </div>
            <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded uppercase">
              Live Trend
            </span>
          </div>

          <div className="h-56 w-full text-[10px] font-semibold text-gray-500">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySalesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} style={{ fontSize: 9, fill: '#6b7280' }} />
                <YAxis tickLine={false} axisLine={false} style={{ fontSize: 9, fill: '#6b7280' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 10 }}
                  formatter={(val: number) => [`${val.toLocaleString()} ETB`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-5 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Payment Mode Share
          </h3>

          <div className="flex justify-center py-4">
            <svg width="120" height="120" viewBox="0 0 32 32" className="overflow-visible transform -rotate-90">
              <circle cx="16" cy="16" r="14" fill="transparent" stroke="#e5e7eb" strokeWidth="4" />
              {/* Cash Bar */}
              <circle 
                cx="16" cy="16" r="14" 
                fill="transparent" 
                stroke="#10b981" 
                strokeWidth="4" 
                strokeDasharray={`${(cashSales / (totalSalesVolume || 1)) * 88} 88`}
                strokeDashoffset="0"
              />
              {/* Card Bar */}
              <circle 
                cx="16" cy="16" r="14" 
                fill="transparent" 
                stroke="#3b82f6" 
                strokeWidth="4" 
                strokeDasharray={`${(cardSales / (totalSalesVolume || 1)) * 88} 88`}
                strokeDashoffset={`-${(cashSales / (totalSalesVolume || 1)) * 88}`}
              />
              {/* Credit Bar */}
              <circle 
                cx="16" cy="16" r="14" 
                fill="transparent" 
                stroke="#f59e0b" 
                strokeWidth="4" 
                strokeDasharray={`${(creditSales / (totalSalesVolume || 1)) * 88} 88`}
                strokeDashoffset={`-${((cashSales + cardSales) / (totalSalesVolume || 1)) * 88}`}
              />
            </svg>
          </div>

          <div className="space-y-1.5 mt-2 border-t border-gray-100 pt-3">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-gray-600 font-medium">Cash Receipts</span>
              </div>
              <span className="font-mono font-bold text-gray-900">{cashSales.toFixed(0)} ETB</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-gray-600 font-medium">POS Card</span>
              </div>
              <span className="font-mono font-bold text-gray-900">{cardSales.toFixed(0)} ETB</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-gray-600 font-medium">Client Credit</span>
              </div>
              <span className="font-mono font-bold text-gray-900">{creditSales.toFixed(0)} ETB</span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-gray-400 italic pt-1 border-t border-dashed">
              <span>Banks / Other Shares:</span>
              <span>{(bankCBESales + bankBOASales + bankAwashSales + bankDashenSales + splitSales + otherSales).toFixed(0)} ETB</span>
            </div>
          </div>
        </div>

      </div>

      {/* 🔮 Recharts AI Predictive Stock Need Forecast based on 3-Month Sales Velocity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-5 text-left space-y-4">
        
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-purple-50 text-purple-700 rounded-lg border border-purple-100">
                <Sparkles className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-1.5 font-sans">
                Predictive Inventory Demand &amp; Stock Need Forecast
              </h3>
              <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full border border-purple-200">
                3-Month Sales Velocity Engine
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Analyzes actual sales run-rate over the last 90 days to project stock requirements and prevent out-of-stock events.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Horizon Selector */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
              <button
                onClick={() => setForecastHorizonMonths(1)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  forecastHorizonMonths === 1 ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                30-Day Forecast
              </button>
              <button
                onClick={() => setForecastHorizonMonths(2)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  forecastHorizonMonths === 2 ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                60-Day
              </button>
              <button
                onClick={() => setForecastHorizonMonths(3)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  forecastHorizonMonths === 3 ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                90-Day
              </button>
            </div>

            {/* View Mode Filter */}
            <select
              value={predictiveFilterMode}
              onChange={(e) => setPredictiveFilterMode(e.target.value as any)}
              className="text-xs bg-white border border-gray-200 text-gray-700 font-medium rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer"
            >
              <option value="critical">⚠️ Critical Reorder Need</option>
              <option value="velocity">🔥 Top Sales Velocity</option>
              <option value="all">📦 All High Demand Items</option>
            </select>

            {/* Export CSV Button */}
            <button
              onClick={exportPredictiveReorderToCSV}
              className="text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 px-3 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              title="Download Reorder Plan CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Plan</span>
            </button>
          </div>
        </div>

        {/* Predictive Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-purple-50/60 rounded-xl p-3 border border-purple-100">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
              Predicted {forecastHorizonMonths * 30}-Day Demand
            </span>
            <span className="text-xl font-mono font-black text-purple-900">
              {totalForecastDemandUnits.toLocaleString()} <span className="text-xs font-sans text-purple-600 font-bold">units</span>
            </span>
            <p className="text-[10px] text-purple-600 mt-0.5">Based on 90-day velocity average</p>
          </div>

          <div className="bg-rose-50/60 rounded-xl p-3 border border-rose-100">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
              Required Replenishment
            </span>
            <span className="text-xl font-mono font-black text-rose-900">
              {totalPredictiveDeficitUnits.toLocaleString()} <span className="text-xs font-sans text-rose-600 font-bold">units</span>
            </span>
            <p className="text-[10px] text-rose-600 mt-0.5">Shortfall + safety buffer</p>
          </div>

          <div className="bg-amber-50/60 rounded-xl p-3 border border-amber-100">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
              Stockout Risk (&lt;14 Days)
            </span>
            <span className="text-xl font-mono font-black text-amber-900">
              {criticalStockoutCount} <span className="text-xs font-sans text-amber-700 font-bold">products</span>
            </span>
            <p className="text-[10px] text-amber-700 mt-0.5">At current run-rate</p>
          </div>

          <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-100">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              Sales Window Analyzed
            </span>
            <span className="text-xl font-mono font-black text-emerald-900">
              90 <span className="text-xs font-sans text-emerald-700 font-bold">Days</span>
            </span>
            <p className="text-[10px] text-emerald-700 mt-0.5">Continuous rolling velocity</p>
          </div>
        </div>

        {/* Recharts Composed Chart Visualization */}
        <div className="h-72 w-full text-xs font-semibold text-gray-500 pt-2">
          {predictiveStockData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-1">
              <Package className="h-8 w-8 text-gray-300" />
              <p className="text-sm">No sales velocity recorded in the last 3 months for this selection.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={predictiveStockData} margin={{ top: 15, right: 15, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tickLine={false} 
                  axisLine={{ stroke: '#cbd5e1' }} 
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  style={{ fontSize: 9, fill: '#475569', fontWeight: 600 }} 
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  style={{ fontSize: 9, fill: '#64748b' }} 
                  label={{ value: 'Units', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#94a3b8' } }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontSize: 11 }}
                  formatter={(val: number, name: string, entry: any) => {
                    if (name === 'Monthly Sales Velocity') return [`${val} units/month`, name];
                    if (name === 'Current On-Hand Stock') return [`${val} ${entry.payload.unit}`, name];
                    if (name === `Projected ${forecastHorizonMonths * 30}-Day Demand`) return [`${val} ${entry.payload.unit}`, name];
                    if (name === 'Recommended Reorder Qty') return [`${val} ${entry.payload.unit}`, name];
                    return [val, name];
                  }}
                  labelFormatter={(label, payload) => {
                    if (payload && payload.length > 0) {
                      const item = payload[0].payload;
                      return `${item.fullName} (${item.category}) • Stock Left: ${item.daysOfStockLeft === 999 ? 'Plenty' : item.daysOfStockLeft + ' days'}`;
                    }
                    return label;
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: 11, paddingTop: 12 }} 
                  iconType="circle"
                />
                <Bar dataKey="currentStock" name="Current On-Hand Stock" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="forecastDemand" name={`Projected ${forecastHorizonMonths * 30}-Day Demand`} fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="reorderNeeded" name="Recommended Reorder Qty" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={18} />
                <Line 
                  type="monotone" 
                  dataKey="monthlyVelocity" 
                  name="Monthly Sales Velocity" 
                  stroke="#10b981" 
                  strokeWidth={2.5} 
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }} 
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Legend Explainer footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-200/80">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 font-medium text-gray-700">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500"></span>
              On-Hand Inventory
            </span>
            <span className="flex items-center gap-1.5 font-medium text-gray-700">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500"></span>
              Sales Velocity Forecast ({forecastHorizonMonths * 30} Days)
            </span>
            <span className="flex items-center gap-1.5 font-medium text-gray-700">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500"></span>
              Suggested Reorder Quantity
            </span>
            <span className="flex items-center gap-1.5 font-medium text-gray-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              3-Month Average Run-Rate
            </span>
          </div>
          <span className="text-gray-400 italic font-mono text-[10px]">
            Formula: Reorder = Max(0, Forecast Demand + Safety Buffer - On Hand)
          </span>
        </div>

      </div>

      {/* Branch Performance Comparison Recharts BarChart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-5 text-left">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold text-gray-950 uppercase tracking-wider flex items-center gap-1.5">
              <span>🏪</span> Branch Revenue &amp; Performance Comparison
            </h3>
            <p className="text-[10px] text-gray-400 font-medium">Evaluating performance across different corporate retail nodes.</p>
          </div>
          <button
            onClick={exportBranchPerformancesToCSV}
            className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded hover:bg-emerald-100 transition-colors uppercase cursor-pointer"
          >
            Export branch CSV
          </button>
        </div>

        <div className="h-56 w-full text-[10px] font-semibold text-gray-500">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rechartsBranchData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="code" tickLine={false} axisLine={false} style={{ fontSize: 9, fill: '#6b7280' }} />
              <YAxis tickLine={false} axisLine={false} style={{ fontSize: 9, fill: '#6b7280' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 10 }}
                formatter={(val: number) => [`${val.toLocaleString()} ETB`, 'Revenue']}
              />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar dataKey="revenue" name="Branch Revenue (ETB)" radius={[4, 4, 0, 0]}>
                {rechartsBranchData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fast & Slow Moving Inventory grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Fast Moving */}
        <div className="bg-white rounded-xl border border-gray-150 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <ShoppingCart className="h-4 w-4 text-emerald-600" />
              Fast-Moving / Best Sellers ({dashboardCategory})
            </h3>
            <button
              onClick={exportBestSellersToCSV}
              className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100"
            >
              <Download className="h-3 w-3" />
              Export
            </button>
          </div>

          <div className="space-y-2.5">
            {fastMoving.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-4 text-center">No transactions registered yet.</p>
            ) : (
              fastMoving.map((fm, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-50/50 rounded-lg border border-gray-100 hover:border-emerald-200 transition-all">
                  <div className="space-y-0.5 max-w-[70%]">
                    <span className="text-xs font-semibold text-gray-800 block truncate">{fm.name}</span>
                    <span className="text-[10px] text-gray-500 block truncate">{fm.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-950 block">{fm.count} sold</span>
                    <span className="text-[10px] text-gray-500 block">{Math.round(fm.value)} ETB</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Slow Moving */}
        <div className="bg-white rounded-xl border border-gray-150 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Package className="h-4 w-4 text-yellow-600" />
              Slow-Moving Products ({dashboardCategory})
            </h3>
            <span className="text-[9px] font-mono bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded uppercase">Dormant Stock</span>
          </div>

          <div className="space-y-2.5">
            {slowMoving.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-4 text-center">All stocks moving at healthy velocities.</p>
            ) : (
              slowMoving.map((sm, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-50/50 rounded-lg border border-gray-100 hover:border-yellow-200 transition-all">
                  <div className="space-y-0.5 max-w-[70%]">
                    <span className="text-xs font-semibold text-gray-800 block truncate">{sm.name}</span>
                    <span className="text-[10px] text-gray-500 block truncate">{sm.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-yellow-700 block">{sm.count} sold</span>
                    <span className="text-[10px] text-gray-500 block">Low demand velocity</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Branch Performance Ledger */}
      <div className="bg-white rounded-xl border border-gray-150 p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            Enterprise Branch Performance Ledger
          </h3>
          <button
            onClick={exportBranchPerformancesToCSV}
            className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1 bg-gray-50 hover:bg-gray-100 px-2.5 py-1 rounded border border-gray-250 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export Branch Metrics
          </button>
        </div>

        <div className="overflow-x-auto border border-gray-100 rounded-lg text-xs">
          <table className="min-w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100 font-semibold text-gray-700">
              <tr>
                <th className="p-3">Branch Location</th>
                <th className="p-3">Code</th>
                <th className="p-3">Sales Invoices</th>
                <th className="p-3">Inventory Balance</th>
                <th className="p-3 text-right">Outstanding Gross Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {branchPerformances.map((bp) => (
                <tr key={bp.id} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold text-gray-800 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    {bp.name}
                  </td>
                  <td className="p-3 font-mono">{bp.code}</td>
                  <td className="p-3">{bp.salesCount} invoices logged</td>
                  <td className="p-3 font-semibold">{bp.stockCount} items stocked</td>
                  <td className="p-3 text-right font-mono font-bold text-slate-950">
                    {bp.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Daily Sales Summary & Reports Module */}
      <div className="bg-white rounded-xl border border-gray-150 p-5 shadow-sm space-y-5">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-sans font-extrabold text-gray-900 flex items-center gap-2">
              <Clock className="h-4.5 w-4.5 text-blue-600" />
              Daily Sales Summary &amp; Payment Ledger Reports
            </h3>
            <p className="text-xs text-gray-500">
              Generate audited daily ledger worksheets filtered by payment modes and dates. Includes individual transaction time logs.
            </p>
          </div>
          
          <button
            onClick={exportDailyReportToCSV}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-3.5 rounded shadow flex items-center gap-1.5 transition-colors shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Selected Ledger
          </button>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-150 text-xs">
          
          {/* Sales Channel Selector */}
          <div className="space-y-1">
            <label className="text-gray-550 font-bold block">Order Channel / Source</label>
            <select
              value={reportChannel}
              onChange={(e) => setReportChannel(e.target.value as 'all' | 'instore' | 'online')}
              className="w-full bg-white border border-blue-300 text-gray-800 rounded-lg p-2 font-bold outline-none focus:border-blue-500 transition-colors cursor-pointer bg-blue-50/20"
            >
              <option value="all">All Order Channels</option>
              <option value="instore">🏪 In-Store POS Sales Only</option>
              <option value="online">🛍️ Online Orders Sold Only</option>
            </select>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1">
            <label className="text-gray-550 font-bold block">Payment Method / Bank Route</label>
            <select
              value={reportPaymentMethod}
              onChange={(e) => setReportPaymentMethod(e.target.value)}
              className="w-full bg-white border border-gray-250 text-gray-800 rounded-lg p-2 font-medium outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All Modes Combined</option>
              <option value="Cash">Cash Payments</option>
              <option value="Bank">🏦 All Bank Transfers & Accounts</option>
              <option value="Telebirr">Telebirr Mobile Money</option>
              <option value="Card">POS Card Terminal</option>
              <option value="Credit">Customer Account Credit</option>
              <option value="Bank CBE">Commercial Bank of Ethiopia (CBE)</option>
              <option value="Bank BOA">Bank of Abyssinia (BOA)</option>
              <option value="Bank AWASH">AWASH Bank</option>
              <option value="Bank DASHEN">DASHEN Bank</option>
              <option value="Split">Split / Mixed Mode Payment</option>
              <option value="Other">Other Bank Transfer</option>
            </select>
          </div>

          {/* Date Selector */}
          <div className="space-y-1">
            <label className="text-gray-550 font-bold block">Audit Posting Date</label>
            <div className="flex gap-1.5">
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="flex-1 min-w-0 bg-white border border-gray-250 text-gray-800 rounded-lg p-2 font-medium outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setReportDate(new Date().toISOString().split('T')[0])}
                className="bg-white border border-gray-250 hover:bg-gray-100 text-gray-650 font-semibold px-2 rounded-lg cursor-pointer whitespace-nowrap"
                title="Reset to today"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setReportDate('')}
                className="bg-white border border-gray-250 hover:bg-gray-100 text-gray-650 font-semibold px-2 rounded-lg cursor-pointer whitespace-nowrap"
                title="Show all sales across all dates"
              >
                All Dates
              </button>
            </div>
          </div>

          {/* Branch Selector */}
          <div className="space-y-1">
            <label className="text-gray-550 font-bold block">Dispensing Location / Branch</label>
            <select
              value={reportBranchId}
              onChange={(e) => setReportBranchId(e.target.value)}
              className="w-full bg-white border border-gray-250 text-gray-800 rounded-lg p-2 font-medium outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          {/* Product Category Selector */}
          <div className="space-y-1">
            <label className="text-gray-550 font-bold block">Product Classification (Category)</label>
            <select
              value={reportCategory}
              onChange={(e) => setReportCategory(e.target.value as 'all' | 'medicine' | 'cosmetics')}
              className="w-full bg-white border border-gray-250 text-gray-800 rounded-lg p-2 font-medium outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All Products Combined</option>
              <option value="medicine">Medicines Category Only</option>
              <option value="cosmetics">Cosmetics Category Only</option>
            </select>
          </div>

          {/* Dispensing Cashier / User Selector */}
          <div className="space-y-1">
            <label className="text-gray-550 font-bold block">Dispensing User / Cashier</label>
            <select
              value={reportCashierName}
              onChange={(e) => setReportCashierName(e.target.value)}
              className="w-full bg-white border border-gray-250 text-gray-800 rounded-lg p-2 font-medium outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All Users / Cashiers</option>
              {uniqueCashierOptions.map(cashier => (
                <option key={cashier.key} value={cashier.key}>{cashier.displayName}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Separate Category & Channel Performance Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Medicines Summary Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            reportCategory === 'medicine' 
              ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-600/10' 
              : 'bg-emerald-50/10 border-emerald-100 hover:bg-emerald-50/20'
          }`}>
            <div className="flex items-center justify-between border-b border-emerald-100/60 pb-2.5">
              <span className="text-xs font-sans font-extrabold text-emerald-950 flex items-center gap-1.5 uppercase tracking-wider">
                <span className="text-base">💊</span> Medicines Daily Sales
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                  {medicineOnlySalesCount} invoices
                </span>
                <button
                  type="button"
                  onClick={() => setReportCategory(reportCategory === 'medicine' ? 'all' : 'medicine')}
                  className={`text-[9px] font-bold px-2 py-0.8 rounded transition-all cursor-pointer ${
                    reportCategory === 'medicine'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {reportCategory === 'medicine' ? 'Isolating ✓' : 'Isolate Report'}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center pt-1.5">
              <div className="bg-white/70 border border-emerald-100/30 p-2 rounded-lg">
                <span className="text-[9px] text-emerald-800 font-bold block uppercase tracking-wider">Net Sales</span>
                <span className="text-sm font-mono font-black text-emerald-950 mt-1 block">
                  {medicineOnlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[9px] font-normal text-gray-400">ETB</span>
                </span>
              </div>
              <div className="bg-white/70 border border-emerald-100/30 p-2 rounded-lg">
                <span className="text-[9px] text-emerald-800 font-bold block uppercase tracking-wider">VAT (15%)</span>
                <span className="text-sm font-mono font-black text-emerald-950 mt-1 block">
                  {medicineOnlyTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[9px] font-normal text-gray-400">ETB</span>
                </span>
              </div>
              <div className="bg-white/70 border border-emerald-100/30 p-2 rounded-lg">
                <span className="text-[9px] text-emerald-800 font-bold block uppercase tracking-wider">Units Sold</span>
                <span className="text-sm font-sans font-black text-emerald-950 mt-1 block">
                  {medicineOnlyItemsSold} <span className="text-[9px] text-gray-400 font-normal">units</span>
                </span>
              </div>
            </div>
          </div>

          {/* Cosmetics Summary Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            reportCategory === 'cosmetics' 
              ? 'bg-pink-50/60 border-pink-300 ring-2 ring-pink-600/10' 
              : 'bg-pink-50/10 border-pink-100 hover:bg-pink-50/20'
          }`}>
            <div className="flex items-center justify-between border-b border-pink-100/60 pb-2.5">
              <span className="text-xs font-sans font-extrabold text-pink-950 flex items-center gap-1.5 uppercase tracking-wider">
                <span className="text-base">💄</span> Cosmetics Daily Sales
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-pink-100 text-pink-800 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                  {cosmeticsOnlySalesCount} invoices
                </span>
                <button
                  type="button"
                  onClick={() => setReportCategory(reportCategory === 'cosmetics' ? 'all' : 'cosmetics')}
                  className={`text-[9px] font-bold px-2 py-0.8 rounded transition-all cursor-pointer ${
                    reportCategory === 'cosmetics'
                      ? 'bg-pink-600 text-white shadow-sm'
                      : 'bg-white border border-pink-200 text-pink-700 hover:bg-pink-50'
                  }`}
                >
                  {reportCategory === 'cosmetics' ? 'Isolating ✓' : 'Isolate Report'}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center pt-1.5">
              <div className="bg-white/70 border border-pink-100/30 p-2 rounded-lg">
                <span className="text-[9px] text-pink-800 font-bold block uppercase tracking-wider">Net Sales</span>
                <span className="text-sm font-mono font-black text-pink-950 mt-1 block">
                  {cosmeticsOnlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[9px] font-normal text-gray-400">ETB</span>
                </span>
              </div>
              <div className="bg-white/70 border border-pink-100/30 p-2 rounded-lg">
                <span className="text-[9px] text-pink-800 font-bold block uppercase tracking-wider">VAT (15%)</span>
                <span className="text-sm font-mono font-black text-pink-950 mt-1 block">
                  {cosmeticsOnlyTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[9px] font-normal text-gray-400">ETB</span>
                </span>
              </div>
              <div className="bg-white/70 border border-pink-100/30 p-2 rounded-lg">
                <span className="text-[9px] text-pink-800 font-bold block uppercase tracking-wider">Units Sold</span>
                <span className="text-sm font-sans font-black text-pink-950 mt-1 block">
                  {cosmeticsOnlyItemsSold} <span className="text-[9px] text-gray-400 font-normal">units</span>
                </span>
              </div>
            </div>
          </div>

          {/* Online Orders Sold Summary Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            reportChannel === 'online' 
              ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-600/10' 
              : 'bg-sky-50/20 border-sky-100 hover:bg-sky-50/40'
          }`}>
            <div className="flex items-center justify-between border-b border-sky-100 pb-2.5">
              <span className="text-xs font-sans font-extrabold text-sky-950 flex items-center gap-1.5 uppercase tracking-wider">
                <span className="text-base">🛍️</span> Online Orders Sold
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-sky-100 text-sky-900 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                  {onlineOnlySalesCount} orders sold
                </span>
                <button
                  type="button"
                  onClick={() => setReportChannel(reportChannel === 'online' ? 'all' : 'online')}
                  className={`text-[9px] font-bold px-2 py-0.8 rounded transition-all cursor-pointer ${
                    reportChannel === 'online'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-white border border-sky-200 text-sky-700 hover:bg-sky-50'
                  }`}
                >
                  {reportChannel === 'online' ? 'Isolating ✓' : 'Isolate Online'}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center pt-1.5">
              <div className="bg-white/70 border border-sky-100/40 p-2 rounded-lg">
                <span className="text-[9px] text-sky-800 font-bold block uppercase tracking-wider">Net Sales</span>
                <span className="text-sm font-mono font-black text-sky-950 mt-1 block">
                  {onlineOnlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[9px] font-normal text-gray-400">ETB</span>
                </span>
              </div>
              <div className="bg-white/70 border border-sky-100/40 p-2 rounded-lg">
                <span className="text-[9px] text-sky-800 font-bold block uppercase tracking-wider">VAT (15%)</span>
                <span className="text-sm font-mono font-black text-sky-950 mt-1 block">
                  {onlineOnlyTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[9px] font-normal text-gray-400">ETB</span>
                </span>
              </div>
              <div className="bg-white/70 border border-sky-100/40 p-2 rounded-lg">
                <span className="text-[9px] text-sky-800 font-bold block uppercase tracking-wider">Units Sold</span>
                <span className="text-sm font-sans font-black text-sky-950 mt-1 block">
                  {onlineOnlyItemsSold} <span className="text-[9px] text-gray-400 font-normal">units</span>
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Selected View Summary Indicators */}
        <div className="bg-gray-55/60 p-3 rounded-lg border border-gray-150 text-[11px] font-sans text-gray-700 flex flex-wrap items-center justify-between gap-2">
          <span>
            Active Ledger View: <strong className="uppercase font-extrabold text-slate-900">
              {reportCategory === 'all' ? 'Combined Medicines & Cosmetics' : reportCategory === 'medicine' ? 'Medicines Classification Only' : 'Cosmetics Classification Only'}
            </strong>
          </span>
          {reportCategory !== 'all' && (
            <button
              onClick={() => setReportCategory('all')}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline"
            >
              Reset to Combined View
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          
          <div className="bg-blue-50/40 border border-blue-100/60 p-4 rounded-xl">
            <span className="text-[10px] font-bold text-blue-800 block uppercase tracking-wider">Net Sales Revenue</span>
            <span className="text-lg font-mono font-black text-slate-900 block mt-1">
              {reportTotalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-normal text-gray-400">ETB</span>
            </span>
          </div>

          <div className="bg-blue-50/40 border border-blue-100/60 p-4 rounded-xl">
            <span className="text-[10px] font-bold text-blue-800 block uppercase tracking-wider">Tax (VAT 15%) Settle</span>
            <span className="text-lg font-mono font-black text-slate-900 block mt-1">
              {reportTotalTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-normal text-gray-400">ETB</span>
            </span>
          </div>

          <div className="bg-blue-50/40 border border-blue-100/60 p-4 rounded-xl">
            <span className="text-[10px] font-bold text-blue-800 block uppercase tracking-wider">Invoices Cleared</span>
            <span className="text-lg font-sans font-black text-slate-900 block mt-1">
              {reportSalesCount} sales
            </span>
          </div>

          <div className="bg-blue-50/40 border border-blue-100/60 p-4 rounded-xl">
            <span className="text-[10px] font-bold text-blue-800 block uppercase tracking-wider">Product Units Dispensed</span>
            <span className="text-lg font-sans font-black text-slate-900 block mt-1">
              {reportTotalItemsSold} units
            </span>
          </div>

        </div>

        {/* Daily Sales Branch Summation & Audit Reconciliation */}
        {reportBranchId === 'all' && branches && branches.length > 0 && (
          <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">🏢</span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                    Daily Sales Branch Breakdown & Reconciliation
                  </h4>
                  <p className="text-[10px] text-emerald-800 font-medium">
                    Audit of daily sales across each outlet branch vs total consolidated daily report
                  </p>
                </div>
              </div>
              {(() => {
                const branchDailyTotalsSum = branches.reduce((sum, b) => {
                  const bSales = dailyReportFilteredSales.filter(s => checkSaleMatchesBranch(s, b.id));
                  return sum + bSales.reduce((acc, s) => acc + (s.isExcludedFromSums ? 0 : s.total), 0);
                }, 0);
                const isExactMatch = Math.abs(branchDailyTotalsSum - reportTotalRevenue) < 0.01;
                return (
                  <span className={`text-[10px] font-black font-mono px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                    isExactMatch 
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}>
                    <span>{isExactMatch ? '✓ 100% Reconciled' : '⚠️ Adjustment Pending'}</span>
                    <span>(Sum of Outlets: {branchDailyTotalsSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB)</span>
                  </span>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 pt-1">
              {branches.map(b => {
                const bSales = dailyReportFilteredSales.filter(s => checkSaleMatchesBranch(s, b.id));
                const validSales = bSales.filter(s => !s.isExcludedFromSums);
                const bRevenue = validSales.reduce((acc, s) => acc + s.total, 0);
                const bCount = validSales.length;
                const bUnits = validSales.reduce((acc, s) => acc + s.items.reduce((acc2, i) => acc2 + i.quantity, 0), 0);

                return (
                  <div key={b.id} className="bg-white border border-emerald-200/80 p-3 rounded-lg shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs truncate">{b.name}</span>
                      <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-black">
                        {b.code || b.id}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-gray-100 pt-1.5">
                      <span className="text-[10px] text-gray-500 font-medium">Daily Revenue:</span>
                      <span className="text-xs font-mono font-black text-slate-900">
                        {bRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[9px] text-gray-400 font-normal">ETB</span>
                      </span>
                    </div>
                    <div className="flex justify-between text-[9.5px] text-gray-500">
                      <span>{bCount} transactions</span>
                      <span>{bUnits} units sold</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Specific List with time */}
        <div className="border border-gray-150 rounded-xl overflow-hidden text-xs">
          {reportPaymentMethod !== 'all' && (
            <div className="bg-blue-50 border-b border-blue-150 text-blue-800 p-2.5 font-semibold text-center flex items-center justify-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
              Isolating payment route: <span className="font-extrabold underline uppercase">{reportPaymentMethod}</span> — listing matched ledger transactions below
            </div>
          )}
          <div className="bg-slate-900 text-white p-3 font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-emerald-400" />
              Audited Time-Stamped Worksheets
            </span>
            <span className="text-[10px] font-mono text-slate-400">{dailyReportFilteredSales.length} items matched</span>
          </div>

          {/* Admin Payment Method Modifications Alert for Reports */}
          {dailyReportFilteredSales.filter(s => s.paymentMethodChanged || (s.paymentMethodHistory && s.paymentMethodHistory.length > 0)).length > 0 && (
            <div className="bg-amber-50 border-b border-amber-200 p-3.5 text-xs text-amber-950 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-amber-950">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Admin / Staff Modified Payment Methods Alert ({dailyReportFilteredSales.filter(s => s.paymentMethodChanged || (s.paymentMethodHistory && s.paymentMethodHistory.length > 0)).length} Transactions Updated)</span>
                </div>
                <span className="text-[9px] bg-amber-200/90 text-amber-950 border border-amber-300 px-2 py-0.5 rounded font-extrabold uppercase font-mono">
                  Report Audit Notice
                </span>
              </div>
              <p className="text-[11px] text-amber-850 font-medium">
                Attention: The following invoices in this daily report had their settlement route updated post-sale. Please verify for bank and cash drawer balancing.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
                {dailyReportFilteredSales.filter(s => s.paymentMethodChanged || (s.paymentMethodHistory && s.paymentMethodHistory.length > 0)).map(sale => {
                  const lastLog = sale.paymentMethodHistory?.[0];
                  return (
                    <div key={sale.id} className="bg-white p-2 rounded-lg border border-amber-250 text-[11px] flex flex-col justify-between shadow-2xs">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-gray-900">#{sale.invoiceNumber} ({sale.branchName})</span>
                        <span className="text-emerald-700 font-mono">{sale.total.toFixed(2)} ETB</span>
                      </div>
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-gray-100">
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 font-black rounded text-[9.5px] uppercase">
                          {lastLog ? `${lastLog.oldMethod} ➔ ${lastLog.newMethod}` : sale.paymentMethod}
                        </span>
                        <span className="text-[9px] text-gray-500 font-medium truncate max-w-[150px]">
                          {lastLog ? `By ${lastLog.changedBy}` : sale.lastPaymentChangeNote}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100 font-bold text-gray-700 uppercase text-[9px] tracking-wider">
                <tr>
                  <th className="p-3">Posting Time</th>
                  <th className="p-3">Invoice ID</th>
                  <th className="p-3">Order Source</th>
                  <th className="p-3">Branch Location</th>
                  <th className="p-3">Dispensing Cashier</th>
                  <th className="p-3">Settlement Route</th>
                  <th className="p-3">Client details</th>
                  <th className="p-3">Dispensed Items Details</th>
                  <th className="p-3 text-right">Invoice Total (ETB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                {dailyReportFilteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400 italic">
                      No matching daily transactions found for the specified audit parameters.
                    </td>
                  </tr>
                ) : (
                  dailyReportFilteredSales.map((sale) => (
                    <tr key={sale.id} className={`transition-colors ${sale.isExcludedFromSums ? 'bg-red-50/30 text-gray-400' : 'hover:bg-gray-55/60'}`}>
                      <td className="p-3 font-mono font-bold text-gray-900 text-[11px] flex items-center gap-1.5 whitespace-nowrap">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        {sale.time}
                        <span className="text-[9px] text-gray-400 font-normal">({sale.date})</span>
                      </td>
                      <td className="p-3 font-mono text-blue-700 font-semibold whitespace-nowrap">
                        <span className={sale.isExcludedFromSums ? 'line-through' : ''}>{sale.invoiceNumber}</span>
                        {sale.status === 'Voided' && (
                          <span className="ml-2 px-1.5 py-0.5 text-[8px] bg-red-100 text-red-750 border border-red-200 rounded font-black uppercase tracking-wide inline-block">Voided</span>
                        )}
                        {sale.status === 'Returned' && (
                          <span className="ml-2 px-1.5 py-0.5 text-[8px] bg-amber-100 text-amber-750 border border-amber-200 rounded font-black uppercase tracking-wide inline-block">Returned</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {(sale.isOnlineOrder || sale.orderSource === 'Online Store' || sale.orderSource?.toLowerCase().includes('online')) ? (
                          <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-850 border border-sky-300 font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                            🛍️ Online Order
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 border border-gray-200 font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                            🏪 In-Store POS
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-gray-800 whitespace-nowrap">{sale.branchName}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-[10px] font-bold text-gray-800">
                          <Users className="h-2.5 w-2.5 text-gray-400 shrink-0" />
                          {sale.cashierName || 'Offline Cashier'}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDashboardSale(sale);
                            setNewDashboardPaymentMethod(sale.paymentMethod || 'Cash');
                          }}
                          title="Click to change payment method"
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border hover:opacity-80 cursor-pointer transition-all ${
                            sale.paymentMethod === 'Cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            sale.paymentMethod === 'Card' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            sale.paymentMethod === 'Credit' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-indigo-50 text-indigo-750 border-indigo-200'
                          }`}
                        >
                          <CreditCard className="h-2.5 w-2.5 shrink-0" />
                          <span>{sale.paymentMethod}</span>
                          <Edit2 className="h-2 w-2 opacity-60 ml-0.5" />
                        </button>
                      </td>
                      <td className="p-3 max-w-[150px]">
                        <span className={`block font-semibold text-gray-800 truncate ${sale.isExcludedFromSums ? 'line-through text-gray-400' : ''}`}>{sale.customerName || 'Walk-In'}</span>
                        {sale.customerTin && (
                          <span className="block font-mono text-[10px] text-gray-400">TIN: {sale.customerTin}</span>
                        )}
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="space-y-1 font-sans text-[11px]">
                          {sale.items.map((it, iIdx) => (
                            <div key={iIdx} className="flex justify-between text-gray-600 gap-2 truncate">
                              <span className={`font-bold text-slate-800 truncate uppercase ${sale.isExcludedFromSums ? 'line-through text-gray-400 font-normal' : ''}`}>
                                {it.medicineName} 
                                <span className="text-[9px] text-gray-400 font-mono normal-case font-normal ml-1">(Batch: {it.batchNumber})</span>
                              </span>
                              <span className="shrink-0 font-mono">{it.quantity} x {it.unitPrice.toFixed(0)} ETB</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className={`p-3 text-right font-mono font-bold whitespace-nowrap ${sale.isExcludedFromSums ? 'text-red-650 line-through' : 'text-slate-950'}`}>
                        {sale.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Expiry Risk Analysis Modal */}
      {showExpiryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-gray-150 shadow-2xl w-full max-w-5xl flex flex-col max-h-[85vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2 text-rose-400">
                  <AlertOctagon className="h-5 w-5" />
                  Expiry Risk &amp; Inventory Analysis
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Analyze batches near expiration across all registered physical branch locations.
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowExpiryModal(false);
                  setExpirySearchQuery('');
                }}
                className="text-slate-400 hover:text-white font-bold text-lg p-1.5 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Actions and Filtering Bar */}
            <div className="p-4 bg-slate-50 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Tab Selector Buttons */}
              <div className="flex bg-gray-200/80 p-1 rounded-lg gap-1 border border-gray-300/40 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setExpiryActiveTab('expired')}
                  className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    expiryActiveTab === 'expired' 
                      ? 'bg-red-600 text-white shadow-sm' 
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-300/40'
                  }`}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  Expired Batches ({expiredBatches.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExpiryActiveTab('soon')}
                  className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    expiryActiveTab === 'soon' 
                      ? 'bg-amber-600 text-white shadow-sm' 
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-300/40'
                  }`}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  Expiring Soon ({expiringSoonBatches.length})
                </button>
              </div>

              {/* Search & Export Actions */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by product name, generic, batch..."
                    value={expirySearchQuery}
                    onChange={(e) => setExpirySearchQuery(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs outline-none text-gray-800 placeholder-gray-400 focus:border-blue-500 transition-colors"
                  />
                </div>
                
                <button
                  onClick={exportExpiryToCSV}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export list
                </button>
              </div>
            </div>

            {/* Modal Body Table */}
            <div className="overflow-y-auto flex-1 p-4">
              <div className="border border-gray-150 rounded-xl overflow-hidden">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-150 font-bold text-gray-700 uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="p-3">Product details</th>
                      <th className="p-3">Batch Reference</th>
                      <th className="p-3">Expiry Date</th>
                      <th className="p-3">Risk Assessment</th>
                      <th className="p-3">Physical Branch</th>
                      <th className="p-3 text-right">Stock Quantity</th>
                      <th className="p-3 text-right">Cost value</th>
                      <th className="p-3 text-center">Manage Expiry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-600">
                    {(() => {
                      const activeList = expiryActiveTab === 'expired' ? expiredBatches : expiringSoonBatches;
                      const searched = activeList.filter(st => {
                        const med = medicines.find(m => m.id === st.medicineId);
                        const matchText = `${med?.name} ${st.batchNumber}`.toLowerCase();
                        return matchText.includes(expirySearchQuery.toLowerCase());
                      });

                      if (searched.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="p-12 text-center text-gray-400 italic">
                              No matching risk records identified for this tab based on filters.
                            </td>
                          </tr>
                        );
                      }

                      return searched.map((st) => {
                        const med = medicines.find(m => m.id === st.medicineId);
                        const branchName = branches.find(b => b.id === st.branchId)?.name || st.branchId;
                        const costPrice = st.buyingPrice || med?.buyingPrice || 0;
                        const totalCost = st.quantity * costPrice;

                        // Calculate relative days left/past
                        const diffTime = new Date(st.expiryDate).getTime() - new Date(todayStr).getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        return (
                          <tr key={st.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="p-3">
                              <span className="block font-bold text-gray-900 uppercase text-xs">{med?.name || 'Unknown'}</span>
                              <span className="text-[10px] text-gray-400">{med?.category}</span>
                            </td>
                            <td className="p-3 font-mono text-gray-800 font-semibold">{st.batchNumber}</td>
                            <td className="p-3 font-mono font-bold text-gray-900 whitespace-nowrap">{st.expiryDate}</td>
                            <td className="p-3 whitespace-nowrap">
                              {expiryActiveTab === 'expired' ? (
                                <span className="inline-flex items-center gap-1 rounded bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 font-bold text-[9px] uppercase animate-pulse">
                                  Expired {Math.abs(diffDays)} Days Ago
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 font-bold text-[9px] uppercase">
                                  Expires in {diffDays} Days
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-semibold text-slate-800">{branchName}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">{st.quantity} {med?.unit || 'units'}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                              {totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                            </td>
                            <td className="p-3 text-center">
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => setEditingExpiryBatch({
                                    id: st.id,
                                    batchNumber: st.batchNumber,
                                    medicineName: med?.name || 'Unknown Item',
                                    currentExpiryDate: st.expiryDate,
                                    newExpiryDate: st.expiryDate,
                                    reason: ''
                                  })}
                                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2.5 rounded text-[10px] flex items-center gap-1 shadow-sm transition-all cursor-pointer mx-auto"
                                >
                                  <Calendar className="h-3 w-3" />
                                  Edit Expiry
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-gray-100 p-4 flex justify-between items-center text-[10px] text-gray-400">
              <span>* Expired batches are automatically locked from point-of-sale dispensing lanes.</span>
              <button
                onClick={() => {
                  setShowExpiryModal(false);
                  setExpirySearchQuery('');
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-4 rounded-lg cursor-pointer transition-colors"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Edit Expiry Date Modal */}
      {editingExpiryBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-150 max-w-md w-full p-6 text-xs text-gray-800 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-sans font-extrabold text-gray-950 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Edit Batch Expiry Date
                </h3>
                <p className="text-[11px] text-gray-500">Update expiration specs for this inventory batch.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingExpiryBatch(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-base p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 space-y-1 text-blue-950">
              <div className="font-extrabold text-xs uppercase">{editingExpiryBatch.medicineName}</div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-mono font-semibold">Batch: {editingExpiryBatch.batchNumber}</span>
                <span className="bg-blue-100 text-blue-800 font-mono font-bold px-2 py-0.5 rounded text-[10px]">Current: {editingExpiryBatch.currentExpiryDate}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-gray-800 block mb-1">New Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={editingExpiryBatch.newExpiryDate}
                  onChange={(e) => setEditingExpiryBatch({ ...editingExpiryBatch, newExpiryDate: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 outline-none font-mono font-bold text-gray-900 focus:border-blue-600"
                />
              </div>

              {/* Quick Offset Buttons */}
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Quick Extend Presets</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '+3 Months', months: 3 },
                    { label: '+6 Months', months: 6 },
                    { label: '+1 Year', months: 12 },
                    { label: '+2 Years', months: 24 }
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        const cur = editingExpiryBatch.currentExpiryDate ? new Date(editingExpiryBatch.currentExpiryDate) : new Date();
                        const baseDate = isNaN(cur.getTime()) ? new Date() : cur;
                        baseDate.setMonth(baseDate.getMonth() + preset.months);
                        const newStr = baseDate.toISOString().split('T')[0];
                        setEditingExpiryBatch({ ...editingExpiryBatch, newExpiryDate: newStr });
                      }}
                      className="bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700 border border-gray-200 py-1.5 px-1 rounded text-[10px] font-bold text-center transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-800 block mb-1">Reason / Adjustment Remark (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Manufacturer extension certificate, Data correction..."
                  value={editingExpiryBatch.reason}
                  onChange={(e) => setEditingExpiryBatch({ ...editingExpiryBatch, reason: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2 outline-none text-gray-800 placeholder-gray-400"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingExpiryBatch(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveExpiryDate}
                disabled={isSavingExpiry || !editingExpiryBatch.newExpiryDate}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingExpiry ? 'Saving...' : 'Confirm Update Expiry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Payment Method Modal */}
      {editingDashboardSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-150 max-w-md w-full p-6 text-xs text-gray-800 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-sans font-extrabold text-gray-950 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  Change Payment Method
                </h3>
                <p className="text-[11px] text-gray-500">Invoice #{editingDashboardSale.invoiceNumber}</p>
              </div>
              <button 
                onClick={() => setEditingDashboardSale(null)} 
                className="p-1 rounded bg-gray-100 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg border text-[11px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Current Method:</span>
                <span className="font-bold text-gray-900 uppercase bg-gray-200/80 px-2 py-0.5 rounded text-[10px]">{editingDashboardSale.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <span className="font-bold text-gray-900">{editingDashboardSale.customerName || 'Walk-in'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice Total:</span>
                <span className="font-bold text-emerald-700 font-mono">{editingDashboardSale.total.toFixed(2)} ETB</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-800">
                Select New Payment Method / Route:
              </label>
              <select
                value={newDashboardPaymentMethod}
                onChange={(e) => setNewDashboardPaymentMethod(e.target.value)}
                className="w-full bg-white border border-gray-300 font-extrabold text-gray-900 text-xs rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="Cash">💵 Cash</option>
                <option value="Card">💳 Card / POS Terminal</option>
                <option value="Credit">📜 Credit / Customer Account</option>
                <option value="Telebirr">📱 Telebirr</option>
                <option value="Bank CBE">🏦 Bank CBE (Commercial Bank of Ethiopia)</option>
                <option value="Bank BOA">🏦 Bank BOA (Bank of Abyssinia)</option>
                <option value="Bank AWASH">🏦 Bank AWASH</option>
                <option value="Bank DASHEN">🏦 Bank DASHEN</option>
                <option value="Split">🔀 Split Payment</option>
                <option value="Other">🌐 Other Settlement Route</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-800">
                Reason / Audit Note for Payment Method Change:
              </label>
              <input
                type="text"
                placeholder="e.g. Correction of cashier choice, Paid via Bank Transfer"
                value={dashboardPaymentReason}
                onChange={(e) => setDashboardPaymentReason(e.target.value)}
                className="w-full bg-white border border-gray-300 font-medium text-gray-900 text-xs rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingDashboardSale(null)}
                className="bg-gray-150 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingDashboardPayment || newDashboardPaymentMethod === editingDashboardSale.paymentMethod}
                onClick={handleUpdateDashboardPayment}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                {isUpdatingDashboardPayment ? 'Saving...' : 'Update Payment Method'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal Dialog */}
      {showQrModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-emerald-500/20">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-5 flex justify-between items-center relative">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl">
                  <QrCode className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Customer Store QR Code</h3>
                  <p className="text-[11px] text-emerald-200/80">Scan with mobile camera to open online store</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-emerald-200 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 text-center space-y-5">
              
              <div className="inline-block p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border-2 border-dashed border-emerald-500/40 shadow-inner">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Public Store QR Code" className="w-56 h-56 mx-auto rounded-xl shadow-md" />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                    Generating QR Code...
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 block truncate max-w-xs mx-auto">
                  {getPublicStoreUrl()}
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold block">
                  ✨ Share this QR Code on printed flyers, store counter, or social media
                </span>
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!qrDataUrl) return;
                    const link = document.createElement('a');
                    link.href = qrDataUrl;
                    link.download = 'pharmacy-online-store-qr.png';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition shadow"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Image</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const storeUrl = getPublicStoreUrl();
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) return;
                    printWindow.document.write(`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <title>Order Online - Customer Store QR Code</title>
                          <style>
                            body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px; color: #0f172a; background-color: #f8fafc; }
                            .card { max-width: 480px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 2px solid #e2e8f0; }
                            h1 { color: #065f46; font-size: 26px; margin-bottom: 6px; }
                            p.subtitle { color: #475569; font-size: 14px; margin-top: 0; margin-bottom: 24px; }
                            .qr-frame { background: #ecfdf5; padding: 20px; border-radius: 20px; display: inline-block; border: 2px dashed #059669; margin-bottom: 20px; }
                            .qr-frame img { width: 240px; height: 240px; display: block; }
                            .instructions { font-size: 13px; font-weight: bold; color: #047857; background: #d1fae5; padding: 10px 16px; border-radius: 12px; display: inline-block; margin-bottom: 16px; }
                            .url-text { font-family: monospace; font-size: 12px; color: #64748b; word-break: break-all; }
                          </style>
                        </head>
                        <body>
                          <div class="card">
                            <h1>🛍️ Order Online & Home Delivery</h1>
                            <p class="subtitle">Browse Medicines & Cosmetics on Your Mobile Phone</p>
                            <div class="qr-frame">
                              <img src="${qrDataUrl}" alt="Store QR Code" />
                            </div>
                            <div class="instructions">📷 Scan this QR Code with your Phone Camera to Order Now!</div>
                            <p class="url-text">${storeUrl}</p>
                          </div>
                          <script>
                            window.onload = function() { window.print(); };
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="py-2.5 px-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Flyer</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyStoreLink()}
                  className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition border border-slate-200 dark:border-slate-700"
                >
                  {copiedStoreLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedStoreLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
                </button>

                <a
                  href={getPublicStoreUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition border border-slate-200 dark:border-slate-700 text-center"
                >
                  <ExternalLink className="w-4 h-4 text-slate-500" />
                  <span>Open Store</span>
                </a>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-right">
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
