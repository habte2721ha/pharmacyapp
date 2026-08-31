import React, { useState, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { 
  Plus, Package, PackagePlus, ShieldAlert, Calendar, AlertCircle, 
  Settings, Layers, Trash2, Edit2, CheckCircle, Info, Search,
  Clipboard, ArrowRightLeft, Download, Check, RefreshCw, Eye, X, ArrowUpRight, ArrowDownLeft, ArrowDownRight, Filter,
  Volume2, VolumeX, Mic, MicOff, TrendingUp, TrendingDown, Activity, Sparkles,
  Building2, Globe, AlertTriangle, CheckSquare, Square
} from 'lucide-react';
import { Medicine, StockItem, Supplier, Sale, PurchaseOrder, StockTransfer, ProductCategory, ItemAddPresetDefaults } from '../types.ts';

interface InventoryManagerProps {
  currentUser: any;
  medicines: Medicine[];
  stockItems: StockItem[];
  suppliers: Supplier[];
  onDataChanged: () => void;
  activeBranchId?: string;
  sales?: Sale[];
  categories?: ProductCategory[];
}

export default function InventoryManager({ 
  currentUser, 
  medicines: passedMedicines, 
  stockItems: passedStockItems, 
  suppliers, 
  onDataChanged, 
  activeBranchId: passedActiveBranchId,
  sales: passedSales,
  categories = []
}: InventoryManagerProps) {
  const [localStockItems, setLocalStockItems] = useState<StockItem[]>(passedStockItems);
  const [localMedicines, setLocalMedicines] = useState<Medicine[]>(passedMedicines);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setLocalStockItems(passedStockItems);
  }, [passedStockItems]);

  useEffect(() => {
    setLocalMedicines(passedMedicines);
  }, [passedMedicines]);

  const stockItems = localStockItems;
  const medicines = localMedicines;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleQuickInlineAdjust = async (targetItem: StockItem, delta: number) => {
    if (delta === 0) return;
    const oldQty = targetItem.quantity;
    const newQty = Math.max(0, oldQty + delta);
    const actualDiff = newQty - oldQty;
    if (actualDiff === 0) return;

    // Instant Optimistic Local Update (0ms latency!)
    setLocalStockItems(prev => prev.map(st => {
      if (st.id === targetItem.id) {
        const newStore = st.storeQuantity !== undefined ? Math.max(0, st.storeQuantity + actualDiff) : newQty;
        return { ...st, quantity: newQty, storeQuantity: newStore };
      }
      return st;
    }));

    showToast(`⚡ Quantity adjusted to ${newQty} units`);

    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockItemId: targetItem.id,
          adjustmentQty: actualDiff,
          reason: 'Quick Instant Adjustment',
          operatorId: currentUser?.id,
          branchId: activeBranchId
        })
      });
      if (!res.ok) {
        onDataChanged();
      }
    } catch (err) {
      console.error(err);
      onDataChanged();
    }
  };

  const [activeTab, setActiveTab] = useState<'catalog' | 'batches' | 'damaged' | 'velocity'>('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAlertsPanelExpanded, setIsAlertsPanelExpanded] = useState(true);

  // Stock management modal states
  const [stockManageMed, setStockManageMed] = useState<Medicine | null>(null);
  const [newBatchForm, setNewBatchForm] = useState({
    batchNumber: '',
    expiryDate: '',
    quantity: 10,
    buyingPrice: 0,
    supplierId: 's1',
    branchId: 'b1',
    isDamaged: false,
    invoiceNumber: ''
  });
  const [updatingBatchId, setUpdatingBatchId] = useState<string | null>(null);

  // Custom manual entry states
  const [customCategory, setCustomCategory] = useState('');
  const [customSubCategory, setCustomSubCategory] = useState('');
  const [customUnit, setCustomUnit] = useState('');

  // Inline supplier registration states
  const [showInlineSupplierForm, setShowInlineSupplierForm] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [newSupplierBalance, setNewSupplierBalance] = useState(0);

  const handleCreateSupplierInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName) {
      alert('Supplier name is required.');
      return;
    }
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSupplierName,
          phone: newSupplierPhone || 'N/A',
          email: newSupplierEmail || 'N/A',
          address: newSupplierAddress || 'N/A',
          balance: Number(newSupplierBalance) || 0,
          operatorId: currentUser?.id || 'admin'
        })
      });
      if (res.ok) {
        onDataChanged(); // Refresh parent collections
        setShowInlineSupplierForm(false);
        setNewSupplierName('');
        setNewSupplierPhone('');
        setNewSupplierEmail('');
        setNewSupplierAddress('');
        setNewSupplierBalance(0);
        alert('Supplier registered successfully!');
      } else {
        const err = await res.json();
        alert(`Failed to register supplier: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error registering supplier.');
    }
  };

  // Filtering & Sorting State
  const [selectedProductType, setSelectedProductType] = useState<'all' | 'medicine' | 'cosmetics'>('all');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [stockLevelFilter, setStockLevelFilter] = useState<'all' | 'low' | 'instock' | 'out'>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired' | 'soon' | 'safe'>('all');
  
  // Table Sorting State
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'expiry' | 'price' | 'none'>('none');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Product Modals
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [isSubmittingMed, setIsSubmittingMed] = useState(false);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  
  const activeBranchId = passedActiveBranchId || (currentUser?.branchId === 'all' ? 'b1' : currentUser?.branchId);
  const isAdmin = currentUser?.role === 'Super Administrator' || currentUser?.role === 'Admin' || (currentUser?.role && String(currentUser.role).toLowerCase().includes('admin'));

  // Product state for addition & editing
  const [newMed, setNewMed] = useState({
    name: '', genericName: '', barcode: '', sku: '', category: 'Antibiotics', subCategory: '',
    price: 100, buyingPrice: 70, isPrescriptionRequired: false, unit: 'Piece (PCS)', minStockLevel: 10, description: '',
    productType: 'medicine' as 'medicine' | 'cosmetics', imageUrl: '', profitMargin: 30, useMarginPricing: true,
    batchNumber: '', storeQuantity: 0, dispensaryQuantity: 0, 
    expiryDate: '', 
    supplierId: 's1', branchId: (activeBranchId && activeBranchId !== 'all') ? activeBranchId : 'b1', purchaseInvoiceNumber: '', totalQuantity: 0
  });

  // Batch addition & editing state
  const [editingBatch, setEditingBatch] = useState<StockItem | null>(null);
  const [applyQtyToAll, setApplyQtyToAll] = useState(false);
  const [applyPriceToAll, setApplyPriceToAll] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);
  const [editWho, setEditWho] = useState('');
  const [editWhy, setEditWhy] = useState('');

  // Dedicated Quick Expiry Date Editing State
  const [editingExpiryItem, setEditingExpiryItem] = useState<{
    id: string;
    batchNumber: string;
    medicineName: string;
    currentExpiryDate: string;
    newExpiryDate: string;
    reason: string;
  } | null>(null);
  const [isUpdatingExpiryItem, setIsUpdatingExpiryItem] = useState(false);

  const handleSaveExpiryItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpiryItem) return;

    setIsUpdatingExpiryItem(true);
    try {
      const res = await fetch(`/api/inventory/${editingExpiryItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiryDate: editingExpiryItem.newExpiryDate,
          editWho: currentUser?.name || currentUser?.username || 'Admin',
          editWhy: editingExpiryItem.reason || 'Quick expiry date update',
          operatorId: currentUser?.id
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        showToast(`❌ Error: ${errData.error || 'Failed to update expiry date'}`);
      } else {
        showToast(`⚡ Expiry date updated for Batch ${editingExpiryItem.batchNumber} to ${editingExpiryItem.newExpiryDate}`);
        setLocalStockItems(prev => prev.map(st => {
          if (st.id === editingExpiryItem.id) {
            return { ...st, expiryDate: editingExpiryItem.newExpiryDate };
          }
          return st;
        }));
        setEditingExpiryItem(null);
        if (onDataChanged) onDataChanged();
      }
    } catch (err) {
      showToast(`❌ Connection error: ${err}`);
    } finally {
      setIsUpdatingExpiryItem(false);
    }
  };

  const handleStartEditBatch = (batch: StockItem) => {
    setEditingBatch(batch);
    setEditWho(currentUser?.name || currentUser?.username || '');
    setEditWhy('');
    setApplyQtyToAll(false);
    setApplyPriceToAll(false);
  };
  
  // Quick Adjust Modal State
  const [adjustmentQty, setAdjustmentQty] = useState(0);
  const [adjustmentMode, setAdjustmentMode] = useState<'newQty' | 'offset'>('newQty');
  const [targetNewQty, setTargetNewQty] = useState<number | ''>('');
  const [adjustmentReason, setAdjustmentReason] = useState('Stock Count Verification');
  const [adjustingDamaged, setAdjustingDamaged] = useState(false);

  // Transfer to Dispensary Modal State
  const [selectedTransferStockItem, setSelectedTransferStockItem] = useState<StockItem | null>(null);
  const [transferToDispQty, setTransferToDispQty] = useState<number>(0);
  const [isTransferringToDisp, setIsTransferringToDisp] = useState(false);

  // Suggestion State for Registration form
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [enableAutoSuggest, setEnableAutoSuggest] = useState(true);
  const [nameQuery, setNameQuery] = useState('');

  const [branchesList, setBranchesList] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/branches')
      .then(res => res.ok ? res.json() : [])
      .then(data => setBranchesList(data))
      .catch(err => console.error('Error loading branches:', err));
  }, []);

  // Split stock/batch options state variables
  const [isSplitBatch, setIsSplitBatch] = useState(false);
  const [splitFirstBranchQty, setSplitFirstBranchQty] = useState(13);
  const [splitSecondBranchId, setSplitSecondBranchId] = useState('b2');

  const [isNewMedSplit, setIsNewMedSplit] = useState(false);
  const [newMedSplitFirstQty, setNewMedSplitFirstQty] = useState(13);
  const [newMedSplitSecondBranchId, setNewMedSplitSecondBranchId] = useState('b2');

  // Simple physical adjustment (quantity & price) states
  const [simpleAdjQty, setSimpleAdjQty] = useState<number | ''>('');
  const [simpleAdjPrice, setSimpleAdjPrice] = useState<number | ''>('');
  const [simpleAdjBuyingPrice, setSimpleAdjBuyingPrice] = useState<number | ''>('');
  const [simpleAdjReason, setSimpleAdjReason] = useState<string>('Physical stock count adjustment');

  useEffect(() => {
    if (stockManageMed) {
      const targetBranch = (activeBranchId && activeBranchId !== 'all') 
        ? activeBranchId 
        : (currentUser?.branchId === 'all' ? 'b1' : currentUser?.branchId);

      const matchingMedIds = new Set(
        medicines
          .filter(m => m.id === stockManageMed.id || (m.name && stockManageMed.name && m.name.trim().toLowerCase() === stockManageMed.name.trim().toLowerCase()))
          .map(m => m.id)
      );

      const currentTotalQty = stockItems
        .filter(st => matchingMedIds.has(st.medicineId) && (activeBranchId === 'all' || st.branchId === targetBranch) && !st.isDamaged)
        .reduce((sum, item) => sum + item.quantity, 0);

      setSimpleAdjQty(currentTotalQty);
      setSimpleAdjPrice(stockManageMed.price);
      setSimpleAdjBuyingPrice(stockManageMed.buyingPrice || 0);
      setSimpleAdjReason('Physical Stock/Price Count Verification');
    }
  }, [stockManageMed, stockItems, activeBranchId, currentUser, medicines]);

  // Bin Card State
  const [binCardProduct, setBinCardProduct] = useState<Medicine | null>(null);
  const [binCardHistory, setBinCardHistory] = useState<any[]>([]);
  const [binCardTypeFilter, setBinCardTypeFilter] = useState<string>('ALL');
  const [loadingBinCard, setLoadingBinCard] = useState(false);

  // Bulk Transfer State
  const [showBulkTransferModal, setShowBulkTransferModal] = useState(false);
  const [bulkSourceBranchId, setBulkSourceBranchId] = useState(
    (activeBranchId && activeBranchId !== 'all') 
      ? activeBranchId 
      : (currentUser?.branchId === 'all' ? 'b1' : currentUser?.branchId)
  );
  const [bulkTargetBranchId, setBulkTargetBranchId] = useState('b2');
  const [bulkTransferItems, setBulkTransferItems] = useState<{ stockItemId: string; quantity: number }[]>([]);

  const handleBulkSourceBranchChange = (newSrcId: string) => {
    setBulkSourceBranchId(newSrcId);
    setBulkTransferItems([]);
    if (newSrcId === bulkTargetBranchId) {
      setBulkTargetBranchId(newSrcId === 'b1' ? 'b2' : 'b1');
    }
  };

  const openBulkTransfer = () => {
    const srcBranch = (activeBranchId && activeBranchId !== 'all') 
      ? activeBranchId 
      : (currentUser?.branchId === 'all' ? 'b1' : currentUser?.branchId);
    setBulkSourceBranchId(srcBranch);
    setBulkTargetBranchId(srcBranch === 'b1' ? 'b2' : 'b1');
    setBulkTransferItems([]);
    setShowBulkTransferModal(true);
  };

  const branchId = (activeBranchId && activeBranchId !== 'all') 
    ? activeBranchId 
    : (currentUser?.branchId === 'all' ? 'b1' : currentUser?.branchId);

  // --- Multi-Select & Bulk Delete States ---
  const [selectedMedIds, setSelectedMedIds] = useState<string[]>([]);
  const [selectedStockItemIds, setSelectedStockItemIds] = useState<string[]>([]);

  // Deletion Modal State
  const [showItemDeleteModal, setShowItemDeleteModal] = useState(false);
  const [deleteTargetType, setDeleteTargetType] = useState<'products' | 'batches'>('products');
  const [itemsToDelete, setItemsToDelete] = useState<{ id: string; name: string }[]>([]);
  const [deleteScope, setDeleteScope] = useState<'all' | 'specific'>('all');
  const [deleteBranchId, setDeleteBranchId] = useState<string>(
    (activeBranchId && activeBranchId !== 'all')
      ? activeBranchId
      : (currentUser?.branchId === 'all' ? (branchesList[0]?.id || 'b1') : (currentUser?.branchId || 'b1'))
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Selection Handlers for Tab 1 (Catalog Medicines)
  const toggleSelectMed = (medId: string) => {
    setSelectedMedIds(prev => 
      prev.includes(medId) ? prev.filter(id => id !== medId) : [...prev, medId]
    );
  };

  const toggleSelectAllMeds = (pageMeds: Medicine[]) => {
    const pageIds = pageMeds.map(m => m.id);
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedMedIds.includes(id));
    if (allSelected) {
      setSelectedMedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedMedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const clearSelectedMeds = () => setSelectedMedIds([]);

  // Selection Handlers for Tab 2 (Stock Batches)
  const toggleSelectStockItem = (stId: string) => {
    setSelectedStockItemIds(prev =>
      prev.includes(stId) ? prev.filter(id => id !== stId) : [...prev, stId]
    );
  };

  const toggleSelectAllStockItems = (pageBatches: any[]) => {
    const batchIds = pageBatches.map(b => b.id).filter(Boolean);
    const allSelected = batchIds.length > 0 && batchIds.every(id => selectedStockItemIds.includes(id));
    if (allSelected) {
      setSelectedStockItemIds(prev => prev.filter(id => !batchIds.includes(id)));
    } else {
      setSelectedStockItemIds(prev => Array.from(new Set([...prev, ...batchIds])));
    }
  };

  const clearSelectedStockItems = () => setSelectedStockItemIds([]);

  // Trigger Delete Modal for Single Product
  const openDeleteSingleProductModal = (medId: string, medName: string) => {
    setDeleteTargetType('products');
    setItemsToDelete([{ id: medId, name: medName }]);
    setDeleteScope('all');
    setDeleteBranchId(
      (activeBranchId && activeBranchId !== 'all')
        ? activeBranchId
        : (branchesList[0]?.id || 'b1')
    );
    setShowItemDeleteModal(true);
  };

  // Trigger Delete Modal for Multi-Selected Products
  const openDeleteSelectedProductsModal = () => {
    if (!isAdmin) {
      alert('Access Denied: Bulk deletion is restricted to Super Administrator / Admin users only.');
      return;
    }
    if (selectedMedIds.length === 0) return;
    const selectedList = medicines
      .filter(m => selectedMedIds.includes(m.id))
      .map(m => ({ id: m.id, name: m.name }));
    setDeleteTargetType('products');
    setItemsToDelete(selectedList);
    setDeleteScope('all');
    setDeleteBranchId(
      (activeBranchId && activeBranchId !== 'all')
        ? activeBranchId
        : (branchesList[0]?.id || 'b1')
    );
    setShowItemDeleteModal(true);
  };

  // Trigger Delete Modal for Single Stock Batch
  const openDeleteSingleBatchModal = (batchId: string, batchNumber: string, medName?: string) => {
    setDeleteTargetType('batches');
    setItemsToDelete([{ id: batchId, name: `Batch ${batchNumber}${medName ? ' (' + medName + ')' : ''}` }]);
    setDeleteScope((activeBranchId && activeBranchId !== 'all') ? 'specific' : 'all');
    setDeleteBranchId(
      (activeBranchId && activeBranchId !== 'all')
        ? activeBranchId
        : (branchesList[0]?.id || 'b1')
    );
    setShowItemDeleteModal(true);
  };

  // Trigger Delete Modal for Multi-Selected Stock Batches
  const openDeleteSelectedBatchesModal = () => {
    if (!isAdmin) {
      alert('Access Denied: Bulk deletion is restricted to Super Administrator / Admin users only.');
      return;
    }
    if (selectedStockItemIds.length === 0) return;
    const selectedList = stockItems
      .filter(st => selectedStockItemIds.includes(st.id))
      .map(st => {
        const med = medicines.find(m => m.id === st.medicineId);
        return {
          id: st.id,
          name: `Batch ${st.batchNumber}${med ? ' (' + med.name + ')' : ''}`
        };
      });
    setDeleteTargetType('batches');
    setItemsToDelete(selectedList);
    setDeleteScope((activeBranchId && activeBranchId !== 'all') ? 'specific' : 'all');
    setDeleteBranchId(
      (activeBranchId && activeBranchId !== 'all')
        ? activeBranchId
        : (branchesList[0]?.id || 'b1')
    );
    setShowItemDeleteModal(true);
  };

  // Execute Deletion Request
  const handleConfirmExecuteDelete = async () => {
    if (itemsToDelete.length === 0) return;
    if (itemsToDelete.length > 1 && !isAdmin) {
      alert('Access Denied: Bulk deletion is restricted to Super Administrator / Admin users only.');
      return;
    }
    setIsDeleting(true);

    try {
      const operatorId = currentUser?.id || 'admin';

      if (deleteTargetType === 'products') {
        if (itemsToDelete.length === 1) {
          const targetItem = itemsToDelete[0];
          const url = `/api/medicines/${targetItem.id}?operatorId=${operatorId}&scope=${deleteScope}&branchId=${deleteBranchId}`;
          const res = await fetch(url, { method: 'DELETE' });
          if (res.ok) {
            const data = await res.json();
            alert(data.message || `Successfully deleted "${targetItem.name}".`);
            setSelectedMedIds(prev => prev.filter(id => id !== targetItem.id));
            setShowItemDeleteModal(false);
            onDataChanged();
          } else {
            const err = await res.json();
            alert(`Delete failed: ${err.error || 'Server error'}`);
          }
        } else {
          const res = await fetch('/api/medicines/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ids: itemsToDelete.map(i => i.id),
              scope: deleteScope,
              branchId: deleteBranchId,
              operatorId
            })
          });
          if (res.ok) {
            const data = await res.json();
            alert(data.message || `Successfully bulk deleted ${itemsToDelete.length} products.`);
            setSelectedMedIds([]);
            setShowItemDeleteModal(false);
            onDataChanged();
          } else {
            const err = await res.json();
            alert(`Bulk delete failed: ${err.error || 'Server error'}`);
          }
        }
      } else {
        if (itemsToDelete.length === 1) {
          const targetItem = itemsToDelete[0];
          const url = `/api/inventory/${targetItem.id}?operatorId=${operatorId}&branchId=${deleteScope === 'specific' ? deleteBranchId : 'all'}`;
          const res = await fetch(url, { method: 'DELETE' });
          if (res.ok) {
            const data = await res.json();
            alert(data.message || `Successfully deleted batch.`);
            setSelectedStockItemIds(prev => prev.filter(id => id !== targetItem.id));
            setShowItemDeleteModal(false);
            onDataChanged();
          } else {
            const err = await res.json();
            alert(`Batch delete failed: ${err.error || 'Server error'}`);
          }
        } else {
          const res = await fetch('/api/inventory/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stockItemIds: itemsToDelete.map(i => i.id),
              scope: deleteScope,
              branchId: deleteBranchId,
              operatorId
            })
          });
          if (res.ok) {
            const data = await res.json();
            alert(data.message || `Successfully bulk deleted ${itemsToDelete.length} stock batches.`);
            setSelectedStockItemIds([]);
            setShowItemDeleteModal(false);
            onDataChanged();
          } else {
            const err = await res.json();
            alert(`Bulk batch delete failed: ${err.error || 'Server error'}`);
          }
        }
      }
    } catch (err) {
      console.error(err);
      alert('Network error while deleting item(s).');
    } finally {
      setIsDeleting(false);
    }
  };

  // Group same-name items flag (removed in favor of DB name consolidation)
  const consolidateSameName = false;

  // --- Stock Movement Velocity & Voice Assistant States ---
  const [velocityPeriod, setVelocityPeriod] = useState<'week' | 'month' | '3month' | 'year'>('month');
  const [fastThreshold, setFastThreshold] = useState<number>(20);
  const [selectedVelocityCategory, setSelectedVelocityCategory] = useState<'all' | 'fast' | 'slow' | 'nonmoving' | 'dead'>('all');
  
  // Local Sales fallback in case passedSales is undefined
  const [localSales, setLocalSales] = useState<Sale[]>([]);
  useEffect(() => {
    if (!passedSales) {
      fetch('/api/all-data')
        .then(res => res.ok ? res.json() as Promise<any> : {} as any)
        .then((data: any) => {
          if (data && data.sales) setLocalSales(data.sales);
        })
        .catch(err => console.error('Error fetching fallback sales:', err));
    }
  }, [passedSales]);

  const allSales = passedSales || localSales;

  // Voice Assistant States
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [speechResponse, setSpeechResponse] = useState('');
  const [speechRate, setSpeechRate] = useState(1.0);
  const [speechPitch, setSpeechPitch] = useState(1.0);
  const [voiceAvailable, setVoiceAvailable] = useState<boolean>(true);

  // Initialize Speech synthesis check
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.speechSynthesis) {
      setVoiceAvailable(false);
    }
  }, []);

  // Update threshold automatically when period changes to sensible defaults
  useEffect(() => {
    if (velocityPeriod === 'week') {
      setFastThreshold(5);
    } else if (velocityPeriod === 'month') {
      setFastThreshold(20);
    } else if (velocityPeriod === '3month') {
      setFastThreshold(60);
    } else if (velocityPeriod === 'year') {
      setFastThreshold(240);
    }
  }, [velocityPeriod]);

  // --- Velocity Date calculation & maps ---
  const getDateNDaysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  const velocityCutoffDate = React.useMemo(() => {
    if (velocityPeriod === 'week') return getDateNDaysAgo(7);
    if (velocityPeriod === 'month') return getDateNDaysAgo(30);
    if (velocityPeriod === '3month') return getDateNDaysAgo(90);
    return getDateNDaysAgo(365); // year
  }, [velocityPeriod]);

  const velocitySalesMap = React.useMemo(() => {
    const map: { [medicineId: string]: { qtySold: number; totalValue: number; salesCount: number } } = {};
    
    const periodSales = allSales.filter(s => {
      const isWithinDate = s.date >= velocityCutoffDate;
      const isWithinBranch = activeBranchId === 'all' || s.branchId === branchId;
      return isWithinDate && isWithinBranch && s.status !== 'Voided';
    });

    periodSales.forEach(sale => {
      sale.items.forEach(item => {
        const medId = item.medicineId;
        if (!map[medId]) {
          map[medId] = { qtySold: 0, totalValue: 0, salesCount: 0 };
        }
        map[medId].qtySold += item.quantity;
        map[medId].totalValue += item.total;
        map[medId].salesCount += 1;
      });
    });

    return map;
  }, [allSales, velocityCutoffDate, activeBranchId, branchId]);

  const velocityAnalysis = React.useMemo(() => {
    const medStockMap: { [medId: string]: { totalQty: number; batches: StockItem[] } } = {};
    const todayStr = new Date().toISOString().split('T')[0];

    stockItems.forEach(st => {
      const matchesBranch = activeBranchId === 'all' || st.branchId === branchId;
      if (matchesBranch && !st.isDamaged) {
        if (!medStockMap[st.medicineId]) {
          medStockMap[st.medicineId] = { totalQty: 0, batches: [] };
        }
        medStockMap[st.medicineId].batches.push(st);
        medStockMap[st.medicineId].totalQty += st.quantity;
      }
    });

    return medicines.map(med => {
      const salesInfo = velocitySalesMap[med.id] || { qtySold: 0, totalValue: 0, salesCount: 0 };
      const stockInfo = medStockMap[med.id] || { totalQty: 0, batches: [] };
      const batches = stockInfo.batches;
      const currentStock = stockInfo.totalQty;
      
      const hasExpiredBatch = batches.some(b => b.expiryDate && b.expiryDate <= todayStr);
      const isMedExpired = med.expiryDate ? med.expiryDate <= todayStr : false;
      const expired = hasExpiredBatch || isMedExpired;

      let category: 'fast' | 'slow' | 'nonmoving' | 'dead' | 'inactive' = 'inactive';
      
      if (salesInfo.qtySold >= fastThreshold) {
        category = 'fast';
      } else if (salesInfo.qtySold > 0) {
        category = 'slow';
      } else if (currentStock > 0) {
        if (expired || velocityPeriod === '3month' || velocityPeriod === 'year') {
          category = 'dead';
        } else {
          category = 'nonmoving';
        }
      }

      return {
        medicine: med,
        qtySold: salesInfo.qtySold,
        totalValue: salesInfo.totalValue,
        salesCount: salesInfo.salesCount,
        currentStock,
        expired,
        category
      };
    });
  }, [medicines, velocitySalesMap, stockItems, activeBranchId, branchId, fastThreshold, velocityPeriod]);

  const velocityStats = React.useMemo(() => {
    let fast = 0;
    let slow = 0;
    let nonmoving = 0;
    let dead = 0;
    let totalValue = 0;
    let totalQty = 0;

    velocityAnalysis.forEach(item => {
      if (item.category === 'fast') {
        fast++;
        totalValue += item.totalValue;
        totalQty += item.qtySold;
      } else if (item.category === 'slow') {
        slow++;
        totalValue += item.totalValue;
        totalQty += item.qtySold;
      } else if (item.category === 'nonmoving') {
        nonmoving++;
      } else if (item.category === 'dead') {
        dead++;
      }
    });

    return { fast, slow, nonmoving, dead, totalValue, totalQty };
  }, [velocityAnalysis]);

  // --- Voice Assistant Actions ---
  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate;
    utterance.pitch = speechPitch;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const generateGeneralSummary = () => {
    const { fast, slow, nonmoving, dead, totalValue, totalQty } = velocityStats;
    const branchName = activeBranchId === 'all' ? 'all warehouses' : 'the active branch';
    const periodLabel = velocityPeriod === 'week' ? 'past week' : velocityPeriod === 'month' ? 'past month' : velocityPeriod === '3month' ? 'past three months' : 'past year';
    return `Stock velocity audit for ${branchName} in the ${periodLabel}. We have identified ${fast} fast moving items, ${slow} slow moving items, ${nonmoving} non-moving items, and ${dead} dead stock items. Total sales revenue from moving stock is ${totalValue.toLocaleString('en-US')} Ethiopian Birr with ${totalQty} units dispensed. The assistant recommends restocking items classified as fast moving, and offering promotional discounts on dead stock items to prevent expiration liabilities.`;
  };

  const generateFastMovingReport = () => {
    const fastItems = velocityAnalysis.filter(i => i.category === 'fast').sort((a, b) => b.qtySold - a.qtySold).slice(0, 5);
    if (fastItems.length === 0) {
      return `There are currently no items matching your fast moving threshold of ${fastThreshold} units.`;
    }
    const names = fastItems.map(i => `${i.medicine.name} with ${i.qtySold} units sold`).join(', ');
    return `The top fast moving products are: ${names}. Ensure safety stock buffers are configured for these high velocity formulations.`;
  };

  const generateDeadStockReport = () => {
    const deadItems = velocityAnalysis.filter(i => i.category === 'dead').slice(0, 5);
    if (deadItems.length === 0) {
      return "Excellent, you have no dead stock or expired items currently tying up assets.";
    }
    const names = deadItems.map(i => `${i.medicine.name} with ${i.currentStock} units sitting in stock`).join(', ');
    return `Warning. The following dead stock or expired items are tying up active capital: ${names}. Action is required to clear shelf space.`;
  };

  const handleVoiceCommand = (command: string) => {
    const query = command.toLowerCase();
    
    if (query.includes('summary') || query.includes('report') || query.includes('general') || query.includes('overall')) {
      const report = generateGeneralSummary();
      setSpeechResponse(report);
      speakText(report);
    } else if (query.includes('fast') || query.includes('velocity') || query.includes('popular') || query.includes('high')) {
      const report = generateFastMovingReport();
      setSpeechResponse(report);
      speakText(report);
    } else if (query.includes('dead') || query.includes('expire') || query.includes('alert') || query.includes('warning')) {
      const report = generateDeadStockReport();
      setSpeechResponse(report);
      speakText(report);
    } else if (query.includes('slow') || query.includes('occasional')) {
      const slowItems = velocityAnalysis.filter(i => i.category === 'slow').slice(0, 5);
      const text = slowItems.length === 0 
        ? "No slow moving items identified in this period."
        : `Slow moving products are: ${slowItems.map(i => `${i.medicine.name} with ${i.qtySold} units sold`).join(', ')}`;
      setSpeechResponse(text);
      speakText(text);
    } else if (query.includes('check') || query.includes('status of') || query.includes('search')) {
      const parts = query.split(/check|status of|search/);
      const searchName = parts[parts.length - 1].trim();
      if (searchName) {
        const item = velocityAnalysis.find(i => i.medicine.name.toLowerCase().includes(searchName) || i.medicine.genericName?.toLowerCase().includes(searchName));
        if (item) {
          const statusText = `${item.medicine.name} is classified as ${item.category === 'fast' ? 'fast moving' : item.category === 'slow' ? 'slow moving' : item.category === 'dead' ? 'dead stock' : 'non-moving'}. You have sold ${item.qtySold} units in this period, and there are currently ${item.currentStock} units in stock.`;
          setSpeechResponse(statusText);
          speakText(statusText);
          setSearchTerm(item.medicine.name);
        } else {
          const text = `I could not find any medicine matching ${searchName} in the current active catalog.`;
          setSpeechResponse(text);
          speakText(text);
        }
      } else {
        const text = "Please specify a medicine name. For example, say: check paracetamol.";
        setSpeechResponse(text);
        speakText(text);
      }
    } else if (query.includes('stop') || query.includes('quiet') || query.includes('mute') || query.includes('silence')) {
      stopSpeaking();
      setSpeechResponse("Playback stopped.");
    } else {
      const text = `I heard: "${command}". Try saying 'read summary', 'list fast moving', 'check paracetamol', or 'mute'.`;
      setSpeechResponse(text);
      speakText(text);
    }
  };

  const startListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser environment. Try Chrome or Safari, or click on the query shortcuts below!");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => {
      setIsListening(true);
      setSpeechTranscript('Listening for command...');
      stopSpeaking();
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSpeechTranscript(transcript);
      handleVoiceCommand(transcript);
    };
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event);
      setSpeechTranscript('Speech not recognized. Please try speaking clearly or use simulation buttons.');
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.start();
  };

  // Pagination states for different views
  const [currentPageCatalog, setCurrentPageCatalog] = useState(1);
  const [currentPageBatches, setCurrentPageBatches] = useState(1);
  const [itemsPerPageInventory, setItemsPerPageInventory] = useState(15);

  // State to track expanded batches for a medicine name
  const [expandedBatchNames, setExpandedBatchNames] = useState<string[]>([]);

  // Reset page numbers on filter changes
  useEffect(() => {
    setCurrentPageCatalog(1);
    setCurrentPageBatches(1);
  }, [searchTerm, selectedProductType, selectedSupplierFilter, selectedCategoryFilter, stockLevelFilter, expiryFilter, sortBy, sortOrder]);

  // Server-persisted Presets & Defaults (survives browser clear, backups, device changes)
  const [serverPresets, setServerPresets] = useState<ItemAddPresetDefaults | null>(null);
  const [rememberDefaults, setRememberDefaults] = useState<boolean>(true);

  // Fetch presets from server (database-backed, preserved and restored from backups)
  const fetchServerPresets = async () => {
    try {
      const res = await fetch('/api/inventory/presets');
      if (res.ok) {
        const data = await res.json();
        if (data.presets) {
          setServerPresets(data.presets);
          try {
            localStorage.setItem('pharmacy_last_add_defaults', JSON.stringify(data.presets));
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('Failed to load inventory presets from server:', e);
    }
  };

  useEffect(() => {
    fetchServerPresets();
  }, []);

  // Helper to get merged effective defaults (Server Database + LocalStorage Cache + Fallbacks)
  const getLastAddDefaults = (): ItemAddPresetDefaults => {
    let localObj: any = {};
    try {
      const stored = localStorage.getItem('pharmacy_last_add_defaults');
      if (stored) localObj = JSON.parse(stored);
    } catch (e) {}

    const merged = {
      ...(serverPresets || {}),
      ...localObj
    };

    return {
      category: merged.category || 'Antibiotics',
      subCategory: merged.subCategory || '',
      productType: (merged.productType as 'medicine' | 'cosmetics') || 'medicine',
      unit: merged.unit || 'Piece (PCS)',
      supplierId: merged.supplierId || (suppliers[0]?.id || 's1'),
      supplierName: merged.supplierName || '',
      purchaseInvoiceNumber: merged.purchaseInvoiceNumber || '',
      branchId: (activeBranchId && activeBranchId !== 'all') ? activeBranchId : (merged.branchId || 'b1'),
      expiryDate: merged.expiryDate || '',
      buyingPrice: merged.buyingPrice !== undefined ? Number(merged.buyingPrice) : 70,
      price: merged.price !== undefined ? Number(merged.price) : 100,
      profitMargin: merged.profitMargin !== undefined ? Number(merged.profitMargin) : 30,
      useMarginPricing: merged.useMarginPricing !== undefined ? !!merged.useMarginPricing : true,
      isPrescriptionRequired: merged.isPrescriptionRequired !== undefined ? !!merged.isPrescriptionRequired : false,
      minStockLevel: merged.minStockLevel !== undefined ? Number(merged.minStockLevel) : 10,
      description: merged.description || '',
      rememberDefaults: merged.rememberDefaults !== undefined ? !!merged.rememberDefaults : true,
      lastAddedItemName: merged.lastAddedItemName || serverPresets?.lastAddedItemName || '',
      lastAddedAt: merged.lastAddedAt || serverPresets?.lastAddedAt || ''
    };
  };

  // Helper to persist defaults for consecutive item additions (to both LocalStorage AND database)
  const saveLastAddDefaults = async (defaults: Record<string, any>) => {
    try {
      localStorage.setItem('pharmacy_last_add_defaults', JSON.stringify(defaults));
      setServerPresets(prev => ({ ...(prev || {}), ...defaults }));
      await fetch('/api/inventory/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presets: defaults })
      });
    } catch (e) {
      console.warn('Could not save defaults to server/localStorage', e);
    }
  };

  const handleResetFormToBlank = () => {
    setNewMed({
      name: '',
      genericName: '',
      barcode: '',
      sku: '',
      category: 'Antibiotics',
      subCategory: '',
      price: 100,
      buyingPrice: 70,
      isPrescriptionRequired: false,
      unit: 'Piece (PCS)',
      minStockLevel: 10,
      description: '',
      productType: 'medicine',
      imageUrl: '',
      profitMargin: 30,
      useMarginPricing: true,
      batchNumber: '',
      storeQuantity: 0,
      dispensaryQuantity: 0,
      expiryDate: '',
      supplierId: suppliers[0]?.id || 's1',
      branchId: (activeBranchId && activeBranchId !== 'all') ? activeBranchId : 'b1',
      purchaseInvoiceNumber: '',
      totalQuantity: 0
    });
    showToast('✨ Form reset to blank default template.');
  };

  const handleApplySavedDefaults = () => {
    const defaults = getLastAddDefaults();
    setNewMed(prev => ({
      ...prev,
      category: defaults.category || prev.category,
      subCategory: defaults.subCategory || '',
      productType: (defaults.productType as 'medicine' | 'cosmetics') || prev.productType,
      unit: defaults.unit || prev.unit,
      supplierId: defaults.supplierId || prev.supplierId,
      branchId: (activeBranchId && activeBranchId !== 'all') ? activeBranchId : (defaults.branchId || prev.branchId),
      purchaseInvoiceNumber: defaults.purchaseInvoiceNumber !== undefined ? defaults.purchaseInvoiceNumber : prev.purchaseInvoiceNumber,
      expiryDate: defaults.expiryDate || prev.expiryDate,
      buyingPrice: defaults.buyingPrice !== undefined ? defaults.buyingPrice : prev.buyingPrice,
      price: defaults.price !== undefined ? defaults.price : prev.price,
      profitMargin: defaults.profitMargin !== undefined ? defaults.profitMargin : prev.profitMargin,
      useMarginPricing: defaults.useMarginPricing !== undefined ? defaults.useMarginPricing : prev.useMarginPricing,
      isPrescriptionRequired: defaults.isPrescriptionRequired !== undefined ? defaults.isPrescriptionRequired : prev.isPrescriptionRequired,
      minStockLevel: defaults.minStockLevel !== undefined ? defaults.minStockLevel : prev.minStockLevel,
      description: defaults.description !== undefined ? defaults.description : prev.description
    }));
    showToast('⚡ Applied saved info from last added item.');
  };

  const handleOpenAddMedicine = () => {
    setEditingMed(null);
    const defaults = getLastAddDefaults();
    setNewMed({
      name: '',
      genericName: '',
      barcode: '',
      sku: '',
      category: defaults.category || 'Antibiotics',
      subCategory: defaults.subCategory || '',
      price: defaults.price !== undefined ? defaults.price : 100,
      buyingPrice: defaults.buyingPrice !== undefined ? defaults.buyingPrice : 70,
      isPrescriptionRequired: !!defaults.isPrescriptionRequired,
      unit: defaults.unit || 'Piece (PCS)',
      minStockLevel: defaults.minStockLevel !== undefined ? defaults.minStockLevel : 10,
      description: defaults.description || '',
      productType: (defaults.productType as 'medicine' | 'cosmetics') || 'medicine',
      imageUrl: '',
      profitMargin: defaults.profitMargin !== undefined ? defaults.profitMargin : 30,
      useMarginPricing: defaults.useMarginPricing !== undefined ? defaults.useMarginPricing : true,
      batchNumber: '',
      storeQuantity: 0,
      dispensaryQuantity: 0,
      expiryDate: defaults.expiryDate || '',
      supplierId: defaults.supplierId || (suppliers[0]?.id || 's1'),
      branchId: (activeBranchId && activeBranchId !== 'all') ? activeBranchId : (defaults.branchId || 'b1'),
      purchaseInvoiceNumber: defaults.purchaseInvoiceNumber || '',
      totalQuantity: 0
    });
    setShowAddMedModal(true);
  };

  // Watch name typing to provide auto suggestions
  useEffect(() => {
    if (enableAutoSuggest && newMed.name.trim().length >= 1 && !newMed.sku) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [newMed.name, enableAutoSuggest]);

  // Precomputed last stock item map for O(1) auto-suggest lookups
  const lastStockMap = React.useMemo(() => {
    const map: { [medId: string]: StockItem } = {};
    stockItems.forEach(st => {
      map[st.medicineId] = st;
    });
    return map;
  }, [stockItems]);

  // Smart multi-word matching and relevance scoring function for auto-suggest (O(1) stock lookup)
  const getMatchedSuggestions = React.useCallback((query: string) => {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return [];

    const words = cleanQuery.replace(/[^\w\s]/gi, ' ').split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const scored = medicines.map(m => {
      const mName = (m.name || '').toLowerCase();
      const mGeneric = (m.genericName || '').toLowerCase();
      const mCat = (m.category || '').toLowerCase();
      const mSKU = (m.sku || '').toLowerCase();
      const mBarcode = (m.barcode || '').toLowerCase();
      const mDesc = (m.description || '').toLowerCase();
      const mType = (m.productType || '').toLowerCase();
      const mUnit = (m.unit || '').toLowerCase();

      const lastStock = lastStockMap[m.id] || null;
      const invNum = ((lastStock as any)?.purchaseInvoiceNumber || (m as any)?.purchaseInvoiceNumber || '').toLowerCase();
      const batchNum = (lastStock?.batchNumber || '').toLowerCase();

      const fullText = `${mName} ${mGeneric} ${mCat} ${mSKU} ${mBarcode} ${mDesc} ${mType} ${mUnit} ${invNum} ${batchNum}`;

      let score = 0;

      // Exact or prefix matches
      if (mName === cleanQuery) score += 2000;
      else if (mName.startsWith(cleanQuery)) score += 1200;
      else if (mName.includes(cleanQuery)) score += 800;
      else if (mGeneric.includes(cleanQuery)) score += 600;
      else if (fullText.includes(cleanQuery)) score += 400;

      // Check if ALL query words are present
      const matchingWords = words.filter(w => fullText.includes(w));
      const allWordsInName = words.every(w => mName.includes(w));
      const allWordsInFullText = words.every(w => fullText.includes(w));

      if (allWordsInName) {
        score += 1000 + (words.length * 100);
      } else if (allWordsInFullText) {
        score += 700 + (words.length * 80);
      } else if (matchingWords.length > 0) {
        score += matchingWords.length * 100;
      }

      return { med: m, lastStock, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.med.name.localeCompare(b.med.name))
      .slice(0, 15);
  }, [medicines, lastStockMap]);

  // Handle suggestion selection - pre-fill all saved information of last added batch
  const selectSuggestion = (targetInput: { med: Medicine; lastStock?: StockItem | null } | Medicine) => {
    const template = 'med' in targetInput ? targetInput.med : targetInput;
    const matchingBatches = stockItems.filter(st => st.medicineId === template.id);
    const lastStock = ('lastStock' in targetInput && targetInput.lastStock) 
      ? targetInput.lastStock 
      : (matchingBatches.length > 0 ? matchingBatches[matchingBatches.length - 1] : null);

    const targetUnit = template.unit || 'Piece (PCS)';
    if (!UNIT_OPTIONS.includes(targetUnit)) {
      setCustomUnit(targetUnit);
    }

    const targetCategory = template.category || 'antibiotics';
    if (!MEDICATION_CATEGORIES.includes(targetCategory)) {
      setCustomCategory(targetCategory);
    }

    const lastBuying = lastStock ? lastStock.buyingPrice : (template.buyingPrice || 0);
    const lastSelling = template.price || (lastBuying ? Number((lastBuying * 1.3).toFixed(2)) : 100);
    const lastSupplier = lastStock ? lastStock.supplierId : ((template as any).supplierId || 's1');
    const lastBatch = lastStock ? lastStock.batchNumber : `B-${Date.now().toString().slice(-4)}`;
    const lastExpiry = lastStock ? lastStock.expiryDate : (template.productType === 'cosmetics' ? '' : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const lastInvoice = lastStock ? ((lastStock as any).purchaseInvoiceNumber || '') : ((template as any).purchaseInvoiceNumber || '');
    const lastStoreQty = lastStock ? (lastStock.storeQuantity !== undefined ? lastStock.storeQuantity : lastStock.quantity) : 10;
    const lastDispQty = lastStock ? (lastStock.dispensaryQuantity !== undefined ? lastStock.dispensaryQuantity : 0) : 0;
    const targetProductType = (template.productType as 'medicine' | 'cosmetics') || (template.category?.toLowerCase() === 'cosmetics' ? 'cosmetics' : 'medicine');

    setNewMed({
      ...newMed,
      name: template.name,
      genericName: template.genericName || template.name,
      category: targetCategory,
      unit: targetUnit,
      minStockLevel: template.minStockLevel || 10,
      price: lastSelling,
      buyingPrice: lastBuying,
      isPrescriptionRequired: !!template.isPrescriptionRequired,
      description: template.description || '',
      productType: targetProductType,
      profitMargin: template.profitMargin || 30,
      useMarginPricing: template.profitMargin !== undefined,
      batchNumber: lastBatch,
      expiryDate: lastExpiry,
      supplierId: lastSupplier,
      branchId: lastStock ? lastStock.branchId : ((activeBranchId && activeBranchId !== 'all') ? activeBranchId : 'b1'),
      purchaseInvoiceNumber: lastInvoice,
      storeQuantity: lastStoreQty,
      dispensaryQuantity: lastDispQty,
      totalQuantity: lastStoreQty + lastDispQty,
    });

    // Save information for the next add session
    saveLastAddDefaults({
      unit: targetUnit,
      supplierId: lastSupplier,
      purchaseInvoiceNumber: lastInvoice,
      expiryDate: lastExpiry,
      buyingPrice: lastBuying,
      price: lastSelling,
      productType: targetProductType,
      category: targetCategory,
      branchId: lastStock ? lastStock.branchId : ((activeBranchId && activeBranchId !== 'all') ? activeBranchId : 'b1')
    });

    setShowSuggestions(false);
  };

  // Auto-Draft Mechanism for Inventory Registration Form
  const [hasInventoryDraft, setHasInventoryDraft] = useState(false);
  const [inventoryDraftData, setInventoryDraftData] = useState<any>(null);

  // Check for saved inventory draft when opening the Add Medicine modal
  useEffect(() => {
    if (showAddMedModal && !editingMed) {
      try {
        const saved = localStorage.getItem('inventory_form_draft');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed &&
            (parsed.name?.trim() ||
              parsed.batchNumber?.trim() ||
              parsed.description?.trim() ||
              parsed.purchaseInvoiceNumber?.trim() ||
              (parsed.buyingPrice && parsed.buyingPrice !== 70) ||
              (parsed.price && parsed.price !== 100))
          ) {
            setInventoryDraftData(parsed);
            setHasInventoryDraft(true);
          }
        }
      } catch (e) {
        console.warn('Failed to parse saved inventory draft', e);
      }
    } else {
      setHasInventoryDraft(false);
    }
  }, [showAddMedModal, editingMed]);

  // Auto-save form progress to localStorage while user edits (Debounced to prevent keypress blocking)
  useEffect(() => {
    if (showAddMedModal && !editingMed) {
      const isMeaningful =
        newMed.name.trim().length > 0 ||
        newMed.batchNumber.trim().length > 0 ||
        newMed.description.trim().length > 0 ||
        newMed.barcode.trim().length > 0 ||
        newMed.purchaseInvoiceNumber.trim().length > 0;
      if (isMeaningful) {
        const timer = setTimeout(() => {
          try {
            localStorage.setItem(
              'inventory_form_draft',
              JSON.stringify({ ...newMed, timestamp: Date.now() })
            );
          } catch (e) {
            // Ignore quota errors
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [newMed, showAddMedModal, editingMed]);

  const restoreInventoryDraft = () => {
    if (inventoryDraftData) {
      setNewMed(inventoryDraftData);
      setHasInventoryDraft(false);
    }
  };

  const discardInventoryDraft = () => {
    localStorage.removeItem('inventory_form_draft');
    setInventoryDraftData(null);
    setHasInventoryDraft(false);
  };

  // Profit Margin Calculator hook inside registration
  const calculateMarginPrice = (buying: number, margin: number, useMargin: boolean, currentPrice: number): number => {
    if (useMargin) {
      return Number((buying * (1 + margin / 100)).toFixed(2));
    }
    return currentPrice;
  };

  const handleBuyingPriceChange = (val: number) => {
    setNewMed(prev => {
      const calculatedPrice = calculateMarginPrice(val, prev.profitMargin, prev.useMarginPricing, prev.price);
      return { ...prev, buyingPrice: val, price: calculatedPrice };
    });
  };

  const handleMarginChange = (val: number) => {
    setNewMed(prev => {
      const calculatedPrice = calculateMarginPrice(prev.buyingPrice, val, prev.useMarginPricing, prev.price);
      return { ...prev, profitMargin: val, price: calculatedPrice };
    });
  };

  const handleUseMarginToggle = (checked: boolean) => {
    setNewMed(prev => {
      const calculatedPrice = calculateMarginPrice(prev.buyingPrice, prev.profitMargin, checked, prev.price);
      return { ...prev, useMarginPricing: checked, price: calculatedPrice };
    });
  };

  const handleStaticPriceChange = (val: number) => {
    setNewMed(prev => {
      const margin = prev.buyingPrice > 0 ? Math.round(((val - prev.buyingPrice) / prev.buyingPrice) * 100) : 0;
      return { ...prev, price: val, profitMargin: margin };
    });
  };

  // Load Bin Card History dynamically
  const openBinCard = async (med: Medicine) => {
    setBinCardProduct(med);
    setLoadingBinCard(true);
    try {
      // Async fetch sales, purchases, transfers, and stock-movements to compile physical Ledger
      const [salesRes, purchasesRes, transfersRes, movementsRes, branchesRes] = await Promise.all([
        fetch('/api/sales').then(r => r.ok ? r.json() : []),
        fetch('/api/purchases').then(r => r.ok ? r.json() : []),
        fetch('/api/transfers').then(r => r.ok ? r.json() : []),
        fetch('/api/stock-movements').then(r => r.ok ? r.json() : []),
        fetch('/api/branches').then(r => r.ok ? r.json() : [])
      ]);

      const compiledLedger: any[] = [];

      // Look up stock movements matching medicine and branch
      const filteredMovements = (movementsRes || []).filter((sm: any) => 
        sm.branchId === branchId && sm.medicineId === med.id
      );

      if (filteredMovements.length > 0) {
        filteredMovements.forEach((sm: any) => {
          let partyText = '';
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
              const poItem = matchedPO.items?.find((i: any) => i.medicineId === med.id);
              if (poItem && poItem.quantity) qReceived = Number(poItem.quantity);
            }
            if (qReceived === 0 && qIssued === 0) {
              const matchedSale = salesRes.find((s: any) => s.invoiceNumber === sm.invoiceNumber || s.invoiceNumber === sm.reference || s.id === sm.reference);
              if (matchedSale) {
                const saleItem = matchedSale.items?.find((i: any) => i.medicineId === med.id);
                if (saleItem && saleItem.quantity) qIssued = Number(saleItem.quantity);
              }
            }
            if (qReceived === 0 && qIssued === 0) {
              const matchedStock = stockItems.find(s => s.medicineId === med.id && (s.batchNumber === sm.batchNumber || s.id === sm.reference));
              if (matchedStock && matchedStock.quantity) {
                if (smType.toLowerCase().includes('issue') || smType.toLowerCase().includes('sale') || smType.toLowerCase().includes('out')) {
                  qIssued = Number(matchedStock.quantity);
                } else {
                  qReceived = Number(matchedStock.quantity);
                }
              }
            }
          }

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
            const srcBranch = sm.sourceBranchName || branchesRes.find((b: any) => b.id === sm.sourceBranchId)?.name || 'Source Warehouse';
            partyText = `Transfer In from: ${srcBranch}`;
          } else if (smType === 'Stock Transfer Out' || smType.includes('Transfer Out') || (qIssued > 0 && (sm.targetBranchName || mNotes.includes('Transferred to')))) {
            const tgtBranch = sm.targetBranchName || branchesRes.find((b: any) => b.id === sm.targetBranchId)?.name || 'Target Warehouse';
            partyText = `Transfer Out to: ${tgtBranch}`;
          } else if (qReceived > 0 || smType.toLowerCase().includes('received')) {
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
              const matchedStock = stockItems.find(s => (s.medicineId === med.id || s.id === sm.reference) && s.batchNumber === sm.batchNumber);
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
            let cName = sm.customerName || sm.patientName;
            if (!cName && mNotes) {
              if (mNotes.includes('Patient:') || mNotes.includes('Customer:')) {
                cName = mNotes.split(/Patient:|Customer:/)[1]?.split('|')[0]?.trim();
              }
            }
            if (!cName) {
              const sale = salesRes.find((s: Sale) => s.invoiceNumber === sm.invoiceNumber || s.invoiceNumber === sm.reference);
              if (sale && sale.customerName) {
                cName = sale.customerName;
              }
            }
            partyText = cName ? `Patient: ${cName}` : 'Patient: Walk-in Patient';
          } else {
            partyText = mNotes || (sm.type || 'Activity');
          }

          if (partyText === 'Stock Received' || partyText.toLowerCase().startsWith('stock received') || partyText.includes('Legacy Imported Stock Movement') || partyText.includes('Legacy')) {
            if (qReceived > 0 || smType.toLowerCase().includes('received') || qIssued === 0) {
              let sName = sm.supplierName;
              if (!sName || sName === 'supplier1' || sName === 'suplier1' || sName === 's1' || sName.toLowerCase() === 'registered supplier' || sName.toLowerCase() === 'stock received') {
                const matchedStock = stockItems.find(s => (s.medicineId === med.id || s.id === sm.reference) && s.batchNumber === sm.batchNumber);
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

          let resolvedUser = (sm.user || '').trim();
          if (!resolvedUser || resolvedUser.toLowerCase() === 'system' || resolvedUser.toLowerCase() === 'system administrator') {
            resolvedUser = currentUser?.name || currentUser?.username || 'Admin';
          }

          let bp = (sm as any).buyingPrice;
          if (bp === undefined || bp === null || bp === 0) {
            const matchedStock = stockItems.find(s => s.medicineId === med.id && (s.batchNumber === sm.batchNumber || s.id === sm.reference));
            if (matchedStock && matchedStock.buyingPrice) {
              bp = matchedStock.buyingPrice;
            }
          }
          if (bp === undefined || bp === null || bp === 0) {
            if (med.buyingPrice) bp = med.buyingPrice;
          }

          let sp = (sm as any).sellingPrice || (sm as any).unitPrice;
          if (sp === undefined || sp === null || sp === 0) {
            const matchedStock = stockItems.find(s => s.medicineId === med.id && (s.batchNumber === sm.batchNumber || s.id === sm.reference));
            if (matchedStock && (matchedStock as any).sellingPrice) {
              sp = (matchedStock as any).sellingPrice;
            }
          }
          if (sp === undefined || sp === null || sp === 0) {
            if (med.price) sp = med.price;
          }

          compiledLedger.push({
            date: sm.date || '',
            user: resolvedUser,
            type: isAdjustment ? 'Physical Inventory Adjustment' : (sm.type || 'Activity'),
            batchNumber: sm.batchNumber || 'N/A',
            expiryDate: sm.expiryDate || 'N/A',
            buyingPrice: bp || 0,
            sellingPrice: sp || 0,
            quantityReceived: qReceived,
            quantityIssued: qIssued,
            party: partyText,
            reference: sm.reference || '',
            invoiceNumber: sm.invoiceNumber || ''
          });
        });
      } else {
        // Fallback dynamically from registers
        purchasesRes.forEach((po: PurchaseOrder) => {
          if (po.branchId === branchId && po.status === 'Received') {
            po.items.forEach(item => {
              if (item.medicineId === med.id) {
                const matchingStock = stockItems.find(s => s.medicineId === med.id && s.branchId === branchId);
                const bp = item.unitPrice || matchingStock?.buyingPrice || med.buyingPrice || 0;
                const sp = (matchingStock as any)?.sellingPrice || med.price || 0;
                compiledLedger.push({
                  date: po.receivedDate || po.date,
                  type: 'Received',
                  batchNumber: 'PO Batch',
                  expiryDate: 'N/A',
                  buyingPrice: bp,
                  sellingPrice: sp,
                  quantityReceived: item.quantity,
                  quantityIssued: 0,
                  party: `Supplier: ${po.supplierName}`,
                  reference: po.poNumber,
                  invoiceNumber: (po as any).invoiceNumber || (po as any).purchaseInvoiceNumber || ''
                });
              }
            });
          }
        });

        salesRes.forEach((sale: Sale) => {
          if (sale.branchId === branchId && sale.status === 'Completed') {
            sale.items.forEach(item => {
              if (item.medicineId === med.id) {
                const matchingStock = stockItems.find(s => s.medicineId === med.id && s.batchNumber === item.batchNumber);
                const bp = matchingStock?.buyingPrice || med.buyingPrice || 0;
                const sp = item.unitPrice || med.price || 0;
                compiledLedger.push({
                  date: sale.date,
                  type: 'Issued',
                  batchNumber: item.batchNumber,
                  expiryDate: 'N/A',
                  buyingPrice: bp,
                  sellingPrice: sp,
                  quantityReceived: 0,
                  quantityIssued: item.quantity,
                  party: `Customer: ${sale.customerName || 'Walk-in'} ${sale.customerTin ? '(TIN: ' + sale.customerTin + ')' : ''}`,
                  reference: sale.invoiceNumber,
                  invoiceNumber: sale.invoiceNumber || ''
                });
              }
            });
          }
        });

        transfersRes.forEach((tr: StockTransfer) => {
          if (tr.status === 'Received') {
            tr.items.forEach(item => {
              if (item.medicineId === med.id) {
                const matchingStock = stockItems.find(s => s.medicineId === med.id && s.batchNumber === item.batchNumber);
                const bp = matchingStock?.buyingPrice || med.buyingPrice || 0;
                const sp = med.price || 0;
                if (tr.sourceBranchId === branchId) {
                  compiledLedger.push({
                    date: tr.date,
                    type: 'Issued',
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    buyingPrice: bp,
                    sellingPrice: sp,
                    quantityReceived: 0,
                    quantityIssued: item.quantity,
                    party: `Transfer to ${tr.targetBranchName}`,
                    reference: tr.transferNumber,
                    invoiceNumber: (tr as any).invoiceNumber || ''
                  });
                } else if (tr.targetBranchId === branchId) {
                  compiledLedger.push({
                    date: tr.date,
                    type: 'Received',
                    batchNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    buyingPrice: bp,
                    sellingPrice: sp,
                    quantityReceived: item.quantity,
                    quantityIssued: 0,
                    party: `Transfer from ${tr.sourceBranchName}`,
                    reference: tr.transferNumber,
                    invoiceNumber: (tr as any).invoiceNumber || ''
                  });
                }
              }
            });
          }
        });
      }

      // Sort ledger entries chronologically
      compiledLedger.sort((a, b) => a.date.localeCompare(b.date));

      // Calculate running balance statefully
      let currentBal = 0;
      const historyWithBalance = compiledLedger.map(entry => {
        currentBal = currentBal + entry.quantityReceived - entry.quantityIssued;
        return {
          ...entry,
          balance: currentBal
        };
      });

      setBinCardHistory(historyWithBalance);
    } catch (err) {
      console.error('Failed to load bincard logic:', err);
    } finally {
      setLoadingBinCard(false);
    }
  };

  // --- Optimized Lookup Maps for O(1) Instant Calculations ---
  
  // 1. Map of medicine IDs to Medicine objects
  const medicineMap = React.useMemo(() => {
    const map: { [id: string]: Medicine } = {};
    medicines.forEach(m => {
      map[m.id] = m;
    });
    return map;
  }, [medicines]);

  // 2. Map of medicine IDs to stock details (total stock sum, list of suppliers, active branch status)
  const branchStockMap = React.useMemo(() => {
    const map: { 
      [medId: string]: { 
        total: number; 
        supplierIds: Set<string>; 
        hasStockInActiveBranch: boolean; 
      } 
    } = {};
    
    medicines.forEach(m => {
      const mIdKey = String(m.id).trim();
      map[m.id] = { total: 0, supplierIds: new Set<string>(), hasStockInActiveBranch: false };
      map[mIdKey] = map[m.id];
    });

    stockItems.forEach(st => {
      const stBranch = st.branchId || 'b1';
      const isCorrectBranch = activeBranchId === 'all' || stBranch === branchId || st.branchId === 'all';
      const isDamaged = st.isDamaged;
      const medKey = String(st.medicineId).trim();
      
      const entry = map[medKey] || map[st.medicineId] || { total: 0, supplierIds: new Set<string>(), hasStockInActiveBranch: false };
      
      if (!isDamaged && isCorrectBranch) {
        entry.total += Number(st.quantity) || 0;
      }
      
      if (st.supplierId && (stBranch === branchId)) {
        entry.supplierIds.add(st.supplierId);
      }
      
      if (activeBranchId === 'all' || stBranch === activeBranchId) {
        entry.hasStockInActiveBranch = true;
      }

      map[st.medicineId] = entry;
      map[medKey] = entry;
    });

    return map;
  }, [stockItems, medicines, activeBranchId, branchId]);

  // Master branch stock calculations - now O(1) instead of O(N) array filter
  const getBranchStockSum = React.useCallback((medId: string): number => {
    return branchStockMap[medId]?.total ?? 0;
  }, [branchStockMap]);

  // 3. Pre-grouped stock sums by lowercase medicine name for instant consolidation!
  const consolidatedStockMap = React.useMemo(() => {
    const map: { [nameLower: string]: number } = {};
    medicines.forEach(m => {
      const nameLower = m.name.trim().toLowerCase();
      const stockSum = branchStockMap[m.id]?.total ?? 0;
      map[nameLower] = (map[nameLower] || 0) + stockSum;
    });
    return map;
  }, [medicines, branchStockMap]);

  // Helper to calculate consolidated stock across same-name items - O(1) instant!
  const getConsolidatedStockSum = React.useCallback((medName: string): number => {
    return consolidatedStockMap[medName.trim().toLowerCase()] ?? 0;
  }, [consolidatedStockMap]);

  // Compute critical stock alerts dynamically and efficiently
  const criticalStockAlerts = React.useMemo(() => {
    return medicines
      .map(m => {
        const currentStock = getBranchStockSum(m.id);
        const isOutOfStock = currentStock === 0;
        const isLowStock = currentStock > 0 && currentStock <= m.minStockLevel;
        return {
          medicine: m,
          currentStock,
          isOutOfStock,
          isLowStock,
        };
      })
      .filter(item => item.isOutOfStock || item.isLowStock);
  }, [medicines, getBranchStockSum]);

  // Category and Unit Option selections (User Mandated List)
  const MEDICINE_CATEGORIES = [
    'Antibiotics', 'Analgesics', 'Cardiovascular (CV)', 'Gastrointestinal (GIT)', 'Respiratory', 'Dermatological', 'ENT', 'Vitamins & Minerals', 'Anti Fungal', 'Antiprotozoal', 'Deworming', 'Hormones', 'Controlled Drugs', 'Supplies', 'others'
  ];

  const COSMETICS_CATEGORIES = [
    'Shampoo', 'Conditioner', 'Body Wash', 'Skin Care', 'Kids Product', 'Soap', 'Hair Treatment', 'Parfum', 'Deodorant', 'Stick and Roll Body Deodorants', 'Oral Care', 'Sunscreen', 'Vitamins and Supplement', 'Hair Product', 'others'
  ];

  const SUBCATEGORY_OPTIONS_MAP: Record<string, string[]> = {
    'Antibiotics': [
      'Penicillins',
      'Cephalosporins',
      'Carbapenems',
      'Monobactams',
      'Macrolides',
      'Tetracyclines',
      'Aminoglycosides',
      'Fluoroquinolones',
      'Sulfonamides',
      'Lincosamides',
      'Glycopeptides',
      'Nitroimidazoles',
      'Oxazolidinones',
      'Other Antibiotics'
    ],
    'Analgesics': ['NSAIDs', 'Opioids / Pain Relief', 'Antipyretics (Fever)', 'Topical Analgesic Gels', 'Pediatric Pain Drops', 'others'],
    'Cardiovascular (CV)': ['CHF', 'Antihypertensives', 'Antiarrhythmics', 'Anticoagulants / Blood Thinners', 'Statins / Cholesterol', 'Diuretics', 'others'],
    'Gastrointestinal (GIT)': ['Antacids / PPIs', 'Laxatives', 'Anti-Diarrheal', 'Antiemetics / Anti-Nausea', 'Probiotics & Enzymes', 'others'],
    'Respiratory': ['Inhalers / Nebulizers', 'Antihistamines / Allergy', 'Cough Syrups & Expectorants', 'Nasal Decongestants', 'others'],
    'Dermatological': ['Antifungal Creams', 'Topical Steroids', 'Antiseptic Ointments', 'Burn Care', 'Acne Treatments', 'others'],
    'ENT': ['Ear Drops', 'Nasal Sprays', 'Throat Lozenges/Sprays', 'Eye Drops / Ointments', 'others'],
    'Vitamins & Minerals': ['Multivitamins', 'Iron / Anemia Supplements', 'Calcium & Vitamin D', 'Vitamin C / Immunity', 'Pediatric Vitamin Drops', 'others'],
    'Anti Fungal': ['Oral Antifungal', 'Topical Creams', 'Vaginal Suppositories', 'others'],
    'Antiprotozoal': ['Metronidazole & Tinidazole', 'Anti-Amoebic', 'Anti-Giardiasis', 'Antimalarial / Malaria', 'others'],
    'Deworming': ['Albendazole & Mebendazole', 'Broad Spectrum Dewormers', 'Pediatric Deworming Syrups', 'Anti-Helminthic', 'others'],
    'Hormones': ['Diabetes / Insulin', 'Thyroid Medications', 'Oral Contraceptive Pills', 'Steroids', 'others'],
    'Controlled Drugs': ['Sedatives / Anxiolytics', 'Narcotic Analgesics', 'Anticonvulsants', 'others'],
    'Supplies': ['Syringes & Needles', 'Bandages & Gauze', 'Gloves & Masks', 'Catheters & Tubes', 'Diagnostic Strips', 'others'],

    'Shampoo': ['Anti-Dandruff', 'Color Protection', 'Volumizing & Hydrating', 'Gentle / Baby Shampoo', 'Clarifying Shampoo', 'others'],
    'Conditioner': ['Deep Conditioning', 'Leave-In Treatment', 'Moisturizing Hair Mask', 'others'],
    'Body Wash': ['Hydrating Shower Gel', 'Exfoliating Scrub', 'Antibacterial Body Wash', 'Sensitive Skin Cleanser', 'others'],
    'Skin Care': ['Facial Cleansers & Foams', 'Moisturizers & Day Creams', 'Face Serums & Anti-Aging', 'Sunscreen Lotion', 'Acne & Blemish Control', 'Toner & Micellar Water', 'others'],
    'Kids Product': ['Baby Lotion & Oils', 'Tear-Free Shampoo', 'Baby Powder & Diaper Rash', 'Baby Soaps', 'others'],
    'Soap': ['Beauty Bar Soap', 'Herbal Soap', 'Medicated Soap', 'Liquid Hand Soap', 'others'],
    'Hair Treatment': ['Hair Oils & Serums', 'Scalp Care', 'Keratin & Smoothing', 'Hair Mask / Butter', 'others'],
    'Parfum': ['Eau de Parfum (EDP)', 'Eau de Toilette (EDT)', 'Body Mist / Spray', 'Roll-on Perfume', 'others'],
    'Deodorant': ['Antiperspirant Spray', 'Body Spray', 'Natural Deodorant', 'others'],
    'Stick and Roll Body Deodorants': ['Roll-On Deodorant', 'Stick Deodorant', 'Whitening Roll-On', 'others'],
    'Oral Care': ['Toothpaste', 'Mouthwash & Rinses', 'Toothbrushes', 'Teeth Whitening', 'others'],
    'Sunscreen': ['SPF 30 Broad Spectrum', 'SPF 50+ Sun Lotion', 'Sunscreen Spray', 'Matte Fluid Sunscreen', 'others'],
    'Vitamins and Supplement': ['Beauty & Collagen', 'Skin, Hair & Nails', 'Herbal Supplements', 'others'],
    'Hair Product': ['Hair Curling', 'Leave-in Conditioner', 'Hair Growth', 'Hair Oil', 'Styling Gel & Wax', 'Hair Spray / Mousse', 'Hair Food & Relaxer', 'others']
  };

  const MEDICATION_CATEGORIES = MEDICINE_CATEGORIES;

  // Dynamically merged categories and subcategories from backend / Category Manager
  const dynamicMedicineCategories = React.useMemo(() => {
    const fromConfig = categories
      .filter(c => (c.type || c.productType || 'medicine') === 'medicine')
      .map(c => c.name.trim());
    return Array.from(new Set([...MEDICINE_CATEGORIES, ...fromConfig, 'others'])).filter(Boolean);
  }, [categories]);

  const dynamicCosmeticsCategories = React.useMemo(() => {
    const fromConfig = categories
      .filter(c => (c.type || c.productType) === 'cosmetics')
      .map(c => c.name.trim());
    return Array.from(new Set([...COSMETICS_CATEGORIES, ...fromConfig, 'others'])).filter(Boolean);
  }, [categories]);

  const dynamicSubcategoryMap = React.useMemo(() => {
    const map: Record<string, string[]> = { ...SUBCATEGORY_OPTIONS_MAP };
    categories.forEach(c => {
      const rawSubs = c.subCategories || c.subcategories || [];
      const formatted = rawSubs.map((s: any) => typeof s === 'string' ? s.trim() : (s.name || '').trim()).filter(Boolean);
      if (formatted.length > 0) {
        const existing = map[c.name.trim()] || [];
        map[c.name.trim()] = Array.from(new Set([...existing, ...formatted, 'others']));
      }
    });
    return map;
  }, [categories]);

  const UNIT_OPTIONS = [
    'Piece (PCS)', 'tablet', 'capsule', 'strip', 'each', 'pkt', 'box', 'bag', 'bottle', 'tube', 'roll', 'tin', 'vial', 'ampoule', 'dozen', 'other'
  ];

  // Debounced search term for non-blocking UI and fast typing performance
  const debouncedSearchTerm = useDebounce(searchTerm, 200);

  // Filters & Sorting Execution - Memoized for speed!
  const filteredMeds = React.useMemo(() => {
    const val = debouncedSearchTerm.toLowerCase().trim();
    const searchWords = val.replace(/[^\w\s]/gi, ' ').split(/\s+/).filter(Boolean);

    return medicines.filter(m => {
      // 1. Name/SKU/Multi-word Query Search
      if (searchWords.length > 0) {
        const mName = (m.name || '').toLowerCase();
        const mGen = (m.genericName || '').toLowerCase();
        const mSKU = (m.sku || '').toLowerCase();
        const mBarcode = (m.barcode || '').toLowerCase();
        const mCat = (m.category || '').toLowerCase();
        const fullText = `${mName} ${mGen} ${mSKU} ${mBarcode} ${mCat}`;

        const matchesQuery = fullText.includes(val) || searchWords.every(w => fullText.includes(w));
        if (!matchesQuery) return false;
      }
      
      // 2. Product Type Differentiator (Check explicit productType OR if category is 'cosmetics')
      const prodType = (m.productType === 'cosmetics' || m.category?.toLowerCase() === 'cosmetics') ? 'cosmetics' : 'medicine';
      const matchesType = selectedProductType === 'all' || prodType === selectedProductType;
      if (!matchesType) return false;

      // 3. Category selector (Case-insensitive check with fallback)
      const matchesCategory = selectedCategoryFilter === 'all' || 
                              m.category?.trim().toLowerCase() === selectedCategoryFilter.trim().toLowerCase();
      if (!matchesCategory) return false;

      // 4. Stock alert level calculations
      const stockSum = getBranchStockSum(m.id);
      let matchesStock = true;
      if (stockLevelFilter === 'low') {
        matchesStock = stockSum > 0 && stockSum <= m.minStockLevel;
      } else if (stockLevelFilter === 'out') {
        matchesStock = stockSum === 0;
      } else if (stockLevelFilter === 'instock') {
        matchesStock = stockSum > m.minStockLevel;
      }
      if (!matchesStock) return false;

      // 5. Supplier filter - O(1) Set lookup
      let matchesSupplier = true;
      if (selectedSupplierFilter !== 'all') {
        matchesSupplier = branchStockMap[m.id]?.supplierIds.has(selectedSupplierFilter) ?? false;
      }
      if (!matchesSupplier) return false;

      // 6. Branch stock presence filter - O(1) check
      // Allow searching and viewing all catalog items in any branch (even with 0 stock) so users can find items to transfer/add.
      const matchesBranch = true;
      
      return matchesBranch;
    });
  }, [medicines, debouncedSearchTerm, selectedProductType, selectedCategoryFilter, stockLevelFilter, selectedSupplierFilter, activeBranchId, getBranchStockSum, branchStockMap]);

  // Sort filtered list - Memoized
  const sortedMeds = React.useMemo(() => {
    return [...filteredMeds].sort((a, b) => {
      if (sortBy === 'none') return 0;
      
      let aVal: any = 0;
      let bVal: any = 0;

      if (sortBy === 'name') {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      } else if (sortBy === 'quantity') {
        aVal = getBranchStockSum(a.id);
        bVal = getBranchStockSum(b.id);
      } else if (sortBy === 'price') {
        aVal = a.price;
        bVal = b.price;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [filteredMeds, sortBy, sortOrder, getBranchStockSum]);

  // Consolidated and sorted display list - Memoized
  const displayMeds = React.useMemo(() => {
    let list = [...sortedMeds];
    if (consolidateSameName) {
      const grouped: { [name: string]: Medicine[] } = {};
      sortedMeds.forEach(m => {
        const key = m.name.trim().toLowerCase();
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(m);
      });

      list = Object.keys(grouped).map(key => {
        const group = grouped[key];
        return { ...group[0] };
      });

      // Re-sort displayMeds after grouping
      list.sort((a, b) => {
        if (sortBy === 'none') return 0;
        let aVal: any = 0;
        let bVal: any = 0;
        if (sortBy === 'name') {
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
        } else if (sortBy === 'quantity') {
          aVal = getConsolidatedStockSum(a.name);
          bVal = getConsolidatedStockSum(b.name);
        } else if (sortBy === 'price') {
          aVal = a.price;
          bVal = b.price;
        }
        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
    }
    return list;
  }, [sortedMeds, consolidateSameName, sortBy, sortOrder, getConsolidatedStockSum]);

  // Paginate Display Catalog List
  const totalPagesCatalog = Math.ceil(displayMeds.length / itemsPerPageInventory);
  const paginatedMeds = displayMeds.slice(
    (currentPageCatalog - 1) * itemsPerPageInventory,
    currentPageCatalog * itemsPerPageInventory
  );

  // Filter batch records - Memoized for ultra speed
  const filteredBatches = React.useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const soonLimitStr = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 180); // Alert if less than 180 days (User mandate)
      return d.toISOString().split('T')[0];
    })();
    const sTermLower = debouncedSearchTerm.toLowerCase().trim();
    const searchWords = sTermLower.replace(/[^\w\s]/gi, ' ').split(/\s+/).filter(Boolean);

    return localStockItems
      .filter(st => (activeBranchId === 'all' || st.branchId === branchId) && !st.isDamaged)
      .filter(st => {
        const med = medicineMap[st.medicineId];
        if (!med) return false;
        
        const prodType = (med.productType === 'cosmetics' || med.category?.toLowerCase() === 'cosmetics') ? 'cosmetics' : 'medicine';
        const matchesType = selectedProductType === 'all' || prodType === selectedProductType;
        if (!matchesType) return false;

        const matchesCategory = selectedCategoryFilter === 'all' || 
                                med.category?.trim().toLowerCase() === selectedCategoryFilter.trim().toLowerCase();
        if (!matchesCategory) return false;

        if (searchWords.length > 0) {
          const mName = (med.name || '').toLowerCase();
          const mGen = (med.genericName || '').toLowerCase();
          const mBatch = (st.batchNumber || '').toLowerCase();
          const mCat = (med.category || '').toLowerCase();
          const fullText = `${mName} ${mGen} ${mBatch} ${mCat}`;

          const matchesQuery = fullText.includes(sTermLower) || searchWords.every(w => fullText.includes(w));
          if (!matchesQuery) return false;
        }
        
        const matchesSupplier = selectedSupplierFilter === 'all' || st.supplierId === selectedSupplierFilter;
        if (!matchesSupplier) return false;

        const isExpired = st.expiryDate < todayStr;
        const isSoon = st.expiryDate >= todayStr && st.expiryDate <= soonLimitStr;

        let matchesExpiry = true;
        if (expiryFilter === 'expired') {
          matchesExpiry = isExpired;
        } else if (expiryFilter === 'soon') {
          matchesExpiry = isSoon;
        } else if (expiryFilter === 'safe') {
          matchesExpiry = !isExpired && !isSoon;
        }

        return matchesExpiry;
      })
      .sort((a, b) => {
        if (sortBy === 'expiry') {
          return sortOrder === 'asc' ? a.expiryDate.localeCompare(b.expiryDate) : b.expiryDate.localeCompare(a.expiryDate);
        }
        return 0;
      });
  }, [localStockItems, activeBranchId, branchId, medicineMap, selectedProductType, selectedCategoryFilter, debouncedSearchTerm, selectedSupplierFilter, expiryFilter, sortBy, sortOrder]);

  // Filter batch records and optionally group them by name - Memoized
  const displayBatches = React.useMemo(() => {
    if (consolidateSameName) {
      const grouped: { [name: string]: StockItem[] } = {};
      filteredBatches.forEach(st => {
        const med = medicineMap[st.medicineId];
        const nameKey = (med?.name || 'Unknown medicine').trim().toLowerCase();
        if (!grouped[nameKey]) {
          grouped[nameKey] = [];
        }
        grouped[nameKey].push(st);
      });

      const list = Object.keys(grouped).map(key => {
        const groupedList = grouped[key];
        const firstMed = medicineMap[groupedList[0].medicineId];
        
        const totalQty = groupedList.reduce((acc, x) => acc + x.quantity, 0);
        const totalStoreQty = groupedList.reduce((acc, x) => acc + (x.storeQuantity !== undefined ? x.storeQuantity : x.quantity), 0);
        const totalDispQty = groupedList.reduce((acc, x) => acc + (x.dispensaryQuantity || 0), 0);
        
        // sorted by expiry to find the earliest
        const sortedByExpiry = [...groupedList].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
        const earliestExpiry = sortedByExpiry[0]?.expiryDate || 'N/A';
        const lastAddedBatch = groupedList[groupedList.length - 1];
        const lastBuyingPrice = lastAddedBatch ? lastAddedBatch.buyingPrice : 0;

        // Representative batch: can use earliest expiry
        const repBatch = sortedByExpiry[0] || groupedList[0];

        return {
          ...repBatch,
          isConsolidated: true,
          medicineName: firstMed?.name || 'Unknown medicine',
          medicineCategory: firstMed?.category || 'N/A',
          batches: groupedList,
          totalQuantity: totalQty,
          totalStoreQuantity: totalStoreQty,
          totalDispensaryQuantity: totalDispQty,
          expiryDate: earliestExpiry,
          buyingPrice: lastBuyingPrice,
          medicineId: firstMed?.id
        };
      });

      // Sort displayBatches again
      list.sort((a, b) => {
        if (sortBy === 'expiry') {
          return sortOrder === 'asc' ? a.expiryDate.localeCompare(b.expiryDate) : b.expiryDate.localeCompare(a.expiryDate);
        }
        return 0;
      });
      return list;
    } else {
      return filteredBatches.map(st => {
        const med = medicineMap[st.medicineId];
        return {
          ...st,
          isConsolidated: false,
          medicineName: med?.name || 'Unknown medicine',
          medicineCategory: med?.category || 'N/A',
          totalQuantity: st.quantity,
          expiryDate: st.expiryDate,
          batches: [st]
        };
      });
    }
  }, [filteredBatches, consolidateSameName, medicineMap, sortBy, sortOrder]);

  // Paginate Display Batches List
  const totalPagesBatches = Math.ceil(displayBatches.length / itemsPerPageInventory);
  const paginatedBatches = displayBatches.slice(
    (currentPageBatches - 1) * itemsPerPageInventory,
    currentPageBatches * itemsPerPageInventory
  );

  // Export filtered catalog to Excel-friendly CSV File
  const exportToExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Product Type,Product Name,Category,Unit Packing,Retail Price (ETB),Buying Price (ETB),Min Level,Current Stock Qty,Rx Required\n";
    
    sortedMeds.forEach(m => {
      const row = [
        m.id,
        (m.productType === 'cosmetics' || m.category?.toLowerCase() === 'cosmetics') ? 'cosmetics' : 'medicine',
        `"${m.name.replace(/"/g, '""')}"`,
        m.category,
        m.unit,
        m.price,
        m.buyingPrice,
        m.minStockLevel,
        getBranchStockSum(m.id),
        m.isPrescriptionRequired ? 'Rx Required' : 'OTC'
      ].join(",");
      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sonan_inventory_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups to export as PDF.');
      return;
    }
    
    const rows = sortedMeds.map(m => {
      const totalStock = getBranchStockSum(m.id);
      return `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 10px; font-size: 11px;">${m.name}</td>
          <td style="padding: 10px; font-size: 11px;">${m.category}</td>
          <td style="padding: 10px; font-size: 11px; font-weight: bold;">${m.price} ETB</td>
          <td style="padding: 10px; font-size: 11px;">${m.unit}</td>
          <td style="padding: 10px; font-size: 11px; font-weight: bold; color: ${totalStock < m.minStockLevel ? '#ef4444' : '#10b981'};">${totalStock}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Sonan Pharmacy - Inventory Catalog Report</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; margin: 40px; }
            h1 { font-size: 20px; color: #1e293b; margin-bottom: 5px; }
            p { font-size: 11px; color: #64748b; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; padding: 12px 10px; background-color: #f1f5f9; color: #475569; font-size: 11px; text-transform: uppercase; font-weight: bold; }
            td { border-bottom: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <h1>Inventory Catalog Report</h1>
          <p>Generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} | Sonan Enterprise Pharmacy Management System</p>
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Retail Price</th>
                <th>Unit</th>
                <th>Active Stock</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Submit Medicine catalog creation/edit
  const handleCreateMedicineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingMed) return;

    if (editingMed) {
      if (!newMed.name) {
        showToast('⚠️ Brand/Product name is required.');
        return;
      }
      if (Number(newMed.price) <= 0) {
        showToast('⚠️ Selling price must be greater than zero.');
        return;
      }

      // Optimistic Instant Edit
      const updatedMedRecord: Medicine = {
        ...editingMed,
        name: newMed.name,
        genericName: newMed.genericName || '',
        price: Number(newMed.price),
        buyingPrice: Number(newMed.buyingPrice || editingMed.buyingPrice || 0),
        imageUrl: newMed.imageUrl,
        description: newMed.description,
        category: newMed.category,
        productType: newMed.productType,
        unit: newMed.unit,
        isPrescriptionRequired: !!newMed.isPrescriptionRequired
      };

      setLocalMedicines(prev => prev.map(m => m.id === editingMed.id ? updatedMedRecord : m));

      // Optimistic instant stock quantity update
      const targetBranch = (activeBranchId && activeBranchId !== 'all') ? activeBranchId : (newMed.branchId || 'b1');
      const targetQty = (newMed.totalQuantity !== undefined && newMed.totalQuantity !== null && !isNaN(Number(newMed.totalQuantity))) 
        ? Math.max(0, Number(newMed.totalQuantity)) 
        : undefined;

      if (targetQty !== undefined) {
        setLocalStockItems(prev => {
          const isMatchingItem = (st: any) => 
            String(st.medicineId).trim() === String(editingMed.id).trim() && 
            ((st.branchId || 'b1') === targetBranch || targetBranch === 'all');

          const matchingBranchStocks = prev.filter(isMatchingItem);
          if (matchingBranchStocks.length > 0) {
            let lastIdx = -1;
            for (let i = prev.length - 1; i >= 0; i--) {
              if (isMatchingItem(prev[i])) {
                lastIdx = i;
                break;
              }
            }
            return prev.map((st, idx) => {
              if (isMatchingItem(st)) {
                if (targetQty === 0) {
                  return { ...st, quantity: 0, storeQuantity: 0, dispensaryQuantity: 0 };
                } else if (idx === lastIdx) {
                  return { ...st, quantity: targetQty, storeQuantity: targetQty, dispensaryQuantity: 0 };
                } else {
                  return { ...st, quantity: 0, storeQuantity: 0, dispensaryQuantity: 0 };
                }
              }
              return st;
            });
          } else if (targetQty > 0) {
            const optNewBatch: StockItem = {
              id: `st_opt_edit_${Date.now()}`,
              medicineId: editingMed.id,
              branchId: targetBranch === 'all' ? 'b1' : targetBranch,
              batchNumber: `B-${Date.now().toString().slice(-4)}`,
              expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              quantity: targetQty,
              storeQuantity: targetQty,
              dispensaryQuantity: 0,
              buyingPrice: Number(newMed.buyingPrice) || editingMed.buyingPrice || 0,
              supplierId: 's1',
              isDamaged: false,
              createdAt: new Date().toISOString().split('T')[0]
            };
            return [optNewBatch, ...prev];
          }
          return prev;
        });
      }

      setShowAddMedModal(false);
      setEditingMed(null);
      showToast(`✨ Product "${newMed.name}" updated (Stock: ${targetQty !== undefined ? targetQty : getBranchStockSum(editingMed.id)}).`);

      // Fire background update
      const submittedMed = { ...editingMed };
      const submittedNewMed = { ...newMed };
      try {
        fetch(`/api/medicines/${submittedMed.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: submittedNewMed.name,
            genericName: submittedNewMed.genericName,
            price: Number(submittedNewMed.price),
            buyingPrice: Number(submittedNewMed.buyingPrice || submittedMed.buyingPrice || 0),
            imageUrl: submittedNewMed.imageUrl,
            description: submittedNewMed.description,
            category: submittedNewMed.category,
            productType: submittedNewMed.productType,
            unit: submittedNewMed.unit,
            isPrescriptionRequired: submittedNewMed.isPrescriptionRequired,
            branchId: targetBranch,
            operatorId: currentUser?.id,
            totalQuantity: targetQty
          })
        }).then(res => {
          if (res.ok) {
            onDataChanged();
          } else {
            console.warn('Background edit save returned non-ok');
            onDataChanged();
          }
        }).catch(err => {
          console.error('Background catalog update error:', err);
          onDataChanged();
        });
      } catch (err) {
        console.error(err);
      }
      return;
    }

    if (!newMed.name.trim()) {
      showToast('⚠️ Please enter a product or brand name.');
      return;
    }

    let finalPrice = Number(newMed.price);
    const buyingPriceVal = Number(newMed.buyingPrice) || 0;
    if (finalPrice <= buyingPriceVal) {
      finalPrice = buyingPriceVal > 0 ? Math.max(buyingPriceVal + 10, Math.round(buyingPriceVal * 1.3)) : 100;
    }

    const initStoreQty = Number(newMed.storeQuantity) || 0;
    const initDispQty = Number(newMed.dispensaryQuantity) || 0;
    const totalInitQty = Math.max(0, initStoreQty + initDispQty);
    const isCosmetics = newMed.productType === 'cosmetics';

    let batchNumberToSubmit = (newMed.batchNumber || '').trim();
    if (totalInitQty > 0 && !batchNumberToSubmit) {
      batchNumberToSubmit = `B-${Date.now().toString().slice(-4)}`;
    }

    let expiryDateToSubmit = (newMed.expiryDate || '').trim();
    if (totalInitQty > 0 && !expiryDateToSubmit && !isCosmetics) {
      expiryDateToSubmit = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    let barcodeToSubmit = newMed.barcode;
    let skuToSubmit = newMed.sku;

    if (!barcodeToSubmit) {
      const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      barcodeToSubmit = `628${randomDigits}`;
    }
    if (!skuToSubmit) {
      skuToSubmit = `SKU-${newMed.productType.toUpperCase()}-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
    }

    const selectedSup = suppliers.find(s => s.id === newMed.supplierId || s.name === newMed.supplierId);
    const supplierName = selectedSup ? selectedSup.name : (newMed.supplierId && newMed.supplierId !== 's1' && newMed.supplierId !== 'supplier1' ? newMed.supplierId : (suppliers[0]?.name || 'Medco Pharmaceuticals PLC'));

    const optimisticMedId = `m_opt_${Date.now()}`;
    const targetBranchId = newMed.branchId || ((activeBranchId && activeBranchId !== 'all') ? activeBranchId : 'b1');

    // Optimistic Medicine Record
    const optimisticMedRecord: Medicine = {
      id: optimisticMedId,
      name: newMed.name.trim(),
      genericName: newMed.genericName?.trim() || '',
      barcode: barcodeToSubmit,
      sku: skuToSubmit,
      category: newMed.category || 'Antibiotics',
      subCategory: newMed.subCategory || '',
      price: finalPrice,
      buyingPrice: buyingPriceVal,
      isPrescriptionRequired: !!newMed.isPrescriptionRequired,
      unit: newMed.unit || 'Piece (PCS)',
      minStockLevel: Number(newMed.minStockLevel) || 10,
      description: newMed.description || '',
      productType: newMed.productType || 'medicine',
      imageUrl: newMed.imageUrl || '',
      profitMargin: Number(newMed.profitMargin) || 30,
      useMarginPricing: newMed.useMarginPricing !== undefined ? !!newMed.useMarginPricing : true,
      purchaseInvoiceNumber: newMed.purchaseInvoiceNumber || undefined,
      supplierId: newMed.supplierId || 's1'
    };

    // Optimistic Stock Items
    if (totalInitQty > 0) {
      if (isNewMedSplit && newMedSplitFirstQty > 0 && newMedSplitFirstQty < totalInitQty) {
        const firstQty = newMedSplitFirstQty;
        const remainderQty = totalInitQty - firstQty;
        const optStock1: StockItem = {
          id: `st_opt_1_${Date.now()}`,
          medicineId: optimisticMedId,
          branchId: targetBranchId,
          batchNumber: batchNumberToSubmit,
          expiryDate: expiryDateToSubmit,
          quantity: firstQty,
          buyingPrice: buyingPriceVal,
          supplierId: newMed.supplierId || 's1',
          isDamaged: false,
          storeQuantity: firstQty,
          dispensaryQuantity: 0,
          originalQuantity: firstQty,
          createdAt: new Date().toISOString().split('T')[0],
          purchaseInvoiceNumber: newMed.purchaseInvoiceNumber || undefined
        };
        const optStock2: StockItem = {
          id: `st_opt_2_${Date.now()}`,
          medicineId: optimisticMedId,
          branchId: newMedSplitSecondBranchId || 'b2',
          batchNumber: batchNumberToSubmit,
          expiryDate: expiryDateToSubmit,
          quantity: remainderQty,
          buyingPrice: buyingPriceVal,
          supplierId: newMed.supplierId || 's1',
          isDamaged: false,
          storeQuantity: remainderQty,
          dispensaryQuantity: 0,
          originalQuantity: remainderQty,
          createdAt: new Date().toISOString().split('T')[0],
          purchaseInvoiceNumber: newMed.purchaseInvoiceNumber || undefined
        };
        setLocalStockItems(prev => [optStock1, optStock2, ...prev]);
      } else {
        const optStock: StockItem = {
          id: `st_opt_${Date.now()}`,
          medicineId: optimisticMedId,
          branchId: targetBranchId,
          batchNumber: batchNumberToSubmit,
          expiryDate: expiryDateToSubmit,
          quantity: totalInitQty,
          buyingPrice: buyingPriceVal,
          supplierId: newMed.supplierId || 's1',
          isDamaged: false,
          storeQuantity: initStoreQty || totalInitQty,
          dispensaryQuantity: initDispQty || 0,
          originalQuantity: totalInitQty,
          createdAt: new Date().toISOString().split('T')[0],
          purchaseInvoiceNumber: newMed.purchaseInvoiceNumber || undefined
        };
        setLocalStockItems(prev => [optStock, ...prev]);
      }
    }

    // Instantly update catalog state (0ms latency!)
    setLocalMedicines(prev => [optimisticMedRecord, ...prev]);

    // Save defaults for consecutive adds
    const newDefaults: ItemAddPresetDefaults = {
      unit: newMed.unit,
      category: newMed.category,
      subCategory: newMed.subCategory,
      supplierId: newMed.supplierId,
      supplierName,
      purchaseInvoiceNumber: newMed.purchaseInvoiceNumber || '',
      branchId: newMed.branchId,
      expiryDate: expiryDateToSubmit,
      buyingPrice: buyingPriceVal,
      price: finalPrice,
      productType: newMed.productType,
      profitMargin: Number(newMed.profitMargin) || 30,
      useMarginPricing: !!newMed.useMarginPricing,
      isPrescriptionRequired: !!newMed.isPrescriptionRequired,
      minStockLevel: Number(newMed.minStockLevel) || 10,
      description: newMed.description || '',
      rememberDefaults: true,
      lastAddedItemName: newMed.name,
      lastAddedAt: new Date().toISOString()
    };
    saveLastAddDefaults(newDefaults);

    // Close modal instantly on 1 click
    setShowAddMedModal(false);
    setEditingMed(null);
    setIsNewMedSplit(false);
    discardInventoryDraft();
    setNewMed({
      name: '', genericName: '', barcode: '', sku: '', 
      category: newDefaults.category || 'Antibiotics',
      subCategory: newDefaults.subCategory || '',
      price: newDefaults.price || 100, 
      buyingPrice: newDefaults.buyingPrice || 70, 
      isPrescriptionRequired: !!newDefaults.isPrescriptionRequired, 
      unit: newDefaults.unit || 'Piece (PCS)', 
      minStockLevel: newDefaults.minStockLevel || 10, 
      description: newDefaults.description || '',
      productType: (newDefaults.productType as 'medicine' | 'cosmetics') || 'medicine', 
      profitMargin: newDefaults.profitMargin || 30, 
      useMarginPricing: newDefaults.useMarginPricing !== undefined ? newDefaults.useMarginPricing : true,
      batchNumber: '', 
      storeQuantity: 0, 
      dispensaryQuantity: 0, 
      expiryDate: newDefaults.expiryDate || '', 
      supplierId: newDefaults.supplierId || 's1', 
      branchId: newDefaults.branchId || ((activeBranchId && activeBranchId !== 'all') ? activeBranchId : 'b1'), 
      purchaseInvoiceNumber: newDefaults.purchaseInvoiceNumber || '', 
      imageUrl: '',
      totalQuantity: 0
    });

    showToast(`⚡ Saved "${newMed.name}" in 1 click.`);

    // Perform background persistent network save
    const submitPayload = {
      ...newMed,
      price: finalPrice,
      buyingPrice: buyingPriceVal,
      batchNumber: batchNumberToSubmit,
      expiryDate: expiryDateToSubmit,
      supplierName,
      barcode: barcodeToSubmit,
      sku: skuToSubmit,
      operatorId: currentUser?.id,
      isNewMedSplit: isNewMedSplit,
      newMedSplitFirstQty: isNewMedSplit ? newMedSplitFirstQty : undefined,
      newMedSplitSecondBranchId: isNewMedSplit ? newMedSplitSecondBranchId : undefined
    };

    fetch('/api/medicines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitPayload)
    }).then(async res => {
      if (res.ok) {
        const savedServerMed = await res.json().catch(() => null);
        if (savedServerMed && savedServerMed.id) {
          setLocalMedicines(prev => prev.map(m => m.id === optimisticMedId ? savedServerMed : m));
        }
        onDataChanged();
      } else {
        console.warn('Background item save returned status', res.status);
        onDataChanged();
      }
    }).catch(err => {
      console.warn('Background item save sync:', err);
      onDataChanged();
    });
  };

  const handleDeleteMedicine = async (medId: string, medName: string) => {
    const msg = `Are you absolutely sure you want to permanently delete "${medName}" from the catalog? This will completely delete the item and all its associated stock batches across all branches. This action cannot be undone.`;

    if (!confirm(msg)) {
      return;
    }
    try {
      const url = `/api/medicines/${medId}?operatorId=${currentUser?.id || 'admin'}`;
      const res = await fetch(url, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert(`Successfully deleted "${medName}" completely from the catalog and all branches.`);
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Failed to delete: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error deleting item.');
    }
  };

  const handleDeleteStockBatch = async (batchId: string, batchNumber: string) => {
    if (!confirm(`Are you absolutely sure you want to permanently delete batch "${batchNumber}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const url = activeBranchId && activeBranchId !== 'all'
        ? `/api/inventory/${batchId}?branchId=${activeBranchId}&operatorId=${currentUser?.id || 'admin'}`
        : `/api/inventory/${batchId}?operatorId=${currentUser?.id || 'admin'}`;
      const res = await fetch(url, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert(`Successfully deleted batch "${batchNumber}".`);
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Failed to delete batch: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error deleting batch.');
    }
  };

  const startEditMedicine = (med: Medicine) => {
    setEditingMed(med);
    const prodType = (med.productType === 'cosmetics' || med.category?.toLowerCase() === 'cosmetics') ? 'cosmetics' : 'medicine';
    const catList = prodType === 'cosmetics' ? dynamicCosmeticsCategories : dynamicMedicineCategories;
    const isCustomCat = !catList.includes(med.category);
    const subList = dynamicSubcategoryMap[med.category] || [];
    const isCustomSub = med.subCategory ? !subList.includes(med.subCategory) : false;

    setNewMed({
      name: med.name,
      genericName: med.genericName || '',
      barcode: med.barcode,
      sku: med.sku,
      category: med.category,
      subCategory: med.subCategory || '',
      price: med.price,
      buyingPrice: med.buyingPrice,
      isPrescriptionRequired: med.isPrescriptionRequired,
      unit: med.unit,
      minStockLevel: med.minStockLevel,
      description: med.description || '',
      imageUrl: med.imageUrl || '',
      productType: prodType,
      profitMargin: med.profitMargin || 30,
      useMarginPricing: med.profitMargin !== undefined,
      batchNumber: '',
      storeQuantity: 0,
      dispensaryQuantity: 0,
      expiryDate: '',
      supplierId: 's1',
      branchId: activeBranchId || 'b1',
      purchaseInvoiceNumber: med.purchaseInvoiceNumber || '',
      totalQuantity: getBranchStockSum(med.id)
    });
    setCustomCategory(isCustomCat ? med.category : '');
    setCustomSubCategory(isCustomSub ? (med.subCategory || '') : '');
    setShowAddMedModal(true);
  };

  const openStockManage = (med: Medicine) => {
    setStockManageMed(med);
    const matchingBatches = stockItems.filter(st => st.medicineId === med.id);
    const lastStock = matchingBatches.length > 0 ? matchingBatches[matchingBatches.length - 1] : null;
    const initialBuyingPrice = lastStock ? lastStock.buyingPrice : (med.buyingPrice || 0);

    setNewBatchForm({
      batchNumber: `B-${Date.now().toString().slice(-4)}`,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      quantity: 10,
      buyingPrice: initialBuyingPrice,
      supplierId: lastStock ? lastStock.supplierId : 's1',
      branchId: branchId === 'all' ? 'b1' : branchId,
      isDamaged: false,
      invoiceNumber: ''
    });
  };

  // Submit Batch editing directly
  const handleEditBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;

    const targetBatch = { ...editingBatch };
    setEditingBatch(null);
    showToast(`⚡ Batch ${targetBatch.batchNumber} updated`);

    setLocalStockItems(prev => prev.map(st => {
      if (st.id === targetBatch.id) {
        return {
          ...st,
          batchNumber: targetBatch.batchNumber,
          expiryDate: targetBatch.expiryDate,
          quantity: targetBatch.quantity,
          storeQuantity: targetBatch.storeQuantity !== undefined ? targetBatch.storeQuantity : targetBatch.quantity,
          dispensaryQuantity: targetBatch.dispensaryQuantity !== undefined ? targetBatch.dispensaryQuantity : 0,
          buyingPrice: targetBatch.buyingPrice,
          supplierId: targetBatch.supplierId,
          isDamaged: !!targetBatch.isDamaged,
          notes: targetBatch.notes
        };
      }
      return st;
    }));

    try {
      const res = await fetch(`/api/inventory/${targetBatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchNumber: targetBatch.batchNumber,
          expiryDate: targetBatch.expiryDate,
          quantity: targetBatch.quantity,
          storeQuantity: targetBatch.storeQuantity !== undefined ? targetBatch.storeQuantity : targetBatch.quantity,
          dispensaryQuantity: targetBatch.dispensaryQuantity !== undefined ? targetBatch.dispensaryQuantity : 0,
          buyingPrice: targetBatch.buyingPrice,
          supplierId: targetBatch.supplierId,
          isDamaged: !!targetBatch.isDamaged,
          notes: targetBatch.notes,
          operatorId: currentUser?.id,
          editWho,
          editWhy,
          branchId: activeBranchId,
          applyQtyToAll,
          applyPriceToAll
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.error}`);
        onDataChanged();
      } else {
        setTimeout(() => onDataChanged(), 300);
      }
    } catch (err) {
      console.error(err);
      onDataChanged();
    }
  };

  const openAdjustQtyModal = (st: StockItem) => {
    setSelectedStockItem(st);
    setTargetNewQty(st.quantity);
    setAdjustmentQty(0);
    setAdjustmentMode('newQty');
  };

  // Submit quick stock offset adjustment
  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStockItem) return;

    const finalAdjQty = adjustmentMode === 'newQty'
      ? (Number(targetNewQty || 0) - selectedStockItem.quantity)
      : adjustmentQty;

    const targetItem = selectedStockItem;
    const newQty = Math.max(0, targetItem.quantity + finalAdjQty);
    const actualDiff = newQty - targetItem.quantity;

    setSelectedStockItem(null);
    setAdjustmentQty(0);
    setTargetNewQty('');
    setAdjustmentReason('Stock Count Verification');
    setAdjustingDamaged(false);
    showToast(`⚡ Stock adjusted to ${newQty} units`);

    setLocalStockItems(prev => prev.map(st => {
      if (st.id === targetItem.id) {
        const newStore = st.storeQuantity !== undefined ? Math.max(0, st.storeQuantity + actualDiff) : newQty;
        return { ...st, quantity: newQty, storeQuantity: newStore, isDamaged: adjustingDamaged };
      }
      return st;
    }));

    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockItemId: targetItem.id,
          adjustmentQty: actualDiff,
          reason: adjustmentReason,
          isDamaged: adjustingDamaged,
          operatorId: currentUser?.id,
          branchId: activeBranchId
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.error}`);
        onDataChanged();
      } else {
        setTimeout(() => onDataChanged(), 300);
      }
    } catch (err) {
      console.error(err);
      onDataChanged();
    }
  };

  // Submit transfer to dispensary
  const handleTransferToDispSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransferStockItem) return;
    if (selectedTransferStockItem.isDamaged) {
      alert('This batch is marked as Damaged/Quarantined. Please un-check "Damaged" status in Batch Edit before transferring.');
      return;
    }
    if (transferToDispQty <= 0) {
      alert('Please enter a positive transfer quantity.');
      return;
    }
    const currentDispQty = selectedTransferStockItem.dispensaryQuantity !== undefined ? selectedTransferStockItem.dispensaryQuantity : 0;
    const currentStoreQty = selectedTransferStockItem.storeQuantity !== undefined 
      ? selectedTransferStockItem.storeQuantity 
      : Math.max(0, selectedTransferStockItem.quantity - currentDispQty);

    if (transferToDispQty > currentStoreQty) {
      alert(`Cannot transfer more than the available store stock of ${currentStoreQty} units.`);
      return;
    }

    setIsTransferringToDisp(true);
    try {
      const res = await fetch('/api/inventory/transfer-to-dispensary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockItemId: selectedTransferStockItem.id,
          transferQty: transferToDispQty,
          operatorId: currentUser?.id
        })
      });

      if (res.ok) {
        setSelectedTransferStockItem(null);
        setTransferToDispQty(0);
        onDataChanged();
        alert('Stock transferred to dispensary successfully!');
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to execute transfer. Network error.');
    } finally {
      setIsTransferringToDisp(false);
    }
  };

  // Bulk stock transfers items management
  const addBulkTransferLine = (stId: string) => {
    const existing = bulkTransferItems.find(x => x.stockItemId === stId);
    if (existing) return;
    setBulkTransferItems([...bulkTransferItems, { stockItemId: stId, quantity: 1 }]);
  };

  const removeBulkTransferLine = (stId: string) => {
    setBulkTransferItems(bulkTransferItems.filter(x => x.stockItemId !== stId));
  };

  const updateBulkTransferLineQty = (stId: string, qty: number) => {
    setBulkTransferItems(bulkTransferItems.map(x => x.stockItemId === stId ? { ...x, quantity: qty } : x));
  };

  const executeBulkTransfer = async () => {
    if (bulkTransferItems.length === 0) {
      alert('Add at least one batch item to transfer.');
      return;
    }
    if (bulkSourceBranchId === bulkTargetBranchId) {
      alert('Source and Target branches must be different.');
      return;
    }

    try {
      const itemsPayload = bulkTransferItems.map(bItem => {
        const st = stockItems.find(x => x.id === bItem.stockItemId)!;
        return {
          medicineId: st.medicineId,
          batchNumber: st.batchNumber,
          expiryDate: st.expiryDate,
          quantity: bItem.quantity
        };
      });

      const res = await fetch('/api/transfers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceBranchId: bulkSourceBranchId,
          targetBranchId: bulkTargetBranchId,
          items: itemsPayload,
          operatorId: currentUser?.id
        })
      });

      if (res.ok) {
        setShowBulkTransferModal(false);
        setBulkTransferItems([]);
        alert('Bulk stock transfer completed successfully!');
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Bulk Transfer Denied: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const hasUnknownOrRecovered = React.useMemo(() => {
    const validMedIds = new Set(medicines.map(m => m.id));
    const hasOrphans = stockItems.some(st => !validMedIds.has(st.medicineId));
    const hasBadMeds = medicines.some(m => {
      const nameLower = (m.name || '').toLowerCase();
      const catLower = (m.category || '').toLowerCase();
      const idLower = (m.id || '').toLowerCase();
      return (
        nameLower.includes('unknown') ||
        nameLower.includes('auto-recovered') ||
        nameLower.includes('recovered') ||
        catLower.includes('auto-recovered') ||
        idLower.startsWith('m_stub_')
      );
    });
    return hasOrphans || hasBadMeds;
  }, [medicines, stockItems]);

  const handleCleanUnknownRecovered = async () => {
    if (!window.confirm('Are you sure you want to permanently delete all auto-recovered/unknown medicines and orphaned stock batches across all branches? This action is irreversible.')) {
      return;
    }
    try {
      const res = await fetch(`/api/clean-unknown-recovered?operatorId=${currentUser?.id || 'admin'}`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || 'Cleanup completed successfully!');
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Cleanup failed: ${err.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to clean recovered items:', err);
      alert('Network error while processing cleanup.');
    }
  };

  return (
    <div id="inventory-manager" className="space-y-6 bg-transparent text-gray-800 font-sans relative">
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-emerald-400 font-extrabold px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-500/30 flex items-center gap-2 text-xs backdrop-blur-md animate-fade-in">
          <span>{toastMsg}</span>
        </div>
      )}
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-5 gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-emerald-600 animate-pulse" />
            Consolidated Stock Ledger &amp; Catalog
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Track and audit pharmaceutical formulations and cosmetics across {currentUser?.branchId === 'all' ? 'all' : 'your active'} branch warehouses.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasUnknownOrRecovered && isAdmin && (
            <button
              onClick={handleCleanUnknownRecovered}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm animate-pulse"
              title="Remove all auto-recovered/unknown medicine records and orphaned batches"
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
              Clean Unknown/Recovered
            </button>
          )}
          {isAdmin && (
            <button
              onClick={openDeleteSelectedProductsModal}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Select multiple items and open Delete Options (All vs Specific Branch)"
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
              Select &amp; Delete Options
            </button>
          )}
          {currentUser?.role !== 'Cashier' && currentUser?.role !== 'Accountant' && (
            <button
              onClick={() => { openBulkTransfer(); }}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <ArrowRightLeft className="h-4 w-4 text-amber-500" />
              Bulk Transfer
            </button>
          )}
          {isAdmin && (
            <button
              onClick={handleOpenAddMedicine}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2 px-4 rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <PackagePlus className="h-4 w-4" />
              Inventory Add
            </button>
          )}
          <button
            onClick={exportToExcel}
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <Download className="h-4 w-4 text-blue-500" />
            Export to Excel
          </button>
          <button
            onClick={exportToPDF}
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <Download className="h-4 w-4 text-emerald-500" />
            Export to PDF
          </button>
        </div>
      </div>

      {/* Critical Stock Alerts Panel */}
      {criticalStockAlerts.length > 0 && (
        <div id="critical-stock-alerts-panel" className="bg-white border border-rose-200 rounded-xl overflow-hidden shadow-sm transition-all duration-300">
          {/* Panel Header */}
          <div className="bg-rose-50/70 border-b border-rose-100 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
              </div>
              <ShieldAlert className="h-4.5 w-4.5 text-rose-600 shrink-0" />
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  Critical Stock Alarms
                  <span className="bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {criticalStockAlerts.length}
                  </span>
                </h3>
                <p className="text-[10px] text-gray-500 font-medium">
                  Medicines below safety threshold for {activeBranchId === 'all' ? 'all warehouses' : 'current branch'}.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setStockLevelFilter(stockLevelFilter === 'low' || stockLevelFilter === 'out' ? 'all' : 'low');
                  setActiveTab('catalog');
                }}
                className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all cursor-pointer ${
                  stockLevelFilter === 'low' || stockLevelFilter === 'out'
                    ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 shadow-xs'
                }`}
              >
                {stockLevelFilter === 'low' || stockLevelFilter === 'out' ? '✓ Showing Alerts only' : 'Filter Ledger list'}
              </button>
              
              <button
                onClick={() => setIsAlertsPanelExpanded(prev => !prev)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-all cursor-pointer"
                title={isAlertsPanelExpanded ? 'Collapse alerts' : 'Expand alerts'}
              >
                {isAlertsPanelExpanded ? (
                  <span className="text-[11px] font-bold text-gray-600 flex items-center gap-0.5">Collapse ✕</span>
                ) : (
                  <span className="text-[11px] font-bold text-rose-600 flex items-center gap-0.5">View Items ({criticalStockAlerts.length}) ↓</span>
                )}
              </button>
            </div>
          </div>

          {/* Panel Items List */}
          {isAlertsPanelExpanded && (
            <div className="p-4 bg-transparent max-h-[320px] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {criticalStockAlerts.map(item => {
                  const { medicine, currentStock, isOutOfStock } = item;
                  return (
                    <div 
                      key={medicine.id}
                      className={`p-3 rounded-lg border transition-all hover:shadow-sm flex flex-col justify-between ${
                        isOutOfStock 
                          ? 'bg-rose-50/20 border-rose-100' 
                          : 'bg-amber-50/15 border-amber-100'
                      }`}
                    >
                      <div>
                        {/* Title and Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-extrabold text-xs text-slate-900 block leading-snug">
                            {medicine.name}
                          </span>
                          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full shrink-0 tracking-wider ${
                            isOutOfStock 
                              ? 'bg-rose-100 text-rose-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isOutOfStock ? 'Out of stock' : 'Low stock'}
                          </span>
                        </div>
                        
                        {/* Details */}
                        <div className="text-[10px] text-gray-500 mt-1.5 space-y-0.5">
                          <p className="flex justify-between">
                            <span>Current Stock:</span> 
                            <span className={`font-bold ${isOutOfStock ? 'text-rose-600' : 'text-amber-700'}`}>
                              {currentStock} {medicine.unit || 'units'}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <span>Min Threshold:</span> 
                            <span className="font-semibold text-gray-700">
                              {medicine.minStockLevel} {medicine.unit || 'units'}
                            </span>
                          </p>
                          {medicine.genericName && (
                            <p className="text-[9px] italic text-gray-400 mt-1">
                              {medicine.genericName}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 mt-3 border-t border-dashed border-gray-100 pt-2">
                        <button
                          onClick={() => {
                            setSearchTerm(medicine.name);
                            setActiveTab('catalog');
                          }}
                          className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-[9px] font-bold py-1 px-2 rounded transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <Search className="h-2.5 w-2.5 text-gray-400" />
                          Locate
                        </button>
                        <button
                          onClick={() => {
                            setStockManageMed(medicine);
                          }}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold py-1 px-2 rounded transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <Plus className="h-2.5 w-2.5" />
                          Restock
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Segment Category Switcher */}
      <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-1.5 rounded-xl border border-gray-250 dark:border-slate-700 overflow-x-auto max-w-full scrollbar-none">
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap min-h-[38px] ${
              activeTab === 'catalog' ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-gray-200 dark:border-slate-750 shadow-xs font-extrabold' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
            }`}
          >
            📦 Products
          </button>
          <button
            onClick={() => setActiveTab('batches')}
            className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap min-h-[38px] ${
              activeTab === 'batches' ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-gray-200 dark:border-slate-750 shadow-xs font-extrabold' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
            }`}
          >
            ⏳ Batches &amp; Expiry
          </button>
          <button
            onClick={() => setActiveTab('damaged')}
            className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap min-h-[38px] ${
              activeTab === 'damaged' ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-gray-200 dark:border-slate-750 shadow-xs font-extrabold' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
            }`}
          >
            ⚠️ Quarantine Logs
          </button>
          <button
            onClick={() => setActiveTab('velocity')}
            className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap min-h-[38px] ${
              activeTab === 'velocity' ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-gray-200 dark:border-slate-750 shadow-xs font-extrabold' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'
            }`}
          >
            ⚡ Movement Velocity
          </button>
        </div>
      </div>
      

      {/* Filter / Search Bento Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
        {/* Term Search */}
        <div className="space-y-1">
          <label className="text-gray-650 block font-semibold">Search Query</label>
          <div className="relative bg-white border border-gray-250 rounded-lg p-2 flex items-center shadow-sm">
            <Search className="h-4 w-4 text-gray-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Query Name, Category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs outline-none bg-transparent text-gray-800 font-semibold"
            />
          </div>
        </div>

        {/* Category Classification */}
        <div className="space-y-1">
          <label className="text-gray-650 block font-semibold">Category Classification</label>
          <select
            value={selectedProductType}
            onChange={(e) => {
              setSelectedProductType(e.target.value as any);
              setSelectedCategoryFilter('all'); // reset subcategory on productType change
            }}
            className="w-full bg-white border border-gray-250 text-gray-850 rounded-lg p-2 outline-none shadow-sm font-semibold"
          >
            <option value="all">All</option>
            <option value="medicine">Medicine</option>
            <option value="cosmetics">Cosmetics</option>
          </select>
        </div>

        {/* Specific Category Group Filter */}
        <div className="space-y-1">
          <label className="text-gray-650 block font-semibold">Specific Category</label>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full bg-white border border-gray-250 text-gray-850 rounded-lg p-2 outline-none shadow-sm font-semibold animate-fade-in"
          >
            <option value="all">All Sub-Categories</option>
            {Array.from(new Set(
              (selectedProductType === 'cosmetics'
                ? [...dynamicCosmeticsCategories, ...medicines.filter(m => m.productType === 'cosmetics' || m.category?.toLowerCase() === 'cosmetics').map(m => m.category)]
                : selectedProductType === 'medicine'
                ? [...dynamicMedicineCategories, ...medicines.filter(m => m.productType !== 'cosmetics' && m.category?.toLowerCase() !== 'cosmetics').map(m => m.category)]
                : [...dynamicMedicineCategories, ...dynamicCosmeticsCategories, ...medicines.map(m => m.category)]
              ).filter(Boolean)
            ))
              .sort()
              .map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))
            }
          </select>
        </div>

        {/* Supplier Filter */}
        <div className="space-y-1">
          <label className="text-gray-650 block font-semibold">Registered Supplier</label>
          <select
            value={selectedSupplierFilter}
            onChange={(e) => setSelectedSupplierFilter(e.target.value)}
            className="w-full bg-white border border-gray-250 text-gray-850 rounded-lg p-2 outline-none shadow-sm font-semibold"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map(sup => (
              <option key={sup.id} value={sup.id}>{sup.name}</option>
            ))}
          </select>
        </div>

        {/* Stock Level Filter */}
        <div className="space-y-1">
          <label className="text-gray-650 block font-semibold">Stock Alarm Levels</label>
          <select
            value={stockLevelFilter}
            onChange={(e) => setStockLevelFilter(e.target.value as any)}
            className="w-full bg-white border border-gray-250 text-gray-850 rounded-lg p-2 outline-none shadow-sm font-semibold"
          >
            <option value="all">All Quantities</option>
            <option value="low">Low Stock Level (Equal/Below Min)</option>
            <option value="instock">Fully Stocked (Above Min)</option>
            <option value="out">Out of Stock (Zero units)</option>
          </select>
        </div>

        {/* Sorting options dropdown */}
        <div className="space-y-1">
          <label className="text-gray-650 block font-semibold">Sort Table Output By</label>
          <div className="flex gap-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 bg-white border border-gray-250 text-gray-850 rounded-lg p-2 outline-none shadow-sm font-semibold"
            >
              <option value="none">Default Ordering</option>
              <option value="name">Product Name</option>
              <option value="quantity">Current Stock Quantity</option>
              <option value="price">Selling Price</option>
              {activeTab === 'batches' && <option value="expiry">Expiry Date</option>}
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="bg-white hover:bg-gray-100 border border-gray-250 text-gray-700 rounded-lg px-2.5 flex items-center justify-center font-bold shadow-sm"
              title="Toggle Sort Order"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: Product Master Catalog */}
      {activeTab === 'catalog' && (
        <div className="bg-white rounded-xl border border-gray-250 overflow-hidden shadow-sm">
          {/* Bulk Selection Action Banner for Catalog Products */}
          {selectedMedIds.length > 0 && isAdmin && (
            <div className="bg-emerald-900 text-white p-3.5 px-4 flex items-center justify-between shadow-md border-b border-emerald-800 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <span className="bg-emerald-800 text-emerald-100 px-2.5 py-1 rounded-lg text-xs font-extrabold border border-emerald-700">
                  {selectedMedIds.length} {selectedMedIds.length === 1 ? 'Product' : 'Products'} Selected
                </span>
                <span className="text-xs text-emerald-100 font-medium hidden sm:inline">
                  Select multi-item delete scope across all branches or specific pharmacy branch
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelectAllMeds(paginatedMeds)}
                  className="bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-600 transition cursor-pointer"
                >
                  {paginatedMeds.length > 0 && paginatedMeds.every(m => selectedMedIds.includes(m.id))
                    ? 'Deselect Page'
                    : 'Select All Page'
                  }
                </button>
                <button
                  type="button"
                  onClick={clearSelectedMeds}
                  className="bg-emerald-950 hover:bg-black text-emerald-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-800 transition cursor-pointer"
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  onClick={openDeleteSelectedProductsModal}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold px-4 py-1.5 rounded-lg shadow flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Selected ({selectedMedIds.length})</span>
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-250 font-bold text-gray-800">
                <tr>
                  {isAdmin && (
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={paginatedMeds.length > 0 && paginatedMeds.every(m => selectedMedIds.includes(m.id))}
                        onChange={() => toggleSelectAllMeds(paginatedMeds)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                        title="Select all products on current page"
                      />
                    </th>
                  )}
                  <th className="p-3">Product Name &amp; Type</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Unit Packing</th>
                  <th className="p-3 font-mono">Buying Cost</th>
                  <th className="p-3 font-mono">Selling Price</th>
                  <th className="p-3 text-center">Consolidated Stock</th>
                  <th className="p-3 text-center font-semibold">Ledger Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 text-gray-700">
                {paginatedMeds.map((med) => {
                  const branchSum = consolidateSameName ? getConsolidatedStockSum(med.name) : getBranchStockSum(med.id);
                  const isLow = branchSum <= med.minStockLevel;
                  
                  const velocityInfo = velocitySalesMap[med.id] || { qtySold: 0 };
                  const qtySold = velocityInfo.qtySold;
                  let movementIndicator = null;
                  if (qtySold >= 15) {
                    movementIndicator = (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-[8px] font-extrabold px-1.5 py-0.2 rounded-md flex items-center gap-0.5 uppercase tracking-wide">
                        <TrendingUp className="h-2 w-2 text-emerald-600 shrink-0" />
                        Fast (▲ {qtySold} sold)
                      </span>
                    );
                  } else if (qtySold > 0) {
                    movementIndicator = (
                      <span className="bg-blue-50 text-blue-800 border border-blue-250 text-[8px] font-extrabold px-1.5 py-0.2 rounded-md flex items-center gap-0.5 uppercase tracking-wide">
                        <Activity className="h-2 w-2 text-blue-600 shrink-0" />
                        Active (● {qtySold} sold)
                      </span>
                    );
                  } else {
                    movementIndicator = (
                      <span className="bg-amber-50/50 text-amber-800 border border-amber-250 text-[8px] font-extrabold px-1.5 py-0.2 rounded-md flex items-center gap-0.5 uppercase tracking-wide">
                        <TrendingDown className="h-2 w-2 text-amber-600 shrink-0" />
                        Static (▼ 0 sold)
                      </span>
                    );
                  }
                  
                  return (
                    <tr key={med.id} className={`hover:bg-gray-50/75 transition-colors ${selectedMedIds.includes(med.id) ? 'bg-emerald-50/60' : ''}`}>
                      {isAdmin && (
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedMedIds.includes(med.id)}
                            onChange={() => toggleSelectMed(med.id)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="p-3 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-black text-xs hover:underline cursor-pointer">{med.name}</span>
                          <span className={`px-1.5 py-0.2 rounded-md text-[8px] font-bold uppercase border ${
                            ((med.productType === 'cosmetics' || med.category?.toLowerCase() === 'cosmetics') ? 'cosmetics' : 'medicine') === 'medicine' ? 'bg-blue-50 text-blue-750 border-blue-200' : 'bg-pink-50 text-pink-750 border-pink-200'
                          }`}>
                            {(med.productType === 'cosmetics' || med.category?.toLowerCase() === 'cosmetics') ? 'cosmetics' : 'medicine'}
                          </span>
                          {movementIndicator}
                          {med.purchaseInvoiceNumber && (
                            <span className="bg-amber-50 border border-amber-250 text-amber-850 font-mono font-bold text-[8px] px-1.5 py-0.2 rounded" title="Purchase Invoice Number">
                              PIN: {med.purchaseInvoiceNumber}
                            </span>
                          )}
                        </div>
                        {med.description && <p className="text-[10px] text-gray-500 max-w-xs truncate">{med.description}</p>}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className="bg-gray-100 border border-gray-200 text-gray-750 px-2 py-0.5 rounded text-[10px] font-bold">{med.category}</span>
                          {med.subCategory && (
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded text-[9px] font-semibold">{med.subCategory}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-gray-700">{med.unit}</td>
                      <td className="p-3 font-mono text-gray-600 font-semibold">{med.buyingPrice} ETB</td>
                      <td className="p-3 font-mono text-emerald-700 font-bold">{med.price} ETB</td>
                      <td className="p-3 text-center font-bold">
                        {isLow ? (
                          <span className="text-red-700 font-black bg-red-50 px-2.5 py-1 rounded border border-red-200 inline-block text-[11px]">
                            🔴 Low ({branchSum} units)
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-black bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 inline-block text-[11px]">
                            🟢 Normal ({branchSum} units)
                          </span>
                        )}
                        {isLow && (
                          <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1 py-0.2 rounded border border-red-200 block mt-1 w-24 mx-auto uppercase">
                            Min: {med.minStockLevel}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openBinCard(med)}
                            className="bg-white hover:bg-gray-100 text-gray-750 border border-gray-300 font-bold p-1.5 rounded cursor-pointer shadow-sm"
                            title="Interactive Bin Card Ledger"
                          >
                            <Clipboard className="h-3.5 w-3.5 text-emerald-600" />
                          </button>
                          {(currentUser?.role === 'Super Administrator' || currentUser?.role === 'Branch Manager' || currentUser?.role === 'Pharmacist' || currentUser?.role === 'Store Keeper') && (
                            <button
                              onClick={() => openStockManage(med)}
                              className="bg-white hover:bg-gray-100 text-gray-750 border border-gray-300 font-bold p-1.5 rounded cursor-pointer shadow-sm"
                              title="Manage Stock Batches (Detailed)"
                            >
                              <Package className="h-3.5 w-3.5 text-emerald-600" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => startEditMedicine(med)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold px-3 py-1.5 rounded cursor-pointer shadow-sm flex items-center gap-1.5 text-xs"
                              title="Adjust Price and Quantity Instantly"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-emerald-600 animate-bounce" />
                              Adjust Price &amp; Qty
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => openDeleteSingleProductModal(med.id, med.name)}
                              className="bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold p-1.5 rounded cursor-pointer shadow-sm flex items-center gap-1 text-xs"
                              title="Delete Item Option (All vs Specific Branch)"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
                              <span className="hidden lg:inline text-[10px] font-bold">Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {displayMeds.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-gray-400 italic font-semibold">No master products match the active filter criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls for TAB 1 */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-700 font-semibold">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                value={itemsPerPageInventory}
                onChange={(e) => {
                  setItemsPerPageInventory(Number(e.target.value));
                  setCurrentPageCatalog(1);
                  setCurrentPageBatches(1);
                }}
                className="bg-white border border-gray-300 text-gray-800 rounded px-2.5 py-1 outline-none font-bold shadow-sm"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={15}>15 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
              <span>entries</span>
            </div>
            
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              <span className="text-[11px] text-gray-600">Page <strong>{currentPageCatalog}</strong> of <strong>{totalPagesCatalog || 1}</strong> ({displayMeds.length} total)</span>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => setCurrentPageCatalog(prev => Math.max(prev - 1, 1))}
                  disabled={currentPageCatalog === 1}
                  className="px-3 py-1.5 rounded bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors cursor-pointer shadow-sm text-xs"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPageCatalog(prev => Math.min(prev + 1, totalPagesCatalog))}
                  disabled={currentPageCatalog === totalPagesCatalog || totalPagesCatalog === 0}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors cursor-pointer shadow-sm text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Batch expiration */}
      {activeTab === 'batches' && (
        <div className="bg-white rounded-xl border border-gray-250 overflow-hidden shadow-sm">
          {/* Bulk Selection Action Banner for Stock Batches */}
          {selectedStockItemIds.length > 0 && isAdmin && (
            <div className="bg-emerald-900 text-white p-3.5 px-4 flex items-center justify-between shadow-md border-b border-emerald-800 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <span className="bg-emerald-800 text-emerald-100 px-2.5 py-1 rounded-lg text-xs font-extrabold border border-emerald-700">
                  {selectedStockItemIds.length} {selectedStockItemIds.length === 1 ? 'Batch' : 'Batches'} Selected
                </span>
                <span className="text-xs text-emerald-100 font-medium hidden sm:inline">
                  Delete selected stock batches across all branches or specific pharmacy branch
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelectAllStockItems(paginatedBatches)}
                  className="bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-600 transition cursor-pointer"
                >
                  {paginatedBatches.length > 0 && paginatedBatches.every(b => selectedStockItemIds.includes(b.id))
                    ? 'Deselect Page'
                    : 'Select All Page'
                  }
                </button>
                <button
                  type="button"
                  onClick={clearSelectedStockItems}
                  className="bg-emerald-950 hover:bg-black text-emerald-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-800 transition cursor-pointer"
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  onClick={openDeleteSelectedBatchesModal}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold px-4 py-1.5 rounded-lg shadow flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Selected ({selectedStockItemIds.length})</span>
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-250 font-bold text-gray-800">
                <tr>
                  {isAdmin && (
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={paginatedBatches.length > 0 && paginatedBatches.every(b => selectedStockItemIds.includes(b.id))}
                        onChange={() => toggleSelectAllStockItems(paginatedBatches)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                        title="Select all stock batches on current page"
                      />
                    </th>
                  )}
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Batch Number</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3">Supplier Name</th>
                  <th className="p-3 font-mono">Buying Cost</th>
                  <th className="p-3 text-center font-mono">Stock Quantity</th>
                  <th className="p-3">Status Block</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 text-gray-700">
                {paginatedBatches.map((st) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const soonLimitStr = (() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 180); // alert less than 180 days
                    return d.toISOString().split('T')[0];
                  })();

                  const isExpired = st.expiryDate < todayStr;
                  const isSoon = st.expiryDate >= todayStr && st.expiryDate <= soonLimitStr;
                  const isNearExpiry = isExpired || isSoon;

                  const parentMed = medicines.find(m => m.name.toLowerCase().trim() === st.medicineName.toLowerCase().trim());
                  const batchMinStock = parentMed ? parentMed.minStockLevel : 10;
                  const isBatchLow = st.totalQuantity <= batchMinStock;

                  const expandedKey = st.medicineName.toLowerCase().trim();
                  const isExpanded = expandedBatchNames.includes(expandedKey);

                  const toggleExpand = () => {
                    if (isExpanded) {
                      setExpandedBatchNames(expandedBatchNames.filter(k => k !== expandedKey));
                    } else {
                      setExpandedBatchNames([...expandedBatchNames, expandedKey]);
                    }
                  };

                  const rowClass = isNearExpiry 
                    ? "bg-red-50 hover:bg-red-100 text-red-950 border-l-4 border-red-500 font-bold" 
                    : "hover:bg-gray-50/75 transition-colors text-gray-700";

                  const itemNameClass = isNearExpiry
                    ? "font-extrabold text-red-900 text-xs"
                    : "font-extrabold text-black text-xs hover:underline cursor-pointer";

                  return (
                    <React.Fragment key={st.isConsolidated ? `grouped-${st.medicineName}` : `item-${st.id}`}>
                      <tr className={`${rowClass} ${selectedStockItemIds.includes(st.id) ? 'bg-emerald-50/60' : ''}`}>
                      {isAdmin && (
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedStockItemIds.includes(st.id)}
                            onChange={() => toggleSelectStockItem(st.id)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                          />
                        </td>
                      )}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <div className={itemNameClass}>{st.medicineName}</div>
                            {st.isConsolidated && (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded flex items-center gap-1" title="Consolidated items with same name">
                                <Layers className="h-2 w-2" />
                                Grouped
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] ${isNearExpiry ? 'text-red-700 font-semibold' : 'text-gray-500'}`}>{st.medicineCategory}</div>
                        </td>
                        <td className={`p-3 font-mono ${isNearExpiry ? 'text-red-700 font-bold' : 'text-gray-600'}`}>
                          {st.isConsolidated ? (
                            <button
                              type="button"
                              onClick={toggleExpand}
                              className="text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer text-[10px] flex items-center gap-1"
                            >
                              Multiple ({st.batches.length} Batches)
                            </button>
                          ) : (
                            st.batchNumber
                          )}
                        </td>
                        <td className="p-3 font-semibold font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className={isExpired ? 'text-red-600 font-extrabold' : isSoon ? 'text-amber-600 animate-pulse font-bold' : 'text-gray-800'}>
                              {st.isConsolidated ? `Earliest: ${st.expiryDate}` : st.expiryDate}
                            </span>
                            {!st.isConsolidated && isAdmin && (
                              <button
                                type="button"
                                onClick={() => setEditingExpiryItem({
                                  id: st.id,
                                  batchNumber: st.batchNumber,
                                  medicineName: st.medicineName || 'Product Item',
                                  currentExpiryDate: st.expiryDate,
                                  newExpiryDate: st.expiryDate,
                                  reason: ''
                                })}
                                className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 text-[9px] font-bold flex items-center gap-0.5 transition cursor-pointer shadow-2xs"
                                title="Quick Edit Expiry Date"
                              >
                                <Calendar className="h-2.5 w-2.5" />
                                Edit Expiry
                              </button>
                            )}
                          </div>
                        </td>
                        <td className={`p-3 ${isNearExpiry ? 'text-red-800' : 'text-gray-700'}`}>
                          {st.isConsolidated ? (
                            <span className="text-gray-400 italic font-semibold">Various</span>
                          ) : (
                            suppliers.find(s => s.id === st.supplierId)?.name || 'N/A'
                          )}
                        </td>
                        <td className={`p-3 font-mono ${isNearExpiry ? 'text-red-800 font-bold' : 'text-gray-600'}`}>
                          {st.isConsolidated ? `Last: ${st.buyingPrice} ETB` : `${st.buyingPrice} ETB`}
                        </td>
                        <td className="p-3 text-center font-bold font-mono">
                          {isBatchLow ? (
                            <span className="text-red-700 font-black bg-red-100/70 border border-red-200 px-2 py-0.5 rounded text-[10px] inline-block">
                              🔴 Low ({st.totalQuantity} units)
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-black bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] inline-block">
                              🟢 Normal ({st.totalQuantity} units)
                            </span>
                          )}
                          {!st.isConsolidated && isAdmin && (
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleQuickInlineAdjust(st, -1); }}
                                className="h-5 w-5 bg-gray-100 hover:bg-red-600 hover:text-white border border-gray-300 rounded text-xs font-bold flex items-center justify-center transition cursor-pointer shadow-xs"
                                title="Decrease stock by 1 unit"
                              >
                                -
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleQuickInlineAdjust(st, +1); }}
                                className="h-5 w-5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 rounded text-xs font-bold flex items-center justify-center transition cursor-pointer shadow-xs"
                                title="Increase stock by 1 unit"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleQuickInlineAdjust(st, +5); }}
                                className="px-1 h-5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-300 rounded text-[9px] font-bold flex items-center justify-center transition cursor-pointer shadow-xs"
                                title="Increase stock by 5 units"
                              >
                                +5
                              </button>
                            </div>
                          )}
                          <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                            Store: {st.isConsolidated ? ((st as any).totalStoreQuantity ?? st.totalQuantity) : (st.storeQuantity ?? st.totalQuantity)} • Disp: {st.isConsolidated ? ((st as any).totalDispensaryQuantity ?? 0) : (st.dispensaryQuantity ?? 0)}
                          </div>
                        </td>
                        <td className="p-3">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded-full">
                              Expired Blocked
                            </span>
                          ) : isSoon ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                              Exp Soon (&lt;180 Days)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                              Fully Compliant
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {st.isConsolidated ? (
                              <button
                                type="button"
                                onClick={toggleExpand}
                                className="bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 font-semibold py-1 px-2.5 rounded text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                              >
                                <Eye className="h-3 w-3" />
                                {isExpanded ? 'Hide' : 'Select Batch'}
                              </button>
                            ) : (
                              currentUser?.role !== 'Cashier' && currentUser?.role !== 'Accountant' && (
                                <>
                                  {isAdmin && (
                                    <>
                                      <button
                                        onClick={() => { handleStartEditBatch(st); }}
                                        className="bg-white hover:bg-gray-50 text-gray-750 border border-gray-300 font-semibold py-1 px-2.5 rounded text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                                      >
                                        <Edit2 className="h-3 w-3 text-blue-600" />
                                        Edit Batch
                                      </button>
                                      <button
                                        onClick={() => { openAdjustQtyModal(st); }}
                                        className="bg-white hover:bg-gray-100 text-gray-750 border border-gray-300 font-semibold py-1 px-2.5 rounded text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                                      >
                                        <Settings className="h-3 w-3 text-amber-500" />
                                        Adjust Qty
                                      </button>
                                    </>
                                  )}
                                  {isAdmin && (
                                    <button
                                      onClick={() => openDeleteSingleBatchModal(st.id, st.batchNumber, st.medicineName)}
                                      className="bg-white hover:bg-red-50 text-red-600 border border-red-200 font-semibold py-1 px-2.5 rounded text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                                      title="Delete Batch Option (All vs Specific Branch)"
                                    >
                                      <Trash2 className="h-3 w-3 text-red-600" />
                                      Delete Batch
                                    </button>
                                  )}
                                  {(st.storeQuantity !== undefined ? st.storeQuantity : st.quantity) > 0 && (
                                    <button
                                      onClick={() => { setSelectedTransferStockItem(st); setTransferToDispQty(0); }}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1 px-2.5 rounded text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                                      title="Transfer items from Store to Dispensary"
                                    >
                                      <ArrowDownRight className="h-3 w-3" />
                                      To Disp.
                                    </button>
                                  )}
                                </>
                              )
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Batches Sub-Table */}
                      {st.isConsolidated && isExpanded && (
                        <tr className="bg-gray-50/50 border-b border-gray-250">
                          <td colSpan={8} className="p-3">
                            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-inner p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-gray-800 font-extrabold text-[11px] flex items-center gap-1.5 uppercase tracking-wider font-mono">
                                  <Layers className="h-3 w-3 text-emerald-600" />
                                  Individual Batches Breakdown for {st.medicineName}
                                </h4>
                                <span className="text-[10px] text-gray-500 font-mono font-bold">Select a batch to adjust or correct</span>
                              </div>
                              
                              <table className="min-w-full text-left text-[10px]">
                                <thead className="bg-gray-50 text-gray-650 font-bold uppercase tracking-wider font-mono border-b border-gray-200">
                                  <tr>
                                    <th className="p-2">Batch Number</th>
                                    <th className="p-2">Expiry Date</th>
                                    <th className="p-2">Supplier Name</th>
                                    <th className="p-2 font-mono">Buying Cost</th>
                                    <th className="p-2 text-center font-mono">Quantity</th>
                                    <th className="p-2">Status</th>
                                    <th className="p-2 text-center">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-gray-700">
                                  {st.batches.map((batch: StockItem) => {
                                    const batchSup = suppliers.find(s => s.id === batch.supplierId);
                                    const batchExpired = batch.expiryDate < todayStr;
                                    const batchSoon = batch.expiryDate >= todayStr && batch.expiryDate <= soonLimitStr;
                                    const batchIsNearExpiry = batchExpired || batchSoon;
                                    
                                    const batchRowClass = batchIsNearExpiry 
                                      ? "bg-red-55 hover:bg-red-100/80 text-red-950 font-bold" 
                                      : "hover:bg-gray-50/70 transition-colors";
                                    
                                    return (
                                      <tr key={batch.id} className={batchRowClass}>
                                        <td className="p-2 font-mono font-extrabold text-black">{batch.batchNumber}</td>
                                        <td className="p-2 font-mono">
                                          <span className={batchExpired ? 'text-red-600 font-black' : batchSoon ? 'text-amber-600 font-bold' : 'text-gray-800'}>
                                            {batch.expiryDate}
                                          </span>
                                        </td>
                                        <td className="p-2 text-gray-600 font-semibold">{batchSup?.name || 'N/A'}</td>
                                        <td className="p-2 font-mono text-gray-600 font-semibold">{batch.buyingPrice} ETB</td>
                                        <td className="p-2 text-center font-extrabold font-mono text-black">
                                          {batch.quantity} units
                                          <div className="text-[9px] text-gray-500 font-mono">
                                            Store: {batch.storeQuantity ?? batch.quantity} • Disp: {batch.dispensaryQuantity ?? 0}
                                          </div>
                                        </td>
                                        <td className="p-2">
                                          {batchExpired ? (
                                            <span className="text-[8px] bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.2 rounded-full font-extrabold uppercase">Expired</span>
                                          ) : batchSoon ? (
                                            <span className="text-[8px] bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded-full font-extrabold uppercase">Soon</span>
                                          ) : (
                                            <span className="text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded-full font-extrabold uppercase">OK</span>
                                          )}
                                        </td>
                                        <td className="p-2 text-center">
                                          <div className="flex justify-center gap-1.5">
                                            {currentUser?.role !== 'Cashier' && currentUser?.role !== 'Accountant' && (
                                              <>
                                                {isAdmin && (
                                                  <>
                                                    <button
                                                      onClick={() => handleStartEditBatch(batch)}
                                                      className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold py-0.5 px-2 rounded text-[9px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                                                    >
                                                      <Edit2 className="h-2.5 w-2.5 text-blue-600" />
                                                      Edit
                                                    </button>
                                                    <button
                                                      onClick={() => setEditingExpiryItem({
                                                        id: batch.id,
                                                        batchNumber: batch.batchNumber,
                                                        medicineName: st.medicineName || 'Product Item',
                                                        currentExpiryDate: batch.expiryDate,
                                                        newExpiryDate: batch.expiryDate,
                                                        reason: ''
                                                      })}
                                                      className="bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 font-semibold py-0.5 px-2 rounded text-[9px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                                                      title="Edit Expiry Date"
                                                    >
                                                      <Calendar className="h-2.5 w-2.5 text-blue-600" />
                                                      Expiry
                                                    </button>
                                                    <button
                                                      onClick={() => openAdjustQtyModal(batch)}
                                                      className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold py-0.5 px-2 rounded text-[9px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                                                    >
                                                      <Settings className="h-2.5 w-2.5 text-amber-500" />
                                                      Adjust
                                                    </button>
                                                  </>
                                                )}
                                                {(batch.storeQuantity !== undefined ? batch.storeQuantity : batch.quantity) > 0 && (
                                                  <button
                                                    onClick={() => { setSelectedTransferStockItem(batch); setTransferToDispQty(0); }}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-0.5 px-2 rounded text-[9px] flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                                                    title="Transfer items from Store to Dispensary"
                                                  >
                                                    <ArrowDownRight className="h-2.5 w-2.5" />
                                                    To Disp
                                                  </button>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {displayBatches.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-gray-450 italic font-semibold">No batches found for active branch warehouse.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls for TAB 2 */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-700 font-semibold">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                value={itemsPerPageInventory}
                onChange={(e) => {
                  setItemsPerPageInventory(Number(e.target.value));
                  setCurrentPageCatalog(1);
                  setCurrentPageBatches(1);
                }}
                className="bg-white border border-gray-300 text-gray-800 rounded px-2.5 py-1 outline-none font-bold shadow-sm"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={15}>15 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
              <span>entries</span>
            </div>
            
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              <span className="text-[11px] text-gray-600">Page <strong>{currentPageBatches}</strong> of <strong>{totalPagesBatches || 1}</strong> ({displayBatches.length} total)</span>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => setCurrentPageBatches(prev => Math.max(prev - 1, 1))}
                  disabled={currentPageBatches === 1}
                  className="px-3 py-1.5 rounded bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors cursor-pointer shadow-sm text-xs"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPageBatches(prev => Math.min(prev + 1, totalPagesBatches))}
                  disabled={currentPageBatches === totalPagesBatches || totalPagesBatches === 0}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors cursor-pointer shadow-sm text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Damaged item logs */}
      {activeTab === 'damaged' && (
        <div className="bg-white rounded-xl border border-gray-250 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-250 font-bold text-gray-800">
                <tr>
                  <th className="p-3">Product formulation</th>
                  <th className="p-3">Batch Reference</th>
                  <th className="p-3 text-center font-mono">Quarantine Quantity</th>
                  <th className="p-3">Damage Description/Audit Details</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 text-gray-700">
                {stockItems
                  .filter(st => (activeBranchId === 'all' || st.branchId === branchId) && st.isDamaged)
                  .map((st) => {
                    const med = medicines.find(m => m.id === st.medicineId);
                    return (
                      <tr key={st.id} className="hover:bg-red-50/50 transition-colors">
                        <td className="p-3">
                          <span className="font-extrabold text-black block">{med?.name}</span>
                          <span className="text-[10px] text-gray-500 font-bold">{med?.category}</span>
                        </td>
                        <td className="p-3 font-mono text-gray-600 font-semibold">{st.batchNumber}</td>
                        <td className="p-3 text-center text-red-700 font-extrabold font-mono">{st.quantity} units</td>
                        <td className="p-3 text-gray-600 italic font-sans">{st.notes || 'Flagged as damaged during audit count.'}</td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded-full">
                            Quarantined
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                {stockItems.filter(st => (activeBranchId === 'all' || st.branchId === branchId) && st.isDamaged).length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-gray-400 italic font-semibold">No damaged or quarantined inventory batches recorded in this branch.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Stock Movement & Velocity Analyzer */}
      {activeTab === 'velocity' && (
        <div className="space-y-6">
          
          {/* Top Controls: Period Selection & Threshold */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm text-left grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-6 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 block">⚡ Velocity Analytics Window</span>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Determine Sourcing Velocity &amp; Capital Turnovers</h3>
              <p className="text-xs text-gray-500">Select standard reporting periods to filter active branch invoice transactions and classify items by movement velocity levels.</p>
            </div>
            
            <div className="md:col-span-6 flex flex-col sm:flex-row gap-4 justify-end">
              <div className="space-y-1.5 flex-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Select Period</label>
                <div className="flex bg-gray-100 dark:bg-slate-950 p-1 rounded-lg border border-gray-250 dark:border-slate-800">
                  {(['week', 'month', '3month', 'year'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setVelocityPeriod(p)}
                      className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md capitalize transition-all cursor-pointer ${
                        velocityPeriod === p 
                          ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm border border-gray-100 dark:border-slate-700' 
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {p === '3month' ? '3 Months' : p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 min-w-[150px]">
                <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block flex justify-between">
                  <span>Fast-Moving Limit</span>
                  <span className="font-mono font-bold text-emerald-600">{fastThreshold} units</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="range"
                    min="1"
                    max={velocityPeriod === 'week' ? '50' : velocityPeriod === 'month' ? '200' : velocityPeriod === '3month' ? '500' : '2000'}
                    value={fastThreshold}
                    onChange={(e) => setFastThreshold(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer h-2 bg-gray-200 dark:bg-slate-800 rounded-lg mt-3"
                  />
                  <input
                    type="number"
                    min="1"
                    value={fastThreshold}
                    onChange={(e) => setFastThreshold(Math.max(1, Number(e.target.value)))}
                    className="w-16 border rounded-lg px-2 py-1 text-xs font-mono font-bold text-center bg-gray-50 dark:bg-slate-950 dark:border-slate-800"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sourcing Category summary cards (Filters) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            <button
              onClick={() => setSelectedVelocityCategory('all')}
              className={`p-4 rounded-2xl border text-left transition-all shadow-sm flex flex-col justify-between h-28 relative overflow-hidden cursor-pointer ${
                selectedVelocityCategory === 'all'
                  ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:bg-slate-900 text-gray-800 dark:text-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className={`text-[10px] uppercase font-bold tracking-wider ${selectedVelocityCategory === 'all' ? 'text-emerald-400' : 'text-gray-400'}`}>Full Catalog</span>
                <span className="text-sm">📋</span>
              </div>
              <div className="mt-2">
                <span className="text-xl font-black font-mono block">
                  {velocityAnalysis.filter(i => i.category !== 'inactive' || i.currentStock > 0).length}
                </span>
                <span className="text-[10px] font-semibold opacity-70">Monitored Items</span>
              </div>
            </button>

            <button
              onClick={() => setSelectedVelocityCategory('fast')}
              className={`p-4 rounded-2xl border text-left transition-all shadow-sm flex flex-col justify-between h-28 relative overflow-hidden cursor-pointer ${
                selectedVelocityCategory === 'fast'
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 ring-2 ring-emerald-500/30'
                  : 'bg-white border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:bg-slate-900 text-slate-800 dark:text-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400 font-extrabold">🚀 Fast Moving</span>
                <span className="text-sm">🔥</span>
              </div>
              <div className="mt-2">
                <span className="text-xl font-black font-mono block text-emerald-700 dark:text-emerald-400">{velocityStats.fast}</span>
                <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">Dispensing regularly</span>
              </div>
            </button>

            <button
              onClick={() => setSelectedVelocityCategory('slow')}
              className={`p-4 rounded-2xl border text-left transition-all shadow-sm flex flex-col justify-between h-28 relative overflow-hidden cursor-pointer ${
                selectedVelocityCategory === 'slow'
                  ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-500 ring-2 ring-blue-500/30'
                  : 'bg-white border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:bg-slate-900 text-slate-800 dark:text-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 dark:text-blue-400 font-extrabold">🐢 Slow Moving</span>
                <span className="text-sm">🚲</span>
              </div>
              <div className="mt-2">
                <span className="text-xl font-black font-mono block text-blue-700 dark:text-blue-400">{velocityStats.slow}</span>
                <span className="text-[10px] font-semibold text-blue-800 dark:text-blue-300">Periodic turnovers</span>
              </div>
            </button>

            <button
              onClick={() => setSelectedVelocityCategory('nonmoving')}
              className={`p-4 rounded-2xl border text-left transition-all shadow-sm flex flex-col justify-between h-28 relative overflow-hidden cursor-pointer ${
                selectedVelocityCategory === 'nonmoving'
                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-500 ring-2 ring-amber-500/30'
                  : 'bg-white border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:bg-slate-900 text-slate-800 dark:text-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-400 font-extrabold">🧊 Non-Moving</span>
                <span className="text-sm">❄️</span>
              </div>
              <div className="mt-2">
                <span className="text-xl font-black font-mono block text-amber-700 dark:text-amber-400">{velocityStats.nonmoving}</span>
                <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300">Capital tied up</span>
              </div>
            </button>

            <button
              onClick={() => setSelectedVelocityCategory('dead')}
              className={`p-4 rounded-2xl border text-left transition-all shadow-sm flex flex-col justify-between h-28 relative overflow-hidden cursor-pointer ${
                selectedVelocityCategory === 'dead'
                  ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-500 ring-2 ring-rose-500/30'
                  : 'bg-white border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:bg-slate-900 text-slate-800 dark:text-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] uppercase font-bold tracking-wider text-rose-700 dark:text-rose-400 font-extrabold">💀 Dead Stock</span>
                <span className="text-sm">⚠️</span>
              </div>
              <div className="mt-2">
                <span className="text-xl font-black font-mono block text-rose-700 dark:text-rose-400">{velocityStats.dead}</span>
                <span className="text-[10px] font-semibold text-rose-800 dark:text-rose-300">Write-off hazards</span>
              </div>
            </button>

          </div>

          {/* Voice Assistance Bento Panel */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl p-6 border border-slate-700 shadow-xl flex flex-col lg:flex-row gap-6 items-stretch">
            
            {/* Voice Console controls */}
            <div className="flex-1 space-y-4 text-left">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 p-1.5 rounded-xl block">
                  <Sparkles className="h-4.5 w-4.5 animate-pulse" />
                </span>
                <div>
                  <h4 className="text-sm font-sans font-bold flex items-center gap-1.5 uppercase tracking-wider">
                    🔊 Sourcing Intelligence Voice Assistant 
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium">Audible stock audits, pricing strategies, and voice-command summaries.</p>
                </div>
              </div>

              {/* Status controls */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 pt-1 text-xs">
                <button
                  onClick={startListening}
                  disabled={isListening}
                  className={`py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isListening 
                      ? 'bg-red-600 text-white animate-pulse' 
                      : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-900/30'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      Listening...
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      Speak Command
                    </>
                  )}
                </button>

                <button
                  onClick={() => speakText(generateGeneralSummary())}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Volume2 className="h-4 w-4 text-emerald-500" />
                  Read Audit
                </button>

                <button
                  onClick={stopSpeaking}
                  disabled={!isSpeaking}
                  className={`py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isSpeaking 
                      ? 'bg-slate-800 hover:bg-slate-700 text-red-400 border border-red-900/30' 
                      : 'bg-slate-900 text-slate-600 border border-slate-850 cursor-not-allowed'
                  }`}
                >
                  <VolumeX className="h-4 w-4" />
                  Stop Playback
                </button>
              </div>

              {/* Action shortcuts */}
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <span className="text-[9px] uppercase font-extrabold text-slate-400 block tracking-widest">Click to Simulate Voice Commands</span>
                <div className="flex flex-wrap gap-1.5">
                  <button 
                    onClick={() => handleVoiceCommand("read summary")}
                    className="bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-slate-800 transition-all cursor-pointer"
                  >
                    📝 Summary Report
                  </button>
                  <button 
                    onClick={() => handleVoiceCommand("list fast moving")}
                    className="bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-slate-800 transition-all cursor-pointer"
                  >
                    🚀 Fast-Moving List
                  </button>
                  <button 
                    onClick={() => handleVoiceCommand("list dead stock")}
                    className="bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-slate-800 transition-all cursor-pointer"
                  >
                    💀 Dead Stock Alert
                  </button>
                  <button 
                    onClick={() => handleVoiceCommand("list slow moving")}
                    className="bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-slate-800 transition-all cursor-pointer"
                  >
                    🐢 Slow-Moving List
                  </button>
                </div>
              </div>
            </div>

            {/* Response Console Display */}
            <div className="flex-1 bg-slate-950/60 rounded-2xl p-4.5 border border-slate-800 flex flex-col justify-between text-left space-y-3.5 min-h-[160px]">
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <span>Assistant Command Console</span>
                  <span className="font-mono text-emerald-500">{isListening ? "🟢 Mic Active" : isSpeaking ? "🔊 Playing Audio" : "⚪ Standby"}</span>
                </div>
                
                {/* Chat transcript block */}
                <div className="space-y-2 font-sans text-xs">
                  {speechTranscript ? (
                    <div className="flex gap-2 items-start bg-slate-900/40 p-2 rounded-lg">
                      <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded font-bold uppercase text-slate-400">Heard</span>
                      <p className="italic text-slate-300 font-mono">"{speechTranscript}"</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic mt-1 font-sans">
                      Try saying or clicking a shortcut: "Read summary", "List dead stock", or "Check [medicine name]"
                    </p>
                  )}

                  {speechResponse && (
                    <div className="flex gap-2 items-start bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/30">
                      <span className="text-[10px] bg-emerald-900/50 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Reply</span>
                      <p className="text-slate-200 leading-relaxed font-sans">{speechResponse}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Adjust voice properties */}
              <div className="flex flex-wrap gap-4 pt-2 text-[10px] text-slate-400 border-t border-slate-900">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">Pitch:</span>
                  <input 
                    type="range" min="0.5" max="1.5" step="0.1" value={speechPitch} 
                    onChange={(e) => setSpeechPitch(Number(e.target.value))}
                    className="w-16 accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer animate-none"
                  />
                  <span className="font-mono">{speechPitch}x</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">Speed:</span>
                  <input 
                    type="range" min="0.6" max="1.6" step="0.1" value={speechRate} 
                    onChange={(e) => setSpeechRate(Number(e.target.value))}
                    className="w-16 accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono">{speechRate}x</span>
                </div>
              </div>
            </div>

          </div>

          {/* Sourcing Intelligence Table */}
          <div className="space-y-3.5 text-left">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald-600 animate-pulse" />
                Product Turnover Speed &amp; Movement Log ({velocityPeriod === 'week' ? 'Past Week' : velocityPeriod === 'month' ? 'Past Month' : velocityPeriod === '3month' ? 'Past 3 Months' : 'Past Year'})
              </h4>
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter movement table by drug name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 text-xs pl-9 pr-3 py-2 border rounded-xl shadow-sm text-gray-700 dark:text-slate-300 dark:border-slate-800"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden text-xs shadow-sm">
              <table className="min-w-full text-left">
                <thead className="bg-gray-50 dark:bg-slate-950 font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider text-[10px] border-b dark:border-slate-800">
                  <tr>
                    <th className="p-3">Drug / Product Formulation</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-center">In Stock</th>
                    <th className="p-3 text-center">Orders Count</th>
                    <th className="p-3 text-center">Total Dispensed</th>
                    <th className="p-3 text-right">Value Sourced (ETB)</th>
                    <th className="p-3 text-center">Sourcing Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 dark:divide-slate-800 text-gray-650 dark:text-slate-300 font-medium">
                  {velocityAnalysis
                    .filter(item => {
                      const searchLower = debouncedSearchTerm.toLowerCase().trim();
                      const matchesSearch = !searchLower || 
                                           item.medicine.name.toLowerCase().includes(searchLower) || 
                                           (item.medicine.genericName && item.medicine.genericName.toLowerCase().includes(searchLower));
                      
                      let matchesCategory = true;
                      if (selectedVelocityCategory === 'fast') matchesCategory = item.category === 'fast';
                      else if (selectedVelocityCategory === 'slow') matchesCategory = item.category === 'slow';
                      else if (selectedVelocityCategory === 'nonmoving') matchesCategory = item.category === 'nonmoving';
                      else if (selectedVelocityCategory === 'dead') matchesCategory = item.category === 'dead';
                      else {
                        matchesCategory = item.category !== 'inactive' || item.currentStock > 0;
                      }

                      return matchesSearch && matchesCategory;
                    })
                    .length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-gray-400 italic">
                        No product records match the selected velocity category filters or search queries in this branch.
                      </td>
                    </tr>
                  ) : (
                    velocityAnalysis
                      .filter(item => {
                        const searchLower = debouncedSearchTerm.toLowerCase().trim();
                        const matchesSearch = !searchLower || 
                                             item.medicine.name.toLowerCase().includes(searchLower) || 
                                             (item.medicine.genericName && item.medicine.genericName.toLowerCase().includes(searchLower));
                        
                        let matchesCategory = true;
                        if (selectedVelocityCategory === 'fast') matchesCategory = item.category === 'fast';
                        else if (selectedVelocityCategory === 'slow') matchesCategory = item.category === 'slow';
                        else if (selectedVelocityCategory === 'nonmoving') matchesCategory = item.category === 'nonmoving';
                        else if (selectedVelocityCategory === 'dead') matchesCategory = item.category === 'dead';
                        else {
                          matchesCategory = item.category !== 'inactive' || item.currentStock > 0;
                        }

                        return matchesSearch && matchesCategory;
                      })
                      .map((item, idx) => {
                        let statusBadge = null;
                        let recommendation = "";
                        
                        if (item.category === 'fast') {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950/65 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-900 px-2.5 py-1 rounded-full">
                              🚀 FAST MOVING
                            </span>
                          );
                          recommendation = item.currentStock < item.medicine.minStockLevel ? "🚨 Restock Immediately" : "✅ Stock level healthy";
                        } else if (item.category === 'slow') {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase bg-blue-100 text-blue-700 dark:bg-blue-950/65 dark:text-blue-400 border border-blue-300 dark:border-blue-900 px-2.5 py-1 rounded-full">
                              🐢 SLOW MOVING
                            </span>
                          );
                          recommendation = "📈 Monitor seasonal demand";
                        } else if (item.category === 'nonmoving') {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase bg-amber-100 text-amber-700 dark:bg-amber-950/65 dark:text-amber-400 border border-amber-300 dark:border-amber-900 px-2.5 py-1 rounded-full">
                              🧊 NON-MOVING
                            </span>
                          );
                          recommendation = "🏷️ Consider small markdowns";
                        } else if (item.category === 'dead') {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase bg-rose-100 text-rose-700 dark:bg-rose-950/65 dark:text-rose-400 border border-rose-300 dark:border-rose-900 px-2.5 py-1 rounded-full animate-pulse">
                              💀 DEAD STOCK
                            </span>
                          );
                          recommendation = item.expired ? "🚨 Expired - Write off!" : "⚠️ Supplier return or bundle";
                        } else {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold bg-gray-150 text-gray-500 px-2 py-0.5 rounded-full">
                              Inactive / Off-shelf
                            </span>
                          );
                          recommendation = "Stock level zero";
                        }

                        return (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="p-3">
                              <span className="font-extrabold text-gray-900 dark:text-white block">{item.medicine.name}</span>
                              <span className="text-[10px] text-gray-400 font-mono block mt-0.5">
                                {item.medicine.genericName || 'No Generic'} • SKU: {item.medicine.sku}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold px-2 py-0.5 rounded uppercase text-[10px]">
                                {item.medicine.category}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold">
                              <span className={item.currentStock === 0 ? 'text-gray-400' : item.currentStock < item.medicine.minStockLevel ? 'text-amber-600 font-extrabold' : 'text-gray-900 dark:text-white'}>
                                {item.currentStock.toLocaleString()}
                              </span>
                              <span className="text-[9px] text-gray-400 block font-normal">Min: {item.medicine.minStockLevel}</span>
                            </td>
                            <td className="p-3 text-center font-mono font-semibold text-gray-650 dark:text-slate-300">
                              {item.salesCount.toLocaleString()} transactions
                            </td>
                            <td className="p-3 text-center font-mono font-extrabold text-slate-800 dark:text-slate-200">
                              {item.qtySold.toLocaleString()} units
                            </td>
                            <td className="p-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                              {item.totalValue.toLocaleString()} ETB
                            </td>
                            <td className="p-3 text-center">
                              <div className="space-y-1">
                                <div>{statusBadge}</div>
                                <div className="text-[9px] text-gray-400 font-semibold">{recommendation}</div>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => speakText(`${item.medicine.name} is classified as ${item.category === 'fast' ? 'fast moving' : item.category === 'slow' ? 'slow moving' : item.category === 'dead' ? 'dead stock' : 'non-moving'}. In the current period, you have dispensed ${item.qtySold} units, generating ${item.totalValue.toLocaleString('en-US')} Birr. The active in-stock level is ${item.currentStock} units.`)}
                                className="bg-emerald-50 hover:bg-emerald-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-400 p-1.5 rounded-lg border border-emerald-200 dark:border-slate-800 hover:scale-105 transition-all cursor-pointer"
                                title="Speak Status"
                              >
                                <Volume2 className="h-3.5 w-3.5" />
                              </button>
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

      {/* Modal: Manage Stock & Quantities */}
      {stockManageMed && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-gray-250 text-gray-850 max-h-[85vh] overflow-y-auto pr-3 scrollbar-thin">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3.5 mb-4 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <Package className="h-4 w-4 text-emerald-600" />
                  Manage Stock &amp; Quantities
                </h3>
                <p className="text-[11px] text-gray-500 font-semibold mt-0.5">{stockManageMed.name}</p>
              </div>
              <button 
                onClick={() => setStockManageMed(null)} 
                className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Existing Batches List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Existing Stock Batches &amp; Locations</h4>
                {stockItems.filter(st => st.medicineId === stockManageMed.id && st.branchId === branchId).length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded p-4 text-center text-xs text-gray-500 italic font-semibold">
                    No active stock batches found for this product in this branch. Use the form below to add a stock batch.
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {stockItems.filter(st => st.medicineId === stockManageMed.id && st.branchId === branchId).map(st => {
                      const branchName = branchesList.find(b => b.id === st.branchId)?.name || st.branchId;
                      const supplierName = suppliers.find(s => s.id === st.supplierId)?.name || 'Unknown';
                      return (
                        <div key={st.id} className="bg-gray-50 border border-gray-250 rounded-lg p-3 flex flex-wrap items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-950 font-mono text-xs">{st.batchNumber || 'NO_BATCH'}</span>
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-emerald-200 uppercase">{branchName}</span>
                              {st.isDamaged && <span className="bg-red-100 text-red-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-red-200">Damaged</span>}
                            </div>
                            <div className="text-[10px] text-gray-500 font-semibold flex flex-wrap gap-x-3 gap-y-1 items-center">
                              <span className="flex items-center gap-1">
                                Expiry: <b>{st.expiryDate || 'N/A'}</b>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingExpiryItem({
                                      id: st.id,
                                      batchNumber: st.batchNumber || 'NO_BATCH',
                                      medicineName: stockManageMed.name,
                                      currentExpiryDate: st.expiryDate || '',
                                      newExpiryDate: st.expiryDate || '',
                                      reason: ''
                                    })}
                                    className="ml-1 text-[10px] text-blue-600 hover:text-blue-800 underline font-bold cursor-pointer flex items-center gap-0.5"
                                    title="Edit Expiry Date"
                                  >
                                    <Calendar className="h-3 w-3" />
                                    Edit Expiry
                                  </button>
                                )}
                              </span>
                              <span>Cost: <b>{st.buyingPrice} ETB</b></span>
                              <span>Supplier: <b>{supplierName}</b></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-500 uppercase block tracking-wider">Stock Qty (units)</label>
                              {isAdmin ? (
                                <input 
                                  type="number" 
                                  min="0"
                                  defaultValue={st.quantity}
                                  onBlur={async (e) => {
                                    const newQty = Number(e.target.value);
                                    if (isNaN(newQty) || newQty < 0) return;
                                    try {
                                      setUpdatingBatchId(st.id);
                                      const res = await fetch(`/api/inventory/${st.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          quantity: newQty,
                                          operatorId: currentUser?.id,
                                          editWho: currentUser?.name || currentUser?.username || 'Admin',
                                          editWhy: 'Direct Catalog Stock Edit'
                                        })
                                      });
                                      if (res.ok) {
                                        onDataChanged();
                                      } else {
                                        alert('Failed to update stock quantity.');
                                      }
                                    } catch (err) {
                                      console.error(err);
                                    } finally {
                                      setUpdatingBatchId(null);
                                    }
                                  }}
                                  className="w-24 bg-white border border-gray-300 rounded px-2 py-1 outline-none text-gray-850 font-mono font-bold text-xs"
                                />
                              ) : (
                                <div className="w-24 bg-gray-100 border border-gray-200 rounded px-2 py-1 text-gray-800 font-mono font-bold text-xs">
                                  {st.quantity}
                                </div>
                              )}
                            </div>
                            <div className="pt-4 text-[10px] text-gray-400 font-bold">
                              {updatingBatchId === st.id ? 'Saving...' : 'Auto-saves'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Simple Physical Stock & Price Adjustment (Regardless of Batch) */}
              {isAdmin && (
                <div className="bg-amber-50/40 border border-amber-200 rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="h-4.5 w-4.5 text-amber-700" />
                  Simple Physical Adjustment (Quantity &amp; Price)
                </h4>
                <p className="text-[11px] text-amber-800 leading-relaxed font-semibold">
                  Quickly correct the physical stock level and catalog pricing of <strong>{stockManageMed.name}</strong> for {activeBranchId === 'all' ? 'the default warehouse (b1)' : `branch "${branchesList.find(b => b.id === branchId)?.name || 'Active Branch'}"`}. This updates product specs globally and automatically reconciles the physical inventory count.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-700 block uppercase tracking-wider">Physical Stock (Units)</label>
                    <input 
                      type="number"
                      min="0"
                      value={simpleAdjQty}
                      onChange={(e) => setSimpleAdjQty(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 outline-none font-mono font-bold text-xs text-gray-950 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      placeholder="e.g. 50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-700 block uppercase tracking-wider">Selling Price (ETB)</label>
                    <input 
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={simpleAdjPrice}
                      onChange={(e) => setSimpleAdjPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 outline-none font-mono font-bold text-xs text-gray-950 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      placeholder="e.g. 150"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-700 block uppercase tracking-wider">Buying Cost (ETB)</label>
                    <input 
                      type="number"
                      min="0"
                      step="0.01"
                      value={simpleAdjBuyingPrice}
                      onChange={(e) => setSimpleAdjBuyingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 outline-none font-mono font-bold text-xs text-gray-950 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      placeholder="e.g. 100"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      if (simpleAdjQty === '' || simpleAdjPrice === '' || simpleAdjBuyingPrice === '') {
                        alert('Please fill out all quantity and price fields before adjusting.');
                        return;
                      }
                      const qtyVal = Number(simpleAdjQty);
                      const priceVal = Number(simpleAdjPrice);
                      const buyingVal = Number(simpleAdjBuyingPrice);

                      if (isNaN(qtyVal) || qtyVal < 0 || isNaN(priceVal) || priceVal <= 0 || isNaN(buyingVal) || buyingVal < 0) {
                        alert('Please enter valid, non-negative numbers (selling price must be greater than 0).');
                        return;
                      }

                      if (confirm(`Are you sure you want to set physical stock of "${stockManageMed.name}" to ${qtyVal} units, selling price to ${priceVal} ETB, and buying price to ${buyingVal} ETB?`)) {
                        try {
                          const res = await fetch(`/api/medicines/${stockManageMed.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              price: priceVal,
                              buyingPrice: buyingVal,
                              totalQuantity: qtyVal,
                              branchId: activeBranchId,
                              operatorId: currentUser?.id,
                              purchaseInvoiceNumber: 'PHYSICAL_ADJUSTMENT'
                            })
                          });

                          if (res.ok) {
                            alert('Physical stock and pricing details successfully adjusted.');
                            onDataChanged();
                            setStockManageMed(null);
                          } else {
                            const err = await res.json();
                            alert(`Error: ${err.error || 'Failed to apply physical adjustment'}`);
                          }
                        } catch (err) {
                          console.error(err);
                          alert('Network error when trying to apply adjustment.');
                        }
                      }
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    Apply Physical Adjustment
                  </button>
                </div>
              </div>
              )}

              {/* Add New Batch Form */}
              {isAdmin && (
                <div className="border-t border-gray-200 pt-5 space-y-3">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <PackagePlus className="h-4 w-4 text-emerald-600" />
                  Add New Stock Batch
                </h4>
                
                <div className="grid grid-cols-2 gap-3.5 text-xs text-gray-700">
                  <div className="space-y-1">
                    <label className="font-bold">Target Location Branch *</label>
                    <select
                      value={newBatchForm.branchId}
                      onChange={(e) => setNewBatchForm({ ...newBatchForm, branchId: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850"
                    >
                      {branchesList.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold">Batch Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. BAT-2026-X"
                      value={newBatchForm.batchNumber}
                      onChange={(e) => setNewBatchForm({ ...newBatchForm, batchNumber: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold">Expiry Date {(stockManageMed?.productType === 'cosmetics' || stockManageMed?.category?.toLowerCase() === 'cosmetics') ? '(Optional)' : '*'}</label>
                    <input
                      type="date"
                      value={newBatchForm.expiryDate}
                      onChange={(e) => setNewBatchForm({ ...newBatchForm, expiryDate: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold">Buying Cost (ETB per unit)</label>
                    <input
                      type="number"
                      min="0"
                      value={newBatchForm.buyingPrice}
                      onChange={(e) => setNewBatchForm({ ...newBatchForm, buyingPrice: Number(e.target.value) })}
                      className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold">Initial Batch Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      value={newBatchForm.quantity}
                      onChange={(e) => setNewBatchForm({ ...newBatchForm, quantity: Number(e.target.value) })}
                      className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold">Preferred Supplier</label>
                    <select
                      value={newBatchForm.supplierId}
                      onChange={(e) => setNewBatchForm({ ...newBatchForm, supplierId: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850"
                    >
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold">Invoice Number (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-XYZ"
                      value={newBatchForm.invoiceNumber || ''}
                      onChange={(e) => setNewBatchForm({ ...newBatchForm, invoiceNumber: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850 font-mono"
                    />
                  </div>

                  {/* SPLIT BATCH OPTION */}
                  <div className="col-span-2 pt-2.5 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="split-batch-toggle"
                        checked={isSplitBatch}
                        onChange={(e) => {
                          setIsSplitBatch(e.target.checked);
                          if (e.target.checked) {
                            const half = Math.max(1, Math.floor(newBatchForm.quantity * 0.75));
                            setSplitFirstBranchQty(half);
                            const other = branchesList.find(b => b.id !== newBatchForm.branchId)?.id || 'b2';
                            setSplitSecondBranchId(other);
                          }
                        }}
                        className="rounded border-gray-300 text-emerald-600 bg-white cursor-pointer h-4 w-4"
                      />
                      <label htmlFor="split-batch-toggle" className="font-bold text-gray-700 cursor-pointer select-none">
                        🔄 Split this received batch quantity between two branches?
                      </label>
                    </div>

                    {isSplitBatch && (
                      <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 border-dashed">
                        <div className="space-y-1">
                          <label className="font-bold text-emerald-800 block">Qty for {branchesList.find(b => b.id === newBatchForm.branchId)?.name || 'First Branch'}:</label>
                          <input
                            type="number"
                            min="1"
                            max={newBatchForm.quantity - 1}
                            value={splitFirstBranchQty}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(newBatchForm.quantity - 1, Number(e.target.value)));
                              setSplitFirstBranchQty(val);
                            }}
                            className="w-full bg-white border border-gray-300 rounded p-1.5 outline-none font-mono text-emerald-900 font-bold"
                          />
                          <p className="text-[10px] text-gray-500">Must be less than total ({newBatchForm.quantity})</p>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-emerald-800 block">Assign Remainder to Branch:</label>
                          <select
                            value={splitSecondBranchId}
                            onChange={(e) => setSplitSecondBranchId(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded p-1.5 outline-none text-emerald-900 font-semibold"
                          >
                            {branchesList.filter(b => b.id !== newBatchForm.branchId).map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <p className="text-[10px] font-semibold text-emerald-700 mt-1">
                            Remainder quantity: <strong className="font-mono text-xs">{newBatchForm.quantity - splitFirstBranchQty} units</strong>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const isCosmetics = stockManageMed?.productType === 'cosmetics' || stockManageMed?.category?.toLowerCase() === 'cosmetics';
                      if (!newBatchForm.batchNumber || (!isCosmetics && !newBatchForm.expiryDate) || newBatchForm.quantity <= 0) {
                        showToast('⚠️ Please provide a batch number and quantity.');
                        return;
                      }

                      // Never add expired items rule
                      const todayStr = new Date().toISOString().split('T')[0];
                      if (!isCosmetics && newBatchForm.expiryDate && newBatchForm.expiryDate < todayStr) {
                        showToast('⚠️ Expiry date cannot be in the past.');
                        return;
                      }

                      if (isSplitBatch && splitFirstBranchQty >= newBatchForm.quantity) {
                        showToast('⚠️ Split quantity for first branch must be less than total.');
                        return;
                      }

                      const selectedBatchSup = suppliers.find(s => s.id === newBatchForm.supplierId || s.name === newBatchForm.supplierId);
                      const batchSupplierName = selectedBatchSup ? selectedBatchSup.name : (newBatchForm.supplierId && newBatchForm.supplierId !== 's1' && newBatchForm.supplierId !== 'supplier1' ? newBatchForm.supplierId : (suppliers[0]?.name || 'Medco Pharmaceuticals PLC'));

                      // Optimistic batch creation
                      const targetBranch = newBatchForm.branchId || activeBranchId || 'b1';
                      if (isSplitBatch) {
                        const firstQty = splitFirstBranchQty;
                        const secondQty = newBatchForm.quantity - splitFirstBranchQty;
                        const optB1: StockItem = {
                          id: `st_opt_split1_${Date.now()}`,
                          medicineId: stockManageMed.id,
                          branchId: targetBranch,
                          batchNumber: newBatchForm.batchNumber,
                          expiryDate: newBatchForm.expiryDate,
                          quantity: firstQty,
                          buyingPrice: newBatchForm.buyingPrice || stockManageMed.buyingPrice || 0,
                          supplierId: newBatchForm.supplierId || 's1',
                          isDamaged: !!newBatchForm.isDamaged,
                          storeQuantity: firstQty,
                          dispensaryQuantity: 0,
                          originalQuantity: firstQty,
                          createdAt: new Date().toISOString().split('T')[0]
                        };
                        const optB2: StockItem = {
                          id: `st_opt_split2_${Date.now()}`,
                          medicineId: stockManageMed.id,
                          branchId: splitSecondBranchId || 'b2',
                          batchNumber: newBatchForm.batchNumber,
                          expiryDate: newBatchForm.expiryDate,
                          quantity: secondQty,
                          buyingPrice: newBatchForm.buyingPrice || stockManageMed.buyingPrice || 0,
                          supplierId: newBatchForm.supplierId || 's1',
                          isDamaged: !!newBatchForm.isDamaged,
                          storeQuantity: secondQty,
                          dispensaryQuantity: 0,
                          originalQuantity: secondQty,
                          createdAt: new Date().toISOString().split('T')[0]
                        };
                        setLocalStockItems(prev => [optB1, optB2, ...prev]);
                      } else {
                        const optB: StockItem = {
                          id: `st_opt_b_${Date.now()}`,
                          medicineId: stockManageMed.id,
                          branchId: targetBranch,
                          batchNumber: newBatchForm.batchNumber,
                          expiryDate: newBatchForm.expiryDate,
                          quantity: newBatchForm.quantity,
                          buyingPrice: newBatchForm.buyingPrice || stockManageMed.buyingPrice || 0,
                          supplierId: newBatchForm.supplierId || 's1',
                          isDamaged: !!newBatchForm.isDamaged,
                          storeQuantity: newBatchForm.quantity,
                          dispensaryQuantity: 0,
                          originalQuantity: newBatchForm.quantity,
                          createdAt: new Date().toISOString().split('T')[0]
                        };
                        setLocalStockItems(prev => [optB, ...prev]);
                      }

                      showToast(`⚡ Batch "${newBatchForm.batchNumber}" added in 1 click.`);

                      const submittedBatchForm = { ...newBatchForm };
                      const isSplit = isSplitBatch;
                      const fQty = splitFirstBranchQty;
                      const sBranchId = splitSecondBranchId;

                      // Reset form instantly
                      setIsSplitBatch(false);
                      setNewBatchForm({
                        batchNumber: `B-${Date.now().toString().slice(-4)}`,
                        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        quantity: 10,
                        buyingPrice: stockManageMed.buyingPrice || 0,
                        supplierId: 's1',
                        branchId: activeBranchId || 'b1',
                        isDamaged: false,
                        invoiceNumber: ''
                      });

                      // Fire background save
                      if (isSplit) {
                        const secondQty = submittedBatchForm.quantity - fQty;
                        Promise.all([
                          fetch('/api/inventory', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              medicineId: stockManageMed.id,
                              ...submittedBatchForm,
                              supplierName: batchSupplierName,
                              quantity: fQty,
                              operatorId: currentUser?.id
                            })
                          }),
                          fetch('/api/inventory', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              medicineId: stockManageMed.id,
                              ...submittedBatchForm,
                              supplierName: batchSupplierName,
                              branchId: sBranchId,
                              quantity: secondQty,
                              operatorId: currentUser?.id
                            })
                          })
                        ]).then(() => onDataChanged()).catch(err => {
                          console.warn('Background split batch save:', err);
                          onDataChanged();
                        });
                      } else {
                        fetch('/api/inventory', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            medicineId: stockManageMed.id,
                            ...submittedBatchForm,
                            supplierName: batchSupplierName,
                            operatorId: currentUser?.id
                          })
                        }).then(() => onDataChanged()).catch(err => {
                          console.warn('Background batch save:', err);
                          onDataChanged();
                        });
                      }
                      }}
                      disabled={isSubmittingBatch}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-sans font-bold text-xs py-2 rounded shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isSubmittingBatch ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Registering Batch...</span>
                        </>
                      ) : (
                        <span>Add / Register This Batch</span>
                      )}
                    </button>
                </div>
              </div>
              )}
            </div>

            <div className="flex justify-end pt-5 border-t border-gray-100 mt-5">
              <button
                type="button"
                onClick={() => setStockManageMed(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs py-1.5 px-4 rounded transition-all cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Register/Edit Medicine/Cosmetic */}
      {showAddMedModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-250 text-gray-850 max-h-[80vh] overflow-y-auto pr-3 scrollbar-thin">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3.5 mb-4 sticky top-0 bg-white z-10">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <PackagePlus className="h-5 w-5 text-emerald-600" />
                {editingMed ? 'Edit Registered Specifications' : 'Inventory Add - Catalog Index'}
              </h3>
              <button 
                onClick={() => { setShowAddMedModal(false); setEditingMed(null); }} 
                className="p-1 hover:bg-gray-100 rounded text-gray-400 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {hasInventoryDraft && !editingMed && (
              <div className="p-3 mb-4 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-base">📝</span>
                  <div>
                    <span className="font-bold block">Unsaved Inventory Draft Found!</span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-300">
                      {inventoryDraftData?.name ? `Item "${inventoryDraftData.name}"` : 'Form progress'} saved from a previous session.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={restoreInventoryDraft}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-sm transition-colors cursor-pointer text-xs"
                  >
                    Restore Draft
                  </button>
                  <button
                    type="button"
                    onClick={discardInventoryDraft}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-amber-800 dark:text-amber-200 font-medium rounded border border-amber-300 dark:border-amber-700 transition-colors cursor-pointer text-xs"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {!editingMed && (
              <div className="mb-3.5 p-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Consecutive Add Active
                  </span>
                  {serverPresets?.lastAddedItemName ? (
                    <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300 font-medium hidden sm:inline">
                      • Remembering specs from: <strong className="font-semibold">{serverPresets.lastAddedItemName}</strong> ({serverPresets.category} • {serverPresets.unit})
                    </span>
                  ) : (
                    <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300 font-medium hidden sm:inline">
                      • Form data automatically persists across all item additions &amp; backups
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleApplySavedDefaults}
                    title="Reload category, pricing, supplier, unit and specifications from last added item"
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    ⚡ Apply Last Info
                  </button>
                  <button
                    type="button"
                    onClick={handleResetFormToBlank}
                    title="Reset fields to blank default template"
                    className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-300 dark:border-slate-600 rounded text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    🔄 Blank Form
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateMedicineSubmit} className="space-y-4 text-xs">
              {editingMed ? (
                <>
                  {/* 1. Edit Name & Generic Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="font-bold text-gray-700 dark:text-slate-200 block text-xs">Product Brand / Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Product Name"
                        value={newMed.name}
                        onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg p-2.5 outline-none text-gray-800 dark:text-slate-100 focus:border-emerald-500 font-medium text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-gray-700 dark:text-slate-200 block text-xs">Generic / Active Ingredient Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Paracetamol, Amoxicillin"
                        value={newMed.genericName}
                        onChange={(e) => setNewMed({ ...newMed, genericName: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg p-2.5 outline-none text-gray-800 dark:text-slate-100 focus:border-emerald-500 font-medium text-xs"
                      />
                    </div>
                  </div>

                  {/* Product Category Group / Type Switcher */}
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700 dark:text-slate-300 block text-xs">Product Category Group</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-gray-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setNewMed(prev => ({ ...prev, productType: 'medicine', category: 'Antibiotics', subCategory: '' }))}
                        className={`py-1.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                          newMed.productType === 'medicine' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-blue-900/40' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                        }`}
                      >
                        Medicine Formulation
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewMed(prev => ({ ...prev, productType: 'cosmetics', category: 'Shampoo', subCategory: '' }))}
                        className={`py-1.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                          newMed.productType === 'cosmetics' ? 'bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-400 shadow-sm border border-gray-200 dark:border-pink-900/40' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                        }`}
                      >
                        Cosmetics / Skin Care
                      </button>
                    </div>
                  </div>

                  {/* 2. Main Category & Sub Category Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-emerald-50/50 dark:bg-slate-800/60 rounded-xl border border-emerald-200 dark:border-slate-700">
                    {/* Category Selection */}
                    <div className="space-y-1">
                      <label className="font-bold text-emerald-950 dark:text-emerald-200 block text-xs">
                        {newMed.productType === 'cosmetics' ? 'Cosmetics Category' : 'Medicine Main Category'}
                      </label>
                      <select
                        value={
                          (newMed.productType === 'cosmetics' ? dynamicCosmeticsCategories : dynamicMedicineCategories).includes(newMed.category)
                            ? newMed.category
                            : 'others'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'others') {
                            setNewMed(prev => ({ ...prev, category: customCategory || 'others', subCategory: '' }));
                          } else {
                            setNewMed(prev => ({ ...prev, category: val, subCategory: '' }));
                          }
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-emerald-300 dark:border-slate-700 rounded-lg p-2 outline-none text-gray-850 dark:text-slate-100 font-bold text-xs cursor-pointer"
                      >
                        {(newMed.productType === 'cosmetics' ? dynamicCosmeticsCategories : dynamicMedicineCategories).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      {(!((newMed.productType === 'cosmetics' ? dynamicCosmeticsCategories : dynamicMedicineCategories).includes(newMed.category)) || newMed.category === 'others') && (
                        <input
                          type="text"
                          placeholder="Type custom category manually *"
                          required
                          value={customCategory}
                          onChange={(e) => {
                            setCustomCategory(e.target.value);
                            setNewMed(prev => ({ ...prev, category: e.target.value }));
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-emerald-400 rounded-lg p-2 mt-1.5 outline-none text-gray-800 dark:text-slate-200 font-medium text-xs"
                        />
                      )}
                    </div>

                    {/* Sub Category Selection */}
                    <div className="space-y-1">
                      <label className="font-bold text-emerald-950 dark:text-emerald-200 block text-xs">
                        Sub Category / Specific Classification
                      </label>
                      {(() => {
                        const availableSubCats = dynamicSubcategoryMap[newMed.category] || ['General', 'Specialty', 'others'];
                        const isCustomSub = !availableSubCats.includes(newMed.subCategory || '') || newMed.subCategory === 'others';

                        return (
                          <>
                            <select
                              value={isCustomSub ? 'others' : (newMed.subCategory || availableSubCats[0] || 'others')}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'others') {
                                  setNewMed(prev => ({ ...prev, subCategory: customSubCategory || '' }));
                                } else {
                                  setNewMed(prev => ({ ...prev, subCategory: val }));
                                }
                              }}
                              className="w-full bg-white dark:bg-slate-900 border border-emerald-300 dark:border-slate-700 rounded-lg p-2 outline-none text-gray-850 dark:text-slate-100 font-bold text-xs cursor-pointer"
                            >
                              {availableSubCats.map(sub => (
                                <option key={sub} value={sub}>{sub}</option>
                              ))}
                            </select>
                            {(isCustomSub || newMed.subCategory === 'others') && (
                              <input
                                type="text"
                                placeholder="Type custom sub-category..."
                                value={customSubCategory || newMed.subCategory || ''}
                                onChange={(e) => {
                                  setCustomSubCategory(e.target.value);
                                  setNewMed(prev => ({ ...prev, subCategory: e.target.value }));
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-emerald-400 rounded-lg p-2 mt-1.5 outline-none text-gray-800 dark:text-slate-200 font-medium text-xs"
                              />
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Packing Unit & Selling Price Adjustment */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-gray-700 dark:text-slate-300 block text-xs">Packing Unit Option</label>
                      <select
                        value={UNIT_OPTIONS.includes(newMed.unit) ? newMed.unit : 'other'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'other') {
                            setNewMed(prev => ({ ...prev, unit: customUnit || 'other' }));
                          } else {
                            setNewMed(prev => ({ ...prev, unit: val }));
                          }
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg p-2.5 outline-none text-gray-800 dark:text-slate-100 font-medium text-xs cursor-pointer"
                      >
                        {UNIT_OPTIONS.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                      {(!UNIT_OPTIONS.includes(newMed.unit) || newMed.unit === 'other') && (
                        <input
                          type="text"
                          placeholder="Type custom unit manually *"
                          required
                          value={customUnit}
                          onChange={(e) => {
                            setCustomUnit(e.target.value);
                            setNewMed(prev => ({ ...prev, unit: e.target.value }));
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-gray-300 rounded-lg p-2 mt-1 outline-none text-gray-800 text-xs"
                        />
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-gray-700 dark:text-slate-300 block text-xs">Price Adjustment (Retail Selling Price - ETB)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="Price"
                        value={newMed.price}
                        onChange={(e) => setNewMed({ ...newMed, price: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg p-2.5 outline-none text-emerald-700 dark:text-emerald-400 font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  {/* Product Description */}
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700 dark:text-slate-300 block text-xs">Product Description (Visible to Online Customers)</label>
                    <textarea
                      rows={2}
                      placeholder="Brief description for online customer catalog..."
                      value={newMed.description}
                      onChange={(e) => setNewMed({ ...newMed, description: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg p-2 text-xs outline-none text-gray-800 dark:text-slate-100"
                    />
                  </div>

                  {/* Product Picture Field */}
                  <div className="space-y-1 bg-emerald-50/50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-emerald-200 dark:border-slate-700">
                    <div className="flex justify-between items-center">
                      <label className="font-bold text-emerald-900 dark:text-emerald-300 block text-xs">Product Photo / Picture (Optional for Customer View)</label>
                      {newMed.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setNewMed({ ...newMed, imageUrl: '' })}
                          className="text-[10px] text-red-600 dark:text-red-400 font-bold hover:underline"
                        >
                          Clear Photo
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Image URL or upload file..."
                        value={newMed.imageUrl || ''}
                        onChange={(e) => setNewMed({ ...newMed, imageUrl: e.target.value })}
                        className="flex-1 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded p-1.5 text-xs outline-none text-gray-800 dark:text-slate-100"
                      />
                      <label className="cursor-pointer px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs shrink-0 transition shadow-sm">
                        <span>Upload Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setNewMed(prev => ({ ...prev, imageUrl: reader.result as string }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {newMed.imageUrl && (
                      <div className="mt-1 flex items-center space-x-2">
                        <img src={newMed.imageUrl} alt="Product Preview" className="w-10 h-10 object-cover rounded border border-gray-300" />
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">✓ Picture saved for online customer catalog</span>
                      </div>
                    )}
                  </div>

                  {/* 3. Simplified Stock Quantity Adjustment */}
                  <div className="space-y-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-3 mt-2">
                    <label className="font-extrabold text-slate-800 dark:text-slate-200 block text-xs uppercase tracking-wider flex items-center gap-1">
                      📦 Physical Stock Quantity (Branch: {activeBranchId && activeBranchId !== 'all' ? branchesList.find(b => b.id === activeBranchId)?.name || activeBranchId : 'b1'})
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="Stock Quantity"
                      value={newMed.totalQuantity}
                      onChange={(e) => setNewMed({ ...newMed, totalQuantity: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2.5 outline-none text-blue-700 dark:text-blue-400 font-mono font-extrabold text-sm shadow-inner"
                    />
                    <p className="text-[10px] text-slate-500 font-semibold mt-1">
                      Directly sets the total physical units of stock for this product in this branch. No extra batch details or complicated splits needed!
                    </p>
                  </div>

                  <div className="pt-3.5 border-t border-gray-200 dark:border-slate-800 flex gap-2 justify-end">
                    <button
                      type="button"
                      disabled={isSubmittingMed}
                      onClick={() => { setShowAddMedModal(false); setEditingMed(null); }}
                      className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-700 font-semibold cursor-pointer text-xs disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingMed}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-2 px-5 rounded-lg font-bold shadow-md transition-all cursor-pointer text-xs flex items-center gap-1.5"
                    >
                      {isSubmittingMed ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <span>Commit Modifications</span>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Name Fields (Moved to the absolute top of the form with interactive registered auto-suggest) */}
                  <div className="space-y-1 relative">
                    <div className="flex justify-between items-center">
                      <label className="font-bold text-gray-700 dark:text-slate-300 block">
                        {newMed.productType === 'medicine' ? 'Medicine Brand/Product Name' : 'Cosmetic Product Name'}
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-slate-400 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableAutoSuggest}
                          onChange={(e) => setEnableAutoSuggest(e.target.checked)}
                          className="rounded border-gray-300 text-emerald-600 bg-white cursor-pointer h-3.5 w-3.5"
                        />
                        <span>Enable Auto-Suggest</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder={newMed.productType === 'medicine' ? 'e.g. Amoxicillin 500mg' : 'e.g. Aloe Vera Skin Cream'}
                      value={newMed.name}
                      onChange={(e) => {
                        setNewMed({ ...newMed, name: e.target.value, genericName: e.target.value });
                      }}
                      className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded p-2.5 outline-none text-gray-800 dark:text-slate-200 focus:border-emerald-500"
                    />
                    {showSuggestions && (
                      (() => {
                        const matched = getMatchedSuggestions(newMed.name);
                        if (matched.length === 0) return null;
                        return (
                          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                            <div className="p-2 bg-gray-50 dark:bg-slate-950 border-b border-gray-150 dark:border-slate-850 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider flex justify-between items-center">
                              <span>Registered Matches ({matched.length}) — Select to Auto-Fill</span>
                              <span className="text-[9px] text-gray-400 normal-case font-normal">Fills unit, supplier, last batch & prices</span>
                            </div>
                            {matched.map(({ med, lastStock }) => {
                              const suppName = suppliers.find(s => s.id === (lastStock?.supplierId || (med as any).supplierId))?.name || 'Default Supplier';
                              const invNum = (lastStock as any)?.purchaseInvoiceNumber || (med as any).purchaseInvoiceNumber || '';
                              return (
                                <button
                                  key={med.id}
                                  type="button"
                                  onClick={() => selectSuggestion({ med, lastStock })}
                                  className="w-full text-left p-2.5 hover:bg-emerald-50/60 dark:hover:bg-slate-800 text-gray-800 dark:text-slate-200 transition-colors border-b border-gray-100 dark:border-slate-800 last:border-0 flex justify-between items-center cursor-pointer group"
                                >
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-xs text-gray-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">{med.name}</span>
                                      <span className="text-[9px] uppercase px-1.5 py-0.2 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded font-bold">{med.productType || 'medicine'}</span>
                                      <span className="text-[9px] text-gray-500 font-medium">[{med.unit || 'PCS'}]</span>
                                    </div>
                                    <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 flex-wrap">
                                      <span>Cat: {med.category}</span>
                                      <span>•</span>
                                      <span>Sup: {suppName}</span>
                                      {lastStock?.batchNumber && (
                                        <>
                                          <span>•</span>
                                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">Batch: {lastStock.batchNumber}</span>
                                        </>
                                      )}
                                      {lastStock?.expiryDate && (
                                        <>
                                          <span>•</span>
                                          <span className="font-mono text-amber-600 dark:text-amber-400">Exp: {lastStock.expiryDate}</span>
                                        </>
                                      )}
                                      {invNum && (
                                        <>
                                          <span>•</span>
                                          <span className="font-mono text-blue-600 dark:text-blue-400">PIN: {invNum}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right pl-2 shrink-0">
                                    <span className="text-xs bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-300 font-mono font-bold block">
                                      {med.price} ETB
                                    </span>
                                    {lastStock?.buyingPrice ? (
                                      <span className="text-[9px] text-gray-400 font-mono block mt-0.5">
                                        Cost: {lastStock.buyingPrice} ETB
                                      </span>
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
              </div>

              {/* Type Switcher */}
              <div className="space-y-1">
                <label className="font-bold text-gray-700 dark:text-slate-300 block">Product Category Group</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-55 dark:bg-slate-950 p-1 rounded-lg border border-gray-200 dark:border-slate-850">
                  <button
                    type="button"
                    onClick={() => setNewMed(prev => ({ ...prev, productType: 'medicine', category: 'Antibiotics' }))}
                    className={`py-1.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                      newMed.productType === 'medicine' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-blue-900/40' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Medicine Formulation
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewMed(prev => ({ ...prev, productType: 'cosmetics', category: 'Shampoo' }))}
                    className={`py-1.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                      newMed.productType === 'cosmetics' ? 'bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-400 shadow-sm border border-gray-200 dark:border-pink-900/40' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Cosmetics / Skin Care
                  </button>
                </div>
              </div>

              {newMed.productType === 'medicine' && (
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-slate-300 block">Purchase Invoice Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. PIN-2026-9901"
                    value={newMed.purchaseInvoiceNumber || ''}
                    onChange={(e) => setNewMed({ ...newMed, purchaseInvoiceNumber: e.target.value })}
                    className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded p-2.5 outline-none text-gray-800 dark:text-slate-200 focus:border-emerald-500 font-mono"
                  />
                </div>
              )}

              {/* Class, Sub-Category & Unit details with Manual override checks */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-slate-300 block">
                    {newMed.productType === 'cosmetics' ? 'Cosmetics Category' : 'Medicine Category'}
                  </label>
                  <select
                    value={newMed.category}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewMed({ ...newMed, category: val, subCategory: '' });
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg p-2.5 outline-none text-gray-850 dark:text-slate-100 font-medium"
                  >
                    {(newMed.productType === 'cosmetics' ? dynamicCosmeticsCategories : dynamicMedicineCategories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {newMed.category === 'others' && (
                    <input
                      type="text"
                      placeholder="Type custom category manually *"
                      required
                      value={customCategory}
                      onChange={(e) => {
                        setCustomCategory(e.target.value);
                        setNewMed(prev => ({ ...prev, category: e.target.value }));
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg p-2 mt-1 outline-none text-gray-800 dark:text-slate-200"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-slate-300 block">Sub Category</label>
                  {(() => {
                    const availableSubCats = dynamicSubcategoryMap[newMed.category] || ['General', 'Specialty', 'others'];
                    const isCustomSub = !availableSubCats.includes(newMed.subCategory || '') || newMed.subCategory === 'others';

                    return (
                      <>
                        <select
                          value={isCustomSub ? 'others' : (newMed.subCategory || availableSubCats[0] || 'others')}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'others') {
                              setNewMed(prev => ({ ...prev, subCategory: customSubCategory || '' }));
                            } else {
                              setNewMed(prev => ({ ...prev, subCategory: val }));
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg p-2.5 outline-none text-gray-850 dark:text-slate-100 font-medium cursor-pointer"
                        >
                          {availableSubCats.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                        {(isCustomSub || newMed.subCategory === 'others') && (
                          <input
                            type="text"
                            placeholder="Type custom sub-category..."
                            value={customSubCategory || newMed.subCategory || ''}
                            onChange={(e) => {
                              setCustomSubCategory(e.target.value);
                              setNewMed(prev => ({ ...prev, subCategory: e.target.value }));
                            }}
                            className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg p-2 mt-1 outline-none text-gray-800 dark:text-slate-200"
                          />
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-slate-300 block">Packing Unit Option</label>
                  <select
                    value={UNIT_OPTIONS.includes(newMed.unit) ? newMed.unit : 'other'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'other') {
                        setNewMed(prev => ({ ...prev, unit: customUnit || 'other' }));
                      } else {
                        setNewMed(prev => ({ ...prev, unit: val }));
                      }
                    }}
                    className="w-full bg-white border border-gray-300 rounded p-2.5 outline-none text-gray-800"
                  >
                    {UNIT_OPTIONS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                  {(!UNIT_OPTIONS.includes(newMed.unit) || newMed.unit === 'other') && (
                    <input
                      type="text"
                      placeholder="Type custom unit manually *"
                      required
                      value={customUnit}
                      onChange={(e) => {
                        setCustomUnit(e.target.value);
                        setNewMed(prev => ({ ...prev, unit: e.target.value }));
                      }}
                      className="w-full bg-white border border-gray-300 rounded p-2 mt-1 outline-none text-gray-800"
                    />
                  )}
                </div>
              </div>

              {/* Price Calculation Engine */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3.5 text-gray-800">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-750">Retail Selling Price Calculation</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="margin-toggle"
                      checked={newMed.useMarginPricing}
                      onChange={(e) => handleUseMarginToggle(e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600 bg-white"
                    />
                    <label htmlFor="margin-toggle" className="text-[10px] text-gray-500 font-bold">Auto Profit Margin (%)</label>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-semibold block">Buying Cost (ETB)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newMed.buyingPrice}
                      onChange={(e) => handleBuyingPriceChange(Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-800 font-mono font-bold text-[11px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-semibold block">Profit Margin (%)</label>
                    <input
                      type="number"
                      disabled={!newMed.useMarginPricing}
                      min="0"
                      value={newMed.profitMargin}
                      onChange={(e) => handleMarginChange(Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-800 font-mono font-bold text-[11px] disabled:opacity-40"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-semibold block">Retail Selling Price</label>
                    <input
                      type="number"
                      required
                      min="1"
                      disabled={newMed.useMarginPricing}
                      value={newMed.price}
                      onChange={(e) => handleStaticPriceChange(Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-emerald-700 font-mono font-bold text-[11px] disabled:bg-gray-100 disabled:border-gray-200"
                    />
                  </div>
                </div>
              </div>

              {/* Min stock warning and prescription details */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-1">
                  <label className="font-bold text-gray-700 block">Min Stock Warning Level</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newMed.minStockLevel}
                    onChange={(e) => setNewMed({ ...newMed, minStockLevel: Number(e.target.value) })}
                    className="w-full bg-white border border-gray-300 rounded p-2.5 outline-none text-gray-800 font-mono"
                  />
                </div>
                
                {newMed.productType === 'medicine' && (
                  <div className="col-span-2 flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="rx-checkbox-modal"
                      checked={newMed.isPrescriptionRequired}
                      onChange={(e) => setNewMed({ ...newMed, isPrescriptionRequired: e.target.checked })}
                      className="rounded border-gray-300 text-emerald-600 bg-white"
                    />
                    <label htmlFor="rx-checkbox-modal" className="font-bold text-gray-700 leading-normal">
                      Requires Valid Doctor Prescription (Rx)
                    </label>
                  </div>
                )}
              </div>

              {/* Initial Batch & Stock Configuration Section (Only for new items, hide on editing) */}
              {!editingMed && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3 text-gray-800">
                  <h4 className="font-bold text-emerald-800 text-[11px] uppercase tracking-wider flex items-center gap-1">
                    <Package className="h-4.5 w-4.5 text-emerald-600" />
                    Initial Batch & Location Stock Setup
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    {newMed.productType === 'medicine' ? (
                      <div className="space-y-1">
                        <label className="font-bold text-gray-700 block">
                          Batch Number {(Number(newMed.storeQuantity) > 0 || Number(newMed.dispensaryQuantity) > 0) ? '*' : '(Optional)'}
                        </label>
                        <input
                          type="text"
                          required={Number(newMed.storeQuantity) > 0 || Number(newMed.dispensaryQuantity) > 0}
                          placeholder="e.g. B-2026-X1"
                          value={newMed.batchNumber}
                          onChange={(e) => setNewMed({ ...newMed, batchNumber: e.target.value })}
                          className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-800 font-mono"
                        />
                      </div>
                    ) : null}

                    <div className="space-y-1 col-span-1">
                      <label className="font-bold text-gray-700 block">
                        Expiry Date {newMed.productType === 'medicine' && (Number(newMed.storeQuantity) > 0 || Number(newMed.dispensaryQuantity) > 0) ? '*' : '(Optional)'}
                      </label>
                      <input
                        type="date"
                        required={newMed.productType === 'medicine' && (Number(newMed.storeQuantity) > 0 || Number(newMed.dispensaryQuantity) > 0)}
                        value={newMed.expiryDate}
                        onChange={(e) => setNewMed({ ...newMed, expiryDate: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-gray-700 block">Store Quantity</label>
                      <input
                        type="number"
                        min="0"
                        value={newMed.storeQuantity}
                        onChange={(e) => setNewMed({ ...newMed, storeQuantity: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-800 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-gray-700 block">Dispensary Quantity</label>
                      <input
                        type="number"
                        min="0"
                        value={newMed.dispensaryQuantity}
                        onChange={(e) => setNewMed({ ...newMed, dispensaryQuantity: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-800 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-gray-700 block">Preferred Supplier</label>
                      <select
                        value={newMed.supplierId}
                        onChange={(e) => setNewMed({ ...newMed, supplierId: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850"
                      >
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-gray-700 block">Storage Branch</label>
                      <select
                        value={newMed.branchId}
                        onChange={(e) => setNewMed({ ...newMed, branchId: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850"
                      >
                        {branchesList.length > 0 ? (
                          branchesList.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))
                        ) : (
                          <>
                            <option value="b1">Sonan Pharmacy Main Branch</option>
                            <option value="b2">Sonan Pharmacy No. 2</option>
                            <option value="b3">Sonan Pharmacy No. 3</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Product Picture Field & Description */}
                  <div className="space-y-2 bg-emerald-50/50 p-3 rounded-lg border border-emerald-200">
                    <div className="space-y-1">
                      <label className="font-bold text-gray-700 dark:text-slate-300 block text-xs">
                        Product Description (Optional for Online Customer Catalog)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Daily hydrating facial moisturizer for sensitive skin..."
                        value={newMed.description || ''}
                        onChange={(e) => setNewMed({ ...newMed, description: e.target.value })}
                        className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded p-2 text-xs outline-none text-gray-800 dark:text-slate-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="font-bold text-emerald-900 block text-xs">
                          Product Picture / Photo (Optional)
                        </label>
                        {newMed.imageUrl && (
                          <button
                            type="button"
                            onClick={() => setNewMed({ ...newMed, imageUrl: '' })}
                            className="text-[10px] text-red-600 font-bold hover:underline"
                          >
                            Clear Photo
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Paste image URL or click upload..."
                          value={newMed.imageUrl || ''}
                          onChange={(e) => setNewMed({ ...newMed, imageUrl: e.target.value })}
                          className="flex-1 bg-white border border-gray-300 rounded p-1.5 text-xs outline-none text-gray-800"
                        />
                        <label className="cursor-pointer px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs shrink-0 transition shadow-sm">
                          <span>Upload Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setNewMed(prev => ({ ...prev, imageUrl: reader.result as string }));
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                      {newMed.imageUrl && (
                        <div className="mt-1 flex items-center space-x-2">
                          <img src={newMed.imageUrl} alt="Product Preview" className="w-10 h-10 object-cover rounded border border-gray-300" />
                          <span className="text-[10px] text-emerald-700 font-bold">✓ Picture attached for online customer store</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* NEW MEDICINE SPLIT BATCH OPTION */}
                  <div className="pt-2 border-t border-gray-150">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="new-med-split-toggle"
                        checked={isNewMedSplit}
                        onChange={(e) => {
                          setIsNewMedSplit(e.target.checked);
                          if (e.target.checked) {
                            const totalQty = Number(newMed.storeQuantity) + Number(newMed.dispensaryQuantity);
                            const half = Math.max(1, Math.floor(totalQty * 0.75));
                            setNewMedSplitFirstQty(half);
                            const other = branchesList.find(b => b.id !== newMed.branchId)?.id || 'b2';
                            setNewMedSplitSecondBranchId(other);
                          }
                        }}
                        className="rounded border-gray-300 text-emerald-600 bg-white cursor-pointer h-4 w-4"
                      />
                      <label htmlFor="new-med-split-toggle" className="font-bold text-gray-700 cursor-pointer select-none">
                        🔄 Split this registered initial stock quantity between two branches?
                      </label>
                    </div>

                    {isNewMedSplit && (
                      <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 border-dashed">
                        <div className="space-y-1">
                          <label className="font-bold text-emerald-800 block">Qty for {branchesList.find(b => b.id === newMed.branchId)?.name || 'First Branch'}:</label>
                          <input
                            type="number"
                            min="1"
                            max={(Number(newMed.storeQuantity) + Number(newMed.dispensaryQuantity)) - 1}
                            value={newMedSplitFirstQty}
                            onChange={(e) => {
                              const totalQty = Number(newMed.storeQuantity) + Number(newMed.dispensaryQuantity);
                              const val = Math.max(1, Math.min(totalQty - 1, Number(e.target.value)));
                              setNewMedSplitFirstQty(val);
                            }}
                            className="w-full bg-white border border-gray-300 rounded p-1.5 outline-none font-mono text-emerald-900 font-bold text-xs"
                          />
                          <p className="text-[10px] text-gray-500">Must be less than total ({Number(newMed.storeQuantity) + Number(newMed.dispensaryQuantity)})</p>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-emerald-800 block">Assign Remainder to Branch:</label>
                          <select
                            value={newMedSplitSecondBranchId}
                            onChange={(e) => setNewMedSplitSecondBranchId(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded p-1.5 outline-none text-emerald-900 font-semibold text-xs"
                          >
                            {branchesList.filter(b => b.id !== newMed.branchId).map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <p className="text-[10px] font-semibold text-emerald-700 mt-1">
                            Remainder quantity: <strong className="font-mono text-[11px]">{(Number(newMed.storeQuantity) + Number(newMed.dispensaryQuantity)) - newMedSplitFirstQty} units</strong>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Product Indications &amp; Description</label>
                <textarea
                  placeholder="e.g. Broad spectrum formulation or cosmetics details..."
                  value={newMed.description}
                  onChange={(e) => setNewMed({ ...newMed, description: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded p-2.5 outline-none text-gray-800 h-14 resize-none"
                />
              </div>

              <div className="pt-3.5 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400 cursor-pointer font-medium select-none">
                  <input
                    type="checkbox"
                    checked={rememberDefaults}
                    onChange={(e) => setRememberDefaults(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 cursor-pointer"
                  />
                  <span>Save information for next add (persists across backups)</span>
                </label>
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    disabled={isSubmittingMed}
                    onClick={() => { setShowAddMedModal(false); setEditingMed(null); }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg border border-gray-300 font-semibold cursor-pointer text-xs disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingMed}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-2 px-5 rounded-lg font-bold shadow-md transition-all cursor-pointer text-xs flex items-center gap-1.5"
                  >
                    {isSubmittingMed ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving Record...</span>
                      </>
                    ) : (
                      <span>Save Catalog Record</span>
                    )}
                  </button>
                </div>
              </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Existing Stock Batch directly */}
      {editingBatch && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 text-gray-850">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Settings className="h-5 w-5 text-emerald-600" />
                Edit Stock Batch Parameters
              </h3>
              <button onClick={() => setEditingBatch(null)} className="p-1 hover:bg-gray-100 rounded text-gray-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditBatchSubmit} className="space-y-4 text-xs font-sans">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1 text-gray-750">
                <div className="font-bold text-gray-900">
                  {medicines.find(m => m.id === editingBatch.medicineId)?.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 block">Batch Number</label>
                  <input
                    type="text"
                    required
                    value={editingBatch.batchNumber}
                    onChange={(e) => setEditingBatch({ ...editingBatch, batchNumber: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-800 font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 block">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={editingBatch.expiryDate}
                    onChange={(e) => setEditingBatch({ ...editingBatch, expiryDate: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-800 font-mono font-bold"
                  />
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    {[
                      { label: '+3M', months: 3 },
                      { label: '+6M', months: 6 },
                      { label: '+1Y', months: 12 },
                      { label: '+2Y', months: 24 }
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const cur = editingBatch.expiryDate ? new Date(editingBatch.expiryDate) : new Date();
                          const baseDate = isNaN(cur.getTime()) ? new Date() : cur;
                          baseDate.setMonth(baseDate.getMonth() + preset.months);
                          const newStr = baseDate.toISOString().split('T')[0];
                          setEditingBatch({ ...editingBatch, expiryDate: newStr });
                        }}
                        className="bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-blue-700 border border-gray-200 py-0.5 rounded text-[9px] font-bold transition cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 block text-[11px]">Store Qty (units)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingBatch.storeQuantity !== undefined ? editingBatch.storeQuantity : editingBatch.quantity}
                    onChange={(e) => {
                      const sq = Number(e.target.value);
                      const dq = editingBatch.dispensaryQuantity !== undefined ? editingBatch.dispensaryQuantity : 0;
                      setEditingBatch({
                        ...editingBatch,
                        storeQuantity: sq,
                        quantity: sq + dq
                      });
                    }}
                    className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-800 font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 block text-[11px]">Dispensary Qty (units)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingBatch.dispensaryQuantity !== undefined ? editingBatch.dispensaryQuantity : 0}
                    onChange={(e) => {
                      const dq = Number(e.target.value);
                      const sq = editingBatch.storeQuantity !== undefined ? editingBatch.storeQuantity : editingBatch.quantity;
                      setEditingBatch({
                        ...editingBatch,
                        dispensaryQuantity: dq,
                        quantity: sq + dq
                      });
                    }}
                    className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-800 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 block text-[11px]">Total Stock (Calculated)</label>
                  <input
                    type="number"
                    disabled
                    readOnly
                    value={editingBatch.quantity}
                    className="w-full bg-gray-100 border border-gray-300 rounded p-2 outline-none text-gray-500 font-mono font-bold"
                  />
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="checkbox"
                      id="apply-qty-to-all"
                      checked={applyQtyToAll}
                      onChange={(e) => setApplyQtyToAll(e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600 bg-white cursor-pointer h-3.5 w-3.5"
                    />
                    <label htmlFor="apply-qty-to-all" className="text-[10px] text-gray-500 font-bold cursor-pointer select-none">
                      Apply qty & split to all batches
                    </label>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 block text-[11px]">Buying Unit Cost (ETB)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editingBatch.buyingPrice}
                    onChange={(e) => setEditingBatch({ ...editingBatch, buyingPrice: Number(e.target.value) })}
                    className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-800 font-mono"
                  />
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="checkbox"
                      id="apply-price-to-all"
                      checked={applyPriceToAll}
                      onChange={(e) => setApplyPriceToAll(e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600 bg-white cursor-pointer h-3.5 w-3.5"
                    />
                    <label htmlFor="apply-price-to-all" className="text-[10px] text-gray-500 font-bold cursor-pointer select-none">
                      Apply cost to all batches
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50/80 p-2.5 rounded-lg border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-950 block">Damaged / Quarantined Status</span>
                  <span className="text-[10px] text-amber-800 block">Marking as damaged hides stock from POS to prevent dispensing compromised inventory.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={!!editingBatch.isDamaged}
                    onChange={(e) => setEditingBatch({ ...editingBatch, isDamaged: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-gray-700 block">Select Supplier Source</label>
                  <button
                    type="button"
                    onClick={() => setShowInlineSupplierForm(!showInlineSupplierForm)}
                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                  >
                    {showInlineSupplierForm ? '← Back to Select' : '+ Add New Supplier'}
                  </button>
                </div>

                {showInlineSupplierForm ? (
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2 text-gray-800">
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">Quick Register Supplier</span>
                    <input
                      type="text"
                      placeholder="Supplier Business Name *"
                      required
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded p-1.5 outline-none text-gray-800"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Phone Number"
                        value={newSupplierPhone}
                        onChange={(e) => setNewSupplierPhone(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded p-1.5 outline-none text-gray-800 font-mono"
                      />
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={newSupplierEmail}
                        onChange={(e) => setNewSupplierEmail(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded p-1.5 outline-none text-gray-800 font-mono"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Physical Address"
                      value={newSupplierAddress}
                      onChange={(e) => setNewSupplierAddress(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded p-1.5 outline-none text-gray-800"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={handleCreateSupplierInline}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-3 rounded text-[10px]"
                      >
                        Create Supplier
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    value={editingBatch.supplierId}
                    onChange={(e) => setEditingBatch({ ...editingBatch, supplierId: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-800"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200 space-y-2">
                <span className="text-[10px] font-bold text-amber-800 block uppercase tracking-wider">
                  Quantity Change Audit Remark
                </span>
                <div className="space-y-2">
                  <div>
                    <label className="font-bold text-gray-700 block text-[10px] mb-0.5">Who edited it? *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Abel Kebede"
                      value={editWho}
                      onChange={(e) => setEditWho(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded p-1.5 outline-none text-gray-800 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block text-[10px] mb-0.5">Why was it edited? *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Count mismatch correction"
                      value={editWhy}
                      onChange={(e) => setEditWhy(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded p-1.5 outline-none text-gray-800 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingBatch(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded border border-gray-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-5 rounded font-bold shadow-md cursor-pointer"
                >
                  Save Batch Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Quick Edit Expiry Date Modal */}
      {editingExpiryItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-150 max-w-md w-full p-6 text-xs text-gray-800 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-sans font-extrabold text-gray-950 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Edit Batch Expiry Date
                </h3>
                <p className="text-[11px] text-gray-500">Update expiry specifications for this inventory record.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingExpiryItem(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-base p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 space-y-1 text-blue-950">
              <div className="font-extrabold text-xs uppercase">{editingExpiryItem.medicineName}</div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-mono font-semibold">Batch: {editingExpiryItem.batchNumber}</span>
                <span className="bg-blue-100 text-blue-800 font-mono font-bold px-2 py-0.5 rounded text-[10px]">Current: {editingExpiryItem.currentExpiryDate}</span>
              </div>
            </div>

            <form onSubmit={handleSaveExpiryItemSubmit} className="space-y-3">
              <div>
                <label className="font-bold text-gray-800 block mb-1">New Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={editingExpiryItem.newExpiryDate}
                  onChange={(e) => setEditingExpiryItem({ ...editingExpiryItem, newExpiryDate: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 outline-none font-mono font-bold text-gray-900 focus:border-blue-600"
                />
              </div>

              {/* Quick Preset Extension Buttons */}
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Quick Extension Presets</span>
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
                        const cur = editingExpiryItem.currentExpiryDate ? new Date(editingExpiryItem.currentExpiryDate) : new Date();
                        const baseDate = isNaN(cur.getTime()) ? new Date() : cur;
                        baseDate.setMonth(baseDate.getMonth() + preset.months);
                        const newStr = baseDate.toISOString().split('T')[0];
                        setEditingExpiryItem({ ...editingExpiryItem, newExpiryDate: newStr });
                      }}
                      className="bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700 border border-gray-200 py-1.5 px-1 rounded text-[10px] font-bold text-center transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-800 block mb-1">Reason / Adjustment Note</label>
                <input
                  type="text"
                  placeholder="e.g. Manufacturer re-validation certificate, Data correction..."
                  value={editingExpiryItem.reason}
                  onChange={(e) => setEditingExpiryItem({ ...editingExpiryItem, reason: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2 outline-none text-gray-800 placeholder-gray-400"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingExpiryItem(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingExpiryItem || !editingExpiryItem.newExpiryDate}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingExpiryItem ? 'Saving...' : 'Confirm Update Expiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adjust Stock Quantity Offset (quick-adjust) */}
      {selectedStockItem && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 text-gray-850">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Settings className="h-5 w-5 text-emerald-600" />
                Quick Stock Adjustment
              </h3>
              <button onClick={() => setSelectedStockItem(null)} className="p-1 hover:bg-gray-100 rounded text-gray-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustStockSubmit} className="space-y-4 text-xs font-sans">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1 text-gray-750">
                <div className="font-bold text-gray-900 text-sm">
                  {medicines.find(m => m.id === selectedStockItem.medicineId)?.name}
                </div>
                <div>Batch ID: <span className="font-mono font-bold text-gray-850">{selectedStockItem.batchNumber}</span></div>
                <div>Current Batch Total: <strong className="font-mono text-xs text-emerald-700">{selectedStockItem.quantity} units</strong></div>
              </div>

              {/* Toggle Adjustment Mode */}
              <div className="space-y-1.5">
                <label className="font-bold text-gray-700 block">Adjustment Mode</label>
                <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustmentMode('newQty');
                      setTargetNewQty(selectedStockItem.quantity);
                    }}
                    className={`flex-1 py-1.5 text-center font-bold rounded-md cursor-pointer transition-all ${
                      adjustmentMode === 'newQty'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-850'
                    }`}
                  >
                    Set New Total Qty
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustmentMode('offset');
                      setAdjustmentQty(0);
                    }}
                    className={`flex-1 py-1.5 text-center font-bold rounded-md cursor-pointer transition-all ${
                      adjustmentMode === 'offset'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-850'
                    }`}
                  >
                    Apply Offset
                  </button>
                </div>
              </div>

              {adjustmentMode === 'newQty' ? (
                <div className="space-y-1.5">
                  <label className="font-bold text-gray-700 block">Target New Stock Quantity (units)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 5"
                    value={targetNewQty}
                    onChange={(e) => setTargetNewQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 outline-none text-gray-800 font-mono font-bold text-sm"
                  />
                  <span className="text-[10px] text-gray-500 block mt-1 leading-relaxed">
                    The stock of this batch will be adjusted to be <strong>exactly</strong> what you write.
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="font-bold text-gray-700 block">Adjustment Quantity Offset (units)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. -5, 10"
                    value={adjustmentQty || ''}
                    onChange={(e) => setAdjustmentQty(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2.5 outline-none text-gray-800 font-mono font-bold text-sm"
                  />
                  <span className="text-[10px] text-gray-500 block mt-1 leading-relaxed">
                    Use standard negative numbers (e.g. <code>-5</code>) to subtract, or positive numbers (e.g. <code>10</code>) to add.
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-bold text-gray-700 block">Audit Action Reason</label>
                <input
                  type="text"
                  required
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 outline-none text-gray-800"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="damaged-checkbox"
                  checked={adjustingDamaged}
                  onChange={(e) => setAdjustingDamaged(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 bg-white"
                />
                <label htmlFor="damaged-checkbox" className="font-bold text-red-600 cursor-pointer">
                  Flag this batch as DAMAGED &amp; quarantine it.
                </label>
              </div>

              <div className="pt-3 border-t border-gray-200 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedStockItem(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded border border-gray-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-5 rounded font-bold shadow transition-all cursor-pointer"
                >
                  {adjustmentMode === 'newQty' ? 'Set Target Quantity' : 'Apply Offset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Interactive Bin Card Ledger */}
      {binCardProduct && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 border border-gray-200 text-gray-800 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-gray-250 pb-3.5 mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Clipboard className="h-5 w-5 text-emerald-600" />
                  Bin Card Ledger (State-Controlled)
                </h3>
                <p className="text-[10px] text-gray-500 font-mono uppercase mt-0.5">Sonan Pharmacy Consolidated ERP</p>
              </div>
              <button 
                onClick={() => setBinCardProduct(null)} 
                className="p-1 hover:bg-gray-100 rounded text-gray-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingBinCard ? (
              <div className="flex-1 py-12 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin" />
                <span className="text-xs text-gray-500">Loading ledger transaction logs...</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Meta details */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 bg-gray-50 p-3.5 rounded-lg border border-gray-200 text-[11px] text-gray-700">
                  <div>
                    <span className="text-gray-400 block uppercase font-bold text-[9px]">Pharmacy name</span>
                    <span className="font-bold text-gray-900">Sonan Pharmacy</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block uppercase font-bold text-[9px]">Item name</span>
                    <span className="font-bold text-emerald-700">{binCardProduct.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block uppercase font-bold text-[9px]">Packing unit</span>
                    <span>{binCardProduct.unit}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block uppercase font-bold text-[9px]">Buying Price</span>
                    <span className="font-mono font-bold text-gray-900">{binCardProduct.buyingPrice ? `${binCardProduct.buyingPrice.toFixed(2)} ETB` : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block uppercase font-bold text-[9px]">Selling Price</span>
                    <span className="font-mono font-bold text-emerald-700">{binCardProduct.price ? `${binCardProduct.price.toFixed(2)} ETB` : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block uppercase font-bold text-[9px]">Min warning level</span>
                    <span>{binCardProduct.minStockLevel} units</span>
                  </div>
                </div>

                {/* Dropdown Filter Bar */}
                {(() => {
                  const filteredBinCardHistory = binCardHistory.filter(item => {
                    if (binCardTypeFilter === 'ALL') return true;

                    const itemType = (item.type || '').trim().toLowerCase();
                    const party = (item.party || '').trim().toLowerCase();

                    const isPhysicalInv = itemType.includes('physical') || 
                                          itemType.includes('adjustment') || 
                                          itemType.includes('edit') || 
                                          party.includes('physical inventory');

                    const isTransfer = itemType.includes('transfer') || 
                                       party.includes('transfer in') || 
                                       party.includes('transfer out');

                    if (binCardTypeFilter === 'PHYSICAL_INVENTORY') {
                      return isPhysicalInv;
                    }

                    if (binCardTypeFilter === 'TRANSFERRED') {
                      return isTransfer && !isPhysicalInv;
                    }

                    if (binCardTypeFilter === 'RECEIVED') {
                      return (item.quantityReceived > 0 || itemType.includes('received') || itemType.includes('purchase')) && !isTransfer && !isPhysicalInv;
                    }

                    if (binCardTypeFilter === 'ISSUED') {
                      return (item.quantityIssued > 0 || itemType.includes('issued') || itemType.includes('sales')) && !isTransfer && !isPhysicalInv;
                    }

                    return true;
                  });

                  return (
                    <React.Fragment>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 shrink-0">
                            <Filter className="h-3.5 w-3.5 text-emerald-600" />
                            Movement Filter:
                          </label>
                          <select
                            value={binCardTypeFilter}
                            onChange={(e) => setBinCardTypeFilter(e.target.value)}
                            className="bg-white border border-gray-300 text-xs font-extrabold text-gray-800 rounded-lg py-1 px-2.5 outline-none focus:border-emerald-500 cursor-pointer"
                          >
                            <option value="ALL">All Movements ({binCardHistory.length})</option>
                            <option value="RECEIVED">Received Only (Suppliers &amp; Stock Receipts)</option>
                            <option value="ISSUED">Issued Only (Patients &amp; Sales)</option>
                            <option value="TRANSFERRED">Transferred Only (Branch Transfers In &amp; Out)</option>
                            <option value="PHYSICAL_INVENTORY">Physical Inventory Adjustments</option>
                          </select>
                        </div>

                        <div className="text-[11px] text-gray-500 font-medium">
                          Showing <span className="font-extrabold text-emerald-700">{filteredBinCardHistory.length}</span> of <span className="font-bold text-gray-800">{binCardHistory.length}</span> entries
                        </div>
                      </div>

                          {/* Ledger entries table */}
                          <div className="border border-gray-250 rounded-lg overflow-hidden">
                            <table className="min-w-full text-left text-[11px] font-sans">
                              <thead className="bg-gray-50 border-b border-gray-250 font-bold text-gray-700">
                                <tr>
                                  <th className="p-2.5">Date / Timestamp</th>
                                  <th className="p-2.5">Batch Number</th>
                                  <th className="p-2.5">Invoice No.</th>
                                  <th className="p-2.5">Expiry Date</th>
                                  <th className="p-2.5 text-right font-mono text-gray-800">Buying Price</th>
                                  <th className="p-2.5 text-right font-mono text-emerald-800">Selling Price</th>
                                  <th className="p-2.5 text-center">Qty Received (IN)</th>
                                  <th className="p-2.5 text-center">Qty Issued (OUT)</th>
                                  <th className="p-2.5">Received From / Issued To</th>
                                  <th className="p-2.5">Processed By</th>
                                  <th className="p-2.5">Reference No.</th>
                                  <th className="p-2.5 text-right font-mono">Running Balance</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-150 text-gray-700">
                                {filteredBinCardHistory.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50/75">
                                    <td className="p-2.5 font-mono">{item.date}</td>
                                    <td className="p-2.5 font-mono text-gray-500">{item.batchNumber}</td>
                                    <td className="p-2.5 font-mono text-gray-500 font-medium">{item.invoiceNumber || ''}</td>
                                    <td className="p-2.5 font-mono text-gray-500">{item.expiryDate || 'N/A'}</td>
                                    <td className="p-2.5 text-right font-mono text-gray-700 font-medium">
                                      {item.buyingPrice > 0 ? `${item.buyingPrice.toFixed(2)} ETB` : '-'}
                                    </td>
                                    <td className="p-2.5 text-right font-mono text-emerald-700 font-bold">
                                      {item.sellingPrice > 0 ? `${item.sellingPrice.toFixed(2)} ETB` : '-'}
                                    </td>
                                    <td className="p-2.5 text-center font-bold text-emerald-700">
                                      {item.quantityReceived > 0 ? (
                                        <span className="inline-flex items-center gap-0.5">
                                          <ArrowDownLeft className="h-3 w-3" />
                                          +{item.quantityReceived}
                                        </span>
                                      ) : '-'}
                                    </td>
                                    <td className="p-2.5 text-center font-bold text-red-600">
                                      {item.quantityIssued > 0 ? (
                                        <span className="inline-flex items-center gap-0.5">
                                          <ArrowUpRight className="h-3 w-3" />
                                          -{item.quantityIssued}
                                        </span>
                                      ) : '-'}
                                    </td>
                                    <td className="p-2.5 text-gray-800 font-medium">{item.party}</td>
                                    <td className="p-2.5 text-gray-700 font-semibold">{item.user || 'Admin'}</td>
                                    <td className="p-2.5 font-mono text-gray-500">{item.reference}</td>
                                    <td className="p-2.5 text-right font-mono font-bold text-gray-900 text-xs">
                                      {item.balance} units
                                    </td>
                                  </tr>
                                ))}
                                {filteredBinCardHistory.length === 0 && (
                                  <tr>
                                    <td colSpan={12} className="p-6 text-center text-gray-400 italic">No matching transaction logs found for selected filter criteria.</td>
                                  </tr>
                                )}
                              </tbody>
                        </table>
                      </div>
                    </React.Fragment>
                  );
                })()}
              </div>
            )}

            <div className="pt-3.5 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 font-bold py-2 px-4 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                Print Ledger
              </button>
              <button
                onClick={() => setBinCardProduct(null)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-5 rounded-lg cursor-pointer"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Store to Dispensary Transfer */}
      {selectedTransferStockItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-150 text-xs text-gray-800">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-sm font-black text-gray-950 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowDownRight className="h-4.5 w-4.5 text-emerald-600" />
                Store to Dispensary Transfer
              </h3>
              <button 
                onClick={() => setSelectedTransferStockItem(null)}
                className="text-gray-400 hover:text-gray-600 p-1 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleTransferToDispSubmit} className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-150 text-xs font-medium space-y-1.5">
                <div>
                  <span className="text-gray-400 font-bold uppercase text-[9px] block">Product Name</span>
                  <span className="text-gray-900 font-bold">
                    {medicines.find(m => m.id === selectedTransferStockItem.medicineId)?.name || 'Unknown Item'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[9px] block">Batch Number</span>
                    <span className="text-gray-900 font-mono font-bold">{selectedTransferStockItem.batchNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[9px] block">Expiry Date</span>
                    <span className="text-gray-900 font-mono font-bold">{selectedTransferStockItem.expiryDate || 'N/A'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[9px] block">Store Stock (Available)</span>
                    <span className="text-emerald-700 font-mono font-extrabold text-[13px]">
                      {selectedTransferStockItem.storeQuantity !== undefined ? selectedTransferStockItem.storeQuantity : selectedTransferStockItem.quantity} units
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[9px] block">Dispensary Stock</span>
                    <span className="text-indigo-600 font-mono font-extrabold text-[13px]">
                      {selectedTransferStockItem.dispensaryQuantity !== undefined ? selectedTransferStockItem.dispensaryQuantity : 0} units
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-700 block font-bold">Quantity to Transfer from Store to Dispensary:</label>
                <input
                  type="number"
                  min="1"
                  max={selectedTransferStockItem.storeQuantity !== undefined ? selectedTransferStockItem.storeQuantity : selectedTransferStockItem.quantity}
                  value={transferToDispQty || ''}
                  onChange={(e) => setTransferToDispQty(Math.min(
                    selectedTransferStockItem.storeQuantity !== undefined ? selectedTransferStockItem.storeQuantity : selectedTransferStockItem.quantity,
                    Math.max(1, Number(e.target.value))
                  ))}
                  required
                  className="w-full bg-white border border-gray-350 p-2.5 rounded-lg outline-none font-bold text-gray-800 text-xs focus:border-indigo-500 shadow-sm"
                  placeholder={`Enter quantity (max: ${selectedTransferStockItem.storeQuantity !== undefined ? selectedTransferStockItem.storeQuantity : selectedTransferStockItem.quantity})`}
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTransferStockItem(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTransferringToDisp}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-5 rounded-lg transition-all shadow-md flex items-center gap-1 cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isTransferringToDisp ? 'Transferring...' : 'Complete Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk Transfer of stock */}
      {showBulkTransferModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 border border-gray-250 text-gray-800 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4 sticky top-0 bg-white z-10">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <ArrowRightLeft className="h-5 w-5 text-amber-500" />
                Inter-Branch Bulk Stock Transfer
              </h3>
              <button onClick={() => setShowBulkTransferModal(false)} className="p-1 hover:bg-gray-100 rounded text-gray-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div>
                  <label className="text-gray-400 block uppercase font-bold text-[9px] mb-1">Source Warehouse</label>
                  <select
                    value={bulkSourceBranchId}
                    onChange={(e) => handleBulkSourceBranchChange(e.target.value)}
                    className="bg-white border border-gray-300 text-gray-800 rounded px-2.5 py-1 text-xs w-full font-bold"
                  >
                    {branchesList.length > 0 ? (
                      branchesList.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="b1">Sonan Pharmacy Main Branch</option>
                        <option value="b2">Sonan Pharmacy No. 2</option>
                        <option value="b3">Sonan Pharmacy No. 3</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block uppercase font-bold text-[9px] mb-1">Target Pharmacy Branch</label>
                  <select
                    value={bulkTargetBranchId}
                    onChange={(e) => setBulkTargetBranchId(e.target.value)}
                    className="bg-white border border-gray-300 text-gray-800 rounded px-2.5 py-1 text-xs w-full font-bold"
                  >
                    {branchesList.length > 0 ? (
                      branchesList.filter(b => b.id !== bulkSourceBranchId).map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="b1">Sonan Pharmacy Main Branch</option>
                        <option value="b2">Sonan Pharmacy No. 2</option>
                        <option value="b3">Sonan Pharmacy No. 3</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Selection list */}
              <div className="space-y-1">
                <label className="font-bold text-gray-700 block font-sans">Select Active Batches in source branch:</label>
                <div className="border border-gray-200 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1 bg-white">
                  {stockItems
                    .filter(st => st.branchId === bulkSourceBranchId && st.quantity > 0 && !st.isDamaged)
                    .map(st => {
                      const med = medicines.find(m => m.id === st.medicineId);
                      const isAdded = bulkTransferItems.some(x => x.stockItemId === st.id);
                      return (
                        <div key={st.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200">
                          <div>
                            <span className="font-bold text-gray-800 block">{med?.name}</span>
                            <span className="text-[10px] text-gray-500 font-mono">Batch: {st.batchNumber} • Qty: {st.quantity}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => isAdded ? removeBulkTransferLine(st.id) : addBulkTransferLine(st.id)}
                            className={`py-1 px-2.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                              isAdded ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {isAdded ? 'Remove' : 'Select'}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Selected parameters list with adjustable quantities */}
              <div className="space-y-1.5">
                <label className="font-bold text-gray-700 block">Transfer quantities of selected items:</label>
                <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50 max-h-44 overflow-y-auto">
                  {bulkTransferItems.map(bItem => {
                    const st = stockItems.find(x => x.id === bItem.stockItemId)!;
                    const med = medicines.find(m => m.id === st.medicineId);
                    return (
                      <div key={bItem.stockItemId} className="flex items-center justify-between border-b border-gray-200 pb-2 text-[11px]">
                        <div className="max-w-[50%]">
                          <span className="font-bold text-gray-800 block truncate">{med?.name}</span>
                          <span className="text-[9px] text-gray-500 font-mono block">Batch: {st.batchNumber} (Max: {st.quantity})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={st.quantity}
                            value={bItem.quantity}
                            onChange={(e) => updateBulkTransferLineQty(bItem.stockItemId, Math.min(st.quantity, Math.max(1, Number(e.target.value))))}
                            className="w-16 bg-white border border-gray-300 text-center text-gray-800 font-mono rounded p-1 font-bold text-xs outline-none"
                          />
                          <button
                            onClick={() => removeBulkTransferLine(bItem.stockItemId)}
                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {bulkTransferItems.length === 0 && (
                    <div className="p-4 text-center text-gray-400 italic text-[11px]">No batches selected for transfer above.</div>
                  )}
                </div>
              </div>

              <div className="pt-3.5 border-t border-gray-200 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowBulkTransferModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg border border-gray-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeBulkTransfer}
                  disabled={bulkTransferItems.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-5 rounded-lg font-bold shadow-md disabled:opacity-50 cursor-pointer"
                >
                  Process Bulk Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🗑️ ITEM DELETION MODAL (Supports Bulk & Single Item, All vs Specific Branch) */}
      {showItemDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-150 overflow-hidden text-left">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
                  <Trash2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">
                    {itemsToDelete.length > 1
                      ? `Bulk Delete ${itemsToDelete.length} ${deleteTargetType === 'products' ? 'Products' : 'Stock Batches'}`
                      : `Delete ${deleteTargetType === 'products' ? 'Product' : 'Stock Batch'}`
                    }
                  </h3>
                  <p className="text-xs text-red-100 font-medium">
                    Select branch deletion scope and confirm action
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowItemDeleteModal(false)}
                disabled={isDeleting}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Selected Items List Box */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Item(s) Selected for Deletion ({itemsToDelete.length})
                </label>
                <div className="max-h-32 overflow-y-auto bg-gray-50 p-3 rounded-xl border border-gray-200 divide-y divide-gray-200 space-y-1">
                  {itemsToDelete.map((item) => (
                    <div key={item.id} className="pt-1 first:pt-0 flex items-center justify-between text-xs font-semibold text-gray-800">
                      <span className="truncate pr-2">• {item.name}</span>
                      <span className="text-[10px] font-mono text-gray-500 shrink-0">ID: {item.id}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deletion Scope Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                  Select Deletion Scope:
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  
                  {/* Option 1: ALL Branches */}
                  <label className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    deleteScope === 'all' 
                      ? 'bg-red-50/70 border-red-300 ring-2 ring-red-500/20' 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="deleteScope"
                      value="all"
                      checked={deleteScope === 'all'}
                      onChange={() => setDeleteScope('all')}
                      className="mt-0.5 text-red-600 focus:ring-red-500 h-4 w-4 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-extrabold text-xs text-gray-900">
                        <Globe className="h-3.5 w-3.5 text-red-600" />
                        <span>Delete from ALL Branches (Global Catalog Removal)</span>
                      </div>
                      <p className="text-[11px] text-gray-600">
                        {deleteTargetType === 'products'
                          ? 'Permanently removes the product definition from the catalog and deletes all stock batches across all pharmacy branches.'
                          : 'Deletes selected stock batch(es) globally across all branches.'
                        }
                      </p>
                    </div>
                  </label>

                  {/* Option 2: SPECIFIC Branch */}
                  <label className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    deleteScope === 'specific' 
                      ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20' 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="deleteScope"
                      value="specific"
                      checked={deleteScope === 'specific'}
                      onChange={() => setDeleteScope('specific')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                    />
                    <div className="space-y-2 w-full">
                      <div className="flex items-center gap-1.5 font-extrabold text-xs text-gray-900">
                        <Building2 className="h-3.5 w-3.5 text-amber-600" />
                        <span>Delete from a SPECIFIC Branch Only</span>
                      </div>
                      <p className="text-[11px] text-gray-600">
                        Removes stock batches for the selected item(s) only from the chosen branch.
                      </p>

                      {/* Branch Selector Dropdown */}
                      {deleteScope === 'specific' && (
                        <div className="pt-1">
                          <select
                            value={deleteBranchId}
                            onChange={(e) => setDeleteBranchId(e.target.value)}
                            className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          >
                            {branchesList.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.name} ({b.location || 'Branch'})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </label>

                </div>
              </div>

              {/* Warning Box */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Permanent Deletion Warning</span>
                  <p className="text-[11px] text-red-700">
                    This action will update inventory ledgers and write audit log entries. It cannot be undone.
                  </p>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowItemDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-white text-gray-700 font-bold text-xs rounded-xl border border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExecuteDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>
                      Confirm Delete ({itemsToDelete.length} {itemsToDelete.length === 1 ? 'Item' : 'Items'})
                    </span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
