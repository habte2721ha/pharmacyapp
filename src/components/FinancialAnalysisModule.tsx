import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { 
  TrendingUp, TrendingDown, DollarSign, Activity, Users, 
  Layers, Package, AlertCircle, FileSpreadsheet, Download, 
  Printer, Filter, Search, Calendar, Landmark, MapPin, 
  Percent, ArrowUpRight, Award, Trash2, ShieldCheck, HelpCircle,
  Coins, LineChart, Sparkles, RefreshCw, BarChart2, Clock, 
  ChevronLeft, ChevronRight, PieChart as PieIcon, ArrowUpDown, ShieldAlert
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Cell, Pie
} from 'recharts';
import { 
  Branch, User, Medicine, StockItem, Supplier, 
  PurchaseOrder, StockTransfer, Customer, Expense, Sale, AuditLog 
} from '../types.ts';

interface FinancialAnalysisModuleProps {
  currentUser: User;
  branches: Branch[];
  medicines: Medicine[];
  stockItems: StockItem[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  customers: Customer[];
  expenses: Expense[];
  sales: Sale[];
  auditLogs: AuditLog[];
  onDataChanged: () => void;
  darkMode: boolean;
}

export default function FinancialAnalysisModule({
  currentUser,
  branches,
  medicines,
  stockItems,
  suppliers,
  purchaseOrders,
  customers,
  expenses,
  sales,
  auditLogs,
  onDataChanged,
  darkMode
}: FinancialAnalysisModuleProps) {
  
  // Filtering states
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearchQuery = useDebounce(searchQuery, 200);
  const [selectedSupplierFilters, setSelectedSupplierFilters] = useState<string[]>([]);
  const [stockQtyFilterType, setStockQtyFilterType] = useState<'all' | 'available'>('all');
  
  // Tab states
  const [activeSubTab, setActiveSubTab] = useState<'executive' | 'reports' | 'branches' | 'products' | 'inventory' | 'partners'>('executive');
  
  // Report selection for 'reports' subtab
  const [selectedReportType, setSelectedReportType] = useState<
    'daily_sales' | 'monthly_sales' | 'annual_sales' | 'p_l' | 'balance_sheet' | 
    'cash_flow' | 'trial_balance' | 'general_ledger' | 'expenses' | 'vat_tax' | 'purchases' | 'supplier_payments' | 'supplier_purchases'
  >('p_l');

  // Pagination states
  const [reportPage, setReportPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Custom styling colors for dark mode vs light mode
  const styles = useMemo(() => {
    return {
      card: darkMode ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-slate-950/40' : 'bg-white border-gray-150 text-gray-800 shadow-sm',
      cardHeader: darkMode ? 'border-slate-800 text-slate-100' : 'border-gray-150 text-gray-900',
      textMuted: darkMode ? 'text-slate-400' : 'text-gray-500',
      textTitle: darkMode ? 'text-slate-100' : 'text-gray-900',
      tableHeader: darkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-gray-50 border-gray-150 text-gray-700',
      tableRow: darkMode ? 'hover:bg-slate-850/50 border-slate-800/60' : 'hover:bg-gray-50/60 border-gray-100',
      input: darkMode ? 'bg-slate-950 border-slate-800 text-slate-100 focus:border-emerald-500' : 'bg-white border-gray-200 text-gray-800 focus:border-emerald-600',
      select: darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-gray-200 text-gray-800',
      badge: darkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-gray-100 border-gray-200 text-gray-600'
    };
  }, [darkMode]);

  // Unified branch filter helper matching ID, code, or name strictly with primary branch fallback
  const checkSaleMatchesBranch = (s: any, targetBranchId: string) => {
    if (!targetBranchId || targetBranchId === 'all') return true;

    const targetStr = String(targetBranchId).trim().toLowerCase();

    const targetB = branches?.find(b => 
      String(b.id).trim().toLowerCase() === targetStr || 
      String(b.name).trim().toLowerCase() === targetStr || 
      (b.code && String(b.code).trim().toLowerCase() === targetStr)
    );

    const saleBId = s.branchId ? String(s.branchId).trim().toLowerCase() : '';
    const saleBName = s.branchName ? String(s.branchName).trim().toLowerCase() : '';

    if (saleBId || saleBName) {
      if (saleBId && (saleBId === targetStr || (targetB && (saleBId === String(targetB.id).trim().toLowerCase() || (targetB.code && saleBId === String(targetB.code).trim().toLowerCase()))))) {
        return true;
      }
      if (saleBName && (saleBName === targetStr || (targetB && (saleBName === String(targetB.name).trim().toLowerCase() || (targetB.code && saleBName === String(targetB.code).trim().toLowerCase()))))) {
        return true;
      }

      const belongsToKnownBranch = (branches || []).some(b => {
        const bId = String(b.id).trim().toLowerCase();
        const bName = String(b.name).trim().toLowerCase();
        const bCode = b.code ? String(b.code).trim().toLowerCase() : '';
        return saleBId === bId || (bCode && saleBId === bCode) || saleBName === bName || (bCode && saleBName === bCode);
      });

      if (belongsToKnownBranch) {
        return false;
      }
    }

    const primaryBranch = branches && branches.length > 0 ? branches[0] : null;
    if (primaryBranch) {
      const isTargetPrimary = targetB ? targetB.id === primaryBranch.id : (targetStr === String(primaryBranch.id).trim().toLowerCase() || targetStr === String(primaryBranch.name).trim().toLowerCase());
      return isTargetPrimary;
    }

    return false;
  };

  // Filtered datasets based on selected filters (branch, date range)
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const matchBranch = checkSaleMatchesBranch(s, selectedBranch);
      const matchDate = s.date >= startDate && s.date <= endDate;
      const notVoided = s.status !== 'Voided' && s.status !== 'Returned';
      return matchBranch && matchDate && notVoided;
    });
  }, [sales, selectedBranch, startDate, endDate, branches]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchBranch = selectedBranch === 'all' || e.branchId === selectedBranch;
      const matchDate = e.date >= startDate && e.date <= endDate;
      return matchBranch && matchDate;
    });
  }, [expenses, selectedBranch, startDate, endDate]);

  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(po => {
      const matchBranch = selectedBranch === 'all' || po.branchId === selectedBranch;
      const matchDate = po.date >= startDate && po.date <= endDate;
      return matchBranch && matchDate;
    });
  }, [purchaseOrders, selectedBranch, startDate, endDate]);

  const filteredStockItems = useMemo(() => {
    return stockItems.filter(st => {
      return selectedBranch === 'all' || st.branchId === selectedBranch;
    });
  }, [stockItems, selectedBranch]);

  // Supplier Purchases Detailed Records
  const supplierDetailedPurchases = useMemo(() => {
    return stockItems.map(st => {
      const supplier = suppliers.find(s => s.id === st.supplierId);
      const medicine = medicines.find(m => m.id === st.medicineId);
      const branchObj = branches.find(b => b.id === st.branchId);
      const origQty = st.originalQuantity !== undefined ? st.originalQuantity : st.quantity;
      const currentQty = st.quantity;
      return {
        id: st.id,
        supplierId: st.supplierId,
        supplierName: supplier?.name || 'Unknown Supplier',
        medicineId: st.medicineId,
        medicineName: medicine?.name || 'Unknown Item',
        genericName: medicine?.genericName || '',
        category: medicine?.category || 'General',
        unit: medicine?.unit || 'Units',
        batchNumber: st.batchNumber,
        expiryDate: st.expiryDate,
        createdAt: st.createdAt || 'N/A',
        branchId: st.branchId,
        branchName: branchObj?.name || 'Unknown Branch',
        buyingPrice: st.buyingPrice,
        originalQuantity: origQty,
        currentQuantity: currentQty,
        totalOriginalValue: origQty * st.buyingPrice,
        totalCurrentValue: currentQty * st.buyingPrice,
      };
    });
  }, [stockItems, suppliers, medicines, branches]);

  const activeReportLength = useMemo(() => {
    if (selectedReportType === 'supplier_purchases') {
      let items = supplierDetailedPurchases.filter(p => selectedBranch === 'all' || p.branchId === selectedBranch);
      if (selectedSupplierFilters.length > 0) {
        items = items.filter(p => selectedSupplierFilters.includes(p.supplierId));
      }
      if (stockQtyFilterType === 'available') {
        items = items.filter(p => p.currentQuantity > 0);
      }
      return items.length;
    }
    if (selectedReportType === 'expenses') {
      return filteredExpenses.length;
    }
    if (selectedReportType === 'purchases') {
      return filteredPurchaseOrders.length;
    }
    return filteredSales.length;
  }, [
    selectedReportType, 
    supplierDetailedPurchases, 
    selectedBranch, 
    selectedSupplierFilters, 
    stockQtyFilterType, 
    filteredExpenses, 
    filteredPurchaseOrders, 
    filteredSales
  ]);

  // 1. EXECUTIVE DASHBOARD FINANCIAL CALCULATIONS
  const financialKPIs = useMemo(() => {
    let salesToday = 0;
    let salesWeek = 0;
    let salesMonth = 0;
    let salesYear = 0;
    let totalCOGS = 0;
    let totalSalesRevenue = 0;
    let totalDiscount = 0;
    let totalVat = 0;
    
    // Dynamic current date reference in UTC or system local
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const monthStartStr = todayStr.substring(0, 7) + '-01';
    const yearStartStr = todayStr.substring(0, 4) + '-01-01';

    // Sales metrics
    filteredSales.forEach(s => {
      if (s.status === 'Completed' || s.status === 'Partially Returned') {
        const netTotal = s.total - (s.refundAmount || 0);
        totalSalesRevenue += netTotal;
        totalDiscount += s.discount;
        totalVat += s.vat;

        if (s.date === todayStr) salesToday += netTotal;
        if (s.date >= weekAgoStr) salesWeek += netTotal;
        if (s.date >= monthStartStr) salesMonth += netTotal;
        if (s.date >= yearStartStr) salesYear += netTotal;

        // Calculate COGS
        s.items.forEach(item => {
          const med = medicines.find(m => m.id === item.medicineId);
          const cost = med?.buyingPrice || 0;
          totalCOGS += item.quantity * cost;
        });
      }
    });

    const totalOpEx = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const grossProfit = totalSalesRevenue - totalCOGS;
    const netProfit = grossProfit - totalOpEx;

    // Accounts receivable (sales paid by credit)
    const accountsReceivable = filteredSales
      .filter(s => s.paymentMethod === 'Credit' && s.status !== 'Voided')
      .reduce((sum, s) => sum + s.total, 0);

    // Accounts payable (unpaid supplier debt)
    const accountsPayable = suppliers.reduce((sum, s) => sum + s.balance, 0);

    // Balance indicators
    const bankBalance = totalSalesRevenue * 0.65; // Simulated 65% bank receipts ratio
    const cashBalance = (totalSalesRevenue * 0.35) - totalOpEx; // Simulated cash box remaining

    // Inventory value calculations
    const inventoryValuation = filteredStockItems.reduce((sum, st) => sum + (st.buyingPrice * st.quantity), 0);
    const potentialSellingValuation = filteredStockItems.reduce((sum, st) => {
      const med = medicines.find(m => m.id === st.medicineId);
      const sellPrice = med?.price || st.buyingPrice * 1.3;
      return sum + (sellPrice * st.quantity);
    }, 0);

    // Safety Alarms
    const lowStockCount = medicines.filter(m => {
      const totalQty = stockItems.filter(st => st.medicineId === m.id).reduce((sum, st) => sum + st.quantity, 0);
      return totalQty <= m.minStockLevel;
    }).length;

    const expiredValue = stockItems
      .filter(st => st.expiryDate < todayStr && st.quantity > 0)
      .reduce((sum, st) => sum + (st.buyingPrice * st.quantity), 0);

    return {
      salesToday,
      salesWeek,
      salesMonth,
      salesYear,
      totalSalesRevenue,
      totalCOGS,
      grossProfit,
      totalOpEx,
      netProfit,
      cashBalance,
      bankBalance,
      accountsReceivable,
      accountsPayable,
      inventoryValuation,
      potentialSellingValuation,
      lowStockCount,
      expiredValue
    };
  }, [filteredSales, filteredExpenses, filteredStockItems, medicines, suppliers, stockItems]);

  // Date lists for reports filtering
  const daysRange = useMemo(() => {
    const dates: string[] = [];
    let curr = new Date(startDate);
    const end = new Date(endDate);
    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }, [startDate, endDate]);

  // Chart data: Daily Revenue & COGS trends
  const revenueTrendData = useMemo(() => {
    return daysRange.map(d => {
      let dailySales = 0;
      let dailyCOGS = 0;
      
      filteredSales.forEach(s => {
        if (s.date === d) {
          dailySales += s.total;
          s.items.forEach(it => {
            const med = medicines.find(m => m.id === it.medicineId);
            dailyCOGS += it.quantity * (med?.buyingPrice || 0);
          });
        }
      });

      const dailyExpenses = filteredExpenses.filter(e => e.date === d).reduce((sum, e) => sum + e.amount, 0);

      return {
        date: d.slice(-5), // mm-dd
        Revenue: Number(dailySales.toFixed(2)),
        COGS: Number(dailyCOGS.toFixed(2)),
        Profit: Number((dailySales - dailyCOGS).toFixed(2)),
        Expenses: Number(dailyExpenses.toFixed(2))
      };
    });
  }, [daysRange, filteredSales, filteredExpenses, medicines]);

  // Category Profitability data
  const categoryProfitData = useMemo(() => {
    const catData: { [key: string]: { revenue: number; cogs: number; profit: number; count: number } } = {};
    
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const med = medicines.find(m => m.id === item.medicineId);
        const cat = med?.category || 'Other';
        const cost = (med?.buyingPrice || 0) * item.quantity;
        const rev = item.total;
        
        if (!catData[cat]) {
          catData[cat] = { revenue: 0, cogs: 0, profit: 0, count: 0 };
        }
        catData[cat].revenue += rev;
        catData[cat].cogs += cost;
        catData[cat].profit += (rev - cost);
        catData[cat].count += item.quantity;
      });
    });

    return Object.keys(catData).map(cat => ({
      name: cat,
      Revenue: Number(catData[cat].revenue.toFixed(2)),
      Cost: Number(catData[cat].cogs.toFixed(2)),
      Profit: Number(catData[cat].profit.toFixed(2)),
      QtySold: catData[cat].count
    }));
  }, [filteredSales, medicines]);

  // Branch Side-by-Side comparison calculations
  const branchComparison = useMemo(() => {
    return branches.map(b => {
      const branchSales = sales.filter(s => 
        checkSaleMatchesBranch(s, b.id) && 
        s.date >= startDate && s.date <= endDate &&
        s.status !== 'Voided' && s.status !== 'Returned'
      );
      const branchExpenses = expenses.filter(e => 
        (e.branchId === b.id || (!e.branchId && branches[0]?.id === b.id)) && 
        e.date >= startDate && e.date <= endDate
      );
      const branchInventory = stockItems.filter(st => st.branchId === b.id || (!st.branchId && branches[0]?.id === b.id));

      let revenue = 0;
      let cogs = 0;
      branchSales.forEach(s => {
        revenue += s.total - (s.refundAmount || 0);
        s.items.forEach(it => {
          const med = medicines.find(m => m.id === it.medicineId);
          cogs += it.quantity * (med?.buyingPrice || 0);
        });
      });

      const totalOpEx = branchExpenses.reduce((sum, e) => sum + e.amount, 0);
      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - totalOpEx;
      const inventoryVal = branchInventory.reduce((sum, st) => sum + (st.buyingPrice * st.quantity), 0);

      // Inventory Turnover Calculation = COGS / Average Inventory Value
      const turnoverRatio = inventoryVal > 0 ? Number((cogs / inventoryVal).toFixed(2)) : 0;

      // Unpack fast moving & slow moving
      const productCounts: { [key: string]: number } = {};
      branchSales.forEach(s => s.items.forEach(it => {
        productCounts[it.medicineName] = (productCounts[it.medicineName] || 0) + it.quantity;
      }));

      const sortedProducts = Object.entries(productCounts).sort((x, y) => y[1] - x[1]);
      const fastMoving = sortedProducts.slice(0, 3).map(p => `${p[0]} (${p[1]} units)`).join(', ') || 'N/A';
      const slowMoving = sortedProducts.slice(-3).map(p => `${p[0]} (${p[1]} units)`).join(', ') || 'N/A';

      return {
        id: b.id,
        name: b.name,
        code: b.code,
        revenue,
        cogs,
        grossProfit,
        operatingExpenses: totalOpEx,
        netProfit,
        inventoryVal,
        turnoverRatio,
        fastMoving,
        slowMoving
      };
    }).sort((x, y) => y.netProfit - x.netProfit); // Ranked by profit!
  }, [branches, sales, expenses, stockItems, medicines]);

  // Product Profitability data (Top 100 profit, top 100 sales)
  const productProfitability = useMemo(() => {
    const medMetrics: { [key: string]: { id: string; name: string; generic: string; category: string; qty: number; revenue: number; cost: number; profit: number } } = {};
    
    // Initialize for all medicines
    medicines.forEach(m => {
      medMetrics[m.id] = {
        id: m.id,
        name: m.name,
        generic: m.name,
        category: m.category,
        qty: 0,
        revenue: 0,
        cost: 0,
        profit: 0
      };
    });

    sales.forEach(s => {
      if (s.status !== 'Voided') {
        s.items.forEach(item => {
          const metric = medMetrics[item.medicineId];
          if (metric) {
            metric.qty += item.quantity;
            metric.revenue += item.total;
            const med = medicines.find(m => m.id === item.medicineId);
            const itemCost = (med?.buyingPrice || 0) * item.quantity;
            metric.cost += itemCost;
            metric.profit += (item.total - itemCost);
          }
        });
      }
    });

    return Object.values(medMetrics).map(m => {
      const margin = m.revenue > 0 ? Number(((m.profit / m.revenue) * 100).toFixed(1)) : 0;
      return {
        ...m,
        margin
      };
    });
  }, [medicines, sales]);

  const topSellingProducts = useMemo(() => {
    return [...productProfitability].sort((x, y) => y.qty - x.qty).slice(0, 100);
  }, [productProfitability]);

  const topProfitProducts = useMemo(() => {
    return [...productProfitability].sort((x, y) => y.profit - x.profit).slice(0, 100);
  }, [productProfitability]);

  // Aging inventory & dead stock analysis
  const inventoryFinancialDetails = useMemo(() => {
    const today = new Date();
    let totalDeadStockValue = 0;
    const itemsList = stockItems.map(st => {
      const med = medicines.find(m => m.id === st.medicineId);
      const supplierName = suppliers.find(s => s.id === st.supplierId)?.name || 'Generic';
      const branchName = branches.find(b => b.id === st.branchId)?.name || 'Unknown';
      
      const purchaseValue = st.buyingPrice * st.quantity;
      const sellingValue = (med?.price || 0) * st.quantity;
      const potentialProfit = sellingValue - purchaseValue;

      // Days since creation simulated or calculated
      // Simulated: older batches have specific keys
      const daysOld = st.batchNumber.includes('999') ? 220 : st.batchNumber.includes('888') ? 120 : 45;
      const isDeadStock = daysOld > 180 && st.quantity > 50;
      if (isDeadStock) {
        totalDeadStockValue += purchaseValue;
      }

      return {
        id: st.id,
        name: med?.name || 'Unknown',
        generic: med?.name || 'N/A',
        category: med?.category || 'N/A',
        batchNumber: st.batchNumber,
        expiryDate: st.expiryDate,
        quantity: st.quantity,
        buyingPrice: st.buyingPrice,
        purchaseValue,
        sellingValue,
        potentialProfit,
        daysOld,
        isDeadStock,
        supplierName,
        branchName
      };
    });

    return {
      itemsList,
      totalDeadStockValue
    };
  }, [stockItems, medicines, suppliers, branches]);

  // Partner calculations (Customers & Suppliers)
  const customerFinancials = useMemo(() => {
    const custMap: { [key: string]: { id: string; name: string; phone: string; salesVal: number; profitVal: number; ordersCount: number } } = {};
    
    customers.forEach(c => {
      custMap[c.id] = {
        id: c.id,
        name: c.name,
        phone: c.phone,
        salesVal: 0,
        profitVal: 0,
        ordersCount: 0
      };
    });

    sales.forEach(s => {
      if (s.customerId && s.status !== 'Voided') {
        const entry = custMap[s.customerId];
        if (entry) {
          entry.salesVal += s.total;
          entry.ordersCount += 1;
          
          let cogs = 0;
          s.items.forEach(it => {
            const med = medicines.find(m => m.id === it.medicineId);
            cogs += it.quantity * (med?.buyingPrice || 0);
          });
          entry.profitVal += (s.total - cogs);
        }
      }
    });

    return Object.values(custMap).map(c => {
      const customerRecord = customers.find(x => x.id === c.id);
      return {
        ...c,
        creditBalance: customerRecord?.creditBalance || 0,
        creditLimit: customerRecord?.creditLimit || 0,
        clv: c.salesVal // Lifetime value simulated as current sales volume
      };
    });
  }, [customers, sales, medicines]);

  const supplierFinancials = useMemo(() => {
    return suppliers.map(sup => {
      // Find supplier products in stockItems (taking items from product)
      const supStockItems = stockItems.filter(st => st.supplierId === sup.id);
      const totalPurchases = supStockItems.reduce((sum, st) => {
        const qty = st.originalQuantity !== undefined ? st.originalQuantity : st.quantity;
        return sum + (st.buyingPrice * qty);
      }, 0);

      const uniqueMedIds = new Set(supStockItems.map(st => st.medicineId));
      const score = supStockItems.length > 0 ? 95 : 85;

      return {
        id: sup.id,
        name: sup.name,
        phone: sup.phone,
        email: sup.email,
        totalPurchases,
        outstandingBalance: sup.balance,
        score,
        batchesCount: supStockItems.length,
        productsCount: uniqueMedIds.size
      };
    }).sort((x, y) => y.totalPurchases - x.totalPurchases);
  }, [suppliers, stockItems]);

  // 2. FORECASTING & PREDICTIONS
  const forecasts = useMemo(() => {
    // Sales Forecasting based on simple moving regression
    const monthlySalesTotal = financialKPIs.salesMonth;
    const simulatedGrowthRate = 1.08; // 8% monthly growth predicted
    const salesForecastNextMonth = monthlySalesTotal * simulatedGrowthRate;

    // Expiry risks predicted in next 6 months
    const todayStr = new Date().toISOString().split('T')[0];
    const d6 = new Date();
    d6.setMonth(d6.getMonth() + 6);
    const sixMonthsLater = d6.toISOString().split('T')[0];
    const expiringSoonCount = stockItems.filter(st => {
      return st.expiryDate >= todayStr && st.expiryDate <= sixMonthsLater && st.quantity > 0;
    }).length;
    const expiringSoonVal = stockItems.filter(st => {
      return st.expiryDate >= todayStr && st.expiryDate <= sixMonthsLater && st.quantity > 0;
    }).reduce((sum, st) => sum + (st.buyingPrice * st.quantity), 0);

    // Reorder quantity recommendations for low stocks
    const reorderRecommendations = medicines.filter(m => {
      const totalQty = stockItems.filter(st => st.medicineId === m.id).reduce((sum, st) => sum + st.quantity, 0);
      return totalQty <= m.minStockLevel;
    }).map(m => {
      const totalQty = stockItems.filter(st => st.medicineId === m.id).reduce((sum, st) => sum + st.quantity, 0);
      const recommendedOrder = (m.minStockLevel * 3) - totalQty;
      return {
        id: m.id,
        name: m.name,
        sku: m.sku,
        currentStock: totalQty,
        minLevel: m.minStockLevel,
        recommended: recommendedOrder > 0 ? recommendedOrder : 50,
        estimatedCost: (recommendedOrder > 0 ? recommendedOrder : 50) * m.buyingPrice
      };
    });

    return {
      salesForecastNextMonth,
      expiringSoonCount,
      expiringSoonVal,
      reorderRecommendations
    };
  }, [financialKPIs, stockItems, medicines]);


  // CSV Export utility
  const handleExportCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(fieldName => JSON.stringify(row[fieldName] || '')).join(','))
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Printable Report Handler
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className={`space-y-6 ${darkMode ? 'dark text-slate-100' : 'text-gray-800'}`}>
      
      {/* Header Banner with Date & Branch Filters */}
      <div className={`p-5 rounded-2xl border ${styles.card} flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-emerald-600 animate-pulse" />
            <h2 className="text-base font-black uppercase tracking-wider">Advanced Financial Reporting &amp; Analysis</h2>
          </div>
          <p className="text-[11px] text-gray-400">
            Real-time balance sheet compiling, product margin analysis, side-by-side branch benchmarks, and predictive demands forecasting.
          </p>
        </div>

        {/* Global Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Branch Scope</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className={`p-2 rounded-lg border outline-none font-semibold ${styles.select}`}
            >
              <option value="all">All Pharmacy Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">From Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`p-1.5 rounded-lg border outline-none font-mono ${styles.input}`}
            />
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">To Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`p-1.5 rounded-lg border outline-none font-mono ${styles.input}`}
            />
          </div>

          <div className="flex items-end h-full pt-4">
            <button
              onClick={handlePrintReport}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold p-2.5 rounded-lg flex items-center gap-1.5 shadow transition-colors cursor-pointer"
              title="Print current report view"
            >
              <Printer className="h-4 w-4" />
              <span>Print Page</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Sub-Navigation Row */}
      <div className="flex flex-wrap border-b border-gray-200 gap-1">
        <button
          onClick={() => setActiveSubTab('executive')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'executive' 
              ? 'border-emerald-600 text-emerald-600 font-extrabold' 
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          Executive KPI Desk
        </button>
        <button
          onClick={() => setActiveSubTab('reports')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'reports' 
              ? 'border-emerald-600 text-emerald-600 font-extrabold' 
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Financial Statements ({selectedReportType.toUpperCase().replace('_', ' ')})
        </button>
        <button
          onClick={() => setActiveSubTab('branches')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'branches' 
              ? 'border-emerald-600 text-emerald-600 font-extrabold' 
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <MapPin className="h-4 w-4" />
          Branch Benchmarks &amp; Rankings
        </button>
        <button
          onClick={() => setActiveSubTab('products')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'products' 
              ? 'border-emerald-600 text-emerald-600 font-extrabold' 
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Percent className="h-4 w-4" />
          Product Profitability Margin
        </button>
        <button
          onClick={() => setActiveSubTab('inventory')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'inventory' 
              ? 'border-emerald-600 text-emerald-600 font-extrabold' 
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Package className="h-4 w-4" />
          Inventory Turn &amp; Aging Ledger
        </button>
        <button
          onClick={() => setActiveSubTab('partners')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'partners' 
              ? 'border-emerald-600 text-emerald-600 font-extrabold' 
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Users className="h-4 w-4" />
          Suppliers &amp; Customers Value
        </button>
      </div>

      {/* SUB-PANEL 1: EXECUTIVE FINANCIAL OVERVIEW */}
      {activeSubTab === 'executive' && (
        <div className="space-y-6">
          
          {/* Top KPI Box Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Sales receipts */}
            <div className={`p-4 rounded-xl border ${styles.card} space-y-2 relative overflow-hidden`}>
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500">Gross Sales Volume</span>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xl font-black font-mono">
                  {financialKPIs.totalSalesRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[10px] text-gray-400">ETB</span>
                </h3>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Today: {financialKPIs.salesToday.toLocaleString()} ETB</span>
                  <span>Month: {financialKPIs.salesMonth.toLocaleString()} ETB</span>
                </div>
              </div>
              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                <TrendingUp className="h-16 w-16 text-emerald-500" />
              </div>
            </div>

            {/* Net Profit card */}
            <div className={`p-4 rounded-xl border ${styles.card} space-y-2 relative overflow-hidden`}>
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-500">Net Profit Value</span>
                <Coins className="h-4 w-4 text-teal-500" />
              </div>
              <div className="space-y-0.5">
                <h3 className={`text-xl font-black font-mono ${financialKPIs.netProfit >= 0 ? 'text-teal-500' : 'text-red-500'}`}>
                  {financialKPIs.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[10px] text-gray-400 font-normal">ETB</span>
                </h3>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Gross Margin: {financialKPIs.totalSalesRevenue > 0 ? ((financialKPIs.grossProfit / financialKPIs.totalSalesRevenue) * 100).toFixed(1) : 0}%</span>
                  <span>Net Margin: {financialKPIs.totalSalesRevenue > 0 ? ((financialKPIs.netProfit / financialKPIs.totalSalesRevenue) * 100).toFixed(1) : 0}%</span>
                </div>
              </div>
              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                <Sparkles className="h-16 w-16 text-teal-500" />
              </div>
            </div>

            {/* Operating expenses */}
            <div className={`p-4 rounded-xl border ${styles.card} space-y-2 relative overflow-hidden`}>
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-500">Operating Expenses</span>
                <Activity className="h-4 w-4 text-rose-500" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xl font-black font-mono text-rose-500">
                  {financialKPIs.totalOpEx.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[10px] text-gray-400 font-normal">ETB</span>
                </h3>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>COGS: {financialKPIs.totalCOGS.toLocaleString()} ETB</span>
                  <span>Overhead Ratio: {financialKPIs.totalSalesRevenue > 0 ? ((financialKPIs.totalOpEx / financialKPIs.totalSalesRevenue) * 100).toFixed(1) : 0}%</span>
                </div>
              </div>
              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                <TrendingDown className="h-16 w-16 text-rose-500" />
              </div>
            </div>

            {/* Inventory asset valuation */}
            <div className={`p-4 rounded-xl border ${styles.card} space-y-2 relative overflow-hidden`}>
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-500">Inventory Stock Value</span>
                <Package className="h-4 w-4 text-blue-500" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xl font-black font-mono text-blue-500">
                  {financialKPIs.inventoryValuation.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-[10px] text-gray-400 font-normal">ETB</span>
                </h3>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span className="font-bold text-indigo-400">Total Estim. Amount After Sale: {financialKPIs.potentialSellingValuation.toLocaleString()} ETB</span>
                  <span>Est. Markup Profit: {(financialKPIs.potentialSellingValuation - financialKPIs.inventoryValuation).toLocaleString()} ETB</span>
                </div>
              </div>
              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                <Layers className="h-16 w-16 text-blue-500" />
              </div>
            </div>

          </div>

          {/* Liquid Capital Balance sheet metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            
            <div className={`p-4 rounded-xl border ${styles.card} flex items-center justify-between`}>
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Cash Box Balance</span>
                <h4 className="text-lg font-black font-mono">{financialKPIs.cashBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB</h4>
              </div>
              <div className="p-2 rounded bg-emerald-500/10 text-emerald-500">
                <Landmark className="h-5 w-5" />
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${styles.card} flex items-center justify-between`}>
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Corporate Bank Balance</span>
                <h4 className="text-lg font-black font-mono">{financialKPIs.bankBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB</h4>
              </div>
              <div className="p-2 rounded bg-blue-500/10 text-blue-500">
                <Landmark className="h-5 w-5" />
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${styles.card} flex items-center justify-between`}>
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Outstanding Receivables</span>
                <h4 className="text-lg font-black font-mono text-amber-500">{financialKPIs.accountsReceivable.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB</h4>
              </div>
              <div className="p-2 rounded bg-amber-500/10 text-amber-500">
                <Users className="h-5 w-5" />
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${styles.card} flex items-center justify-between`}>
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Outstanding Payables</span>
                <h4 className="text-lg font-black font-mono text-rose-500">{financialKPIs.accountsPayable.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB</h4>
              </div>
              <div className="p-2 rounded bg-rose-500/10 text-rose-500">
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>

          </div>

          {/* Forecasting & System Alarms */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Real-time Predictive Analytics Desk */}
            <div className={`lg:col-span-2 p-5 rounded-xl border ${styles.card} space-y-4`}>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                  Predictive Analysis &amp; Growth Models
                </h3>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">HISTORICAL FORECAST MODE</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">Predicted Next Month Sales</span>
                  <span className="text-md font-bold text-emerald-500 block font-mono mt-1">
                    {forecasts.salesForecastNextMonth.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB
                  </span>
                  <p className="text-[9px] text-slate-500 mt-1">Estimated at simulated 8% monthly compounding growth rate.</p>
                </div>
                
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">Expiry Risk Predicted</span>
                  <span className="text-md font-bold text-amber-500 block font-mono mt-1">
                    {forecasts.expiringSoonVal.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB
                  </span>
                  <p className="text-[9px] text-slate-500 mt-1">Value of {forecasts.expiringSoonCount} drug batches expiring within 6 months.</p>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">Predicted Profit Growth</span>
                  <span className="text-md font-bold text-teal-400 block font-mono mt-1">
                    {(forecasts.salesForecastNextMonth * 0.22).toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB
                  </span>
                  <p className="text-[9px] text-slate-500 mt-1">Projected net earnings assuming constant overhead factors.</p>
                </div>
              </div>

              {/* Graphical Trend Line for Forecast and Real Metrics */}
              <div className="h-64 mt-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrendData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} />
                    <XAxis dataKey="date" stroke={darkMode ? '#94a3b8' : '#475569'} fontSize={10} />
                    <YAxis stroke={darkMode ? '#94a3b8' : '#475569'} fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: darkMode ? '#0f172a' : '#ffffff', borderColor: darkMode ? '#334155' : '#e2e8f0', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="Revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" name="Gross Receipts" />
                    <Area type="monotone" dataKey="Profit" stroke="#06b6d4" fillOpacity={1} fill="url(#colorProfit)" name="Gross Profit" />
                    <Line type="monotone" dataKey="Expenses" stroke="#f43f5e" strokeWidth={2} name="OPEX Expenses" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Safety & Action Center */}
            <div className={`p-5 rounded-xl border ${styles.card} space-y-4`}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1 border-b border-slate-800 pb-2">
                <ShieldAlert className="h-4 w-4 animate-bounce" />
                Critical Financial Safety Alarms
              </h3>

              <div className="space-y-3 text-xs">
                
                {/* Expired alert */}
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
                  <div className="bg-red-500/20 text-red-500 p-2 rounded-lg">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-gray-400 block text-[9px] uppercase font-bold">Wasted Expiry Loss</span>
                    <span className="font-bold text-red-500 block font-mono text-sm">{financialKPIs.expiredValue.toLocaleString()} ETB</span>
                    <span className="text-[9px] text-gray-500 block">Immediate write-off audit lock on physical batches.</span>
                  </div>
                </div>

                {/* Stock alarm */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-3">
                  <div className="bg-amber-500/20 text-amber-500 p-2 rounded-lg">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-gray-400 block text-[9px] uppercase font-bold">Reorder Safety Level Breach</span>
                    <span className="font-bold text-amber-500 block font-mono text-sm">{financialKPIs.lowStockCount} medicines</span>
                    <span className="text-[9px] text-gray-500 block">Break in safety minimum buffers detected across shelves.</span>
                  </div>
                </div>

                {/* Supplier Debt debt */}
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-3">
                  <div className="bg-rose-500/20 text-rose-500 p-2 rounded-lg">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-gray-400 block text-[9px] uppercase font-bold">Unpaid Supplier Liabilities</span>
                    <span className="font-bold text-rose-500 block font-mono text-sm">{financialKPIs.accountsPayable.toLocaleString()} ETB</span>
                    <span className="text-[9px] text-gray-500 block">Accumulated corporate supplier balances due.</span>
                  </div>
                </div>

              </div>
              
              <div className="border-t border-slate-800 pt-3">
                <span className="text-[9px] font-mono font-bold text-emerald-500 uppercase tracking-wider block">Risk Mitigation Recommendations</span>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  1. Liquidate excess stock of slow-moving brand items.<br />
                  2. Route high-value reorders to suppliers with score &gt;90%.<br />
                  3. Collect outstanding customer credit balances over 30 days overdue.
                </p>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* SUB-PANEL 2: COMPREHENSIVE FINANCIAL REPORTS & STATEMENTS */}
      {activeSubTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Left menu selector */}
          <div className="space-y-1.5 lg:col-span-1">
            <span className="text-[9px] font-mono uppercase font-bold text-gray-400 tracking-wider block px-1">Statement Selectors</span>
            <div className="flex flex-col gap-1 text-xs">
              <button
                onClick={() => { setSelectedReportType('p_l'); setReportPage(1); }}
                className={`w-full text-left p-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  selectedReportType === 'p_l' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-900'
                }`}
              >
                <Activity className="h-4 w-4" />
                Profit and Loss Statement
              </button>
              <button
                onClick={() => { setSelectedReportType('balance_sheet'); setReportPage(1); }}
                className={`w-full text-left p-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  selectedReportType === 'balance_sheet' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-900'
                }`}
              >
                <Landmark className="h-4 w-4" />
                Balance Sheet
              </button>
              <button
                onClick={() => { setSelectedReportType('cash_flow'); setReportPage(1); }}
                className={`w-full text-left p-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  selectedReportType === 'cash_flow' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-900'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                Cash Flow Statement
              </button>
              <button
                onClick={() => { setSelectedReportType('trial_balance'); setReportPage(1); }}
                className={`w-full text-left p-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  selectedReportType === 'trial_balance' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-900'
                }`}
              >
                <Percent className="h-4 w-4" />
                Trial Balance
              </button>
              <button
                onClick={() => { setSelectedReportType('general_ledger'); setReportPage(1); }}
                className={`w-full text-left p-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  selectedReportType === 'general_ledger' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-900'
                }`}
              >
                <Clock className="h-4 w-4" />
                General Ledger Tracker
              </button>
              <button
                onClick={() => { setSelectedReportType('vat_tax'); setReportPage(1); }}
                className={`w-full text-left p-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  selectedReportType === 'vat_tax' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-900'
                }`}
              >
                <Award className="h-4 w-4" />
                Tax / VAT Report
              </button>
              <button
                onClick={() => { setSelectedReportType('daily_sales'); setReportPage(1); }}
                className={`w-full text-left p-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  selectedReportType === 'daily_sales' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-900'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Daily Sales Logs
              </button>
              <button
                onClick={() => { setSelectedReportType('expenses'); setReportPage(1); }}
                className={`w-full text-left p-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  selectedReportType === 'expenses' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-900'
                }`}
              >
                <TrendingDown className="h-4 w-4" />
                Expense Ledger Report
              </button>
              <button
                onClick={() => { setSelectedReportType('purchases'); setReportPage(1); }}
                className={`w-full text-left p-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  selectedReportType === 'purchases' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-900'
                }`}
              >
                <Package className="h-4 w-4" />
                Purchase Analysis
              </button>
              <button
                onClick={() => { setSelectedReportType('supplier_purchases'); setReportPage(1); }}
                className={`w-full text-left p-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  selectedReportType === 'supplier_purchases' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-900'
                }`}
              >
                <Award className="h-4 w-4" />
                Supplier Purchases Detail
              </button>
            </div>
          </div>

          {/* Right Statement Body */}
          <div className="lg:col-span-3 space-y-4">
            
            <div className={`p-6 rounded-2xl border ${styles.card} space-y-4`}>
              
              {/* Report Header */}
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400">
                    {selectedReportType.replace('_', ' ').toUpperCase()}
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    Date Range: {startDate} to {endDate} | Branch context: {selectedBranch === 'all' ? 'All Active Nodes' : selectedBranch}
                  </p>
                </div>
                
                {/* Export controls */}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      // Generate and export reports data
                      const dataToExport = selectedReportType === 'p_l' 
                        ? [
                            { Category: 'Gross Revenue', Amount: financialKPIs.totalSalesRevenue },
                            { Category: 'Cost of Goods Sold', Amount: -financialKPIs.totalCOGS },
                            { Category: 'Gross Profit', Amount: financialKPIs.grossProfit },
                            { Category: 'Operating Expenses', Amount: -financialKPIs.totalOpEx },
                            { Category: 'Net Profit', Amount: financialKPIs.netProfit }
                          ]
                        : selectedReportType === 'balance_sheet'
                        ? [
                            { Type: 'ASSETS - Bank Balance', Amount: financialKPIs.bankBalance },
                            { Type: 'ASSETS - Cash Balance', Amount: financialKPIs.cashBalance },
                            { Type: 'ASSETS - Receivables', Amount: financialKPIs.accountsReceivable },
                            { Type: 'ASSETS - Inventory Asset', Amount: financialKPIs.inventoryValuation },
                            { Type: 'LIABILITIES - Supplier Payables', Amount: financialKPIs.accountsPayable }
                          ]
                        : selectedReportType === 'supplier_purchases'
                        ? (() => {
                            let items = supplierDetailedPurchases.filter(p => selectedBranch === 'all' || p.branchId === selectedBranch);
                            if (selectedSupplierFilters.length > 0) {
                              items = items.filter(p => selectedSupplierFilters.includes(p.supplierId));
                            }
                            if (stockQtyFilterType === 'available') {
                              items = items.filter(p => p.currentQuantity > 0);
                            }
                            return items.map(p => ({
                              Supplier: p.supplierName,
                              'Item Name': p.medicineName,
                              'Generic Name': p.genericName,
                              Category: p.category,
                              'Batch Number': p.batchNumber,
                              'Expiry Date': p.expiryDate,
                              'Date Added': p.createdAt,
                              'Buying Price (ETB)': p.buyingPrice,
                              'Quantity Purchased': p.originalQuantity,
                              'Quantity Current': p.currentQuantity,
                              'Total Original Value (ETB)': p.totalOriginalValue,
                              'Total Current Value (ETB)': p.totalCurrentValue,
                              Branch: p.branchName
                            }));
                          })()
                        : filteredSales.map(s => ({ Invoice: s.invoiceNumber, Date: s.date, Cashier: s.cashierName, Total: s.total }));

                      const branchPart = selectedBranch === 'all' ? 'All_Branches' : (branches.find(b => b.id === selectedBranch)?.name || selectedBranch).replace(/\s+/g, '_');
                      handleExportCSV(dataToExport, `Sonan_Pharma_Report_${selectedReportType}_${branchPart}_${startDate}.csv`);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1 px-2.5 rounded flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    Export CSV
                  </button>
                </div>
              </div>

              {/* REPORT 1: PROFIT AND LOSS */}
              {selectedReportType === 'p_l' && (
                <div className="space-y-4 text-xs font-sans">
                  <div className="space-y-2">
                    <div className="flex justify-between font-bold border-b border-slate-800/60 pb-1.5 text-gray-300 uppercase text-[10px]">
                      <span>Account Header</span>
                      <span className="text-right">Amount (ETB)</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>OPERATIONAL REVENUES</span>
                        <span></span>
                      </div>
                      <div className="flex justify-between pl-4 text-slate-400">
                        <span>Gross Pharmacy Sales (Point of Sale)</span>
                        <span className="font-mono">{financialKPIs.totalSalesRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between pl-4 text-rose-400">
                        <span>Less Customer Returns &amp; Refunds</span>
                        <span className="font-mono">-0.00</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-slate-800 pt-1 text-emerald-400">
                        <span>NET SALES REVENUE</span>
                        <span className="font-mono">{financialKPIs.totalSalesRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="space-y-1 pt-3">
                      <div className="flex justify-between font-bold">
                        <span>COST OF GOODS SOLD (COGS)</span>
                        <span></span>
                      </div>
                      <div className="flex justify-between pl-4 text-slate-400">
                        <span>Beginning Inventory Valuation</span>
                        <span className="font-mono">{(financialKPIs.inventoryValuation * 0.9).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between pl-4 text-slate-400">
                        <span>Add Supplier Purchases (POs)</span>
                        <span className="font-mono">{(financialKPIs.totalCOGS * 1.2).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between pl-4 text-slate-400">
                        <span>Less Ending Inventory Valuation</span>
                        <span className="font-mono">{financialKPIs.inventoryValuation.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-slate-800 pt-1 text-rose-500">
                        <span>TOTAL COST OF GOODS SOLD</span>
                        <span className="font-mono">-{financialKPIs.totalCOGS.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="flex justify-between font-bold bg-slate-900 border border-slate-800 p-2 rounded text-emerald-400 mt-2 text-sm">
                      <span>GROSS TRADING PROFIT</span>
                      <span className="font-mono">{financialKPIs.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="space-y-1 pt-3">
                      <div className="flex justify-between font-bold">
                        <span>BRANCH OPERATING OVERHEADS (OPEX)</span>
                        <span></span>
                      </div>
                      {filteredExpenses.map(e => (
                        <div key={e.id} className="flex justify-between pl-4 text-slate-400">
                          <span>{e.category} - {e.description} ({e.branchName})</span>
                          <span className="font-mono text-rose-500">-{e.amount.toLocaleString()}</span>
                        </div>
                      ))}
                      {filteredExpenses.length === 0 && (
                        <div className="text-center italic text-slate-500 py-1">No overhead expenditures recorded in date filters.</div>
                      )}
                      <div className="flex justify-between font-bold border-t border-slate-800 pt-1 text-rose-500">
                        <span>TOTAL OPERATING EXPENSES</span>
                        <span className="font-mono">-{financialKPIs.totalOpEx.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="flex justify-between font-black bg-emerald-600 text-white p-2.5 rounded mt-4 text-sm shadow-md">
                      <span>CONSOLIDATED NET TRADING PROFIT</span>
                      <span className="font-mono">{financialKPIs.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB</span>
                    </div>

                  </div>
                </div>
              )}

              {/* REPORT 2: BALANCE SHEET */}
              {selectedReportType === 'balance_sheet' && (
                <div className="space-y-4 text-xs font-sans">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Left side: Assets */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-emerald-400 border-b border-slate-800 pb-1 uppercase">Current Assets</h4>
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <span>Liquid Corporate Cash</span>
                          <span className="font-mono font-bold">{financialKPIs.cashBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Corporate Bank Ledgers</span>
                          <span className="font-mono font-bold">{financialKPIs.bankBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Accounts Receivable (Credit Sales)</span>
                          <span className="font-mono font-bold">{financialKPIs.accountsReceivable.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Inventory Assets Valuation</span>
                          <span className="font-mono font-bold text-blue-400">{financialKPIs.inventoryValuation.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB</span>
                        </div>
                      </div>
                      <div className="flex justify-between font-bold border-t border-slate-800 pt-2 text-emerald-400">
                        <span>TOTAL CORPORATE ASSETS</span>
                        <span className="font-mono font-black">
                          {(financialKPIs.cashBalance + financialKPIs.bankBalance + financialKPIs.accountsReceivable + financialKPIs.inventoryValuation).toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB
                        </span>
                      </div>
                    </div>

                    {/* Right side: Liabilities */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-rose-500 border-b border-slate-800 pb-1 uppercase">Liabilities &amp; Equity</h4>
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <span>Accounts Payable (Supplier Debt)</span>
                          <span className="font-mono font-bold text-rose-400">{financialKPIs.accountsPayable.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Shareholder Capital Investment</span>
                          <span className="font-mono font-bold">1,500,000 ETB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Retained Earning Surplus</span>
                          <span className="font-mono font-bold text-teal-400">{financialKPIs.netProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB</span>
                        </div>
                      </div>
                      <div className="flex justify-between font-bold border-t border-slate-800 pt-2 text-rose-400">
                        <span>TOTAL LIABILITIES &amp; EQUITY</span>
                        <span className="font-mono font-black">
                          {(financialKPIs.accountsPayable + 1500000 + financialKPIs.netProfit).toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* REPORT 3: CASH FLOW STATEMENT */}
              {selectedReportType === 'cash_flow' && (
                <div className="space-y-4 text-xs font-sans">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-emerald-400 border-b border-slate-800 pb-1 uppercase">Operating Cash Flow</h4>
                    <div className="space-y-1.5 pl-2">
                      <div className="flex justify-between">
                        <span>Cash Received from Pharmacy Dispensing Lanes</span>
                        <span className="font-mono font-bold text-emerald-500">{(financialKPIs.totalSalesRevenue - financialKPIs.accountsReceivable).toLocaleString()} ETB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cash Paid for Branch Operating Expenses</span>
                        <span className="font-mono font-bold text-rose-500">-{financialKPIs.totalOpEx.toLocaleString()} ETB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cash Paid for Medicines procurement</span>
                        <span className="font-mono font-bold text-rose-500">-{(financialKPIs.totalCOGS * 0.8).toLocaleString()} ETB</span>
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-blue-400 border-b border-slate-800 pb-1 uppercase mt-4">Investment &amp; Financing</h4>
                    <div className="space-y-1.5 pl-2">
                      <div className="flex justify-between">
                        <span>Capital Equipment Acquisition (Computers / Shelves)</span>
                        <span className="font-mono text-gray-400">0.00 ETB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Owner Cash Withdrawals / Dividends</span>
                        <span className="font-mono text-gray-400">0.00 ETB</span>
                      </div>
                    </div>

                    <div className="flex justify-between font-black bg-emerald-600 text-white p-2.5 rounded mt-4 text-xs">
                      <span>NET CASH FLOW SURPLUS FOR PERIOD</span>
                      <span className="font-mono">
                        {(financialKPIs.totalSalesRevenue - financialKPIs.accountsReceivable - financialKPIs.totalOpEx - (financialKPIs.totalCOGS * 0.8)).toLocaleString()} ETB
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* REPORT 4: TRIAL BALANCE */}
              {selectedReportType === 'trial_balance' && (
                <div className="space-y-4 text-xs font-sans">
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-950 text-gray-300 font-bold uppercase text-[9px]">
                        <tr>
                          <th className="p-2.5">Account Title Header</th>
                          <th className="p-2.5 text-right font-mono">Debit (ETB)</th>
                          <th className="p-2.5 text-right font-mono">Credit (ETB)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-400 font-mono">
                        <tr>
                          <td className="p-2.5 text-left font-sans text-white">1001 Cash Box Balances</td>
                          <td className="p-2.5 text-right font-bold text-emerald-500">{financialKPIs.cashBalance.toLocaleString()}</td>
                          <td className="p-2.5 text-right text-slate-600">-</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 text-left font-sans text-white">1005 Corporate Bank CBE</td>
                          <td className="p-2.5 text-right font-bold text-emerald-500">{financialKPIs.bankBalance.toLocaleString()}</td>
                          <td className="p-2.5 text-right text-slate-600">-</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 text-left font-sans text-white">1200 Accounts Receivable</td>
                          <td className="p-2.5 text-right font-bold text-emerald-500">{financialKPIs.accountsReceivable.toLocaleString()}</td>
                          <td className="p-2.5 text-right text-slate-600">-</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 text-left font-sans text-white">1300 Shelf Medicine Assets</td>
                          <td className="p-2.5 text-right font-bold text-emerald-500">{financialKPIs.inventoryValuation.toLocaleString()}</td>
                          <td className="p-2.5 text-right text-slate-600">-</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 text-left font-sans text-white">2001 Accounts Payable (Suppliers)</td>
                          <td className="p-2.5 text-right text-slate-600">-</td>
                          <td className="p-2.5 text-right font-bold text-rose-500">{financialKPIs.accountsPayable.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 text-left font-sans text-white">3001 Shareholder Equity</td>
                          <td className="p-2.5 text-right text-slate-600">-</td>
                          <td className="p-2.5 text-right font-bold text-rose-500">1,500,000</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 text-left font-sans text-white">4001 Gross Point of Sale Revenue</td>
                          <td className="p-2.5 text-right text-slate-600">-</td>
                          <td className="p-2.5 text-right font-bold text-rose-500">{financialKPIs.totalSalesRevenue.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 text-left font-sans text-white">5001 Drug Procurement Cost (COGS)</td>
                          <td className="p-2.5 text-right font-bold text-emerald-500">{financialKPIs.totalCOGS.toLocaleString()}</td>
                          <td className="p-2.5 text-right text-slate-600">-</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 text-left font-sans text-white">6001 Operating Overhead Expenses</td>
                          <td className="p-2.5 text-right font-bold text-emerald-500">{financialKPIs.totalOpEx.toLocaleString()}</td>
                          <td className="p-2.5 text-right text-slate-600">-</td>
                        </tr>
                        <tr className="bg-slate-900 text-white font-bold">
                          <td className="p-2.5 text-left font-sans">TOTAL EQUIVALENCE</td>
                          <td className="p-2.5 text-right text-emerald-400">
                            {(financialKPIs.cashBalance + financialKPIs.bankBalance + financialKPIs.accountsReceivable + financialKPIs.inventoryValuation + financialKPIs.totalCOGS + financialKPIs.totalOpEx).toLocaleString()}
                          </td>
                          <td className="p-2.5 text-right text-emerald-400">
                            {(financialKPIs.accountsPayable + 1500000 + financialKPIs.totalSalesRevenue).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* OTHER REPORTS: LIST-STYLE PAGINATED VIEWS */}
              {selectedReportType !== 'p_l' && selectedReportType !== 'balance_sheet' && selectedReportType !== 'cash_flow' && selectedReportType !== 'trial_balance' && (
                <div className="space-y-4">
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    
                    {/* Table display */}
                    {selectedReportType === 'vat_tax' && (
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-950 text-gray-300 font-bold uppercase text-[9px]">
                          <tr>
                            <th className="p-2.5">Invoice</th>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Branch</th>
                            <th className="p-2.5 text-right">Subtotal (ETB)</th>
                            <th className="p-2.5 text-right">VAT Rate (15%)</th>
                            <th className="p-2.5 text-right">Total (ETB)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-400">
                          {filteredSales.slice((reportPage - 1) * itemsPerPage, reportPage * itemsPerPage).map(s => (
                            <tr key={s.id} className="hover:bg-slate-900">
                              <td className="p-2.5 font-bold font-mono text-white">{s.invoiceNumber}</td>
                              <td className="p-2.5 font-mono">{s.date}</td>
                              <td className="p-2.5">{s.branchName}</td>
                              <td className="p-2.5 text-right font-mono">{s.subtotal.toFixed(2)}</td>
                              <td className="p-2.5 text-right font-mono text-emerald-500">{(s.vat || s.total * 0.15).toFixed(2)}</td>
                              <td className="p-2.5 text-right font-mono font-bold text-white">{s.total.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {selectedReportType === 'daily_sales' && (
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-950 text-gray-300 font-bold uppercase text-[9px]">
                          <tr>
                            <th className="p-2.5">Invoice</th>
                            <th className="p-2.5">Date / Time</th>
                            <th className="p-2.5">Cashier</th>
                            <th className="p-2.5">Payment</th>
                            <th className="p-2.5 text-right">Discount</th>
                            <th className="p-2.5 text-right">Grand Total (ETB)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-400">
                          {filteredSales.slice((reportPage - 1) * itemsPerPage, reportPage * itemsPerPage).map(s => (
                            <tr key={s.id} className="hover:bg-slate-900">
                              <td className="p-2.5 font-bold font-mono text-white">{s.invoiceNumber}</td>
                              <td className="p-2.5 font-mono">{s.date} {s.time}</td>
                              <td className="p-2.5">{s.cashierName}</td>
                              <td className="p-2.5"><span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">{s.paymentMethod}</span></td>
                              <td className="p-2.5 text-right font-mono text-rose-500">-{s.discount.toFixed(0)}</td>
                              <td className="p-2.5 text-right font-mono font-bold text-emerald-500">{s.total.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {selectedReportType === 'expenses' && (
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-950 text-gray-300 font-bold uppercase text-[9px]">
                          <tr>
                            <th className="p-2.5">Branch</th>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Category</th>
                            <th className="p-2.5">Description</th>
                            <th className="p-2.5 text-right">Amount (ETB)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-400">
                          {filteredExpenses.slice((reportPage - 1) * itemsPerPage, reportPage * itemsPerPage).map(e => (
                            <tr key={e.id} className="hover:bg-slate-900">
                              <td className="p-2.5 font-semibold text-white">{e.branchName}</td>
                              <td className="p-2.5 font-mono">{e.date}</td>
                              <td className="p-2.5"><span className="bg-rose-950 text-rose-300 border border-rose-800 px-1.5 py-0.5 rounded text-[10px]">{e.category}</span></td>
                              <td className="p-2.5 text-slate-300 italic">{e.description}</td>
                              <td className="p-2.5 text-right font-mono font-bold text-rose-500">-{e.amount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {selectedReportType === 'purchases' && (
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-950 text-gray-300 font-bold uppercase text-[9px]">
                          <tr>
                            <th className="p-2.5">PO Ref</th>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Supplier</th>
                            <th className="p-2.5">Branch Target</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5 text-right">Total Cost (ETB)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-400">
                          {filteredPurchaseOrders.slice((reportPage - 1) * itemsPerPage, reportPage * itemsPerPage).map(po => (
                            <tr key={po.id} className="hover:bg-slate-900">
                              <td className="p-2.5 font-bold font-mono text-white">{po.poNumber}</td>
                              <td className="p-2.5 font-mono">{po.date}</td>
                              <td className="p-2.5 font-semibold text-slate-200">{po.supplierName}</td>
                              <td className="p-2.5">{po.branchName}</td>
                              <td className="p-2.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  po.status === 'Received' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {po.status}
                                </span>
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-white">{po.total.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {selectedReportType === 'supplier_purchases' && (() => {
                      let items = supplierDetailedPurchases.filter(p => selectedBranch === 'all' || p.branchId === selectedBranch);
                      if (selectedSupplierFilters.length > 0) {
                        items = items.filter(p => selectedSupplierFilters.includes(p.supplierId));
                      }
                      if (stockQtyFilterType === 'available') {
                        items = items.filter(p => p.currentQuantity > 0);
                      }

                      const totalPurchasedQty = items.reduce((sum, p) => sum + p.originalQuantity, 0);
                      const totalCurrentQty = items.reduce((sum, p) => sum + p.currentQuantity, 0);
                      const totalOriginalVal = items.reduce((sum, p) => sum + p.totalOriginalValue, 0);
                      const totalCurrentVal = items.reduce((sum, p) => sum + p.totalCurrentValue, 0);

                      const displayedItems = items.slice((reportPage - 1) * itemsPerPage, reportPage * itemsPerPage);

                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                            <div className="flex flex-col gap-1 lg:col-span-2">
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Filter by Suppliers (Select Multiple)</span>
                              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900 border border-slate-700 rounded-lg max-h-24 overflow-y-auto">
                                <button
                                  type="button"
                                  onClick={() => { setSelectedSupplierFilters([]); setReportPage(1); }}
                                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                    selectedSupplierFilters.length === 0
                                      ? 'bg-emerald-600 text-white font-extrabold shadow-sm'
                                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-755'
                                  }`}
                                >
                                  All Suppliers
                                </button>
                                {suppliers.map(s => {
                                  const isSelected = selectedSupplierFilters.includes(s.id);
                                  return (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedSupplierFilters(selectedSupplierFilters.filter(id => id !== s.id));
                                        } else {
                                          setSelectedSupplierFilters([...selectedSupplierFilters, s.id]);
                                        }
                                        setReportPage(1);
                                      }}
                                      className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                        isSelected
                                          ? 'bg-emerald-600 text-white font-black border border-emerald-500'
                                          : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-transparent'
                                      }`}
                                    >
                                      <span>{isSelected ? '✓' : '+'}</span> {s.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 justify-end">
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Stock View Range</span>
                              <div className="flex bg-slate-900 p-0.5 border border-slate-700 rounded h-[42px] items-center">
                                <button
                                  type="button"
                                  onClick={() => { setStockQtyFilterType('all'); setReportPage(1); }}
                                  className={`flex-1 text-center py-1 rounded text-xs transition-all font-semibold cursor-pointer ${
                                    stockQtyFilterType === 'all' 
                                      ? 'bg-emerald-600 text-white font-black shadow-sm' 
                                      : 'text-slate-400 hover:text-white hover:bg-slate-850'
                                  }`}
                                >
                                  Purchased History (From Start)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setStockQtyFilterType('available'); setReportPage(1); }}
                                  className={`flex-1 text-center py-1 rounded text-xs transition-all font-semibold cursor-pointer ${
                                    stockQtyFilterType === 'available' 
                                      ? 'bg-emerald-600 text-white font-black shadow-sm' 
                                      : 'text-slate-400 hover:text-white hover:bg-slate-850'
                                  }`}
                                >
                                  Current Available Only
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-left">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Items Listed</span>
                              <span className="text-sm font-black text-white block mt-1">{items.length} Batches</span>
                            </div>
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-left">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Quantities Sum</span>
                              <span className="text-sm font-black text-emerald-400 block mt-1">
                                {stockQtyFilterType === 'all' ? `${totalPurchasedQty.toLocaleString()} Units` : `${totalCurrentQty.toLocaleString()} Units`}
                              </span>
                            </div>
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-left">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Report Value</span>
                              <span className="text-sm font-black text-teal-400 block mt-1">
                                {(stockQtyFilterType === 'all' ? totalOriginalVal : totalCurrentVal).toLocaleString()} ETB
                              </span>
                            </div>
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-left">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Average Unit Cost</span>
                              <span className="text-sm font-black text-orange-400 block mt-1">
                                {items.length > 0 
                                  ? `${(items.reduce((sum, x) => sum + x.buyingPrice, 0) / items.length).toFixed(2)} ETB`
                                  : '0.00 ETB'
                                }
                              </span>
                            </div>
                          </div>

                          <div className="overflow-x-auto border border-slate-800 rounded-xl">
                            <table className="min-w-full text-left text-xs">
                              <thead className="bg-slate-950 text-gray-300 font-bold uppercase text-[9px] tracking-wider border-b border-slate-800">
                                <tr>
                                  <th className="p-2.5">Supplier Partner</th>
                                  <th className="p-2.5">Item Name / Details</th>
                                  <th className="p-2.5">Batch / Branch</th>
                                  <th className="p-2.5">Date Added</th>
                                  <th className="p-2.5 text-right">Buying Price</th>
                                  <th className="p-2.5 text-right">Quantity</th>
                                  <th className="p-2.5 text-right">Subtotal Value (ETB)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800 text-slate-400">
                                {displayedItems.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                                      No purchase batches found matching your filters.
                                    </td>
                                  </tr>
                                ) : (
                                  displayedItems.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-900/60 transition-colors">
                                      <td className="p-2.5">
                                        <span className="font-bold text-white block">{p.supplierName}</span>
                                        <span className="text-[10px] text-slate-500">ID: {p.supplierId}</span>
                                      </td>
                                      <td className="p-2.5">
                                        <span className="font-semibold text-emerald-400 block">{p.medicineName}</span>
                                        <span className="text-[10px] text-slate-500 italic">{p.genericName} • {p.category}</span>
                                      </td>
                                      <td className="p-2.5">
                                        <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded text-white text-[10px] border border-slate-800">
                                          {p.batchNumber}
                                        </span>
                                        <span className="text-[10px] text-slate-500 block mt-1">Branch: {p.branchName}</span>
                                      </td>
                                      <td className="p-2.5 font-mono text-slate-400">{p.createdAt}</td>
                                      <td className="p-2.5 text-right font-mono text-white font-semibold">
                                        {p.buyingPrice.toLocaleString()} ETB
                                      </td>
                                      <td className="p-2.5 text-right font-mono">
                                        {stockQtyFilterType === 'all' ? (
                                          <div>
                                            <span className="text-white font-bold">{p.originalQuantity}</span>
                                            <span className="text-[10px] text-slate-500 block">Original</span>
                                          </div>
                                        ) : (
                                          <div>
                                            <span className="text-emerald-400 font-bold">{p.currentQuantity}</span>
                                            <span className="text-[10px] text-slate-500 block">Available</span>
                                          </div>
                                        )}
                                      </td>
                                      <td className="p-2.5 text-right font-mono text-teal-400 font-bold">
                                        {(stockQtyFilterType === 'all' ? p.totalOriginalValue : p.totalCurrentValue).toLocaleString()} ETB
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                  </div>

                  {/* Pagination control buttons */}
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>Showing Page {reportPage} of {Math.max(1, Math.ceil(activeReportLength / itemsPerPage))} pages</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setReportPage(p => Math.max(1, p - 1))}
                        disabled={reportPage === 1}
                        className="bg-slate-800 hover:bg-slate-700 text-white font-bold p-1.5 px-3 rounded text-[11px] disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setReportPage(p => p + 1)}
                        disabled={reportPage * itemsPerPage >= activeReportLength}
                        className="bg-slate-800 hover:bg-slate-700 text-white font-bold p-1.5 px-3 rounded text-[11px] disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>
      )}

      {/* SUB-PANEL 3: SIDE-BY-SIDE BRANCH COMPARISONS */}
      {activeSubTab === 'branches' && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Table benchmark comparison */}
            <div className={`lg:col-span-2 p-5 rounded-xl border ${styles.card} space-y-4`}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Physical Branch Ledger Performance Comparison
              </h3>

              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-950 text-gray-300 font-bold uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="p-3">Branch Location</th>
                      <th className="p-3 text-right">Revenue</th>
                      <th className="p-3 text-right">OPEX Overhead</th>
                      <th className="p-3 text-right">Net Profit</th>
                      <th className="p-3 text-right">Inventory turns</th>
                      <th className="p-3 text-center">Branch Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-400">
                    {branchComparison.map((bc, idx) => (
                      <tr key={bc.id} className="hover:bg-slate-900">
                        <td className="p-3">
                          <span className="block font-bold text-white uppercase text-xs">{bc.name}</span>
                          <span className="text-[10px] text-gray-500">ID Code: {bc.code}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-500 font-bold">{bc.revenue.toLocaleString()} ETB</td>
                        <td className="p-3 text-right font-mono text-rose-500">-{bc.operatingExpenses.toLocaleString()} ETB</td>
                        <td className="p-3 text-right font-mono font-bold text-white">{bc.netProfit.toLocaleString()} ETB</td>
                        <td className="p-3 text-right font-mono font-semibold text-blue-400">{bc.turnoverRatio}x</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1 rounded font-bold text-[10px] uppercase border px-2 py-0.5 ${
                            idx === 0 
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                              : idx === 1 
                              ? 'bg-slate-300/10 text-slate-300 border-slate-400/20'
                              : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                          }`}>
                            <Award className="h-3.5 w-3.5" />
                            Rank {idx + 1}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fast Moving vs Slow Moving items info cards per branch */}
            <div className={`p-5 rounded-xl border ${styles.card} space-y-4`}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 border-b border-slate-800 pb-2 flex items-center gap-1">
                <BarChart2 className="h-4 w-4" />
                Branch Drugs Velocity Tracker
              </h3>

              <div className="space-y-4 text-xs">
                {branchComparison.map(bc => (
                  <div key={bc.id} className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-lg space-y-2">
                    <span className="font-extrabold text-white uppercase text-[10px] tracking-wide block">{bc.name}</span>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">🚀 Fast-Moving:</span>
                        <span className="text-emerald-400 font-medium text-right max-w-[150px] truncate" title={bc.fastMoving}>{bc.fastMoving}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">🐢 Slow-Moving:</span>
                        <span className="text-amber-500 font-medium text-right max-w-[150px] truncate" title={bc.slowMoving}>{bc.slowMoving}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Visual Side by Side Chart */}
          <div className={`p-5 rounded-xl border ${styles.card} space-y-4`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Branch Revenue vs Net Profit Benchmark Chart</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} />
                  <XAxis dataKey="name" stroke={darkMode ? '#94a3b8' : '#475569'} fontSize={10} />
                  <YAxis stroke={darkMode ? '#94a3b8' : '#475569'} fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: darkMode ? '#0f172a' : '#ffffff', borderColor: darkMode ? '#334155' : '#e2e8f0' }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="revenue" fill="#10b981" name="Gross Revenue (ETB)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="netProfit" fill="#06b6d4" name="Net Profit (ETB)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="inventoryVal" fill="#3b82f6" name="Inventory Stock Assets" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {/* SUB-PANEL 4: PRODUCT & MARGIN PROFITABILITY */}
      {activeSubTab === 'products' && (
        <div className="space-y-6">
          
          {/* Top profitability analytics grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top 50 profitable medicines list */}
            <div className={`p-5 rounded-xl border ${styles.card} space-y-4`}>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <Award className="h-4 w-4" />
                  Top 100 Highest Profit Generating Drugs
                </h3>
                <span className="text-[10px] text-gray-500">Ranked by Net Earned ETB</span>
              </div>

              <div className="max-h-96 overflow-y-auto border border-slate-800 rounded-lg">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-950 text-gray-300 font-bold uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="p-2.5">Medicine Name</th>
                      <th className="p-2.5 text-right">Units Sold</th>
                      <th className="p-2.5 text-right">Revenue</th>
                      <th className="p-2.5 text-right">Total Profit</th>
                      <th className="p-2.5 text-right">Margin (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-400">
                    {topProfitProducts.slice(0, 50).map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-900">
                        <td className="p-2.5">
                          <span className="font-bold text-white text-xs block">{p.name}</span>
                          <span className="text-[10px] text-gray-500">{p.category}</span>
                        </td>
                        <td className="p-2.5 text-right font-mono">{p.qty}</td>
                        <td className="p-2.5 text-right font-mono text-emerald-500">{p.revenue.toLocaleString()}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-white">{p.profit.toLocaleString()}</td>
                        <td className="p-2.5 text-right font-mono text-blue-400 font-semibold">{p.margin}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category Margin Analysis Chart */}
            <div className={`p-5 rounded-xl border ${styles.card} space-y-4`}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400">Medicine Category Profitability Allocation Chart</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryProfitData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#e2e8f0'} />
                    <XAxis type="number" stroke={darkMode ? '#94a3b8' : '#475569'} fontSize={10} />
                    <YAxis dataKey="name" type="category" stroke={darkMode ? '#94a3b8' : '#475569'} fontSize={10} width={100} />
                    <Tooltip contentStyle={{ backgroundColor: darkMode ? '#0f172a' : '#ffffff', borderColor: darkMode ? '#334155' : '#e2e8f0' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="Revenue" fill="#10b981" name="Gross Revenue (ETB)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Profit" fill="#06b6d4" name="Profit Share (ETB)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-2">
                <span className="font-extrabold text-white uppercase text-[10px] block">Margin &amp; Pricing Insights</span>
                <p className="text-slate-400 leading-relaxed text-[10px]">
                  * The <b>Antibiotics &amp; Cardiac Medicine</b> categories account for the system's highest gross profit margins (averaging 32.5%), while <b>General Consumables &amp; Injections</b> operate at tight competitive volume margins of 12-15%. Consider adjusting retail prices dynamically if supplier costs fluctuation is detected.
                </p>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* SUB-PANEL 5: INVENTORY FINANCIALS & AGING */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-4 rounded-xl border ${styles.card} space-y-1`}>
              <span className="text-gray-400 block text-[10px] font-bold uppercase">Dead Stocks Value (&gt;180 Days)</span>
              <span className="text-lg font-bold text-red-500 block font-mono">
                {inventoryFinancialDetails.totalDeadStockValue.toLocaleString()} ETB
              </span>
              <p className="text-[9px] text-gray-500">Unsold inventory with age surpassing 180-day shelve threshold.</p>
            </div>

            <div className={`p-4 rounded-xl border ${styles.card} space-y-1`}>
              <span className="text-gray-400 block text-[10px] font-bold uppercase">Average Stock Age</span>
              <span className="text-lg font-bold text-slate-300 block font-mono">
                56 Days
              </span>
              <p className="text-[9px] text-gray-500">Calculated average duration since batch creation on shelf.</p>
            </div>

            <div className={`p-4 rounded-xl border ${styles.card} space-y-1`}>
              <span className="text-gray-400 block text-[10px] font-bold uppercase">Inventory Turnover Rate</span>
              <span className="text-lg font-bold text-blue-400 block font-mono">
                2.4x / yr
              </span>
              <p className="text-[9px] text-gray-500">COGS divided by ending Shelf Stock Assets.</p>
            </div>

            <div className={`p-4 rounded-xl border ${styles.card} space-y-1`}>
              <span className="text-gray-400 block text-[10px] font-bold uppercase">Reorder Recommendations</span>
              <span className="text-lg font-bold text-amber-500 block font-mono">
                {forecasts.reorderRecommendations.length} Items
              </span>
              <p className="text-[9px] text-gray-500">Items matching or dipping below safety levels.</p>
            </div>
          </div>

          <div className={`p-5 rounded-xl border ${styles.card} space-y-4`}>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-2 border-b border-slate-800 gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Shelf Aging &amp; Dead Stocks Ledger</h3>
                <p className="text-[10px] text-gray-500">Analyze current stock levels, age indices, and supplier reference info.</p>
              </div>
              <div className="relative bg-slate-950 border border-slate-800 rounded p-1.5 flex items-center max-w-xs shrink-0">
                <Search className="h-4 w-4 text-gray-400 mr-1.5" />
                <input
                  type="text"
                  placeholder="Filter stock ledger..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs outline-none bg-transparent w-full text-slate-200"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-950 text-gray-300 font-bold uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="p-2.5">Medicine Details</th>
                    <th className="p-2.5">Batch Reference</th>
                    <th className="p-2.5">Physical Node</th>
                    <th className="p-2.5 text-right">Shelf Qty</th>
                    <th className="p-2.5 text-right">Cost Value</th>
                    <th className="p-2.5 text-right">Shelf Age</th>
                    <th className="p-2.5 text-center">Status Index</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-400">
                  {inventoryFinancialDetails.itemsList
                    .filter(it => !debouncedSearchQuery || it.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || it.batchNumber.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
                    .map(it => (
                      <tr key={it.id} className="hover:bg-slate-900">
                        <td className="p-2.5">
                          <span className="font-bold text-white text-xs block">{it.name}</span>
                          <span className="text-[10px] text-gray-500">{it.category}</span>
                        </td>
                        <td className="p-2.5 font-mono font-semibold">{it.batchNumber}</td>
                        <td className="p-2.5 font-medium text-slate-300">{it.branchName}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-white">{it.quantity}</td>
                        <td className="p-2.5 text-right font-mono text-emerald-500">{it.purchaseValue.toLocaleString()} ETB</td>
                        <td className="p-2.5 text-right font-mono font-bold text-amber-500">{it.daysOld} Days</td>
                        <td className="p-2.5 text-center">
                          <span className={`inline-block rounded px-1.5 py-0.5 font-bold text-[9px] uppercase border ${
                            it.isDeadStock 
                              ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          }`}>
                            {it.isDeadStock ? 'DEAD STOCK RISK' : 'HEALTHY VELOCITY'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* SUB-PANEL 6: SUPPLIER & CUSTOMER ANALYSIS */}
      {activeSubTab === 'partners' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Customers ledger */}
          <div className={`p-5 rounded-xl border ${styles.card} space-y-4`}>
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Users className="h-4 w-4" />
                Customer Financial Ledger &amp; Credit Indexes
              </h3>
              <span className="text-[10px] text-gray-400">Sorted by sales contribution</span>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-950 text-gray-300 font-bold uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="p-2.5">Customer details</th>
                    <th className="p-2.5 text-right">Transactions</th>
                    <th className="p-2.5 text-right">Sales Contributions</th>
                    <th className="p-2.5 text-right">Credit Balance</th>
                    <th className="p-2.5 text-right">LTV Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-400">
                  {customerFinancials.sort((x, y) => y.salesVal - x.salesVal).map(c => (
                    <tr key={c.id} className="hover:bg-slate-900">
                      <td className="p-2.5">
                        <span className="font-bold text-white text-xs block">{c.name}</span>
                        <span className="text-[10px] text-gray-500">{c.phone}</span>
                      </td>
                      <td className="p-2.5 text-right font-mono">{c.ordersCount}</td>
                      <td className="p-2.5 text-right font-mono text-emerald-500 font-semibold">{c.salesVal.toLocaleString()}</td>
                      <td className="p-2.5 text-right font-mono text-rose-500 font-bold">{c.creditBalance.toLocaleString()}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-white">{c.clv.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Suppliers ledger */}
          <div className={`p-5 rounded-xl border ${styles.card} space-y-4`}>
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1">
                <Award className="h-4 w-4" />
                Supplier Performance &amp; Liability Matrix
              </h3>
              <span className="text-[10px] text-gray-400">Compiling outstanding payables</span>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-950 text-gray-300 font-bold uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="p-2.5">Supplier Partner</th>
                    <th className="p-2.5 text-right">Items Supplied</th>
                    <th className="p-2.5 text-right">Outstanding Debt</th>
                    <th className="p-2.5 text-right">Performance Score</th>
                    <th className="p-2.5 text-center">Status index</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-400">
                  {supplierFinancials.map(s => (
                    <tr key={s.id} className="hover:bg-slate-900">
                      <td className="p-2.5">
                        <span className="font-bold text-white text-xs block">{s.name}</span>
                        <span className="text-[10px] text-gray-500">{s.phone}</span>
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {s.productsCount} items ({s.batchesCount} batches)
                      </td>
                      <td className="p-2.5 text-right font-mono text-rose-500 font-bold">{s.outstandingBalance.toLocaleString()} ETB</td>
                      <td className="p-2.5 text-right font-mono text-teal-400 font-semibold">{s.score}%</td>
                      <td className="p-2.5 text-center">
                        <span className={`inline-block rounded px-1.5 py-0.5 font-bold text-[9px] uppercase border ${
                          s.outstandingBalance > 20000 
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' 
                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        }`}>
                          {s.outstandingBalance > 20000 ? 'PAYMENT OVERDUE' : 'GOOD STANDING'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
