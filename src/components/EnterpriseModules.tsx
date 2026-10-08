import React, { useState, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { 
  ArrowRightLeft, Users, Wallet, ShieldAlert, 
  MapPin, Plus, Check, Clipboard, DollarSign, Award, 
  Trash2, ShieldCheck, AlertCircle, RefreshCw, Layers, Lock,
  Search, X, FileSpreadsheet, Bell, Mail, Phone, Send, FileText, CheckCircle2, Receipt, Building, Activity, Laptop, MessageSquare,
  Edit, RotateCcw, Key, Copy, EyeOff, Eye, Video, Play, Upload, Film, Sparkles, Tag, Megaphone, Percent, FolderTree,
  Globe, UserCheck, Repeat, Clock, MousePointer, AlertTriangle, Calendar, Paperclip, Download, Image as ImageIcon,
  ScanLine, Camera, CreditCard
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { 
  Branch, User, Medicine, StockItem, Supplier, SupplierTransaction,
  PurchaseOrder, StockTransfer, Customer, Expense, AuditLog, Sale, PharmacyNote, UserRole, ProductCategory,
  VisitorLogEntry, VisitorStats
} from '../types.ts';
import CategoryManagerPanel from './CategoryManagerPanel.tsx';
import { ScanItemsModal } from './ScanItemsModal';

// ==================== 1. STOCK TRANSFER MANAGER ====================
interface StockTransferPanelProps {
  currentUser: any;
  branches: Branch[];
  medicines: Medicine[];
  stockItems: StockItem[];
  transfers: StockTransfer[];
  onDataChanged: () => void;
}

export function StockTransferPanel({ currentUser, branches, medicines, stockItems, transfers, onDataChanged }: StockTransferPanelProps) {
  const [instName, setInstName] = useState('Sonan Pharmacy');

  useEffect(() => {
    const fetchInstName = async () => {
      try {
        const res = await fetch('/api/settings/institution');
        if (res.ok) {
          const data = await res.json();
          if (data && data.name) setInstName(data.name);
        }
      } catch (err) {
        console.error('Failed to fetch instName in StockTransferPanel:', err);
      }
    };
    fetchInstName();
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [transferType, setTransferType] = useState<'Internal' | 'External'>('Internal');
  const [sourceBranchId, setSourceBranchId] = useState('b1');
  const [targetBranchId, setTargetBranchId] = useState('b2');
  const [externalPharmacyName, setExternalPharmacyName] = useState('');
  const [externalPharmacies, setExternalPharmacies] = useState<any[]>([]);
  const [showAddExternalModal, setShowAddExternalModal] = useState(false);
  const [newExtName, setNewExtName] = useState('');
  const [newExtPhone, setNewExtPhone] = useState('');
  const [newExtAddress, setNewExtAddress] = useState('');
  const [newExtTin, setNewExtTin] = useState('');
  
  const [transferLines, setTransferLines] = useState<{ medicineId: string; quantity: number; batchNumber: string; expiryDate: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [transferNotes, setTransferNotes] = useState('');

  // Search & Sorting States
  const [transferSearch, setTransferSearch] = useState('');
  const debouncedTransferSearch = useDebounce(transferSearch, 200);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'me' | 'pending' | 'completed' | 'cancelled'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [reviewTransfer, setReviewTransfer] = useState<any | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<any | null>(null);
  
  const handleEditTransferClick = (t: any) => {
    setEditingTransfer(t);
    setTransferType(t.transferType);
    setSourceBranchId(t.sourceBranchId);
    if (t.transferType === 'Internal') {
      setTargetBranchId(t.targetBranchId || 'b2');
    } else {
      setExternalPharmacyName(t.externalPharmacyName || '');
    }
    setTransferLines(t.items.map((it: any) => ({
      medicineId: it.medicineId,
      quantity: it.quantity,
      batchNumber: it.batchNumber || '',
      expiryDate: it.expiryDate || ''
    })));
    setTransferNotes(t.notes || '');
    setReviewTransfer(null);
    setShowModal(true);
  };
  
  // Requisition Modal item search (working like POS search)
  const [modalItemSearch, setModalItemSearch] = useState('');

  // Resize states for Split Panel inside Requisition/Transfer Modal
  const [leftWidth, setLeftWidth] = useState(580); // default starting width in pixels
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const modalElement = document.getElementById('transfer-modal-container');
      if (modalElement) {
        const rect = modalElement.getBoundingClientRect();
        const newWidth = e.clientX - rect.left;
        // Keep within bounds (min 280px, max 85% of modal width)
        if (newWidth > 280 && newWidth < rect.width * 0.85) {
          setLeftWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  const voucherTotalQuantity = transferLines.reduce((acc, line) => acc + Number(line.quantity), 0);
  const voucherTotalBuyingPrice = transferLines.reduce((acc, line) => {
    const activeLineStock = stockItems.find(st => st.branchId === sourceBranchId && (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase() && st.medicineId === line.medicineId);
    const med = medicines.find(m => m.id === line.medicineId);
    const price = activeLineStock?.buyingPrice || med?.buyingPrice || 0;
    return acc + (Number(line.quantity) * price);
  }, 0);
  const voucherTotalSellingPrice = transferLines.reduce((acc, line) => {
    const med = medicines.find(m => m.id === line.medicineId);
    const price = med?.price || 0;
    return acc + (Number(line.quantity) * price);
  }, 0);

  // Fetch external pharmacies
  const fetchExternalPharmacies = async () => {
    try {
      const res = await fetch('/api/external-pharmacies');
      if (res.ok) {
        setExternalPharmacies(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch external pharmacies:', err);
    }
  };

  useEffect(() => {
    fetchExternalPharmacies();
  }, []);

  // Active branch stocks for selection
  const activeBranchStocks = stockItems.filter(st => st.branchId === sourceBranchId && st.quantity > 0);

  // Filtered branch stocks for the searchable dropdown select
  const filteredActiveBranchStocks = activeBranchStocks.filter(st => {
    const med = medicines.find(m => m.id === st.medicineId);
    if (!med) return false;
    const q = modalItemSearch.toLowerCase();
    return med.name.toLowerCase().includes(q) || 
           (med.genericName && med.genericName.toLowerCase().includes(q)) ||
           (med.barcode && med.barcode.toLowerCase().includes(q)) ||
           st.batchNumber.toLowerCase().includes(q);
  });

  // Add External Pharmacy Handler
  const handleAddExternalPharmacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExtName) return;
    try {
      const res = await fetch('/api/external-pharmacies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newExtName,
          phone: newExtPhone,
          address: newExtAddress,
          tinNumber: newExtTin
        })
      });
      if (res.ok) {
        const added = await res.json();
        setExternalPharmacies(prev => [...prev, added]);
        setExternalPharmacyName(added.name);
        setShowAddExternalModal(false);
        setNewExtName('');
        setNewExtPhone('');
        setNewExtAddress('');
        setNewExtTin('');
      } else {
        alert('Failed to add external pharmacy.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add line instantly from catalog selection (like POS click)
  const handleSelectCatalogItem = (stockItem: any) => {
    // Check if already in transfer lines
    const existingIdx = transferLines.findIndex(line => line.medicineId === stockItem.medicineId && (line.batchNumber || '').trim().toLowerCase() === (stockItem.batchNumber || '').trim().toLowerCase());
    if (existingIdx > -1) {
      const next = [...transferLines];
      if (next[existingIdx].quantity < stockItem.quantity) {
        next[existingIdx].quantity += 1;
        setTransferLines(next);
      } else {
        alert(`Cannot exceed maximum available stock of ${stockItem.quantity} units.`);
      }
    } else {
      setTransferLines([...transferLines, {
        medicineId: stockItem.medicineId,
        quantity: 1,
        batchNumber: stockItem.batchNumber,
        expiryDate: stockItem.expiryDate
      }]);
    }
  };

  const removeLine = (idx: number) => {
    setTransferLines(transferLines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, key: string, val: any) => {
    const next = [...transferLines];
    if (key === 'quantity') {
      const line = next[idx];
      const branchTotalStock = stockItems
        .filter(st => st.branchId === sourceBranchId && st.medicineId === line.medicineId && !st.isDamaged && st.quantity > 0)
        .reduce((sum, st) => sum + st.quantity, 0);
      const stockObj = stockItems.find(st => st.branchId === sourceBranchId && (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase() && st.medicineId === line.medicineId);
      const maxQty = branchTotalStock > 0 ? branchTotalStock : (stockObj ? stockObj.quantity : 99999);
      let targetVal = Number(val);
      if (targetVal < 1) targetVal = 1;
      if (targetVal > maxQty) targetVal = maxQty;
      next[idx].quantity = targetVal;
    } else {
      (next[idx] as any)[key] = val;
    }
    setTransferLines(next);
  };

  const submitTransfer = async (statusOverride?: 'Draft' | 'Pending' | 'Approved' | 'Completed' | 'Received') => {
    if (transferType === 'Internal' && sourceBranchId === targetBranchId) {
      alert('Validation Error: Source and Target branches must be different.');
      return;
    }
    if (transferType === 'External' && !externalPharmacyName) {
      alert('Validation Error: Please select or register an external destination pharmacy.');
      return;
    }
    if (transferLines.length === 0) {
      alert('Validation Error: Select at least one stock item to transfer.');
      return;
    }

    // Set initial status based on button clicked
    const initialStatus = statusOverride || 'Pending';

    try {
      setSubmitting(true);
      const payload: any = {
        sourceBranchId,
        targetBranchId: transferType === 'Internal' ? targetBranchId : undefined,
        externalPharmacyName: transferType === 'External' ? externalPharmacyName : undefined,
        transferType,
        items: transferLines,
        notes: transferNotes,
        operatorId: currentUser?.id
      };

      let url = '/api/transfers';
      if (editingTransfer) {
        url = '/api/transfers/edit';
        payload.transferId = editingTransfer.id;
      } else {
        payload.status = initialStatus;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowModal(false);
        setEditingTransfer(null);
        setTransferLines([]);
        setModalItemSearch('');
        setTransferNotes('');
        onDataChanged();
        alert(editingTransfer ? 'Stock transfer voucher successfully updated.' : `Stock transfer voucher successfully issued as [${initialStatus}].`);
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (tId: string, nextStatus: string, reason?: string) => {
    try {
      const res = await fetch('/api/transfers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferId: tId,
          status: nextStatus,
          reason: reason || undefined,
          operatorId: currentUser?.id
        })
      });
      if (res.ok) {
        alert(`Voucher successfully updated to status: [${nextStatus}].`);
        onDataChanged();
        setReviewTransfer(null);
      } else {
        const err = await res.json();
        alert(`Stock Action Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Past Transfer Filters
  const filteredTransfers = transfers.filter(t => {
    if (currentUser?.role !== 'Super Administrator') {
      const isMine = t.requestedBy === currentUser?.name || t.processedBy === currentUser?.name || t.requestedBy === currentUser?.username;
      if (!isMine) return false;
    }

    const query = debouncedTransferSearch.toLowerCase();
    const matchesCode = t.transferNumber ? t.transferNumber.toLowerCase().includes(query) : false;
    const matchesSource = t.sourceBranchName ? t.sourceBranchName.toLowerCase().includes(query) : false;
    const matchesTarget = t.targetBranchName ? t.targetBranchName.toLowerCase().includes(query) : false;
    const matchesExternal = t.externalPharmacyName ? t.externalPharmacyName.toLowerCase().includes(query) : false;
    const matchesNotes = t.notes ? t.notes.toLowerCase().includes(query) : false;
    const matchesItems = t.items ? t.items.some(it => 
      (it.medicineName ? it.medicineName.toLowerCase().includes(query) : false) || 
      (it.batchNumber ? it.batchNumber.toLowerCase().includes(query) : false)
    ) : false;
    const matchesQuery = matchesCode || matchesSource || matchesTarget || matchesExternal || matchesNotes || matchesItems;

    if (!matchesQuery) return false;

    // Filter by tab/option
    if (historyFilter === 'me') {
      return t.requestedBy === currentUser?.name || t.processedBy === currentUser?.name;
    }
    if (historyFilter === 'pending') {
      return t.status === 'Pending' || t.status === 'Draft';
    }
    if (historyFilter === 'completed') {
      return t.status === 'Completed' || t.status === 'Received';
    }
    if (historyFilter === 'cancelled') {
      return t.status === 'Cancelled' || t.status === 'Reversed';
    }
    return true;
  });

  // Reordered Transfer History
  const sortedTransfers = [...filteredTransfers].sort((a, b) => {
    const valA = a.date || '';
    const valB = b.date || '';
    if (sortOrder === 'desc') {
      return valB.localeCompare(valA);
    } else {
      return valA.localeCompare(valB);
    }
  });

  // Download stock transfers report CSV
  const downloadTransfersCSV = () => {
    const headers = ['Transfer Code', 'Type', 'Source Sender', 'Destination Receiver', 'Date Created', 'Items Detail', 'Status', 'Processed By', 'Notes'];
    const rows = sortedTransfers.map(t => [
      t.transferNumber || `TR-REV-${t.id.slice(-4)}`,
      t.transferType,
      t.sourceBranchName || 'Unknown',
      t.transferType === 'Internal' ? (t.targetBranchName || 'N/A') : (t.externalPharmacyName || 'N/A'),
      t.date,
      (t.items || []).map(it => `${it.medicineName || 'Unknown'} (Batch: ${it.batchNumber || 'N/A'}) - ${it.quantity || 0} units`).join('; '),
      t.status,
      t.processedBy || 'Pending',
      t.notes || ''
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${instName.replace(/\s+/g, '_')}_Stock_Transfers_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 uppercase tracking-wide">
            <ArrowRightLeft className="h-4.5 w-4.5 text-indigo-600" />
            Stock Movement &amp; Transfers Hub
          </h3>
          <p className="text-xs text-gray-500 font-medium">Log stock requisitions, transfer stock internally, or dispatch to external pharmacies with stateful stock updates.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadTransfersCSV}
            className="bg-gray-105 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2 px-3.5 rounded border flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer animate-none"
          >
            📥 Export CSV Logs
          </button>
          {currentUser?.role !== 'Cashier' && currentUser?.role !== 'Accountant' && (
            <button 
              onClick={() => { 
                setEditingTransfer(null);
                setShowModal(true); 
                setTransferLines([]); 
                setModalItemSearch(''); 
                setTransferNotes('');
                const defaultSrc = currentUser?.branchId === 'all' ? 'b1' : currentUser?.branchId;
                setSourceBranchId(defaultSrc);
                const defaultTgt = branches.find(b => b.id !== defaultSrc)?.id || 'b2';
                setTargetBranchId(defaultTgt);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3.5 rounded shadow flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New Transfer Voucher
            </button>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col xl:flex-row gap-3 bg-white p-3.5 rounded-xl border border-gray-150">
        <div className="relative flex-1 bg-gray-50 rounded-lg p-2 border border-gray-200 flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search transfers by voucher code, branch, drug name, or batch..."
            value={transferSearch}
            onChange={(e) => setTransferSearch(e.target.value)}
            className="w-full text-xs outline-none bg-transparent text-gray-800 font-semibold"
          />
          {transferSearch && (
            <button onClick={() => setTransferSearch('')} className="p-1 hover:bg-gray-200 rounded text-gray-400">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            onClick={() => setHistoryFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-lg font-bold border transition ${
              historyFilter === 'all' ? 'bg-indigo-650 text-white border-indigo-700' : 'bg-white hover:bg-gray-50 text-gray-650 border-gray-200'
            }`}
          >
            All Transfers
          </button>
          <button
            onClick={() => setHistoryFilter('me')}
            className={`px-3 py-1.5 text-xs rounded-lg font-bold border transition ${
              historyFilter === 'me' ? 'bg-indigo-650 text-white border-indigo-700' : 'bg-white hover:bg-gray-50 text-gray-650 border-gray-200'
            }`}
            title="See transfers that I requested or processed"
          >
            👤 What I Transferred
          </button>
          <button
            onClick={() => setHistoryFilter('pending')}
            className={`px-3 py-1.5 text-xs rounded-lg font-bold border transition ${
              historyFilter === 'pending' ? 'bg-amber-600 text-white border-amber-700' : 'bg-white hover:bg-gray-50 text-gray-650 border-gray-200'
            }`}
          >
            Draft &amp; Pending
          </button>
          <button
            onClick={() => setHistoryFilter('completed')}
            className={`px-3 py-1.5 text-xs rounded-lg font-bold border transition ${
              historyFilter === 'completed' ? 'bg-emerald-650 text-white border-emerald-700' : 'bg-white hover:bg-gray-50 text-gray-650 border-gray-200'
            }`}
          >
            Completed / Received
          </button>
          <button
            onClick={() => setHistoryFilter('cancelled')}
            className={`px-3 py-1.5 text-xs rounded-lg font-bold border transition ${
              historyFilter === 'cancelled' ? 'bg-red-650 text-white border-red-700' : 'bg-white hover:bg-gray-50 text-gray-650 border-gray-200'
            }`}
          >
            Cancelled
          </button>

          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-3 text-xs font-semibold text-gray-700 flex items-center gap-1.5 transition-colors shrink-0"
          >
            <span>Date:</span>
            <span className="font-mono text-indigo-700 font-bold">{sortOrder === 'desc' ? 'Newest First ⇅' : 'Oldest First ⇅'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-150 overflow-x-auto text-xs shadow-sm scrollbar-thin">
        <table className="min-w-full text-left">
          <thead className="bg-gray-55 border-b border-gray-100 font-semibold text-gray-700 uppercase tracking-wide text-[10px]">
            <tr>
              <th className="p-3.5">Code</th>
              <th className="p-3.5">Type</th>
              <th className="p-3.5">Source (Sender)</th>
              <th className="p-3.5">Destination (Receiver)</th>
              <th className="p-3.5">Date Created</th>
              <th className="p-3.5">Voucher Items</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-600">
            {sortedTransfers.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-3.5 font-mono font-bold text-gray-900">{t.transferNumber || `TR-REV-${t.id.slice(-4)}`}</td>
                <td className="p-3.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    t.transferType === 'External' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  }`}>
                    {t.transferType || 'Internal'}
                  </span>
                </td>
                <td className="p-3.5 font-medium">{t.sourceBranchName || 'Unknown Source'}</td>
                <td className="p-3.5 font-semibold text-slate-800">
                  {t.transferType === 'External' ? (
                    <span className="flex items-center gap-1 text-purple-700">
                      🏢 {t.externalPharmacyName || 'External Pharmacy'}
                    </span>
                  ) : (
                    <span>🏪 {t.targetBranchName || 'Unassigned Branch'}</span>
                  )}
                </td>
                <td className="p-3.5 font-mono text-gray-500">{t.date}</td>
                <td className="p-3.5 space-y-1">
                  {(t.items || []).slice(0, 2).map((it, idx) => (
                    <div key={idx} className="bg-gray-100 p-1 rounded text-[10px] leading-tight font-medium text-gray-700 flex justify-between">
                      <span>{it.medicineName || 'Unknown'} <span className="text-[9px] text-gray-400">(B: {it.batchNumber || 'N/A'})</span></span>
                      <b className="text-slate-900 ml-1.5 font-mono">{it.quantity}</b>
                    </div>
                  ))}
                  {t.items && t.items.length > 2 && (
                    <div className="text-[9px] text-indigo-600 font-bold pl-1">
                      + {t.items.length - 2} more items
                    </div>
                  )}
                </td>
                <td className="p-3.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase border ${
                    t.status === 'Completed' || t.status === 'Received' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    t.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-100' :
                    t.status === 'Reversed' ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold' :
                    t.status === 'Draft' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                    t.status === 'Approved' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                    t.status === 'Dispatched' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                    'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'
                  }`}>
                    ● {t.status}
                  </span>
                </td>
                <td className="p-3.5 text-center">
                  <div className="flex justify-center items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setReviewTransfer(t)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold py-1 px-2.5 rounded border border-gray-250 transition cursor-pointer"
                    >
                      Audit / Action
                    </button>
                    {t.status === 'Pending' && currentUser?.role === 'Super Administrator' && (
                      <button
                        onClick={() => handleUpdateStatus(t.id, t.transferType === 'External' ? 'Completed' : 'Approved')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1 px-2.5 rounded shadow-sm cursor-pointer"
                      >
                        Approve
                      </button>
                    )}
                    {currentUser?.role === 'Super Administrator' && t.status !== 'Completed' && t.status !== 'Cancelled' && t.status !== 'Reversed' && (
                      <button
                        onClick={() => {
                          const reason = prompt(`Cancel transfer #${t.transferNumber || t.id.slice(-4)} before completion? Optional reason:`, 'Cancelled by admin prior to completion');
                          if (reason !== null) {
                            handleUpdateStatus(t.id, 'Cancelled', reason);
                          }
                        }}
                        title="Cancel transfer before completion (reverts deducted stock if any)"
                        className="bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold py-1 px-2.5 rounded border border-red-200 cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    {currentUser?.role === 'Super Administrator' && (t.status === 'Completed' || t.status === 'Received') && (
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to REVERSE completed transfer #${t.transferNumber || t.id.slice(-4)}?\n\nThis will deduct stock from target branch (${t.targetBranchName || 'Target'}) and return stock back to source branch (${t.sourceBranchName}).`)) {
                            const reason = prompt(`Reason for REVERSING completed transfer #${t.transferNumber || t.id.slice(-4)}:`, 'Reversing completed stock transfer voucher');
                            if (reason !== null) {
                              handleUpdateStatus(t.id, 'Reversed', reason);
                            }
                          }
                        }}
                        title="Reverse completed transfer (moves stock back to source branch)"
                        className="bg-amber-50 hover:bg-amber-100 text-amber-900 text-[10px] font-bold py-1 px-2.5 rounded border border-amber-300 cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <RotateCcw className="h-2.5 w-2.5 text-amber-700" />
                        Reverse
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {sortedTransfers.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-400 italic">No transfer records found matching the active filter parameters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Review Transfer / Audit Pipeline Modal */}
      {reviewTransfer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-gray-150 text-xs text-gray-800 resize overflow-auto min-w-[320px] min-h-[300px]">
            <div className="p-5 pb-3 border-b flex items-center justify-between shrink-0 bg-white rounded-t-xl">
              <div>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-indigo-600" />
                  Transfer Voucher &amp; Action Portal
                </h3>
                <span className="text-[10px] font-mono text-indigo-700 font-bold mt-0.5 block bg-indigo-50 px-2 py-0.5 rounded-lg w-fit">
                  VOUCHER ID: {reviewTransfer.transferNumber || `TR-REV-${reviewTransfer.id.slice(-4)}`} ({reviewTransfer.transferType || 'Internal'})
                </span>
              </div>
              <button 
                onClick={() => setReviewTransfer(null)}
                className="text-gray-400 hover:text-gray-600 p-1 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
              {/* Detailed Workflow Status pipeline indicators */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-150">
                <span className="text-[10px] uppercase font-extrabold text-gray-500 block mb-2">Voucher Life-Cycle Progress (Click circles to change status)</span>
                <div className="flex items-center justify-between gap-1">
                  {['Draft', 'Pending', 'Approved', 'Dispatched', 'Received', 'Completed'].map((st, i) => {
                    const isPassed = ['Draft', 'Pending', 'Approved', 'Dispatched', 'Received', 'Completed'].indexOf(reviewTransfer.status) >= i;
                    const isCurrent = reviewTransfer.status === st;
                    return (
                      <React.Fragment key={st}>
                        <div 
                          onClick={() => {
                            if (currentUser?.role !== 'Super Administrator') {
                              alert("Permission Denied: Only Super Administrators are authorized to transition stock transfer stages.");
                              return;
                            }
                            if (confirm(`Are you sure you want to transition this voucher status to "${st}"?`)) {
                              handleUpdateStatus(reviewTransfer.id, st);
                            }
                          }}
                          className="flex flex-col items-center flex-1 cursor-pointer group select-none"
                          title={`Click to set status to ${st}`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border transition-all duration-150 group-hover:scale-115 group-hover:shadow-xs ${
                            isCurrent ? 'bg-indigo-650 text-white border-indigo-700 ring-2 ring-indigo-300' :
                            isPassed ? 'bg-emerald-600 text-white border-emerald-700 group-hover:bg-emerald-700' :
                            'bg-white text-gray-400 border-gray-200 group-hover:border-indigo-400 group-hover:text-indigo-650'
                          }`}>
                            {isPassed && !isCurrent ? '✓' : i + 1}
                          </div>
                          <span className={`text-[8px] font-extrabold mt-1 uppercase transition-colors duration-150 ${
                            isCurrent ? 'text-indigo-600 font-black' : 
                            isPassed ? 'text-gray-700' : 
                            'text-gray-400 group-hover:text-indigo-600'
                          }`}>
                            {st}
                          </span>
                        </div>
                        {i < 5 && (
                          <div className={`h-0.5 flex-1 transition ${
                            ['Draft', 'Pending', 'Approved', 'Dispatched', 'Received', 'Completed'].indexOf(reviewTransfer.status) > i ? 'bg-emerald-500' : 'bg-gray-200'
                          }`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100 text-[11px]">
                <div>
                  <span className="text-gray-400 block uppercase font-bold text-[8px]">Source Branch (Shipper)</span>
                  <span className="font-bold text-gray-900">🏪 {reviewTransfer.sourceBranchName}</span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase font-bold text-[8px]">Destination (Consignee)</span>
                  <span className="font-bold text-gray-900">
                    {reviewTransfer.transferType === 'External' ? `🏢 ${reviewTransfer.externalPharmacyName} (EXTERNAL)` : `🏪 ${reviewTransfer.targetBranchName}`}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase font-bold text-[8px]">Requested By</span>
                  <span className="font-semibold text-gray-800">{reviewTransfer.requestedBy}</span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase font-bold text-[8px]">Processed / Audited By</span>
                  <span className="font-semibold text-gray-800">{reviewTransfer.processedBy || 'Awaiting Authorization'}</span>
                </div>
                <div className="col-span-2 border-t pt-2 mt-1">
                  <span className="text-gray-400 block uppercase font-bold text-[8px]">Transferee Remarks &amp; Notes</span>
                  <p className="text-gray-700 font-medium italic mt-0.5">{reviewTransfer.notes || 'No custom remarks recorded.'}</p>
                </div>
              </div>

              {/* Action Toolbar based on role and transfer type */}
              {reviewTransfer.status !== 'Cancelled' && reviewTransfer.status !== 'Reversed' && (
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2">
                  {currentUser?.role === 'Super Administrator' ? (
                    <>
                      <span className="font-bold text-indigo-900 block text-[10px] uppercase">Perform Stateful Voucher Action (Super Administrator):</span>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {reviewTransfer.status === 'Draft' && (
                          <button
                            onClick={() => handleUpdateStatus(reviewTransfer.id, 'Pending')}
                            className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-1 px-3 rounded text-[10px] cursor-pointer"
                          >
                            Submit for Approval
                          </button>
                        )}
                        {(reviewTransfer.status === 'Pending' || reviewTransfer.status === 'Draft') && (
                          <button
                            onClick={() => handleUpdateStatus(reviewTransfer.id, 'Approved')}
                            className="bg-blue-650 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-[10px] cursor-pointer"
                          >
                            Approve (Deduct Source Stock)
                          </button>
                        )}
                        {(reviewTransfer.status === 'Pending' || reviewTransfer.status === 'Draft') && reviewTransfer.transferType === 'Internal' && (
                          <button
                            onClick={() => handleUpdateStatus(reviewTransfer.id, 'Received')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-3 rounded text-[10px] cursor-pointer"
                          >
                            Approve &amp; Receive Immediately
                          </button>
                        )}
                        {reviewTransfer.status === 'Approved' && (
                          <button
                            onClick={() => handleUpdateStatus(reviewTransfer.id, 'Dispatched')}
                            className="bg-purple-650 hover:bg-purple-700 text-white font-bold py-1 px-3 rounded text-[10px] cursor-pointer"
                          >
                            Mark as Dispatched (In-Transit)
                          </button>
                        )}
                        {reviewTransfer.status === 'Dispatched' && reviewTransfer.transferType === 'Internal' && (
                          <button
                            onClick={() => handleUpdateStatus(reviewTransfer.id, 'Received')}
                            className="bg-teal-650 hover:bg-teal-700 text-white font-bold py-1 px-3 rounded text-[10px] cursor-pointer"
                          >
                            Mark as Received
                          </button>
                        )}
                        {(reviewTransfer.status === 'Received' || (reviewTransfer.status === 'Dispatched' && reviewTransfer.transferType === 'External')) && (
                          <button
                            onClick={() => handleUpdateStatus(reviewTransfer.id, 'Completed')}
                            className="bg-emerald-650 hover:bg-emerald-750 text-white font-bold py-1 px-3 rounded text-[10px] cursor-pointer"
                          >
                            Complete Voucher (Finalize Stock)
                          </button>
                        )}

                        {/* Option to Cancel BEFORE completed */}
                        {reviewTransfer.status !== 'Completed' && reviewTransfer.status !== 'Cancelled' && reviewTransfer.status !== 'Reversed' && (
                          <button
                            onClick={() => {
                              const reason = prompt(`Reason for cancelling transfer #${reviewTransfer.transferNumber || reviewTransfer.id.slice(-4)}:`, 'Cancelled by admin prior to completion');
                              if (reason !== null) {
                                handleUpdateStatus(reviewTransfer.id, 'Cancelled', reason);
                              }
                            }}
                            className="bg-red-650 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-[10px] ml-auto cursor-pointer flex items-center gap-1"
                          >
                            🚫 Cancel Transfer (Revert Stock)
                          </button>
                        )}

                        {/* Option to Reverse AFTER completed */}
                        {(reviewTransfer.status === 'Completed' || reviewTransfer.status === 'Received') && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to REVERSE completed transfer #${reviewTransfer.transferNumber || reviewTransfer.id.slice(-4)}?\n\nThis will deduct stock from target branch (${reviewTransfer.targetBranchName || 'Target'}) and return stock back to source branch (${reviewTransfer.sourceBranchName}).`)) {
                                const reason = prompt(`Reason for REVERSING completed transfer #${reviewTransfer.transferNumber || reviewTransfer.id.slice(-4)}:`, 'Reversing completed stock transfer voucher');
                                if (reason !== null) {
                                  handleUpdateStatus(reviewTransfer.id, 'Reversed', reason);
                                }
                              }
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-1 px-3.5 rounded text-[10px] ml-auto cursor-pointer flex items-center gap-1 shadow-xs"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reverse Completed Transfer
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                        <div className="space-y-0.5">
                          <span className="font-bold text-gray-800 block text-[10px] uppercase">Stateful Actions (Restricted):</span>
                          <span className="text-[10px] text-gray-500 font-medium block">
                            {reviewTransfer.status === 'Draft' || reviewTransfer.status === 'Pending' 
                              ? "You can edit this voucher content before admin approval." 
                              : "This voucher is being processed. Only Super Administrators can transition or cancel it."}
                          </span>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {reviewTransfer.status === 'Draft' && (
                            <button
                              onClick={() => handleUpdateStatus(reviewTransfer.id, 'Pending')}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-3 rounded text-[10px] cursor-pointer"
                            >
                              Submit for Approval
                            </button>
                          )}
                          {(reviewTransfer.status === 'Draft' || reviewTransfer.status === 'Pending') && (
                            <button
                              onClick={() => handleEditTransferClick(reviewTransfer)}
                              className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1 px-3 rounded text-[10px] cursor-pointer"
                            >
                              Edit Voucher Draft
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  <p className="text-[9px] text-slate-500 leading-tight mt-1">
                    * Approving / Dispatching automatically deducts stock from the source branch. Receiving / Completing adds stock to the target branch (for internal movements). Cancelling or Reversing will safely return inventory back to the source branch.
                  </p>
                </div>
              )}

              {(reviewTransfer.status === 'Cancelled' || reviewTransfer.status === 'Reversed') && (
                <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl space-y-1 text-xs text-red-950 font-medium">
                  <div className="flex items-center gap-2 font-black text-red-900 uppercase">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span>Transfer Voucher {reviewTransfer.status}</span>
                  </div>
                  <p className="text-[11px] text-red-800">
                    This transfer voucher was set to <strong>{reviewTransfer.status}</strong>. All associated inventory items were safely returned or verified for source branch inventory balancing.
                  </p>
                </div>
              )}

              <div>
                <span className="font-bold text-gray-900 block mb-1.5 uppercase tracking-wider text-[10px]">Voucher Content Lines ({reviewTransfer.items.length})</span>
                <div className="border rounded-lg overflow-hidden divide-y">
                  {reviewTransfer.items.map((it: any, idx: number) => (
                    <div key={idx} className="p-2.5 flex justify-between items-center bg-white hover:bg-gray-50 text-[11px]">
                      <div>
                        <span className="font-bold text-gray-900 block">{it.medicineName}</span>
                        <span className="text-[9px] text-gray-400 block">Batch: {it.batchNumber} • Expiry: {it.expiryDate || 'N/A'}</span>
                      </div>
                      <span className="font-bold text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded text-xs font-mono">
                        {it.quantity} units
                      </span>
                    </div>
                  ))}
                </div>

                {/* Review Voucher Totals */}
                {(() => {
                  const reviewTotalQty = reviewTransfer.items.reduce((acc: number, it: any) => acc + Number(it.quantity), 0);
                  const reviewTotalBuyingCost = reviewTransfer.items.reduce((acc: number, it: any) => {
                    const matchStock = stockItems.find(s => s.medicineId === it.medicineId && (s.batchNumber || '').trim().toLowerCase() === (it.batchNumber || '').trim().toLowerCase());
                    const med = medicines.find(m => m.id === it.medicineId);
                    const cost = matchStock?.buyingPrice || med?.buyingPrice || 0;
                    return acc + (Number(it.quantity) * cost);
                  }, 0);
                  const reviewTotalSellingVal = reviewTransfer.items.reduce((acc: number, it: any) => {
                    const med = medicines.find(m => m.id === it.medicineId);
                    const price = med?.price || 0;
                    return acc + (Number(it.quantity) * price);
                  }, 0);

                  return (
                    <div className="bg-indigo-50 border border-indigo-150 rounded-lg p-3 flex flex-col gap-1 text-xs text-indigo-950 font-bold mt-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-semibold uppercase text-[9px]">Total Items Quantity:</span>
                        <span className="font-mono text-indigo-900 bg-indigo-100/50 px-2 py-0.5 rounded text-xs">{reviewTotalQty} units</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-indigo-100 pt-1.5 mt-0.5">
                        <span className="text-gray-500 font-semibold uppercase text-[9px]">Total Buying Price (Cost):</span>
                        <span className="font-mono text-indigo-900">{reviewTotalBuyingCost.toLocaleString('en-US')} ETB</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-indigo-100 pt-1.5">
                        <span className="text-gray-500 font-semibold uppercase text-[9px]">Total Selling Price (Value):</span>
                        <span className="font-mono text-indigo-900">{reviewTotalSellingVal.toLocaleString('en-US')} ETB</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="p-5 pt-4 border-t flex justify-end gap-2 bg-white rounded-b-xl shrink-0">
              <button
                onClick={() => {
                  const printW = window.open('', '_blank');
                  if (!printW) {
                    alert('Pop-up blocked. Please enable pop-ups to print.');
                    return;
                  }
                  const itemRows = reviewTransfer.items.map((it: any) => `
                    <tr style="border-bottom: 1px solid #ddd;">
                      <td style="padding: 10px; font-size: 11px;">${it.medicineName}</td>
                      <td style="padding: 10px; font-size: 11px;">${it.batchNumber}</td>
                      <td style="padding: 10px; font-size: 11px;">${it.expiryDate || 'N/A'}</td>
                      <td style="padding: 10px; font-size: 11px; font-weight: bold; text-align: right;">${it.quantity}</td>
                    </tr>
                  `).join('');
                  
                  printW.document.write(`
                    <html>
                      <head>
                        <title>Stock Transfer Slip - ${reviewTransfer.transferNumber || `TR-REV-${reviewTransfer.id.slice(-4)}`}</title>
                        <style>
                          body { font-family: Arial, sans-serif; color: #333; margin: 40px; }
                          .header { border-bottom: 2px solid #312e81; padding-bottom: 15px; margin-bottom: 20px; }
                          h1 { font-size: 20px; color: #312e81; margin: 0 0 5px 0; }
                          .meta-table { width: 100%; margin-bottom: 25px; border-collapse: collapse; }
                          .meta-table td { padding: 5px 0; font-size: 12px; }
                          .main-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                          .main-table th { background-color: #f3f4f6; padding: 10px; text-align: left; font-size: 11px; font-weight: bold; color: #374151; border-bottom: 1px solid #d1d5db; }
                          .main-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
                          .footer { margin-top: 50px; font-size: 10px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px; }
                        </style>
                      </head>
                      <body>
                        <div class="header">
                          <h1>STOCK TRANSFER SLIP (VOUCHER)</h1>
                          <div style="font-size: 12px; color: #4b5563;">Voucher Number: <strong>${reviewTransfer.transferNumber || `TR-REV-${reviewTransfer.id.slice(-4)}`}</strong></div>
                        </div>
                        <table class="meta-table">
                          <tr>
                            <td><strong>Source Branch:</strong> ${reviewTransfer.sourceBranchName}</td>
                            <td style="text-align: right;"><strong>Date Issued:</strong> ${reviewTransfer.date}</td>
                          </tr>
                          <tr>
                            <td><strong>Destination:</strong> ${reviewTransfer.transferType === 'External' ? reviewTransfer.externalPharmacyName + ' (EXTERNAL)' : reviewTransfer.targetBranchName}</td>
                            <td style="text-align: right;"><strong>Status:</strong> <span style="color: #312e81; font-weight: bold; text-transform: uppercase;">${reviewTransfer.status}</span></td>
                          </tr>
                          <tr>
                            <td><strong>Requested By:</strong> ${reviewTransfer.requestedBy}</td>
                            <td style="text-align: right;"><strong>Processed By:</strong> ${reviewTransfer.processedBy || 'Pending'}</td>
                          </tr>
                          <tr>
                            <td colspan="2" style="padding-top: 10px; font-style: italic;"><strong>Remarks:</strong> ${reviewTransfer.notes || 'None'}</td>
                          </tr>
                        </table>
                        
                        <table class="main-table">
                          <thead>
                            <tr>
                              <th>Medicine / Drug Name</th>
                              <th>Batch Number</th>
                              <th>Expiry Date</th>
                              <th style="text-align: right;">Quantity (Units)</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${itemRows}
                          </tbody>
                        </table>
                        
                        <div class="footer">
                          <p>Authorized Signature: __________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Recipient Signature: __________________________</p>
                          <p style="margin-top: 10px;">${instName} Multi-Branch Pharmacy Management System</p>
                        </div>
                        <script>
                          window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                          };
                        </script>
                      </body>
                    </html>
                  `);
                  printW.document.close();
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition shadow cursor-pointer"
              >
                Print Voucher
              </button>
              <button
                onClick={() => setReviewTransfer(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-5 rounded cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requisition / New Transfer Modal (ADJUSTABLE, MULTI-COLUMN DESIGN) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div 
            id="transfer-modal-container"
            className="bg-white rounded-xl shadow-2xl w-[96vw] max-w-[1550px] h-[92vh] max-h-[980px] flex flex-col border border-gray-150 text-xs"
          >
            {/* Modal Header */}
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
              <div>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-wide flex items-center gap-1.5">
                  <ArrowRightLeft className="h-4.5 w-4.5 text-indigo-600" />
                  Issue Stock Transfer Voucher
                </h3>
                <p className="text-[10px] text-gray-500 font-medium">Create drafts, log pending approvals, or instantly authorize stock movements.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1 bg-white hover:bg-gray-100 rounded cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Modal Body (Split-pane) */}
            <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
              
              {/* Left Pane: AVAILABLE STOCK CATALOG & POS-LIKE SEARCH */}
              <div 
                className="w-full md:w-auto shrink-0 flex flex-col p-4 bg-gray-50/60 min-h-0 overflow-y-auto scrollbar-thin"
                style={{ width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${leftWidth}px` : '100%' }}
              >
                <span className="font-extrabold text-gray-900 block mb-2 uppercase text-[10px] tracking-wider text-indigo-900">
                  Step 1: Search &amp; Pick Source Items
                </span>
                
                {/* Source Branch Picker */}
                <div className="mb-3">
                  <label className="font-bold text-gray-700 block mb-1">Source (Sender Node):</label>
                  <select
                    value={sourceBranchId}
                    onChange={(e) => {
                      const nextSrc = e.target.value;
                      setSourceBranchId(nextSrc);
                      setTransferLines([]);
                      setModalItemSearch('');
                      if (nextSrc === targetBranchId) {
                        const nextTgt = branches.find(b => b.id !== nextSrc)?.id || 'b1';
                        setTargetBranchId(nextTgt);
                      }
                    }}
                    className="w-full bg-white border border-gray-250 p-2 rounded outline-none text-gray-800 font-bold focus:border-indigo-500 shadow-xs cursor-pointer"
                  >
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                {/* POS-like Search input */}
                <div className="relative bg-white rounded-lg border border-gray-250 flex items-center p-2 mb-3 shadow-xs">
                  <Search className="h-4 w-4 text-gray-400 shrink-0 mr-1.5" />
                  <input
                    type="text"
                    placeholder="Type drug name, barcode, batch to search instantly..."
                    value={modalItemSearch}
                    onChange={(e) => setModalItemSearch(e.target.value)}
                    className="w-full text-xs outline-none bg-transparent text-gray-800 font-semibold"
                  />
                  {modalItemSearch && (
                    <button type="button" onClick={() => setModalItemSearch('')} className="p-0.5 hover:bg-gray-100 rounded text-gray-400">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Catalog Table */}
                <div className="flex-1 min-h-0 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-xs">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-gray-100 text-gray-700 font-extrabold sticky top-0 border-b border-gray-200 z-10 shadow-xs">
                      <tr>
                        <th className="p-2.5 text-left bg-gray-100">Medicine Name</th>
                        <th className="p-2.5 text-left bg-gray-100">Batch / Expiry Date</th>
                        <th className="p-2.5 text-right bg-gray-100">In Stock</th>
                        <th className="p-2.5 text-center bg-gray-100 w-16">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredActiveBranchStocks.map(st => {
                        const med = medicines.find(m => m.id === st.medicineId);
                        const isAdded = transferLines.some(line => line.medicineId === st.medicineId && (line.batchNumber || '').trim().toLowerCase() === (st.batchNumber || '').trim().toLowerCase());
                        
                        return (
                          <tr 
                            key={st.id} 
                            onClick={() => handleSelectCatalogItem(st)}
                            className={`hover:bg-indigo-50/50 transition cursor-pointer ${
                              isAdded ? 'bg-indigo-50/25 font-semibold text-indigo-950' : 'text-gray-800'
                            }`}
                          >
                            <td className="p-2.5 font-bold text-gray-900 leading-snug truncate max-w-[220px]">
                              {med?.name}
                            </td>
                            <td className="p-2.5 font-mono text-gray-500 whitespace-nowrap">
                              <span className="block text-[10px] font-bold text-gray-700">B: {st.batchNumber}</span>
                              <span className="block text-[9px] text-gray-400">E: {st.expiryDate || 'N/A'}</span>
                            </td>
                            <td className="p-2.5 text-right font-mono font-black text-slate-800 text-xs">
                              {st.quantity}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                className={`px-2 py-1 rounded text-[10px] font-extrabold shadow-2xs transition cursor-pointer ${
                                  isAdded 
                                    ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                              >
                                {isAdded ? 'Added' : '+ Add'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredActiveBranchStocks.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-16 text-gray-400 italic">
                            No active stock items found matching "{modalItemSearch}".
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resize Handle Divider */}
              <div 
                onMouseDown={() => setIsDragging(true)}
                onDoubleClick={() => setLeftWidth(580)}
                className={`hidden md:flex w-2.5 bg-gray-150 hover:bg-indigo-600 cursor-col-resize select-none shrink-0 items-center justify-center transition-colors relative group border-l border-r border-gray-200 ${
                  isDragging ? 'bg-indigo-600 border-indigo-700 w-3' : 'hover:border-indigo-400'
                }`}
                title="Drag to resize panels • Double-click to reset"
              >
                <div className={`w-1 h-12 rounded-full flex flex-col gap-0.5 justify-center items-center transition-all ${
                  isDragging ? 'text-white' : 'text-gray-400 group-hover:text-indigo-200'
                }`}>
                  <span className="w-1 h-1 rounded-full bg-current shrink-0"></span>
                  <span className="w-1 h-1 rounded-full bg-current shrink-0"></span>
                  <span className="w-1 h-1 rounded-full bg-current shrink-0"></span>
                  <span className="w-1 h-1 rounded-full bg-current shrink-0"></span>
                </div>
              </div>

              {/* Right Pane: VOUCHER COMPILATION & SETTINGS */}
              <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
                <span className="font-extrabold text-gray-900 block mb-2 uppercase text-[10px] tracking-wider text-indigo-900">
                  Step 2: Destination &amp; Quantities
                </span>

                {/* Transfer Type Selector */}
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200 mb-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTransferType('Internal')}
                    className={`py-1.5 px-3 rounded-md text-xs font-bold transition cursor-pointer ${
                      transferType === 'Internal' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    🏪 Inter-Branch
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferType('External')}
                    className={`py-1.5 px-3 rounded-md text-xs font-bold transition cursor-pointer ${
                      transferType === 'External' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    🏢 External Pharmacy
                  </button>
                </div>

                {/* Dynamic Destination Input & Remarks Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 shrink-0">
                  {transferType === 'Internal' ? (
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Target Destination (Receiver Node):</label>
                      <select
                        value={targetBranchId}
                        onChange={(e) => setTargetBranchId(e.target.value)}
                        className="w-full bg-white border border-gray-250 p-2 rounded outline-none text-gray-800 font-bold focus:border-indigo-500 shadow-xs cursor-pointer text-xs"
                      >
                        {branches.filter(b => b.id !== sourceBranchId).map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-bold text-gray-700 block">External Destination Directory:</label>
                        <button
                          type="button"
                          onClick={() => setShowAddExternalModal(true)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold cursor-pointer"
                        >
                          + Add External Node
                        </button>
                      </div>
                      <select
                        value={externalPharmacyName}
                        onChange={(e) => setExternalPharmacyName(e.target.value)}
                        className="w-full bg-white border border-gray-250 p-2 rounded outline-none text-gray-800 font-bold focus:border-indigo-500 shadow-xs cursor-pointer text-xs"
                      >
                        <option value="">-- Choose External Pharmacy Destination --</option>
                        {externalPharmacies.map(ep => (
                          <option key={ep.id} value={ep.name}>{ep.name} (TIN: {ep.tinNumber || 'N/A'})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Transfer Reason / Remarks:</label>
                    <input
                      type="text"
                      placeholder="e.g. Stock rebalance, urgent order, etc..."
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      className="w-full bg-white border border-gray-250 p-2 rounded outline-none font-medium focus:border-indigo-500 shadow-xs text-xs"
                    />
                  </div>
                </div>

                {/* Voucher Lines Table */}
                <span className="font-bold text-gray-700 block mb-1">Voucher Lines (Selected Items):</span>
                <div className="flex-1 min-h-0 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-xs mb-3">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-gray-100 text-gray-700 font-extrabold sticky top-0 border-b border-gray-200 z-10 shadow-xs">
                      <tr>
                        <th className="p-2.5 text-left bg-gray-100">Medicine Name</th>
                        <th className="p-2.5 text-left bg-gray-100">Batch / Expiry Date</th>
                        <th className="p-2.5 text-center bg-gray-100 w-44">Transfer Qty</th>
                        <th className="p-2.5 text-center bg-gray-100 w-16">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {transferLines.map((line, idx) => {
                        const activeLineStock = stockItems.find(st => st.branchId === sourceBranchId && (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase() && st.medicineId === line.medicineId);
                        const med = medicines.find(m => m.id === line.medicineId);
                        
                        return (
                          <tr key={idx} className="hover:bg-gray-50/50 transition">
                            <td className="p-2.5 font-bold text-gray-900 leading-snug truncate max-w-[200px]">
                              {med?.name}
                            </td>
                            <td className="p-2.5 font-mono text-gray-500 whitespace-nowrap">
                              <span className="block text-[10px] font-bold text-gray-700">B: {line.batchNumber}</span>
                              <span className="block text-[9px] text-gray-400">E: {line.expiryDate || 'N/A'}</span>
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="inline-flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="1"
                                  max={activeLineStock?.quantity || 1}
                                  value={line.quantity}
                                  onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                                  className="w-16 bg-white border border-gray-300 p-1 text-center font-black rounded-md focus:border-indigo-500 text-xs outline-none"
                                  placeholder="Qty"
                                />
                                <span className="text-[10px] text-gray-400 font-mono">/ {activeLineStock?.quantity || 0} left</span>
                              </div>
                            </td>
                            <td className="p-2.5 text-center">
                              <button 
                                type="button" 
                                onClick={() => removeLine(idx)} 
                                className="text-red-500 hover:text-red-700 font-extrabold hover:bg-red-50 px-2 py-1 rounded transition cursor-pointer"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {transferLines.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-16 text-gray-400 italic">
                            No transfer lines added. Click items in the left panel to compile your voucher.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Compact Voucher Totals in One Line */}
                {transferLines.length > 0 && (
                  <div className="bg-indigo-50/80 border border-indigo-150 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-950 font-bold shrink-0 shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500 font-bold uppercase text-[9px]">Total Qty:</span>
                      <span className="font-mono text-indigo-900 bg-indigo-100/70 px-2 py-0.5 rounded text-[11px]">{voucherTotalQuantity} units</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500 font-bold uppercase text-[9px]">Total Cost:</span>
                      <span className="font-mono text-indigo-900 text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-gray-200/60">{voucherTotalBuyingPrice.toLocaleString('en-US')} ETB</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500 font-bold uppercase text-[9px]">Total Value:</span>
                      <span className="font-mono text-indigo-950 text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-150">{voucherTotalSellingPrice.toLocaleString('en-US')} ETB</span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer with Actions */}
            <div className="p-4 border-t flex flex-wrap gap-2 justify-end bg-gray-50 rounded-b-xl shrink-0">
              <button 
                type="button" 
                onClick={() => setShowModal(false)} 
                className="bg-white hover:bg-gray-100 border py-2 px-4 rounded-lg text-gray-700 font-bold cursor-pointer transition"
              >
                Cancel
              </button>
              
              <button 
                type="button"
                disabled={submitting || transferLines.length === 0} 
                onClick={() => submitTransfer('Draft')} 
                className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-lg shadow-sm cursor-pointer transition disabled:opacity-50"
              >
                Save as Draft
              </button>
              
              <button 
                type="button"
                disabled={submitting || transferLines.length === 0} 
                onClick={() => submitTransfer('Pending')} 
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm cursor-pointer transition disabled:opacity-50"
              >
                Submit Pending Approval
              </button>
              
              {currentUser?.role === 'Super Administrator' && (
                <button 
                  type="button"
                  disabled={submitting || transferLines.length === 0} 
                  onClick={() => submitTransfer(transferType === 'External' ? 'Completed' : 'Received')} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-lg shadow-md cursor-pointer transition disabled:opacity-50"
                >
                  Approve &amp; Authorize Immediately
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add External Pharmacy Inline Modal */}
      {showAddExternalModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-55 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 border border-gray-150 text-xs text-gray-800 space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="font-black text-gray-900 uppercase">Add External Pharmacy Node</h4>
              <button onClick={() => setShowAddExternalModal(false)} className="text-gray-400 hover:text-gray-600 font-bold cursor-pointer">×</button>
            </div>
            <form onSubmit={handleAddExternalPharmacySubmit} className="space-y-3">
              <div>
                <label className="font-bold block mb-1">Pharmacy Name *</label>
                <input
                  type="text"
                  required
                  value={newExtName}
                  onChange={(e) => setNewExtName(e.target.value)}
                  placeholder="e.g. Tikur Anbessa Hospital Pharmacy"
                  className="w-full bg-white border p-2 rounded outline-none font-semibold"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">TIN Number (Optional)</label>
                <input
                  type="text"
                  value={newExtTin}
                  onChange={(e) => setNewExtTin(e.target.value)}
                  placeholder="e.g. 1045982736"
                  className="w-full bg-white border p-2 rounded outline-none font-mono"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Phone Contact (Optional)</label>
                <input
                  type="text"
                  value={newExtPhone}
                  onChange={(e) => setNewExtPhone(e.target.value)}
                  placeholder="e.g. +251-11-5511211"
                  className="w-full bg-white border p-2 rounded outline-none font-semibold"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Physical Address (Optional)</label>
                <input
                  type="text"
                  value={newExtAddress}
                  onChange={(e) => setNewExtAddress(e.target.value)}
                  placeholder="e.g. Churchill Road, Addis Ababa"
                  className="w-full bg-white border p-2 rounded outline-none font-semibold"
                />
              </div>
              <div className="pt-2 flex justify-end gap-1.5">
                <button type="button" onClick={() => setShowAddExternalModal(false)} className="px-3 py-1.5 border rounded cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white font-bold rounded shadow cursor-pointer">Save Node</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== 2. PURCHASE ORDER MANAGER ====================
interface PurchaseManagerPanelProps {
  currentUser: any;
  branches: Branch[];
  medicines: Medicine[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  onDataChanged: () => void;
  defaultSubModule?: 'orders' | 'suppliers';
  hideTabs?: boolean;
  activeBranchId?: string;
  onOpenOutboundCreditNotificationPanel?: () => void;
}

export function PurchaseManagerPanel({ 
  currentUser, branches, medicines, suppliers, purchaseOrders, onDataChanged,
  defaultSubModule, hideTabs, activeBranchId, onOpenOutboundCreditNotificationPanel
}: PurchaseManagerPanelProps) {
  const [instName, setInstName] = useState('Sonan Pharmacy');

  useEffect(() => {
    const fetchInstName = async () => {
      try {
        const res = await fetch('/api/settings/institution');
        if (res.ok) {
          const data = await res.json();
          if (data && data.name) setInstName(data.name);
        }
      } catch (err) {
        console.error('Failed to fetch instName in PurchaseManagerPanel:', err);
      }
    };
    fetchInstName();
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [supplierId, setSupplierId] = useState('s1');
  const [branchId, setBranchId] = useState('b1');
  const [poLines, setPoLines] = useState<{ medicineId: string; quantity: number; unitPrice: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Auto-Draft Mechanism for Purchase Order Form
  const [hasPoDraft, setHasPoDraft] = useState(false);
  const [poDraftData, setPoDraftData] = useState<any>(null);

  // Check for saved purchase order draft when opening the PO modal
  useEffect(() => {
    if (showModal) {
      try {
        const saved = localStorage.getItem('po_form_draft');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.poLines) && parsed.poLines.length > 0) {
            setPoDraftData(parsed);
            setHasPoDraft(true);
          }
        }
      } catch (e) {
        console.warn('Failed to parse saved PO draft', e);
      }
    } else {
      setHasPoDraft(false);
    }
  }, [showModal]);

  // Auto-save PO form progress to localStorage while user edits lines or options
  useEffect(() => {
    if (showModal && poLines.length > 0) {
      localStorage.setItem(
        'po_form_draft',
        JSON.stringify({
          supplierId,
          branchId,
          poLines,
          timestamp: Date.now()
        })
      );
    }
  }, [showModal, supplierId, branchId, poLines]);

  const restorePoDraft = () => {
    if (poDraftData) {
      if (poDraftData.supplierId) setSupplierId(poDraftData.supplierId);
      if (poDraftData.branchId) setBranchId(poDraftData.branchId);
      if (Array.isArray(poDraftData.poLines)) setPoLines(poDraftData.poLines);
      setHasPoDraft(false);
    }
  };

  const discardPoDraft = () => {
    localStorage.removeItem('po_form_draft');
    setPoDraftData(null);
    setHasPoDraft(false);
  };

  // Sub-tab selection (defaults to suppliers ledger)
  const [activeSubModule, setActiveSubModule] = useState<'orders' | 'suppliers'>('suppliers');

  // Supplier sub-views & drill down states
  const [supplierSubView, setSupplierSubView] = useState<'ledger' | 'credits' | 'analysis'>('ledger');
  const [selectedAnalysisSupplierId, setSelectedAnalysisSupplierId] = useState<string>('');
  const [selectedCreditSupplierId, setSelectedCreditSupplierId] = useState<string>('all');
  const [creditSearchQuery, setCreditSearchQuery] = useState<string>('');

  // Supplier transaction lists
  const [supplierTransactions, setSupplierTransactions] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Modal triggers
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showEditSupplierModal, setShowEditSupplierModal] = useState(false);
  const [showScanInvoiceModal, setShowScanInvoiceModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; name: string } | null>(null);

  // Form states
  const [newSup, setNewSup] = useState<{ name: string; phone: string; email: string; address: string; balance: number | string }>({ name: '', phone: '', email: '', address: '', balance: 0 });
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [paymentForm, setPaymentForm] = useState({ 
    supplierId: '', 
    amount: 0 as number | string, 
    reference: '', 
    notes: '', 
    date: new Date().toISOString().split('T')[0], 
    creditTransactionId: '',
    recipientName: '',
    receiptAttachment: '',
    receiptFileName: ''
  });
  const [creditForm, setCreditForm] = useState({ supplierId: '', amount: 0 as number | string, reference: '', notes: '', date: new Date().toISOString().split('T')[0], dueDate: '', paymentTerms: 'Net 30' });

  // Receipt attachment and viewer states
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<SupplierTransaction | null>(null);
  const [attachingReceiptTx, setAttachingReceiptTx] = useState<SupplierTransaction | null>(null);
  const [attachRecipientInput, setAttachRecipientInput] = useState('');
  const [attachFileUrl, setAttachFileUrl] = useState('');
  const [attachFileName, setAttachFileName] = useState('');
  const [savingReceipt, setSavingReceipt] = useState(false);
  const paymentFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const attachFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleReceiptFile = (file: File, target: 'payment' | 'direct') => {
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please upload a smaller document or receipt image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (target === 'payment') {
        setPaymentForm(prev => ({
          ...prev,
          receiptAttachment: result,
          receiptFileName: file.name
        }));
      } else {
        setAttachFileUrl(result);
        setAttachFileName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveReceiptAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachingReceiptTx) return;
    try {
      setSavingReceipt(true);
      const res = await fetch(`/api/suppliers/transactions/${attachingReceiptTx.id}/attach-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: attachRecipientInput,
          receiptAttachment: attachFileUrl || attachingReceiptTx.receiptAttachment || '',
          receiptFileName: attachFileName || attachingReceiptTx.receiptFileName || '',
          operatorId: currentUser?.id
        })
      });
      if (res.ok) {
        setAttachingReceiptTx(null);
        setAttachRecipientInput('');
        setAttachFileUrl('');
        setAttachFileName('');
        fetchTransactions();
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed to save receipt proof.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network Error: Failed to attach receipt proof.');
    } finally {
      setSavingReceipt(false);
    }
  };

  // Filters
  const [txSupplierFilter, setTxSupplierFilter] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('');
  const [txDateFilter, setTxDateFilter] = useState('');
  const [txMinAmount, setTxMinAmount] = useState('');
  const [txMaxAmount, setTxMaxAmount] = useState('');
  const [txDueStatusFilter, setTxDueStatusFilter] = useState<'all' | 'due_reached' | 'unpaid' | 'paid'>('all');

  const todayStr = new Date().toISOString().split('T')[0];

  // Due Date Reached Notifications calculation
  const dueTransactions = supplierTransactions.filter(tx => {
    if (activeBranchId && activeBranchId !== 'all' && tx.branchId && tx.branchId !== activeBranchId) return false;
    return tx.type === 'Purchase Credit' && tx.paymentStatus !== 'Paid' && tx.dueDate && tx.dueDate <= todayStr;
  });

  const totalDueDebt = dueTransactions.reduce((sum, tx) => sum + (tx.amount - (tx.paidAmount || 0)), 0);

  const filteredTransactions = supplierTransactions
    .filter(tx => !activeBranchId || activeBranchId === 'all' || !tx.branchId || tx.branchId === activeBranchId)
    .filter(tx => !txSupplierFilter || tx.supplierId === txSupplierFilter)
    .filter(tx => !txTypeFilter || tx.type === txTypeFilter)
    .filter(tx => {
      if (!txDateFilter) return true;
      return tx.date === txDateFilter;
    })
    .filter(tx => {
      const min = parseFloat(txMinAmount);
      if (!isNaN(min) && tx.amount < min) return false;
      const max = parseFloat(txMaxAmount);
      if (!isNaN(max) && tx.amount > max) return false;
      return true;
    })
    .filter(tx => {
      if (txDueStatusFilter === 'all') return true;
      if (txDueStatusFilter === 'due_reached') {
        return tx.type === 'Purchase Credit' && tx.paymentStatus !== 'Paid' && tx.dueDate && tx.dueDate <= todayStr;
      }
      if (txDueStatusFilter === 'unpaid') {
        return tx.type === 'Purchase Credit' && tx.paymentStatus !== 'Paid';
      }
      if (txDueStatusFilter === 'paid') {
        return tx.paymentStatus === 'Paid' || tx.type === 'Payment';
      }
      return true;
    });

  const fetchTransactions = async () => {
    try {
      setLoadingTx(true);
      const res = await fetch('/api/suppliers/transactions');
      if (res.ok) {
        const data = await res.json();
        setSupplierTransactions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTx(false);
    }
  };

  const handleTogglePaid = async (txId: string) => {
    try {
      const res = await fetch(`/api/suppliers/transactions/${txId}/toggle-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUser?.id })
      });
      if (res.ok) {
        fetchTransactions();
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed to toggle status.'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier || !editingSupplier.name || !editingSupplier.phone) {
      alert('Supplier name and contact phone are required.');
      return;
    }
    try {
      const res = await fetch(`/api/suppliers/${editingSupplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingSupplier, balance: parseFloat(String(editingSupplier.balance)) || 0, operatorId: currentUser?.id })
      });
      if (res.ok) {
        setShowEditSupplierModal(false);
        setEditingSupplier(null);
        onDataChanged();
        alert('Supplier updated successfully!');
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed to update supplier.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network Error: Failed to update supplier.');
    }
  };

  const exportFilteredTransactionsCsv = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM for direct Microsoft Excel compatibility
    csvContent += "Credit Ledger & Supplier Financial Movements\r\n";
    csvContent += `Generated On: ${new Date().toLocaleString()},Scope: ${activeBranchId === 'all' || !activeBranchId ? 'All Branches' : activeBranchId},Supplier: ${txSupplierFilter ? (suppliers.find(s => s.id === txSupplierFilter)?.name || txSupplierFilter) : 'All Suppliers'},Type: ${txTypeFilter || 'All'},Date Filter: ${txDateFilter || 'All'}\r\n\r\n`;
    csvContent += "Transaction ID,Date,Supplier Name,Transaction Type,Amount (ETB),Payment Due Date,Due Status,Payment Status,Outstanding Balance (ETB),Reference / Bill No,Payment Recipient,Receipt Attached,Branch,Notes\r\n";
    
    filteredTransactions.forEach(tx => {
      const sName = suppliers.find(s => s.id === tx.supplierId)?.name || 'Unknown Supplier';
      const status = tx.type === 'Purchase Credit' ? (tx.paymentStatus || 'Pending') : 'Payment Settled';
      const outstanding = tx.type === 'Purchase Credit' ? (tx.amount - (tx.paidAmount || 0)) : 0;
      
      let dueStatus = 'N/A';
      if (tx.type === 'Purchase Credit' && tx.paymentStatus !== 'Paid' && tx.dueDate) {
        if (tx.dueDate < todayStr) {
          const diffDays = Math.ceil((new Date(todayStr).getTime() - new Date(tx.dueDate).getTime()) / (1000 * 3600 * 24));
          dueStatus = `OVERDUE (${diffDays} days)`;
        } else if (tx.dueDate === todayStr) {
          dueStatus = 'DUE TODAY';
        } else {
          dueStatus = 'Upcoming';
        }
      } else if (tx.paymentStatus === 'Paid') {
        dueStatus = 'Settled in Full';
      }

      const row = [
        `"${tx.id}"`,
        `"${tx.date}"`,
        `"${sName.replace(/"/g, '""')}"`,
        `"${tx.type}"`,
        tx.amount,
        `"${tx.dueDate || 'N/A'}"`,
        `"${dueStatus}"`,
        `"${status}"`,
        outstanding,
        `"${(tx.reference || '').replace(/"/g, '""')}"`,
        `"${(tx.recipientName || '').replace(/"/g, '""')}"`,
        `"${tx.receiptAttachment ? 'Yes' : 'No'}"`,
        `"${tx.branchId || 'All'}"`,
        `"${(tx.notes || '').replace(/"/g, '""')}"`
      ].join(",");
      csvContent += row + "\r\n";
    });

    const totalFilteredCredits = filteredTransactions.filter(t => t.type === 'Purchase Credit').reduce((s, t) => s + t.amount, 0);
    const totalFilteredPayments = filteredTransactions.filter(t => t.type === 'Payment').reduce((s, t) => s + t.amount, 0);
    const totalFilteredOutstanding = filteredTransactions.filter(t => t.type === 'Purchase Credit').reduce((s, t) => s + (t.amount - (t.paidAmount || 0)), 0);

    csvContent += `\r\n,,,Total Credits,${totalFilteredCredits} ETB,,,,,,,\r\n`;
    csvContent += `,,,Total Payments Settled,${totalFilteredPayments} ETB,,,,,,,\r\n`;
    csvContent += `,,,Total Outstanding Debt,${totalFilteredOutstanding} ETB,,,,,,,\r\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `credit_ledger_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    try {
      const res = await fetch(`/api/suppliers/${supplierId}?operatorId=${currentUser?.id || 'admin'}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        onDataChanged();
        fetchTransactions();
        setSupplierToDelete(null);
        alert('Supplier deleted successfully!');
      } else {
        const err = await res.json();
        alert(`Deletion Denied: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network Error: Failed to delete supplier.');
    }
  };

  useEffect(() => {
    if (defaultSubModule) {
      setActiveSubModule(defaultSubModule);
    }
  }, [defaultSubModule]);

  useEffect(() => {
    if (activeSubModule === 'suppliers') {
      fetchTransactions();
    }
  }, [activeSubModule]);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSup.name || !newSup.phone) {
      alert('Supplier name and contact phone are required.');
      return;
    }
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newSup, balance: parseFloat(String(newSup.balance)) || 0, operatorId: currentUser?.id })
      });
      if (res.ok) {
        setShowSupplierModal(false);
        setNewSup({ name: '', phone: '', email: '', address: '', balance: 0 });
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const payAmount = parseFloat(String(paymentForm.amount)) || 0;
    if (!paymentForm.supplierId || payAmount <= 0) {
      alert('Please select a supplier and input a valid payment amount.');
      return;
    }
    try {
      const activeBranch = activeBranchId && activeBranchId !== 'all' ? activeBranchId : (currentUser?.branchId !== 'all' ? currentUser?.branchId : 'b1');
      const res = await fetch('/api/suppliers/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...paymentForm,
          amount: payAmount,
          type: 'Payment',
          operatorId: currentUser?.id,
          branchId: activeBranch
        })
      });
      if (res.ok) {
        setShowPaymentModal(false);
        setPaymentForm({ 
          supplierId: '', 
          amount: 0, 
          reference: '', 
          notes: '', 
          date: new Date().toISOString().split('T')[0], 
          creditTransactionId: '',
          recipientName: '',
          receiptAttachment: '',
          receiptFileName: ''
        });
        fetchTransactions();
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    const creditAmount = parseFloat(String(creditForm.amount)) || 0;
    if (!creditForm.supplierId || creditAmount <= 0) {
      alert('Please select a supplier and input a valid invoice amount.');
      return;
    }
    try {
      const activeBranch = activeBranchId && activeBranchId !== 'all' ? activeBranchId : (currentUser?.branchId !== 'all' ? currentUser?.branchId : 'b1');
      const res = await fetch('/api/suppliers/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...creditForm,
          amount: creditAmount,
          type: 'Purchase Credit',
          operatorId: currentUser?.id,
          branchId: activeBranch
        })
      });
      if (res.ok) {
        setShowCreditModal(false);
        setCreditForm({ supplierId: '', amount: 0, reference: '', notes: '', date: new Date().toISOString().split('T')[0], dueDate: '', paymentTerms: 'Net 30' });
        fetchTransactions();
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const exportSuppliersCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Supplier Name,Phone,Email,Address,Outstanding Credit Balance (ETB)\r\n";
    suppliers.forEach(s => {
      const row = [
        `"${s.name.replace(/"/g, '""')}"`,
        `"${s.phone}"`,
        `"${s.email || ''}"`,
        `"${(s.address || '').replace(/"/g, '""')}"`,
        s.balance
      ].join(",");
      csvContent += row + "\r\n";
    });

    csvContent += "\r\nSupplier Financial Transactions & Movements\r\n";
    csvContent += "Transaction ID,Date,Supplier Name,Transaction Type,Amount (ETB),Payment Due Date,Reference/Receipt No,Notes\r\n";
    supplierTransactions.forEach(tx => {
      const sName = suppliers.find(s => s.id === tx.supplierId)?.name || 'Unknown Supplier';
      const row = [
        tx.id,
        tx.date,
        `"${sName.replace(/"/g, '""')}"`,
        tx.type,
        tx.amount,
        tx.dueDate || 'N/A',
        `"${(tx.reference || '').replace(/"/g, '""')}"`,
        `"${(tx.notes || '').replace(/"/g, '""')}"`
      ].join(",");
      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${instName.toLowerCase().replace(/\s+/g, '_')}_suppliers_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // GRN (Goods Receiving Note) Modal state
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null);
  const [grnSize, setGrnSize] = useState<'small' | 'medium' | 'large' | 'full'>('medium');
  const [grnBatchData, setGrnBatchData] = useState<{ [medId: string]: { batchNumber: string; expiryDate: string } }>({});

  const addLine = () => {
    setPoLines([...poLines, { medicineId: medicines[0]?.id || '', quantity: 10, unitPrice: medicines[0]?.buyingPrice || 50 }]);
  };

  const removeLine = (idx: number) => {
    setPoLines(poLines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, key: string, val: any) => {
    const next = [...poLines];
    if (key === 'medicineId') {
      const med = medicines.find(m => m.id === val);
      next[idx].medicineId = val;
      if (med) next[idx].unitPrice = med.buyingPrice;
    } else {
      (next[idx] as any)[key] = val;
    }
    setPoLines(next);
  };

  const submitPo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poLines.length === 0) {
      alert('Validation Error: PO requires at least one item line.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          branchId,
          items: poLines.map(l => ({ ...l, quantity: Number(l.quantity) || 1, unitPrice: parseFloat(String(l.unitPrice)) || 0 })),
          operatorId: currentUser?.id
        })
      });

      if (res.ok) {
        setShowModal(false);
        setPoLines([]);
        discardPoDraft();
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const triggerReceiveDialog = (po: PurchaseOrder) => {
    const batchDefault: typeof grnBatchData = {};
    po.items.forEach(it => {
      batchDefault[it.medicineId] = {
        batchNumber: `BAT-${Date.now().toString().slice(-4)}`,
        expiryDate: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0] // 1 year
      };
    });
    setGrnBatchData(batchDefault);
    setReceivingPo(po);
  };

  const submitGrnReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPo) return;

    try {
      const res = await fetch('/api/purchases/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseOrderId: receivingPo.id,
          itemsBatchData: grnBatchData,
          operatorId: currentUser?.id
        })
      });

      if (res.ok) {
        setReceivingPo(null);
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      {/* SUPPLIERS ACCOUNTS & FINANCIAL LEDGER SECTION */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Suppliers Profiles &amp; Ledger Debts</h3>
                <p className="text-xs text-gray-500">Track outstanding supplier debt, register invoice credits with custom payment dates, and record payments.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={exportSuppliersCsv}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold py-2 px-3 rounded shadow flex items-center gap-1"
                >
                  Export to Excel / CSV
                </button>
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3 rounded shadow flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  + Register Supplier
                </button>
              </div>
            </div>

            {/* KPIs & Debt Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-150 p-4 rounded-xl text-xs space-y-1">
                <span className="text-gray-500 block uppercase font-bold text-[9px]">Outstanding Supplier Debt</span>
                <span className="text-lg font-bold text-red-600 block font-mono">
                  {suppliers.reduce((acc, s) => acc + s.balance, 0).toLocaleString('en-US')} ETB
                </span>
                <span className="text-[10px] text-gray-400 block">Total payable credits due to pharmaceutical suppliers.</span>
              </div>
              <div className="bg-white border border-gray-150 p-4 rounded-xl text-xs space-y-1">
                <span className="text-gray-500 block uppercase font-bold text-[9px]">Total Registered Suppliers</span>
                <span className="text-lg font-bold text-gray-900 block font-mono">
                  {suppliers.length} active
                </span>
                <span className="text-[10px] text-gray-400 block">Suppliers eligible for direct purchase orders and inventory GRN.</span>
              </div>
              <div className="bg-white border border-gray-150 p-4 rounded-xl text-xs space-y-1">
                <span className="text-gray-500 block uppercase font-bold text-[9px]">Logged Movements Count</span>
                <span className="text-lg font-bold text-emerald-700 block font-mono">
                  {supplierTransactions.length} logs
                </span>
                <span className="text-[10px] text-gray-400 block">Recorded payments, purchase credits, and billing adjustments.</span>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-slate-700">Quick Journal Adjustments:</span>
              <button
                type="button"
                onClick={() => setShowScanInvoiceModal(true)}
                className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 shadow-xs cursor-pointer transition"
                title="Scan items from photo or upload supplier invoice"
              >
                <ScanLine className="h-3.5 w-3.5" />
                Scan / Upload Purchase Invoice
              </button>
              <button
                type="button"
                onClick={() => {
                  if (suppliers.length === 0) { alert('No suppliers registered yet.'); return; }
                  setPaymentForm(p => ({ ...p, supplierId: suppliers[0].id }));
                  setShowPaymentModal(true);
                }}
                className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold px-3 py-1.5 rounded border border-emerald-200"
              >
                Record Supplier Payment
              </button>
              <button
                type="button"
                onClick={() => {
                  if (suppliers.length === 0) { alert('No suppliers registered yet.'); return; }
                  setCreditForm(c => ({ ...c, supplierId: suppliers[0].id }));
                  setShowCreditModal(true);
                }}
                className="bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold px-3 py-1.5 rounded border border-amber-200"
              >
                Log Supplier Credit Invoice (Bill)
              </button>
            </div>

            {/* Sub-tab selection for Supplier panel */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex flex-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => setSupplierSubView('ledger')}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    supplierSubView === 'ledger'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-750'
                  }`}
                >
                  Ledgers &amp; Movements
                </button>
                <button
                  type="button"
                  id="tab-supplier-credits-btn"
                  onClick={() => setSupplierSubView('credits')}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    supplierSubView === 'credits'
                      ? 'bg-white text-rose-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-750'
                  }`}
                >
                  <Receipt className="h-3.5 w-3.5 text-rose-600" />
                  <span>💳 Total Credit by Supplier (Separate Accounts)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSupplierSubView('analysis');
                    if (!selectedAnalysisSupplierId && suppliers.length > 0) {
                      setSelectedAnalysisSupplierId(suppliers[0].id);
                    }
                  }}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    supplierSubView === 'analysis'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-750'
                  }`}
                >
                  📊 Sourcing Drill-down
                </button>
              </div>

              {onOpenOutboundCreditNotificationPanel && (
                <button
                  type="button"
                  id="open-outbound-credit-panel-btn"
                  onClick={onOpenOutboundCreditNotificationPanel}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  title="Open Dedicated Outbound Credit Notification Panel"
                >
                  <Bell className="h-3.5 w-3.5 animate-pulse" />
                  <span>Outbound Credit Alerts</span>
                </button>
              )}
            </div>

            {supplierSubView === 'ledger' ? (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                
                {/* Suppliers List table (2 cols) */}
                <div className="lg:col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Suppliers Accounts &amp; Credits</h4>
                    <span className="text-[10px] text-gray-500 font-medium">Click Credit for individual breakdown</span>
                  </div>
                  <div className="bg-white border border-gray-150 rounded-xl overflow-x-auto text-xs scrollbar-thin">
                    <table className="min-w-full text-left">
                      <thead className="bg-gray-50 border-b border-gray-100 font-semibold text-gray-700">
                        <tr>
                          <th className="p-2.5">Supplier Name</th>
                          <th className="p-2.5">Contact</th>
                          <th className="p-2.5 text-right" title="Sum of all credit purchases incurred">Total Credit</th>
                          <th className="p-2.5 text-right" title="Current unsettled balance due">Balance Due</th>
                          <th className="p-2.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-600">
                        {suppliers.map(s => {
                          const sCredits = supplierTransactions.filter(t => t.supplierId === s.id && t.type === 'Purchase Credit');
                          const sTotalCredit = sCredits.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                          const displayTotalCredit = sTotalCredit > 0 ? sTotalCredit : (s.balance > 0 ? s.balance : 0);
                          return (
                            <tr key={s.id} className="hover:bg-gray-55">
                              <td className="p-2.5 font-semibold text-gray-800">{s.name}</td>
                              <td className="p-2.5 text-[11px]">
                                <span className="block font-mono font-medium">{s.phone}</span>
                                <span className="block text-gray-400">{s.email || 'N/A'}</span>
                              </td>
                              <td className="p-2.5 text-right font-mono font-medium text-slate-700">
                                {displayTotalCredit.toLocaleString('en-US')} ETB
                              </td>
                              <td className={`p-2.5 text-right font-mono font-bold ${s.balance > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                {s.balance.toLocaleString('en-US')} ETB
                              </td>
                              <td className="p-2.5 text-center space-x-1 flex items-center justify-center">
                                <button
                                  onClick={() => {
                                    setSelectedCreditSupplierId(s.id);
                                    setSupplierSubView('credits');
                                  }}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition font-bold cursor-pointer inline-flex items-center gap-0.5"
                                  title="View separate credit invoices and balance for this supplier"
                                >
                                  <Receipt className="h-3 w-3" />
                                  <span>Credits</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedAnalysisSupplierId(s.id);
                                    setSupplierSubView('analysis');
                                  }}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition font-bold cursor-pointer inline-flex items-center gap-0.5"
                                  title="View Purchase History & Sourcing Analysis"
                                >
                                  <Clipboard className="h-3 w-3" />
                                  <span>History</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingSupplier(s);
                                    setShowEditSupplierModal(true);
                                  }}
                                  className="p-1 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 rounded transition-all cursor-pointer inline-flex items-center"
                                  title="Edit Supplier"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setSupplierToDelete({ id: s.id, name: s.name })}
                                  className="p-1 text-red-500 hover:bg-red-50 hover:text-red-700 rounded transition-all cursor-pointer inline-flex items-center"
                                  title="Delete Supplier"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {suppliers.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-gray-400 italic">No suppliers registered yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Transactions Ledger Movements (3 cols) */}
                <div className="lg:col-span-3 space-y-3">
                  {/* Due Date Notification Banner */}
                  {dueTransactions.length > 0 && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
                      <div className="flex items-center gap-2.5 text-rose-900">
                        <div className="p-2 bg-rose-100 rounded-full text-rose-600 shrink-0">
                          <AlertTriangle className="h-4 w-4 animate-bounce" />
                        </div>
                        <div>
                          <span className="font-bold text-xs block text-rose-950">
                            ⚠️ Attention: {dueTransactions.length} Credit Invoice{dueTransactions.length > 1 ? 's have' : ' has'} reached or passed due date!
                          </span>
                          <span className="text-[11px] text-rose-700">
                            Total outstanding overdue balance: <strong className="font-mono font-bold text-rose-900">{totalDueDebt.toLocaleString('en-US')} ETB</strong> awaiting payment settlement.
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTxDueStatusFilter(prev => prev === 'due_reached' ? 'all' : 'due_reached')}
                          className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            txDueStatusFilter === 'due_reached'
                              ? 'bg-rose-700 text-white shadow'
                              : 'bg-white border border-rose-300 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          <Bell className="h-3.5 w-3.5" />
                          {txDueStatusFilter === 'due_reached' ? 'Show All Entries' : `Filter Due Invoices (${dueTransactions.length})`}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Financial Movements Ledger</h4>
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono font-semibold">
                        {filteredTransactions.length} records
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={exportFilteredTransactionsCsv}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1 px-2.5 rounded shadow flex items-center gap-1.5 transition cursor-pointer"
                      title="Export filtered records directly to Excel compatible CSV"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      Export Ledger to Excel
                    </button>
                  </div>

                  {/* Filters Grid */}
                  <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-xl space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {/* Supplier Filter */}
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Supplier</label>
                        <select
                          value={txSupplierFilter}
                          onChange={(e) => setTxSupplierFilter(e.target.value)}
                          className="bg-white border border-gray-300 text-xs p-1.5 rounded outline-none w-full"
                        >
                          <option value="">All Suppliers</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>

                      {/* Movement Type Filter */}
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Type</label>
                        <select
                          value={txTypeFilter}
                          onChange={(e) => setTxTypeFilter(e.target.value)}
                          className="bg-white border border-gray-300 text-xs p-1.5 rounded outline-none w-full"
                        >
                          <option value="">All Types</option>
                          <option value="Payment">Payments Only</option>
                          <option value="Purchase Credit">Purchase Credits Only</option>
                        </select>
                      </div>

                      {/* Payment/Tx Date Filter */}
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-emerald-600" />
                          <span>Payment / Tx Date</span>
                        </label>
                        <input
                          type="date"
                          value={txDateFilter}
                          onChange={(e) => setTxDateFilter(e.target.value)}
                          className="bg-white border border-gray-300 text-xs p-1.5 rounded outline-none w-full font-mono"
                        />
                      </div>

                      {/* Due Status Filter */}
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Due &amp; Payment Status</label>
                        <select
                          value={txDueStatusFilter}
                          onChange={(e) => setTxDueStatusFilter(e.target.value as any)}
                          className="bg-white border border-gray-300 text-xs p-1.5 rounded outline-none w-full"
                        >
                          <option value="all">All Statuses</option>
                          <option value="due_reached">⚠️ Due Date Reached / Overdue</option>
                          <option value="unpaid">Unpaid Credits Only</option>
                          <option value="paid">Paid &amp; Settled Only</option>
                        </select>
                      </div>
                    </div>

                    {/* Amount Range Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-200/70 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-semibold text-gray-500 flex items-center gap-0.5">
                          <DollarSign className="h-3 w-3 text-gray-400" />
                          Amount Range (ETB):
                        </span>
                        <input
                          type="number"
                          placeholder="Min ETB"
                          value={txMinAmount}
                          onChange={(e) => setTxMinAmount(e.target.value)}
                          className="bg-white border border-gray-300 text-xs p-1 rounded w-24 outline-none font-mono"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                          type="number"
                          placeholder="Max ETB"
                          value={txMaxAmount}
                          onChange={(e) => setTxMaxAmount(e.target.value)}
                          className="bg-white border border-gray-300 text-xs p-1 rounded w-24 outline-none font-mono"
                        />
                      </div>

                      {(txSupplierFilter || txTypeFilter || txDateFilter || txMinAmount || txMaxAmount || txDueStatusFilter !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setTxSupplierFilter('');
                            setTxTypeFilter('');
                            setTxDateFilter('');
                            setTxMinAmount('');
                            setTxMaxAmount('');
                            setTxDueStatusFilter('all');
                          }}
                          className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer underline flex items-center gap-1"
                        >
                          <X className="h-3 w-3" />
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-150 rounded-xl overflow-x-auto text-xs scrollbar-thin">
                    <table className="min-w-full text-left">
                      <thead className="bg-gray-50 border-b border-gray-100 font-semibold text-gray-700">
                        <tr>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5">Supplier</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5 text-right">Amount</th>
                          <th className="p-2.5">Due Date &amp; Terms</th>
                          <th className="p-2.5">Aging &amp; Status</th>
                          <th className="p-2.5">Ref / Notes</th>
                          <th className="p-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-600">
                        {filteredTransactions.map(tx => {
                            const sName = suppliers.find(s => s.id === tx.supplierId)?.name || 'Unknown';
                            const outstanding = tx.type === 'Purchase Credit' ? (tx.amount - (tx.paidAmount || 0)) : 0;
                            const isPaidCredit = tx.type === 'Purchase Credit' && tx.paymentStatus === 'Paid';
                            const isDueReached = tx.type === 'Purchase Credit' && tx.paymentStatus !== 'Paid' && tx.dueDate && tx.dueDate <= todayStr;
                            const isOverdue = tx.type === 'Purchase Credit' && tx.paymentStatus !== 'Paid' && tx.dueDate && tx.dueDate < todayStr;
                            const isDueToday = tx.type === 'Purchase Credit' && tx.paymentStatus !== 'Paid' && tx.dueDate && tx.dueDate === todayStr;
                            
                            let daysOverdue = 0;
                            if (isOverdue && tx.dueDate) {
                              const diffTime = Math.abs(new Date(todayStr).getTime() - new Date(tx.dueDate).getTime());
                              daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            }
                            
                            // Color statuses
                            let statusBadge = null;
                            if (tx.type === 'Purchase Credit') {
                              const status = tx.paymentStatus || 'Pending';
                              let color = 'bg-rose-50 text-rose-700 border-rose-100';
                              if (status === 'Paid') {
                                color = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                              } else if (status === 'Partially Paid') {
                                color = 'bg-sky-50 text-sky-700 border-sky-100';
                              }
                              statusBadge = (
                                <div className="space-y-0.5">
                                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.2 text-[9px] font-bold border ${color}`}>
                                    {status}
                                  </span>
                                  {status !== 'Paid' && (
                                    <span className="block text-[9px] text-gray-500 font-mono">
                                      Bal: {outstanding.toLocaleString('en-US')} ETB
                                    </span>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <tr key={tx.id} className={`transition ${
                                isPaidCredit 
                                  ? 'bg-emerald-50/45 hover:bg-emerald-50/70 border-l-2 border-l-emerald-500' 
                                  : isDueReached
                                  ? 'bg-rose-50/40 hover:bg-rose-50/70 border-l-2 border-l-rose-500'
                                  : 'hover:bg-gray-55'
                              }`}>
                                <td className="p-2.5 font-mono text-[10px]">{tx.date}</td>
                                <td className="p-2.5 font-semibold text-gray-800">{sName}</td>
                                <td className="p-2.5">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border ${
                                    tx.type === 'Payment' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                                  }`}>
                                    {tx.type === 'Payment' ? 'Payment' : 'Credit Bill'}
                                  </span>
                                </td>
                                <td className={`p-2.5 text-right font-mono font-bold ${tx.type === 'Payment' ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {tx.type === 'Payment' ? '-' : '+'}{tx.amount.toLocaleString('en-US')} ETB
                                </td>
                                <td className="p-2.5">
                                  <div className="font-mono text-slate-700 text-[10px] font-semibold">{tx.dueDate || 'N/A'}</div>
                                  {isOverdue && (
                                    <div className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1 py-0.5 rounded border border-rose-200 inline-flex items-center gap-0.5 mt-0.5">
                                      <AlertTriangle className="h-2.5 w-2.5" />
                                      OVERDUE ({daysOverdue}d)
                                    </div>
                                  )}
                                  {isDueToday && (
                                    <div className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1 py-0.5 rounded border border-amber-200 inline-flex items-center gap-0.5 mt-0.5">
                                      <Clock className="h-2.5 w-2.5" />
                                      DUE TODAY
                                    </div>
                                  )}
                                  {tx.paymentTerms && <div className="text-[9px] text-gray-400 font-semibold">{tx.paymentTerms}</div>}
                                </td>
                                <td className="p-2.5">
                                  {statusBadge || <span className="text-gray-400 font-mono">-</span>}
                                </td>
                                <td className="p-2.5 leading-tight">
                                  <span className="block font-mono font-semibold text-gray-700">{tx.reference || 'N/A'}</span>
                                  <span className="block text-[10px] text-gray-400 italic max-w-[120px] truncate" title={tx.notes}>{tx.notes || ''}</span>
                                  {tx.recipientName && (
                                    <div className="text-[9px] text-indigo-700 font-semibold flex items-center gap-1 mt-0.5 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 max-w-fit">
                                      <Users className="h-2.5 w-2.5 flex-shrink-0" />
                                      <span className="truncate max-w-[110px]" title={`Recipient: ${tx.recipientName}`}>Recv: {tx.recipientName}</span>
                                    </div>
                                  )}
                                  {tx.receiptAttachment && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedReceiptTx(tx)}
                                      className="text-[9px] text-emerald-700 hover:text-emerald-900 font-bold bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1 mt-0.5 cursor-pointer transition"
                                      title="Click to view attached payment receipt"
                                    >
                                      <Paperclip className="h-2.5 w-2.5" />
                                      <span>Proof Attached</span>
                                    </button>
                                  )}
                                </td>
                                <td className="p-2.5 text-center space-x-1 whitespace-nowrap">
                                  {tx.type === 'Purchase Credit' && tx.paymentStatus !== 'Paid' && (
                                    <button
                                      onClick={() => {
                                        setPaymentForm({
                                          supplierId: tx.supplierId,
                                          amount: outstanding,
                                          reference: `${tx.reference || tx.id}`,
                                          notes: `Settlement for invoice: ${tx.reference || tx.id}`,
                                          date: new Date().toISOString().split('T')[0],
                                          creditTransactionId: tx.id,
                                          recipientName: '',
                                          receiptAttachment: '',
                                          receiptFileName: ''
                                        });
                                        setShowPaymentModal(true);
                                      }}
                                      className="px-1.5 py-0.5 rounded text-[10px] bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition font-bold cursor-pointer inline-block"
                                    >
                                      Pay
                                    </button>
                                  )}
                                  {tx.type === 'Purchase Credit' && (
                                    <button
                                      onClick={() => handleTogglePaid(tx.id)}
                                      className={`px-1.5 py-0.5 rounded text-[10px] border transition font-bold cursor-pointer inline-block ${
                                        tx.paymentStatus === 'Paid'
                                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                      }`}
                                      title={tx.paymentStatus === 'Paid' ? 'Mark as Unpaid' : 'Mark as Fully Paid'}
                                    >
                                      {tx.paymentStatus === 'Paid' ? 'Mark Unpaid' : 'Mark Paid'}
                                    </button>
                                  )}
                                  {tx.receiptAttachment ? (
                                    <button
                                      onClick={() => setSelectedReceiptTx(tx)}
                                      className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition font-bold cursor-pointer inline-flex items-center gap-0.5"
                                      title="View payment receipt voucher proof"
                                    >
                                      <Eye className="h-2.5 w-2.5" />
                                      Receipt
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setAttachingReceiptTx(tx);
                                        setAttachRecipientInput(tx.recipientName || '');
                                        setAttachFileUrl('');
                                        setAttachFileName('');
                                      }}
                                      className="px-1.5 py-0.5 rounded text-[10px] bg-gray-50 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-gray-200 transition font-medium cursor-pointer inline-flex items-center gap-0.5"
                                      title="Attach recipient or receipt proof"
                                    >
                                      <Paperclip className="h-2.5 w-2.5" />
                                      Attach
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        {filteredTransactions.length === 0 && (
                          <tr>
                            <td colSpan={8} className="p-6 text-center text-gray-400 italic">
                              {supplierTransactions.length === 0 
                                ? 'No financial movements logged yet. Adjust opening values or submit PO payments.' 
                                : 'No transactions match the selected filters (supplier, type, date, amount, or due status).'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : supplierSubView === 'credits' ? (
              <div className="space-y-6">
                {/* Outbound Credit Overview KPIs */}
                {(() => {
                  const allCreditTxs = supplierTransactions.filter(t => t.type === 'Purchase Credit');
                  const allPaymentTxs = supplierTransactions.filter(t => t.type === 'Payment');
                  const totalCreditIncurred = allCreditTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                  const totalPaymentsSettled = allPaymentTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                  const totalOutstandingDebt = suppliers.reduce((sum, s) => sum + (Number(s.balance) || 0), 0);
                  const totalOverdueAmount = allCreditTxs
                    .filter(t => t.paymentStatus !== 'Paid' && t.dueDate && t.dueDate < todayStr)
                    .reduce((sum, t) => sum + ((Number(t.amount) || 0) - (Number(t.paidAmount) || 0)), 0);
                  const overdueCount = allCreditTxs.filter(t => t.paymentStatus !== 'Paid' && t.dueDate && t.dueDate < todayStr).length;

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                          <div className="flex items-center justify-between text-slate-500 mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider">Total Credit Incurred</span>
                            <CreditCard className="h-4 w-4 text-indigo-500" />
                          </div>
                          <div className="text-xl font-black text-slate-900 font-mono">
                            {totalCreditIncurred.toLocaleString('en-US')} <span className="text-xs font-semibold text-slate-500">ETB</span>
                          </div>
                          <span className="text-[11px] text-slate-500 mt-1 block">Lifetime credit purchases recorded</span>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                          <div className="flex items-center justify-between text-slate-500 mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider">Total Settled Payments</span>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          </div>
                          <div className="text-xl font-black text-emerald-700 font-mono">
                            {totalPaymentsSettled.toLocaleString('en-US')} <span className="text-xs font-semibold text-slate-500">ETB</span>
                          </div>
                          <span className="text-[11px] text-emerald-600 mt-1 block">Payments remitted to suppliers</span>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                          <div className="flex items-center justify-between text-slate-500 mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider">Net Outbound Credit Debt</span>
                            <Wallet className="h-4 w-4 text-amber-500" />
                          </div>
                          <div className={`text-xl font-black font-mono ${totalOutstandingDebt > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                            {totalOutstandingDebt.toLocaleString('en-US')} <span className="text-xs font-semibold text-slate-500">ETB</span>
                          </div>
                          <span className="text-[11px] text-amber-700 font-medium mt-1 block">Total currently owed to all suppliers</span>
                        </div>

                        <div className="bg-white border border-rose-200 bg-rose-50/30 rounded-2xl p-4 shadow-xs">
                          <div className="flex items-center justify-between text-rose-700 mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider">Overdue Credit Amount</span>
                            <AlertTriangle className="h-4 w-4 text-rose-600 animate-bounce" />
                          </div>
                          <div className="text-xl font-black text-rose-700 font-mono">
                            {totalOverdueAmount.toLocaleString('en-US')} <span className="text-xs font-semibold text-rose-600">ETB</span>
                          </div>
                          <span className="text-[11px] text-rose-600 font-medium mt-1 block">
                            {overdueCount} {overdueCount === 1 ? 'invoice overdue' : 'invoices overdue'} past maturity
                          </span>
                        </div>
                      </div>

                      {/* Header controls & filter bar */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
                        <div className="flex flex-1 items-center gap-3">
                          <div className="relative flex-1 max-w-sm">
                            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={creditSearchQuery}
                              onChange={(e) => setCreditSearchQuery(e.target.value)}
                              placeholder="Search supplier by name or phone..."
                              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-rose-500 bg-slate-50 focus:bg-white transition"
                            />
                            {creditSearchQuery && (
                              <button
                                onClick={() => setCreditSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          <div className="w-56">
                            <select
                              value={selectedCreditSupplierId}
                              onChange={(e) => setSelectedCreditSupplierId(e.target.value)}
                              className="w-full text-xs border border-slate-200 rounded-xl p-1.5 bg-slate-50 text-slate-700 outline-none focus:border-rose-500 cursor-pointer"
                            >
                              <option value="all">All Suppliers (Separate Accounts)</option>
                              {suppliers.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.balance > 0 ? `${s.balance.toLocaleString()} ETB` : 'Settled'})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {onOpenOutboundCreditNotificationPanel && (
                            <button
                              type="button"
                              onClick={onOpenOutboundCreditNotificationPanel}
                              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                              title="Open dedicated Outbound Credit Notification Panel with alerts and overdue drawer"
                            >
                              <Bell className="h-3.5 w-3.5 animate-pulse" />
                              <span>View Outbound Alerts Tray</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setCreditForm({
                                supplierId: suppliers[0]?.id || '',
                                amount: 0,
                                reference: '',
                                notes: '',
                                date: new Date().toISOString().split('T')[0],
                                dueDate: '',
                                paymentTerms: 'Net 30'
                              });
                              setShowCreditModal(true);
                            }}
                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>+ Record Credit Invoice</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Individual Supplier Credit Accounts */}
                {(() => {
                  const filteredSuppliers = suppliers
                    .filter(s => {
                      if (selectedCreditSupplierId !== 'all' && s.id !== selectedCreditSupplierId) return false;
                      if (!creditSearchQuery) return true;
                      const q = creditSearchQuery.toLowerCase();
                      return s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q));
                    })
                    .sort((a, b) => b.balance - a.balance);

                  if (filteredSuppliers.length === 0) {
                    return (
                      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
                        <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                        <h4 className="font-bold text-slate-700 text-sm">No Supplier Matches Your Filter</h4>
                        <p className="text-xs text-slate-500 mt-1">Try clearing your search query or selecting "All Suppliers".</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6">
                      {filteredSuppliers.map(sup => {
                        const supCreditTxs = supplierTransactions
                          .filter(t => t.supplierId === sup.id && t.type === 'Purchase Credit')
                          .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

                        const supPaymentTxs = supplierTransactions
                          .filter(t => t.supplierId === sup.id && t.type === 'Payment')
                          .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

                        const supTotalCredit = supCreditTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                        const supTotalPaid = supPaymentTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                        const supBalance = sup.balance;

                        const supOverdueTxs = supCreditTxs.filter(t => t.paymentStatus !== 'Paid' && t.dueDate && t.dueDate < todayStr);
                        const supOverdueAmount = supOverdueTxs.reduce((sum, t) => sum + ((Number(t.amount) || 0) - (Number(t.paidAmount) || 0)), 0);

                        return (
                          <div
                            key={sup.id}
                            className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all hover:border-slate-300"
                          >
                            {/* Supplier Header Banner */}
                            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-base font-bold text-slate-900">{sup.name}</h3>
                                  <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                                    ID: {sup.id}
                                  </span>
                                  {supBalance > 0 ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                                      <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-ping"></span>
                                      {supBalance.toLocaleString('en-US')} ETB Outstanding
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" /> Account Settled in Full
                                    </span>
                                  )}
                                  {supOverdueAmount > 0 && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-600 text-white flex items-center gap-1 animate-pulse">
                                      <AlertTriangle className="h-3 w-3" /> {supOverdueTxs.length} Overdue ({supOverdueAmount.toLocaleString('en-US')} ETB)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                                  {sup.phone && <span>📞 {sup.phone}</span>}
                                  {sup.email && <span>✉️ {sup.email}</span>}
                                  {sup.address && <span>📍 {sup.address}</span>}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPaymentForm({
                                      supplierId: sup.id,
                                      amount: sup.balance > 0 ? sup.balance : 0,
                                      reference: `PAY-${Date.now().toString().slice(-4)}`,
                                      notes: `Payment to ${sup.name}`,
                                      date: new Date().toISOString().split('T')[0],
                                      creditTransactionId: '',
                                      recipientName: '',
                                      receiptAttachment: '',
                                      receiptFileName: ''
                                    });
                                    setShowPaymentModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                                  title={`Pay balance due to ${sup.name}`}
                                >
                                  <DollarSign className="h-3.5 w-3.5" />
                                  <span>Pay Supplier</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCreditForm({
                                      supplierId: sup.id,
                                      amount: 0,
                                      reference: `INV-${Date.now().toString().slice(-4)}`,
                                      notes: `Credit invoice from ${sup.name}`,
                                      date: new Date().toISOString().split('T')[0],
                                      dueDate: '',
                                      paymentTerms: 'Net 30'
                                    });
                                    setShowCreditModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                                  title={`Add credit invoice for ${sup.name}`}
                                >
                                  <CreditCard className="h-3.5 w-3.5" />
                                  <span>+ Credit Invoice</span>
                                </button>
                              </div>
                            </div>

                            {/* 4 Financial Metric Highlights for this specific supplier */}
                            <div className="p-4 sm:p-5 grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/50 border-b border-slate-100">
                              <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                  Total Incurred Credit
                                </span>
                                <div className="text-base font-extrabold text-indigo-700 font-mono">
                                  {supTotalCredit > 0 ? supTotalCredit.toLocaleString('en-US') : (supBalance > 0 ? supBalance.toLocaleString('en-US') : '0')} ETB
                                </div>
                                <span className="text-[10px] text-slate-500">{supCreditTxs.length} credit invoices</span>
                              </div>

                              <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                  Total Settled Payments
                                </span>
                                <div className="text-base font-extrabold text-emerald-700 font-mono">
                                  {supTotalPaid.toLocaleString('en-US')} ETB
                                </div>
                                <span className="text-[10px] text-emerald-600">{supPaymentTxs.length} payments paid</span>
                              </div>

                              <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                  Current Balance Due
                                </span>
                                <div className={`text-base font-extrabold font-mono ${supBalance > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                                  {supBalance.toLocaleString('en-US')} ETB
                                </div>
                                <span className={`text-[10px] font-medium ${supBalance > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                  {supBalance > 0 ? 'Remaining to settle' : 'All debts settled'}
                                </span>
                              </div>

                              <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                  Overdue Credit Balance
                                </span>
                                <div className={`text-base font-extrabold font-mono ${supOverdueAmount > 0 ? 'text-red-700' : 'text-slate-600'}`}>
                                  {supOverdueAmount.toLocaleString('en-US')} ETB
                                </div>
                                <span className={`text-[10px] font-medium ${supOverdueAmount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                  {supOverdueTxs.length} overdue invoices
                                </span>
                              </div>
                            </div>

                            {/* Specific Credit Invoices Breakdown Table */}
                            <div className="p-4 sm:p-5">
                              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                                <span>Specific Credit Invoices &amp; Maturity for {sup.name}</span>
                                <span className="text-[11px] font-normal text-slate-500">
                                  Showing all specific credit bills on record
                                </span>
                              </h4>

                              {supCreditTxs.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                                  No credit invoices logged yet for this supplier. Record a credit purchase to begin tracking.
                                </div>
                              ) : (
                                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                  <table className="min-w-full text-left text-xs divide-y divide-slate-100">
                                    <thead className="bg-slate-50 font-bold text-slate-600">
                                      <tr>
                                        <th className="p-2.5">Invoice / Ref #</th>
                                        <th className="p-2.5">Invoice Date</th>
                                        <th className="p-2.5">Due Date &amp; Maturity</th>
                                        <th className="p-2.5 text-right">Original Amount</th>
                                        <th className="p-2.5 text-right">Paid Amount</th>
                                        <th className="p-2.5 text-right">Balance Due</th>
                                        <th className="p-2.5 text-center">Status</th>
                                        <th className="p-2.5 text-center">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                      {supCreditTxs.map(tx => {
                                        const remaining = (Number(tx.amount) || 0) - (Number(tx.paidAmount) || 0);
                                        const isPaid = tx.paymentStatus === 'Paid' || remaining <= 0;
                                        const isOverdue = !isPaid && tx.dueDate && tx.dueDate < todayStr;
                                        const isDueToday = !isPaid && tx.dueDate === todayStr;

                                        return (
                                          <tr
                                            key={tx.id}
                                            className={`hover:bg-slate-50/80 transition-colors ${isOverdue ? 'bg-rose-50/30' : ''}`}
                                          >
                                            <td className="p-2.5 font-mono font-bold text-slate-900">
                                              {tx.reference || tx.id}
                                            </td>
                                            <td className="p-2.5 text-slate-600 font-mono">
                                              {tx.date || 'N/A'}
                                            </td>
                                            <td className="p-2.5 font-mono">
                                              {tx.dueDate ? (
                                                <div className="flex items-center gap-1.5">
                                                  <span>{tx.dueDate}</span>
                                                  {isOverdue && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">
                                                      OVERDUE
                                                    </span>
                                                  )}
                                                  {isDueToday && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white animate-pulse">
                                                      DUE TODAY
                                                    </span>
                                                  )}
                                                </div>
                                              ) : (
                                                <span className="text-slate-400">Open Credit</span>
                                              )}
                                            </td>
                                            <td className="p-2.5 text-right font-mono font-medium text-slate-800">
                                              {(Number(tx.amount) || 0).toLocaleString('en-US')} ETB
                                            </td>
                                            <td className="p-2.5 text-right font-mono text-emerald-700 font-medium">
                                              {(Number(tx.paidAmount) || 0).toLocaleString('en-US')} ETB
                                            </td>
                                            <td className={`p-2.5 text-right font-mono font-bold ${remaining > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                              {remaining.toLocaleString('en-US')} ETB
                                            </td>
                                            <td className="p-2.5 text-center">
                                              {isPaid ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                                  PAID
                                                </span>
                                              ) : isOverdue ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                                                  OVERDUE
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                                                  PENDING
                                                </span>
                                              )}
                                            </td>
                                            <td className="p-2.5 text-center">
                                              <div className="flex items-center justify-center gap-1.5">
                                                {!isPaid && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setPaymentForm({
                                                        supplierId: sup.id,
                                                        amount: remaining,
                                                        reference: `PAY-INV-${(tx.reference || tx.id).slice(-6)}`,
                                                        notes: `Payment for credit invoice ${tx.reference || tx.id}`,
                                                        date: new Date().toISOString().split('T')[0],
                                                        creditTransactionId: tx.id,
                                                        recipientName: '',
                                                        receiptAttachment: '',
                                                        receiptFileName: ''
                                                      });
                                                      setShowPaymentModal(true);
                                                    }}
                                                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
                                                    title={`Pay remaining ${remaining} ETB for this invoice`}
                                                  >
                                                    Pay Bill
                                                  </button>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={() => handleTogglePaid(tx.id)}
                                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                                                    tx.paymentStatus === 'Paid'
                                                      ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                                  }`}
                                                >
                                                  {tx.paymentStatus === 'Paid' ? 'Mark Unpaid' : 'Mark Paid'}
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : (() => {
              const selectedSupplierObj = suppliers.find(s => s.id === selectedAnalysisSupplierId);
              
              const supplierReceivedPOs = purchaseOrders.filter(po => 
                po.supplierId === selectedAnalysisSupplierId && 
                (po.status === 'Received' || po.status === 'Sent')
              );

              const chronologicalPurchases = supplierReceivedPOs.flatMap(po => 
                po.items.map(item => ({
                  poNumber: po.poNumber,
                  date: po.receivedDate || po.date,
                  status: po.status,
                  receivedBy: po.receivedBy || 'N/A',
                  medicineId: item.medicineId,
                  medicineName: item.medicineName,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.quantity * item.unitPrice
                }))
              ).sort((a, b) => b.date.localeCompare(a.date));

              const aggregatedSourcingMap: { [medName: string]: { totalQty: number, totalCost: number, averageCost: number, lastDate: string } } = {};
              
              chronologicalPurchases.forEach(p => {
                if (!aggregatedSourcingMap[p.medicineName]) {
                  aggregatedSourcingMap[p.medicineName] = {
                    totalQty: 0,
                    totalCost: 0,
                    averageCost: 0,
                    lastDate: p.date
                  };
                }
                const entry = aggregatedSourcingMap[p.medicineName];
                entry.totalQty += p.quantity;
                entry.totalCost += p.totalPrice;
                if (p.date > entry.lastDate) {
                  entry.lastDate = p.date;
                }
              });

              Object.keys(aggregatedSourcingMap).forEach(key => {
                const entry = aggregatedSourcingMap[key];
                entry.averageCost = entry.totalQty > 0 ? Number((entry.totalCost / entry.totalQty).toFixed(2)) : 0;
              });

              return (
                <div className="space-y-6 text-left">
                  {/* Selector Header */}
                  <div className="bg-white border border-gray-150 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 block">🔍 Supplier Sourcing Profile</span>
                      <h4 className="text-sm font-bold text-gray-950">Select Supplier for Drill-Down Purchase History</h4>
                      <select
                        value={selectedAnalysisSupplierId}
                        onChange={(e) => setSelectedAnalysisSupplierId(e.target.value)}
                        className="bg-white border border-gray-250 text-gray-850 rounded-lg p-2.5 outline-none shadow-sm font-bold text-xs min-w-[240px]"
                      >
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>

                    {selectedSupplierObj ? (
                      <div className="text-xs bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1.5 min-w-[260px] md:self-stretch flex flex-col justify-center">
                        <p className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">Contact &amp; Location Details</p>
                        <p className="text-gray-700"><span className="font-bold text-gray-900">📍 Address:</span> {selectedSupplierObj.address || 'N/A'}</p>
                        <p className="text-gray-700"><span className="font-bold text-gray-900">📞 Phone:</span> {selectedSupplierObj.phone}</p>
                        <p className="text-gray-700"><span className="font-bold text-gray-900">✉️ Email:</span> {selectedSupplierObj.email || 'N/A'}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No supplier selected.</p>
                    )}
                  </div>

                  {chronologicalPurchases.length === 0 ? (
                    <div className="bg-amber-50/50 border border-amber-200 p-8 rounded-2xl text-center space-y-2">
                      <p className="text-amber-800 font-bold text-sm">⚠️ No Received Purchase Orders recorded</p>
                      <p className="text-gray-500 text-xs max-w-md mx-auto leading-relaxed">
                        There are currently no completed Goods Receiving Notes (GRNs) or received Purchase Orders (POs) logged for <span className="font-bold text-gray-800">"{selectedSupplierObj?.name}"</span>. 
                        Requisitions must be set to "Received" status to build analytical purchase records and inventory restock histories.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left Side: Consolidated Sourcing (What I buy from this supplier) */}
                      <div className="space-y-3.5">
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Plus className="h-4 w-4 text-emerald-600" />
                          Sourcing Portfolio (What I buy from {selectedSupplierObj?.name})
                        </h4>
                        <div className="bg-white border border-gray-150 rounded-xl overflow-hidden shadow-sm">
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-gray-50 border-b border-gray-250 font-bold text-gray-850">
                              <tr>
                                <th className="p-3">Product Formulation</th>
                                <th className="p-3 text-center">Total Qty Sourced</th>
                                <th className="p-3 text-right">Avg Unit Cost</th>
                                <th className="p-3 text-right">Total Spent</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-150 text-gray-700">
                              {Object.keys(aggregatedSourcingMap).map(medName => {
                                const info = aggregatedSourcingMap[medName];
                                return (
                                  <tr key={medName} className="hover:bg-gray-55 transition-colors">
                                    <td className="p-3 font-extrabold text-black">{medName}</td>
                                    <td className="p-3 text-center font-bold font-mono text-emerald-700 bg-emerald-50/30">{info.totalQty.toLocaleString()} units</td>
                                    <td className="p-3 text-right font-mono font-semibold">{info.averageCost.toLocaleString()} ETB</td>
                                    <td className="p-3 text-right font-mono font-extrabold text-gray-950">{info.totalCost.toLocaleString()} ETB</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Right Side: Chronological Purchase Ledger */}
                      <div className="space-y-3.5">
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Clipboard className="h-4 w-4 text-emerald-600" />
                          Chronological Purchase Log (Dates, Quantities &amp; Totals)
                        </h4>
                        <div className="bg-white border border-gray-150 rounded-xl overflow-hidden shadow-sm">
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-gray-50 border-b border-gray-250 font-bold text-gray-850">
                              <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">PO Number</th>
                                <th className="p-3">Drug / Product</th>
                                <th className="p-3 text-center">Qty</th>
                                <th className="p-3 text-right">Cost Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-150 text-gray-700">
                              {chronologicalPurchases.map((purchase, index) => (
                                <tr key={index} className="hover:bg-gray-55 transition-colors">
                                  <td className="p-3 font-mono font-medium text-gray-500 whitespace-nowrap">{purchase.date}</td>
                                  <td className="p-3 font-mono font-semibold text-emerald-800">
                                    {purchase.poNumber}
                                    <span className={`ml-1.5 px-1 py-0.2 rounded text-[8px] font-bold border uppercase ${
                                      purchase.status === 'Received' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-yellow-50 text-yellow-750 border-yellow-100'
                                    }`}>
                                      {purchase.status}
                                    </span>
                                  </td>
                                  <td className="p-3 font-bold text-gray-900">{purchase.medicineName}</td>
                                  <td className="p-3 text-center font-semibold font-mono">{purchase.quantity} units</td>
                                  <td className="p-3 text-right font-mono font-bold text-emerald-700">{purchase.totalPrice.toLocaleString()} ETB</td>
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
            })()}
          </div>

      {/* PO Drafter Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-150 text-xs">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-sm font-bold text-gray-900">Draft Supply Purchase Order</h3>
              <button
                type="button"
                onClick={() => setShowSupplierModal(true)}
                className="text-emerald-600 hover:text-emerald-800 font-bold"
              >
                + Register Supplier on-the-fly
              </button>
            </div>

            {hasPoDraft && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-base">📝</span>
                  <div>
                    <span className="font-bold block">Unsaved Purchase Order Draft Found!</span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-300">
                      {poDraftData?.poLines?.length || 0} order item line(s) saved from a previous session.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={restorePoDraft}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-sm transition-colors cursor-pointer text-xs"
                  >
                    Restore Draft
                  </button>
                  <button
                    type="button"
                    onClick={discardPoDraft}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-amber-800 dark:text-amber-200 font-medium rounded border border-amber-300 dark:border-amber-700 transition-colors cursor-pointer text-xs"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={submitPo} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Select Supplier</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full bg-white border border-gray-250 p-2 rounded outline-none"
                  >
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Target Receiving Branch</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full bg-white border border-gray-250 p-2 rounded outline-none"
                  >
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800">Order Lines</span>
                  <button type="button" onClick={addLine} className="text-emerald-700 hover:text-emerald-900 font-bold">+ Add Catalog Drug</button>
                </div>

                {poLines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-gray-55 p-2 rounded border">
                    <select
                      value={line.medicineId}
                      onChange={(e) => updateLine(idx, 'medicineId', e.target.value)}
                      className="flex-1 bg-white border p-1 rounded"
                    >
                      {medicines.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                      className="w-14 bg-white border p-1 text-center rounded"
                      placeholder="Qty"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.unitPrice}
                      onChange={(e) => {
                        const val = e.target.value.replace(',', '.');
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          updateLine(idx, 'unitPrice', val);
                        }
                      }}
                      className="w-20 bg-white border p-1 text-center rounded font-mono"
                      placeholder="Cost"
                    />
                    <span className="font-mono font-bold text-gray-900 w-16 text-right">
                      {((Number(line.quantity) || 0) * (parseFloat(String(line.unitPrice)) || 0)).toFixed(2)} ETB
                    </span>
                    <button type="button" onClick={() => removeLine(idx)} className="text-red-500 font-bold">Delete</button>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="bg-white border py-2 px-4 rounded text-gray-700">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-emerald-600 text-white font-bold py-2 px-5 rounded">
                  {submitting ? 'Drafting PO...' : 'Issue Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRN Delivery Batch Input Modal */}
      {receivingPo && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`bg-white rounded-xl shadow-2xl p-6 border border-gray-150 text-xs flex flex-col transition-all duration-200 ${
            grnSize === 'small' ? 'max-w-md w-full' :
            grnSize === 'medium' ? 'max-w-2xl w-full' :
            grnSize === 'large' ? 'max-w-4xl w-full' :
            'max-w-[96vw] w-full h-[92vh] justify-between'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-3.5 mb-4 gap-2">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <Clipboard className="text-emerald-600 h-5 w-5" />
                  Goods Receiving Note (GRN) - {receivingPo.poNumber}
                </h3>
                <p className="text-[11px] text-gray-500">Enter batch codes and manufacturer expiration dates to synchronize branch inventory levels on commit.</p>
              </div>

              {/* Dynamic Adjustable Window Sizing Control Panel */}
              <div className="bg-gray-100 p-1.5 rounded-lg border flex items-center gap-1 shrink-0 self-start sm:self-center">
                <span className="text-[10px] text-gray-500 font-bold px-1 select-none">SIZE:</span>
                <button
                  type="button"
                  onClick={() => setGrnSize('small')}
                  className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${grnSize === 'small' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  title="Compact Modal"
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setGrnSize('medium')}
                  className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${grnSize === 'medium' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  title="Standard Modal"
                >
                  Balanced
                </button>
                <button
                  type="button"
                  onClick={() => setGrnSize('large')}
                  className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${grnSize === 'large' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  title="Spacious Modal"
                >
                  Spacious
                </button>
                <button
                  type="button"
                  onClick={() => setGrnSize('full')}
                  className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${grnSize === 'full' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  title="Full Screen Window"
                >
                  🔲 Full Screen
                </button>
              </div>
            </div>
            
            <form onSubmit={submitGrnReceive} className={`space-y-4 flex flex-col ${grnSize === 'full' ? 'flex-1 justify-between' : ''}`}>
              <div className={`space-y-3 pr-1 ${
                grnSize === 'full' ? 'flex-1 overflow-y-auto max-h-[64vh]' :
                grnSize === 'large' ? 'max-h-[55vh] overflow-y-auto' :
                'max-h-72 overflow-y-auto'
              }`}>
                {receivingPo.items.map((line) => {
                  const batchInfo = grnBatchData[line.medicineId] || { batchNumber: '', expiryDate: '' };
                  const itemMed = medicines.find(m => m.id === line.medicineId);
                  const isCosmetics = itemMed?.productType === 'cosmetics';
                  return (
                    <div key={line.id} className="bg-gray-55 border p-4 rounded-lg space-y-3 shadow-sm hover:border-emerald-200 transition-colors">
                      <div className="flex justify-between items-center border-b pb-1">
                        <span className="font-bold text-gray-900 text-xs">{line.medicineName}</span>
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded font-mono">
                          Ordered: {line.quantity} units
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase block text-gray-500">Batch Code / Lot Number</label>
                          <input
                            type="text"
                            required
                            value={batchInfo.batchNumber}
                            onChange={(e) => {
                              const next = { ...grnBatchData };
                              next[line.medicineId] = { ...batchInfo, batchNumber: e.target.value };
                              setGrnBatchData(next);
                            }}
                            className="bg-white border border-gray-250 p-2 w-full rounded font-mono text-xs text-gray-800"
                            placeholder="e.g. AMX-2026-X"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase block text-gray-500">
                            Manufacturer Expiry Date {isCosmetics ? '(Optional)' : ''}
                          </label>
                          <input
                            type="date"
                            required={!isCosmetics}
                            value={batchInfo.expiryDate}
                            onChange={(e) => {
                              const next = { ...grnBatchData };
                              next[line.medicineId] = { ...batchInfo, expiryDate: e.target.value };
                              setGrnBatchData(next);
                            }}
                            className="bg-white border border-gray-250 p-2 w-full rounded font-mono text-xs text-gray-800"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
 
              <div className="pt-4 border-t flex gap-2 justify-end bg-white">
                <button type="button" onClick={() => setReceivingPo(null)} className="bg-white hover:bg-gray-50 border py-2 px-5 rounded-lg text-gray-700 font-semibold transition-colors">Cancel</button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-lg shadow transition-colors">
                  Confirm GRN &amp; Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW SUPPLIER MODAL */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-150 text-xs">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-3 mb-4">Register New Pharmaceutical Supplier</h3>
            <form onSubmit={handleCreateSupplier} className="space-y-4">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Supplier Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Addis Pharmaceuticals Inc."
                  value={newSup.name}
                  onChange={(e) => setNewSup({ ...newSup, name: e.target.value })}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Contact Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +251-11-2000300"
                  value={newSup.phone}
                  onChange={(e) => setNewSup({ ...newSup, phone: e.target.value })}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. contact@addispharma.com"
                  value={newSup.email}
                  onChange={(e) => setNewSup({ ...newSup, email: e.target.value })}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Corporate Address</label>
                <input
                  type="text"
                  placeholder="e.g. Bole Sub-City, Addis Ababa, Ethiopia"
                  value={newSup.address}
                  onChange={(e) => setNewSup({ ...newSup, address: e.target.value })}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Opening Outstanding Credit Balance (ETB)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={newSup.balance}
                  onChange={(e) => {
                    const val = e.target.value.replace(',', '.');
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setNewSup({ ...newSup, balance: val });
                    }
                  }}
                  className="w-full bg-white border p-2 rounded outline-none font-mono"
                />
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button type="button" onClick={() => setShowSupplierModal(false)} className="bg-white border py-2 px-4 rounded text-gray-700">Cancel</button>
                <button type="submit" className="bg-emerald-600 text-white font-bold py-2 px-5 rounded">
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUPPLIER MODAL */}
      {showEditSupplierModal && editingSupplier && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-150 text-xs">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-3 mb-4">Edit Supplier Details</h3>
            <form onSubmit={handleEditSupplierSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Supplier Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Addis Pharmaceuticals Inc."
                  value={editingSupplier.name}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Contact Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +251-11-2000300"
                  value={editingSupplier.phone}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. contact@addispharma.com"
                  value={editingSupplier.email || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Corporate Address</label>
                <input
                  type="text"
                  placeholder="e.g. Bole Sub-City, Addis Ababa, Ethiopia"
                  value={editingSupplier.address || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, address: e.target.value })}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Outstanding Credit Balance (ETB)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={editingSupplier.balance}
                  onChange={(e) => {
                    const val = e.target.value.replace(',', '.');
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setEditingSupplier({ ...editingSupplier, balance: val as any });
                    }
                  }}
                  className="w-full bg-white border p-2 rounded outline-none font-mono"
                />
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowEditSupplierModal(false); setEditingSupplier(null); }} className="bg-white border py-2 px-4 rounded text-gray-700">Cancel</button>
                <button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-5 rounded">
                  Update Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE SUPPLIER CONFIRMATION MODAL */}
      {supplierToDelete && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-150 text-xs">
            <h3 className="text-sm font-bold text-red-600 border-b pb-3 mb-3 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" />
              Confirm Supplier Deletion
            </h3>
            <div className="space-y-3 mb-4">
              <p className="font-semibold text-gray-900">Are you sure you want to completely delete supplier <span className="text-red-600">"{supplierToDelete.name}"</span>?</p>
              <p className="text-gray-500 leading-relaxed">
                This action is <span className="font-bold text-red-600">irreversible</span>. It will actively delete the supplier and remove all associated financial movements ledger transactions.
              </p>
            </div>
            <div className="pt-3 border-t flex gap-2 justify-end">
              <button 
                type="button" 
                onClick={() => setSupplierToDelete(null)} 
                className="bg-white border py-2 px-4 rounded text-gray-700 font-semibold cursor-pointer hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => handleDeleteSupplier(supplierToDelete.id)} 
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-5 rounded shadow transition cursor-pointer"
              >
                Delete Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD SUPPLIER PAYMENT MODAL */}
      {showPaymentModal && (() => {
        const creditInvoices = supplierTransactions.filter(tx => 
          tx.supplierId === paymentForm.supplierId && 
          tx.type === 'Purchase Credit' && 
          (tx.paymentStatus !== 'Paid')
        );
        return (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-800">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-150 text-xs">
              <h3 className="text-sm font-bold text-gray-900 border-b pb-3 mb-4">Record Supplier Debt Payment</h3>
              <form onSubmit={handleCreatePayment} className="space-y-4">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Target Supplier Account</label>
                  <select
                    value={paymentForm.supplierId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, supplierId: e.target.value, creditTransactionId: '' })}
                    className="w-full bg-white border p-2 rounded outline-none"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Due: {s.balance.toLocaleString()} ETB)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Specific Credit Invoice Association (Matching) */}
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Apply to Credit Invoice (Optional)</label>
                  <select
                    value={paymentForm.creditTransactionId || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const matchedTx = creditInvoices.find(tx => tx.id === selectedId);
                      if (matchedTx) {
                        const remaining = matchedTx.amount - (matchedTx.paidAmount || 0);
                        setPaymentForm({
                          ...paymentForm,
                          creditTransactionId: selectedId,
                          amount: remaining,
                          reference: `Pay: ${matchedTx.reference || matchedTx.id}`,
                          notes: `Settlement for invoice reference: ${matchedTx.reference || matchedTx.id}`
                        });
                      } else {
                        setPaymentForm({
                          ...paymentForm,
                          creditTransactionId: '',
                          amount: 0,
                          reference: '',
                          notes: ''
                        });
                      }
                    }}
                    className="w-full bg-white border p-2 rounded outline-none"
                  >
                    <option value="">-- Pro-rata / General Supplier Balance --</option>
                    {creditInvoices.map(tx => {
                      const remaining = tx.amount - (tx.paidAmount || 0);
                      return (
                        <option key={tx.id} value={tx.id}>
                          {tx.reference || tx.id} - Total: {tx.amount} ETB (Bal: {remaining} ETB) - Due: {tx.dueDate || 'N/A'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Payment Date</label>
                    <input
                      type="date"
                      required
                      value={paymentForm.date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                      className="w-full bg-white border p-2 rounded outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Amount Paid (ETB)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="e.g. 15000.50"
                      value={paymentForm.amount || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(',', '.');
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setPaymentForm({ ...paymentForm, amount: val });
                        }
                      }}
                      className="w-full bg-white border p-2 rounded outline-none font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Payment Reference (Receipt / Check / Bank Ref)</label>
                  <input
                    type="text"
                    placeholder="e.g. CBE-TXN-9981A"
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                    className="w-full bg-white border p-2 rounded outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    Payment Recipient / Collector Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mr. Abebe (Supplier Agent) / Bank Acc Title"
                    value={paymentForm.recipientName}
                    onChange={(e) => setPaymentForm({ ...paymentForm, recipientName: e.target.value })}
                    className="w-full bg-white border p-2 rounded outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-gray-700 block">
                      Attach Payment Receipt Proof / Voucher (Optional)
                    </label>
                    {paymentForm.receiptAttachment && (
                      <button
                        type="button"
                        onClick={() => setPaymentForm({ ...paymentForm, receiptAttachment: '', receiptFileName: '' })}
                        className="text-[10px] text-rose-600 hover:text-rose-800 font-bold"
                      >
                        Remove Attachment
                      </button>
                    )}
                  </div>
                  {!paymentForm.receiptAttachment ? (
                    <div
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleReceiptFile(file, 'payment');
                      }}
                      onClick={() => paymentFileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-lg p-3 text-center cursor-pointer bg-gray-50 hover:bg-emerald-50/40 transition group"
                    >
                      <input
                        ref={paymentFileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleReceiptFile(file, 'payment');
                        }}
                      />
                      <Upload className="h-5 w-5 mx-auto text-gray-400 group-hover:text-emerald-600 mb-1 transition" />
                      <div className="text-[11px] font-semibold text-gray-700">Click to upload receipt or drag &amp; drop</div>
                      <div className="text-[9px] text-gray-400">PNG, JPG, WEBP, or PDF proof (up to 5MB)</div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-2 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                      {paymentForm.receiptAttachment.startsWith('data:image/') ? (
                        <img
                          src={paymentForm.receiptAttachment}
                          alt="Receipt proof preview"
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 object-cover rounded border border-emerald-300"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-xs">
                          PDF
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-emerald-900 truncate">
                          {paymentForm.receiptFileName || 'receipt_attachment'}
                        </div>
                        <div className="text-[9px] text-emerald-700 font-medium">Receipt proof ready to submit</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPaymentForm({ ...paymentForm, receiptAttachment: '', receiptFileName: '' })}
                        className="p-1 text-gray-400 hover:text-rose-600 rounded"
                        title="Remove attached receipt"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Internal Ledger Notes</label>
                  <textarea
                    placeholder="e.g. Settlement for March inventory batch deliveries"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    className="w-full bg-white border p-2 rounded outline-none h-16 resize-none"
                  />
                </div>

                <div className="pt-3 border-t flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowPaymentModal(false)} className="bg-white border py-2 px-4 rounded text-gray-700">Cancel</button>
                  <button type="submit" className="bg-emerald-600 text-white font-bold py-2 px-5 rounded">
                    Record Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* VIEW RECEIPT ATTACHMENT MODAL */}
      {selectedReceiptTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-5 border border-gray-150 text-xs flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900">Payment Receipt Voucher Proof</h3>
              </div>
              <button
                onClick={() => setSelectedReceiptTx(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-gray-400 block text-[9px] uppercase font-bold">Supplier</span>
                  <span className="font-semibold text-gray-900">
                    {suppliers.find(s => s.id === selectedReceiptTx.supplierId)?.name || 'Supplier'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[9px] uppercase font-bold">Amount</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {selectedReceiptTx.amount.toLocaleString('en-US')} ETB
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[9px] uppercase font-bold">Date</span>
                  <span className="font-mono text-gray-700">{selectedReceiptTx.date}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[9px] uppercase font-bold">Reference</span>
                  <span className="font-mono text-gray-700">{selectedReceiptTx.reference || selectedReceiptTx.id}</span>
                </div>
                {selectedReceiptTx.recipientName && (
                  <div className="col-span-2 bg-indigo-50 p-2 rounded border border-indigo-100 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-indigo-700 flex-shrink-0" />
                    <div>
                      <span className="text-[9px] text-indigo-600 font-bold uppercase block">Payment Recipient / Collector</span>
                      <span className="font-semibold text-indigo-950 text-[11px]">{selectedReceiptTx.recipientName}</span>
                    </div>
                  </div>
                )}
              </div>

              {selectedReceiptTx.receiptAttachment ? (
                <div className="border rounded-lg p-2 bg-slate-900/5 flex flex-col items-center justify-center">
                  {selectedReceiptTx.receiptAttachment.startsWith('data:image/') || selectedReceiptTx.receiptAttachment.match(/\.(jpeg|jpg|gif|png|webp)/i) ? (
                    <img
                      src={selectedReceiptTx.receiptAttachment}
                      alt="Receipt Voucher"
                      referrerPolicy="no-referrer"
                      className="max-h-[50vh] w-auto max-w-full rounded object-contain shadow-sm border bg-white"
                    />
                  ) : (
                    <div className="w-full h-64 bg-white rounded border flex flex-col items-center justify-center p-4 text-center">
                      <FileText className="h-12 w-12 text-slate-400 mb-2" />
                      <div className="font-semibold text-slate-700 text-xs mb-1">
                        {selectedReceiptTx.receiptFileName || 'Document Voucher (PDF)'}
                      </div>
                      <div className="text-[10px] text-slate-500 mb-3">PDF Receipt Document Attached</div>
                      <a
                        href={selectedReceiptTx.receiptAttachment}
                        download={selectedReceiptTx.receiptFileName || 'receipt_document.pdf'}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded font-bold text-xs inline-flex items-center gap-1 hover:bg-emerald-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download Document
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-6 text-gray-400 italic">
                  No visual file attached to this transaction.
                </div>
              )}
            </div>

            <div className="pt-3 border-t mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const tx = selectedReceiptTx;
                  setSelectedReceiptTx(null);
                  setAttachingReceiptTx(tx);
                  setAttachRecipientInput(tx.recipientName || '');
                  setAttachFileUrl(tx.receiptAttachment || '');
                  setAttachFileName(tx.receiptFileName || '');
                }}
                className="px-3 py-1.5 text-xs text-sky-700 hover:text-sky-900 hover:bg-sky-50 rounded border border-sky-200 font-semibold inline-flex items-center gap-1"
              >
                <Edit className="h-3 w-3" />
                Update Proof / Recipient
              </button>

              <div className="flex items-center gap-2">
                {selectedReceiptTx.receiptAttachment && (
                  <a
                    href={selectedReceiptTx.receiptAttachment}
                    download={selectedReceiptTx.receiptFileName || `receipt_${selectedReceiptTx.id}.png`}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs inline-flex items-center gap-1"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedReceiptTx(null)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ATTACH / UPDATE RECEIPT MODAL */}
      {attachingReceiptTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 border border-gray-150 text-xs">
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900">Attach Payment Recipient &amp; Receipt</h3>
              </div>
              <button
                onClick={() => setAttachingReceiptTx(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReceiptAttachment} className="space-y-3">
              <div className="bg-gray-50 p-2.5 rounded border border-gray-200 text-[11px] leading-relaxed">
                <div className="flex justify-between">
                  <span className="text-gray-500">Transaction:</span>
                  <span className="font-mono font-bold text-gray-800">{attachingReceiptTx.reference || attachingReceiptTx.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount:</span>
                  <span className="font-mono font-bold text-emerald-600">{attachingReceiptTx.amount.toLocaleString('en-US')} ETB</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Payment Recipient / Collector Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mr. Abebe (Supplier Agent) / Bank Title"
                  value={attachRecipientInput}
                  onChange={(e) => setAttachRecipientInput(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-gray-700 block">
                    Upload Receipt Voucher Proof (Optional)
                  </label>
                  {(attachFileUrl || attachingReceiptTx.receiptAttachment) && (
                    <button
                      type="button"
                      onClick={() => { setAttachFileUrl(''); setAttachFileName(''); }}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold"
                    >
                      Clear File
                    </button>
                  )}
                </div>

                {!(attachFileUrl || attachingReceiptTx.receiptAttachment) ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleReceiptFile(file, 'direct');
                    }}
                    onClick={() => attachFileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-lg p-3 text-center cursor-pointer bg-gray-50 hover:bg-emerald-50/40 transition group"
                  >
                    <input
                      ref={attachFileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleReceiptFile(file, 'direct');
                      }}
                    />
                    <Upload className="h-5 w-5 mx-auto text-gray-400 group-hover:text-emerald-600 mb-1 transition" />
                    <div className="text-[11px] font-semibold text-gray-700">Click to upload or drag &amp; drop</div>
                    <div className="text-[9px] text-gray-400">PNG, JPG, WEBP, or PDF (Max 5MB)</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-2 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                    {(attachFileUrl || attachingReceiptTx.receiptAttachment || '').startsWith('data:image/') ? (
                      <img
                        src={attachFileUrl || attachingReceiptTx.receiptAttachment}
                        alt="Receipt preview"
                        referrerPolicy="no-referrer"
                        className="h-10 w-10 object-cover rounded border border-emerald-300"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-xs">
                        PDF
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-emerald-900 truncate">
                        {attachFileName || attachingReceiptTx.receiptFileName || 'receipt_file'}
                      </div>
                      <div className="text-[9px] text-emerald-700 font-medium">Attached proof</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setAttachFileUrl(''); setAttachFileName(''); }}
                      className="p-1 text-gray-400 hover:text-rose-600 rounded"
                      title="Remove file"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setAttachingReceiptTx(null)}
                  className="bg-white border py-2 px-3 rounded text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReceipt}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                  {savingReceipt ? 'Saving...' : 'Save Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD SUPPLIER CREDIT (BILL) MODAL */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-150 text-xs">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-3 mb-4">Log Supplier Invoice (Credit Debt)</h3>
            <form onSubmit={handleCreateCredit} className="space-y-4">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Select Supplier</label>
                <select
                  value={creditForm.supplierId}
                  onChange={(e) => setCreditForm({ ...creditForm, supplierId: e.target.value })}
                  className="w-full bg-white border p-2 rounded outline-none"
                >
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-[10px] text-gray-700 block mb-1">Invoice Date</label>
                  <input
                    type="date"
                    required
                    value={creditForm.date}
                    onChange={(e) => setCreditForm({ ...creditForm, date: e.target.value })}
                    className="w-full bg-white border p-1.5 rounded outline-none font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[10px] text-gray-700 block mb-1">Payment Terms</label>
                  <select
                    value={creditForm.paymentTerms || 'Net 30'}
                    onChange={(e) => {
                      const terms = e.target.value;
                      let days = 30;
                      if (terms === 'Net 15') days = 15;
                      else if (terms === 'Net 45') days = 45;
                      else if (terms === 'Net 60') days = 60;
                      else if (terms === 'Immediate') days = 0;
                      
                      const computedDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      setCreditForm({
                        ...creditForm,
                        paymentTerms: terms,
                        dueDate: computedDate
                      });
                    }}
                    className="w-full bg-white border p-1.5 rounded outline-none text-[11px]"
                  >
                    <option value="Immediate">Immediate</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[10px] text-gray-700 block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={creditForm.dueDate}
                    onChange={(e) => setCreditForm({ ...creditForm, dueDate: e.target.value })}
                    className="w-full bg-white border p-1.5 rounded outline-none font-mono text-[11px]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Invoice Amount (ETB)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="e.g. 50000.75"
                    value={creditForm.amount || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(',', '.');
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setCreditForm({ ...creditForm, amount: val });
                      }
                    }}
                    className="w-full bg-white border p-2 rounded outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Bill / Invoice Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-0045"
                    value={creditForm.reference}
                    onChange={(e) => setCreditForm({ ...creditForm, reference: e.target.value })}
                    className="w-full bg-white border p-2 rounded outline-none font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Purchase Details &amp; Notes</label>
                <textarea
                  placeholder="e.g. Credit note for consignment cosmetics / drugs"
                  value={creditForm.notes}
                  onChange={(e) => setCreditForm({ ...creditForm, notes: e.target.value })}
                  className="w-full bg-white border p-2 rounded outline-none h-16 resize-none"
                />
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreditModal(false)} className="bg-white border py-2 px-4 rounded text-gray-700">Cancel</button>
                <button type="submit" className="bg-emerald-600 text-white font-bold py-2 px-5 rounded">
                  Log Credit Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart Inventory & Invoice OCR Scanner Modal */}
      <ScanItemsModal
        isOpen={showScanInvoiceModal}
        onClose={() => setShowScanInvoiceModal(false)}
        currentUser={currentUser}
        branches={branches}
        activeBranchId={activeBranchId}
        suppliers={suppliers}
        initialMode="invoice"
        onImportComplete={() => {
          onDataChanged();
        }}
      />
    </div>
  );
}

// ==================== 3. CUSTOMER PORTFOLIOS & LOYALTY ====================
interface CustomerManagerPanelProps {
  currentUser: any;
  customers: Customer[];
  sales?: Sale[];
  onDataChanged: () => void;
}

export function CustomerManagerPanel({ currentUser, customers, sales = [], onDataChanged }: CustomerManagerPanelProps) {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'registered' | 'recent'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHistoryShopper, setSelectedHistoryShopper] = useState<any | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '', address: '', creditLimit: 5000 });
  const [submitting, setSubmitting] = useState(false);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust.name || !newCust.phone) {
      alert('Validation Error: Customer Name and Contact Phone are mandatory.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newCust, operatorId: currentUser?.id })
      });

      if (res.ok) {
        setShowModal(false);
        setNewCust({ name: '', phone: '', email: '', address: '', creditLimit: 5000 });
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Build compiled shoppers profile list combining registered customer profiles and sales history records
  const compiledShoppers = React.useMemo(() => {
    const map = new Map<string, any>();

    // Seed with registered customers
    customers.forEach(c => {
      map.set(c.id, {
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        loyaltyPoints: c.loyaltyPoints || 0,
        creditLimit: c.creditLimit || 5000,
        creditBalance: c.creditBalance || 0,
        tin: '',
        isRegistered: true,
        sales: [],
        totalSpent: 0,
        ordersCount: 0,
        lastPurchaseDate: '',
        lastPurchaseTime: '',
        lastInvoiceNumber: '',
        lastBranchName: ''
      });
    });

    // Process completed sales records
    sales.forEach(s => {
      if (s.status === 'Voided') return;

      let matchedId = s.customerId || '';
      if (!matchedId || !map.has(matchedId)) {
        if (s.customerName) {
          const cNameTrim = s.customerName.trim();
          const cNameLower = cNameTrim.toLowerCase();
          if (cNameLower && cNameLower !== 'walk-in' && cNameLower !== 'walk-in customer' && cNameLower !== 'cash customer') {
            const found = customers.find(c => c.name.trim().toLowerCase() === cNameLower || (c.id && c.id === s.customerId));
            if (found) {
              matchedId = found.id;
            } else {
              matchedId = `shopper_${cNameLower}`;
            }
          }
        }
      }

      if (matchedId) {
        if (!map.has(matchedId)) {
          map.set(matchedId, {
            id: matchedId,
            name: s.customerName || 'Named Shopper',
            phone: '',
            email: '',
            address: '',
            loyaltyPoints: 0,
            creditLimit: 0,
            creditBalance: 0,
            tin: s.customerTin || '',
            isRegistered: false,
            sales: [],
            totalSpent: 0,
            ordersCount: 0,
            lastPurchaseDate: '',
            lastPurchaseTime: '',
            lastInvoiceNumber: '',
            lastBranchName: ''
          });
        }

        const shopper = map.get(matchedId)!;
        shopper.sales.push(s);
        shopper.totalSpent += s.total || 0;
        shopper.ordersCount += 1;
        if (s.customerTin && !shopper.tin) {
          shopper.tin = s.customerTin;
        }

        const existingLast = `${shopper.lastPurchaseDate} ${shopper.lastPurchaseTime}`;
        const currentSaleTs = `${s.date || ''} ${s.time || ''}`;
        if (currentSaleTs >= existingLast) {
          shopper.lastPurchaseDate = s.date || '';
          shopper.lastPurchaseTime = s.time || '';
          shopper.lastInvoiceNumber = s.invoiceNumber || '';
          shopper.lastBranchName = s.branchName || '';
        }
      }
    });

    const list = Array.from(map.values());
    // Sort shoppers by most recent purchase date/time first, then by total spent
    list.sort((a, b) => {
      const dateA = `${a.lastPurchaseDate} ${a.lastPurchaseTime}`;
      const dateB = `${b.lastPurchaseDate} ${b.lastPurchaseTime}`;
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      return b.totalSpent - a.totalSpent;
    });

    return list;
  }, [customers, sales]);

  // Filtered shoppers for Recent & Frequent Shoppers tab
  const recentShoppersList = React.useMemo(() => {
    // Only shoppers who have at least 1 purchase
    const shoppersWithSales = compiledShoppers.filter(s => s.ordersCount > 0);
    if (!searchQuery.trim()) return shoppersWithSales;

    const q = searchQuery.toLowerCase().trim();
    return shoppersWithSales.filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q) ||
      s.tin.toLowerCase().includes(q) ||
      s.sales.some((sale: Sale) => sale.invoiceNumber.toLowerCase().includes(q) || sale.items.some(i => i.medicineName.toLowerCase().includes(q)))
    );
  }, [compiledShoppers, searchQuery]);

  // Filtered customers for Registered Profiles tab
  const registeredCustomersList = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
  }, [customers, searchQuery]);

  // Overall statistics for Recent Shoppers
  const totalRecentShoppersCount = compiledShoppers.filter(s => s.ordersCount > 0).length;
  const frequentShoppersCount = compiledShoppers.filter(s => s.ordersCount > 1).length;
  const totalShoppersSpentVolume = compiledShoppers.reduce((acc, s) => acc + s.totalSpent, 0);

  // History modal sales filtering
  const shopperHistorySales = React.useMemo(() => {
    if (!selectedHistoryShopper) return [];
    const salesList: Sale[] = [...selectedHistoryShopper.sales].sort((a, b) => {
      const dateA = `${a.date} ${a.time}`;
      const dateB = `${b.date} ${b.time}`;
      return dateB.localeCompare(dateA);
    });

    if (!historySearchTerm.trim()) return salesList;
    const q = historySearchTerm.toLowerCase().trim();
    return salesList.filter(s => 
      s.invoiceNumber.toLowerCase().includes(q) ||
      s.branchName?.toLowerCase().includes(q) ||
      s.cashierName?.toLowerCase().includes(q) ||
      s.paymentMethod?.toLowerCase().includes(q) ||
      s.items.some(i => i.medicineName.toLowerCase().includes(q))
    );
  }, [selectedHistoryShopper, historySearchTerm]);

  return (
    <div className="space-y-5">
      {/* Header & Main Navigation Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-150 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            Customer Portfolio &amp; Purchase History
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Revisit frequent shoppers, inspect detailed transaction receipts, and manage client credit limits.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button 
            onClick={() => setShowModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3.5 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Register Customer</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Bar Header */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="flex items-center p-1 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-semibold self-start">
          <button
            onClick={() => setActiveTab('recent')}
            className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'recent' 
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm font-bold' 
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
            }`}
          >
            <Receipt className="h-3.5 w-3.5 text-emerald-600" />
            <span>Recent &amp; Frequent Shoppers</span>
            <span className="ml-1 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px]">
              {totalRecentShoppersCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('registered')}
            className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'registered' 
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm font-bold' 
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-teal-600" />
            <span>Loyalty Profiles &amp; Ledger</span>
            <span className="ml-1 px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded-full text-[10px]">
              {customers.length}
            </span>
          </button>
        </div>

        {/* Global Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === 'recent' ? "Search customer name, phone, invoice..." : "Search name, phone, address..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none focus:border-emerald-500 dark:text-white"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: RECENT & FREQUENT SHOPPERS VIEW */}
      {activeTab === 'recent' && (
        <div className="space-y-4">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-gray-150 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Total Active Shoppers</span>
              <div className="text-lg font-black text-gray-900 dark:text-white font-mono mt-0.5">{totalRecentShoppersCount}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-gray-150 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Frequent Shoppers (&gt;1 order)</span>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{frequentShoppersCount}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-gray-150 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Total Customer Revenue</span>
              <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">
                {totalShoppersSpentVolume.toLocaleString()} <span className="text-xs font-normal text-gray-400">ETB</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-gray-150 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Avg Customer Value</span>
              <div className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                {totalRecentShoppersCount > 0 ? (totalShoppersSpentVolume / totalRecentShoppersCount).toFixed(0).toLocaleString() : '0'} <span className="text-xs font-normal text-gray-400">ETB</span>
              </div>
            </div>
          </div>

          {/* Table of Recent Customers */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-150 dark:border-slate-800 overflow-hidden text-xs shadow-xs">
            <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-between items-center">
              <h4 className="font-extrabold text-gray-800 dark:text-gray-200 text-xs">
                Recent Shoppers Log &amp; Transaction Activity
              </h4>
              <span className="text-[11px] text-gray-500 font-medium">
                Showing {recentShoppersList.length} shoppers
              </span>
            </div>

            {recentShoppersList.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="font-medium">No recent shopper activity found match your filters.</p>
                <p className="text-[11px] mt-1 text-gray-400">Sales recorded in POS or Online Store with customer names will automatically appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-gray-50/80 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 font-bold text-gray-700 dark:text-slate-300">
                    <tr>
                      <th className="p-3">Customer / Shopper Name</th>
                      <th className="p-3">Contact &amp; Identifiers</th>
                      <th className="p-3 text-center">Orders Count</th>
                      <th className="p-3 text-right">Total Lifetime Volume</th>
                      <th className="p-3">Last Purchase Date &amp; Invoice</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-600 dark:text-slate-300">
                    {recentShoppersList.map((shopper) => {
                      const isFrequent = shopper.ordersCount > 1;
                      return (
                        <tr key={shopper.id} className="hover:bg-gray-50/70 dark:hover:bg-slate-800/40 transition">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black flex items-center justify-center text-xs shrink-0">
                                {shopper.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-extrabold text-gray-900 dark:text-white block text-xs">
                                  {shopper.name}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {shopper.isRegistered ? (
                                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase">
                                      Loyal Member ({shopper.loyaltyPoints} PTS)
                                    </span>
                                  ) : isFrequent ? (
                                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase">
                                      Frequent Shopper
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded text-[9px] font-semibold">
                                      Recent Customer
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="p-3 font-mono text-[11px]">
                            <span className="block text-gray-800 dark:text-slate-200 font-medium">
                              {shopper.phone || 'No Phone Registered'}
                            </span>
                            {shopper.tin && (
                              <span className="block text-[10px] text-gray-400">
                                TIN: {shopper.tin}
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-center">
                            <span className="inline-flex items-center justify-center bg-gray-100 dark:bg-slate-800 font-mono font-bold text-gray-900 dark:text-white px-2.5 py-0.5 rounded-full text-xs">
                              {shopper.ordersCount} {shopper.ordersCount === 1 ? 'order' : 'orders'}
                            </span>
                          </td>

                          <td className="p-3 text-right">
                            <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400 text-xs block">
                              {shopper.totalSpent.toLocaleString()} ETB
                            </span>
                          </td>

                          <td className="p-3">
                            <span className="block font-medium text-gray-800 dark:text-slate-200 text-xs">
                              {shopper.lastPurchaseDate ? `${shopper.lastPurchaseDate} at ${shopper.lastPurchaseTime}` : 'N/A'}
                            </span>
                            {shopper.lastInvoiceNumber && (
                              <span className="block text-[10px] font-mono text-gray-400">
                                Invoice #{shopper.lastInvoiceNumber} ({shopper.lastBranchName || 'Main Store'})
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedHistoryShopper(shopper);
                                setHistorySearchTerm('');
                              }}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg font-bold text-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                              <span>View History</span>
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
        </div>
      )}

      {/* TAB 2: REGISTERED LOYALTY PROFILES & CREDIT LEDGER */}
      {activeTab === 'registered' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-150 dark:border-slate-800 overflow-x-auto text-xs scrollbar-thin shadow-xs">
          <table className="min-w-full text-left">
            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 font-semibold text-gray-700 dark:text-slate-200">
              <tr>
                <th className="p-3">Customer Name</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Address</th>
                <th className="p-3 text-center">Loyalty Balance</th>
                <th className="p-3">Credit Utilized / Limit</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-600 dark:text-slate-300">
              {registeredCustomersList.map((c) => {
                const utilizedPct = (c.creditBalance / c.creditLimit) * 100;
                // Find compiled shopper data if available
                const shopperData = compiledShoppers.find(s => s.id === c.id) || {
                  id: c.id,
                  name: c.name,
                  phone: c.phone,
                  email: c.email,
                  address: c.address,
                  loyaltyPoints: c.loyaltyPoints,
                  creditLimit: c.creditLimit,
                  creditBalance: c.creditBalance,
                  isRegistered: true,
                  sales: sales.filter(s => s.customerId === c.id || (s.customerName && s.customerName.trim().toLowerCase() === c.name.trim().toLowerCase())),
                  totalSpent: 0,
                  ordersCount: 0
                };

                return (
                  <tr key={c.id} className="hover:bg-gray-55 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-semibold text-gray-800 dark:text-white">{c.name}</td>
                    <td className="p-3">
                      <span className="block font-medium">{c.phone}</span>
                      <span className="block text-gray-450">{c.email || 'No email registered'}</span>
                    </td>
                    <td className="p-3">{c.address || 'N/A'}</td>
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-800 font-bold border border-yellow-100 px-2 py-0.5 rounded-full font-mono text-[11px]">
                        <Award className="h-3 w-3 text-yellow-600" />
                        {c.loyaltyPoints} PTS
                      </span>
                    </td>
                    <td className="p-3 space-y-1">
                      <span className="font-mono font-bold block text-gray-900 dark:text-white">
                        {c.creditBalance} <span className="text-[10px] text-gray-400 font-normal">utilized of</span> {c.creditLimit} <span className="text-[10px] text-gray-400 font-normal">limit</span>
                      </span>
                      <div className="w-full bg-gray-150 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full" style={{ width: `${Math.min(utilizedPct, 100)}%` }}></div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border ${
                        c.creditBalance >= c.creditLimit ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        {c.creditBalance >= c.creditLimit ? 'Limit Exceeded' : 'Active Ledger'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          setSelectedHistoryShopper(shopperData);
                          setHistorySearchTerm('');
                        }}
                        className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="View Purchase History"
                      >
                        <Receipt className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* DETAILED PURCHASE HISTORY MODAL */}
      {selectedHistoryShopper && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-gray-150 dark:border-slate-800 overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="p-4 bg-gray-50 dark:bg-slate-800 border-b border-gray-150 dark:border-slate-700 flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                    {selectedHistoryShopper.name}
                  </h3>
                  {selectedHistoryShopper.isRegistered && (
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">
                      Loyal Client
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-500 dark:text-slate-400 text-xs mt-1">
                  <span>📱 Phone: <strong className="text-gray-800 dark:text-white font-mono">{selectedHistoryShopper.phone || 'N/A'}</strong></span>
                  {selectedHistoryShopper.tin && <span>📄 TIN: <strong className="text-gray-800 dark:text-white font-mono">{selectedHistoryShopper.tin}</strong></span>}
                  <span>🏆 Points: <strong className="text-yellow-600 font-mono">{selectedHistoryShopper.loyaltyPoints} PTS</strong></span>
                </div>
              </div>

              <button
                onClick={() => setSelectedHistoryShopper(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Shopper Summary Stats Bar */}
            <div className="grid grid-cols-3 bg-emerald-50/50 dark:bg-slate-800/40 p-3 border-b border-gray-100 dark:border-slate-800 text-center font-mono">
              <div>
                <span className="text-[10px] text-gray-500 uppercase block font-sans">Total Orders Recorded</span>
                <span className="font-extrabold text-gray-900 dark:text-white text-sm">{selectedHistoryShopper.sales?.length || 0} Invoices</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase block font-sans">Total Customer Spend</span>
                <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                  {selectedHistoryShopper.totalSpent?.toLocaleString() || 0} ETB
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase block font-sans">Credit Ledger Balance</span>
                <span className="font-extrabold text-gray-900 dark:text-white text-sm">
                  {selectedHistoryShopper.creditBalance || 0} ETB
                </span>
              </div>
            </div>

            {/* Filter Search inside History */}
            <div className="p-3 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center gap-2">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter invoice #, medicine name, cashier..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
                />
              </div>

              <span className="text-[11px] text-gray-500">
                Found {shopperHistorySales.length} invoices
              </span>
            </div>

            {/* Transactions List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3 scrollbar-thin">
              {shopperHistorySales.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <Receipt className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No purchase transactions recorded for this shopper matching filter.</p>
                </div>
              ) : (
                shopperHistorySales.map((sale) => (
                  <div key={sale.id} className="border border-gray-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900 shadow-2xs space-y-2">
                    <div className="flex flex-wrap justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-2 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-gray-900 dark:text-white text-xs">
                          Invoice #{sale.invoiceNumber}
                        </span>
                        <span className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded">
                          {sale.paymentMethod}
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded">
                          {sale.status}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm block">
                          {sale.total.toLocaleString()} ETB
                        </span>
                        <span className="text-[10px] text-gray-400 block">
                          {sale.date} at {sale.time} ({sale.branchName || 'Main Store'})
                        </span>
                      </div>
                    </div>

                    {/* Sale Items Breakdown */}
                    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-2.5 space-y-1">
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase block mb-1">Purchased Items:</span>
                      <div className="divide-y divide-gray-100 dark:divide-slate-800">
                        {sale.items.map((item, idx) => (
                          <div key={idx} className="py-1 flex justify-between items-center text-xs">
                            <div>
                              <span className="font-semibold text-gray-800 dark:text-slate-200">{item.medicineName}</span>
                              <span className="text-gray-400 text-[10px] ml-2 font-mono">
                                x{item.quantity} @ {item.unitPrice} ETB
                              </span>
                            </div>
                            <span className="font-mono font-bold text-gray-700 dark:text-slate-300">
                              {item.total.toLocaleString()} ETB
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-gray-50 dark:bg-slate-800 border-t border-gray-150 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setSelectedHistoryShopper(null)}
                className="bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-white px-4 py-1.5 rounded-lg font-bold text-xs cursor-pointer hover:bg-gray-300 transition"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER CREATOR MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-150 dark:border-slate-800 text-xs">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b pb-3 mb-4">Register Customer Loyalty Profile</h3>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-slate-300 block">Full Customer Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Almaz Bekele"
                  value={newCust.name}
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                  className="w-full bg-white dark:bg-slate-800 border p-2 rounded outline-none dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-slate-300 block">Contact Phone (E.164)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +251-91-1000000"
                  value={newCust.phone}
                  onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                  className="w-full bg-white dark:bg-slate-800 border p-2 rounded outline-none dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 dark:text-slate-300 block">Email Address</label>
                  <input
                    type="email"
                    placeholder="name@gmail.com"
                    value={newCust.email}
                    onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                    className="w-full bg-white dark:bg-slate-800 border p-2 rounded outline-none dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 dark:text-slate-300 block">Credit Limit Cap (ETB)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={newCust.creditLimit}
                    onChange={(e) => {
                      const val = e.target.value.replace(',', '.');
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setNewCust({ ...newCust, creditLimit: val as any });
                      }
                    }}
                    className="w-full bg-white dark:bg-slate-800 border p-2 rounded outline-none font-mono dark:text-white"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-slate-300 block">Residential Address</label>
                <input
                  type="text"
                  value={newCust.address}
                  onChange={(e) => setNewCust({ ...newCust, address: e.target.value })}
                  className="w-full bg-white dark:bg-slate-800 border p-2 rounded outline-none dark:text-white"
                />
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="bg-white border py-2 px-4 rounded text-gray-700 font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-emerald-600 text-white font-bold py-2 px-5 rounded">
                  {submitting ? 'Registering...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== 4. FINANCIAL LEDGER & EXPENSES ====================
// ==================== 4. FINANCIAL LEDGER & EXPENSES ====================
interface FinancialManagerPanelProps {
  currentUser: any;
  branches: Branch[];
  expenses: Expense[];
  stockItems: StockItem[];
  purchaseOrders: PurchaseOrder[];
  onDataChanged: () => void;
  sales: Sale[];
  suppliers: Supplier[];
  medicines?: Medicine[];
  users?: User[];
}

export function FinancialManagerPanel({ 
  currentUser, branches, expenses, stockItems, purchaseOrders, onDataChanged, sales, suppliers, medicines = [], users = [] 
}: FinancialManagerPanelProps) {
  const [instName, setInstName] = useState('Sonan Pharmacy');

  useEffect(() => {
    const fetchInstName = async () => {
      try {
        const res = await fetch('/api/settings/institution');
        if (res.ok) {
          const data = await res.json();
          if (data && data.name) setInstName(data.name);
        }
      } catch (err) {
        console.error('Failed to fetch instName in FinancialManagerPanel:', err);
      }
    };
    fetchInstName();
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [branchId, setBranchId] = useState('b1');
  const [category, setCategory] = useState('Utilities');
  const [amount, setAmount] = useState<number | string>(1000);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Active branch selector inside financial report
  const [selectedBranchId, setSelectedBranchId] = useState<'all' | string>('all');

  // Advanced Reporting & Filtering States
  const [repDateType, setRepDateType] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'custom'>('all');
  const [repStartDate, setRepStartDate] = useState('');
  const [repEndDate, setRepEndDate] = useState('');
  const [repCategory, setRepCategory] = useState<'all' | 'medicine' | 'cosmetics' | string>('all');
  const [repUser, setRepUser] = useState<'all' | string>('all');
  const [repPaymentMethod, setRepPaymentMethod] = useState<'all' | string>('all');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Supplier purchases expanded view states
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  const [financialSubTab, setFinancialSubTab] = useState<'audit' | 'moneynet' | 'comparison'>('audit');
  const [supplierItemStateFilter, setSupplierItemStateFilter] = useState<'all' | 'active' | 'sold' | 'stockout' | 'expired' | 'overstocked'>('all');

  // Deep AI Audit state
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string>('');
  const [aiProgressMessage, setAiProgressMessage] = useState<string>('');

  const progressSteps = [
    "Crunching stock valuation at cost buying price...",
    "Isolating branch-specific ledger accounts...",
    "Compiling supplier invoice metrics and received order streams...",
    "Evaluating gross profit margins vs operational overhead...",
    "Querying Gemini Deep Reasoning engine for pharmacy audit...",
    "Formulating strategic pharmacy financial recommendations..."
  ];

  // Strict Branch matching helper to eliminate cross-branch leakages
  const checkEntityMatchesBranch = (item: any, targetBranchId: string) => {
    if (!targetBranchId || targetBranchId === 'all') return true;
    const targetStr = String(targetBranchId).trim().toLowerCase();
    const targetB = branches?.find(b => 
      String(b.id).trim().toLowerCase() === targetStr || 
      String(b.name).trim().toLowerCase() === targetStr || 
      (b.code && String(b.code).trim().toLowerCase() === targetStr)
    );

    const itemBId = item.branchId ? String(item.branchId).trim().toLowerCase() : '';
    const itemBName = item.branchName ? String(item.branchName).trim().toLowerCase() : '';

    if (itemBId || itemBName) {
      if (itemBId && (itemBId === targetStr || (targetB && (itemBId === String(targetB.id).trim().toLowerCase() || (targetB.code && itemBId === String(targetB.code).trim().toLowerCase()))))) {
        return true;
      }
      if (itemBName && (itemBName === targetStr || (targetB && (itemBName === String(targetB.name).trim().toLowerCase() || (targetB.code && itemBName === String(targetB.code).trim().toLowerCase()))))) {
        return true;
      }
      const belongsToOtherBranch = (branches || []).some(b => {
        const bId = String(b.id).trim().toLowerCase();
        const bName = String(b.name).trim().toLowerCase();
        const bCode = b.code ? String(b.code).trim().toLowerCase() : '';
        return itemBId === bId || (bCode && itemBId === bCode) || itemBName === bName || (bCode && itemBName === bCode);
      });
      if (belongsToOtherBranch) return false;
    }
    const primaryBranch = branches && branches.length > 0 ? branches[0] : null;
    if (primaryBranch) {
      const isTargetPrimary = targetB ? targetB.id === primaryBranch.id : (targetStr === String(primaryBranch.id).trim().toLowerCase() || targetStr === String(primaryBranch.name).trim().toLowerCase());
      return isTargetPrimary;
    }
    return false;
  };

  // Filters
  const filteredExpenses = expenses.filter(e => checkEntityMatchesBranch(e, selectedBranchId));
  const filteredSales = sales.filter(s => checkEntityMatchesBranch(s, selectedBranchId) && s.status !== 'Voided' && s.status !== 'Returned');
  const filteredStock = stockItems.filter(st => checkEntityMatchesBranch(st, selectedBranchId));
  const filteredPOs = purchaseOrders.filter(p => p.status === 'Received' && checkEntityMatchesBranch(p, selectedBranchId));

  // Calculations
  const totalOperatingExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const costOfGoodsPurchased = filteredPOs.reduce((acc, p) => acc + p.total, 0);
  
  // Real-time Capital Valuation of Stock in Hand (at cost buying price)
  const activeStockValue = filteredStock.reduce((acc, st) => acc + (st.buyingPrice * st.quantity), 0);
  const totalStockUnits = filteredStock.reduce((acc, st) => acc + st.quantity, 0);

  // Real-time Capital Valuation of Stock in Hand (at selling price / estimated total amount after sale)
  const totalEstimatedStockValueAfterSale = filteredStock.reduce((acc, st) => {
    const med = medicines.find(m => m.id === st.medicineId);
    const sellPrice = med?.price || ((st as any).sellingPrice && (st as any).sellingPrice > 0 ? (st as any).sellingPrice : st.buyingPrice * 1.3);
    return acc + (sellPrice * st.quantity);
  }, 0);

  // Real-time gross sales
  const grossSalesRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);

  // Real-time dynamic COGS calculation from Sales Items matching cost prices
  // If exact medicine buying price is unavailable, falls back to 70% of item unit price
  const calculatedCOGS = filteredSales.reduce((acc, sale) => {
    const saleCogs = sale.items.reduce((itemAcc, item) => {
      // Find corresponding medicine/item to resolve buying cost (from last added batch)
      const matchStock = [...stockItems].reverse().find(st => st.medicineId === item.medicineId);
      const costPrice = matchStock?.buyingPrice || (item.unitPrice * 0.7);
      return itemAcc + (item.quantity * costPrice);
    }, 0);
    return acc + saleCogs;
  }, 0);

  const grossProfit = Math.max(0, grossSalesRevenue - calculatedCOGS);
  const netProfit = grossProfit - totalOperatingExpenses;
  const netMarginPercent = grossSalesRevenue > 0 ? (netProfit / grossSalesRevenue) * 100 : 0;

  // Dynamic categories list from medicines for filtering
  const uniqueCategories = Array.from(new Set(medicines.map(m => m.category))).filter(Boolean);

  // Filtered Stock Valuation Metrics (Capital at Cost, Capital after Sale, Total Stock Units)
  const filteredStockValuation = stockItems.filter(st => {
    // Branch Filter
    if (selectedBranchId !== 'all' && !checkEntityMatchesBranch(st, selectedBranchId)) return false;
    
    // Find Medicine details
    const med = medicines.find(m => m.id === st.medicineId);
    if (!med) return false;

    // Category Filter (medicine/cosmetics/individual categories)
    if (repCategory !== 'all') {
      const isCosmetics = med.productType === 'cosmetics' || med.category?.toLowerCase() === 'cosmetics' || med.category?.toLowerCase().includes('cosmetic');
      if (repCategory === 'medicine') {
        if (isCosmetics) return false;
      } else if (repCategory === 'cosmetics') {
        if (!isCosmetics) return false;
      } else {
        if (med.category !== repCategory) return false;
      }
    }
    return true;
  });

  const repTotalStockUnits = filteredStockValuation.reduce((sum, st) => sum + st.quantity, 0);
  const repCapitalAtCost = filteredStockValuation.reduce((sum, st) => sum + (st.buyingPrice * st.quantity), 0);
  const repCapitalAfterSale = filteredStockValuation.reduce((sum, st) => {
    const med = medicines.find(m => m.id === st.medicineId);
    const sellPrice = med?.price || st.buyingPrice * 1.3;
    return sum + (sellPrice * st.quantity);
  }, 0);

  // Filtered Sales Transactions (Daily, Custom Range, Weekly, Monthly sales & profits)
  const filteredSalesTransactions = sales.map(s => {
    // Exclude voided or returned transactions from revenue & profit reports
    if (s.status === 'Voided' || s.status === 'Returned') return null;

    // Branch Filter
    if (selectedBranchId !== 'all' && !checkEntityMatchesBranch(s, selectedBranchId)) return null;

    // Date Filtering
    const saleDate = new Date(s.date);
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (repDateType === 'today') {
      if (s.date !== todayStr) return null;
    } else if (repDateType === 'weekly') {
      // Past 7 days
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - 7);
      const sDate = new Date(s.date);
      if (sDate < limitDate) return null;
    } else if (repDateType === 'monthly') {
      // Past 30 days
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - 30);
      const sDate = new Date(s.date);
      if (sDate < limitDate) return null;
    } else if (repDateType === 'custom') {
      if (repStartDate && s.date < repStartDate) return null;
      if (repEndDate && s.date > repEndDate) return null;
    }

    // User Filter without mixing across branches
    if (repUser !== 'all') {
      const selectedUserObj = users.find(u => u.id === repUser);
      const isDirectCashierId = s.cashierId && String(s.cashierId).trim() === String(repUser).trim();
      const isNameMatch = selectedUserObj && 
        s.cashierName && 
        s.cashierName.trim().toLowerCase() === selectedUserObj.name.trim().toLowerCase();

      if (!isDirectCashierId && !isNameMatch) return null;
      
      // If the selected user belongs to a specific branch, never mix other branch sales
      if (selectedUserObj && selectedUserObj.branchId && selectedUserObj.branchId !== 'all') {
        if (!checkEntityMatchesBranch(s, selectedUserObj.branchId)) return null;
      }
    }

    // Payment Method Filter & Prorating calculation
    let paymentRatio = 1;
    if (repPaymentMethod !== 'all') {
      const pm = (s.paymentMethod || '').toLowerCase();
      let matched = false;

      if (repPaymentMethod === 'Cash') {
        matched = pm === 'cash' || (s.paymentMethod === 'Split' && !!s.splitDetails?.cash);
        if (s.paymentMethod === 'Split' && s.total > 0) {
          paymentRatio = (s.splitDetails?.cash || 0) / s.total;
        }
      } else if (repPaymentMethod === 'Bank') {
        matched = pm.includes('bank') || pm.includes('cbe') || pm.includes('boa') || pm.includes('awash') || pm.includes('dashen') ||
          (s.paymentMethod === 'Split' && (!!s.splitDetails?.cbe || !!s.splitDetails?.boa || !!s.splitDetails?.awash || !!s.splitDetails?.dashen || !!s.splitDetails?.other));
        if (s.paymentMethod === 'Split' && s.total > 0) {
          const bankSum = (s.splitDetails?.cbe || 0) + (s.splitDetails?.boa || 0) + (s.splitDetails?.awash || 0) + (s.splitDetails?.dashen || 0) + (s.splitDetails?.other || 0);
          paymentRatio = bankSum / s.total;
        }
      } else if (repPaymentMethod === 'Bank CBE') {
        matched = pm.includes('cbe') || (s.paymentMethod === 'Split' && !!s.splitDetails?.cbe);
        if (s.paymentMethod === 'Split' && s.total > 0) {
          paymentRatio = (s.splitDetails?.cbe || 0) / s.total;
        }
      } else if (repPaymentMethod === 'Bank BOA') {
        matched = pm.includes('boa') || (s.paymentMethod === 'Split' && !!s.splitDetails?.boa);
        if (s.paymentMethod === 'Split' && s.total > 0) {
          paymentRatio = (s.splitDetails?.boa || 0) / s.total;
        }
      } else if (repPaymentMethod === 'Bank AWASH') {
        matched = pm.includes('awash') || (s.paymentMethod === 'Split' && !!s.splitDetails?.awash);
        if (s.paymentMethod === 'Split' && s.total > 0) {
          paymentRatio = (s.splitDetails?.awash || 0) / s.total;
        }
      } else if (repPaymentMethod === 'Bank DASHEN') {
        matched = pm.includes('dashen') || (s.paymentMethod === 'Split' && !!s.splitDetails?.dashen);
        if (s.paymentMethod === 'Split' && s.total > 0) {
          paymentRatio = (s.splitDetails?.dashen || 0) / s.total;
        }
      } else if (repPaymentMethod === 'Telebirr') {
        matched = pm.includes('telebirr') || (s.paymentMethod === 'Split' && (!!s.splitDetails?.telebirr || !!s.splitDetails?.mobile));
        if (s.paymentMethod === 'Split' && s.total > 0) {
          paymentRatio = ((s.splitDetails?.telebirr || s.splitDetails?.mobile) || 0) / s.total;
        }
      } else if (repPaymentMethod === 'Credit') {
        matched = pm === 'credit' || (s.paymentMethod === 'Split' && !!s.splitDetails?.credit);
        if (s.paymentMethod === 'Split' && s.total > 0) {
          paymentRatio = (s.splitDetails?.credit || 0) / s.total;
        }
      } else if (repPaymentMethod === 'Card') {
        matched = pm === 'card' || (s.paymentMethod === 'Split' && !!s.splitDetails?.card);
        if (s.paymentMethod === 'Split' && s.total > 0) {
          paymentRatio = (s.splitDetails?.card || 0) / s.total;
        }
      } else if (repPaymentMethod === 'Other') {
        matched = pm === 'other' || 
          (s.paymentMethod === 'Split' && !!s.splitDetails?.other) ||
          (pm.startsWith('bank:') && !pm.includes('cbe') && !pm.includes('boa') && !pm.includes('awash') && !pm.includes('dashen'));
        if (s.paymentMethod === 'Split' && s.total > 0) {
          paymentRatio = (s.splitDetails?.other || 0) / s.total;
        }
      } else {
        matched = s.paymentMethod === repPaymentMethod || pm.includes(repPaymentMethod.toLowerCase());
      }
      if (!matched) return null;
    }

    // Category Filter: if category filter is enabled, check if the sale has items matching the category
    let matchingItems = s.items;
    if (repCategory !== 'all') {
      matchingItems = s.items.filter(item => {
        const med = medicines.find(m => m.id === item.medicineId);
        if (!med) return false;
        const isCosmetic = med.productType === 'cosmetics' || med.category?.toLowerCase() === 'cosmetics' || med.category?.toLowerCase().includes('cosmetic');
        if (repCategory === 'medicine') {
          return !isCosmetic;
        } else if (repCategory === 'cosmetics') {
          return isCosmetic;
        } else {
          return med.category === repCategory;
        }
      });
      if (matchingItems.length === 0) return null;
    }

    // Calculate prorated total for matching items
    const originalSubtotal = s.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const matchingSubtotal = matchingItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const ratio = originalSubtotal > 0 ? (matchingSubtotal / originalSubtotal) : 1;
    const proratedTotal = s.total * ratio * paymentRatio;

    return {
      ...s,
      items: matchingItems,
      total: Number(proratedTotal.toFixed(2))
    };
  }).filter(Boolean) as Sale[];

  // Calculate filtered sales statistics
  const repTotalSalesAmount = filteredSalesTransactions.reduce((sum, s) => sum + s.total, 0);
  const repTotalSalesCogs = filteredSalesTransactions.reduce((sum, s) => {
    const saleCogs = s.items.reduce((itemSum, item) => {
      const matchStock = stockItems.find(st => st.medicineId === item.medicineId);
      const costPrice = matchStock?.buyingPrice || (item.unitPrice * 0.7);
      return itemSum + (item.quantity * costPrice);
    }, 0);
    return sum + saleCogs;
  }, 0);
  const repTotalProfit = Math.max(0, repTotalSalesAmount - repTotalSalesCogs);

  // Supplier purchase analyzer - what we buy from each supplier with item details (taking items from product/stockItems)
  const supplierBreakdown = suppliers.map(sup => {
    const items = filteredStock.filter(st => st.supplierId === sup.id);
    const totalSpent = items.reduce((sum, st) => {
      const qty = st.originalQuantity !== undefined ? st.originalQuantity : st.quantity;
      return sum + (st.buyingPrice * qty);
    }, 0);

    // Aggregate bought item details
    const itemDetailsMap: { [medId: string]: { name: string; qty: number; totalCost: number; avgCost: number } } = {};
    items.forEach(st => {
      const med = medicines.find(m => m.id === st.medicineId);
      const name = med?.name || 'Unknown Medicine';
      const id = st.medicineId;
      const qty = st.originalQuantity !== undefined ? st.originalQuantity : st.quantity;
      if (!itemDetailsMap[id]) {
        itemDetailsMap[id] = { name, qty: 0, totalCost: 0, avgCost: 0 };
      }
      itemDetailsMap[id].qty += qty;
      itemDetailsMap[id].totalCost += qty * st.buyingPrice;
    });

    // Calculate averages
    const aggregatedItems = Object.values(itemDetailsMap).map(item => ({
      ...item,
      avgCost: item.qty > 0 ? Number((item.totalCost / item.qty).toFixed(2)) : 0
    })).sort((a, b) => b.totalCost - a.totalCost);

    // Create a mock order-like list for UI expansion (if any expansion is clicked)
    const mockOrders = items.map(st => {
      const med = medicines.find(m => m.id === st.medicineId);
      const qty = st.originalQuantity !== undefined ? st.originalQuantity : st.quantity;
      const dStr = st.createdAt?.split('T')[0] || 'N/A';
      return {
        id: st.id,
        poNumber: `GRN-${st.batchNumber || st.id.slice(0, 5).toUpperCase()}`,
        date: dStr,
        receivedDate: dStr,
        total: qty * st.buyingPrice,
        receivedBy: 'Store Keeper',
        items: [{
          medicineId: st.medicineId,
          medicineName: med?.name || 'Unknown Medicine',
          quantity: qty,
          unitPrice: st.buyingPrice,
          total: qty * st.buyingPrice
        }]
      };
    });

    return {
      supplier: sup,
      totalSpent,
      poCount: items.length, // count of product batches supplied
      orders: mockOrders,
      aggregatedItems
    };
  }).filter(item => item.totalSpent > 0).sort((a, b) => b.totalSpent - a.totalSpent);

  // Expiry Risk and Money Net Stock Profiling computations
  const today = new Date();
  const ninetyDaysAhead = new Date(); ninetyDaysAhead.setDate(today.getDate() + 90);
  const oneEightyDaysAhead = new Date(); oneEightyDaysAhead.setDate(today.getDate() + 180);

  let highRiskQty = 0;
  let highRiskValue = 0;
  let medRiskQty = 0;
  let medRiskValue = 0;
  let safeQty = 0;
  let safeValue = 0;

  const highRiskItemsList: { medName: string; expiryDate: string; qty: number; value: number; branchName: string }[] = [];

  filteredStockValuation.forEach(st => {
    const med = medicines.find(m => m.id === st.medicineId);
    const medName = med ? med.name : 'Unknown Item';
    const cost = st.buyingPrice * st.quantity;
    
    if (!st.expiryDate) {
      safeQty += st.quantity;
      safeValue += cost;
      return;
    }

    const expDate = new Date(st.expiryDate);
    const todayStr = today.toISOString().split('T')[0];
    
    // Check if expired or within 90 days
    if (st.expiryDate <= todayStr || expDate <= ninetyDaysAhead) {
      highRiskQty += st.quantity;
      highRiskValue += cost;
      if (highRiskItemsList.length < 8) {
        const br = branches.find(b => b.id === st.branchId);
        highRiskItemsList.push({
          medName,
          expiryDate: st.expiryDate,
          qty: st.quantity,
          value: cost,
          branchName: br ? br.name : st.branchId
        });
      }
    } else if (expDate <= oneEightyDaysAhead) {
      medRiskQty += st.quantity;
      medRiskValue += cost;
    } else {
      safeQty += st.quantity;
      safeValue += cost;
    }
  });

  highRiskItemsList.sort((a, b) => b.value - a.value);

  // Compute Supplier Comparison statistics
  const supplierComparisonsList = suppliers.map(sup => {
    let items = filteredStock.filter(st => st.supplierId === sup.id);
    
    if (supplierItemStateFilter !== 'all') {
      const todayStr = new Date().toISOString().split('T')[0];
      items = items.filter(st => {
        const med = medicines.find(m => m.id === st.medicineId);
        const isExpired = st.expiryDate && st.expiryDate <= todayStr;
        
        switch (supplierItemStateFilter) {
          case 'active':
            return st.quantity > 0 && !isExpired;
          case 'sold': {
            const qtySold = (st.originalQuantity !== undefined ? st.originalQuantity : st.quantity) - st.quantity;
            if (qtySold > 0) return true;
            return sales.some(s => s.items.some(it => it.medicineId === st.medicineId && (it.batchNumber || '').trim().toLowerCase() === (st.batchNumber || '').trim().toLowerCase()));
          }
          case 'stockout':
            return st.quantity === 0;
          case 'expired':
            return !!isExpired;
          case 'overstocked': {
            const minLvl = med?.minStockLevel ?? 10;
            return st.quantity > 3 * minLvl;
          }
          default:
            return true;
        }
      });
    }
    
    let totalVolume = 0;
    const uniqueItemIds = new Set<string>();
    const itemVolumeMap: { [name: string]: number } = {};
    const itemCostMap: { [name: string]: { min: number; max: number; count: number; sum: number } } = {};
    let totalSpent = 0;

    items.forEach(st => {
      const med = medicines.find(m => m.id === st.medicineId);
      const name = med?.name || 'Unknown Medicine';
      const qty = st.originalQuantity !== undefined ? st.originalQuantity : st.quantity;
      const price = st.buyingPrice;
      
      totalSpent += qty * price;
      totalVolume += qty;
      uniqueItemIds.add(st.medicineId);
      
      itemVolumeMap[name] = (itemVolumeMap[name] || 0) + qty;
      
      if (!itemCostMap[name]) {
        itemCostMap[name] = { min: price, max: price, count: 1, sum: price };
      } else {
        const stats = itemCostMap[name];
        stats.min = Math.min(stats.min, price);
        stats.max = Math.max(stats.max, price);
        stats.count += 1;
        stats.sum += price;
      }
    });

    const uniqueItemsCount = uniqueItemIds.size;
    const avgCostPerUnit = totalVolume > 0 ? Number((totalSpent / totalVolume).toFixed(2)) : 0;

    // Find the single highest volume item supplied
    let topVolumeItem = 'N/A';
    let topVolumeItemQty = 0;
    Object.entries(itemVolumeMap).forEach(([name, qty]) => {
      if (qty > topVolumeItemQty) {
        topVolumeItemQty = qty;
        topVolumeItem = name;
      }
    });

    const itemsBoughtMap: { [name: string]: { quantity: number; totalPrice: number } } = {};
    items.forEach(st => {
      const med = medicines.find(m => m.id === st.medicineId);
      const name = med?.name || 'Unknown Medicine';
      const qty = st.originalQuantity !== undefined ? st.originalQuantity : st.quantity;
      const price = st.buyingPrice;
      if (!itemsBoughtMap[name]) {
        itemsBoughtMap[name] = { quantity: 0, totalPrice: 0 };
      }
      itemsBoughtMap[name].quantity += qty;
      itemsBoughtMap[name].totalPrice += qty * price;
    });

    const itemsBoughtList = Object.entries(itemsBoughtMap).map(([name, data]) => ({
      name,
      quantity: data.quantity,
      avgPrice: data.quantity > 0 ? Number((data.totalPrice / data.quantity).toFixed(2)) : 0,
      totalCost: data.totalPrice
    })).sort((a, b) => b.quantity - a.quantity);

    return {
      supplier: sup,
      poCount: items.length, // represents total supply batches in stockItems
      totalSpent,
      totalVolume,
      uniqueItemsCount,
      avgCostPerUnit,
      topVolumeItem,
      topVolumeItemQty,
      itemsBoughtList
    };
  }).sort((a, b) => b.totalSpent - a.totalSpent);

  // Find products supplied by more than one supplier to show price comparison
  const productSuppliersMap: { [prodName: string]: { supplierName: string; unitPrice: number; poDate: string }[] } = {};
  
  let matrixStock = filteredStock;
  if (supplierItemStateFilter !== 'all') {
    const todayStr = new Date().toISOString().split('T')[0];
    matrixStock = filteredStock.filter(st => {
      const med = medicines.find(m => m.id === st.medicineId);
      const isExpired = st.expiryDate && st.expiryDate <= todayStr;
      
      switch (supplierItemStateFilter) {
        case 'active':
          return st.quantity > 0 && !isExpired;
        case 'sold': {
          const qtySold = (st.originalQuantity !== undefined ? st.originalQuantity : st.quantity) - st.quantity;
          if (qtySold > 0) return true;
          return sales.some(s => s.items.some(it => it.medicineId === st.medicineId && (it.batchNumber || '').trim().toLowerCase() === (st.batchNumber || '').trim().toLowerCase()));
        }
        case 'stockout':
          return st.quantity === 0;
        case 'expired':
          return !!isExpired;
        case 'overstocked': {
          const minLvl = med?.minStockLevel ?? 10;
          return st.quantity > 3 * minLvl;
        }
        default:
          return true;
      }
    });
  }

  matrixStock.forEach(st => {
    const med = medicines.find(m => m.id === st.medicineId);
    if (!med) return;
    const sup = suppliers.find(s => s.id === st.supplierId);
    const supplierName = sup ? sup.name : 'Unknown';
    if (!productSuppliersMap[med.name]) {
      productSuppliersMap[med.name] = [];
    }
    const exists = productSuppliersMap[med.name].some(record => record.supplierName === supplierName);
    if (!exists) {
      productSuppliersMap[med.name].push({
        supplierName,
        unitPrice: st.buyingPrice,
        poDate: st.createdAt?.split('T')[0] || 'N/A'
      });
    }
  });

  const comparativeProducts = Object.entries(productSuppliersMap)
    .filter(([_, records]) => records.length >= 2)
    .map(([prodName, records]) => ({
      productName: prodName,
      records: records.sort((a, b) => a.unitPrice - b.unitPrice)
    }));

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const expAmount = parseFloat(String(amount)) || 0;
    if (!description || expAmount <= 0) {
      alert('Validation Error: Expense description and a valid positive amount is required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/finances/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          category,
          amount: expAmount,
          description,
          operatorId: currentUser?.id
        })
      });

      if (res.ok) {
        setShowModal(false);
        setAmount(1000);
        setDescription('');
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Advanced Gemini Deep AI Audit Trigger
  const runAiFinancialAudit = async () => {
    try {
      setLoadingAi(true);
      setAiError('');
      setAiAnalysisResult('');

      // Dynamic message updates
      let stepIdx = 0;
      setAiProgressMessage(progressSteps[0]);
      const timer = setInterval(() => {
        stepIdx = (stepIdx + 1) % progressSteps.length;
        setAiProgressMessage(progressSteps[stepIdx]);
      }, 1800);

      const res = await fetch('/api/finances/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: selectedBranchId })
      });

      clearInterval(timer);

      if (res.ok) {
        const data = await res.json();
        setAiAnalysisResult(data.analysis || 'Analysis processed successfully.');
      } else {
        const err = await res.json();
        setAiError(err.error || 'Failed to complete AI Audit.');
      }
    } catch (err: any) {
      setAiError(err.message || 'Network communication failure during AI analysis.');
    } finally {
      setLoadingAi(false);
    }
  };

  // Custom regex markdown parser for beautiful structured display cards
  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-3.5 text-xs text-gray-800 leading-relaxed font-sans">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} className="text-xs font-extrabold text-gray-900 mt-5 border-b pb-1.5 uppercase tracking-wider flex items-center gap-1">
                <span>📁</span> {trimmed.slice(4)}
              </h4>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={idx} className="text-sm font-extrabold text-emerald-950 mt-6 border-l-4 border-emerald-600 pl-2.5 flex items-center gap-1 bg-emerald-50/40 py-1">
                <span>🌟</span> {trimmed.slice(3)}
              </h3>
            );
          }
          if (trimmed.startsWith('# ')) {
            return (
              <h2 key={idx} className="text-base font-black text-emerald-900 mt-7 flex items-center gap-2 border-b-2 border-emerald-100 pb-2">
                <span>🛡️</span> {trimmed.slice(2)}
              </h2>
            );
          }
          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const bulletText = trimmed.slice(2);
            return (
              <div key={idx} className="flex items-start gap-2 pl-4">
                <span className="text-emerald-500 shrink-0 mt-1">●</span>
                <span className="text-gray-700">{parseMarkdownInline(bulletText)}</span>
              </div>
            );
          }
          if (trimmed === '---') {
            return <hr key={idx} className="my-5 border-gray-150" />;
          }
          if (trimmed === '') {
            return <div key={idx} className="h-1.5" />;
          }
          return <p key={idx} className="pl-1 text-gray-650">{parseMarkdownInline(trimmed)}</p>;
        })}
      </div>
    );
  };

  const parseMarkdownInline = (text: string) => {
    const parts = text.split('**');
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} className="font-bold text-gray-950 bg-yellow-50 px-0.5">{part}</strong>;
      }
      return part;
    });
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Comprehensive Financial Report - " + (selectedBranchId === 'all' ? "Consolidated" : "Selected Branch") + "\n";
    csvContent += "Generated On: " + new Date().toLocaleString() + "\n";
    csvContent += "Filters: DateRange=" + repDateType + ", Category=" + repCategory + ", User=" + repUser + ", PaymentMethod=" + repPaymentMethod + "\n\n";
    
    // Summary values
    csvContent += "SUMMARY STATS\n";
    csvContent += "Total Stock Units," + repTotalStockUnits + "\n";
    csvContent += "Capital at Cost (ETB)," + repCapitalAtCost + "\n";
    csvContent += "Capital after Sale (ETB)," + repCapitalAfterSale + "\n";
    csvContent += "Filtered Sales (ETB)," + repTotalSalesAmount + "\n";
    csvContent += "Net Margin Profit (ETB)," + repTotalProfit + "\n\n";
    
    // Details
    csvContent += "DETAILED TRANSACTIONS LIST\n";
    csvContent += "Invoice Number,Date,Time,Cashier,Customer,Payment Method,Items Count,Total Amount (ETB)\n";
    
    filteredSalesTransactions.forEach(s => {
      const row = [
        s.invoiceNumber,
        s.date,
        s.time,
        '"' + s.cashierName + '"',
        '"' + (s.customerName || 'Walk-in Customer') + '"',
        s.paymentMethod,
        s.items.length,
        s.total
      ];
      csvContent += row.join(",") + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${instName.replace(/\s+/g, '_')}_Financial_Report_` + new Date().toISOString().split('T')[0] + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Branch context isolation selector */}
      <div className="bg-white rounded-xl border border-gray-150 p-4 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="space-y-0.5 text-left">
          <h3 className="text-sm font-sans font-extrabold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
            <span className="p-1 bg-emerald-50 rounded text-emerald-600">📊</span>
            Pharmacy Ledger Financial Reports
          </h3>
          <p className="text-[10px] text-gray-400 font-medium">Isolate ledger calculations by individual branches or view consolidated accounts.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700">Financial Focus:</span>
          <select
            id="finances-branch-filter"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="bg-gray-50 border border-gray-250 rounded-lg p-2 text-xs font-bold text-gray-800 outline-none hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <option value="all">Consolidated (All Branches)</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Financial Overview stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-150 p-4 rounded-xl text-xs space-y-1 shadow-sm">
          <span className="text-gray-400 block font-semibold">Stock in hand capital cost</span>
          <span className="text-base font-extrabold text-emerald-800 block font-mono">
            {activeStockValue.toLocaleString('en-US')} ETB
          </span>
          <span className="text-[9px] text-gray-500 block font-medium">
            Calculated at cost buying price for {totalStockUnits.toLocaleString()} total stock units.
          </span>
        </div>

        <div className="bg-white border border-gray-150 p-4 rounded-xl text-xs space-y-1 shadow-sm border-l-4 border-l-indigo-600">
          <span className="text-gray-500 block font-bold">Total Estim. Amount After Sale</span>
          <span className="text-base font-extrabold text-indigo-700 block font-mono">
            {totalEstimatedStockValueAfterSale.toLocaleString('en-US')} ETB
          </span>
          <span className="text-[9px] text-indigo-600 block font-medium">
            Estimated total revenue if all {totalStockUnits.toLocaleString()} stock units are sold.
          </span>
        </div>
        
        <div className="bg-white border border-gray-150 p-4 rounded-xl text-xs space-y-1 shadow-sm">
          <span className="text-gray-400 block font-semibold">Total Gross Sales Revenue</span>
          <span className="text-base font-extrabold text-gray-900 block font-mono">
            {grossSalesRevenue.toLocaleString('en-US')} ETB
          </span>
          <span className="text-[9px] text-gray-500 block font-medium">
            Accumulated invoice checkout amounts. ({filteredSales.length} sales)
          </span>
        </div>

        <div className="bg-white border border-gray-150 p-4 rounded-xl text-xs space-y-1 shadow-sm">
          <span className="text-gray-400 block font-semibold">Procurement PO Investment</span>
          <span className="text-base font-extrabold text-indigo-700 block font-mono">
            {costOfGoodsPurchased.toLocaleString('en-US')} ETB
          </span>
          <span className="text-[9px] text-gray-500 block font-medium">
            Received inventories from suppliers.
          </span>
        </div>

        <div className="bg-white border border-gray-150 p-4 rounded-xl text-xs space-y-1 shadow-sm">
          <span className="text-gray-400 block font-semibold">Operational Overhead (Expenses)</span>
          <span className="text-base font-extrabold text-red-600 block font-mono">
            {totalOperatingExpenses.toLocaleString('en-US')} ETB
          </span>
          <span className="text-[9px] text-gray-500 block font-medium">
            Overhead expenditures logged for {selectedBranchId === 'all' ? 'all' : 'selected'} branch.
          </span>
        </div>
      </div>

      {/* Dynamic Report Sub-Tab Navigation Bar */}
      <div className="flex border-b border-gray-200 dark:border-slate-800 pb-px gap-2">
        <button
          type="button"
          onClick={() => setFinancialSubTab('audit')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            financialSubTab === 'audit'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          📊 Expenses & Supplier Audits
        </button>
        <button
          type="button"
          onClick={() => setFinancialSubTab('moneynet')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            financialSubTab === 'moneynet'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          💰 Money Net & Expiry Risk Assessment
        </button>
        <button
          type="button"
          onClick={() => setFinancialSubTab('comparison')}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            financialSubTab === 'comparison'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          ⚔️ Supplier Comparison Matrix
        </button>
      </div>

      {financialSubTab === 'audit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left / Column 1: Expenses table & Supplier Purchases (What we bought from each) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Supplier Procurement Table: What we buy from each supplier */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="space-y-0.5 text-left">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🏢</span> Supplier Purchase Audits
                </h4>
                <p className="text-[10px] text-gray-400 font-medium">See precisely what goods and values are purchased from each supplier.</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-150 overflow-hidden text-xs shadow-sm">
              <table className="min-w-full text-left divide-y divide-gray-100">
                <thead className="bg-gray-50 font-bold text-gray-700 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Supplier Name</th>
                    <th className="p-3">Received POs Count</th>
                    <th className="p-3 text-right">Procured Value (ETB)</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 text-gray-650">
                  {supplierBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-400 italic">
                        No purchase orders completed for this branch filter.
                      </td>
                    </tr>
                  ) : (
                    supplierBreakdown.map(({ supplier, totalSpent, poCount, orders, aggregatedItems }) => {
                      const isExpanded = expandedSupplierId === supplier.id;
                      return (
                        <React.Fragment key={supplier.id}>
                          <tr className="hover:bg-gray-55 transition-colors">
                            <td className="p-3 font-semibold text-gray-900">
                              <div className="space-y-0.5">
                                <span className="block">{supplier.name}</span>
                                <span className="block text-[9px] text-gray-400 font-mono font-medium">{supplier.phone} | {supplier.email}</span>
                              </div>
                            </td>
                            <td className="p-3 font-semibold text-gray-700">{poCount} Orders</td>
                            <td className="p-3 text-right font-mono font-bold text-indigo-700">
                              {totalSpent.toLocaleString('en-US')} ETB
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => setExpandedSupplierId(isExpanded ? null : supplier.id)}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[9px] font-extrabold px-2 py-1 rounded transition-colors"
                              >
                                {isExpanded ? 'Hide Details' : 'View Purchases'}
                              </button>
                            </td>
                          </tr>
                          
                          {/* Expanded list of purchases */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={4} className="p-4 bg-indigo-55/35 dark:bg-slate-900/60">
                                <div className="space-y-4 border-l-2 border-indigo-500 pl-4 text-left">
                                  <div className="flex justify-between items-center">
                                    <h5 className="font-extrabold text-indigo-950 dark:text-indigo-300 uppercase tracking-wide text-xs flex items-center gap-1">
                                      <span>🏢</span> Purchases Summary: {supplier.name}
                                    </h5>
                                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 font-extrabold px-2.5 py-1 rounded">
                                      Total Spent: {totalSpent.toLocaleString('en-US')} ETB
                                    </span>
                                  </div>

                                  {/* Item Details: What was bought from each supplier */}
                                  <div className="bg-white dark:bg-slate-950 border border-indigo-150 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-sm">
                                    <span className="font-black text-gray-800 dark:text-slate-200 uppercase tracking-wider text-[10px] block border-b pb-1.5">
                                      🛍️ Itemized Purchases Details (Aggregate Totals)
                                    </span>
                                    <table className="w-full text-left border-collapse text-xs">
                                      <thead>
                                        <tr className="text-gray-400 dark:text-slate-400 text-[9px] uppercase border-b border-gray-100 dark:border-slate-850 pb-1">
                                          <th className="py-1">Drug/Item Name</th>
                                          <th className="py-1 text-center">Total Volume Bought</th>
                                          <th className="py-1 text-right">Avg Unit Cost (ETB)</th>
                                          <th className="py-1 text-right">Total Expenditure (ETB)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-slate-900 text-gray-650 dark:text-slate-300 font-medium">
                                        {aggregatedItems.map((item, index) => (
                                          <tr key={index} className="hover:bg-indigo-50/10 transition-colors">
                                            <td className="py-2 font-bold text-gray-900 dark:text-white">{item.name}</td>
                                            <td className="py-2 text-center font-mono font-bold text-gray-800 dark:text-slate-200">{item.qty.toLocaleString()} units</td>
                                            <td className="py-2 text-right font-mono text-gray-700 dark:text-slate-300">{item.avgCost.toLocaleString()} ETB</td>
                                            <td className="py-2 text-right font-mono font-black text-indigo-700 dark:text-indigo-400">{item.totalCost.toLocaleString()} ETB</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* Individual Orders List */}
                                  <div className="space-y-2">
                                    <span className="font-extrabold text-gray-700 dark:text-slate-300 uppercase tracking-wider text-[9px] block">
                                      📄 Individual Received Invoices ({orders.length})
                                    </span>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-96 overflow-y-auto pr-1">
                                      {orders.map(order => (
                                        <div key={order.id} className="bg-white dark:bg-slate-950 border border-gray-150 dark:border-slate-800 rounded-xl p-3 text-[10px] space-y-2 shadow-xs">
                                          <div className="flex justify-between items-center text-gray-800 dark:text-slate-200 font-semibold border-b pb-1">
                                            <span>Invoice No: <span className="font-mono text-gray-950 dark:text-white font-bold">{order.poNumber}</span></span>
                                            <span className="text-gray-400 font-mono font-medium">{order.receivedDate || order.date}</span>
                                          </div>
                                          
                                          {/* PO Items */}
                                          <table className="w-full text-left border-collapse text-[9px]">
                                            <thead>
                                              <tr className="text-gray-400 dark:text-slate-550 uppercase border-b border-gray-100 dark:border-slate-900 pb-1">
                                                <th className="py-1">Drug/Item Name</th>
                                                <th className="py-1 text-center">Qty</th>
                                                <th className="py-1 text-right">Unit Price</th>
                                                <th className="py-1 text-right">Total (ETB)</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-55 dark:divide-slate-900 text-gray-650 dark:text-slate-400 font-medium">
                                              {order.items.map((it, i) => (
                                                <tr key={i} className="hover:bg-gray-55/50">
                                                  <td className="py-1 font-bold text-gray-900 dark:text-slate-300">{it.medicineName}</td>
                                                  <td className="py-1 text-center font-mono font-semibold">{it.quantity}</td>
                                                  <td className="py-1 text-right font-mono">{it.unitPrice.toLocaleString()}</td>
                                                  <td className="py-1 text-right font-mono font-semibold text-gray-850 dark:text-slate-200">{it.total.toLocaleString()}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                          
                                          <div className="flex justify-between items-center pt-1 border-t dark:border-slate-900 font-bold text-indigo-950 dark:text-indigo-300 text-right">
                                            <span>PO Total:</span>
                                            <span className="font-mono font-black">{order.total.toLocaleString()} ETB</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operational Expenses table logs */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>💸</span> Operational Expense Logs
              </h4>
              <button
                onClick={() => setShowModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1 px-2.5 rounded shadow flex items-center gap-0.5 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Log Expense
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-150 overflow-hidden text-xs shadow-sm">
              <table className="min-w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100 font-semibold text-gray-700">
                  <tr>
                    <th className="p-2.5">Branch</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Ledger Description</th>
                    <th className="p-2.5 text-right font-mono">Amount (ETB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400 italic">No operating expenses logged under this branch focus.</td>
                    </tr>
                  ) : (
                    filteredExpenses.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-55">
                        <td className="p-2.5 font-semibold text-gray-800">{e.branchName}</td>
                        <td className="p-2.5 font-mono">{e.date}</td>
                        <td className="p-2.5">
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[9px] border">{e.category}</span>
                        </td>
                        <td className="p-2.5 text-gray-500 italic truncate max-w-[150px]" title={e.description}>
                          {e.description}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-red-600">
                          -{e.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right / Column 2: Live Profit analysis & Gemini AI deep audits */}
        <div className="lg:col-span-4 space-y-6 text-left">
          
          {/* Live Profit Analysis panel */}
          <div className="bg-white rounded-xl border border-gray-150 p-5 space-y-4 shadow-sm">
            <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider pb-2 border-b flex items-center gap-1.5">
              <span>📈</span> Live Profit &amp; Expense Margin Analysis
            </h4>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between text-gray-600 font-medium">
                <span>Gross Sales Revenue</span>
                <span className="font-mono text-gray-900 font-bold">{grossSalesRevenue.toLocaleString('en-US')} ETB</span>
              </div>
              <div className="flex justify-between text-gray-600 font-medium">
                <span>Less Cost of Goods Sold (COGS)</span>
                <span className="font-mono text-red-500 font-bold">-{calculatedCOGS.toLocaleString('en-US')} ETB</span>
              </div>
              
              <div className="border-t pt-2.5 flex justify-between text-gray-800 font-bold text-[11px]">
                <span>Gross Profit Margin</span>
                <span className="font-mono text-emerald-800">+{grossProfit.toLocaleString('en-US')} ETB</span>
              </div>

              <div className="flex justify-between text-gray-600 font-medium">
                <span>Less Operating Expenses</span>
                <span className="font-mono text-red-500 font-bold">-{totalOperatingExpenses.toLocaleString('en-US')} ETB</span>
              </div>

              <div className="border-t border-double pt-2.5 flex justify-between text-gray-950 font-black text-xs">
                <span>Net Estimated Profit</span>
                <span className={`font-mono ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString('en-US')} ETB
                </span>
              </div>

              <div className="flex justify-between text-gray-600 text-[10px] font-bold">
                <span>Net Profit Margin %</span>
                <span className={`font-mono px-1.5 rounded ${netProfit >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                  {netMarginPercent.toFixed(1)}%
                </span>
              </div>

              <div className="border-t border-dashed border-gray-200 pt-3.5 space-y-2">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Enterprise Health Score</span>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-full ${netMarginPercent > 20 ? 'bg-emerald-600' : netMarginPercent > 5 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, Math.max(0, netMarginPercent))}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed italic">
                  *COGS is calculated dynamically based on original receipt buying prices, ensuring complete alignment across branches.
                </p>
              </div>
            </div>
          </div>

          {/* Gemini AI Deep Financial Audit Panel */}
          <div className="bg-gradient-to-br from-emerald-950 to-slate-900 text-white rounded-xl p-5 space-y-4 shadow-xl border border-emerald-900">
            <div className="space-y-1">
              <span className="bg-emerald-500 text-white text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-full inline-block">
                Software by Sonan AI Engine
              </span>
              <h4 className="text-xs font-black text-emerald-300 uppercase tracking-widest flex items-center gap-1.5">
                <span>🔮</span> Advanced AI Financial Analysis Deep
              </h4>
              <p className="text-[10px] text-emerald-200/80 leading-relaxed">
                Unlock clinical profit recommendations, stock turn rate assessments, and supplier procurement audit reports.
              </p>
            </div>

            {loadingAi ? (
              <div className="space-y-3.5 bg-black/40 rounded-lg p-4 border border-emerald-900/60 text-center">
                <div className="flex justify-center">
                  <RefreshCw className="h-5 w-5 text-emerald-400 animate-spin" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-emerald-300 font-extrabold animate-pulse">Running Deep Financial Audit...</p>
                  <p className="text-[9px] text-emerald-100/70 italic">{aiProgressMessage}</p>
                </div>
              </div>
            ) : aiAnalysisResult ? (
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-4 text-gray-900 max-h-96 overflow-y-auto border border-emerald-500 shadow-inner">
                  {renderFormattedMarkdown(aiAnalysisResult)}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={runAiFinancialAudit}
                    className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg shadow-sm transition-colors text-center cursor-pointer uppercase"
                  >
                    Re-Analyze Focus
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(aiAnalysisResult);
                      alert('AI financial analysis copied to clipboard!');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={runAiFinancialAudit}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-xs py-2.5 px-4 rounded-xl shadow-lg hover:shadow-emerald-500/20 transition-all text-center uppercase tracking-wider cursor-pointer"
              >
                Run AI Financial Audit
              </button>
            )}

            {aiError && (
              <div className="bg-red-950/80 text-red-300 p-2.5 rounded-lg text-[9px] border border-red-900 flex items-start gap-1">
                <span>⚠️ Error: {aiError}</span>
              </div>
            )}
          </div>

        </div>

      </div>
      )}

      {/* Money Net & Expiry Risk Assessment View */}
      {financialSubTab === 'moneynet' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Money Net Comparison: What I Buy vs Expected to Sell */}
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-2xl p-5 space-y-5 shadow-sm text-left">
              <div className="space-y-1">
                <h4 className="text-sm font-sans font-extrabold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>💰</span> Money Net Investment Analysis
                </h4>
                <p className="text-[10px] text-gray-400 dark:text-slate-400">Comparing active stock procurement investments against prospective retail sales returns.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl space-y-1 border">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Capital Paid (What I Buy)</span>
                  <span className="text-lg font-mono font-black text-slate-800 dark:text-slate-100 block">
                    {repCapitalAtCost.toLocaleString('en-US')} <span className="text-xs font-bold text-gray-400">ETB</span>
                  </span>
                  <span className="text-[9px] text-gray-500 block font-medium">Accumulated purchase costs.</span>
                </div>

                <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-4 rounded-xl space-y-1 border border-emerald-100 dark:border-emerald-900">
                  <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold uppercase tracking-wider block">Expected Sales Revenue</span>
                  <span className="text-lg font-mono font-black text-emerald-700 dark:text-emerald-400 block">
                    {repCapitalAfterSale.toLocaleString('en-US')} <span className="text-xs font-bold text-emerald-500">ETB</span>
                  </span>
                  <span className="text-[9px] text-gray-500 block font-medium">Prospective retail value.</span>
                </div>
              </div>

              {/* Potential Profit & Markups */}
              <div className="border-t border-dashed border-gray-250 dark:border-slate-800 pt-4 space-y-3.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 dark:text-slate-400 font-semibold">Expected Net Gross Value Gain (Potential Profit)</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +{(repCapitalAfterSale - repCapitalAtCost).toLocaleString('en-US')} ETB
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 dark:text-slate-400 font-semibold">Average Inventory Markup Margin</span>
                  <span className="font-mono font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px]">
                    {repCapitalAfterSale > 0 ? (((repCapitalAfterSale - repCapitalAtCost) / repCapitalAfterSale) * 100).toFixed(1) : '0.0'}% Margin
                  </span>
                </div>

                {/* Progress bar visual comparison */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[9px] text-gray-400 uppercase font-bold tracking-wider">
                    <span>What I Buy (Procurement cost)</span>
                    <span>Expected to Sell (Retail return)</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-950 h-3 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-slate-400 dark:bg-slate-600 h-full" 
                      style={{ width: `${repCapitalAfterSale > 0 ? (repCapitalAtCost / repCapitalAfterSale) * 100 : 50}%` }}
                      title="Procurement Cost Ratio"
                    />
                    <div 
                      className="bg-emerald-500 h-full flex-1" 
                      title="Expected Profit Margin"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 leading-relaxed italic mt-1.5">
                    *Analyzing the markup ratio helps optimize pricing tiers and prevent negative cashflows due to high discount margins or supplier price hikes.
                  </p>
                </div>
              </div>
            </div>

            {/* Expiry Risk Breakdown */}
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm text-left">
              <div className="space-y-1">
                <h4 className="text-sm font-sans font-extrabold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>⚠️</span> Expiry Risk Assessment Profile
                </h4>
                <p className="text-[10px] text-gray-400 dark:text-slate-400">Classifying passive stock assets by active shelf-life and expiration write-off liabilities.</p>
              </div>

              <div className="space-y-3 pt-1">
                {/* Critical / High Risk card */}
                <div className="p-3.5 rounded-xl bg-red-50/40 dark:bg-red-950/20 border border-red-100 dark:border-red-900 flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-red-800 dark:text-red-400 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse"></span>
                      CRITICAL RISK (Expired or &lt; 90 Days)
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-slate-400 block">Needs immediate markdowns or returns.</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="block font-black text-red-700 dark:text-red-400 text-sm">{highRiskQty.toLocaleString()} Units</span>
                    <span className="block text-[9px] text-gray-400 font-bold">{highRiskValue.toLocaleString()} ETB Cost</span>
                  </div>
                </div>

                {/* Warning / Medium Risk card */}
                <div className="p-3.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-amber-800 dark:text-amber-400 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                      MODERATE RISK (90 to 180 Days)
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-slate-400 block">Monitor closely and prioritize dispatching.</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="block font-black text-amber-700 dark:text-amber-400 text-sm">{medRiskQty.toLocaleString()} Units</span>
                    <span className="block text-[9px] text-gray-400 font-bold">{medRiskValue.toLocaleString()} ETB Cost</span>
                  </div>
                </div>

                {/* Safe stock card */}
                <div className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-emerald-800 dark:text-emerald-400 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                      STABLE &amp; LONG SHELF-LIFE (&gt; 180 Days)
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-slate-400 block">Long term shelf life or cosmetics items.</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="block font-black text-emerald-700 dark:text-emerald-400 text-sm">{safeQty.toLocaleString()} Units</span>
                    <span className="block text-[9px] text-gray-400 font-bold">{safeValue.toLocaleString()} ETB Cost</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* High Expiry Risk Products Detailed Listing Table */}
          <div className="space-y-3 text-left">
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>🚨</span> High Expiry-Risk Inventory Log
            </h4>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-150 dark:border-slate-800 overflow-hidden text-xs shadow-sm">
              <table className="min-w-full text-left">
                <thead className="bg-gray-50 dark:bg-slate-950 font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider text-[10px] border-b dark:border-slate-800">
                  <tr>
                    <th className="p-3">Drug / Product Name</th>
                    <th className="p-3">Expiry Date</th>
                    <th className="p-3">Branch Location</th>
                    <th className="p-3 text-center">Batch Quantity</th>
                    <th className="p-3 text-right">Value at Cost (ETB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 dark:divide-slate-800 text-gray-650 dark:text-slate-300 font-medium">
                  {highRiskItemsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400 italic">No products at critical expiry risk found. Your inventory is healthy!</td>
                    </tr>
                  ) : (
                    highRiskItemsList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-red-50/5 dark:hover:bg-red-950/5 transition-colors">
                        <td className="p-3 font-bold text-gray-900 dark:text-white">{item.medName}</td>
                        <td className="p-3 font-mono text-red-600 dark:text-red-400 font-semibold">{item.expiryDate}</td>
                        <td className="p-3 font-semibold text-gray-700 dark:text-slate-300">{item.branchName}</td>
                        <td className="p-3 text-center font-mono font-bold">{item.qty.toLocaleString()} units</td>
                        <td className="p-3 text-right font-mono font-bold text-red-600 dark:text-red-400">{item.value.toLocaleString()} ETB</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Comparison Matrix View */}
      {financialSubTab === 'comparison' && (
        <div className="space-y-6">
          
          {(() => {
            const activeChartData = supplierComparisonsList.map(item => ({
              name: item.supplier.name,
              spend: item.totalSpent,
              frequency: item.poCount,
              volume: item.totalVolume,
              avgCost: item.avgCostPerUnit
            })).filter(d => d.spend > 0 || d.frequency > 0);

            const totalSpendAcrossSuppliers = supplierComparisonsList.reduce((acc, item) => acc + item.totalSpent, 0);
            const totalOrdersCount = supplierComparisonsList.reduce((acc, item) => acc + item.poCount, 0);
            const topSourcedSupplier = [...supplierComparisonsList].sort((a, b) => b.totalSpent - a.totalSpent)[0];
            const mostFrequentSupplier = [...supplierComparisonsList].sort((a, b) => b.poCount - a.poCount)[0];

            const exportToExcel = () => {
              let csvContent = "";
              
              csvContent += "SUPPLIER BENCHMARKING SUMMARY REPORT\n";
              csvContent += "Supplier Name,Sourced Value (ETB),Sourced Batches,Unique Items Count,Total Sourced Volume,Avg Cost Per Unit (ETB)\n";
              supplierComparisonsList.forEach(item => {
                csvContent += `"${item.supplier.name}",${item.totalSpent},${item.poCount},${item.uniqueItemsCount},${item.totalVolume},${item.avgCostPerUnit}\n`;
              });
              csvContent += "\n";
              
              csvContent += "DETAILED SOURCED ITEMS PER SUPPLIER\n";
              csvContent += "Supplier Name,Item Name,Sourced Volume,Average Unit Sourced Price (ETB),Total Cost (ETB)\n";
              supplierComparisonsList.forEach(item => {
                item.itemsBoughtList.forEach(sub => {
                  csvContent += `"${item.supplier.name}","${sub.name}",${sub.quantity},${sub.avgPrice},${sub.totalCost}\n`;
                });
              });
              csvContent += "\n";

              csvContent += "SOURCING PRICE INTELLIGENCE MATRIX\n";
              csvContent += "Product Name,Cheapest Supplier,Cheapest Price (ETB),Second Best Supplier,Second Best Price (ETB),Variance (Savings ETB)\n";
              comparativeProducts.forEach(p => {
                const cheapest = p.records[0];
                const second = p.records[1];
                const diff = second.unitPrice - cheapest.unitPrice;
                csvContent += `"${p.productName}","${cheapest.supplierName}",${cheapest.unitPrice},"${second.supplierName}",${second.unitPrice},${diff}\n`;
              });

              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.setAttribute("href", url);
              link.setAttribute("download", `Supplier_Comparison_Matrix_${supplierItemStateFilter}_${new Date().toISOString().split('T')[0]}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            };

            const exportToPDF = () => {
              const printWindow = window.open('', '_blank');
              if (!printWindow) {
                alert('Popup blocker prevented printing. Please allow popups for this site.');
                return;
              }

              const todayStr = new Date().toISOString().split('T')[0];
              const filterLabels: Record<string, string> = {
                all: "All Sourced Items",
                active: "Current Active Items",
                sold: "Sold Items",
                stockout: "Stockouts",
                expired: "Expired Items",
                overstocked: "Overstocked Items"
              };

              let summaryRows = supplierComparisonsList.map(item => `
                <tr>
                  <td style="font-weight: bold; color: #1e293b;">${item.supplier.name}</td>
                  <td style="font-family: monospace; text-align: right;">${item.totalSpent.toLocaleString()} ETB</td>
                  <td style="font-family: monospace; text-align: center;">${item.poCount}</td>
                  <td style="font-family: monospace; text-align: center;">${item.uniqueItemsCount}</td>
                  <td style="font-family: monospace; text-align: right;">${item.totalVolume.toLocaleString()} units</td>
                  <td style="font-family: monospace; text-align: right;">${item.avgCostPerUnit.toLocaleString()} ETB</td>
                </tr>
              `).join('');

              let detailsRows = supplierComparisonsList.map(item => `
                <div style="margin-top: 25px; page-break-inside: avoid;">
                  <h3 style="font-size: 14px; border-bottom: 2px solid #6366f1; padding-bottom: 5px; color: #4338ca;">${item.supplier.name} - Sourced Items</h3>
                  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px;">
                    <thead>
                      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: bold; text-align: left;">
                        <th style="padding: 6px 8px;">Product Name</th>
                        <th style="padding: 6px 8px; text-align: right;">Quantity Sourced</th>
                        <th style="padding: 6px 8px; text-align: right;">Average Unit Cost</th>
                        <th style="padding: 6px 8px; text-align: right;">Total Sourced Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${item.itemsBoughtList.map(sub => `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                          <td style="padding: 6px 8px; font-weight: 500;">${sub.name}</td>
                          <td style="padding: 6px 8px; text-align: right; font-family: monospace;">${sub.quantity.toLocaleString()} units</td>
                          <td style="padding: 6px 8px; text-align: right; font-family: monospace;">${sub.avgPrice.toLocaleString()} ETB</td>
                          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold;">${sub.totalCost.toLocaleString()} ETB</td>
                        </tr>
                      `).join('') || '<tr><td colspan="4" style="padding: 10px; text-align: center; color: #94a3b8; font-style: italic;">No items found under this filter state.</td></tr>'}
                    </tbody>
                  </table>
                </div>
              `).join('');

              let comparisonRows = comparativeProducts.map(p => {
                const cheapest = p.records[0];
                const second = p.records[1];
                const diff = second.unitPrice - cheapest.unitPrice;
                const percentSavings = cheapest.unitPrice > 0 ? (diff / cheapest.unitPrice) * 100 : 0;
                return `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px; font-weight: bold; color: #1e293b;">${p.productName}</td>
                    <td style="padding: 8px; color: #0f766e; font-weight: 600;">${cheapest.supplierName}</td>
                    <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: bold; color: #0f766e;">${cheapest.unitPrice.toLocaleString()} ETB</td>
                    <td style="padding: 8px; color: #334155;">${second.supplierName}</td>
                    <td style="padding: 8px; text-align: right; font-family: monospace; color: #334155;">${second.unitPrice.toLocaleString()} ETB</td>
                    <td style="padding: 8px; text-align: center; font-family: monospace; font-weight: bold; color: #047857; background-color: #f0fdf4;">
                      +${diff.toLocaleString()} ETB (${percentSavings.toFixed(0)}%)
                    </td>
                  </tr>
                `;
              }).join('');

              printWindow.document.write(`
                <html>
                  <head>
                    <title>Supplier Comparison & Price Intelligence Report</title>
                    <style>
                      body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; font-size: 12px; }
                      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                      th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
                      th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
                      .header { text-align: center; margin-bottom: 25px; border-bottom: 3px double #334155; padding-bottom: 15px; }
                      .title { font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #1e1b4b; }
                      .subtitle { font-size: 11px; color: #64748b; margin-top: 5px; font-weight: 500; }
                      .metadata { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 10px; color: #475569; font-weight: bold; background-color: #f8fafc; padding: 10px; border-radius: 6px; }
                      .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-top: 30px; margin-bottom: 10px; color: #1e1b4b; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
                      .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 9px; color: #94a3b8; }
                      @media print {
                        body { padding: 15px; font-size: 11px; }
                        .no-print { display: none; }
                      }
                    </style>
                  </head>
                  <body>
                    <div class="header">
                      <div class="title">Supplier Comparison & Sourcing Matrix Report</div>
                      <div class="subtitle">Enterprise Procurement Analytics & Price Intelligence Dashboard</div>
                    </div>

                    <div class="metadata">
                      <div>Report Date: \${todayStr}</div>
                      <div>Filter State: \${filterLabels[supplierItemStateFilter] || supplierItemStateFilter}</div>
                      <div>Currency: ETB (Ethiopian Birr)</div>
                    </div>

                    <div class="section-title">Supplier Benchmarking Summary</div>
                    <table>
                      <thead>
                        <tr>
                          <th>Supplier Name</th>
                          <th style="text-align: right;">Sourced Value</th>
                          <th style="text-align: center;">Supply Batches</th>
                          <th style="text-align: center;">Unique Products</th>
                          <th style="text-align: right;">Total Sourced Volume</th>
                          <th style="text-align: right;">Avg Cost/Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        \${summaryRows || '<tr><td colspan="6" style="text-align: center; color: #94a3b8; font-style: italic;">No suppliers matches found.</td></tr>'}
                      </tbody>
                    </table>

                    <div class="section-title">Sourcing Price Intelligence Matrix</div>
                    <p style="font-size: 10px; color: #64748b; margin-top: -5px; margin-bottom: 10px; font-style: italic;">
                      Benching products supplied by multiple vendors. Sourced from lowest price offer to second best offer.
                    </p>
                    <table>
                      <thead>
                        <tr>
                          <th>Product Name</th>
                          <th>Lowest Price Supplier</th>
                          <th style="text-align: right;">Lowest Price</th>
                          <th>Second Best Supplier</th>
                          <th style="text-align: right;">Second Price</th>
                          <th style="text-align: center;">Variance (Savings)</th>
                        </tr>
                      </thead>
                      <tbody>
                        \${comparisonRows || '<tr><td colspan="6" style="text-align: center; color: #94a3b8; font-style: italic;">No shared products sourced across multiple suppliers found.</td></tr>'}
                      </tbody>
                    </table>

                    <div style="page-break-before: always;"></div>
                    <div class="section-title">Supplier Sourced Items Breakdown</div>
                    \${detailsRows}

                    <div class="footer">
                      Generated automatically by Enterprise Sourcing Intelligence. All values are calculated from real active inventory ledgers.
                    </div>
                    <script>
                      window.onload = function() {
                        setTimeout(function() {
                          window.print();
                          window.close();
                        }, 500);
                      };
                    </script>
                  </body>
                </html>
              `);
              printWindow.document.close();
            };

            return (
              <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm text-left">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b dark:border-slate-800 pb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/45 text-emerald-800 dark:text-emerald-300 font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider">
                      📈 Sourcing & Spending Performance
                    </span>
                    <h4 className="text-sm font-bold text-gray-950 dark:text-white uppercase tracking-wider flex items-center gap-1.5 pt-1.5">
                      Supplier Purchasing Analytics
                    </h4>
                    <p className="text-[10px] text-gray-400">
                      Visualizing dynamic procurement expenditures and supply frequencies per active supplier.
                    </p>
                  </div>
                  <div className="flex gap-2.5 bg-gray-50 dark:bg-slate-950 p-2 rounded-xl border dark:border-slate-850">
                    <div className="text-center px-3.5 border-r dark:border-slate-800">
                      <span className="block text-[9px] font-extrabold text-gray-400 uppercase tracking-wide">Total Sourced Value</span>
                      <span className="block font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">{totalSpendAcrossSuppliers.toLocaleString()} ETB</span>
                    </div>
                    <div className="text-center px-3.5">
                      <span className="block text-[9px] font-extrabold text-gray-400 uppercase tracking-wide">Supplied Batches</span>
                      <span className="block font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">{totalOrdersCount} Batches</span>
                    </div>
                  </div>
                </div>

                {/* Filters and Actions control panel */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-gray-150 dark:border-slate-850">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Filter Sourced Inventory Items State</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: 'all', label: 'All Items' },
                        { key: 'active', label: 'Active Stock' },
                        { key: 'sold', label: 'Sold Items' },
                        { key: 'stockout', label: 'Stockouts' },
                        { key: 'expired', label: 'Expired' },
                        { key: 'overstocked', label: 'Overstocked' }
                      ].map(btn => (
                        <button
                          key={btn.key}
                          type="button"
                          onClick={() => setSupplierItemStateFilter(btn.key as any)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all uppercase cursor-pointer ${
                            supplierItemStateFilter === btn.key
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Export Comparison Matrix</span>
                    <div className="flex gap-2">
                      <button
                        onClick={exportToExcel}
                        type="button"
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold px-3 py-2 rounded-lg shadow-sm transition-colors uppercase cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export Excel (CSV)
                      </button>
                      <button
                        onClick={exportToPDF}
                        type="button"
                        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-extrabold px-3 py-2 rounded-lg border border-slate-750 shadow-sm transition-colors uppercase cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Export PDF
                      </button>
                    </div>
                  </div>
                </div>

                {activeChartData.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 dark:text-slate-500 italic text-xs space-y-2">
                    <p className="font-bold text-gray-500">⚠️ No Sourcing Records Available</p>
                    <p className="max-w-md mx-auto leading-relaxed text-[11px]">
                      There are currently no product inventory batches or verified sourcing records logged for active suppliers.
                      Add some product stock items with selected suppliers to build procurement metrics.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Summary Key Performance Indicators */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-gray-100 dark:border-slate-850 space-y-1">
                        <span className="text-[9px] font-bold text-gray-450 uppercase block tracking-wider">Top Expenditure Vendor</span>
                        <span className="font-sans font-black text-gray-900 dark:text-white block truncate">{topSourcedSupplier?.supplier.name || 'N/A'}</span>
                        <span className="font-mono font-bold text-[10px] text-emerald-600 block">
                          {topSourcedSupplier ? `${topSourcedSupplier.totalSpent.toLocaleString()} ETB` : '0 ETB'}
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-gray-100 dark:border-slate-850 space-y-1">
                        <span className="text-[9px] font-bold text-gray-450 uppercase block tracking-wider">Most Frequent Supplier</span>
                        <span className="font-sans font-black text-gray-900 dark:text-white block truncate">{mostFrequentSupplier?.supplier.name || 'N/A'}</span>
                        <span className="font-mono font-bold text-[10px] text-indigo-600 block">
                          {mostFrequentSupplier ? `${mostFrequentSupplier.poCount} Batches Supplied` : '0 Batches'}
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-gray-100 dark:border-slate-850 space-y-1">
                        <span className="text-[9px] font-bold text-gray-450 uppercase block tracking-wider">Volume Champion</span>
                        {(() => {
                          const highestVolumeSupplier = [...supplierComparisonsList].sort((a, b) => b.totalVolume - a.totalVolume)[0];
                          return (
                            <>
                              <span className="font-sans font-black text-gray-900 dark:text-white block truncate">{highestVolumeSupplier?.supplier.name || 'N/A'}</span>
                              <span className="font-mono font-bold text-[10px] text-purple-600 block">
                                {highestVolumeSupplier ? `${highestVolumeSupplier.totalVolume.toLocaleString()} units supplied` : '0 units'}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-gray-100 dark:border-slate-850 space-y-1">
                        <span className="text-[9px] font-bold text-gray-450 uppercase block tracking-wider">Active Vendor Network</span>
                        <span className="font-sans font-black text-gray-900 dark:text-white block">{activeChartData.length} Sourcing Suppliers</span>
                        <span className="text-[10px] text-gray-400 block">With non-zero purchase history</span>
                      </div>
                    </div>

                    {/* Double Chart Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                      
                      {/* Spend Chart */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-gray-100 dark:border-slate-850 space-y-3">
                        <div className="space-y-0.5">
                          <h5 className="font-sans font-bold text-gray-900 dark:text-white text-xs">Supplier Total Purchase Value (ETB)</h5>
                          <p className="text-[9px] text-gray-400">Total volume of investments made with each supplier in ETB.</p>
                        </div>
                        <div className="h-56 w-full text-[9px] font-semibold text-gray-500">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={activeChartData} margin={{ top: 10, right: 10, left: -5, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-slate-800" />
                              <XAxis dataKey="name" tickLine={false} axisLine={false} style={{ fontSize: 8, fill: '#6b7280' }} />
                              <YAxis tickLine={false} axisLine={false} style={{ fontSize: 8, fill: '#6b7280' }} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 10 }}
                                formatter={(val: number) => [`${val.toLocaleString()} ETB`, 'Spent']}
                              />
                              <Bar dataKey="spend" name="Total Spend (ETB)" radius={[4, 4, 0, 0]} fill="#10b981">
                                {activeChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#059669'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Frequency Chart */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-gray-100 dark:border-slate-850 space-y-3">
                        <div className="space-y-0.5">
                          <h5 className="font-sans font-bold text-gray-900 dark:text-white text-xs">Supply Frequency (Product Batches)</h5>
                          <p className="text-[9px] text-gray-400">The total number of product inventory batches sourced from each vendor.</p>
                        </div>
                        <div className="h-56 w-full text-[9px] font-semibold text-gray-500">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={activeChartData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-slate-800" />
                              <XAxis dataKey="name" tickLine={false} axisLine={false} style={{ fontSize: 8, fill: '#6b7280' }} />
                              <YAxis tickLine={false} axisLine={false} style={{ fontSize: 8, fill: '#6b7280' }} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 10 }}
                                formatter={(val: number) => [`${val} batches`, 'Sourced Batches']}
                              />
                              <Bar dataKey="frequency" name="Batches Count" radius={[4, 4, 0, 0]} fill="#6366f1">
                                {activeChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#4f46e5'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                    </div>
                  </>
                )}
              </div>
            );
          })()}
          
          {/* Supplier Metrics Grid */}
          <div className="space-y-3 text-left">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>⚔️</span> Side-by-Side Supplier Benchmarking
              </h4>
              <p className="text-[10px] text-gray-400">Compare suppliers across total volume of goods, product diversity, expenditure, and unit averages.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {supplierComparisonsList.map(({ supplier, poCount, totalSpent, totalVolume, uniqueItemsCount, avgCostPerUnit, topVolumeItem, topVolumeItemQty, itemsBoughtList }) => (
                <div key={supplier.id} className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm relative overflow-hidden">
                  {/* Subtle top decoration */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                  
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <h5 className="font-sans font-extrabold text-gray-900 dark:text-white text-sm">{supplier.name}</h5>
                      <span className="text-[9px] text-gray-400 font-mono font-medium block">{supplier.phone} | {supplier.email}</span>
                    </div>
                    <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded font-bold font-mono">
                      {poCount} Supply Batches
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 border-t dark:border-slate-800 pt-3.5 text-xs text-gray-600 dark:text-slate-400">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-gray-400 uppercase tracking-wide font-bold block">Items Variety</span>
                      <span className="font-sans font-black text-slate-800 dark:text-slate-200 block text-sm">{uniqueItemsCount} Product Types</span>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <span className="text-[9px] text-gray-400 uppercase tracking-wide font-bold block">Total Volume</span>
                      <span className="font-sans font-black text-slate-800 dark:text-slate-200 block text-sm">{totalVolume.toLocaleString()} units</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-gray-400 uppercase tracking-wide font-bold block">Expenditure (Price)</span>
                      <span className="font-mono font-black text-indigo-700 dark:text-indigo-400 block text-sm">{totalSpent.toLocaleString()} ETB</span>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <span className="text-[9px] text-gray-400 uppercase tracking-wide font-bold block">Avg Cost / Unit</span>
                      <span className="font-mono font-black text-gray-900 dark:text-white block text-sm">{avgCostPerUnit.toLocaleString()} ETB</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed dark:border-slate-800 pt-3 text-[10px] space-y-1">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wide font-bold block">Top Supplied Product</span>
                    <div className="flex justify-between items-center text-gray-800 dark:text-slate-300 font-semibold bg-slate-50 dark:bg-slate-950 p-2 rounded-lg">
                      <span className="truncate max-w-[150px]">{topVolumeItem}</span>
                      <span className="font-mono bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.5 rounded text-indigo-800 dark:text-indigo-300 text-[9px] font-bold">
                        {topVolumeItemQty.toLocaleString()} units
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-dashed dark:border-slate-800 pt-3 text-[10px] space-y-1.5">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wide font-bold block">Items Sourced &amp; Quantities</span>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                      {itemsBoughtList && itemsBoughtList.length > 0 ? (
                        itemsBoughtList.map((item, i) => (
                          <div key={i} className="flex justify-between items-center text-[11px] bg-slate-50 dark:bg-slate-950 p-2 rounded border border-gray-100 dark:border-slate-850">
                            <span className="font-semibold text-gray-800 dark:text-slate-300 truncate max-w-[150px]" title={item.name}>
                              {item.name}
                            </span>
                            <span className="font-mono text-gray-650 dark:text-slate-400 font-bold">
                              {item.quantity.toLocaleString()} units <span className="text-[9px] text-gray-400 font-normal">(@ {item.avgPrice} ETB)</span>
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-400 italic text-[10px] py-2 text-center">No items bought yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sourcing Intelligence Comparison Matrix */}
          <div className="space-y-3 text-left">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>🛡️</span> Sourcing Price Intelligence Matrix
              </h4>
              <p className="text-[10px] text-gray-400">Products supplied by multiple vendors. Sourced from lowest price to highest price.</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-150 dark:border-slate-800 overflow-hidden text-xs shadow-sm">
              <table className="min-w-full text-left">
                <thead className="bg-gray-50 dark:bg-slate-950 font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider text-[10px] border-b dark:border-slate-800">
                  <tr>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Cheapest Supplier Offer</th>
                    <th className="p-3 text-right">Lowest Price</th>
                    <th className="p-3">Second Best Supplier Offer</th>
                    <th className="p-3 text-right">Second Price</th>
                    <th className="p-3 text-center">Variance (Savings)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 dark:divide-slate-800 text-gray-650 dark:text-slate-300 font-medium">
                  {comparativeProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400 italic">No shared products sourced across multiple suppliers found. Add more POs to enable benchmarking.</td>
                    </tr>
                  ) : (
                    comparativeProducts.map((p, idx) => {
                      const cheapest = p.records[0];
                      const second = p.records[1];
                      const diff = second.unitPrice - cheapest.unitPrice;
                      const percentSavings = cheapest.unitPrice > 0 ? (diff / cheapest.unitPrice) * 100 : 0;
                      return (
                        <tr key={idx} className="hover:bg-indigo-50/5 transition-colors">
                          <td className="p-3 font-bold text-gray-900 dark:text-white">{p.productName}</td>
                          <td className="p-3">
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-emerald-700 dark:text-emerald-400">{cheapest.supplierName}</span>
                              <span className="block text-[9px] text-gray-400">Sourced: {cheapest.poDate}</span>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{cheapest.unitPrice.toLocaleString()} ETB</td>
                          <td className="p-3 text-gray-700 dark:text-slate-300">
                            <div className="space-y-0.5">
                              <span className="font-semibold">{second.supplierName}</span>
                              <span className="block text-[9px] text-gray-400">Sourced: {second.poDate}</span>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono text-gray-700 dark:text-slate-300">{second.unitPrice.toLocaleString()} ETB</td>
                          <td className="p-3 text-center">
                            <span className="bg-emerald-50 dark:bg-emerald-950/45 text-emerald-800 dark:text-emerald-300 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]">
                              +{diff.toLocaleString()} ETB ({percentSavings.toFixed(0)}% saved)
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Expense Creator Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-150 text-xs text-gray-800 text-left">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-3 mb-4 flex justify-between items-center">
              <span>Log Branch Expense</span>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-650">
                <X className="h-4 w-4" />
              </button>
            </h3>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Select Branch</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full bg-white border p-2 rounded outline-none font-medium"
                  >
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Expense Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white border p-2 rounded outline-none font-medium"
                  >
                    <option value="Utilities">Utilities</option>
                    <option value="Rent">Rent</option>
                    <option value="Salaries">Salaries</option>
                    <option value="Transportation">Transportation</option>
                    <option value="General Overhead">General Overhead</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Expense Value (ETB)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value.replace(',', '.');
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setAmount(val);
                    }
                  }}
                  className="w-full bg-white border p-2 rounded outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Expenditure Description</label>
                <textarea
                  required
                  placeholder="e.g., Monthly electricity bill settlement for May..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none h-16 font-medium"
                />
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="bg-white border py-2 px-4 rounded text-gray-700 font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-emerald-600 text-white font-bold py-2 px-5 rounded">
                  {submitting ? 'Recording...' : 'Commit Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADVANCED FINANCIAL & SALES REPORTING SUITE */}
      <div id="advanced-reporting-suite-section" className="bg-white rounded-xl border border-gray-150 p-6 space-y-6 shadow-sm text-left">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-gray-950 uppercase tracking-wider flex items-center gap-1.5">
              <span>🧾</span> Comprehensive Reporting &amp; Valuation Suite
            </h4>
            <p className="text-xs text-gray-500">
              Generate precise financial statements, sales ledger audits, and capital inventory valuations with custom filters.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs py-2 px-4 rounded-lg border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export to Excel
            </button>
            <button
              onClick={() => setShowPrintModal(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-4 rounded-lg shadow transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <FileText className="h-4 w-4" />
              Print Report (PDF)
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-xl border">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-750 uppercase tracking-wider">Date Range Filter</label>
            <select
              value={repDateType}
              onChange={(e) => setRepDateType(e.target.value as any)}
              className="w-full bg-white border p-2 rounded text-xs font-semibold text-gray-800 outline-none"
            >
              <option value="all">Any time (All sales)</option>
              <option value="today">Today's Sales</option>
              <option value="weekly">Weekly (Past 7 days)</option>
              <option value="monthly">Monthly (Past 30 days)</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {repDateType === 'custom' && (
            <>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-750 uppercase tracking-wider">Start Date</label>
                <input
                  type="date"
                  value={repStartDate}
                  onChange={(e) => setRepStartDate(e.target.value)}
                  className="w-full bg-white border p-1.5 rounded text-xs text-gray-800 font-semibold outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-750 uppercase tracking-wider">End Date</label>
                <input
                  type="date"
                  value={repEndDate}
                  onChange={(e) => setRepEndDate(e.target.value)}
                  className="w-full bg-white border p-1.5 rounded text-xs text-gray-800 font-semibold outline-none"
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-750 uppercase tracking-wider">Category Focus</label>
            <select
              value={repCategory}
              onChange={(e) => setRepCategory(e.target.value)}
              className="w-full bg-white border p-2 rounded text-xs font-semibold text-gray-800 outline-none"
            >
              <option value="all">All Categories</option>
              <option value="medicine">Medicine Category Only</option>
              <option value="cosmetics">Cosmetics Category Only</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-750 uppercase tracking-wider">By User / Cashier</label>
            <select
              value={repUser}
              onChange={(e) => setRepUser(e.target.value)}
              className="w-full bg-white border p-2 rounded text-xs font-semibold text-gray-800 outline-none"
            >
              <option value="all">All Cashiers / Users</option>
              {users.map(u => {
                const bName = branches.find(b => b.id === u.branchId)?.name || (u.branchId === 'all' ? 'All Outlets' : u.branchId);
                return (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.username}) &bull; {bName}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-750 uppercase tracking-wider">Payment Method</label>
            <select
              value={repPaymentMethod}
              onChange={(e) => setRepPaymentMethod(e.target.value)}
              className="w-full bg-white border p-2 rounded text-xs font-semibold text-gray-800 outline-none"
            >
              <option value="all">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Bank">🏦 All Bank Transfers & Accounts</option>
              <option value="Telebirr">Telebirr Mobile Money</option>
              <option value="Credit">Credit Account</option>
              <option value="Bank CBE">Bank CBE</option>
              <option value="Bank BOA">Bank BOA</option>
              <option value="Bank AWASH">AWASH Bank</option>
              <option value="Bank DASHEN">DASHEN Bank</option>
              <option value="Card">POS Card Terminal</option>
              <option value="Split">Split Payment</option>
              <option value="Other">Other Bank Transfer</option>
            </select>
          </div>
        </div>

        {/* Dynamic Valuation metrics matching above filtered options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 bg-emerald-50/40 p-5 rounded-xl border border-emerald-150">
          <div className="space-y-1">
            <span className="text-gray-500 font-semibold text-[10px] uppercase tracking-wider">Total Stock units</span>
            <span className="text-sm font-black text-gray-900 block font-mono">
              {repTotalStockUnits.toLocaleString()} units
            </span>
            <span className="text-[9px] text-gray-400">Total units in hand</span>
          </div>

          <div className="space-y-1">
            <span className="text-gray-500 font-semibold text-[10px] uppercase tracking-wider">Capital at Cost</span>
            <span className="text-sm font-black text-emerald-800 block font-mono">
              {repCapitalAtCost.toLocaleString()} ETB
            </span>
            <span className="text-[9px] text-emerald-600 font-medium">Buying price valuation</span>
          </div>

          <div className="space-y-1">
            <span className="text-gray-500 font-bold text-[10px] uppercase tracking-wider">Total Estim. Amount After Sale</span>
            <span className="text-sm font-black text-indigo-800 block font-mono">
              {repCapitalAfterSale.toLocaleString()} ETB
            </span>
            <span className="text-[9px] text-indigo-600 font-medium">Selling price potential (After sale)</span>
          </div>

          <div className="space-y-1">
            <span className="text-gray-500 font-semibold text-[10px] uppercase tracking-wider">Filtered Sales Revenue</span>
            <span className="text-sm font-black text-gray-900 block font-mono">
              {repTotalSalesAmount.toLocaleString()} ETB
            </span>
            <span className="text-[9px] text-gray-400">Accumulated total</span>
          </div>

          <div className="space-y-1">
            <span className="text-gray-500 font-semibold text-[10px] uppercase tracking-wider">Filtered Net Profit</span>
            <span className="text-sm font-black text-amber-700 block font-mono">
              {repTotalProfit.toLocaleString()} ETB
            </span>
            <span className="text-[9px] text-amber-600 font-bold">Estimated margin profit</span>
          </div>
        </div>

        {/* Detailed Transactions List table matching above filtered options */}
        <div className="space-y-3.5 pt-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">Detailed filtered transaction lists ({filteredSalesTransactions.length})</span>
            <span className="text-[10px] font-mono font-extrabold text-gray-500 uppercase">Live calculations</span>
          </div>

          {/* Admin Payment Method Modifications Audit Notification */}
          {filteredSalesTransactions.filter(s => s.paymentMethodChanged || (s.paymentMethodHistory && s.paymentMethodHistory.length > 0)).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-amber-950">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Admin / User Payment Method Change Notification ({filteredSalesTransactions.filter(s => s.paymentMethodChanged || (s.paymentMethodHistory && s.paymentMethodHistory.length > 0)).length} Adjusted Transactions)</span>
                </div>
                <span className="text-[9px] bg-amber-200 text-amber-950 px-2 py-0.5 rounded font-bold uppercase font-mono border border-amber-300">
                  Financial Audit Log
                </span>
              </div>
              <p className="text-[11px] text-amber-850">
                The settlement routes for the following invoices were modified post-sale by admins/staff. These updates affect payment route breakdowns in financial reconciliation:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
                {filteredSalesTransactions.filter(s => s.paymentMethodChanged || (s.paymentMethodHistory && s.paymentMethodHistory.length > 0)).map(sale => {
                  const lastLog = sale.paymentMethodHistory?.[0];
                  return (
                    <div key={sale.id} className="bg-white p-2 rounded-lg border border-amber-200 text-[11px] flex justify-between items-center shadow-2xs">
                      <div>
                        <div className="font-extrabold text-gray-900">#{sale.invoiceNumber}</div>
                        <div className="text-[10px] text-gray-500">{sale.date} @{sale.time}</div>
                      </div>
                      <div className="text-right">
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 font-bold rounded text-[9.5px] uppercase block">
                          {lastLog ? `${lastLog.oldMethod} ➔ ${lastLog.newMethod}` : sale.paymentMethod}
                        </span>
                        <span className="text-[9px] text-gray-500 font-medium truncate max-w-[140px] block mt-0.5">
                          {lastLog ? `By ${lastLog.changedBy}` : sale.lastPaymentChangeNote}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-150 overflow-hidden text-[11px] shadow-sm">
            <table className="min-w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100 font-semibold text-gray-700 uppercase tracking-wider text-[9px]">
                <tr>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Date &amp; Time</th>
                  <th className="p-3">Customer / Patient</th>
                  <th className="p-3">Items Purchased</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3">Processed By</th>
                  <th className="p-3 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-650">
                {filteredSalesTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-gray-400 italic font-medium">
                      No sales matching the active reporting filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSalesTransactions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 font-medium">
                      <td className="p-3 font-semibold text-gray-900 font-mono">{s.invoiceNumber}</td>
                      <td className="p-3 text-gray-500 font-mono">
                        {s.date} <span className="text-[10px] text-gray-400">@{s.time}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-gray-800 block">{s.customerName || 'Walk-in Customer'}</span>
                      </td>
                      <td className="p-3 max-w-[200px] truncate" title={s.items.map(i => `${i.medicineName} (x${i.quantity})`).join(', ')}>
                        {s.items.map(i => `${i.medicineName} (${i.quantity})`).join(', ')}
                      </td>
                      <td className="p-3">
                        <span className="bg-slate-100 text-slate-700 border border-slate-200 rounded px-2 py-0.5 text-[10px] font-bold">
                          {s.paymentMethod}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500">{s.cashierName}</td>
                      <td className="p-3 text-right font-bold text-gray-900 font-mono">
                        {s.total.toLocaleString()} ETB
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredSalesTransactions.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-double font-bold text-gray-900">
                  <tr>
                    <td colSpan={6} className="p-3 text-right">Filtered Accumulated Total:</td>
                    <td className="p-3 text-right font-mono text-emerald-800 text-xs font-black">
                      {repTotalSalesAmount.toLocaleString()} ETB
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* PRINT-FRIENDLY REPORT MODAL OVERLAY */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 border border-slate-300 flex flex-col h-[90vh]">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div className="text-left">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-1.5">
                  <span>📄</span> Official Financial Statement Print Preview
                </h3>
                <p className="text-[11px] text-gray-500">Ready for hardcopy documentation or export to system PDF print streams.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const printContents = document.getElementById('printable-financial-report-content')?.innerHTML;
                    if (printContents) {
                      const printWindow = window.open('', '', 'width=900,height=650');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>${instName} - Financial Statement</title>
                              <style>
                                body { font-family: sans-serif; padding: 40px; color: #111; line-height: 1.5; font-size: 12px; }
                                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                                th { background-color: #f5f5f5; font-weight: bold; }
                                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #111; padding-bottom: 20px; }
                                .title { font-size: 20px; font-weight: bold; text-transform: uppercase; }
                                .grid-box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
                                .stat-card { border: 1px solid #ccc; padding: 15px; border-radius: 8px; }
                                .footer { margin-top: 50px; border-top: 1px solid #aaa; padding-top: 15px; text-align: center; font-size: 10px; color: #555; }
                              </style>
                            </head>
                            <body>
                              \${printContents}
                              <script>
                                window.onload = function() {
                                  window.print();
                                  window.close();
                                };
                              </script>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      } else {
                        alert('Popup blocker prevented printing. Please enable popups or use window printing.');
                      }
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-5 rounded-lg shadow-sm cursor-pointer"
                >
                  Confirm &amp; Print PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="bg-white border text-gray-700 font-semibold text-xs py-2 px-4 rounded-lg hover:bg-gray-100 cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>

            {/* PRINTABLE AREA CONTAINER */}
            <div className="flex-1 overflow-y-auto bg-slate-50 p-6 rounded-xl border border-slate-200">
              <div id="printable-financial-report-content" className="bg-white p-8 rounded-lg shadow border font-sans text-left text-xs text-slate-800">
                
                <div className="text-center pb-6 border-b-2 border-slate-900 mb-6">
                  <span className="text-xl font-extrabold text-slate-900 tracking-wider uppercase block">{instName} Enterprise ERP</span>
                  <span className="text-[10px] text-slate-500 font-mono tracking-wider block mt-1">Official Multi-Branch Financial Statement Report</span>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-4 font-mono">
                    <span>GENERATE TIME: {new Date().toLocaleString()}</span>
                    <span>BRANCH FOCUS: {selectedBranchId === 'all' ? 'CONSOLIDATED (ALL BRANCHES)' : 'BRANCH NODE ID: ' + selectedBranchId}</span>
                  </div>
                </div>

                <div className="mb-6 space-y-1">
                  <span className="text-[11px] font-bold text-slate-900 block uppercase">Report Generation Parameters:</span>
                  <div className="grid grid-cols-2 gap-4 text-[11px] text-slate-600 bg-slate-50 p-3 rounded-lg">
                    <div>
                      <strong>Date Filter range:</strong> {repDateType === 'custom' ? `${repStartDate} to ${repEndDate}` : repDateType.toUpperCase()}
                    </div>
                    <div>
                      <strong>Corporate Category focus:</strong> {repCategory.toUpperCase()}
                    </div>
                    <div>
                      <strong>Account operator filter:</strong> {repUser === 'all' ? 'All user transactions' : `User ID: ${repUser}`}
                    </div>
                    <div>
                      <strong>Payment settlement:</strong> {repPaymentMethod.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Capital Valuation Statement */}
                <div className="mb-6 space-y-2">
                  <span className="text-xs font-bold text-slate-900 uppercase border-b-2 pb-1 block">1. Capital Valuation Assets Statement</span>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="border p-3.5 rounded-lg text-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Stock Units</span>
                      <span className="text-lg font-black font-mono mt-1 block">{repTotalStockUnits.toLocaleString()}</span>
                    </div>
                    <div className="border p-3.5 rounded-lg">
                      <span className="text-[10px] text-emerald-600 font-bold uppercase block">Capital at Cost (ETB)</span>
                      <span className="text-lg font-black font-mono mt-1 block text-emerald-800">{repCapitalAtCost.toLocaleString()} ETB</span>
                    </div>
                    <div className="border p-3.5 rounded-lg">
                      <span className="text-[10px] text-indigo-600 font-bold uppercase block">Total Estim. Amount After Sale (ETB)</span>
                      <span className="text-lg font-black font-mono mt-1 block text-indigo-800">{repCapitalAfterSale.toLocaleString()} ETB</span>
                    </div>
                  </div>
                </div>

                {/* Sales & Profitability Statement */}
                <div className="mb-6 space-y-2">
                  <span className="text-xs font-bold text-slate-900 uppercase border-b-2 pb-1 block">2. Income &amp; Profit Statement</span>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="border p-3.5 rounded-lg">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Accumulated Income</span>
                      <span className="text-lg font-black font-mono mt-1 block">{repTotalSalesAmount.toLocaleString()} ETB</span>
                    </div>
                    <div className="border p-3.5 rounded-lg">
                      <span className="text-[10px] text-red-500 font-bold uppercase block">Cost of Goods Sold (COGS)</span>
                      <span className="text-lg font-black font-mono mt-1 block">-{repTotalSalesCogs.toLocaleString()} ETB</span>
                    </div>
                    <div className="border p-3.5 rounded-lg">
                      <span className="text-[10px] text-amber-600 font-bold uppercase block">Estimated Net Margin Profit</span>
                      <span className="text-lg font-black font-mono mt-1 block text-amber-800">+{repTotalProfit.toLocaleString()} ETB</span>
                    </div>
                  </div>
                </div>

                {/* Transactions lists */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-900 uppercase border-b-2 pb-1 block">3. Itemized Ledger Audit Trail</span>
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 font-bold border">
                        <th className="p-2 border">Invoice Number</th>
                        <th className="p-2 border">Date &amp; Time</th>
                        <th className="p-2 border">Customer</th>
                        <th className="p-2 border">Payment</th>
                        <th className="p-2 border">Cashier</th>
                        <th className="p-2 border text-right">Total (ETB)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border animate-fade-in">
                      {filteredSalesTransactions.map((s) => (
                        <tr key={s.id}>
                          <td className="p-2 border font-mono">{s.invoiceNumber}</td>
                          <td className="p-2 border font-mono">{s.date} @{s.time}</td>
                          <td className="p-2 border font-bold">{s.customerName || 'Walk-in Customer'}</td>
                          <td className="p-2 border">{s.paymentMethod}</td>
                          <td className="p-2 border">{s.cashierName}</td>
                          <td className="p-2 border text-right font-mono font-bold">{s.total.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="font-extrabold bg-slate-50 border">
                        <td colSpan={5} className="p-2 border text-right">Accumulated Grand Total Amount:</td>
                        <td className="p-2 border text-right font-mono font-black">{repTotalSalesAmount.toLocaleString()} ETB</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-12 pt-4 border-t border-slate-300 text-center text-[10px] text-slate-400">
                  <span>Authorized Signature of Auditor / Accountant: _______________________</span>
                  <div className="mt-4 font-mono">{instName} Enterprise Cloud Node - Relational Ledgers Synchronized</div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ==================== 5. USER SECURITY & SYSTEM AUDIT LOGS ====================
interface UserActivityPanelProps {
  currentUser: any;
  branches: Branch[];
  users: User[];
  auditLogs: AuditLog[];
  onDataChanged: () => void;
  medicines?: Medicine[];
  stockItems?: StockItem[];
  suppliers?: Supplier[];
  sales?: Sale[];
  pharmacyNotes?: PharmacyNote[];
  categories?: ProductCategory[];
}

export function UserActivityPanel({ 
  currentUser, 
  branches, 
  users, 
  auditLogs, 
  onDataChanged,
  medicines = [],
  stockItems = [],
  suppliers = [],
  sales = [],
  pharmacyNotes = [],
  categories = []
}: UserActivityPanelProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'categories' | 'permissions' | 'devices' | 'import' | 'notifications' | 'reporting' | 'settings' | 'emails' | 'visitors'>('users');
  const [devices, setDevices] = useState<any[]>([]);
  const [showDirectAuthModal, setShowDirectAuthModal] = useState(false);
  const [directAuthUserId, setDirectAuthUserId] = useState('');
  const [directAuthDeviceId, setDirectAuthDeviceId] = useState('');

  // Site Visitor Analytics States
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);
  const [loadingVisitors, setLoadingVisitors] = useState(false);
  const [visitorFilter, setVisitorFilter] = useState<'all' | 'today' | 'returning' | 'active'>('all');
  const [visitorSearch, setVisitorSearch] = useState('');
  const [selectedVisitorForDetail, setSelectedVisitorForDetail] = useState<VisitorLogEntry | null>(null);

  const fetchVisitorStats = async () => {
    setLoadingVisitors(true);
    try {
      const res = await fetch('/api/analytics/visitors');
      if (res.ok) {
        const data = await res.json();
        setVisitorStats(data);
      }
    } catch (err) {
      console.error('Error loading visitor stats:', err);
    } finally {
      setLoadingVisitors(false);
    }
  };

  // Direct User Messaging State
  const [messagingUser, setMessagingUser] = useState<User | null>(null);
  const [showSendMessageModal, setShowSendMessageModal] = useState(false);
  const [directMsgText, setDirectMsgText] = useState('');
  const [directMsgColor, setDirectMsgColor] = useState('blue');
  const [sendingDirectMsg, setSendingDirectMsg] = useState(false);

  const handleSendDirectUserMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messagingUser || !directMsgText.trim()) return;
    setSendingDirectMsg(true);
    try {
      const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (currentUser) {
        requestHeaders['X-User-Role'] = currentUser.role;
        requestHeaders['X-User-Id'] = currentUser.id;
      }
      const res = await fetch('/api/pharmacy-notes', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          text: directMsgText.trim(),
          authorName: currentUser?.name || currentUser?.username || 'Admin',
          authorId: currentUser?.id,
          role: currentUser?.role || 'Administrator',
          color: directMsgColor,
          recipientUserId: messagingUser.id,
          recipientName: `${messagingUser.name || messagingUser.username} (${messagingUser.role})`
        })
      });
      if (res.ok) {
        alert(`Direct message sent to ${messagingUser.name || messagingUser.username}!`);
        setShowSendMessageModal(false);
        setMessagingUser(null);
        setDirectMsgText('');
        if (onDataChanged) onDataChanged();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to send direct message');
      }
    } catch (err) {
      console.error('Error sending direct message:', err);
      alert('Network error sending direct message');
    } finally {
      setSendingDirectMsg(false);
    }
  };

  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  const fetchEmailLogs = async () => {
    setLoadingEmails(true);
    try {
      const res = await fetch('/api/admin/email-logs');
      if (res.ok) {
        const data = await res.json();
        setEmailLogs(data);
      }
    } catch (err) {
      console.error('Error loading email logs:', err);
    } finally {
      setLoadingEmails(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices');
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch (err) {
      console.error('Error loading devices:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'devices') {
      fetchDevices();
      const interval = setInterval(fetchDevices, 5000);
      return () => clearInterval(interval);
    } else if (activeTab === 'emails') {
      fetchEmailLogs();
    } else if (activeTab === 'visitors') {
      fetchVisitorStats();
      const interval = setInterval(fetchVisitorStats, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const handleAuthorizeDirectlyFromRow = async (userId: string, deviceId: string) => {
    try {
      const res = await fetch('/api/devices/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          deviceId,
          operatorId: currentUser?.id
        })
      });
      if (res.ok) {
        fetchDevices();
        if (onDataChanged) onDataChanged();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to authorize device');
      }
    } catch (err) {
      console.error('Error authorizing device:', err);
    }
  };

  const handleDeviceAction = async (userId: string, deviceId: string, action: 'deactivate' | 'reactivate' | 'remove') => {
    try {
      const res = await fetch('/api/devices/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, deviceId, action, operatorId: currentUser?.id })
      });
      if (res.ok) {
        fetchDevices();
        if (onDataChanged) onDataChanged();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to apply device action');
      }
    } catch (err) {
      console.error('Error applying device action:', err);
    }
  };

  const handleAuthorizeDeviceDirectly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directAuthUserId || !directAuthDeviceId.trim()) {
      alert('Please fill in all fields.');
      return;
    }
    try {
      const res = await fetch('/api/devices/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: directAuthUserId,
          deviceId: directAuthDeviceId.trim(),
          operatorId: currentUser?.id
        })
      });
      if (res.ok) {
        setDirectAuthDeviceId('');
        setShowDirectAuthModal(false);
        fetchDevices();
        if (onDataChanged) onDataChanged();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to authorize device');
      }
    } catch (err) {
      console.error('Error authorizing device:', err);
    }
  };

  const [showUserModal, setShowUserModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 200);

  // Institution / Pharmacy Settings States
  const [instName, setInstName] = useState('Sonan Pharmacy');
  const [instAddress, setInstAddress] = useState('');
  const [instPhone, setInstPhone] = useState('');
  const [instEmail, setInstEmail] = useState('');
  const [instTin, setInstTin] = useState('');
  const [instLogo, setInstLogo] = useState('');
  const [loadingInst, setLoadingInst] = useState(false);
  const [savingInst, setSavingInst] = useState(false);

  // Promotional Videos State
  const [promoVideos, setPromoVideos] = useState<any[]>([]);
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoDesc, setNewVideoDesc] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoActive, setNewVideoActive] = useState(true);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Selective Customer Popup Items & Special Deals State
  const [selectivePopupConfig, setSelectivePopupConfig] = useState<any>({
    enabled: true,
    popupTitle: '🔥 Special Customer Deals & Featured Items',
    popupSubtitle: 'Handpicked promotional discounts & essential medical specials chosen for you today',
    autoShowDelaySeconds: 2,
    showOncePerSession: true,
    items: []
  });

  const [newPopupMedId, setNewPopupMedId] = useState('');
  const [newPopupTitle, setNewPopupTitle] = useState('');
  const [newPopupSubtitle, setNewPopupSubtitle] = useState('');
  const [newPopupBadge, setNewPopupBadge] = useState('🔥 Hot Deal');
  const [newPopupDesc, setNewPopupDesc] = useState('');
  const [newPopupImageUrl, setNewPopupImageUrl] = useState('');
  const [newPopupPrice, setNewPopupPrice] = useState<string>('');
  const [newPopupOrigPrice, setNewPopupOrigPrice] = useState<string>('');
  const [newPopupCtaText, setNewPopupCtaText] = useState('Add to Order');
  const [newPopupActive, setNewPopupActive] = useState(true);

  // Auto populate popup form when medicine selection changes
  const handleSelectMedForPopup = (medId: string) => {
    setNewPopupMedId(medId);
    if (!medId) return;
    const med = medicines.find(m => m.id === medId);
    if (med) {
      setNewPopupTitle(med.name);
      setNewPopupSubtitle(med.genericName ? `Generic: ${med.genericName}` : `${med.category || 'Pharmacy Item'}`);
      setNewPopupPrice(String(med.price || ''));
      setNewPopupOrigPrice(String(med.price ? Math.round(med.price * 1.2) : ''));
      setNewPopupDesc(med.description || `Special offer on ${med.name}. High quality certified supply.`);
      if (med.imageUrl) setNewPopupImageUrl(med.imageUrl);
    }
  };

  const handleAddSelectivePopupItem = () => {
    if (!newPopupTitle.trim()) {
      alert('Please enter a title or select a medicine for the popup item.');
      return;
    }
    const newItem = {
      id: 'pop_' + Date.now(),
      medicineId: newPopupMedId || undefined,
      title: newPopupTitle.trim(),
      subtitle: newPopupSubtitle.trim() || undefined,
      badge: newPopupBadge.trim() || '🔥 Hot Deal',
      description: newPopupDesc.trim() || undefined,
      imageUrl: newPopupImageUrl.trim() || undefined,
      price: newPopupPrice !== '' ? Number(newPopupPrice) : undefined,
      originalPrice: newPopupOrigPrice !== '' ? Number(newPopupOrigPrice) : undefined,
      discountPercentage: (newPopupOrigPrice && newPopupPrice && Number(newPopupOrigPrice) > 0)
        ? Math.round((1 - Number(newPopupPrice) / Number(newPopupOrigPrice)) * 100)
        : undefined,
      active: newPopupActive,
      ctaText: newPopupCtaText.trim() || 'Add to Order',
      createdAt: new Date().toISOString()
    };

    setSelectivePopupConfig((prev: any) => ({
      ...prev,
      items: [newItem, ...(prev?.items || [])]
    }));

    // Reset form
    setNewPopupMedId('');
    setNewPopupTitle('');
    setNewPopupSubtitle('');
    setNewPopupBadge('🔥 Hot Deal');
    setNewPopupDesc('');
    setNewPopupImageUrl('');
    setNewPopupPrice('');
    setNewPopupOrigPrice('');
    setNewPopupCtaText('Add to Order');
    setNewPopupActive(true);
  };

  // Local Cash Register Machine Configuration State
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

  useEffect(() => {
    const fetchInstitution = async () => {
      try {
        setLoadingInst(true);
        const res = await fetch('/api/settings/institution');
        if (res.ok) {
          const data = await res.json();
          setInstName(data.name || 'Sonan Pharmacy');
          setInstAddress(data.address || '');
          setInstPhone(data.phone || '');
          setInstEmail(data.email || '');
          setInstTin(data.tinNumber || '1234567890');
          setInstLogo(data.logoUrl || '');
          setPromoVideos(Array.isArray(data.promoVideos) ? data.promoVideos : []);
          if (data.selectivePopupConfig) {
            setSelectivePopupConfig(data.selectivePopupConfig);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingInst(false);
      }
    };
    fetchInstitution();
  }, []);

  const handleSaveInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingInst(true);
      const res = await fetch('/api/settings/institution', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: instName,
          address: instAddress,
          phone: instPhone,
          email: instEmail,
          tinNumber: instTin,
          logoUrl: instLogo,
          promoVideos: promoVideos,
          selectivePopupConfig: selectivePopupConfig,
          operatorId: currentUser?.id
        })
      });
      if (res.ok) {
        localStorage.setItem('sonan_cash_register', JSON.stringify(cashRegister));
        alert('General institution parameters, Selective Customer Popup Items, Promotional Videos, and Hardware Settings successfully saved and synchronized.');
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingInst(false);
    }
  };

  const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        alert("Video file size exceeds 25MB. Please choose a smaller video file or paste a direct video URL.");
        return;
      }
      setUploadingVideo(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewVideoUrl(reader.result as string);
        setUploadingVideo(false);
      };
      reader.onerror = () => {
        alert("Error reading video file.");
        setUploadingVideo(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPromoVideo = () => {
    if (!newVideoTitle.trim() || !newVideoUrl.trim()) {
      alert("Please enter a video title and upload a video file or paste a video URL.");
      return;
    }
    const newVid = {
      id: 'promo-' + Date.now(),
      title: newVideoTitle.trim(),
      description: newVideoDesc.trim(),
      videoUrl: newVideoUrl.trim(),
      active: newVideoActive,
      createdAt: new Date().toISOString()
    };
    setPromoVideos(prev => [newVid, ...prev]);
    setNewVideoTitle('');
    setNewVideoDesc('');
    setNewVideoUrl('');
    setNewVideoActive(true);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Logo file is too large! Please upload an image under 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setInstLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // New User Form
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newTwoFactorEnabled, setNewTwoFactorEnabled] = useState(false);
  const [newRole, setNewRole] = useState('Pharmacist');
  const [newBranchId, setNewBranchId] = useState('b1');
  const [newPassword, setNewPassword] = useState('pass123');
  const [userSubmitting, setUserSubmitting] = useState(false);

  // New Branch Form
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [branchSubmitting, setBranchSubmitting] = useState(false);

  // Edit User Form States
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editTwoFactorEnabled, setEditTwoFactorEnabled] = useState(false);
  const [editRole, setEditRole] = useState('Pharmacist');
  const [editBranchId, setEditBranchId] = useState('b1');
  const [editPassword, setEditPassword] = useState('');
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editUserSubmitting, setEditUserSubmitting] = useState(false);

  // Custom Permissions editing state
  const [selectedPermUser, setSelectedPermUser] = useState<string>('');
  const [userPerms, setUserPerms] = useState<string[]>([]);
  const [permsSaving, setPermsSaving] = useState(false);

  // Batch import state
  const [importText, setImportText] = useState('');
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('json');
  const [mappingPreview, setMappingPreview] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<string>('');

  // Notifications feed state
  const [liveNotifications, setLiveNotifications] = useState<any[]>([]);
  const [notificationsSearch, setNotificationsSearch] = useState('');
  const [revealedSecurityOtps, setRevealedSecurityOtps] = useState<Record<string, boolean>>({});
  const [copiedSecurityOtpId, setCopiedSecurityOtpId] = useState<string | null>(null);

  // Automated report configuration states
  const [reportEmail, setReportEmail] = useState(() => localStorage.getItem('report_email') || 'admin@enterprisepharmacy.com');
  const [reportPhone, setReportPhone] = useState(() => localStorage.getItem('report_phone') || '+251912345678');
  const [enableDailyEmail, setEnableDailyEmail] = useState(() => localStorage.getItem('report_daily_email') !== 'false');
  const [enableDailyPhone, setEnableDailyPhone] = useState(() => localStorage.getItem('report_daily_phone') === 'true');
  const [enableMonthlyEmail, setEnableMonthlyEmail] = useState(() => localStorage.getItem('report_monthly_email') !== 'false');
  const [enableMonthlyPhone, setEnableMonthlyPhone] = useState(() => localStorage.getItem('report_monthly_phone') !== 'false');
  const [enableExpiryEmail, setEnableExpiryEmail] = useState(() => localStorage.getItem('report_expiry_email') !== 'false');
  const [enableExpiryPhone, setEnableExpiryPhone] = useState(() => localStorage.getItem('report_expiry_phone') === 'true');

  const [savingReportSettings, setSavingReportSettings] = useState(false);
  const [reportLog, setReportLog] = useState<{ type: string; format: 'email' | 'phone'; content: string; timestamp: string } | null>(null);

  // Load initial permissions for selected user
  useEffect(() => {
    if (selectedPermUser) {
      const u = users.find(x => x.id === selectedPermUser);
      setUserPerms(u?.permissions || []);
    }
  }, [selectedPermUser, users]);

  // Compile notifications based on current live data and simulated security alarms
  useEffect(() => {
    const list: any[] = [];
    
    // 1. High-value sales
    sales.forEach(s => {
      if (s.total > 1500 && s.status !== 'Voided') {
        list.push({
          id: `notif-sale-${s.id}`,
          type: 'sale',
          severity: 'info',
          title: 'High-Value Sale Completed',
          details: `Invoice ${s.invoiceNumber} registered a sum of ${s.total.toLocaleString()} ETB at branch ${s.branchName}.`,
          timestamp: `${s.date} ${s.time}`,
          status: 'Unread'
        });
      }
    });

    // 2. Low-stock occurrences
    medicines.forEach(m => {
      const qty = stockItems.filter(st => st.medicineId === m.id).reduce((sum, st) => sum + st.quantity, 0);
      if (qty <= m.minStockLevel) {
        list.push({
          id: `notif-stock-${m.id}`,
          type: 'stock',
          severity: 'warning',
          title: 'Minimum Safety Buffer Breach',
          details: `Stock level for medicine "${m.name}" is down to ${qty} ${m.unit}s (Min level configured: ${m.minStockLevel}).`,
          timestamp: '2026-06-30 11:30',
          status: 'Active'
        });
      }
    });

    // 3. Simulated unauthorized access or security logs from audit logs
    auditLogs.forEach(log => {
      if (log.action.toLowerCase().includes('fail') || log.action.toLowerCase().includes('denied') || log.details.toLowerCase().includes('unauthorized')) {
        list.push({
          id: `notif-sec-${log.id}`,
          type: 'security',
          severity: 'danger',
          title: 'Unauthorized Security Event',
          details: `${log.details} logged by system monitor on IP ${log.ipAddress}.`,
          timestamp: `${log.date} ${log.time}`,
          status: 'Investigating'
        });
      }
    });

    // 4. Overdue or Reached Credit Payment Date Reminders
    const todayYmd = new Date().toISOString().split('T')[0];
    sales.forEach(s => {
      const isCredit = s.paymentMethod === 'Credit' || (s.splitDetails && s.splitDetails.credit && s.splitDetails.credit > 0);
      if (isCredit && s.status !== 'Voided' && s.paymentDate) {
        const isOverdue = s.paymentDate <= todayYmd;
        list.push({
          id: `notif-credit-sale-${s.id}`,
          type: 'credit',
          severity: isOverdue ? 'danger' : 'warning',
          title: isOverdue ? 'Credit Payment Date Reached' : 'Upcoming Credit Payment Reminder',
          details: `Invoice ${s.invoiceNumber} (Client: ${s.customerName || 'Walk-In Customer'}, Value: ${s.total.toLocaleString()} ETB) is due on ${s.paymentDate}.`,
          timestamp: `${s.date} ${s.time}`,
          status: isOverdue ? 'Active' : 'Unread'
        });
      }
    });

    // 5. Supplier Credit Balance Alerts
    if (suppliers && suppliers.length > 0) {
      suppliers.forEach(sup => {
        if (sup.balance > 0) {
          list.push({
            id: `notif-supplier-debt-${sup.id}`,
            type: 'credit',
            severity: 'warning',
            title: 'Outstanding Supplier Credit Account',
            details: `Outstanding payable debt of ${sup.balance.toLocaleString()} ETB due to pharmaceutical supplier "${sup.name}".`,
            timestamp: todayYmd + ' 09:00',
            status: 'Active'
          });
        }
      });
    }

    // Include security notifications & OTP verification alerts from pharmacyNotes
    if (pharmacyNotes && pharmacyNotes.length > 0) {
      pharmacyNotes.forEach(note => {
        const isSecurityAlert = note.authorName === 'System Security Audit' || note.text?.includes('SECURITY ALERT') || note.id?.startsWith('sec_') || note.color === 'red';
        if (isSecurityAlert) {
          list.unshift({
            id: `notif-secnote-${note.id}`,
            type: 'security',
            severity: 'danger',
            title: 'Security Alert & Login Verification Event',
            details: note.text,
            timestamp: `${note.date} ${note.time}`,
            status: 'Active'
          });
        }
      });
    }

    // Add extra pre-seeded security alerts to enrich the security panel feed
    list.push({
      id: 'notif-sim-1',
      type: 'security',
      severity: 'danger',
      title: 'Potential Intrusion Attempt',
      details: 'Failed Two-Factor OTP code verification block on cashier1 from IP 197.156.12.89.',
      timestamp: '2026-06-30 08:44',
      status: 'Blocked'
    });

    list.push({
      id: 'notif-sim-2',
      type: 'security',
      severity: 'warning',
      title: 'Bulk Export Audit Flag',
      details: 'Accountant initiated a bulk export of all supplier balances.',
      timestamp: '2026-06-30 10:15',
      status: 'Logged'
    });

    // Filter out security alerts if the current user is not an Administrator or lacks explicit security capabilities
    const isAdmin = currentUser?.role === UserRole.SUPER_ADMIN || String(currentUser?.role) === 'Super Administrator' || String(currentUser?.role) === 'Administrator' || String(currentUser?.role) === 'Admin';
    const userPerms = currentUser?.permissions || [];
    const hasSecurityAccess = isAdmin || userPerms.includes('security_alerts') || userPerms.includes('security') || userPerms.includes('admin') || userPerms.includes('audit');
    const finalNotifications = list.filter(n => hasSecurityAccess || n.type !== 'security');
    setLiveNotifications(finalNotifications);
  }, [sales, medicines, stockItems, auditLogs, currentUser, pharmacyNotes]);

  const runReportSimulation = (type: 'daily' | 'monthly' | 'expiry', format: 'email' | 'phone') => {
    const todayStr = new Date().toISOString().split('T')[0];
    const targetAddress = format === 'email' ? reportEmail : reportPhone;
    
    let content = '';
    
    if (type === 'daily') {
      // Aggregate real sales data for today (excluding voided)
      const todaysSales = sales.filter(s => s.date === todayStr && s.status !== 'Voided' && s.status !== 'Returned');
      const totalRev = todaysSales.reduce((acc, s) => acc + s.total, 0);
      const cashSales = todaysSales.filter(s => s.paymentMethod === 'Cash').reduce((acc, s) => acc + s.total, 0);
      const creditSales = todaysSales.filter(s => s.paymentMethod === 'Credit').reduce((acc, s) => acc + s.total, 0);
      
      // Top products sold today
      const productCounts: { [name: string]: number } = {};
      todaysSales.forEach(s => {
        s.items.forEach(it => {
          productCounts[it.medicineName] = (productCounts[it.medicineName] || 0) + it.quantity;
        });
      });
      
      const topItemsStr = Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, qty]) => `   * ${name}: ${qty} units`)
        .join('\n');

      if (format === 'email') {
        content = `
=========================================
SUBJECT: Daily Sales & Operations Report
TO: ${targetAddress}
TIMESTAMP: ${new Date().toLocaleString()}
=========================================

Dear Administrator,

Here is your daily general performance report for ${todayStr}:

1. REVENUE METRICS:
   - Total Gross Revenue: ${totalRev.toFixed(2)} ETB
   - Total Transactions: ${todaysSales.length} orders
   - Cash Receipts: ${cashSales.toFixed(2)} ETB
   - Credit Sales: ${creditSales.toFixed(2)} ETB

2. OUTLET DAILY BREAKDOWN:
${branches.map(b => {
  const branchDailySales = todaysSales.filter(s => 
    s.branchId === b.id || 
    (s.branchName && s.branchName.toLowerCase().trim() === b.name.toLowerCase().trim()) || 
    (b.code && s.branchId === b.code) ||
    (!s.branchId && branches[0]?.id === b.id)
  );
  const branchDailySum = branchDailySales.reduce((acc, s) => acc + s.total, 0);
  return `   * ${b.name} [Code: ${b.code || b.id}]: ${branchDailySum.toFixed(2)} ETB (${branchDailySales.length} orders)`;
}).join('\n')}

3. HOT INVENTORY ITEMS SOLD TODAY:
${todaysSales.length > 0 ? topItemsStr : '   - No transactions completed today yet.'}

3. ACTIVE STOCKS CRITICAL ALERTER:
   - Total catalog product varieties: ${medicines.length} products
   - Low stock warnings: ${medicines.filter(m => stockItems.filter(s => s.medicineId === m.id).reduce((acc, s) => acc + s.quantity, 0) <= m.minStockLevel).length} items below minimum threshold.

Thank you,
Automated Pharma ERP Reporter Engine.
`;
      } else {
        content = `[DAILY ERP REPORT] To: ${targetAddress} | Date: ${todayStr} | Total Revenue: ${totalRev.toFixed(2)} ETB | Orders: ${todaysSales.length} | Cash Receipts: ${cashSales.toFixed(2)} ETB | Pls check dashboard.`;
      }
    } else if (type === 'monthly') {
      // Monthly summary
      const currentYm = todayStr.substring(0, 7); // e.g. "2026-06"
      const monthlySales = sales.filter(s => s.date.startsWith(currentYm) && s.status !== 'Voided' && s.status !== 'Returned');
      const totalRev = monthlySales.reduce((acc, s) => acc + s.total, 0);
      const totalTrans = monthlySales.length;
      
      if (format === 'email') {
        content = `
=========================================
SUBJECT: Monthly Audit & Financial summary
TO: ${targetAddress}
TIMESTAMP: ${new Date().toLocaleString()}
=========================================

Dear Administrator,

The monthly audit and general pharmacy summary for ${currentYm} has been compiled successfully:

1. REVENUE & PERFORMANCE OVERVIEW:
   - Monthly Total Gross Revenue: ${totalRev.toFixed(2)} ETB
   - Cumulative Sales Transactions: ${totalTrans} completed bills
   - Active Working Outlets: ${branches.length} branches

2. OUTLET BREAKDOWN:
${branches.map(b => {
  const branchSales = monthlySales.filter(s => s.branchId === b.id);
  const branchSum = branchSales.reduce((acc, s) => acc + s.total, 0);
  return `   * ${b.name} [Code: ${b.code}]: ${branchSum.toFixed(2)} ETB (${branchSales.length} transactions)`;
}).join('\n')}

3. CUSTOMERS REGISTERED METRICS:
   - Total registered customer catalog: ${users.length} accounts
   - High priority system actions logged: ${auditLogs.length} events

Thank you for your business.
Enterprise Automated Reporter Engine.
`;
      } else {
        content = `[MONTHLY ERP AUDIT] To: ${targetAddress} | Month: ${currentYm} | Cumulative Rev: ${totalRev.toFixed(2)} ETB | Transactions: ${totalTrans} | Outlet count: ${branches.length}.`;
      }
    } else {
      // Expiry summary
      const soonLimitStr = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 180); // 180 days limit
        return d.toISOString().split('T')[0];
      })();
      
      const expiringStocks = stockItems.filter(s => s.quantity > 0 && s.expiryDate <= soonLimitStr);
      
      // Group by medicine name
      const expDetails = expiringStocks.map(s => {
        const med = medicines.find(m => m.id === s.medicineId);
        return {
          name: med?.name || 'Unknown medicine',
          batch: s.batchNumber,
          expiry: s.expiryDate,
          qty: s.quantity
        };
      });

      const expListStr = expDetails.length > 0 
        ? expDetails.slice(0, 5).map(e => `   * ${e.name} (Batch: ${e.batch}) - Exp: ${e.expiry} [Qty: ${e.qty} units]`).join('\n')
        : '   - Congratulations! No batches are expiring within 180 days.';

      if (format === 'email') {
        content = `
=========================================
SUBJECT: Monthly Near-Expiry Alert Audit
TO: ${targetAddress}
TIMESTAMP: ${new Date().toLocaleString()}
=========================================

Dear Quality Officer / Administrator,

Here is your critical near-expiry medications report (Checked for expiries under 180 days):

1. CRITICAL HIGHLIGHTS:
   - Total active batch stocks in warning level: ${expiringStocks.length} batches
   - Total units in critical status: ${expiringStocks.reduce((acc, s) => acc + s.quantity, 0)} units

2. SENSITIVE BATCH DETAILS (Top 5 Expiring Batches):
${expListStr}
${expDetails.length > 5 ? `   * ... and ${expDetails.length - 5} more expiring items. Please check the 'Expiry' tab for the full log.` : ''}

3. RECOMMENDATION ACTION PLAN:
   - Please offer discounts on these items or execute a return-to-supplier request.
   - Restrict POS terminals from selling any batches that are past their actual expiry date.

Best regards,
Automated Quality Control Monitor.
`;
      } else {
        content = `[EXPIRY MONITOR] To: ${targetAddress} | Active warnings: ${expiringStocks.length} batches expiring soon (<180 days). Please check Quality Control Panel immediately.`;
      }
    }
    
    setReportLog({
      type: type === 'daily' ? 'Daily Report' : type === 'monthly' ? 'Monthly Audit' : 'Near-Expiry Audit',
      format,
      content,
      timestamp: new Date().toLocaleTimeString()
    });
  };

  // Save User Permissions
  const handleSavePermissions = async () => {
    if (!selectedPermUser) return;
    try {
      setPermsSaving(true);
      const res = await fetch(`/api/users/${selectedPermUser}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions: userPerms,
          operatorId: currentUser?.id
        })
      });

      if (res.ok) {
        alert('Security parameters successfully saved for target user account.');
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Failed to save: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPermsSaving(false);
    }
  };

  // Toggle permission flag
  const togglePerm = (perm: string) => {
    if (userPerms.includes(perm)) {
      setUserPerms(userPerms.filter(p => p !== perm));
    } else {
      setUserPerms([...userPerms, perm]);
    }
  };

  // Automated Schema Mapping & Parsing Engine
  const handleParseImport = () => {
    if (!importText.trim()) {
      alert('Paste text/JSON/CSV payload before initiating analysis.');
      return;
    }

    try {
      let rawItems: any[] = [];
      
      if (importFormat === 'json') {
        const parsed = JSON.parse(importText);
        rawItems = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        // Simple CSV parser
        const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          alert('CSV content must contain at least a header row and one data row.');
          return;
        }
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        rawItems = lines.slice(1).map(line => {
          const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
          const rowObj: any = {};
          headers.forEach((h, idx) => {
            rowObj[h] = cols[idx] || '';
          });
          return rowObj;
        });
      }

      // Automatically map columns from old schema to new schema
      const mapped = rawItems.map(raw => {
        // Mapping references:
        // drug_name / product_name -> name
        // chemical_formula / generic -> genericName
        // expiry / exp_date -> expiryDate
        // quantity_on_hand / qty -> quantity
        // unit_price / price -> price
        // purchase_cost / cost -> buyingPrice
        // bar_code / upc -> barcode

        const name = raw.drug_name || raw.product_name || raw.name || 'Generic Medicine';
        const genericName = raw.chemical_formula || raw.generic || raw.genericName || 'N/A';
        const expiryDate = raw.expiry || raw.exp_date || raw.expiryDate || '2027-06-30';
        const quantity = Number(raw.quantity_on_hand || raw.qty || raw.quantity) || 100;
        const price = Number(raw.unit_price || raw.price) || 0;
        const buyingPrice = Number(raw.purchase_cost || raw.cost || raw.buyingPrice) || (price * 0.75);
        const barcode = raw.bar_code || raw.upc || raw.barcode || `BAR-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const sku = raw.sku || `SKU-${Math.floor(Math.random()*9000 + 1000)}`;
        const category = raw.category || 'General';
        const unit = raw.unit || 'Tablet';

        return {
          name,
          genericName,
          expiryDate,
          quantity,
          price,
          buyingPrice,
          barcode,
          sku,
          category,
          unit,
          branchId: 'b1',
          supplierId: 's1'
        };
      });

      setMappingPreview(mapped);
      setImportStatus(`Successfully parsed ${mapped.length} records. Automated schema mapping resolved 7 matching attributes.`);
    } catch (e: any) {
      alert(`Parsing failure: ${e.message}`);
    }
  };

  // Submit batch import
  const handleExecuteBatchImport = async () => {
    if (mappingPreview.length === 0) return;
    try {
      setImportStatus('Transmitting batch request to corporate ledger...');
      const res = await fetch('/api/inventory/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: mappingPreview,
          operatorId: currentUser?.id
        })
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Database Commit Success! Batch imported ${result.medicinesCount} catalog cards and ${result.stocksCount} stock cards.`);
        setMappingPreview([]);
        setImportText('');
        setImportStatus('');
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Ledger rejection: ${err.error}`);
        setImportStatus('Commit aborted.');
      }
    } catch (e: any) {
      console.error(e);
      setImportStatus(`Network error: ${e.message}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newName || !newEmail) {
      alert('Validation Error: Username, name and email attributes are mandatory.');
      return;
    }

    try {
      setUserSubmitting(true);
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          name: newName,
          email: newEmail,
          phone: newPhone,
          twoFactorEnabled: newTwoFactorEnabled,
          role: newRole,
          branchId: newBranchId,
          password: newPassword,
          operatorId: currentUser?.id
        })
      });

      if (res.ok) {
        setShowUserModal(false);
        setNewUsername('');
        setNewName('');
        setNewEmail('');
        setNewPhone('');
        setNewTwoFactorEnabled(false);
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUsername || !editName || !editEmail) {
      alert('Validation Error: Username, name and email attributes are mandatory.');
      return;
    }

    try {
      setEditUserSubmitting(true);
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editUsername,
          name: editName,
          email: editEmail,
          phone: editPhone,
          twoFactorEnabled: editTwoFactorEnabled,
          role: editRole,
          branchId: editBranchId,
          password: editPassword || undefined,
          operatorId: currentUser?.id
        })
      });

      if (res.ok) {
        setShowEditUserModal(false);
        setEditingUser(null);
        setEditUsername('');
        setEditName('');
        setEditEmail('');
        setEditPhone('');
        setEditTwoFactorEnabled(false);
        setEditPassword('');
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEditUserSubmitting(false);
    }
  };

  const handleDeleteUser = async (uId: string) => {
    if (!confirm('Are you absolutely sure you want to permanently delete this user account? This action is irreversible.')) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${uId}?operatorId=${currentUser?.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName || !newBranchCode) {
      alert('Validation Error: Branch name and code must be defined.');
      return;
    }

    try {
      setBranchSubmitting(true);
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBranchName,
          code: newBranchCode,
          address: newBranchAddress,
          phone: newBranchPhone,
          operatorId: currentUser?.id
        })
      });

      if (res.ok) {
        setShowBranchModal(false);
        setNewBranchName('');
        setNewBranchCode('');
        setNewBranchAddress('');
        setNewBranchPhone('');
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBranchSubmitting(false);
    }
  };

  const toggleUserActivation = async (uId: string) => {
    try {
      const res = await fetch(`/api/users/${uId}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUser?.id })
      });
      if (res.ok) {
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    const val = debouncedSearchTerm.toLowerCase();
    return log.username.toLowerCase().includes(val) || log.action.toLowerCase().includes(val) || log.details.toLowerCase().includes(val);
  });

  return (
    <div className="space-y-6">
      
      {/* Tab select bar */}
      <div className="flex border-b border-gray-200 gap-1 bg-white p-2 rounded-xl shadow-sm border">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-xs font-bold transition-all rounded-lg flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'users' ? 'bg-slate-900 text-white shadow' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Users className="h-4 w-4" />
          Registered accounts
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 text-xs font-bold transition-all rounded-lg flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'categories' ? 'bg-slate-900 text-white shadow' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <FolderTree className="h-4 w-4" />
          Categories &amp; Subcategories
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-2 text-xs font-bold transition-all rounded-lg flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'permissions' ? 'bg-slate-900 text-white shadow' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Lock className="h-4 w-4" />
          Role Permission Lists
        </button>
        <button
          onClick={() => setActiveTab('devices')}
          className={`px-4 py-2 text-xs font-bold transition-all rounded-lg flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'devices' ? 'bg-slate-900 text-white shadow' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Laptop className="h-4 w-4" />
          Logged-in Devices
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 text-xs font-bold transition-all rounded-lg flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'import' ? 'bg-slate-900 text-white shadow' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Structured Batch Import
        </button>
        {(currentUser?.role === UserRole.SUPER_ADMIN || String(currentUser?.role) === 'Super Administrator' || String(currentUser?.role) === 'Administrator' || String(currentUser?.role) === 'Admin') && (
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-2 text-xs font-bold transition-all rounded-lg flex items-center gap-1.5 cursor-pointer relative ${
              activeTab === 'notifications' ? 'bg-slate-900 text-white shadow' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Bell className="h-4 w-4" />
            Live Security Alerts
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center animate-bounce">
              {liveNotifications.length}
            </span>
          </button>
        )}
        <button
          onClick={() => setActiveTab('reporting')}
          className={`px-4 py-2 text-xs font-bold transition-all rounded-lg flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'reporting' ? 'bg-slate-900 text-white shadow' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <FileText className="h-4 w-4" />
          Scheduled Reporting
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-xs font-bold transition-all rounded-lg flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'settings' ? 'bg-slate-900 text-white shadow' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Building className="h-4 w-4" />
          Institution Settings
        </button>
        <button
          onClick={() => setActiveTab('emails')}
          className={`px-4 py-2 text-xs font-bold transition-all rounded-lg flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'emails' ? 'bg-slate-900 text-white shadow' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Mail className="h-4 w-4" />
          Email Dispatch Logs
        </button>
        <button
          onClick={() => {
            setActiveTab('visitors');
            fetchVisitorStats();
          }}
          className={`px-4 py-2 text-xs font-bold transition-all rounded-lg flex items-center gap-1.5 cursor-pointer relative ${
            activeTab === 'visitors' ? 'bg-slate-900 text-white shadow' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Globe className="h-4 w-4 text-sky-500" />
          Site Visitors &amp; Traffic
          {visitorStats && visitorStats.activeNow > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-500 text-white animate-pulse ml-0.5">
              {visitorStats.activeNow} live
            </span>
          )}
        </button>
      </div>

      {/* TAB: CATEGORIES & SUBCATEGORIES HIERARCHY */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <CategoryManagerPanel
            currentUser={currentUser}
            categories={categories}
            medicines={medicines}
            onDataChanged={onDataChanged}
          />
        </div>
      )}

      {/* TAB 1: USER & BRANCH REGISTRY */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {currentUser?.role === 'Super Administrator' && (
            <div className="bg-white border border-gray-150 p-5 rounded-xl space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-2 border-b">
                <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider flex items-center gap-1">
                  <Lock className="h-4 w-4 text-emerald-600" />
                  Super Administrator Control Panels
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowUserModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1.5 px-3 rounded shadow-sm cursor-pointer"
                  >
                    + Register User account
                  </button>
                  <button
                    onClick={() => setShowBranchModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1.5 px-3 rounded shadow-sm cursor-pointer"
                  >
                    + Register Branch Node
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="min-w-full text-left text-xs text-gray-770">
                  <thead className="bg-gray-50 border-b border-gray-100 font-semibold text-gray-900">
                    <tr>
                      <th className="p-2.5">User Account</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Security Role</th>
                      <th className="p-2.5">Assigned Location</th>
                      <th className="p-2.5">Device Access</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-600 font-sans">
                    {users.map((u) => {
                      const bName = branches.find(b => b.id === u.branchId)?.name || 'All Locations';
                      const recognizedCount = u.recognizedDevices?.length || 0;
                      return (
                        <tr key={u.id} className="hover:bg-gray-55">
                          <td className="p-2.5 space-y-0.5">
                            <span className="font-semibold text-gray-900 block">{u.name}</span>
                            <span className="text-[10px] text-gray-500 block">uname: {u.username}</span>
                            {u.phone && <span className="text-[10px] text-emerald-600 block font-mono font-medium">📞 {u.phone}</span>}
                          </td>
                          <td className="p-2.5">{u.email}</td>
                          <td className="p-2.5 font-semibold text-gray-800">{u.role}</td>
                          <td className="p-2.5">{bName}</td>
                          <td className="p-2.5">
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {recognizedCount} Authorized {recognizedCount === 1 ? 'Device' : 'Devices'}
                              </span>
                              {u.twoFactorEnabled ? (
                                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-150 mt-1 block w-fit">
                                  🔐 OTP ACTIVE
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-gray-50 text-gray-400 border border-gray-150 mt-1 block w-fit">
                                  🔓 OTP Optional
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 text-center">
                            {u.username !== 'admin' ? (
                              <button
                                onClick={() => toggleUserActivation(u.id)}
                                className={`py-1 px-2.5 rounded text-[10px] font-bold shadow-sm cursor-pointer ${
                                  u.isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {u.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            ) : (
                              <span className="text-gray-400 font-semibold italic text-[11px]">Static System account</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex justify-center items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setMessagingUser(u);
                                  setDirectMsgText('');
                                  setShowSendMessageModal(true);
                                }}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 rounded px-2 py-1 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                title={`Send direct message to ${u.name}`}
                              >
                                <MessageSquare className="h-3 w-3" />
                                Message
                              </button>
                              <button
                               onClick={() => {
                                  setEditingUser(u);
                                  setEditUsername(u.username);
                                  setEditName(u.name);
                                  setEditEmail(u.email);
                                  setEditPhone(u.phone || '');
                                  setEditTwoFactorEnabled(!!u.twoFactorEnabled);
                                  setEditRole(u.role);
                                  setEditBranchId(u.branchId || 'b1');
                                  setEditPassword('');
                                  setShowEditUserModal(true);
                                }}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 rounded px-2 py-1 font-bold text-[10px] cursor-pointer"
                              >
                                Edit
                              </button>
                              {u.username !== 'admin' ? (
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-100 rounded p-1 cursor-pointer"
                                  title="Remove user totally"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <span className="text-gray-300 text-[10px] font-semibold">Protected</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Audit logs trace */}
          <div className="bg-white border border-gray-150 p-5 rounded-xl space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-2 border-b gap-3">
              <div>
                <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider">Operational Audit Activity Trails</h4>
                <p className="text-[11px] text-gray-500">Live network activities, login checks, ledger commits, and restore audits.</p>
              </div>
              <div className="relative bg-white border rounded p-1.5 flex items-center max-w-xs shrink-0">
                <Search className="h-4 w-4 text-gray-400 mr-1.5" />
                <input
                  type="text"
                  placeholder="Search activity logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-xs outline-none bg-transparent w-full text-gray-800"
                />
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto border border-gray-100 rounded-lg">
              <table className="min-w-full text-left text-xs text-gray-750">
                <thead className="bg-gray-50 border-b border-gray-100 font-semibold text-gray-900">
                  <tr>
                    <th className="p-2.5">Timestamp</th>
                    <th className="p-2.5">Operator (Role)</th>
                    <th className="p-2.5">Action Code</th>
                    <th className="p-2.5">Branch Location</th>
                    <th className="p-2.5">Network Node IP</th>
                    <th className="p-2.5">Operational Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-650 font-sans leading-relaxed">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-55">
                      <td className="p-2.5 font-mono space-y-0.5 whitespace-nowrap">
                        <span className="block">{log.date}</span>
                        <span className="block text-gray-400">{log.time}</span>
                      </td>
                      <td className="p-2.5">
                        <span className="font-semibold text-gray-800 block">{log.username}</span>
                        <span className="text-[10px] text-gray-500 block">{log.role}</span>
                      </td>
                      <td className="p-2.5 font-semibold text-gray-900">{log.action}</td>
                      <td className="p-2.5 text-gray-600">{log.branchName}</td>
                      <td className="p-2.5 font-mono text-gray-450">{log.ipAddress}</td>
                      <td className="p-2.5 text-gray-500 max-w-sm truncate" title={log.details}>{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROLE-BASED LIST CUSTOM PERMISSIONS */}
      {activeTab === 'permissions' && (
        <div className="bg-white border border-gray-150 p-5 rounded-xl space-y-4 shadow-sm">
          <div className="border-b pb-2">
            <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider">User-Specific Capability List Configuration</h4>
            <p className="text-[11px] text-gray-500">Enable or restrict system permissions for individual accounts regardless of their global structural roles.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* User Account selection */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">1. Select Target Operator</span>
              <div className="space-y-1 max-h-80 overflow-y-auto border border-gray-100 rounded-lg p-2 bg-gray-50">
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedPermUser(u.id)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs font-semibold block transition-colors ${
                      selectedPermUser === u.id ? 'bg-slate-900 text-white' : 'hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    <span className="block font-bold">{u.name}</span>
                    <span className="block text-[10px] opacity-80">{u.role} ({u.username})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Checkable List */}
            <div className="md:col-span-2 space-y-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">2. Assign/Revoke Allowed Structural Capabilities</span>
              
              {selectedPermUser ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    
                    {/* Capability checklists */}
                    <label className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2.5 cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={userPerms.includes('post')}
                        onChange={() => togglePerm('post')}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-gray-800 block text-[11px] uppercase">Point of Sale (post)</span>
                        <span className="text-[10px] text-gray-500">Grants capability to access dispensing POS cash lanes.</span>
                      </div>
                    </label>

                    <label className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2.5 cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={userPerms.includes('report')}
                        onChange={() => togglePerm('report')}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-gray-800 block text-[11px] uppercase">View Reports (report)</span>
                        <span className="text-[10px] text-gray-500">Grants capability to view dashboard and operational stats.</span>
                      </div>
                    </label>

                    <label className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2.5 cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={userPerms.includes('iteam add')}
                        onChange={() => togglePerm('iteam add')}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-gray-800 block text-[11px] uppercase">Add Items (iteam add)</span>
                        <span className="text-[10px] text-gray-500">Grants capability to create new medicine catalog cards.</span>
                      </div>
                    </label>

                    <label className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2.5 cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={userPerms.includes('iteam ediate')}
                        onChange={() => togglePerm('iteam ediate')}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-gray-800 block text-[11px] uppercase">Edit Items (iteam ediate)</span>
                        <span className="text-[10px] text-gray-500">Grants capability to update item prices and safety thresholds.</span>
                      </div>
                    </label>

                    <label className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2.5 cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={userPerms.includes('transfer')}
                        onChange={() => togglePerm('transfer')}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-gray-800 block text-[11px] uppercase">Transfers (transfer)</span>
                        <span className="text-[10px] text-gray-500">Grants capability to request branch stock shipments.</span>
                      </div>
                    </label>

                    <label className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2.5 cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={userPerms.includes('iteam accept')}
                        onChange={() => togglePerm('iteam accept')}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-gray-800 block text-[11px] uppercase">Accept Items (iteam accept)</span>
                        <span className="text-[10px] text-gray-500">Grants capability to receive transfer shipments on shelf.</span>
                      </div>
                    </label>

                    <label className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2.5 cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={userPerms.includes('report generation')}
                        onChange={() => togglePerm('report generation')}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-gray-800 block text-[11px] uppercase">Financial Statements (report generation)</span>
                        <span className="text-[10px] text-gray-500">Grants capability to export balance sheets and P&amp;L reports.</span>
                      </div>
                    </label>

                    <label className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2.5 cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={userPerms.includes('branch manager')}
                        onChange={() => togglePerm('branch manager')}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-gray-800 block text-[11px] uppercase">Branch Manager</span>
                        <span className="text-[10px] text-gray-500">Grants capability to lock nodes and manage employee roles.</span>
                      </div>
                    </label>

                    <label className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2.5 cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={userPerms.includes('security_alerts') || userPerms.includes('security')}
                        onChange={() => togglePerm('security_alerts')}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-gray-800 block text-[11px] uppercase">Security Notifications & Audit Feed (security_alerts)</span>
                        <span className="text-[10px] text-gray-500">Grants capability to view real-time security alerts, OTPs, and system audit logs.</span>
                      </div>
                    </label>

                    <label className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2.5 cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={userPerms.includes('online_orders') || userPerms.includes('online-orders')}
                        onChange={() => togglePerm('online_orders')}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-gray-800 block text-[11px] uppercase">Online Customer Orders (online_orders)</span>
                        <span className="text-[10px] text-gray-500">Grants capability to view online customer orders, digital prescriptions, and store link.</span>
                      </div>
                    </label>

                  </div>

                  <div className="pt-3 border-t flex justify-end">
                    <button
                      onClick={handleSavePermissions}
                      disabled={permsSaving}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-6 rounded shadow cursor-pointer text-xs"
                    >
                      {permsSaving ? 'Saving Changes...' : 'Save Capabilities Map'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 border border-dashed rounded-lg text-gray-400">
                  <Lock className="h-8 w-8 mx-auto mb-2 opacity-40 text-gray-500" />
                  <span>Choose a registered operator on the left list to edit capability permissions.</span>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* TAB: LOGGED-IN DEVICES MANAGEMENT */}
      {activeTab === 'devices' && (
        <div className="bg-white border border-gray-150 p-5 rounded-xl space-y-4 shadow-sm animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
            <div>
              <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider flex items-center gap-1.5">
                <Laptop className="h-4 w-4 text-slate-800" />
                Security Control: Logged-in Devices
              </h4>
              <p className="text-[11px] text-gray-500">
                Authorise, deactivate, or remove device and browser credentials allowed to access this site. Unrecognized devices always require OTP verification.
              </p>
            </div>
            <button
              onClick={() => {
                if (users.length > 0) {
                  setDirectAuthUserId(users[0].id);
                }
                setShowDirectAuthModal(true);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-1.5 px-3 rounded shadow-sm flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Authorize Access to this Website
            </button>
          </div>

          {/* Direct Auth Modal / Section */}
          {showDirectAuthModal && (
            <div className="bg-emerald-50/50 border border-emerald-200/60 p-4 rounded-lg space-y-3 animate-fadeIn">
              <div className="flex justify-between items-center pb-1.5 border-b border-emerald-150">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                  Direct Website Access Authorization Form
                </span>
                <button
                  onClick={() => setShowDirectAuthModal(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAuthorizeDeviceDirectly} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-600 block">Select Target User Account:</label>
                  <select
                    value={directAuthUserId}
                    onChange={(e) => setDirectAuthUserId(e.target.value)}
                    className="w-full text-xs bg-white border border-gray-300 rounded p-1.5 text-gray-800 outline-none"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.username}) - {u.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-600 block">Device ID / Browser Unique Key:</label>
                  <input
                    type="text"
                    value={directAuthDeviceId}
                    onChange={(e) => setDirectAuthDeviceId(e.target.value)}
                    placeholder="e.g., browser_chrome_mac_123"
                    className="w-full text-xs bg-white border border-gray-300 rounded p-1.5 text-gray-800 outline-none font-mono"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3 rounded shadow-sm transition-all text-center cursor-pointer"
                  >
                    Authorize Device
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDirectAuthModal(false)}
                    className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-bold text-xs py-1.5 px-3 rounded transition-all text-center cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by user account, username, or device identity..."
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-slate-300 transition-all text-gray-800"
            />
          </div>

          {/* Devices Grid / Table */}
          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="min-w-full text-left text-xs text-gray-770">
              <thead className="bg-gray-50 border-b border-gray-100 font-semibold text-gray-900">
                <tr>
                  <th className="p-2.5">User Account</th>
                  <th className="p-2.5">Device Key / Identifier</th>
                  <th className="p-2.5">Authorization Status</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600 font-sans">
                {devices
                  .filter((d) => {
                    const term = debouncedSearchTerm.toLowerCase();
                    return (
                      d.userName.toLowerCase().includes(term) ||
                      d.username.toLowerCase().includes(term) ||
                      d.id.toLowerCase().includes(term)
                    );
                  })
                  .map((d) => (
                    <tr key={`${d.userId}-${d.id}`} className="hover:bg-gray-55">
                      <td className="p-2.5">
                        <span className="font-bold text-gray-900 block">{d.userName}</span>
                        <span className="text-[10px] text-gray-500 block">uname: {d.username}</span>
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-gray-600">
                        {d.id}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                            d.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : d.status === 'Pending OTP Verification'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${d.status === 'Active' ? 'bg-emerald-500' : d.status === 'Pending OTP Verification' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                          {d.status === 'Active' ? 'Authorized Active' : d.status === 'Pending OTP Verification' ? `Pending OTP Verification (Code: ${d.otpCode})` : 'Deactivated / Blocked'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right space-x-1.5">
                        {d.status === 'Pending OTP Verification' && (
                          <button
                            onClick={() => handleAuthorizeDirectlyFromRow(d.userId, d.id)}
                            className="text-white hover:bg-emerald-700 bg-emerald-600 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Authorize Directly
                          </button>
                        )}
                        {d.status === 'Active' && (
                          <button
                            onClick={() => handleDeviceAction(d.userId, d.id, 'deactivate')}
                            className="text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Deactivate
                          </button>
                        )}
                        {d.status === 'Deactivated' && (
                          <button
                            onClick={() => handleDeviceAction(d.userId, d.id, 'reactivate')}
                            className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          onClick={() => handleDeviceAction(d.userId, d.id, 'remove')}
                          className="text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          Remove Device
                        </button>
                      </td>
                    </tr>
                  ))}
                {devices.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-400 font-medium">
                      No recognized devices found. Unrecognized devices will prompt OTP challenges on login.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BATCH-IMPORT WIZARD */}
      {activeTab === 'import' && (
        <div className="bg-white border border-gray-150 p-5 rounded-xl space-y-4 shadow-sm">
          <div className="border-b pb-2">
            <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider">Automated Structured File Batch-Import Desk</h4>
            <p className="text-[11px] text-gray-500">Batch-import legacy pharmacy drugs data with automatic schema column alignment. Supports JSON arrays or standard CSV lines.</p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex gap-4">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Payload Format</span>
                <select
                  value={importFormat}
                  onChange={(e) => setImportFormat(e.target.value as 'json' | 'csv')}
                  className="bg-white border rounded p-1.5 font-semibold text-gray-700 outline-none"
                >
                  <option value="json">Structured JSON Array</option>
                  <option value="csv">Standard CSV Lines</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Structured Payload</label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={8}
                  placeholder={
                    importFormat === 'json' 
                      ? '[\n  {\n    "drug_name": "Amoxicillin 500mg",\n    "chemical_formula": "Amoxicillin Trihydrate",\n    "qty": 200,\n    "unit_price": 4.5,\n    "expiry": "2027-12-15"\n  }\n]'
                      : 'drug_name,chemical_formula,qty,unit_price,expiry\nAmoxicillin 500mg,Amoxicillin Trihydrate,200,4.5,2027-12-15'
                  }
                  className="w-full font-mono bg-gray-50 border p-2.5 rounded outline-none text-slate-800"
                />
              </div>

              {/* Automatic mapping description */}
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg space-y-3">
                <h5 className="font-black text-emerald-800 text-[11px] uppercase flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  Automated Column Alignment Engine
                </h5>
                <p className="text-gray-600 leading-relaxed text-[11px]">
                  Our importing wizard parses the uploaded columns and performs fuzzy matching against the target schema:
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-700">
                  <div className="p-1.5 bg-white border rounded">
                    <span className="text-slate-400 block font-sans">Old Schema Fields:</span>
                    drug_name<br />chemical_formula<br />expiry<br />quantity_on_hand / qty
                  </div>
                  <div className="p-1.5 bg-white border border-emerald-300 rounded">
                    <span className="text-emerald-600 block font-sans">Aligned Current Fields:</span>
                    name<br />expiryDate<br />quantity
                  </div>
                </div>
                
                <div className="pt-2">
                  <button
                    onClick={handleParseImport}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded shadow cursor-pointer"
                  >
                    Analyze &amp; Map Schema
                  </button>
                </div>
              </div>
            </div>

            {/* Status box */}
            {importStatus && (
              <div className="p-3 bg-slate-100 border rounded font-semibold text-slate-700">
                {importStatus}
              </div>
            )}

            {/* Preview table */}
            {mappingPreview.length > 0 && (
              <div className="space-y-3 pt-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Import Preview (Mapped Fields)</span>
                <div className="overflow-x-auto border rounded-lg max-h-60">
                  <table className="min-w-full text-left text-[11px] text-gray-700">
                    <thead className="bg-gray-50 border-b font-semibold">
                      <tr>
                        <th className="p-2">Name</th>
                        <th className="p-2">Expiry Date</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Selling Price</th>
                        <th className="p-2 text-right">Buying Price</th>
                        <th className="p-2">Barcode Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-gray-650 bg-white">
                      {mappingPreview.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-2 font-bold text-gray-900">{item.name}</td>
                          <td className="p-2 font-mono">{item.expiryDate}</td>
                          <td className="p-2 text-right font-mono font-bold text-slate-800">{item.quantity}</td>
                          <td className="p-2 text-right font-mono">{item.price} ETB</td>
                          <td className="p-2 text-right font-mono text-emerald-600">{item.buyingPrice} ETB</td>
                          <td className="p-2 font-mono text-gray-400">{item.barcode}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleExecuteBatchImport}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded shadow-md cursor-pointer"
                  >
                    Proceed with Batch Creation (Commit to DB)
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* TAB 4: REAL-TIME NOTIFICATIONS SECURITY FEED */}
      {activeTab === 'notifications' && (
        <div className="bg-white border border-gray-150 p-5 rounded-xl space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-2 border-b gap-3">
            <div>
              <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider">Live Security &amp; Operational Alarm Monitor</h4>
              <p className="text-[11px] text-gray-500">Live feed monitoring high-value POS transactions, inventory level depletion, and access failures.</p>
            </div>
            
            <div className="relative bg-white border rounded p-1.5 flex items-center max-w-xs shrink-0">
              <Search className="h-4 w-4 text-gray-400 mr-1.5" />
              <input
                type="text"
                placeholder="Filter alarm feed..."
                value={notificationsSearch}
                onChange={(e) => setNotificationsSearch(e.target.value)}
                className="text-xs outline-none bg-transparent w-full text-gray-800"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-120 overflow-y-auto pr-1">
            {liveNotifications
              .filter(n => n.title.toLowerCase().includes(notificationsSearch.toLowerCase()) || n.details.toLowerCase().includes(notificationsSearch.toLowerCase()))
              .map(n => {
                const codeMatch = n.details?.match(/Code:\s*(\d{6})/i);
                const otpCode = codeMatch ? codeMatch[1] : null;
                const isUnlocked = revealedSecurityOtps[n.id];

                return (
                  <div
                    key={n.id}
                    className={`p-4 rounded-xl border flex items-start gap-3 justify-between text-xs transition-colors ${
                      n.severity === 'danger' 
                        ? 'bg-rose-50 border-rose-100 text-rose-950 hover:bg-rose-100/50' 
                        : n.severity === 'warning'
                        ? 'bg-amber-50 border-amber-100 text-amber-950 hover:bg-amber-100/50'
                        : 'bg-emerald-50 border-emerald-100 text-emerald-950 hover:bg-emerald-100/50'
                    }`}
                  >
                    <div className="flex gap-3 flex-1">
                      <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                        n.severity === 'danger' 
                          ? 'bg-rose-100 text-rose-700' 
                          : n.severity === 'warning'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                      
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-gray-900 block text-[11px] uppercase tracking-wide">{n.title}</span>
                          <span className="font-mono text-[9px] text-gray-400 bg-white/60 px-1 py-0.5 rounded border border-gray-100">{n.timestamp}</span>
                        </div>
                        <p className="text-gray-700 leading-relaxed text-[11px] max-w-2xl">
                          {otpCode && !isUnlocked 
                            ? n.details.replace(/Code:\s*\d{6}/i, 'Code: •••••• (LOCKED - Click "See OTP Code" to unmask)')
                            : n.details}
                        </p>

                        {/* Unlocked Security OTP Display Box */}
                        {otpCode && isUnlocked && (
                          <div className="bg-white/80 dark:bg-slate-900/90 border border-amber-300 dark:border-amber-800 p-2.5 rounded-lg flex items-center justify-between gap-3 mt-1.5 shadow-xs animate-fade-in">
                            <div className="flex items-center gap-2">
                              <Key className="h-4 w-4 text-amber-600 shrink-0" />
                              <div>
                                <span className="text-[9px] uppercase font-bold text-amber-800 dark:text-amber-300 block">Security Alert Verified OTP</span>
                                <span className="font-mono text-base font-black text-amber-950 dark:text-amber-100 tracking-wider block">{otpCode}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(otpCode);
                                setCopiedSecurityOtpId(n.id);
                                setTimeout(() => setCopiedSecurityOtpId(null), 2000);
                              }}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                            >
                              {copiedSecurityOtpId === n.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              <span>{copiedSecurityOtpId === n.id ? 'Copied!' : 'Copy Code'}</span>
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[9px] font-bold text-gray-400 block">Status:</span>
                          <span className={`inline-block px-1.5 py-0.5 text-[8px] font-black rounded uppercase border ${
                            n.status === 'Unread' || n.status === 'Active'
                              ? 'bg-red-50 text-red-700 border-red-100'
                              : n.status === 'Investigating'
                              ? 'bg-amber-50 text-amber-700 border-amber-100'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {n.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Operational action tools */}
                    <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                      {otpCode && (
                        <button
                          onClick={() => setRevealedSecurityOtps(prev => ({ ...prev, [n.id]: !prev[n.id] }))}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold p-1 px-2.5 rounded text-[10px] shadow-sm cursor-pointer flex items-center gap-1 transition-colors"
                        >
                          {isUnlocked ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          <span>{isUnlocked ? '🔒 Hide' : '👁️ See OTP Code'}</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          alert(`Dispatched security response checklist for event: ${n.title}`);
                        }}
                        className="bg-white border hover:bg-gray-100 font-bold p-1 px-2.5 rounded text-[10px] text-gray-700 shadow-sm cursor-pointer"
                      >
                        Audit Lock
                      </button>
                      <button
                        onClick={() => {
                          alert(`Alarm flagged as investigated & corporate database notified.`);
                        }}
                        className="bg-white border hover:bg-gray-100 font-bold p-1 px-2.5 rounded text-[10px] text-gray-700 shadow-sm cursor-pointer"
                      >
                        Resolve
                      </button>
                    </div>

                  </div>
                );
              })}

            {liveNotifications.length === 0 && (
              <div className="text-center py-10 text-gray-400 italic">
                No active security or inventory safety alerts on feed.
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 5: AUTOMATED SCHEDULED REPORTING */}
      {activeTab === 'reporting' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* LEFT COLUMN: Report configuration form */}
          <div className="lg:col-span-7 bg-white border border-gray-150 p-6 rounded-xl space-y-6 shadow-sm text-xs text-gray-800">
            <div>
              <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                Automated Scheduled Reporting Engine
              </h4>
              <p className="text-[11px] text-gray-500 mt-1">Configure automated daily &amp; monthly summary audits to keep administrators, quality officers, and branch managers updated via Email and SMS.</p>
            </div>

            {/* Recipients block */}
            <div className="bg-slate-50 border border-slate-200/65 p-4 rounded-xl space-y-3">
              <h5 className="font-bold text-gray-900 flex items-center gap-1.5 text-[10px] uppercase tracking-wide">
                <Users className="h-3.5 w-3.5 text-slate-600" />
                Primary Auditing Recipients
              </h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Recipient Email Address</label>
                  <div className="relative bg-white border border-slate-200 rounded p-2 flex items-center shadow-sm">
                    <Mail className="h-4 w-4 text-gray-400 mr-2 shrink-0" />
                    <input
                      type="email"
                      placeholder="e.g. tariku@enterprise.com"
                      value={reportEmail}
                      onChange={(e) => setReportEmail(e.target.value)}
                      className="w-full text-xs outline-none bg-transparent text-gray-800"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Recipient Phone Number (SMS)</label>
                  <div className="relative bg-white border border-slate-200 rounded p-2 flex items-center shadow-sm">
                    <Phone className="h-4 w-4 text-gray-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      placeholder="e.g. +251912345678"
                      value={reportPhone}
                      onChange={(e) => setReportPhone(e.target.value)}
                      className="w-full text-xs outline-none bg-transparent text-gray-800"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Option blocks */}
            <div className="space-y-4">
              <h5 className="font-bold text-gray-900 text-[10px] uppercase tracking-wide pb-1.5 border-b border-slate-100">Scheduled Report Profiles</h5>

              {/* Profile 1: Daily report */}
              <div className="border border-gray-150 p-4 rounded-xl space-y-3 hover:border-slate-300 transition-colors bg-white">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div>
                    <span className="font-extrabold text-gray-950 block text-[11px] uppercase tracking-wide">1. Daily Sales &amp; Operations Audit</span>
                    <p className="text-[11px] text-gray-500">Includes today's gross revenue, payment breakdown, total orders count, and hot item varieties.</p>
                  </div>
                  <span className="text-[9px] bg-slate-100 text-slate-600 font-mono font-bold px-2 py-0.5 rounded-full uppercase shrink-0 self-start sm:self-center">Every day @ 21:00 UTC</span>
                </div>

                <div className="flex items-center gap-6 text-[11px] pt-1.5 border-t border-dashed border-slate-200">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enableDailyEmail}
                      onChange={(e) => setEnableDailyEmail(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span>Deliver to Email Address</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enableDailyPhone}
                      onChange={(e) => setEnableDailyPhone(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span>Deliver to Phone Number via SMS</span>
                  </label>
                </div>

                <div className="flex gap-2 pt-1.5">
                  <button
                    type="button"
                    onClick={() => runReportSimulation('daily', 'email')}
                    disabled={!enableDailyEmail}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-35 disabled:hover:bg-slate-50 transition-all text-[11px] cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5 text-blue-500" />
                    Simulate Daily Email
                  </button>
                  <button
                    type="button"
                    onClick={() => runReportSimulation('daily', 'phone')}
                    disabled={!enableDailyPhone}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-35 disabled:hover:bg-slate-50 transition-all text-[11px] cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5 text-emerald-600" />
                    Simulate Daily SMS
                  </button>
                </div>
              </div>

              {/* Profile 2: Monthly report */}
              <div className="border border-gray-150 p-4 rounded-xl space-y-3 hover:border-slate-300 transition-colors bg-white">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div>
                    <span className="font-extrabold text-gray-950 block text-[11px] uppercase tracking-wide">2. Monthly Performance Audit &amp; Revenue Balance</span>
                    <p className="text-[11px] text-gray-500">Includes monthly accumulated revenue, individual outlet breakdowns, and cashier audit metrics.</p>
                  </div>
                  <span className="text-[9px] bg-slate-100 text-slate-600 font-mono font-bold px-2 py-0.5 rounded-full uppercase shrink-0 self-start sm:self-center">1st of Month @ 08:00 UTC</span>
                </div>

                <div className="flex items-center gap-6 text-[11px] pt-1.5 border-t border-dashed border-slate-200">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enableMonthlyEmail}
                      onChange={(e) => setEnableMonthlyEmail(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span>Deliver to Email Address</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enableMonthlyPhone}
                      onChange={(e) => setEnableMonthlyPhone(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span>Deliver to Phone Number via SMS</span>
                  </label>
                </div>

                <div className="flex gap-2 pt-1.5">
                  <button
                    type="button"
                    onClick={() => runReportSimulation('monthly', 'email')}
                    disabled={!enableMonthlyEmail}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-35 disabled:hover:bg-slate-50 transition-all text-[11px] cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5 text-blue-500" />
                    Simulate Monthly Email
                  </button>
                  <button
                    type="button"
                    onClick={() => runReportSimulation('monthly', 'phone')}
                    disabled={!enableMonthlyPhone}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-35 disabled:hover:bg-slate-50 transition-all text-[11px] cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5 text-emerald-600" />
                    Simulate Monthly SMS
                  </button>
                </div>
              </div>

              {/* Profile 3: Near Expiry report */}
              <div className="border border-gray-150 p-4 rounded-xl space-y-3 hover:border-slate-300 transition-colors bg-white">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div>
                    <span className="font-extrabold text-gray-950 block text-[11px] uppercase tracking-wide">3. Monthly Near-Expiry Medications Quality Audit</span>
                    <p className="text-[11px] text-gray-500">Auto-scans and lists active catalog batch stock items whose expiration is under 180 days.</p>
                  </div>
                  <span className="text-[9px] bg-slate-100 text-slate-600 font-mono font-bold px-2 py-0.5 rounded-full uppercase shrink-0 self-start sm:self-center">1st of Month @ 07:00 UTC</span>
                </div>

                <div className="flex items-center gap-6 text-[11px] pt-1.5 border-t border-dashed border-slate-200">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enableExpiryEmail}
                      onChange={(e) => setEnableExpiryEmail(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span>Deliver to Email Address</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enableExpiryPhone}
                      onChange={(e) => setEnableExpiryPhone(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span>Deliver to Phone Number via SMS</span>
                  </label>
                </div>

                <div className="flex gap-2 pt-1.5">
                  <button
                    type="button"
                    onClick={() => runReportSimulation('expiry', 'email')}
                    disabled={!enableExpiryEmail}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-35 disabled:hover:bg-slate-50 transition-all text-[11px] cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5 text-blue-500" />
                    Simulate Expiry Email
                  </button>
                  <button
                    type="button"
                    onClick={() => runReportSimulation('expiry', 'phone')}
                    disabled={!enableExpiryPhone}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-35 disabled:hover:bg-slate-50 transition-all text-[11px] cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5 text-emerald-600" />
                    Simulate Expiry SMS
                  </button>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-3 border-t border-slate-150 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  setSavingReportSettings(true);
                  localStorage.setItem('report_email', reportEmail);
                  localStorage.setItem('report_phone', reportPhone);
                  localStorage.setItem('report_daily_email', enableDailyEmail ? 'true' : 'false');
                  localStorage.setItem('report_daily_phone', enableDailyPhone ? 'true' : 'false');
                  localStorage.setItem('report_monthly_email', enableMonthlyEmail ? 'true' : 'false');
                  localStorage.setItem('report_monthly_phone', enableMonthlyPhone ? 'true' : 'false');
                  localStorage.setItem('report_expiry_email', enableExpiryEmail ? 'true' : 'false');
                  localStorage.setItem('report_expiry_phone', enableExpiryPhone ? 'true' : 'false');
                  
                  await new Promise(r => setTimeout(r, 600));
                  setSavingReportSettings(false);
                  alert('Automated scheduled reporting rules successfully saved to corporate local state!');
                }}
                disabled={savingReportSettings}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all text-[11px] cursor-pointer"
              >
                {savingReportSettings ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Saving Parameters...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Save Active Schedule
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Log terminal output / Preview sent report */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-950 text-slate-200 p-5 rounded-xl border border-slate-800 h-full flex flex-col justify-between shadow-lg font-mono text-[11px]">
              <div className="space-y-4 flex-1">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-extrabold text-slate-300 uppercase tracking-wider text-[10px]">Real-Time Dispatch Console</span>
                  </div>
                  <span className="text-[9px] text-slate-500">REPORTER-DAEMON v2.0</span>
                </div>

                {reportLog ? (
                  <div className="space-y-3">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5 text-[10px]">
                      <div className="flex justify-between font-bold text-emerald-400">
                        <span>Event: {reportLog.type} Simulated</span>
                        <span>{reportLog.timestamp}</span>
                      </div>
                      <div className="text-slate-400">
                        <span>Delivery Type: </span>
                        <span className="font-bold text-slate-200 uppercase">{reportLog.format === 'email' ? '📧 Email SMTP' : '💬 Twilio SMS Gateway'}</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg overflow-x-auto max-h-120 whitespace-pre text-slate-300 font-mono text-[10px] leading-relaxed border-t-2 border-t-emerald-500 shadow-inner">
                      {reportLog.content}
                    </div>

                    <div className="bg-emerald-950/20 border border-emerald-900/50 p-3 rounded-lg flex items-center gap-2.5 text-[10px] text-emerald-400 leading-normal">
                      <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
                      <div>
                        <span className="font-extrabold uppercase block text-[10px]">Real-Time Payload Delivered</span>
                        <span className="text-slate-400">Message successfully compiled, parsed against active SQL records, and routed.</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-96 flex flex-col items-center justify-center text-center p-6 space-y-4 text-slate-500">
                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-full">
                      <Send className="h-8 w-8 text-slate-600" />
                    </div>
                    <div className="space-y-1 max-w-xs">
                      <span className="font-extrabold text-slate-400 block uppercase tracking-wider text-[10px]">Ready for Simulation</span>
                      <p className="text-[10px] leading-relaxed">Choose any scheduled profile and click <strong>Simulate</strong> to run real active database queries and preview actual outbound report payloads.</p>
                    </div>

                    <div className="w-full border-t border-slate-900 pt-4 text-left space-y-2 text-[9px] leading-normal text-slate-500 font-sans">
                      <div className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span>Email bodies render detailed rich metrics.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span>SMS payloads compress into punchy snippets.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span>All reports reflect accurate, real-time store stats.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-900 pt-3 flex items-center justify-between text-[9px] text-slate-500 font-mono mt-4">
                <span>Enterprise Pharmacy platform</span>
                <span>Daemon Service Listening ✓</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: INSTITUTION SETTINGS */}
      {activeTab === 'settings' && (
        <div className="bg-white border border-gray-150 p-6 rounded-xl space-y-6 shadow-sm">
          <div>
            <h4 className="text-sm font-bold text-gray-950 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="h-5 w-5 text-emerald-600 animate-pulse" />
              General Institution Profile Configuration
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Configure global pharmacy branding, corporate name registry, registered physical addresses, and official contact attributes.
            </p>
          </div>

          {loadingInst ? (
            <div className="py-12 flex flex-col items-center justify-center text-xs text-gray-400 gap-2 font-semibold">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
              Fetching active configurations...
            </div>
          ) : (
            <form onSubmit={handleSaveInstitution} className="space-y-6 max-w-2xl text-xs text-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-gray-75 block">Pharmacy / Institution Name</label>
                  <input
                    type="text"
                    required
                    value={instName}
                    onChange={(e) => setInstName(e.target.value)}
                    placeholder="e.g. Sonan Pharmacy PLC"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded outline-none font-semibold text-gray-900 focus:border-slate-800"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="font-semibold text-gray-75 block">Registered Corporate Email</label>
                  <input
                    type="email"
                    required
                    value={instEmail}
                    onChange={(e) => setInstEmail(e.target.value)}
                    placeholder="e.g. administration@sonanpharma.com"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded outline-none focus:border-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-75 block">Official Support Phone</label>
                  <input
                    type="text"
                    required
                    value={instPhone}
                    onChange={(e) => setInstPhone(e.target.value)}
                    placeholder="e.g. +251-11-6112233"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded outline-none focus:border-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-75 block">Corporate Head Office Address</label>
                  <input
                    type="text"
                    required
                    value={instAddress}
                    onChange={(e) => setInstAddress(e.target.value)}
                    placeholder="e.g. Bole Subcity, Addis Ababa, Ethiopia"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded outline-none focus:border-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-75 block">Tax Identification Number (TIN)</label>
                  <input
                    type="text"
                    required
                    value={instTin}
                    onChange={(e) => setInstTin(e.target.value)}
                    placeholder="e.g. 1045982736"
                    className="w-full bg-white border border-gray-300 p-2.5 rounded outline-none focus:border-slate-800 font-semibold"
                  />
                </div>

                <div className="space-y-1 col-span-1 md:col-span-2">
                  <label className="font-semibold text-gray-800 dark:text-slate-200 block text-xs">
                    Institutional Logo (Appears on Admin Dashboard & Public Customer Pages)
                  </label>
                  <div className="p-4 bg-gray-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center gap-4">
                      {instLogo ? (
                        <div className="relative w-20 h-20 border-2 border-emerald-500 rounded-xl bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-sm p-1">
                          <img src={instLogo} alt="Institution Logo" className="object-contain w-full h-full" referrerPolicy="no-referrer" />
                          <button
                            type="button"
                            onClick={() => setInstLogo('')}
                            className="absolute top-0 right-0 bg-red-600 text-white rounded-bl-lg p-1 hover:bg-red-700 transition cursor-pointer"
                            title="Remove logo"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl bg-gray-100 dark:bg-slate-800 flex flex-col items-center justify-center shrink-0 text-[10px] text-gray-400 font-bold p-1 text-center">
                          <Building className="w-6 h-6 mb-1 text-slate-400" />
                          <span>No Logo</span>
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <div>
                          <label className="font-bold text-[11px] text-slate-700 dark:text-slate-300 block mb-1">Option 1: Upload Logo File (PNG, JPG, SVG)</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-700 file:text-white hover:file:bg-emerald-800 cursor-pointer w-full"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-[11px] text-slate-700 dark:text-slate-300 block mb-1">Option 2: Or Paste Direct Image / Logo URL</label>
                          <input
                            type="url"
                            value={instLogo}
                            onChange={(e) => setInstLogo(e.target.value)}
                            placeholder="https://example.com/logo.png"
                            className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 p-2 rounded-lg text-xs outline-none focus:border-emerald-600 font-mono text-[11px]"
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 block">
                          This logo will be displayed prominently across customer store headers, receipts, track order popups, and corporate documents.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Promotional Video Management Section */}
              <div className="border-t border-gray-200 pt-5 space-y-4 text-xs text-gray-800">
                <div>
                  <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-emerald-600" /> Customer Store Promotional Videos & Popups
                  </h5>
                  <p className="text-[10px] text-gray-500">
                    Upload MP4/WebM video files or paste video URLs to showcase promotional video banners & full-screen popups for store customers.
                  </p>
                </div>

                {/* Add New Promo Video Box */}
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <h6 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5 text-emerald-600" /> Add New Promotional Video
                  </h6>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700 block text-[11px]">Video Title *</label>
                      <input
                        type="text"
                        value={newVideoTitle}
                        onChange={(e) => setNewVideoTitle(e.target.value)}
                        placeholder="e.g. Grand Opening Sale - 20% Off Cosmetics!"
                        className="w-full bg-white border border-gray-300 p-2 rounded outline-none text-xs focus:border-emerald-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700 block text-[11px]">Short Description / Call to Action</label>
                      <input
                        type="text"
                        value={newVideoDesc}
                        onChange={(e) => setNewVideoDesc(e.target.value)}
                        placeholder="e.g. Discover our wide selection of skincare products and medicines."
                        className="w-full bg-white border border-gray-300 p-2 rounded outline-none text-xs focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700 block text-[11px]">Option A: Upload Video File (MP4, WebM)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="video/*"
                          onChange={handleVideoFileUpload}
                          className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-700 file:text-white hover:file:bg-emerald-800 cursor-pointer w-full"
                        />
                        {uploadingVideo && <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />}
                      </div>
                      <span className="text-[10px] text-gray-400 block">Max 25MB file upload. Converts file to Data URL.</span>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700 block text-[11px]">Option B: Or Direct Video / MP4 / YouTube URL</label>
                      <input
                        type="url"
                        value={newVideoUrl}
                        onChange={(e) => setNewVideoUrl(e.target.value)}
                        placeholder="https://...mp4 or https://youtube.com/embed/..."
                        className="w-full bg-white border border-gray-300 p-2 rounded outline-none text-xs focus:border-emerald-600 font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  {newVideoUrl && (
                    <div className="p-2.5 bg-white border rounded-lg space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Preview Selected Video:</span>
                      {newVideoUrl.startsWith('data:video') || newVideoUrl.endsWith('.mp4') || newVideoUrl.endsWith('.webm') || newVideoUrl.includes('googleapis') ? (
                        <video src={newVideoUrl} controls className="w-full max-h-40 object-cover rounded-lg bg-black" />
                      ) : (
                        <div className="text-xs text-blue-600 underline font-mono truncate">{newVideoUrl}</div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newVideoActive}
                        onChange={(e) => setNewVideoActive(e.target.checked)}
                        className="rounded text-emerald-600"
                      />
                      <span className="font-bold text-xs text-slate-700">Set as Active Video Popup for Customers</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleAddPromoVideo}
                      className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Video to List
                    </button>
                  </div>
                </div>

                {/* List of Existing Promo Videos */}
                <div className="space-y-2">
                  <h6 className="font-bold text-slate-800 text-xs">Current Active Promotional Videos ({promoVideos.length})</h6>
                  {promoVideos.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic">No promotional videos added yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {promoVideos.map((vid, idx) => (
                        <div key={vid.id || idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h6 className="font-bold text-slate-900 text-xs flex items-center gap-1">
                                <Film className="w-3.5 h-3.5 text-amber-500 shrink-0" /> {vid.title}
                              </h6>
                              {vid.description && (
                                <p className="text-[11px] text-slate-500 line-clamp-1">{vid.description}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setPromoVideos(prev => prev.filter(v => v.id !== vid.id))}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition cursor-pointer shrink-0"
                              title="Delete Video"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Video Thumbnail / Preview */}
                          <div className="relative rounded-lg overflow-hidden bg-slate-900 border border-slate-200 max-h-36 flex items-center justify-center">
                            {vid.videoUrl.startsWith('data:video') || vid.videoUrl.endsWith('.mp4') || vid.videoUrl.endsWith('.webm') || vid.videoUrl.includes('googleapis') ? (
                              <video src={vid.videoUrl} controls className="w-full max-h-36 object-cover" />
                            ) : (
                              <iframe src={vid.videoUrl} className="w-full h-36" title={vid.title} />
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-1">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={vid.active !== false}
                                onChange={(e) => {
                                  const updated = promoVideos.map(v => v.id === vid.id ? { ...v, active: e.target.checked } : v);
                                  setPromoVideos(updated);
                                }}
                                className="rounded text-emerald-600"
                              />
                              <span className={vid.active !== false ? 'font-bold text-emerald-700' : 'text-slate-400'}>
                                {vid.active !== false ? 'Active (Shows in Popup)' : 'Hidden'}
                              </span>
                            </label>
                            <span className="text-[10px] text-slate-400">
                              {vid.createdAt ? new Date(vid.createdAt).toLocaleDateString() : 'Active'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Selective Customer Popup Items & Special Deals Section */}
              <div className="border-t border-gray-200 pt-5 space-y-4 text-xs text-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" /> Selective Customer Store Popups & Featured Deals
                    </h5>
                    <p className="text-[10px] text-gray-500">
                      Configure handpicked products, special promotional discounts, and custom popups that automatically display to customers visiting the online store.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                    <input
                      type="checkbox"
                      checked={!!selectivePopupConfig?.enabled}
                      onChange={(e) => setSelectivePopupConfig({ ...selectivePopupConfig, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                    <span className="ml-2 font-extrabold text-xs text-amber-950">
                      {selectivePopupConfig?.enabled ? 'Selective Popups Enabled' : 'Popups Disabled'}
                    </span>
                  </label>
                </div>

                {/* Popup Header & Timing Settings */}
                <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <h6 className="font-bold text-amber-900 text-xs flex items-center gap-1">
                    <Megaphone className="w-3.5 h-3.5 text-amber-600" /> Customer Popup Display Banner Configuration
                  </h6>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700 block text-[11px]">Popup Banner Main Title</label>
                      <input
                        type="text"
                        value={selectivePopupConfig?.popupTitle || ''}
                        onChange={(e) => setSelectivePopupConfig({ ...selectivePopupConfig, popupTitle: e.target.value })}
                        placeholder="e.g. 🔥 Today's Special Deals & Featured Highlights!"
                        className="w-full bg-white border border-gray-300 p-2 rounded outline-none text-xs focus:border-amber-600 font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700 block text-[11px]">Popup Banner Subtitle</label>
                      <input
                        type="text"
                        value={selectivePopupConfig?.popupSubtitle || ''}
                        onChange={(e) => setSelectivePopupConfig({ ...selectivePopupConfig, popupSubtitle: e.target.value })}
                        placeholder="e.g. Handpicked discounts and high quality health products selected for you"
                        className="w-full bg-white border border-gray-300 p-2 rounded outline-none text-xs focus:border-amber-600"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    <div className="flex items-center gap-3">
                      <label className="font-semibold text-gray-700 text-[11px]">Auto-Show Popup Delay (Seconds):</label>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={selectivePopupConfig?.autoShowDelaySeconds ?? 2}
                        onChange={(e) => setSelectivePopupConfig({ ...selectivePopupConfig, autoShowDelaySeconds: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-20 bg-white border border-gray-300 p-1.5 rounded outline-none text-xs text-center font-bold"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectivePopupConfig?.showOncePerSession !== false}
                        onChange={(e) => setSelectivePopupConfig({ ...selectivePopupConfig, showOncePerSession: e.target.checked })}
                        className="rounded text-amber-600"
                      />
                      <span className="font-semibold text-xs text-slate-700">Display Popup Only Once Per Customer Session</span>
                    </label>
                  </div>
                </div>

                {/* Add New Selective Popup Item Box */}
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <h6 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5 text-amber-600" /> Add Selective Item / Special Deal to Popup
                  </h6>

                  {/* Pick Existing Medicine Dropdown */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <label className="font-bold text-slate-800 block text-[11px]">
                      Quick Select from Medicine / Cosmetic Inventory (Auto-fills Details):
                    </label>
                    <select
                      value={newPopupMedId}
                      onChange={(e) => handleSelectMedForPopup(e.target.value)}
                      className="w-full bg-slate-50 border border-gray-300 p-2 rounded outline-none text-xs font-semibold focus:border-amber-600"
                    >
                      <option value="">-- Choose an item from registered stock catalog (Optional) --</option>
                      {medicines.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.genericName ? `(${m.genericName})` : ''} - ETB {m.price} [{m.category || 'General'}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1 md:col-span-2">
                      <label className="font-semibold text-gray-700 block text-[11px]">Popup Item Title *</label>
                      <input
                        type="text"
                        value={newPopupTitle}
                        onChange={(e) => setNewPopupTitle(e.target.value)}
                        placeholder="e.g. Amoxicillin 500mg Antibiotic Special"
                        className="w-full bg-white border border-gray-300 p-2 rounded outline-none text-xs focus:border-amber-600 font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700 block text-[11px]">Highlight Badge / Tag</label>
                      <input
                        type="text"
                        value={newPopupBadge}
                        onChange={(e) => setNewPopupBadge(e.target.value)}
                        placeholder="e.g. 🔥 20% OFF Deal, ⭐ Editor's Pick"
                        className="w-full bg-white border border-gray-300 p-2 rounded outline-none text-xs focus:border-amber-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700 block text-[11px]">Subtitle / Category Tag</label>
                      <input
                        type="text"
                        value={newPopupSubtitle}
                        onChange={(e) => setNewPopupSubtitle(e.target.value)}
                        placeholder="e.g. Broad Spectrum Treatment"
                        className="w-full bg-white border border-gray-300 p-2 rounded outline-none text-xs focus:border-amber-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700 block text-[11px]">Special Popup Price (ETB)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={newPopupPrice}
                        onChange={(e) => {
                          const val = e.target.value.replace(',', '.');
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setNewPopupPrice(val);
                          }
                        }}
                        placeholder="e.g. 144.50"
                        className="w-full bg-white border border-gray-300 p-2 rounded outline-none text-xs font-bold text-emerald-700 focus:border-amber-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700 block text-[11px]">Original Price Strikethrough (ETB)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={newPopupOrigPrice}
                        onChange={(e) => {
                          const val = e.target.value.replace(',', '.');
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setNewPopupOrigPrice(val);
                          }
                        }}
                        placeholder="e.g. 180.00"
                        className="w-full bg-white border border-gray-300 p-2 rounded outline-none text-xs focus:border-amber-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700 block text-[11px]">Description / Offer Details</label>
                      <input
                        type="text"
                        value={newPopupDesc}
                        onChange={(e) => setNewPopupDesc(e.target.value)}
                        placeholder="e.g. Certified prescription antibiotic capsules for daily health care."
                        className="w-full bg-white border border-gray-300 p-2 rounded outline-none text-xs focus:border-amber-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-gray-700 block text-[11px]">Image URL (Optional)</label>
                      <input
                        type="url"
                        value={newPopupImageUrl}
                        onChange={(e) => setNewPopupImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full bg-white border border-gray-300 p-2 rounded outline-none text-xs focus:border-amber-600 font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPopupActive}
                        onChange={(e) => setNewPopupActive(e.target.checked)}
                        className="rounded text-amber-600"
                      />
                      <span className="font-bold text-xs text-slate-700">Set as Active in Customer Popup</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleAddSelectivePopupItem}
                      className="px-4 py-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Add Item to Selective Popup List
                    </button>
                  </div>
                </div>

                {/* List of Configured Selective Popup Items */}
                <div className="space-y-2">
                  <h6 className="font-bold text-slate-800 text-xs">
                    Current Configured Selective Popup Items ({selectivePopupConfig?.items?.length || 0})
                  </h6>

                  {(!selectivePopupConfig?.items || selectivePopupConfig.items.length === 0) ? (
                    <p className="text-[11px] text-gray-400 italic bg-white p-4 rounded-xl border text-center">
                      No selective items added yet. Choose a product above or create a deal to feature in customer popups.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {selectivePopupConfig.items.map((item: any, idx: number) => (
                        <div key={item.id || idx} className="p-3.5 bg-white border border-amber-200 rounded-xl space-y-2 shadow-xs relative">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              {item.badge && (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                                  {item.badge}
                                </span>
                              )}
                              <h6 className="font-extrabold text-slate-900 text-xs leading-tight">
                                {item.title}
                              </h6>
                              {item.subtitle && (
                                <p className="text-[10px] text-slate-500">{item.subtitle}</p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectivePopupConfig((prev: any) => ({
                                  ...prev,
                                  items: prev.items.filter((it: any) => it.id !== item.id)
                                }));
                              }}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition cursor-pointer shrink-0"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {item.imageUrl && (
                            <div className="h-24 w-full rounded-lg overflow-hidden bg-slate-100 border flex items-center justify-center">
                              <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                            </div>
                          )}

                          {item.description && (
                            <p className="text-[10px] text-slate-600 line-clamp-2 italic">{item.description}</p>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                            <div className="flex items-baseline gap-1.5">
                              {item.price !== undefined && (
                                <span className="font-black text-emerald-700">ETB {item.price}</span>
                              )}
                              {item.originalPrice !== undefined && (
                                <span className="text-[10px] text-slate-400 line-through">ETB {item.originalPrice}</span>
                              )}
                            </div>

                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.active !== false}
                                onChange={(e) => {
                                  const updated = selectivePopupConfig.items.map((it: any) =>
                                    it.id === item.id ? { ...it, active: e.target.checked } : it
                                  );
                                  setSelectivePopupConfig({ ...selectivePopupConfig, items: updated });
                                }}
                                className="rounded text-amber-600"
                              />
                              <span className={item.active !== false ? 'font-bold text-xs text-amber-800' : 'text-xs text-slate-400'}>
                                {item.active !== false ? 'Active' : 'Off'}
                              </span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-5 space-y-4 text-xs text-gray-800">
                <div>
                  <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1">
                    <span>🖨️</span> Physical Cash Register Connection Defaults
                  </h5>
                  <p className="text-[10px] text-gray-400">Configure default cash lanes, receipt models, printer paper sizes, and interface connection parameters.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-gray-75 block">Register Terminal ID</label>
                    <input
                      type="text"
                      value={cashRegister.id}
                      onChange={(e) => setCashRegister({ ...cashRegister, id: e.target.value })}
                      className="w-full bg-white border border-gray-300 p-2.5 rounded outline-none focus:border-slate-800 font-mono"
                      placeholder="e.g. CR-01"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="font-semibold text-gray-75 block">Model / Manufacturer Class</label>
                    <select
                      value={cashRegister.model}
                      onChange={(e) => setCashRegister({ ...cashRegister, model: e.target.value })}
                      className="w-full bg-white border border-gray-300 p-2.5 rounded outline-none focus:border-slate-800 font-semibold text-xs"
                    >
                      <option value="Epson TM-T88VI Thermal">Epson TM-T88VI Thermal</option>
                      <option value="Casio SE-S400 Fiscal">Casio SE-S400 Fiscal</option>
                      <option value="Star Micronics mC-Print3">Star Micronics mC-Print3</option>
                      <option value="Bixolon SRP-350plusIII">Bixolon SRP-350plusIII</option>
                      <option value="Generic 58mm POS Printer">Generic 58mm POS Printer</option>
                      <option value="Generic 80mm POS Printer">Generic 80mm POS Printer</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-gray-75 block">Port / Interface Connection</label>
                    <select
                      value={cashRegister.port}
                      onChange={(e) => setCashRegister({ ...cashRegister, port: e.target.value })}
                      className="w-full bg-white border border-gray-300 p-2.5 rounded outline-none focus:border-slate-800 text-xs"
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
                    <label className="font-semibold text-gray-75 block">Baud Rate (COM Speed)</label>
                    <select
                      value={cashRegister.baudRate}
                      onChange={(e) => setCashRegister({ ...cashRegister, baudRate: e.target.value })}
                      className="w-full bg-white border border-gray-300 p-2.5 rounded outline-none focus:border-slate-800 font-mono text-xs"
                    >
                      <option value="9600">9600 bps</option>
                      <option value="19200">19200 bps</option>
                      <option value="38400">38400 bps</option>
                      <option value="115200">115200 bps</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-gray-75 block">Paper Width Size</label>
                    <select
                      value={cashRegister.paperWidth}
                      onChange={(e) => setCashRegister({ ...cashRegister, paperWidth: e.target.value })}
                      className="w-full bg-white border border-gray-300 p-2.5 rounded outline-none focus:border-slate-800 text-xs"
                    >
                      <option value="80mm">80 mm (Standard POS)</option>
                      <option value="58mm">58 mm (Compact Terminal)</option>
                      <option value="A4">A4 Page Printer</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-gray-75 block">Terminal Operation Status</label>
                    <div className="flex items-center gap-2 pt-3">
                      <input
                        type="checkbox"
                        id="inst-cr-active-toggle"
                        checked={cashRegister.isActive}
                        onChange={(e) => setCashRegister({ ...cashRegister, isActive: e.target.checked })}
                        className="rounded border-gray-300 text-emerald-600 bg-white"
                      />
                      <label htmlFor="inst-cr-active-toggle" className="font-bold text-emerald-800">
                        Active / Connected
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-75 block">Custom Receipt Header Text</label>
                  <input
                    type="text"
                    value={cashRegister.headerText}
                    onChange={(e) => setCashRegister({ ...cashRegister, headerText: e.target.value })}
                    className="w-full bg-white border border-gray-300 p-2.5 rounded outline-none focus:border-slate-800 text-xs"
                    placeholder="e.g. Sonan Pharmacy Lane #1"
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200/60 rounded-xl leading-relaxed text-[11px] text-amber-800 flex gap-2.5">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <span className="font-bold block text-amber-900 mb-0.5">Corporate Notice</span>
                  These configuration attributes are permanently bound to generated document invoices, receipts, transfers, and automated reports. Altering these attributes will immediately affect all outbound SMTP/SMS template structures.
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end">
                <button
                  type="submit"
                  disabled={savingInst}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-6 rounded-lg shadow cursor-pointer transition-colors"
                >
                  {savingInst ? 'Synchronizing settings...' : 'Save Institution Profile'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 7: EMAIL DISPATCH LOGS */}
      {activeTab === 'emails' && (
        <div className="bg-white border border-gray-150 p-5 rounded-xl space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-2 border-b gap-3">
            <div>
              <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-emerald-600" />
                Live Automated Security Email Logs
              </h4>
              <p className="text-[11px] text-gray-500">
                Security notifications, login alerts, and system-triggered OTP verification emails sent to administrators.
              </p>
            </div>
            
            <button
              onClick={fetchEmailLogs}
              disabled={loadingEmails}
              className="bg-gray-100 hover:bg-gray-200 border text-gray-800 font-bold text-xs py-1.5 px-3 rounded flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${loadingEmails ? 'animate-spin' : ''}`} />
              Sync Logs
            </button>
          </div>

          <div className="space-y-3 max-h-120 overflow-y-auto pr-1">
            {emailLogs.map((email: any) => (
              <div
                key={email.id}
                className="p-4 rounded-xl border border-gray-150 bg-slate-50/50 hover:bg-slate-50 text-xs transition-colors space-y-2.5"
              >
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-gray-900 block text-[11px] uppercase tracking-wide">
                        {email.subject}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {email.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500 font-mono">
                      <span><b>From:</b> {email.from}</span>
                      <span><b>To:</b> {email.to}</span>
                    </div>
                  </div>
                  <span className="font-mono text-[9px] text-gray-400 bg-white px-1 py-0.5 rounded border">
                    {new Date(email.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-gray-100 font-mono text-[10.5px] leading-relaxed text-gray-700 whitespace-pre-wrap">
                  {email.body}
                </div>
              </div>
            ))}

            {emailLogs.length === 0 && (
              <div className="text-center py-12 text-gray-400 italic">
                {loadingEmails ? 'Syncing security email logs...' : 'No automated security emails have been dispatched yet.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: SITE VISITORS & TRAFFIC ANALYTICS */}
      {activeTab === 'visitors' && (
        <div className="space-y-6">
          {/* Main Top Header */}
          <div className="bg-white border border-gray-150 p-5 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-3 border-b gap-3">
              <div>
                <h4 className="text-sm font-bold text-gray-950 uppercase tracking-wider flex items-center gap-2">
                  <Globe className="h-5 w-5 text-sky-600" />
                  Site Visitors &amp; Online Pharmacy Traffic Analytics
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Real-time monitoring of people visiting your pharmacy store, visit frequencies, active sessions, and customer interaction logs.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchVisitorStats}
                  disabled={loadingVisitors}
                  className="bg-slate-100 hover:bg-slate-200 border text-slate-800 font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingVisitors ? 'animate-spin' : ''}`} />
                  Sync Live Traffic
                </button>

                <button
                  onClick={async () => {
                    if (confirm('Are you sure you want to reset all recorded visitor analytics logs? This action cannot be undone.')) {
                      try {
                        const res = await fetch('/api/analytics/visitors', { method: 'DELETE' });
                        if (res.ok) {
                          fetchVisitorStats();
                        }
                      } catch (err) {
                        console.error(err);
                      }
                    }
                  }}
                  className="bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Clear traffic history"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Reset Logs
                </button>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 space-y-1">
                <div className="flex items-center justify-between text-sky-800">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Unique People</span>
                  <Users className="h-4 w-4 text-sky-600" />
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {visitorStats?.totalUniqueVisitors ?? 0}
                </div>
                <div className="text-[10px] text-sky-700 font-medium">
                  Distinct visitors identified
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 space-y-1">
                <div className="flex items-center justify-between text-indigo-800">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Total Visits</span>
                  <Repeat className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {visitorStats?.totalVisits ?? 0}
                </div>
                <div className="text-[10px] text-indigo-700 font-medium">
                  Cumulative store visit sessions
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 space-y-1">
                <div className="flex items-center justify-between text-emerald-800">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Active Now</span>
                  <Activity className="h-4 w-4 text-emerald-600 animate-pulse" />
                </div>
                <div className="text-2xl font-black text-emerald-700 font-mono flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping"></span>
                  {visitorStats?.activeNow ?? 0}
                </div>
                <div className="text-[10px] text-emerald-700 font-medium">
                  Active in past 5 minutes
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 space-y-1">
                <div className="flex items-center justify-between text-amber-800">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Page Views</span>
                  <Eye className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {visitorStats?.totalPageViews ?? 0}
                </div>
                <div className="text-[10px] text-amber-700 font-medium">
                  Total screens &amp; catalog views
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 space-y-1 col-span-2 md:col-span-1">
                <div className="flex items-center justify-between text-rose-800">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Returning Rate</span>
                  <UserCheck className="h-4 w-4 text-rose-600" />
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {visitorStats?.returningRatePercentage ?? 0}%
                </div>
                <div className="text-[10px] text-rose-700 font-medium">
                  {visitorStats?.returningVisitorsCount ?? 0} repeat customers
                </div>
              </div>
            </div>

            {/* Breakdown Meters: Devices & Browsers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Device breakdown */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Laptop className="h-4 w-4 text-slate-600" />
                    Device Distribution
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Total: {visitorStats?.totalUniqueVisitors || 0}
                  </span>
                </div>
                {(() => {
                  const total = visitorStats?.totalUniqueVisitors || 1;
                  const mobile = visitorStats?.deviceBreakdown?.mobile || 0;
                  const desktop = visitorStats?.deviceBreakdown?.desktop || 0;
                  const tablet = visitorStats?.deviceBreakdown?.tablet || 0;
                  const mobPct = Math.round((mobile / total) * 100);
                  const dskPct = Math.round((desktop / total) * 100);
                  const tabPct = Math.round((tablet / total) * 100);

                  return (
                    <div className="space-y-2">
                      <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
                        <div style={{ width: `${dskPct}%` }} className="bg-sky-500" title={`Desktop: ${desktop} (${dskPct}%)`} />
                        <div style={{ width: `${mobPct}%` }} className="bg-emerald-500" title={`Mobile: ${mobile} (${mobPct}%)`} />
                        <div style={{ width: `${tabPct}%` }} className="bg-amber-500" title={`Tablet: ${tablet} (${tabPct}%)`} />
                      </div>
                      <div className="flex justify-between text-[11px] font-medium text-slate-600">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-sky-500"></span> Desktop ({desktop} • {dskPct}%)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Mobile ({mobile} • {mobPct}%)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-amber-500"></span> Tablet ({tablet} • {tabPct}%)
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Browser breakdown */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-slate-600" />
                    Web Browser Types
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Chrome, Safari, Firefox, Edge
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="bg-white px-2.5 py-1 rounded-lg border text-slate-700 font-medium flex items-center gap-1">
                    🌐 Chrome: <b className="font-mono">{visitorStats?.browserBreakdown?.chrome || 0}</b>
                  </span>
                  <span className="bg-white px-2.5 py-1 rounded-lg border text-slate-700 font-medium flex items-center gap-1">
                    🧭 Safari: <b className="font-mono">{visitorStats?.browserBreakdown?.safari || 0}</b>
                  </span>
                  <span className="bg-white px-2.5 py-1 rounded-lg border text-slate-700 font-medium flex items-center gap-1">
                    🦊 Firefox: <b className="font-mono">{visitorStats?.browserBreakdown?.firefox || 0}</b>
                  </span>
                  <span className="bg-white px-2.5 py-1 rounded-lg border text-slate-700 font-medium flex items-center gap-1">
                    🌊 Edge: <b className="font-mono">{visitorStats?.browserBreakdown?.edge || 0}</b>
                  </span>
                  <span className="bg-white px-2.5 py-1 rounded-lg border text-slate-700 font-medium flex items-center gap-1">
                    📱 Other: <b className="font-mono">{visitorStats?.browserBreakdown?.other || 0}</b>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white border border-gray-150 p-4 rounded-xl shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              {/* Filter pills */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setVisitorFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    visitorFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  All Visitors ({visitorStats?.totalUniqueVisitors || 0})
                </button>
                <button
                  onClick={() => setVisitorFilter('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    visitorFilter === 'active'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active Now ({visitorStats?.activeNow || 0})
                </button>
                <button
                  onClick={() => setVisitorFilter('returning')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    visitorFilter === 'returning'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800'
                  }`}
                >
                  🔁 Returning ({visitorStats?.returningVisitorsCount || 0})
                </button>
                <button
                  onClick={() => setVisitorFilter('today')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    visitorFilter === 'today'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                  }`}
                >
                  📅 Today's Visitors
                </button>
              </div>

              {/* Search input */}
              <div className="relative min-w-[240px]">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={visitorSearch}
                  onChange={(e) => setVisitorSearch(e.target.value)}
                  placeholder="Search by ID, device, browser, page..."
                  className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-1.5 rounded-lg text-xs outline-none focus:border-slate-800"
                />
                {visitorSearch && (
                  <button
                    onClick={() => setVisitorSearch('')}
                    className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Visitors Table List */}
            {(() => {
              const now = Date.now();
              const fiveMinAgo = now - (5 * 60 * 1000);
              const todayIso = new Date().toISOString().slice(0, 10);

              let list = visitorStats?.recentVisitors || [];

              if (visitorFilter === 'active') {
                list = list.filter(v => (v.lastActiveTimestamp || 0) >= fiveMinAgo);
              } else if (visitorFilter === 'returning') {
                list = list.filter(v => (v.visitCount || 1) > 1);
              } else if (visitorFilter === 'today') {
                list = list.filter(v => (v.lastSeen || '').startsWith(todayIso));
              }

              if (visitorSearch.trim()) {
                const q = visitorSearch.toLowerCase();
                list = list.filter(v =>
                  v.id.toLowerCase().includes(q) ||
                  (v.device || '').toLowerCase().includes(q) ||
                  (v.browser || '').toLowerCase().includes(q) ||
                  (v.os || '').toLowerCase().includes(q) ||
                  (v.lastPage || '').toLowerCase().includes(q) ||
                  (v.lastAction || '').toLowerCase().includes(q)
                );
              }

              if (list.length === 0) {
                return (
                  <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed text-slate-400 space-y-2">
                    <Globe className="h-8 w-8 mx-auto text-slate-300" />
                    <p className="text-xs font-semibold">No visitor traffic records match the current filter.</p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3">Visitor Identity</th>
                        <th className="py-3 px-3">Visits Count</th>
                        <th className="py-3 px-3">Device / OS</th>
                        <th className="py-3 px-3">Browser</th>
                        <th className="py-3 px-3">Pageviews</th>
                        <th className="py-3 px-3">Last Active</th>
                        <th className="py-3 px-3">Last Action</th>
                        <th className="py-3 px-3 text-right">Activity Trail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {list.map((v) => {
                        const isLive = (v.lastActiveTimestamp || 0) >= fiveMinAgo;
                        const isReturning = (v.visitCount || 1) > 1;

                        return (
                          <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                <div>
                                  <div className="font-mono font-bold text-slate-900 text-[11px]">
                                    {v.id.substring(0, 16)}...
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    {isReturning ? (
                                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8.5px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        Repeat Visitor
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8.5px] font-extrabold bg-slate-100 text-slate-600 border">
                                        First-time
                                      </span>
                                    )}
                                    {isLive && (
                                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8.5px] font-black bg-emerald-100 text-emerald-800">
                                        Live
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="font-mono font-black text-slate-800 text-xs">
                                {v.visitCount || 1} {v.visitCount === 1 ? 'time' : 'times'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                First: {v.firstSeen ? new Date(v.firstSeen).toLocaleDateString() : 'Today'}
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-800 flex items-center gap-1">
                                {v.device === 'Mobile' ? '📱' : v.device === 'Tablet' ? '📟' : '💻'} {v.device || 'Desktop'}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                OS: {v.os || 'Windows'}
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700">
                                {v.browser || 'Chrome'}
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <span className="font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                {v.pageViewCount || 1} pages
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <div className="font-medium text-slate-700 text-[11px]">
                                {v.lastSeen ? new Date(v.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {v.lastSeen ? new Date(v.lastSeen).toLocaleDateString() : ''}
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="text-slate-800 font-semibold truncate max-w-[160px]" title={v.lastAction || 'Browsing Store'}>
                                {v.lastAction || 'Browsing Store'}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]">
                                {v.lastPage || '/store'}
                              </div>
                            </td>

                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => setSelectedVisitorForDetail(v)}
                                className="bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold py-1 px-2.5 rounded-lg border border-sky-200 text-[11px] transition cursor-pointer"
                              >
                                View Journey ({v.activities?.length || 1})
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: Visitor Activity Log Journey */}
      {selectedVisitorForDetail && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-150 text-xs text-gray-800 animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                  <MousePointer className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Visitor Interaction Journey</h3>
                  <p className="text-[11px] text-gray-500 font-mono">ID: {selectedVisitorForDetail.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVisitorForDetail(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Visitor Specs Banner */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border text-[11px]">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Total Visits</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {selectedVisitorForDetail.visitCount || 1} times
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Device &amp; OS</span>
                <span className="font-semibold text-slate-800">
                  {selectedVisitorForDetail.device} • {selectedVisitorForDetail.os}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Total Pages</span>
                <span className="font-mono font-bold text-amber-700">
                  {selectedVisitorForDetail.pageViewCount || 1} views
                </span>
              </div>
            </div>

            {/* Timestamped Journey Trail */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Activity History &amp; Actions Log:
              </span>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {(selectedVisitorForDetail.activities || []).map((act, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 transition flex items-start justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 text-[11.5px] flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                        {act.action}
                      </div>
                      {act.details && (
                        <p className="text-[11px] text-slate-600 leading-tight">
                          {act.details}
                        </p>
                      )}
                      {act.page && (
                        <span className="font-mono text-[9.5px] text-slate-400">
                          Route: {act.page}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[9.5px] text-slate-400 whitespace-nowrap bg-slate-50 px-1.5 py-0.5 rounded border">
                      {act.timestamp}
                    </span>
                  </div>
                ))}

                {(!selectedVisitorForDetail.activities || selectedVisitorForDetail.activities.length === 0) && (
                  <p className="text-center py-6 text-gray-400 italic">No specific action logs recorded for this visitor session.</p>
                )}
              </div>
            </div>

            <div className="pt-2 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedVisitorForDetail(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-5 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Close Journey
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add User account */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-150 text-xs text-gray-800">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-3 mb-4">Register User System Account</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">User ID Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. tariku_sk"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Operator Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariku Alemu"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Corporate Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@sonanpharma.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Corporate Phone Number (for OTP)</label>
                <input
                  type="text"
                  placeholder="e.g. +251-91-1223344"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Security Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-white border p-2 rounded outline-none text-gray-700"
                  >
                    <option value="Super Administrator">Super Administrator</option>
                    <option value="Branch Manager">Branch Manager</option>
                    <option value="Pharmacist">Pharmacist</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Store Keeper">Store Keeper</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Auditor">Auditor</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Assign Location</label>
                  <select
                    value={newBranchId}
                    onChange={(e) => setNewBranchId(e.target.value)}
                    className="w-full bg-white border p-2 rounded outline-none text-gray-700"
                  >
                    <option value="all">All Branches (Global)</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Corporate Password Secret</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded border border-slate-150">
                <input
                  type="checkbox"
                  id="newTwoFactorEnabled"
                  checked={newTwoFactorEnabled}
                  onChange={(e) => setNewTwoFactorEnabled(e.target.checked)}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded cursor-pointer"
                />
                <label htmlFor="newTwoFactorEnabled" className="font-semibold text-gray-700 cursor-pointer select-none">
                  Activate Login OTP (Two-Factor 2FA)
                </label>
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button type="button" onClick={() => setShowUserModal(false)} className="bg-white border py-2 px-4 rounded text-gray-700 font-medium">Cancel</button>
                <button type="submit" disabled={userSubmitting} className="bg-emerald-600 text-white font-bold py-2 px-5 rounded">
                  {userSubmitting ? 'Saving...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User account */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-150 text-xs text-gray-800">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-3 mb-4">Edit User Account</h3>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">User ID Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. tariku_sk"
                  value={editUsername}
                  disabled={editingUser.username === 'admin'}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Operator Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariku Alemu"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Corporate Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@sonanpharma.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Corporate Phone Number (for OTP)</label>
                <input
                  type="text"
                  placeholder="e.g. +251-91-1223344"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Security Role</label>
                  <select
                    value={editRole}
                    disabled={editingUser.username === 'admin'}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full bg-white border p-2 rounded outline-none text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="Super Administrator">Super Administrator</option>
                    <option value="Branch Manager">Branch Manager</option>
                    <option value="Pharmacist">Pharmacist</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Store Keeper">Store Keeper</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Auditor">Auditor</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Assign Location</label>
                  <select
                    value={editBranchId}
                    disabled={editingUser.username === 'admin'}
                    onChange={(e) => setEditBranchId(e.target.value)}
                    className="w-full bg-white border p-2 rounded outline-none text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="all">All Branches (Global)</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">
                  New Password <span className="text-[10px] text-gray-400 font-normal">(Leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded border border-slate-150">
                <input
                  type="checkbox"
                  id="editTwoFactorEnabled"
                  checked={editTwoFactorEnabled}
                  onChange={(e) => setEditTwoFactorEnabled(e.target.checked)}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded cursor-pointer"
                />
                <label htmlFor="editTwoFactorEnabled" className="font-semibold text-gray-700 cursor-pointer select-none">
                  Activate Login OTP (Two-Factor 2FA)
                </label>
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUserModal(false);
                    setEditingUser(null);
                  }}
                  className="bg-white border py-2 px-4 rounded text-gray-700 font-medium"
                >
                  Cancel
                </button>
                <button type="submit" disabled={editUserSubmitting} className="bg-blue-600 text-white font-bold py-2 px-5 rounded">
                  {editUserSubmitting ? 'Updating...' : 'Update Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Send Direct Message to User */}
      {showSendMessageModal && messagingUser && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-150 text-xs text-gray-800 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Send Message to User</h3>
                  <p className="text-[10px] text-gray-500">Target: <span className="font-bold text-indigo-700">{messagingUser.name || messagingUser.username}</span> ({messagingUser.role})</p>
                </div>
              </div>
              <button
                onClick={() => { setShowSendMessageModal(false); setMessagingUser(null); }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSendDirectUserMessage} className="space-y-4">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Message Content</label>
                <textarea
                  required
                  rows={4}
                  maxLength={300}
                  value={directMsgText}
                  onChange={(e) => setDirectMsgText(e.target.value)}
                  placeholder={`Write a confidential message or task reminder directly to ${messagingUser.name || messagingUser.username}...`}
                  className="w-full bg-white border border-gray-300 rounded p-2 text-xs outline-none focus:border-indigo-500 font-sans"
                />
                <div className="text-[9px] text-gray-400 text-right font-mono">
                  {300 - directMsgText.length} characters left
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Message Theme / Priority</label>
                <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded border border-gray-200">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="msgColor"
                      value="blue"
                      checked={directMsgColor === 'blue'}
                      onChange={() => setDirectMsgColor('blue')}
                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-blue-700 font-semibold text-[11px]">Blue (Direct)</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="msgColor"
                      value="purple"
                      checked={directMsgColor === 'purple'}
                      onChange={() => setDirectMsgColor('purple')}
                      className="text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span className="text-purple-700 font-semibold text-[11px]">Purple (Task)</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="msgColor"
                      value="rose"
                      checked={directMsgColor === 'rose'}
                      onChange={() => setDirectMsgColor('rose')}
                      className="text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <span className="text-rose-700 font-semibold text-[11px]">Rose (Urgent)</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowSendMessageModal(false);
                    setMessagingUser(null);
                  }}
                  className="bg-white border border-gray-300 py-1.5 px-4 rounded text-gray-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingDirectMsg || !directMsgText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-5 rounded flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sendingDirectMsg ? 'Sending...' : 'Send Direct Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Branch Node */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-150 text-xs text-gray-800">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-3 mb-4">Register Branch Node</h3>
            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Branch Node Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sonan Pharmacy No. 4"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Branch Code (Unique ID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SP-B4"
                  value={newBranchCode}
                  onChange={(e) => setNewBranchCode(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none font-mono uppercase"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Telephone Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +251-11-6443322"
                  value={newBranchPhone}
                  onChange={(e) => setNewBranchPhone(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 block">Physical Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Saris, Addis Ababa, Ethiopia"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="w-full bg-white border p-2 rounded outline-none"
                />
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button type="button" onClick={() => setShowBranchModal(false)} className="bg-white border py-2 px-4 rounded text-gray-700 font-medium">Cancel</button>
                <button type="submit" disabled={branchSubmitting} className="bg-emerald-600 text-white font-bold py-2 px-5 rounded">
                  {branchSubmitting ? 'Saving...' : 'Register Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export interface ExpenseRegistryPanelProps {
  currentUser: any;
  branches: Branch[];
  expenses: Expense[];
  onDataChanged: () => void;
}

export function ExpenseRegistryPanel({ currentUser, branches, expenses, onDataChanged }: ExpenseRegistryPanelProps) {
  const [showModal, setShowModal] = useState(false);
  const [branchId, setBranchId] = useState('b1');
  const [category, setCategory] = useState('Utilities');
  const [amount, setAmount] = useState<number | string>(1000);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const expAmount = parseFloat(String(amount)) || 0;
    if (!description || expAmount <= 0) {
      alert('Validation Error: Expense description and a valid positive amount is required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/finances/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          category,
          amount: expAmount,
          description,
          operatorId: currentUser?.id
        })
      });

      if (res.ok) {
        setShowModal(false);
        setAmount(1000);
        setDescription('');
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredExpenses = expenses.filter(e => {
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesBranch = branchFilter === 'all' || e.branchId === branchFilter;
    return matchesCategory && matchesBranch;
  });

  const totalFilteredExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const exportExpensesToExcel = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM for direct Microsoft Excel compatibility
    csvContent += "Operational Expenses Registry & Audit Ledger\r\n";
    csvContent += `Generated On: ${new Date().toLocaleString()},Scope: ${branchFilter === 'all' ? 'All Branches' : (branches.find(b => b.id === branchFilter)?.name || branchFilter)},Category: ${categoryFilter}\r\n\r\n`;
    csvContent += "Expense ID,Branch Location,Posting Date,Overhead Category,Audit Description,Debit Amount (ETB),Operator / Auditor\r\n";

    filteredExpenses.forEach(exp => {
      const bName = exp.branchName || branches.find(b => b.id === exp.branchId)?.name || exp.branchId || 'Main Branch';
      const row = [
        `"${exp.id}"`,
        `"${bName.replace(/"/g, '""')}"`,
        `"${exp.date || ''}"`,
        `"${(exp.category || '').replace(/"/g, '""')}"`,
        `"${(exp.description || '').replace(/"/g, '""')}"`,
        exp.amount,
        `"${((exp.recordedBy || exp.operator || currentUser?.username || 'admin') as string).replace(/"/g, '""')}"`
      ].join(",");
      csvContent += row + "\r\n";
    });

    csvContent += `\r\n,,,Total Filtered Expenses,${totalFilteredExpenses} ETB\r\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `operational_expenses_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Receipt className="h-5 w-5 text-emerald-600" />
            Operational Expense Registry &amp; Ledger
          </h3>
          <p className="text-xs text-gray-500">Log branch operational expenditures, utilities, rent, salaries, and maintain direct audits.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportExpensesToExcel}
            className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 text-xs font-bold py-2 px-3.5 rounded shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            title="Export Expense Register to Excel (CSV)"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            Export to Excel
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-4 rounded shadow flex items-center gap-1 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Log Operational Expense
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-150 p-4 rounded-xl text-xs space-y-1 shadow-sm">
          <span className="text-gray-500 block">Total Expenses (All)</span>
          <span className="text-lg font-bold text-red-600 block font-mono">
            {expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-US')} ETB
          </span>
          <span className="text-[10px] text-gray-400 block">All recorded overheads.</span>
        </div>
        <div className="bg-white border border-gray-150 p-4 rounded-xl text-xs space-y-1 shadow-sm">
          <span className="text-gray-500 block">Selected Filter Scope</span>
          <span className="text-lg font-bold text-emerald-700 block font-mono">
            {totalFilteredExpenses.toLocaleString('en-US')} ETB
          </span>
          <span className="text-[10px] text-gray-400 block">Scoped to current active filters.</span>
        </div>
        <div className="bg-white border border-gray-150 p-4 rounded-xl text-xs space-y-1 shadow-sm">
          <span className="text-gray-500 block">Utilities Overheads</span>
          <span className="text-lg font-bold text-orange-600 block font-mono">
            {expenses.filter(e => e.category === 'Utilities').reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-US')} ETB
          </span>
          <span className="text-[10px] text-gray-400 block">Water, electricity, internet, etc.</span>
        </div>
        <div className="bg-white border border-gray-150 p-4 rounded-xl text-xs space-y-1 shadow-sm">
          <span className="text-gray-500 block">Salaries &amp; RentScope</span>
          <span className="text-lg font-bold text-blue-600 block font-mono">
            {expenses.filter(e => e.category === 'Salaries' || e.category === 'Rent').reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-US')} ETB
          </span>
          <span className="text-[10px] text-gray-400 block">Premises and personnel costs.</span>
        </div>
      </div>

      {/* Filter and List Section */}
      <div className="bg-white rounded-xl border border-gray-250 p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700">Filter Scope:</span>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded p-1.5 text-xs outline-none text-gray-855"
            >
              <option value="all">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded p-1.5 text-xs outline-none text-gray-855"
            >
              <option value="all">All Categories</option>
              <option value="Utilities">Utilities</option>
              <option value="Rent">Rent</option>
              <option value="Salaries">Salaries</option>
              <option value="Logistics">Logistics</option>
              <option value="Marketing">Marketing</option>
              <option value="Others">Others</option>
            </select>
          </div>
          <span className="text-xs text-gray-500 font-semibold font-mono">
            Showing {filteredExpenses.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-700">
              <tr>
                <th className="p-3">Branch Location</th>
                <th className="p-3">Posting Date</th>
                <th className="p-3">Overhead Category</th>
                <th className="p-3">Audit / Journal Description</th>
                <th className="p-3 text-right">Debit Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 text-gray-600">
              {filteredExpenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-3 font-semibold text-gray-800">{e.branchName}</td>
                  <td className="p-3 font-mono">{e.date}</td>
                  <td className="p-3">
                    <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">
                      {e.category}
                    </span>
                  </td>
                  <td className="p-3 text-gray-700 italic" title={e.description}>
                    {e.description}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-red-600">
                    -{e.amount.toLocaleString('en-US')} ETB
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-400 italic font-semibold">
                    No matching expense logs registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Expense */}
      {showModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-250 text-gray-850">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Plus className="h-5 w-5 text-emerald-600" />
                Register New Expense
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded text-gray-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Target Branch Location</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded p-2.5 outline-none text-gray-850"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Expense Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded p-2.5 outline-none text-gray-850"
                >
                  <option value="Utilities">Utilities</option>
                  <option value="Rent">Rent</option>
                  <option value="Salaries">Salaries</option>
                  <option value="Logistics">Logistics</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Expense Amount (ETB)</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded p-2.5 outline-none text-gray-800 font-mono font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Journal / Ledger Description</label>
                <textarea
                  required
                  placeholder="e.g. Monthly electricity bill payment or pharmacy premises rent..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded p-2.5 outline-none text-gray-800 h-20 resize-none"
                />
              </div>

              <div className="pt-3.5 border-t border-gray-200 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded border font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-5 rounded font-bold shadow transition-all cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Register Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
