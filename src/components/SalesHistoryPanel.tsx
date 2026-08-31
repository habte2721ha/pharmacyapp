import React, { useState, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { 
  Search, X, Printer, Download, RefreshCw, FileText, 
  Trash2, Filter, DollarSign, Calendar, User, Eye, ArrowDown, HelpCircle, AlertCircle,
  CreditCard, Edit2, FileDown, CheckCircle2, ChevronDown
} from 'lucide-react';
import { Sale, Medicine, User as UserType, Branch } from '../types';
import { generateReceiptPdf } from '../utils/receiptPdfGenerator';

interface SalesHistoryPanelProps {
  currentUser: any;
  onDataChanged: () => void;
  sales?: Sale[];
  medicines?: Medicine[];
  cashiers?: UserType[];
  branches?: Branch[];
  activeBranchId?: string;
}

export default function SalesHistoryPanel({ 
  currentUser, 
  onDataChanged,
  sales: initialSales,
  medicines: initialMedicines,
  cashiers: initialCashiers,
  branches: initialBranches,
  activeBranchId
}: SalesHistoryPanelProps) {
  const [institution, setInstitution] = useState({
    name: 'Sonan Pharmacy',
    address: '',
    phone: '',
    email: '',
    tinNumber: ''
  });

  const [sales, setSales] = useState<Sale[]>(initialSales || []);
  const [medicines, setMedicines] = useState<Medicine[]>(initialMedicines || []);
  const [cashiers, setCashiers] = useState<UserType[]>(initialCashiers || []);
  const [branches, setBranches] = useState<Branch[]>(initialBranches || []);
  const [loading, setLoading] = useState(false);

  // Sync with incoming prop updates
  useEffect(() => {
    if (Array.isArray(initialSales)) setSales(initialSales);
  }, [initialSales]);
  useEffect(() => {
    if (Array.isArray(initialMedicines)) setMedicines(initialMedicines);
  }, [initialMedicines]);
  useEffect(() => {
    if (Array.isArray(initialCashiers)) setCashiers(initialCashiers);
  }, [initialCashiers]);
  useEffect(() => {
    if (Array.isArray(initialBranches)) setBranches(initialBranches);
  }, [initialBranches]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 200);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCashierId, setSelectedCashierId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState((activeBranchId && activeBranchId !== 'all') ? activeBranchId : '');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Medicine' | 'Cosmetics'>('All');
  const [selectedChannel, setSelectedChannel] = useState<'All' | 'In-Store' | 'Online'>('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minQty, setMinQty] = useState('');
  const [maxQty, setMaxQty] = useState('');

  // Selected sale for detailed viewing modal
  const [selectedSaleForModal, setSelectedSaleForModal] = useState<Sale | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate, selectedCashierId, selectedBranchId, selectedPaymentMethod, selectedCategory, selectedChannel, minPrice, maxPrice, minQty, maxQty]);

  // Void Reason state
  const [voidingSaleId, setVoidingSaleId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // PDF receipt downloading state
  const [downloadingPdfSaleId, setDownloadingPdfSaleId] = useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<'standard' | 'thermal'>('standard');

  // Payment method edit state
  const [editingPaymentSale, setEditingPaymentSale] = useState<Sale | null>(null);
  const [newPaymentMethod, setNewPaymentMethod] = useState<string>('Cash');
  const [paymentChangeReason, setPaymentChangeReason] = useState<string>('');
  const [isUpdatingPayment, setIsUpdatingPayment] = useState<boolean>(false);

  // Fetch all necessary data
  const fetchData = async () => {
    if (!initialSales || initialSales.length === 0) {
      setLoading(true);
    }
    try {
      const [salesRes, medRes, userRes, branchRes, instRes] = await Promise.all([
        fetch('/api/sales').then(r => r.ok ? r.json() : null),
        fetch('/api/medicines').then(r => r.ok ? r.json() : null),
        fetch('/api/users').then(r => r.ok ? r.json() : null),
        fetch('/api/branches').then(r => r.ok ? r.json() : null),
        fetch('/api/settings/institution').then(r => r.ok ? r.json() : null)
      ]);
      if (Array.isArray(salesRes)) setSales(salesRes);
      if (Array.isArray(medRes)) setMedicines(medRes);
      if (Array.isArray(userRes)) setCashiers(userRes);
      if (Array.isArray(branchRes)) setBranches(branchRes);
      if (instRes) {
        setInstitution({
          name: instRes.name || 'Sonan Pharmacy',
          address: instRes.address || '',
          phone: instRes.phone || '',
          email: instRes.email || '',
          tinNumber: instRes.tinNumber || ''
        });
      }
    } catch (err) {
      console.error('Failed to load Sales History data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  // Filter Sales list
  const filteredSales = sales.filter(sale => {
    // 1. Text Search query (Invoice number, customer name, TIN, cashier name)
    const matchQuery = !debouncedSearchQuery ? true : (
      sale.invoiceNumber.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      (sale.customerName && sale.customerName.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) ||
      (sale.customerTin && sale.customerTin.includes(debouncedSearchQuery)) ||
      (sale.cashierName && sale.cashierName.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
    );

    // 2. Date filters
    const saleDateStr = sale.date ? String(sale.date).split('T')[0].split(' ')[0] : '';
    const matchStartDate = !startDate ? true : (saleDateStr ? saleDateStr >= startDate : true);
    const matchEndDate = !endDate ? true : (saleDateStr ? saleDateStr <= endDate : true);

    // 3. Cashier filter without cross-branch mixing
    const targetCashier = selectedCashierId ? cashiers.find(c => c.id === selectedCashierId) : null;
    const matchCashier = !selectedCashierId ? true : (
      (sale.cashierId && sale.cashierId === selectedCashierId && (!targetCashier || !targetCashier.branchId || targetCashier.branchId === 'all' || checkSaleMatchesBranch(sale, targetCashier.branchId))) ||
      (targetCashier && sale.cashierName && sale.cashierName.trim().toLowerCase() === targetCashier.name.trim().toLowerCase() && checkSaleMatchesBranch(sale, targetCashier.branchId))
    );

    // 3b. Branch filter
    const matchBranch = checkSaleMatchesBranch(sale, selectedBranchId);

    // 3c. Payment Method filter
    let matchPaymentMethod = true;
    if (selectedPaymentMethod && selectedPaymentMethod !== 'all') {
      const pm = (sale.paymentMethod || '').toLowerCase();
      if (selectedPaymentMethod === 'Cash') {
        matchPaymentMethod = pm === 'cash' || (sale.paymentMethod === 'Split' && !!sale.splitDetails?.cash);
      } else if (selectedPaymentMethod === 'Bank') {
        matchPaymentMethod = pm.includes('bank') || pm.includes('cbe') || pm.includes('boa') || pm.includes('awash') || pm.includes('dashen') ||
          (sale.paymentMethod === 'Split' && (!!sale.splitDetails?.cbe || !!sale.splitDetails?.boa || !!sale.splitDetails?.awash || !!sale.splitDetails?.dashen || !!sale.splitDetails?.other));
      } else if (selectedPaymentMethod === 'Bank CBE') {
        matchPaymentMethod = pm.includes('cbe') || (sale.paymentMethod === 'Split' && !!sale.splitDetails?.cbe);
      } else if (selectedPaymentMethod === 'Bank BOA') {
        matchPaymentMethod = pm.includes('boa') || (sale.paymentMethod === 'Split' && !!sale.splitDetails?.boa);
      } else if (selectedPaymentMethod === 'Bank AWASH') {
        matchPaymentMethod = pm.includes('awash') || (sale.paymentMethod === 'Split' && !!sale.splitDetails?.awash);
      } else if (selectedPaymentMethod === 'Bank DASHEN') {
        matchPaymentMethod = pm.includes('dashen') || (sale.paymentMethod === 'Split' && !!sale.splitDetails?.dashen);
      } else if (selectedPaymentMethod === 'Telebirr') {
        matchPaymentMethod = pm.includes('telebirr') || (sale.paymentMethod === 'Split' && (!!sale.splitDetails?.telebirr || !!sale.splitDetails?.mobile));
      } else if (selectedPaymentMethod === 'Credit') {
        matchPaymentMethod = pm === 'credit' || (sale.paymentMethod === 'Split' && !!sale.splitDetails?.credit);
      } else if (selectedPaymentMethod === 'Card') {
        matchPaymentMethod = pm === 'card' || (sale.paymentMethod === 'Split' && !!sale.splitDetails?.card);
      } else if (selectedPaymentMethod === 'Split') {
        matchPaymentMethod = sale.paymentMethod === 'Split';
      } else if (selectedPaymentMethod === 'Other') {
        matchPaymentMethod = pm === 'other' || 
          (sale.paymentMethod === 'Split' && !!sale.splitDetails?.other) ||
          (pm.startsWith('bank:') && !pm.includes('cbe') && !pm.includes('boa') && !pm.includes('awash') && !pm.includes('dashen'));
      } else {
        matchPaymentMethod = sale.paymentMethod === selectedPaymentMethod || pm.includes(selectedPaymentMethod.toLowerCase());
      }
    }

    // 4. Price filter
    const matchMinPrice = !minPrice ? true : sale.total >= parseFloat(minPrice);
    const matchMaxPrice = !maxPrice ? true : sale.total <= parseFloat(maxPrice);

    // 5. Quantity filter
    const totalQty = sale.items.reduce((sum, item) => sum + item.quantity, 0);
    const matchMinQty = !minQty ? true : totalQty >= parseInt(minQty);
    const matchMaxQty = !maxQty ? true : totalQty <= parseInt(maxQty);

    // 6. Category filter (Medicine vs Cosmetics)
    let matchCategory = true;
    if (selectedCategory !== 'All') {
      const targetType = selectedCategory === 'Medicine' ? 'medicine' : 'cosmetics';
      // Check if at least one item in sale matches category
      matchCategory = sale.items.some(saleItem => {
        const med = medicines.find(m => m.id === saleItem.medicineId);
        return med ? (med.productType || 'medicine') === targetType : targetType === 'medicine';
      });
    }

    // 6b. Channel Filter (In-Store vs Online Order)
    let matchChannel = true;
    const isOnline = Boolean(sale.isOnlineOrder || sale.orderSource === 'Online Store' || sale.orderSource?.toLowerCase().includes('online'));
    if (selectedChannel === 'In-Store') {
      matchChannel = !isOnline;
    } else if (selectedChannel === 'Online') {
      matchChannel = isOnline;
    }

    // 7. Role-based restrictions: "for user show them their sales history but cant edit or delete"
    let matchRole = true;
    if (currentUser?.role !== 'Super Administrator' && currentUser?.role !== 'Auditor') {
      if (currentUser?.role === 'Branch Manager' || currentUser?.role === 'Accountant') {
        matchRole = sale.branchId === currentUser?.branchId;
      } else {
        matchRole = sale.cashierId === currentUser?.id;
      }
    }

    return matchQuery && matchStartDate && matchEndDate && matchCashier && matchBranch && matchPaymentMethod && matchMinPrice && matchMaxPrice && matchMinQty && matchMaxQty && matchCategory && matchChannel && matchRole;
  });

  // Export Filtered Dataset to CSV / Excel format
  const exportToExcel = () => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Date,Invoice Number,Order Source,Branch,Cashier,Customer,TIN,Payment Method,Subtotal,Discount,VAT,Grand Total,Status\n";

      filteredSales.forEach(sale => {
        const source = (sale.isOnlineOrder || sale.orderSource === 'Online Store' || sale.orderSource?.toLowerCase().includes('online')) ? 'Online Store' : 'In-Store POS';
        const row = [
          sale.date,
          sale.invoiceNumber,
          source,
          sale.branchName || 'Main',
          sale.cashierName,
          sale.customerName || 'Walk-in',
          sale.customerTin || 'N/A',
          sale.paymentMethod,
          sale.subtotal.toFixed(2),
          sale.discount.toFixed(2),
          sale.vat.toFixed(2),
          sale.total.toFixed(2),
          sale.status || 'Completed'
        ].map(val => `"${val.toString().replace(/"/g, '""')}"`).join(",");
        csvContent += row + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `sales-history-export-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to export sales list: ' + err);
    }
  };

  // Export Filtered Dataset as Printable PDF Invoice
  const exportToPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let rowsHtml = filteredSales.map(sale => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 8px;">${sale.date} ${sale.time || ''}</td>
        <td style="padding: 8px; font-weight: bold;">${sale.invoiceNumber}</td>
        <td style="padding: 8px;">${sale.cashierName}</td>
        <td style="padding: 8px;">${sale.customerName || 'Walk-in'}</td>
        <td style="padding: 8px;">${sale.paymentMethod}</td>
        <td style="padding: 8px; text-align: right; font-family: monospace;">${sale.total.toFixed(2)} ETB</td>
        <td style="padding: 8px; text-align: center;">
          <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: ${sale.status === 'Voided' ? '#FEE2E2; color: #991B1B;' : '#D1FAE5; color: #065F46;'}">
            ${sale.status || 'Completed'}
          </span>
        </td>
      </tr>
    `).join('');

    const totalFilteredSum = filteredSales.reduce((sum, s) => sum + s.total, 0);

    printWindow.document.write(`
      <html>
      <head>
        <title>Sales History Ledger Export</title>
        <style>
          body { font-family: sans-serif; color: #333; margin: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #047857; color: white; padding: 10px; text-align: left; }
          h2 { color: #065F46; margin-bottom: 5px; }
        </style>
      </head>
      <body onload="window.print()">
        <h2>${institution.name}</h2>
        <p style="margin: 0 0 20px 0; font-size: 12px; color: #666;">Generated on: ${new Date().toLocaleString()}</p>
        <h3 style="border-bottom: 2px solid #047857; pb: 5px;">Sales Transactions History Ledger</h3>
        <p><strong>Total Transactions:</strong> ${filteredSales.length} | <strong>Combined Revenue:</strong> ${totalFilteredSum.toFixed(2)} ETB</p>
        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Invoice Number</th>
              <th>Cashier</th>
              <th>Customer</th>
              <th>Payment Route</th>
              <th style="text-align: right;">Grand Total</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Trigger download of official PDF receipt (A4 standard or 80mm POS roll)
  const handleDownloadPdf = async (sale: Sale, format: 'standard' | 'thermal' = 'standard') => {
    try {
      setDownloadingPdfSaleId(sale.id);
      setDownloadingFormat(format);
      const branch = branches.find(b => b.id === sale.branchId);
      await generateReceiptPdf(sale, {
        institution,
        branch,
        format,
        autoDownload: true
      });
    } catch (err: any) {
      console.error('Error generating receipt PDF:', err);
      alert('Failed to generate PDF receipt: ' + (err?.message || err));
    } finally {
      setDownloadingPdfSaleId(null);
    }
  };

  // Direct print PDF receipt
  const handlePrintReceiptDirect = async (sale: Sale, format: 'standard' | 'thermal' = 'standard') => {
    try {
      setDownloadingPdfSaleId(sale.id);
      const branch = branches.find(b => b.id === sale.branchId);
      const doc = await generateReceiptPdf(sale, {
        institution,
        branch,
        format,
        autoDownload: false
      });
      doc.autoPrint();
      const pdfBlob = doc.output('bloburl');
      window.open(pdfBlob, '_blank');
    } catch (err: any) {
      console.error('Error printing receipt PDF:', err);
      alert('Failed to print receipt: ' + (err?.message || err));
    } finally {
      setDownloadingPdfSaleId(null);
    }
  };

  // Trigger download of receipt HTML
  const downloadReceipt = (sale: Sale) => {
    try {
      const itemsHtml = sale.items.map(item => `
        <tr style="border-bottom: 1px dashed #ddd; font-size: 11px;">
          <td style="padding: 6px 0;">${item.medicineName || 'Medicine'}</td>
          <td style="padding: 6px 0; font-family: monospace; text-align: center;">${item.batchNumber || 'N/A'}</td>
          <td style="padding: 6px 0; text-align: center;">${item.quantity}</td>
          <td style="padding: 6px 0; font-family: monospace; text-align: right;">${item.unitPrice.toFixed(2)}</td>
          <td style="padding: 6px 0; font-family: monospace; text-align: right;">${(item.unitPrice * item.quantity).toFixed(2)}</td>
        </tr>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt ${sale.invoiceNumber}</title>
          <style>
            body { font-family: sans-serif; margin: 20px; line-height: 1.4; color: #000; background: #fff; }
            .receipt-container { max-width: 320px; margin: 0 auto; padding: 15px; border: 1px solid #ccc; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
          </style>
        </head>
        <body onload="window.print()">
          <div class="receipt-container">
            <h3 class="text-center" style="margin: 0;">${institution.name.toUpperCase()}</h3>
            <p class="text-center" style="font-size: 11px; margin: 2px 0 2px 0;">${institution.address} | Tel: ${institution.phone}</p>
            <p class="text-center" style="font-size: 11px; margin: 2px 0 15px 0;">Official Commercial Invoice / Receipt</p>
            <div style="font-size: 11px; margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 8px;">
              <div><strong>Invoice No:</strong> ${sale.invoiceNumber}</div>
              <div><strong>Date & Time:</strong> ${sale.date} ${sale.time || ''}</div>
              <div><strong>Cashier:</strong> ${sale.cashierName}</div>
              <div><strong>Customer:</strong> ${sale.customerName || 'Walk-in'}</div>
              ${sale.customerTin ? `<div><strong>Customer TIN:</strong> ${sale.customerTin}</div>` : ''}
              <div><strong>Status:</strong> <span class="font-bold">${sale.status || 'Completed'}</span></div>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid #000; font-size: 11px;">
                  <th style="text-align: left; padding: 4px 0;">Item Name</th>
                  <th style="text-align: center; padding: 4px 0;">Batch</th>
                  <th style="text-align: center; padding: 4px 0;">Qty</th>
                  <th style="text-align: right; padding: 4px 0;">Price</th>
                  <th style="text-align: right; padding: 4px 0;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            <div style="margin-top: 15px; border-top: 1px solid #000; padding-top: 8px; font-size: 12px; text-align: right;">
              <div>Subtotal: <strong>${sale.subtotal.toFixed(2)} ETB</strong></div>
              ${sale.discount > 0 ? `<div>Discount: <strong>-${sale.discount.toFixed(2)} ETB</strong></div>` : ''}
              <div>VAT (${sale.vatPercent}%): <strong>${sale.vat.toFixed(2)} ETB</strong></div>
              <div style="font-size: 14px; margin-top: 4px;">Grand Total: <strong>${sale.total.toFixed(2)} ETB</strong></div>
            </div>
            <div class="text-center" style="margin-top: 25px; font-size: 10px; border-top: 1px dashed #777; padding-top: 10px;">
              Thank you for choosing ${institution.name}!
            </div>
          </div>
        </body>
        </html>
      `;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const dlAnchor = document.createElement('a');
      dlAnchor.setAttribute("href", URL.createObjectURL(blob));
      dlAnchor.setAttribute("download", `receipt-${sale.invoiceNumber}.html`);
      document.body.appendChild(dlAnchor);
      dlAnchor.click();
      document.body.removeChild(dlAnchor);
    } catch (err) {
      alert('Failed to download receipt: ' + err);
    }
  };

  // Void transaction
  const executeVoid = async (id: string) => {
    if (!voidReason.trim()) {
      alert('Please enter a valid justification reason to void this transaction.');
      return;
    }

    try {
      const res = await fetch('/api/sales/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: id,
          operatorId: currentUser?.id || 'admin',
          reason: voidReason.trim()
        })
      });

      if (res.ok) {
        alert('Transaction voided successfully. Associated medicine stocks have been restored.');
        setVoidingSaleId(null);
        setVoidReason('');
        fetchData();
        onDataChanged(); // Refresh parent suite data
      } else {
        const errorData = await res.json();
        alert('Void request failed: ' + (errorData.error || 'Check backend and try again.'));
      }
    } catch (err) {
      alert('Network failure processing void transaction: ' + err);
    }
  };

  // Change payment method handler (available for all users)
  const executeChangePaymentMethod = async () => {
    if (!editingPaymentSale) return;

    setIsUpdatingPayment(true);
    try {
      const res = await fetch('/api/sales/update-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: editingPaymentSale.id,
          paymentMethod: newPaymentMethod,
          reason: paymentChangeReason || 'User/Admin updated payment method',
          operatorId: currentUser?.id || 'usr'
        })
      });

      if (res.ok) {
        const updatedSale: Sale = await res.json();
        setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
        if (selectedSaleForModal && selectedSaleForModal.id === updatedSale.id) {
          setSelectedSaleForModal(updatedSale);
        }
        setEditingPaymentSale(null);
        setPaymentChangeReason('');
        fetchData();
        if (onDataChanged) onDataChanged();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to update payment method');
      }
    } catch (err) {
      alert('Error updating payment method: ' + err);
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  // Stats calculation
  const totalRev = filteredSales.filter(s => s.status !== 'Voided' && s.status !== 'Returned').reduce((sum, s) => sum + s.total, 0);
  const totalVoidValue = filteredSales.filter(s => s.status === 'Voided' || s.status === 'Returned').reduce((sum, s) => sum + s.total, 0);
  const modifiedPaymentSales = filteredSales.filter(s => s.paymentMethodChanged || (s.paymentMethodHistory && s.paymentMethodHistory.length > 0));

  return (
    <div className="space-y-6">
      
      {/* Top filter control header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono font-bold text-emerald-800 uppercase tracking-wider block">Historical Auditing</span>
            <h2 className="text-lg font-sans font-black text-gray-950">Sales History &amp; Receipt Ledger</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchData}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-700' : ''}`} />
              Sync Lists
            </button>
            <button
              onClick={exportToExcel}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-150 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              Download Excel/CSV
            </button>
            <button
              onClick={exportToPdf}
              className="bg-gray-950 hover:bg-gray-900 text-white py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              Download Audit PDF
            </button>
          </div>
        </div>

        {/* Filters Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 text-xs bg-gray-50/55 p-4 rounded-xl border border-gray-200/60">
          {/* Row 1: Search & Date Range */}
          <div className="space-y-1">
            <label className="font-bold text-gray-750 block">Search Query</label>
            <div className="relative bg-white border border-gray-200 rounded-lg p-1.5 flex items-center">
              <Search className="h-3.5 w-3.5 text-gray-400 shrink-0 ml-1" />
              <input
                type="text"
                placeholder="Invoice, Customer, Cashier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs outline-none bg-transparent ml-1.5 text-gray-850"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-gray-750 block">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg p-1.5 outline-none font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-gray-750 block">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg p-1.5 outline-none font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-gray-750 block">Pharmacy Branch</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg p-2 outline-none font-semibold"
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-gray-750 block">Payment Method / Route</label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg p-2 outline-none font-semibold text-gray-800"
            >
              <option value="">All Payment Routes</option>
              <option value="Cash">💵 Cash Payments</option>
              <option value="Bank">🏦 All Bank Transfers & Accounts</option>
              <option value="Bank CBE">🏦 Bank CBE (Commercial Bank)</option>
              <option value="Bank BOA">🏦 Bank BOA (Bank of Abyssinia)</option>
              <option value="Bank AWASH">🏦 AWASH Bank</option>
              <option value="Bank DASHEN">🏦 DASHEN Bank</option>
              <option value="Telebirr">📱 Telebirr Mobile Money</option>
              <option value="Credit">📜 Customer Account Credit</option>
              <option value="Card">💳 POS Card Terminal</option>
              <option value="Split">🔀 Split / Mixed Payments</option>
              <option value="Other">🌐 Other Settlement</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-gray-750 block">Staff / User Profile</label>
            <select
              value={selectedCashierId}
              onChange={(e) => setSelectedCashierId(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg p-2 outline-none font-semibold"
            >
              <option value="">All Users</option>
              {cashiers.map(c => {
                const bName = branches.find(b => b.id === c.branchId)?.name || (c.branchId === 'all' ? 'All Branches' : c.branchId);
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.role}) &bull; {bName}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Row 2: Category, Order Channel, Price Range, Qty Range */}
          <div className="space-y-1">
            <label className="font-bold text-gray-750 block">Product Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="w-full bg-white border border-gray-200 rounded-lg p-2 outline-none font-semibold"
            >
              <option value="All">All Categories</option>
              <option value="Medicine">Medicine &amp; Drugs</option>
              <option value="Cosmetics">Cosmetics &amp; Beauty</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-gray-750 block">Order Channel / Source</label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value as any)}
              className="w-full bg-white border border-blue-300 bg-blue-50/20 text-gray-800 rounded-lg p-2 outline-none font-bold cursor-pointer"
            >
              <option value="All">All Order Channels</option>
              <option value="In-Store">🏪 In-Store POS Sales</option>
              <option value="Online">🛍️ Online Orders Sold</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-gray-750 block">Price Range (ETB)</label>
            <div className="flex gap-1.5 items-center">
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-1/2 bg-white border border-gray-200 rounded-lg p-1.5 outline-none text-center font-mono"
              />
              <span className="text-gray-400 font-mono">-</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-1/2 bg-white border border-gray-200 rounded-lg p-1.5 outline-none text-center font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-gray-750 block">Total Qty (Units)</label>
            <div className="flex gap-1.5 items-center">
              <input
                type="number"
                placeholder="Min"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                className="w-1/2 bg-white border border-gray-200 rounded-lg p-1.5 outline-none text-center font-mono"
              />
              <span className="text-gray-400 font-mono">-</span>
              <input
                type="number"
                placeholder="Max"
                value={maxQty}
                onChange={(e) => setMaxQty(e.target.value)}
                className="w-1/2 bg-white border border-gray-200 rounded-lg p-1.5 outline-none text-center font-mono"
              />
            </div>
          </div>

          <div className="flex items-end sm:col-span-2 md:col-span-1 lg:col-span-1 xl:col-span-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setStartDate('');
                setEndDate('');
                setSelectedCashierId('');
                setSelectedBranchId('');
                setSelectedCategory('All');
                setSelectedChannel('All');
                setMinPrice('');
                setMaxPrice('');
                setMinQty('');
                setMaxQty('');
              }}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Audit Stats Header Banner */}
      {(() => {
        const activeSalesList = filteredSales.filter(s => s.status !== 'Voided' && s.status !== 'Returned');
        const onlineSalesList = activeSalesList.filter(s => s.isOnlineOrder || s.orderSource === 'Online Store' || s.orderSource?.toLowerCase().includes('online'));
        const inStoreSalesList = activeSalesList.filter(s => !(s.isOnlineOrder || s.orderSource === 'Online Store' || s.orderSource?.toLowerCase().includes('online')));
        const totalOnlineAmount = onlineSalesList.reduce((acc, s) => acc + s.total, 0);
        const totalInStoreAmount = inStoreSalesList.reduce((acc, s) => acc + s.total, 0);

        return (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-xs font-sans">
            <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-3.5 space-y-1">
              <span className="text-gray-450 uppercase font-mono font-bold tracking-wider text-[10px]">Total Net Sales</span>
              <div className="text-base font-black text-emerald-800 font-mono">
                {totalRev.toFixed(2)} ETB
              </div>
              <span className="text-[10px] text-gray-500 font-semibold block">{activeSalesList.length} total completed invoices</span>
            </div>

            <div className="bg-sky-50/70 rounded-xl shadow-sm border border-sky-200/80 p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sky-900 uppercase font-extrabold tracking-wider text-[10px] flex items-center gap-1">
                  🛍️ Online Orders Sold
                </span>
                <span className="text-[9px] font-mono bg-sky-200/80 text-sky-950 font-bold px-1.5 py-0.2 rounded">
                  {onlineSalesList.length} orders
                </span>
              </div>
              <div className="text-base font-black text-sky-950 font-mono">
                {totalOnlineAmount.toFixed(2)} ETB
              </div>
              <span className="text-[10px] text-sky-800 font-medium block">From web customer portal</span>
            </div>

            <div className="bg-gray-50/80 rounded-xl shadow-sm border border-gray-200 p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 uppercase font-extrabold tracking-wider text-[10px] flex items-center gap-1">
                  🏪 In-Store POS Sales
                </span>
                <span className="text-[9px] font-mono bg-gray-200 text-gray-800 font-bold px-1.5 py-0.2 rounded">
                  {inStoreSalesList.length} sales
                </span>
              </div>
              <div className="text-base font-black text-gray-900 font-mono">
                {totalInStoreAmount.toFixed(2)} ETB
              </div>
              <span className="text-[10px] text-gray-500 font-medium block">Counter & walk-in POS</span>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-3.5 space-y-1">
              <span className="text-gray-450 uppercase font-mono font-bold tracking-wider text-[10px]">Voided / Returned</span>
              <div className="text-base font-black text-red-700 font-sans">
                {filteredSales.filter(s => s.status === 'Voided' || s.status === 'Returned').length} Transactions
              </div>
              <span className="text-[10px] text-red-600 font-semibold block">{totalVoidValue.toFixed(2)} ETB reversed</span>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-3.5 space-y-1">
              <span className="text-gray-450 uppercase font-mono font-bold tracking-wider text-[10px]">Active Filters</span>
              <div className="text-xs font-bold text-gray-800 truncate">
                Channel: <span className="text-sky-700 font-black">{selectedChannel}</span>
              </div>
              <span className="text-[10px] text-gray-500 font-medium block truncate">Category: {selectedCategory}</span>
            </div>
          </div>
        );
      })()}

      {/* Modified Payment Methods Notification Banner */}
      {modifiedPaymentSales.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-250 rounded-xl p-4 text-xs text-amber-950 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 animate-bounce" />
              <span>Admin / Staff Changed Payment Method Reports Notification ({modifiedPaymentSales.length} Invoices Adjusted)</span>
            </div>
            <span className="text-[10px] font-mono bg-amber-200/80 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-extrabold uppercase">
              Audited Settlement Updates
            </span>
          </div>
          <p className="text-[11px] text-amber-850 font-medium">
            Notice for Financial Auditing: The following invoice payment settlement methods were updated post-sale. These adjustments impact payment breakdown reports and cash drawer reconciliations.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
            {modifiedPaymentSales.map(sale => {
              const lastLog = sale.paymentMethodHistory?.[0];
              return (
                <div key={sale.id} className="bg-white border border-amber-200/80 rounded-lg p-2.5 flex flex-col justify-between text-[11px] shadow-2xs hover:border-amber-300 transition-all">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-gray-900">#{sale.invoiceNumber}</span>
                    <span className="font-mono font-bold text-emerald-700">{sale.total.toFixed(2)} ETB</span>
                  </div>
                  <div className="flex justify-between items-center mt-1.5 pt-1 border-t border-gray-100">
                    <div className="flex items-center gap-1 font-bold text-amber-900 bg-amber-100/80 px-1.5 py-0.5 rounded text-[10px] uppercase">
                      <span>{lastLog ? `${lastLog.oldMethod} ➔ ${lastLog.newMethod}` : sale.paymentMethod}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(sale, 'standard')}
                        disabled={downloadingPdfSaleId === sale.id}
                        className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded font-bold text-[10px] cursor-pointer inline-flex items-center gap-1 transition-colors"
                        title="Download Receipt PDF"
                      >
                        {downloadingPdfSaleId === sale.id ? (
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        ) : (
                          <FileDown className="w-2.5 h-2.5" />
                        )}
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSaleForModal(sale)}
                        className="text-gray-700 hover:text-gray-900 font-extrabold text-[10px] cursor-pointer underline"
                      >
                        View Receipt
                      </button>
                    </div>
                  </div>
                  {lastLog && (
                    <div className="text-[9.5px] text-gray-500 mt-1 italic truncate">
                      Updated by {lastLog.changedBy} {lastLog.reason ? `• "${lastLog.reason}"` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Table View */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-150 overflow-hidden">
        <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-900">Historical Transactions List ({filteredSales.length})</span>
          <span className="text-[10px] text-gray-400">Values are shown in Ethiopian Birr (ETB)</span>
        </div>

        <div className="overflow-x-auto text-xs text-gray-700">
          <table className="w-full text-left">
            <thead className="bg-gray-100/50 font-bold border-b border-gray-150 text-gray-900">
              <tr>
                <th className="p-3">Date / Time</th>
                <th className="p-3">Invoice Number</th>
                <th className="p-3">Order Source</th>
                <th className="p-3">Cashier / Staff</th>
                <th className="p-3">Customer (TIN)</th>
                <th className="p-3">Payment Route</th>
                <th className="p-3 text-right">Grand Total</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-450 font-semibold">
                    No matching sales transactions found matching selected filters.
                  </td>
                </tr>
              ) : (
                (() => {
                  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
                  const paginatedSales = filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                  return paginatedSales.map(sale => {
                    const isVoided = sale.status === 'Voided' || sale.status === 'Returned';
                    const isOnline = Boolean(sale.isOnlineOrder || sale.orderSource === 'Online Store' || sale.orderSource?.toLowerCase().includes('online'));
                    return (
                      <tr key={sale.id} className={`hover:bg-gray-50/50 ${isVoided ? 'bg-red-50/30 line-through text-gray-400' : ''}`}>
                        <td className="p-3 whitespace-nowrap font-mono">
                          {sale.date} <span className="text-[10px] text-gray-400">{sale.time || ''}</span>
                        </td>
                        <td className="p-3 font-bold text-gray-900">{sale.invoiceNumber}</td>
                        <td className="p-3 whitespace-nowrap">
                          {isOnline ? (
                            <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-850 border border-sky-300 font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                              🛍️ Online Order
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 border border-gray-200 font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                              🏪 In-Store
                            </span>
                          )}
                        </td>
                        <td className="p-3">{sale.cashierName}</td>
                        <td className="p-3">
                          <span className="font-bold">{sale.customerName || 'Walk-in'}</span>
                          {sale.customerTin && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 border px-1 rounded ml-1.5 font-mono">
                              TIN: {sale.customerTin}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPaymentSale(sale);
                              setNewPaymentMethod(sale.paymentMethod || 'Cash');
                            }}
                            title="Click to change payment method"
                            className="px-2 py-0.5 rounded text-[10px] bg-gray-100 border border-gray-250 text-gray-800 font-bold uppercase hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors cursor-pointer inline-flex items-center gap-1 group"
                          >
                            <span>{sale.paymentMethod}</span>
                            <Edit2 className="h-2.5 w-2.5 text-gray-400 group-hover:text-emerald-600" />
                          </button>
                        </td>
                        <td className="p-3 text-right font-bold font-mono text-gray-950">
                          {sale.total.toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isVoided 
                              ? 'bg-red-100 text-red-800 border border-red-200' 
                              : 'bg-emerald-100 text-emerald-850 border border-emerald-200'
                          }`}>
                            {sale.status || 'Completed'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => setSelectedSaleForModal(sale)}
                            title="View Invoice & Receipt Details"
                            className="bg-gray-100 hover:bg-gray-250 border border-gray-200 p-1.5 rounded-lg inline-flex items-center text-gray-700 transition-colors cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(sale, 'standard')}
                            disabled={downloadingPdfSaleId === sale.id}
                            title="Download Official Tax Receipt PDF (Standard A4)"
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-1 rounded-lg inline-flex items-center gap-1 text-[10.5px] transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                          >
                            {downloadingPdfSaleId === sale.id && downloadingFormat === 'standard' ? (
                              <RefreshCw className="h-3 w-3 animate-spin text-emerald-700" />
                            ) : (
                              <FileDown className="h-3 w-3 text-emerald-700" />
                            )}
                            <span>PDF</span>
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(sale, 'thermal')}
                            disabled={downloadingPdfSaleId === sale.id}
                            title="Download 80mm POS Thermal Receipt PDF"
                            className="bg-slate-100 hover:bg-slate-200 text-slate-750 border border-slate-300 p-1.5 rounded-lg inline-flex items-center transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {downloadingPdfSaleId === sale.id && downloadingFormat === 'thermal' ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-700" />
                            ) : (
                              <Printer className="h-3.5 w-3.5 text-slate-700" />
                            )}
                          </button>
                          <button
                            onClick={() => downloadReceipt(sale)}
                            title="Download Receipt HTML file"
                            className="bg-gray-50 hover:bg-gray-150 border border-gray-200 p-1.5 rounded-lg inline-flex items-center text-gray-500 transition-colors cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          {!isVoided && (
                            <button
                              onClick={() => {
                                setEditingPaymentSale(sale);
                                setNewPaymentMethod(sale.paymentMethod || 'Cash');
                              }}
                              title="Change Payment Method"
                              className="bg-blue-50 hover:bg-blue-100 border border-blue-200 p-1.5 rounded-lg inline-flex items-center text-blue-700 transition-colors cursor-pointer"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {!isVoided && currentUser?.role === 'Super Administrator' && (
                            <button
                              onClick={() => {
                                setVoidingSaleId(sale.id);
                                setVoidReason('');
                              }}
                              title="Void Entire Invoice & Restock"
                              className="bg-red-50 hover:bg-red-100 border border-red-200 p-1.5 rounded-lg inline-flex items-center text-red-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
          
          {filteredSales.length > 0 && (() => {
            const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
            return (
              <div className="bg-gray-50/50 px-4 py-3 border-t border-gray-150 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="text-gray-500 font-medium">
                  Showing <span className="font-bold text-gray-950">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="font-bold text-gray-950">
                    {Math.min(currentPage * itemsPerPage, filteredSales.length)}
                  </span>{' '}
                  of <span className="font-bold text-gray-950">{filteredSales.length}</span> sales transactions
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-gray-400 mr-1 font-medium">Items per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-gray-200 rounded p-1 outline-none text-xs font-semibold text-gray-800"
                  >
                    {[10, 15, 25, 50, 100].map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 ml-4">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 font-semibold text-gray-700">
                      Page {currentPage} of {Math.max(1, totalPages)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="px-2.5 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Void Reason modal prompt */}
      {voidingSaleId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-150 max-w-md w-full p-5 space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <span className="p-2 bg-red-100 text-red-700 rounded-full">
                <AlertCircle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-sans font-extrabold text-gray-950">Void Invoice Transaction</h3>
                <p className="text-[11px] text-gray-500 mt-1">
                  Voiding will change status to "Voided", reverse and add all quantities back to the inventory batches, and log an activity in Relational Database. This operation cannot be undone.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-gray-750 block">Audit Justification Reason / Note:</label>
              <textarea
                placeholder="e.g. Return of medicine, error in billing, incorrect customer selected..."
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-none font-sans"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setVoidingSaleId(null)}
                className="bg-gray-150 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeVoid(voidingSaleId)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg cursor-pointer"
              >
                Void Transaction &amp; Restock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {selectedSaleForModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-150 max-w-2xl w-full p-6 text-xs text-gray-800 space-y-5">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-sans font-extrabold text-gray-950">Invoice No: {selectedSaleForModal.invoiceNumber}</h3>
                <span className="text-[10px] text-gray-400">UUID: {selectedSaleForModal.id}</span>
              </div>
              <button 
                onClick={() => setSelectedSaleForModal(null)} 
                className="p-1 rounded bg-gray-100 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-3 rounded-lg border text-[11px]">
              <div>
                <span className="text-gray-400 font-bold block">Date &amp; Time</span>
                <span className="font-semibold text-gray-800">{selectedSaleForModal.date} {selectedSaleForModal.time || ''}</span>
              </div>
              <div>
                <span className="text-gray-400 font-bold block">Cashier Profile</span>
                <span className="font-semibold text-gray-800">{selectedSaleForModal.cashierName}</span>
              </div>
              <div>
                <span className="text-gray-400 font-bold block">Customer (TIN)</span>
                <span className="font-semibold text-gray-800">{selectedSaleForModal.customerName || 'Walk-in'} {selectedSaleForModal.customerTin ? `(${selectedSaleForModal.customerTin})` : ''}</span>
              </div>
              <div>
                <span className="text-gray-400 font-bold block">Settlement Route</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-bold text-emerald-800 uppercase">{selectedSaleForModal.paymentMethod}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPaymentSale(selectedSaleForModal);
                      setNewPaymentMethod(selectedSaleForModal.paymentMethod || 'Cash');
                    }}
                    className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors inline-flex items-center gap-0.5"
                  >
                    <Edit2 className="h-2.5 w-2.5" />
                    Change
                  </button>
                </div>
              </div>
            </div>

            {/* Itemized Lines */}
            <div className="space-y-2">
              <span className="font-bold text-gray-900 block">Itemized Purchases Line Items</span>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-100 text-gray-800 font-bold">
                    <tr>
                      <th className="p-2">Item Name</th>
                      <th className="p-2">Batch Number</th>
                      <th className="p-2 text-center">Quantity</th>
                      <th className="p-2 text-right">Unit Price</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedSaleForModal.items.map((line, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="p-2 font-bold text-gray-900">{line.medicineName || 'Medicine'}</td>
                        <td className="p-2 font-mono">{line.batchNumber || 'N/A'}</td>
                        <td className="p-2 text-center font-bold font-mono">{line.quantity}</td>
                        <td className="p-2 text-right font-mono">{line.unitPrice.toFixed(2)} ETB</td>
                        <td className="p-2 text-right font-mono font-bold text-gray-950">{(line.unitPrice * line.quantity).toFixed(2)} ETB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations and status */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-t border-gray-100 pt-3 gap-4">
              <div className="flex gap-2 items-center">
                <span className="font-bold text-gray-800">Status Indicator:</span>
                <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                  selectedSaleForModal.status === 'Voided' || selectedSaleForModal.status === 'Returned'
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {selectedSaleForModal.status || 'Completed'}
                </span>
              </div>

              <div className="text-right space-y-1 font-mono text-[11px]">
                <div>Subtotal: <strong className="text-gray-900">{selectedSaleForModal.subtotal.toFixed(2)} ETB</strong></div>
                {selectedSaleForModal.discount > 0 && (
                  <div className="text-amber-800 font-bold">Discount Applied: -{selectedSaleForModal.discount.toFixed(2)} ETB</div>
                )}
                <div>VAT (${selectedSaleForModal.vatPercent}%): <strong className="text-gray-900">{selectedSaleForModal.vat.toFixed(2)} ETB</strong></div>
                <div className="text-sm font-sans font-black text-gray-950 border-t border-gray-200 pt-1">
                  Grand Total: {selectedSaleForModal.total.toFixed(2)} ETB
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-gray-150">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintReceiptDirect(selectedSaleForModal)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Direct print this receipt"
                >
                  <Printer className="h-4 w-4 text-gray-600" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadReceipt(selectedSaleForModal)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Download HTML Receipt format"
                >
                  <Download className="h-4 w-4 text-gray-500" />
                  <span>HTML</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={downloadingPdfSaleId === selectedSaleForModal.id}
                  onClick={() => handleDownloadPdf(selectedSaleForModal, 'thermal')}
                  className="bg-slate-850 hover:bg-slate-950 text-white font-bold px-3.5 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  title="Download 80mm POS thermal receipt PDF format"
                >
                  {downloadingPdfSaleId === selectedSaleForModal.id && downloadingFormat === 'thermal' ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-300" />
                  ) : (
                    <Printer className="h-3.5 w-3.5 text-slate-300" />
                  )}
                  <span>POS Thermal PDF (80mm)</span>
                </button>

                <button
                  type="button"
                  disabled={downloadingPdfSaleId === selectedSaleForModal.id}
                  onClick={() => handleDownloadPdf(selectedSaleForModal, 'standard')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                  title="Download official standard A4 commercial tax invoice & receipt PDF"
                >
                  {downloadingPdfSaleId === selectedSaleForModal.id && downloadingFormat === 'standard' ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5" />
                  )}
                  <span>Download Receipt PDF (A4)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSaleForModal(null)}
                  className="bg-gray-150 hover:bg-gray-200 text-gray-700 font-bold px-3.5 py-2 rounded-lg cursor-pointer text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Payment Method Modal */}
      {editingPaymentSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-150 max-w-md w-full p-6 text-xs text-gray-800 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-sans font-extrabold text-gray-950 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  Change Payment Method
                </h3>
                <p className="text-[11px] text-gray-500">Invoice #{editingPaymentSale.invoiceNumber}</p>
              </div>
              <button 
                onClick={() => setEditingPaymentSale(null)} 
                className="p-1 rounded bg-gray-100 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg border text-[11px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Current Method:</span>
                <span className="font-bold text-gray-900 uppercase bg-gray-200/80 px-2 py-0.5 rounded text-[10px]">{editingPaymentSale.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <span className="font-bold text-gray-900">{editingPaymentSale.customerName || 'Walk-in'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice Total:</span>
                <span className="font-bold text-emerald-700 font-mono">{editingPaymentSale.total.toFixed(2)} ETB</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-800">
                Select New Payment Method / Route:
              </label>
              <select
                value={newPaymentMethod}
                onChange={(e) => setNewPaymentMethod(e.target.value)}
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
                placeholder="e.g. Paid via Telebirr instead of Cash, Cashier correction"
                value={paymentChangeReason}
                onChange={(e) => setPaymentChangeReason(e.target.value)}
                className="w-full bg-white border border-gray-300 font-medium text-gray-900 text-xs rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingPaymentSale(null)}
                className="bg-gray-150 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingPayment || newPaymentMethod === editingPaymentSale.paymentMethod}
                onClick={executeChangePaymentMethod}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                {isUpdatingPayment ? 'Saving...' : 'Update Payment Method'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
