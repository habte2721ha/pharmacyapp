import React, { useState, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { 
  Clipboard, Search, X, ArrowDownLeft, ArrowUpRight, 
  Printer, Download, RefreshCw, FileText, FileSpreadsheet, MapPin, Filter
} from 'lucide-react';
import { Medicine, StockItem, Branch, Sale, PurchaseOrder, StockTransfer } from '../types';

interface BinCardsPanelProps {
  currentUser: any;
  medicines: Medicine[];
  stockItems: StockItem[];
  branches: Branch[];
}

export default function BinCardsPanel({ currentUser, medicines, stockItems, branches }: BinCardsPanelProps) {
  const [institution, setInstitution] = useState({
    name: 'Sonan Pharmacy'
  });

  useEffect(() => {
    const fetchInstitution = async () => {
      try {
        const res = await fetch('/api/settings/institution');
        if (res.ok) {
          const data = await res.json();
          if (data && data.name) {
            setInstitution({
              name: data.name
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch institution in BinCards:', err);
      }
    };
    fetchInstitution();
  }, []);

  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [ledgerHistory, setLedgerHistory] = useState<any[]>([]);
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 200);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch('/api/suppliers');
        if (res.ok) {
          const data = await res.json();
          setSuppliers(data);
        }
      } catch (err) {
        console.error('Failed to fetch suppliers in BinCardsPanel:', err);
      }
    };
    fetchSuppliers();
  }, []);

  // Initial branch setup
  useEffect(() => {
    if (currentUser) {
      const defaultBranch = currentUser.branchId === 'all' ? 'b1' : currentUser.branchId;
      setSelectedBranchId(defaultBranch);
    }
  }, [currentUser]);

  // Load ledger details whenever medicine or branch changes
  useEffect(() => {
    if (selectedMedicine && selectedBranchId) {
      loadBinCardLedger(selectedMedicine, selectedBranchId);
    } else {
      setLedgerHistory([]);
    }
  }, [selectedMedicine, selectedBranchId]);

  const loadBinCardLedger = async (med: Medicine, branchId: string) => {
    setLoading(true);
    try {
      // Find all medicine IDs sharing the same product name to consolidate their records
      const allRelatedMedIds = medicines
        .filter(m => m.name.toLowerCase().trim() === med.name.toLowerCase().trim())
        .map(m => m.id);

      // Async fetch sales, purchases, transfers, and the dedicated stock-movements audit log
      const [salesRes, purchasesRes, transfersRes, movementsRes] = await Promise.all([
        fetch('/api/sales').then(r => r.ok ? r.json() : []),
        fetch('/api/purchases').then(r => r.ok ? r.json() : []),
        fetch('/api/transfers').then(r => r.ok ? r.json() : []),
        fetch('/api/stock-movements').then(r => r.ok ? r.json() : [])
      ]);

      const compiledLedger: any[] = [];

      // If we have database movements, they serve as the single source of truth for full-activity auditability!
      const filteredMovements = movementsRes.filter((sm: any) => 
        sm.branchId === branchId && 
        allRelatedMedIds.includes(sm.medicineId)
      );

      if (filteredMovements.length > 0) {
        filteredMovements.forEach((sm: any) => {
          const parts = (sm.date || '').split(' ');
          const d = parts[0] || sm.date || '';
          const t = parts[1] || '12:00';

          const mNotes = (sm.notes || '').trim();
          const smType = (sm.type || '').trim();

          // Determine quantity received (IN) and quantity issued (OUT) accurately
          let qReceived = Number((sm as any).quantityIn !== undefined ? (sm as any).quantityIn : ((sm as any).qtyIn !== undefined ? (sm as any).qtyIn : ((sm as any).quantity_in !== undefined ? (sm as any).quantity_in : ((sm as any).quantityReceived !== undefined ? (sm as any).quantityReceived : 0))));
          let qIssued = Number((sm as any).quantityOut !== undefined ? (sm as any).quantityOut : ((sm as any).qtyOut !== undefined ? (sm as any).qtyOut : ((sm as any).quantity_out !== undefined ? (sm as any).quantity_out : ((sm as any).quantityIssued !== undefined ? (sm as any).quantityIssued : 0))));

          if (qReceived === 0 && qIssued === 0) {
            const rawQty = Number((sm as any).quantity !== undefined ? (sm as any).quantity : ((sm as any).qty !== undefined ? (sm as any).qty : 0));
            const smTypeLower = smType.toLowerCase();
            const mNotesLower = mNotes.toLowerCase();

            if (rawQty > 0) {
              if (smTypeLower.includes('issue') || smTypeLower.includes('sale') || smTypeLower.includes('dispens') || smTypeLower.includes('out') || mNotesLower.includes('issued') || mNotesLower.includes('sale') || mNotesLower.includes('out')) {
                qIssued = rawQty;
              } else {
                qReceived = rawQty;
              }
            } else if (rawQty < 0) {
              if (smTypeLower.includes('receiv') || smTypeLower.includes('purchase') || smTypeLower.includes('in') || mNotesLower.includes('received')) {
                qReceived = Math.abs(rawQty);
              } else {
                qIssued = Math.abs(rawQty);
              }
            }
          }

          // If still 0, try matching reference to PO or Sale or Stock Item
          if (qReceived === 0 && qIssued === 0) {
            const matchedPO = purchasesRes.find((p: any) => p.poNumber === sm.reference || p.invoiceNumber === sm.invoiceNumber || p.id === sm.reference);
            if (matchedPO) {
              const poItem = matchedPO.items?.find((i: any) => allRelatedMedIds.includes(i.medicineId));
              if (poItem && poItem.quantity) qReceived = Number(poItem.quantity);
            }
            if (qReceived === 0 && qIssued === 0) {
              const matchedSale = salesRes.find((s: any) => s.invoiceNumber === sm.invoiceNumber || s.invoiceNumber === sm.reference || s.id === sm.reference);
              if (matchedSale) {
                const saleItem = matchedSale.items?.find((i: any) => allRelatedMedIds.includes(i.medicineId));
                if (saleItem && saleItem.quantity) qIssued = Number(saleItem.quantity);
              }
            }
            if (qReceived === 0 && qIssued === 0) {
              const matchedStock = stockItems.find(s => allRelatedMedIds.includes(s.medicineId) && (s.batchNumber === sm.batchNumber || s.id === sm.reference));
              if (matchedStock && matchedStock.quantity) {
                if (smType.toLowerCase().includes('issue') || smType.toLowerCase().includes('sale') || smType.toLowerCase().includes('out')) {
                  qIssued = Number(matchedStock.quantity);
                } else {
                  qReceived = Number(matchedStock.quantity);
                }
              }
            }
          }

          // Determine supplier/patient/transfer/physical adjustment party text
          let partyText = '';

          const isAdjustment = smType === 'Physical Inventory Adjustment' || 
            smType === 'Adjustment' || 
            smType === 'Price Adjustment' || 
            smType === 'Quantity Edit' || 
            mNotes.toLowerCase().includes('physical inventory') || 
            mNotes.toLowerCase().includes('physical count') ||
            mNotes.toLowerCase().includes('direct edit') ||
            mNotes.toLowerCase().includes('adjustment');

          if (isAdjustment) {
            partyText = 'Physical Inventory Adjustment';
          } else if (smType === 'Stock Transfer In' || smType.includes('Transfer In') || (qReceived > 0 && (sm.sourceBranchName || mNotes.includes('Transferred from')))) {
            const srcBranch = sm.sourceBranchName || branches.find(b => b.id === sm.sourceBranchId)?.name || 'Source Institution';
            partyText = `Institution: ${srcBranch}`;
          } else if (smType === 'Stock Transfer Out' || smType.includes('Transfer Out') || (qIssued > 0 && (sm.targetBranchName || mNotes.includes('Transferred to') || mNotes.includes('Transfer Out') || smType.toLowerCase().includes('transfer')))) {
            let tgtBranch = sm.targetBranchName || branches.find(b => b.id === sm.targetBranchId)?.name;
            if (!tgtBranch && mNotes) {
              if (mNotes.includes('Transferred to')) {
                tgtBranch = mNotes.split('Transferred to')[1]?.trim();
              } else if (mNotes.includes('Transferred')) {
                tgtBranch = mNotes.split('Transferred')[1]?.replace(/^to\s*/i, '')?.trim();
              } else {
                tgtBranch = mNotes.replace(/Bulk Transferred to|Transferred to|Transfer Out to|Transfer/gi, '').trim();
              }
            }
            partyText = `Institution: ${tgtBranch || 'Target Institution'}`;
          } else if (qReceived > 0 || smType.toLowerCase().includes('received')) {
            // Received items -> Supplier Name
            let sName = sm.supplierName;
            
            const isPlaceholder = !sName || 
              sName === 'supplier1' || 
              sName === 'suplier1' || 
              sName === 's1' || 
              sName === 'supplier-1' || 
              sName.toLowerCase() === 'registered supplier' ||
              sName.toLowerCase() === 'stock received';

            if (isPlaceholder || sm.supplierId) {
              const matchedSup = suppliers.find(s => 
                s.id === sm.supplierId || 
                s.id === sName || 
                s.name.toLowerCase() === (sName || '').toLowerCase() ||
                ((sm.supplierId === 'supplier1' || sm.supplierId === 'suplier1' || sm.supplierId === 's1' || sName === 'supplier1' || sName === 'suplier1' || sName === 's1') && (s.id === 's1' || s.id === suppliers[0]?.id))
              );
              if (matchedSup) {
                sName = matchedSup.name;
              }
            }

            if (!sName || sName === 'supplier1' || sName === 'suplier1' || sName === 's1' || sName.toLowerCase() === 'registered supplier' || sName.toLowerCase() === 'stock received') {
              const matchedStock = stockItems.find(s => allRelatedMedIds.includes(s.medicineId) && (s.batchNumber === sm.batchNumber || s.id === sm.reference));
              if (matchedStock && matchedStock.supplierId) {
                const foundInStock = suppliers.find(s => s.id === matchedStock.supplierId || s.name === matchedStock.supplierId);
                if (foundInStock) sName = foundInStock.name;
              }
            }

            if (!sName || sName === 'supplier1' || sName === 'suplier1' || sName === 's1' || sName.toLowerCase() === 'registered supplier' || sName.toLowerCase() === 'stock received') {
              const matchedMed = medicines.find(m => allRelatedMedIds.includes(m.id));
              if (matchedMed && (matchedMed as any).supplierId) {
                const foundInMed = suppliers.find(s => s.id === (matchedMed as any).supplierId || s.name === (matchedMed as any).supplierId);
                if (foundInMed) sName = foundInMed.name;
              }
            }

            if ((!sName || sName === 'supplier1' || sName === 'suplier1' || sName === 's1' || sName.toLowerCase() === 'registered supplier' || sName.toLowerCase() === 'stock received') && mNotes) {
              if (mNotes.includes('Supplier:')) {
                const extracted = mNotes.split('Supplier:')[1]?.split('|')[0]?.trim();
                if (extracted && extracted !== 'supplier1' && extracted !== 'suplier1' && extracted !== 's1' && extracted.toLowerCase() !== 'stock received') {
                  sName = extracted;
                }
              }
            }

            if (!sName || sName === 'supplier1' || sName === 'suplier1' || sName === 's1' || sName.toLowerCase() === 'registered supplier' || sName.toLowerCase() === 'stock received') {
              sName = suppliers[0]?.name || 'Medco Pharmaceuticals PLC';
            }

            partyText = `Supplier: ${sName}`;
          } else if (qIssued > 0) {
            // Check if this movement is a transfer or a sale
            const isTransferOut = smType.toLowerCase().includes('transfer') || mNotes.toLowerCase().includes('transfer') || sm.targetBranchId || sm.targetBranchName;
            if (isTransferOut) {
              let tgtBranch = sm.targetBranchName || branches.find(b => b.id === sm.targetBranchId)?.name;
              if (!tgtBranch && mNotes) {
                if (mNotes.includes('Transferred to')) {
                  tgtBranch = mNotes.split('Transferred to')[1]?.trim();
                } else if (mNotes.includes('Transferred')) {
                  tgtBranch = mNotes.split('Transferred')[1]?.replace(/^to\s*/i, '')?.trim();
                } else {
                  tgtBranch = mNotes.replace(/Bulk Transferred to|Transferred to|Transfer Out to|Transfer/gi, '').trim();
                }
              }
              partyText = `Institution: ${tgtBranch || 'Target Institution'}`;
            } else {
              // Issued items -> Sale -> Patient Name
              let cName = sm.patientName || sm.customerName;
              if (!cName && mNotes) {
                if (mNotes.includes('Patient:') || mNotes.includes('Customer:')) {
                  cName = mNotes.split(/Patient:|Customer:/)[1]?.split('|')[0]?.trim();
                }
              }
              if (!cName) {
                const sale = salesRes.find((s: Sale) => s.invoiceNumber === sm.invoiceNumber || s.invoiceNumber === sm.reference);
                if (sale && ((sale as any).patientName || sale.customerName)) {
                  cName = (sale as any).patientName || sale.customerName;
                }
              }
              partyText = cName ? `Patient: ${cName}` : 'Patient: Walk-in Patient';
            }
          } else {
            partyText = mNotes || (sm.type || 'Activity');
          }

          // Strip out residual legacy boilerplate or generic 'Stock Received' text
          if (partyText === 'Stock Received' || partyText.toLowerCase().startsWith('stock received') || partyText.includes('Legacy Imported Stock Movement') || partyText.includes('Legacy')) {
            if (qReceived > 0 || smType.toLowerCase().includes('received') || qIssued === 0) {
              let sName = sm.supplierName;
              if (!sName || sName === 'supplier1' || sName === 'suplier1' || sName === 's1' || sName.toLowerCase() === 'registered supplier' || sName.toLowerCase() === 'stock received') {
                const matchedStock = stockItems.find(s => allRelatedMedIds.includes(s.medicineId) && (s.batchNumber === sm.batchNumber || s.id === sm.reference));
                if (matchedStock && matchedStock.supplierId) {
                  const foundInStock = suppliers.find(s => s.id === matchedStock.supplierId || s.name === matchedStock.supplierId);
                  if (foundInStock) sName = foundInStock.name;
                }
              }
              if (!sName || sName === 'supplier1' || sName === 'suplier1' || sName === 's1' || sName.toLowerCase() === 'registered supplier' || sName.toLowerCase() === 'stock received') {
                sName = suppliers[0]?.name || 'Medco Pharmaceuticals PLC';
              }
              partyText = `Supplier: ${sName}`;
            } else if (qIssued > 0) {
              partyText = 'Patient: Walk-in Patient';
            } else {
              partyText = 'Physical Inventory Adjustment';
            }
          }

          // User resolution (never display System/system)
          let resolvedUser = (sm.user || '').trim();
          if (!resolvedUser || resolvedUser.toLowerCase() === 'system' || resolvedUser.toLowerCase() === 'system administrator') {
            resolvedUser = currentUser?.name || currentUser?.username || 'Admin';
          }

          // Document invoice number resolution
          let invNo = sm.invoiceNumber || '';
          if (!invNo) {
            const matchedStock = stockItems.find(s => allRelatedMedIds.includes(s.medicineId) && (s.batchNumber === sm.batchNumber || s.id === sm.reference));
            if (matchedStock) {
              invNo = (matchedStock as any).purchaseInvoiceNumber || (matchedStock as any).invoiceNumber || '';
            }
          }
          if (!invNo) {
            const matchedMed = medicines.find(m => allRelatedMedIds.includes(m.id));
            if (matchedMed) {
              invNo = (matchedMed as any).purchaseInvoiceNumber || '';
            }
          }

          // Batch & Expiry resolution
          let bNum = sm.batchNumber || '';
          if (!bNum || bNum === 'N/A') {
            const matchedStock = stockItems.find(s => allRelatedMedIds.includes(s.medicineId) && (s.id === sm.reference || s.batchNumber));
            if (matchedStock) {
              bNum = matchedStock.batchNumber;
            }
          }
          let expDate = sm.expiryDate || '';
          if (!expDate || expDate === 'N/A') {
            const matchedStock = stockItems.find(s => allRelatedMedIds.includes(s.medicineId) && (s.id === sm.reference || s.batchNumber === bNum));
            if (matchedStock) {
              expDate = matchedStock.expiryDate;
            }
          }

          // Buying & Selling price resolution
          let bp = (sm as any).buyingPrice;
          if (bp === undefined || bp === null || bp === 0) {
            const matchedStock = stockItems.find(s => allRelatedMedIds.includes(s.medicineId) && (s.batchNumber === bNum || s.id === sm.reference));
            if (matchedStock && matchedStock.buyingPrice) {
              bp = matchedStock.buyingPrice;
            }
          }
          if (bp === undefined || bp === null || bp === 0) {
            const matchedMed = medicines.find(m => allRelatedMedIds.includes(m.id));
            if (matchedMed && matchedMed.buyingPrice) {
              bp = matchedMed.buyingPrice;
            }
          }

          let sp = (sm as any).sellingPrice || (sm as any).unitPrice;
          if (sp === undefined || sp === null || sp === 0) {
            const matchedStock = stockItems.find(s => allRelatedMedIds.includes(s.medicineId) && (s.batchNumber === bNum || s.id === sm.reference));
            if (matchedStock && (matchedStock as any).sellingPrice) {
              sp = (matchedStock as any).sellingPrice;
            }
          }
          if (sp === undefined || sp === null || sp === 0) {
            const matchedMed = medicines.find(m => allRelatedMedIds.includes(m.id));
            if (matchedMed && matchedMed.price) {
              sp = matchedMed.price;
            }
          }

          compiledLedger.push({
            date: d,
            time: t,
            user: resolvedUser,
            type: isAdjustment ? 'Physical Inventory Adjustment' : (sm.type || 'Activity'),
            batchNumber: bNum || 'N/A',
            expiryDate: expDate || 'N/A',
            quantityReceived: qReceived,
            quantityIssued: qIssued,
            buyingPrice: bp || 0,
            sellingPrice: sp || 0,
            party: partyText,
            reference: sm.reference || 'N/A',
            invoiceNumber: invNo || ''
          });
        });
      } else {
        // Fallback: Dynamically compiled ledger from legacy registers if stockMovements is empty
        // 1. Purchases (Received POs)
        purchasesRes.forEach((po: PurchaseOrder) => {
          if (po.branchId === branchId && po.status === 'Received') {
            po.items.forEach(item => {
              if (allRelatedMedIds.includes(item.medicineId)) {
                const matchingStock = stockItems.find(
                  s => allRelatedMedIds.includes(s.medicineId) && s.branchId === branchId && s.supplierId === po.supplierId
                );
                const matchedMed = medicines.find(m => allRelatedMedIds.includes(m.id));
                const bp = item.unitPrice || matchingStock?.buyingPrice || matchedMed?.buyingPrice || 0;
                const sp = (matchingStock as any)?.sellingPrice || matchedMed?.price || 0;
                compiledLedger.push({
                  date: po.receivedDate || po.date,
                  time: '10:00',
                  user: po.receivedBy || 'Store Keeper',
                  type: 'Received',
                  batchNumber: matchingStock?.batchNumber || 'PO-BATCH',
                  expiryDate: matchingStock?.expiryDate || 'N/A',
                  quantityReceived: item.quantity,
                  quantityIssued: 0,
                  buyingPrice: bp,
                  sellingPrice: sp,
                  party: `Supplier: ${po.supplierName}`,
                  reference: po.poNumber,
                  invoiceNumber: (po as any).invoiceNumber || (matchingStock as any)?.purchaseInvoiceNumber || (matchingStock as any)?.invoiceNumber || ''
                });
              }
            });
          }
        });

        // 2. Sales (Completed Sales)
        salesRes.forEach((sale: Sale) => {
          if (sale.branchId === branchId && sale.status === 'Completed') {
            sale.items.forEach(item => {
              if (allRelatedMedIds.includes(item.medicineId)) {
                const matchingStock = stockItems.find(s => allRelatedMedIds.includes(s.medicineId) && s.batchNumber === item.batchNumber);
                const matchedMed = medicines.find(m => allRelatedMedIds.includes(m.id));
                const bp = matchingStock?.buyingPrice || matchedMed?.buyingPrice || 0;
                const sp = item.unitPrice || matchedMed?.price || 0;
                compiledLedger.push({
                  date: sale.date,
                  time: sale.time || '14:30',
                  user: sale.cashierName || 'Cashier',
                  type: 'Issued',
                  batchNumber: item.batchNumber || 'N/A',
                  expiryDate: stockItems.find(s => allRelatedMedIds.includes(s.medicineId) && s.batchNumber === item.batchNumber)?.expiryDate || 'N/A',
                  quantityReceived: 0,
                  quantityIssued: item.quantity,
                  buyingPrice: bp,
                  sellingPrice: sp,
                  party: `Patient: ${(sale as any).patientName || sale.customerName || 'Walk-in Patient'}`,
                  reference: sale.invoiceNumber,
                  invoiceNumber: sale.invoiceNumber || ''
                });
              }
            });
          }
        });

        // 3. Transfers (Approved & Received Stock Transfers)
        transfersRes.forEach((tr: StockTransfer) => {
          if (tr.status === 'Received') {
            tr.items.forEach(item => {
              if (allRelatedMedIds.includes(item.medicineId)) {
                const matchingStock = stockItems.find(s => allRelatedMedIds.includes(s.medicineId) && s.batchNumber === item.batchNumber);
                const matchedMed = medicines.find(m => allRelatedMedIds.includes(m.id));
                const bp = matchingStock?.buyingPrice || matchedMed?.buyingPrice || 0;
                const sp = matchedMed?.price || 0;
                if (tr.sourceBranchId === branchId) {
                  compiledLedger.push({
                    date: tr.date,
                    time: '11:15',
                    user: tr.processedBy || tr.requestedBy || 'Manager',
                    type: 'Issued',
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate || 'N/A',
                    quantityReceived: 0,
                    quantityIssued: item.quantity,
                    buyingPrice: bp,
                    sellingPrice: sp,
                    party: `Institution: ${tr.targetBranchName}`,
                    reference: tr.transferNumber,
                    invoiceNumber: tr.transferNumber || ''
                  });
                } else if (tr.targetBranchId === branchId) {
                  compiledLedger.push({
                    date: tr.date,
                    time: '11:15',
                    user: tr.processedBy || tr.requestedBy || 'Manager',
                    type: 'Received',
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate || 'N/A',
                    quantityReceived: item.quantity,
                    quantityIssued: 0,
                    buyingPrice: bp,
                    sellingPrice: sp,
                    party: `Institution: ${tr.sourceBranchName}`,
                    reference: tr.transferNumber,
                    invoiceNumber: tr.transferNumber || ''
                  });
                }
              }
            });
          }
        });
      }

      // Sort entries chronologically by Date and Time
      compiledLedger.sort((a, b) => {
        const dateTimeA = `${a.date} ${a.time}`;
        const dateTimeB = `${b.date} ${b.time}`;
        return dateTimeA.localeCompare(dateTimeB);
      });

      // Calculate stateful running balance
      let currentBal = 0;
      const historyWithBalance = compiledLedger.map(entry => {
        currentBal = currentBal + entry.quantityReceived - entry.quantityIssued;
        return {
          ...entry,
          balance: currentBal
        };
      });

      setLedgerHistory(historyWithBalance);
    } catch (err) {
      console.error('Failed to compile bin card ledger logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const matchesMovementFilter = (item: any, filter: string) => {
    if (filter === 'ALL') return true;

    const itemType = (item.type || '').trim().toLowerCase();
    const party = (item.party || '').trim().toLowerCase();

    const isPhysicalInv = itemType.includes('physical') || 
                          itemType.includes('adjustment') || 
                          itemType.includes('edit') || 
                          party.includes('physical inventory');

    const isTransfer = itemType.includes('transfer') || 
                       party.includes('transfer in') || 
                       party.includes('transfer out') ||
                       party.includes('institution');

    if (filter === 'PHYSICAL_INVENTORY') {
      return isPhysicalInv;
    }

    if (filter === 'TRANSFERRED') {
      return isTransfer && !isPhysicalInv;
    }

    if (filter === 'RECEIVED') {
      return (item.quantityReceived > 0 || itemType.includes('received') || itemType.includes('purchase')) && !isTransfer && !isPhysicalInv;
    }

    if (filter === 'ISSUED') {
      return (item.quantityIssued > 0 || itemType.includes('issued') || itemType.includes('sales')) && !isTransfer && !isPhysicalInv;
    }

    return true;
  };

  const filteredLedgerHistory = ledgerHistory.filter(item => matchesMovementFilter(item, movementTypeFilter));

  const downloadExcelCSV = () => {
    if (!selectedMedicine) return;
    const branchName = branches.find(b => b.id === selectedBranchId)?.name || selectedBranchId;
    
    // Explicit columns matching standard compliance register
    const headers = [
      'Name of Pharmacy',
      'Name of Item',
      'Packing Unit',
      'Transaction Date & Time',
      'Processed By / User',
      'Invoice Number',
      'Buying Price (ETB)',
      'Selling Price (ETB)',
      'Quantity Received (IN)',
      'Quantity Issued (OUT)',
      'Received From / Issued To',
      'Batch Number',
      'Expiry Date',
      'Running Balance'
    ];

    const rows = filteredLedgerHistory.map(item => [
      `${institution.name} (${branchName})`,
      selectedMedicine.name,
      selectedMedicine.unit || 'units',
      `${item.date} ${item.time}`,
      item.user,
      item.invoiceNumber || '',
      (item.buyingPrice || 0).toFixed(2),
      (item.sellingPrice || 0).toFixed(2),
      item.quantityReceived || 0,
      item.quantityIssued || 0,
      item.party,
      item.batchNumber,
      item.expiryDate || 'N/A',
      item.balance
    ]);

    const csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BinCard_Excel_${selectedMedicine.name.replace(/\s+/g, '_')}_${branchName.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Deduplicate medicines by name to represent exactly one Bin Card per unique item name
  const uniqueMedicines: Medicine[] = [];
  const seenNames = new Set<string>();
  medicines.forEach(m => {
    const nameKey = m.name.trim().toLowerCase();
    if (!seenNames.has(nameKey)) {
      seenNames.add(nameKey);
      uniqueMedicines.push(m);
    }
  });

  // Filter medicines by search query
  const filteredMedicines = uniqueMedicines.filter(m => {
    const q = debouncedSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || (m.category && m.category.toLowerCase().includes(q));
  });

  const branchName = branches.find(b => b.id === selectedBranchId)?.name || selectedBranchId;

  const allRelatedMedIds = selectedMedicine
    ? medicines
        .filter(m => m.name.toLowerCase().trim() === selectedMedicine.name.toLowerCase().trim())
        .map(m => m.id)
    : [];

  const currentTotalStock = stockItems
    .filter(st => st.branchId === selectedBranchId && allRelatedMedIds.includes(st.medicineId))
    .reduce((sum, item) => sum + item.quantity, 0);

  const totalReceived = ledgerHistory.reduce((sum, item) => sum + (item.quantityReceived || 0), 0);
  const totalIssued = ledgerHistory.reduce((sum, item) => sum + (item.quantityIssued || 0), 0);

  return (
    <div className="space-y-5 font-sans">
      
      {/* Dynamic CSS styles for pristine, clean A4 Print Layout formatting */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            color: black;
            padding: 1.5in 0.5in 0.5in 0.5in;
            font-size: 11px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Screen Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-3 no-print">
        <div>
          <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <Clipboard className="h-5 w-5 text-emerald-600" />
            Compliance Bin Cards &amp; Stock Ledgers
          </h2>
          <p className="text-xs text-gray-500 font-medium">Stateful chronological register of drug transaction histories, additions, and depletions.</p>
        </div>
        
        {selectedMedicine && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => window.print()}
              className="bg-white hover:bg-gray-50 border border-gray-250 text-gray-700 text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4 text-gray-500" />
              Print Card (PDF)
            </button>
            <button
              onClick={downloadExcelCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export to Excel
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        
        {/* Left Column: Product Selector Card */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-gray-800 uppercase tracking-wide block">
                1. Select Pharmacy Branch
              </label>
              <div className="relative flex items-center">
                <MapPin className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
                <select
                  value={selectedBranchId}
                  disabled={currentUser?.role !== 'Super Administrator'}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full bg-white border border-gray-250 pl-9 p-2.5 rounded-lg text-xs font-bold text-gray-800 outline-none focus:border-emerald-500 disabled:opacity-65"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              {currentUser?.role !== 'Super Administrator' && (
                <p className="text-[10px] text-gray-400">Branch locked to active operator assignment.</p>
              )}
            </div>

            <div className="space-y-3 pt-2 border-t">
              <label className="text-xs font-extrabold text-gray-800 uppercase tracking-wide block">
                2. Select Item for Bin Card
              </label>
              
              <div className="relative bg-gray-50 rounded-lg p-2 border border-gray-200 flex items-center gap-1.5">
                <Search className="h-4 w-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Type name or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs outline-none bg-transparent text-gray-800"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="p-0.5 hover:bg-gray-200 rounded text-gray-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="max-h-[360px] overflow-y-auto border rounded-lg divide-y bg-white text-xs">
                {filteredMedicines.map(m => (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMedicine(m)}
                    className={`p-3 cursor-pointer transition-colors flex flex-col gap-0.5 ${
                      selectedMedicine?.id === m.id ? 'bg-emerald-50 border-l-4 border-emerald-600 font-bold' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-900">{m.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-semibold uppercase">{m.unit || 'unit'}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{m.category}</span>
                    <span className="text-[9px] text-gray-400 font-mono mt-0.5">Type: {m.productType || 'medicine'}</span>
                  </div>
                ))}
                {filteredMedicines.length === 0 && (
                  <div className="p-6 text-center text-gray-400 italic">No items found matching criteria.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Ledger Visualizer Window */}
        <div className="lg:col-span-8">
          {!selectedMedicine ? (
            <div className="bg-white border border-dashed border-gray-250 rounded-xl p-20 flex flex-col items-center justify-center text-center space-y-3">
              <span className="p-4 bg-emerald-50 rounded-full text-emerald-600">
                <FileText className="h-8 w-8" />
              </span>
              <h3 className="text-sm font-bold text-gray-800 font-sans">No Item Selected</h3>
              <p className="text-xs text-gray-500 max-w-sm leading-relaxed">
                Choose a pharmacy branch and select a medicine from the left search panel to view its real-time stateful Bin Card register.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-150 shadow-sm p-6 space-y-5">
              
              {/* Card Meta Details */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 gap-3 bg-emerald-50/20 p-4 rounded-xl border border-emerald-100">
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider block">NAME OF PHARMACY</span>
                  <h3 className="text-sm font-extrabold text-emerald-950 mt-0.5">{institution.name} ({branchName})</h3>
                  <p className="text-[11px] text-gray-600 mt-1 font-medium">
                    <b>Item:</b> {selectedMedicine.name}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    <b>Unit:</b> {selectedMedicine.unit || 'N/A'} &bull; <span className="font-semibold text-gray-700">Buying Price:</span> <span className="font-mono text-gray-900 font-bold">{selectedMedicine.buyingPrice ? `${selectedMedicine.buyingPrice.toFixed(2)} ETB` : 'N/A'}</span> &bull; <span className="font-semibold text-gray-700">Selling Price:</span> <span className="font-mono text-emerald-800 font-bold">{selectedMedicine.price ? `${selectedMedicine.price.toFixed(2)} ETB` : 'N/A'}</span>
                  </p>
                </div>
                <div className="bg-white border border-emerald-100 p-3 rounded-lg text-right shrink-0 shadow-sm">
                  <span className="text-[9px] font-bold text-gray-400 block uppercase">Current Physical Quantity</span>
                  <span className="text-base font-extrabold font-mono text-emerald-800 block mt-0.5">
                    {currentTotalStock} {selectedMedicine.unit || 'units'}
                  </span>
                </div>
              </div>

              {/* Dynamic Flow Summary Headers (Received vs. Issued stats) */}
              {!loading && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-gray-50/70 p-3.5 rounded-xl border border-gray-150">
                  <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-2xs flex items-center gap-2.5">
                    <span className="p-2 bg-emerald-50 rounded-full text-emerald-600 shrink-0">
                      <ArrowDownLeft className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block">Total Received (IN)</span>
                      <span className="text-sm font-extrabold font-mono text-emerald-700 block mt-0.5 truncate">
                        +{totalReceived} {selectedMedicine.unit || 'units'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-2xs flex items-center gap-2.5">
                    <span className="p-2 bg-red-50 rounded-full text-red-600 shrink-0">
                      <ArrowUpRight className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block">Total Issued (OUT)</span>
                      <span className="text-sm font-extrabold font-mono text-red-700 block mt-0.5 truncate">
                        -{totalIssued} {selectedMedicine.unit || 'units'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-2xs flex items-center gap-2.5">
                    <span className="p-2 bg-blue-50 rounded-full text-blue-600 shrink-0">
                      <Clipboard className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block">Net Flow Ledger</span>
                      <span className={`text-sm font-extrabold font-mono block mt-0.5 truncate ${
                        totalReceived - totalIssued >= 0 ? 'text-blue-700' : 'text-amber-700'
                      }`}>
                        {totalReceived - totalIssued >= 0 ? '+' : ''}{totalReceived - totalIssued} {selectedMedicine.unit || 'units'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin" />
                  <span className="text-xs text-gray-500 font-semibold animate-pulse">Compiling chronological transaction logs...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  
                  {/* Movement Type Dropdown Filter Bar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 shrink-0">
                        <Filter className="h-3.5 w-3.5 text-emerald-600" />
                        Movement Filter:
                      </label>
                      <select
                        value={movementTypeFilter}
                        onChange={(e) => setMovementTypeFilter(e.target.value)}
                        className="bg-white border border-gray-300 text-xs font-extrabold text-gray-800 rounded-lg py-1.5 px-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs cursor-pointer"
                      >
                        <option value="ALL">All Movements ({ledgerHistory.length})</option>
                        <option value="RECEIVED">Received Only (Suppliers &amp; Stock Receipts)</option>
                        <option value="ISSUED">Issued Only (Patients &amp; Sales)</option>
                        <option value="TRANSFERRED">Transferred Only (Branch Transfers In &amp; Out)</option>
                        <option value="PHYSICAL_INVENTORY">Physical Inventory Adjustments</option>
                      </select>
                    </div>

                    <div className="text-[11px] text-gray-500 font-medium">
                      Showing <span className="font-extrabold text-emerald-700">{filteredLedgerHistory.length}</span> of <span className="font-bold text-gray-800">{ledgerHistory.length}</span> entries
                    </div>
                  </div>

                  <div className="border border-gray-150 rounded-lg overflow-x-auto">
                    <table className="min-w-full text-left text-xs text-gray-700">
                      <thead className="bg-gray-50 border-b border-gray-150 font-bold text-gray-900">
                        <tr>
                          <th className="p-2.5">Date &amp; Time</th>
                          <th className="p-2.5">Batch Code</th>
                          <th className="p-2.5">Invoice #</th>
                          <th className="p-2.5 text-right font-mono text-gray-800">Buying Price</th>
                          <th className="p-2.5 text-right font-mono text-emerald-800">Selling Price</th>
                          <th className="p-2.5 text-center text-emerald-800">IN (Received)</th>
                          <th className="p-2.5 text-center text-red-800">OUT (Issued)</th>
                          <th className="p-2.5">Received From / Issued To</th>
                          <th className="p-2.5">User</th>
                          <th className="p-2.5">Expiry Date</th>
                          <th className="p-2.5 text-right font-mono">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-sans text-[11px] text-gray-600">
                        {filteredLedgerHistory.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="p-2.5 font-mono text-gray-900 font-medium">
                              {item.date} <span className="text-[10px] text-gray-400">({item.time})</span>
                            </td>
                            <td className="p-2.5 font-mono text-gray-550 font-semibold">{item.batchNumber}</td>
                            <td className="p-2.5 font-mono text-gray-500 font-medium">{(item as any).invoiceNumber || ''}</td>
                            <td className="p-2.5 text-right font-mono text-gray-700 font-medium">
                              {item.buyingPrice > 0 ? `${item.buyingPrice.toFixed(2)} ETB` : '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono text-emerald-700 font-bold">
                              {item.sellingPrice > 0 ? `${item.sellingPrice.toFixed(2)} ETB` : '-'}
                            </td>
                            <td className="p-2.5 text-center font-extrabold text-emerald-600">
                              {item.quantityReceived > 0 ? (
                                <span className="inline-flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                                  <ArrowDownLeft className="h-3 w-3" />
                                  +{item.quantityReceived}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="p-2.5 text-center font-extrabold text-red-600">
                              {item.quantityIssued > 0 ? (
                                <span className="inline-flex items-center gap-0.5 bg-red-50 px-1.5 py-0.5 rounded text-[10px]">
                                  <ArrowUpRight className="h-3 w-3" />
                                  -{item.quantityIssued}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="p-2.5 font-medium max-w-[150px] truncate text-gray-700" title={item.party}>{item.party}</td>
                            <td className="p-2.5 text-gray-500 font-semibold">{item.user}</td>
                            <td className="p-2.5 font-mono text-gray-500">{item.expiryDate}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-gray-950 bg-gray-50/50">
                              {item.balance} {selectedMedicine.unit || 'units'}
                            </td>
                          </tr>
                        ))}
                        {filteredLedgerHistory.length === 0 && (
                          <tr>
                            <td colSpan={11} className="p-12 text-center text-gray-400 italic">No matching movement entries found for selected filter criteria.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3.5 text-[11px] leading-relaxed text-amber-900 font-medium">
                    ⚠️ <b>Compliance Instruction:</b> Physical balance in cabinet storage shelves must always coincide exactly with the stateful running balance verified above. Correct discrepancies using adjusting logs immediately.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* =======================================================
          PRINTABLE HARDCOPY BIN CARD LAYOUT (A4 Template Format)
          ======================================================= */}
      {selectedMedicine && (
        <div id="print-area" className="hidden font-sans text-xs">
          {/* Header Title */}
          <div className="text-center border-b-2 border-gray-900 pb-4 mb-6">
            <h1 className="text-xl font-black uppercase tracking-widest text-gray-900">Official Pharmacy Bin Card Register</h1>
            <p className="text-xs text-gray-500 uppercase font-mono tracking-wider mt-1">Ministry of Health Stock Ledger Document</p>
          </div>

          {/* Master Info Grid */}
          <div className="grid grid-cols-2 gap-4 border-b pb-4 mb-4">
            <div className="space-y-1.5">
              <p><b>Name of Pharmacy:</b> <span className="underline font-bold text-gray-900">{institution.name} ({branchName})</span></p>
              <p><b>Name of Item (Drug):</b> <span className="underline font-bold text-gray-900">{selectedMedicine.name}</span></p>
              <p><b>Category:</b> <span className="underline">{selectedMedicine.category || 'N/A'}</span></p>
            </div>
            <div className="space-y-1.5 text-right">
              <p><b>Packing Unit:</b> <span className="underline font-bold">{selectedMedicine.unit || 'PCS'}</span></p>
              <p><b>Current Physical Stock:</b> <span className="underline font-bold text-emerald-800">{currentTotalStock} units</span></p>
            </div>
          </div>

          {/* Transaction Ledger Table */}
          <table className="w-full border-collapse border border-gray-800 text-[10px]">
            <thead>
              <tr className="bg-gray-100 text-gray-950 font-bold uppercase border-b border-gray-800 text-left">
                <th className="border border-gray-800 p-2">Date &amp; Time</th>
                <th className="border border-gray-800 p-2">Batch No</th>
                <th className="border border-gray-800 p-2">Invoice No</th>
                <th className="border border-gray-800 p-2 text-right font-mono">Buying Price</th>
                <th className="border border-gray-800 p-2 text-right font-mono">Selling Price</th>
                <th className="border border-gray-800 p-2 text-center">Qty Received (IN)</th>
                <th className="border border-gray-800 p-2 text-center">Qty Issued (OUT)</th>
                <th className="border border-gray-800 p-2 text-right">Running Balance</th>
                <th className="border border-gray-800 p-2">Received From / Issued To</th>
                <th className="border border-gray-800 p-2">Processed By / Sign</th>
                <th className="border border-gray-800 p-2">Expiry Date</th>
              </tr>
            </thead>
            <tbody>
              {ledgerHistory.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50 border-b border-gray-300">
                  <td className="border border-gray-800 p-2 font-mono">{item.date} {item.time}</td>
                  <td className="border border-gray-800 p-2 font-mono font-bold">{item.batchNumber}</td>
                  <td className="border border-gray-800 p-2 font-mono text-[9px]">{(item as any).invoiceNumber || ''}</td>
                  <td className="border border-gray-800 p-2 text-right font-mono font-medium">
                    {item.buyingPrice > 0 ? `${item.buyingPrice.toFixed(2)} ETB` : '-'}
                  </td>
                  <td className="border border-gray-800 p-2 text-right font-mono font-bold">
                    {item.sellingPrice > 0 ? `${item.sellingPrice.toFixed(2)} ETB` : '-'}
                  </td>
                  <td className="border border-gray-800 p-2 text-center font-bold text-gray-900">
                    {item.quantityReceived > 0 ? `+${item.quantityReceived}` : '-'}
                  </td>
                  <td className="border border-gray-800 p-2 text-center font-bold text-gray-900">
                    {item.quantityIssued > 0 ? `-${item.quantityIssued}` : '-'}
                  </td>
                  <td className="border border-gray-800 p-2 text-right font-mono font-black">{item.balance} units</td>
                  <td className="border border-gray-800 p-2 text-[9px]">{item.party}</td>
                  <td className="border border-gray-800 p-2 font-semibold text-gray-700">{item.user}</td>
                  <td className="border border-gray-800 p-2 font-mono text-gray-500">{item.expiryDate}</td>
                </tr>
              ))}
              {ledgerHistory.length === 0 && (
                <tr>
                  <td colSpan={11} className="border border-gray-800 p-10 text-center italic text-gray-400">
                    No transactions registered. Stock registry empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Print Sign-off section */}
          <div className="mt-12 grid grid-cols-2 gap-10 pt-8">
            <div className="border-t border-gray-600 pt-2 text-center">
              <p className="font-bold text-gray-800">Prepared By (Stock Pharmacist Signature)</p>
              <p className="text-[10px] text-gray-400 mt-2">Date: ____/____/2026</p>
            </div>
            <div className="border-t border-gray-600 pt-2 text-center">
              <p className="font-bold text-gray-800">Approved By (Branch Manager Signature)</p>
              <p className="text-[10px] text-gray-400 mt-2">Date: ____/____/2026</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
